// auditLog.model.ts
// Acceso a datos para audit_logs — solo lectura (tabla append-only).
// Issue #47 (HU-31, RNF-09).

import { db } from '../db/client';
import type { AuditLog } from '../types/entities';

export interface AuditLogFilters {
  user_id?: number;
  module?: string;
  action?: string;
  entity?: string;
  entity_id?: number;
  date_from?: string;
  date_to?: string;
}

interface AuditListRow {
  data: AuditLog;
  total: string; // BIGINT viene como string desde pg
}

export const AuditLogModel = {
  async list(
    filters: AuditLogFilters,
    limit: number,
    offset: number,
  ): Promise<{ data: AuditLog[]; total: number }> {
    const filtersJson: Record<string, unknown> = {};
    if (filters.user_id !== undefined) filtersJson.user_id = filters.user_id;
    if (filters.module !== undefined) filtersJson.module = filters.module;
    if (filters.action !== undefined) filtersJson.action = filters.action;
    if (filters.entity !== undefined) filtersJson.entity = filters.entity;
    if (filters.entity_id !== undefined) filtersJson.entity_id = filters.entity_id;
    if (filters.date_from !== undefined) filtersJson.date_from = filters.date_from;
    if (filters.date_to !== undefined) filtersJson.date_to = filters.date_to;

    const result = await db.query<AuditListRow>(
      'SELECT data, total FROM fn_audit_list($1::jsonb, $2, $3)',
      [JSON.stringify(filtersJson), limit, offset],
    );

    if (result.rows.length === 0) return { data: [], total: 0 };

    const total = Number(result.rows[0].total);
    const data = result.rows.map((r) => r.data);
    return { data, total };
  },
};
