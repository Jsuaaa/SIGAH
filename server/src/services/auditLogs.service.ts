// auditLogs.service.ts
// Lógica de negocio para consulta del log de auditoría inmutable.
// Solo accesible a ADMIN y FUNCIONARIO_CONTROL (HU-31 CA3, Issue #47).

import { AuditLogModel, type AuditLogFilters } from '../models/auditLog.model';
import type { AuditLog } from '../types/entities';

export interface ListAuditFilters extends AuditLogFilters {
  page: number;
  limit: number;
  skip: number;
}

export async function list(
  filters: ListAuditFilters,
): Promise<{ data: AuditLog[]; total: number }> {
  const modelFilters: AuditLogFilters = {};
  if (filters.user_id !== undefined) modelFilters.user_id = filters.user_id;
  if (filters.module !== undefined) modelFilters.module = filters.module;
  if (filters.action !== undefined) modelFilters.action = filters.action;
  if (filters.entity !== undefined) modelFilters.entity = filters.entity;
  if (filters.entity_id !== undefined) modelFilters.entity_id = filters.entity_id;
  if (filters.date_from !== undefined) modelFilters.date_from = filters.date_from;
  if (filters.date_to !== undefined) modelFilters.date_to = filters.date_to;

  return AuditLogModel.list(modelFilters, filters.limit, filters.skip);
}
