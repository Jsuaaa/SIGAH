import { Router } from 'express';
import * as controller from '../controllers/deliveries.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { authorize } from '../middlewares/role.middleware';
import { validate } from '../middlewares/validate.middleware';
import { idempotencyMiddleware } from '../middlewares/idempotency.middleware';
import {
  listDeliveryRules,
  eligibilityRules,
  createExceptionRules,
  createDeliveryRules,
  updateStatusRules,
  batchRules,
  idParamRule,
} from '../validators/deliveries.validator';

const router = Router();

router.use(authenticate);

router.get('/eligibility', validate(eligibilityRules), controller.eligibility);
router.get('/', validate(listDeliveryRules), controller.list);

// #24 CA4 — batch before /:id to avoid param collision.
router.post(
  '/batch',
  authorize('ADMIN', 'COORDINADOR_LOGISTICA'),
  validate(batchRules),
  controller.createBatch,
);

// HU-23 CA5: solo COORDINADOR_LOGISTICA puede crear entregas con excepción.
// El SP también exige exception_reason + exception_authorized_by.
router.post(
  '/exception',
  authorize('COORDINADOR_LOGISTICA'),
  validate(createExceptionRules),
  controller.createException,
);

// #24 CA1/CA2/CA3/CA5 — regular delivery (requires eligibility; SH409 when not eligible).
// idempotencyMiddleware: si Idempotency-Key ya fue procesada, retorna cache (#32/GH#48).
router.post(
  '/',
  authorize('ADMIN', 'COORDINADOR_LOGISTICA', 'OPERADOR_ENTREGAS'),
  idempotencyMiddleware,
  validate(createDeliveryRules),
  controller.create,
);

// #24 CA6 — status transition: PROGRAMADA → EN_CURSO → ENTREGADA.
router.put(
  '/:id/status',
  authorize('ADMIN', 'COORDINADOR_LOGISTICA', 'OPERADOR_ENTREGAS'),
  validate(updateStatusRules),
  controller.updateStatus,
);

router.get('/:id', validate(idParamRule), controller.getById);

export default router;
