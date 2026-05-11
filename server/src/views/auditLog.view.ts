// auditLog.view.ts
// Serialización de entradas del log de auditoría.
// Issue #47.

import type { AuditLog } from '../types/entities';

export function auditLogView(entry: AuditLog): AuditLog {
  return entry;
}

export function auditLogsView(entries: AuditLog[]): AuditLog[] {
  return entries.map(auditLogView);
}
