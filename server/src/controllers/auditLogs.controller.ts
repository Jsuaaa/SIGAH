// auditLogs.controller.ts
// Controlador para el endpoint de lectura de audit_logs.
// Solo accesible a ADMIN y FUNCIONARIO_CONTROL (HU-31 CA3, Issue #47).

import * as auditLogsService from '../services/auditLogs.service';
import { auditLogsView } from '../views/auditLog.view';
import { asyncHandler } from '../utils/asyncHandler';
import { parsePagination } from '../utils/pagination';

export const list = asyncHandler(async (req, res) => {
  const { skip, page, limit } = parsePagination(req.query as { page?: string; limit?: string });

  const user_id = req.query.user_id ? Number(req.query.user_id) : undefined;
  const entity_id = req.query.entity_id ? Number(req.query.entity_id) : undefined;
  const module = req.query.module as string | undefined;
  const action = req.query.action as string | undefined;
  const entity = req.query.entity as string | undefined;
  const date_from = req.query.date_from as string | undefined;
  const date_to = req.query.date_to as string | undefined;

  const { data, total } = await auditLogsService.list({
    page,
    limit,
    skip,
    ...(user_id !== undefined ? { user_id } : {}),
    ...(entity_id !== undefined ? { entity_id } : {}),
    ...(module !== undefined ? { module } : {}),
    ...(action !== undefined ? { action } : {}),
    ...(entity !== undefined ? { entity } : {}),
    ...(date_from !== undefined ? { date_from } : {}),
    ...(date_to !== undefined ? { date_to } : {}),
  });

  res.json({
    success: true,
    data: auditLogsView(data),
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
});
