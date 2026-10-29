import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { PageHeader, Skeleton } from '../../components/ui';
import { showToast } from '../../components/toast';
import { useSession } from '../../api/session';
import {
  fetchCategories,
  createCategory,
  fetchDocuments,
  createDocument,
  deleteDocument,
  uploadAttachment,
  deleteAttachment,
  getDownloadAttachmentUrl,
  type DocumentItem,
  type DocumentCategory,
} from './api';

const fmtFileSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
};

export function DocumentsPage() {
  const qc = useQueryClient();
  const session = useSession((s) => s.user);
  const isManager = session?.role === 'ADMIN' || session?.role === 'MANAGER';

  const [selectedCatId, setSelectedCatId] = useState<number | undefined>(undefined);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDoc, setSelectedDoc] = useState<DocumentItem | null>(null);

  // New Doc Modal
  const [isNewDocOpen, setIsNewDocOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');
  const [newCatId, setNewCatId] = useState<number>(0);
  const [newTagsStr, setNewTagsStr] = useState('');

  // New Category Modal
  const [isNewCatOpen, setIsNewCatOpen] = useState(false);
  const [newCatName, setNewCatName] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  const categoriesQ = useQuery({ queryKey: ['document-categories'], queryFn: fetchCategories });
  const documentsQ = useQuery({
    queryKey: ['documents', selectedCatId],
    queryFn: () => fetchDocuments(selectedCatId),
  });

  const createDocMutation = useMutation({
    mutationFn: (body: { title: string; content: string; categoryId: number; tags?: string[] }) =>
      createDocument(body),
    onSuccess: (saved) => {
      showToast('Document created successfully!', 'success');
      setIsNewDocOpen(false);
      setNewTitle('');
      setNewContent('');
      setNewTagsStr('');
      setSelectedDoc(saved);
      void qc.invalidateQueries({ queryKey: ['documents'] });
    },
    onError: (err: Error) => showToast(err.message, 'error'),
  });

  const deleteDocMutation = useMutation({
    mutationFn: (id: number) => deleteDocument(id),
    onSuccess: () => {
      showToast('Document deleted', 'success');
      setSelectedDoc(null);
      void qc.invalidateQueries({ queryKey: ['documents'] });
    },
    onError: (err: Error) => showToast(err.message, 'error'),
  });

  const createCatMutation = useMutation({
    mutationFn: (name: string) => createCategory(name),
    onSuccess: () => {
      showToast('Category created!', 'success');
      setIsNewCatOpen(false);
      setNewCatName('');
      void qc.invalidateQueries({ queryKey: ['document-categories'] });
    },
    onError: (err: Error) => showToast(err.message, 'error'),
  });

  const uploadAttachMutation = useMutation({
    mutationFn: async ({ docId, file }: { docId: number; file: File }) => {
      return uploadAttachment(docId, file);
    },
    onSuccess: () => {
      showToast('File attached successfully!', 'success');
      void qc.invalidateQueries({ queryKey: ['documents'] });
    },
    onError: (err: Error) => showToast(err.message, 'error'),
  });

  const deleteAttachMutation = useMutation({
    mutationFn: (attachId: number) => deleteAttachment(attachId),
    onSuccess: () => {
      showToast('Attachment deleted', 'success');
      void qc.invalidateQueries({ queryKey: ['documents'] });
    },
    onError: (err: Error) => showToast(err.message, 'error'),
  });

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedDoc) return;
    if (file.size > 5 * 1024 * 1024) {
      showToast('File is too large! Maximum allowed upload size is 5MB.', 'error');
      return;
    }
    uploadAttachMutation.mutate({ docId: selectedDoc.id, file });
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const categories = categoriesQ.data ?? [];
  const rawDocs = documentsQ.data ?? [];

  const filteredDocs = rawDocs.filter((d) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const titleMatch = d.title.toLowerCase().includes(q);
    const tagMatch = d.tags?.some((t) => t.toLowerCase().includes(q));
    const contentMatch = d.content?.toLowerCase().includes(q);
    return titleMatch || tagMatch || contentMatch;
  });

  const activeDoc = selectedDoc ? (rawDocs.find((d) => d.id === selectedDoc.id) ?? selectedDoc) : null;

  return (
    <section id="tab-documents" data-testid="tab-documents" className="space-y-6">
      <PageHeader
        title="Documents & SOPs"
        description="Standard operating procedures, employment contracts, food safety policies, and attachments (<5MB)."
        actions={
          isManager ? (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsNewCatOpen(true)}
                className="btn btn-secondary text-sm flex items-center gap-1.5"
              >
                <i className="fa-solid fa-folder-plus" />
                <span>New Category</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setNewCatId(categories[0]?.id ?? 0);
                  setIsNewDocOpen(true);
                }}
                className="btn btn-primary text-sm flex items-center gap-1.5"
              >
                <i className="fa-solid fa-file-plus" />
                <span>New Document</span>
              </button>
            </div>
          ) : null
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        {/* Left Column: Categories and Document List */}
        <div className="md:col-span-5 lg:col-span-4 space-y-4">
          {/* Category Tabs */}
          <div className="flex flex-wrap gap-1.5 p-1 bg-muted/20 rounded-xl">
            <button
              type="button"
              onClick={() => setSelectedCatId(undefined)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                selectedCatId === undefined ? 'bg-card text-primary shadow-sm' : 'text-muted hover:text-fg'
              }`}
            >
              All Categories
            </button>
            {categories.map((c: DocumentCategory) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setSelectedCatId(c.id)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                  selectedCatId === c.id ? 'bg-card text-primary shadow-sm' : 'text-muted hover:text-fg'
                }`}
              >
                {c.name}
              </button>
            ))}
          </div>

          {/* Search Box */}
          <div className="relative">
            <i className="fa-solid fa-magnifying-glass absolute left-3 top-2.5 text-muted text-xs" />
            <input
              type="text"
              placeholder="Search documents or tags..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input w-full pl-8 pr-3 py-1.5 text-xs border border-border bg-card rounded-lg text-fg"
            />
          </div>

          {/* Document Items List */}
          {documentsQ.isPending ? (
            <div className="card p-4"><Skeleton rows={4} /></div>
          ) : filteredDocs.length === 0 ? (
            <div className="card p-6 text-center text-muted text-xs">
              No documents found.
            </div>
          ) : (
            <div className="card divide-y divide-border/60 max-h-[600px] overflow-y-auto">
              {filteredDocs.map((doc: DocumentItem) => (
                <div
                  key={doc.id}
                  onClick={() => setSelectedDoc(doc)}
                  className={`p-3.5 cursor-pointer transition-colors ${
                    activeDoc?.id === doc.id ? 'bg-primary/10 border-l-4 border-l-primary' : 'hover:bg-muted/10'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold text-sm text-fg line-clamp-1">{doc.title}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-muted/30 text-muted font-medium">
                      {doc.categoryName}
                    </span>
                  </div>
                  <p className="text-xs text-muted line-clamp-2">{doc.content || 'No text content preview.'}</p>
                  <div className="flex items-center gap-2 mt-2 text-[10px] text-muted">
                    <span>
                      <i className="fa-solid fa-paperclip mr-1" />
                      {doc.attachments?.length ?? 0} files
                    </span>
                    {doc.tags && doc.tags.length > 0 && (
                      <span className="line-clamp-1">
                        <i className="fa-solid fa-tag mr-1" />
                        {doc.tags.join(', ')}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right Column: Document Viewer & Attachments */}
        <div className="md:col-span-7 lg:col-span-8">
          {!activeDoc ? (
            <div className="card p-12 text-center text-muted space-y-3">
              <i className="fa-solid fa-file-lines text-4xl text-muted/40" />
              <h3 className="text-base font-semibold text-fg">Select a document to read</h3>
              <p className="text-xs text-muted max-w-sm mx-auto">
                Choose an SOP, contract or training manual from the list on the left to view details and download attachments.
              </p>
            </div>
          ) : (
            <div className="card p-6 space-y-6">
              {/* Header */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs px-2.5 py-0.5 rounded-full bg-primary/10 text-primary font-bold">
                      {activeDoc.categoryName}
                    </span>
                    {activeDoc.createdAt && (
                      <span className="text-xs text-muted">
                        Added: {new Date(activeDoc.createdAt).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                  <h2 className="text-xl font-bold text-fg">{activeDoc.title}</h2>
                </div>
                {isManager && (
                  <button
                    type="button"
                    onClick={() => {
                      if (confirm(`Delete document "${activeDoc.title}"?`)) {
                        deleteDocMutation.mutate(activeDoc.id);
                      }
                    }}
                    className="btn btn-secondary text-xs text-rose-500 hover:bg-rose-500/10 px-3 py-1.5"
                  >
                    <i className="fa-solid fa-trash mr-1" /> Delete
                  </button>
                )}
              </div>

              {/* Tags */}
              {activeDoc.tags && activeDoc.tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {activeDoc.tags.map((t) => (
                    <span key={t} className="text-xs px-2.5 py-0.5 bg-muted/30 text-fg rounded-full">
                      #{t}
                    </span>
                  ))}
                </div>
              )}

              {/* Text / SOP Content */}
              <div className="bg-muted/10 p-5 rounded-xl border border-border text-sm leading-relaxed text-fg whitespace-pre-wrap min-h-[140px]">
                {activeDoc.content || 'No text content provided for this document.'}
              </div>

              {/* Attachments Section */}
              <div className="space-y-4 pt-4 border-t border-border">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-fg flex items-center gap-2">
                    <i className="fa-solid fa-paperclip text-primary" />
                    <span>Attached Files ({activeDoc.attachments?.length ?? 0})</span>
                  </h3>
                  {isManager && (
                    <div>
                      <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileUpload}
                        className="hidden"
                        accept=".pdf,.png,.jpg,.jpeg,.docx,.xlsx,.txt"
                      />
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploadAttachMutation.isPending}
                        className="btn btn-secondary text-xs flex items-center gap-1.5 px-3 py-1.5"
                      >
                        <i className={`fa-solid fa-upload ${uploadAttachMutation.isPending ? 'animate-spin' : ''}`} />
                        <span>Upload File (Max 5MB)</span>
                      </button>
                    </div>
                  )}
                </div>

                {(!activeDoc.attachments || activeDoc.attachments.length === 0) ? (
                  <p className="text-xs text-muted py-3">No attachments uploaded yet for this document.</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {activeDoc.attachments.map((att) => (
                      <div
                        key={att.id}
                        className="p-3 bg-card border border-border rounded-xl flex items-center justify-between text-xs hover:border-primary/40 transition-colors"
                      >
                        <div className="flex items-center gap-2.5 min-w-0 pr-2">
                          <i className="fa-solid fa-file text-primary text-lg" />
                          <div className="min-w-0">
                            <p className="font-semibold text-fg truncate">{att.filename}</p>
                            <p className="text-[10px] text-muted">{fmtFileSize(att.fileSizeBytes)}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <a
                            href={getDownloadAttachmentUrl(att.id)}
                            download={att.filename}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn btn-secondary text-xs px-2.5 py-1 text-primary hover:bg-primary/10"
                            title="Download attachment"
                          >
                            <i className="fa-solid fa-download" />
                          </a>
                          {isManager && (
                            <button
                              type="button"
                              onClick={() => deleteAttachMutation.mutate(att.id)}
                              className="btn btn-secondary text-xs px-2.5 py-1 text-rose-500 hover:bg-rose-500/10"
                              title="Delete attachment"
                            >
                              <i className="fa-solid fa-trash" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* New Document Modal */}
      {isNewDocOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="card max-w-lg w-full p-6 space-y-4">
            <div className="flex justify-between items-center border-b border-border pb-3">
              <h3 className="text-base font-semibold text-fg">Create New Document</h3>
              <button
                type="button"
                onClick={() => setIsNewDocOpen(false)}
                className="text-muted hover:text-fg text-lg"
              >
                ✕
              </button>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!newTitle.trim() || !newCatId) {
                  showToast('Title and category are required', 'error');
                  return;
                }
                const tags = newTagsStr
                  .split(',')
                  .map((t) => t.trim())
                  .filter(Boolean);
                createDocMutation.mutate({
                  title: newTitle.trim(),
                  content: newContent.trim(),
                  categoryId: newCatId,
                  tags,
                });
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-xs font-medium text-muted mb-1">Document Title</label>
                <input
                  type="text"
                  placeholder="e.g. Espresso Machine Opening Cleaning SOP"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="input w-full border border-border bg-card px-3 py-2 rounded-lg text-sm text-fg"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-muted mb-1">Category</label>
                <select
                  value={newCatId}
                  onChange={(e) => setNewCatId(Number(e.target.value))}
                  className="input w-full border border-border bg-card px-3 py-2 rounded-lg text-sm text-fg"
                  required
                >
                  {categories.map((c: DocumentCategory) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-muted mb-1">Tags (Comma-separated)</label>
                <input
                  type="text"
                  placeholder="e.g. kitchen, coffee, opening, hygiene"
                  value={newTagsStr}
                  onChange={(e) => setNewTagsStr(e.target.value)}
                  className="input w-full border border-border bg-card px-3 py-2 rounded-lg text-sm text-fg"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-muted mb-1">Content / Policy Notes</label>
                <textarea
                  rows={6}
                  placeholder="Step-by-step procedures, terms, rules or guidelines..."
                  value={newContent}
                  onChange={(e) => setNewContent(e.target.value)}
                  className="input w-full border border-border bg-card px-3 py-2 rounded-lg text-sm text-fg"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-border">
                <button
                  type="button"
                  onClick={() => setIsNewDocOpen(false)}
                  className="btn btn-secondary text-sm px-4 py-2"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createDocMutation.isPending}
                  className="btn btn-primary text-sm px-4 py-2"
                >
                  {createDocMutation.isPending ? 'Saving...' : 'Save Document'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* New Category Modal */}
      {isNewCatOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="card max-w-sm w-full p-6 space-y-4">
            <div className="flex justify-between items-center border-b border-border pb-3">
              <h3 className="text-base font-semibold text-fg">New Document Category</h3>
              <button
                type="button"
                onClick={() => setIsNewCatOpen(false)}
                className="text-muted hover:text-fg text-lg"
              >
                ✕
              </button>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!newCatName.trim()) return;
                createCatMutation.mutate(newCatName.trim());
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-xs font-medium text-muted mb-1">Category Name</label>
                <input
                  type="text"
                  placeholder="e.g. Franchise Agreements"
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                  className="input w-full border border-border bg-card px-3 py-2 rounded-lg text-sm text-fg"
                  required
                />
              </div>
              <div className="flex justify-end gap-3 pt-3 border-t border-border">
                <button
                  type="button"
                  onClick={() => setIsNewCatOpen(false)}
                  className="btn btn-secondary text-sm px-4 py-2"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createCatMutation.isPending}
                  className="btn btn-primary text-sm px-4 py-2"
                >
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}
