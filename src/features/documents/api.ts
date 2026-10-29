import { api, authHeaders } from '../../api/client';

export interface DocumentCategory {
  id: number;
  name: string;
  createdAt?: string;
}

export interface DocumentAttachment {
  id: number;
  documentId: number;
  filename: string;
  contentType: string;
  fileSizeBytes: number;
  uploadedBy?: number;
  uploadedAt?: string;
}

export interface DocumentItem {
  id: number;
  title: string;
  content?: string;
  categoryId: number;
  categoryName?: string;
  tags?: string[];
  isActive?: boolean;
  createdBy?: number;
  createdAt?: string;
  updatedAt?: string;
  attachments?: DocumentAttachment[];
}

export interface DocumentInput {
  title: string;
  content?: string;
  categoryId: number;
  tags?: string[];
}

export const fetchCategories = () => api<DocumentCategory[]>('/documents/categories');

export const createCategory = (name: string) =>
  api<DocumentCategory>('/documents/categories', { method: 'POST', body: { name } });

export const deleteCategory = (id: number) =>
  api<void>(`/documents/categories/${id}`, { method: 'DELETE' });

export const fetchDocuments = (categoryId?: number) =>
  api<DocumentItem[]>(categoryId ? `/documents?categoryId=${categoryId}` : '/documents');

export const fetchDocument = (id: number) =>
  api<DocumentItem>(`/documents/${id}`);

export const createDocument = (body: DocumentInput) =>
  api<DocumentItem>('/documents', { method: 'POST', body });

export const updateDocument = (id: number, body: Partial<DocumentInput>) =>
  api<DocumentItem>(`/documents/${id}`, { method: 'PUT', body });

export const deleteDocument = (id: number) =>
  api<void>(`/documents/${id}`, { method: 'DELETE' });

export const uploadAttachment = async (documentId: number, file: File): Promise<DocumentAttachment> => {
  if (file.size > 5 * 1024 * 1024) {
    throw new Error('File size exceeds the 5MB maximum limit.');
  }

  const formData = new FormData();
  formData.append('file', file);

  const res = await fetch(`/api/documents/${documentId}/attachments`, {
    method: 'POST',
    headers: authHeaders(),   // the browser adds the multipart boundary itself
    body: formData,
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => 'Upload failed');
    throw new Error(errText || 'Attachment upload failed');
  }

  return res.json();
};

export const deleteAttachment = (attachmentId: number) =>
  api<void>(`/documents/attachments/${attachmentId}`, { method: 'DELETE' });

export const getDownloadAttachmentUrl = (attachmentId: number) =>
  `/api/documents/attachments/${attachmentId}/download`;
