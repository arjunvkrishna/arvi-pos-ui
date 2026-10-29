import { api } from '../../api/client';

export interface AuditLog { id: number; action?: string; entityType?: string; entityId?: number | string | null; performedByName?: string | null; performedAt?: string | null; oldValue?: string | null; newValue?: string | null }
export const auditKey = ['audit-logs'] as const;
export const fetchAudit = () => api<AuditLog[]>('/audit-logs');
