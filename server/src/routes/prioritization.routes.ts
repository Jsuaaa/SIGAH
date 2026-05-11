import { Router } from 'express';
import * as controller from '../controllers/prioritization.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { authorize } from '../middlewares/role.middleware';
import { validate } from '../middlewares/validate.middleware';
import { rankingRules, nextBatchRules } from '../validators/prioritization.validator';

const router = Router();

router.use(authenticate);

router.get('/ranking', validate(rankingRules), controller.ranking);
router.get('/next-batch', validate(nextBatchRules), controller.nextBatch);

// HU-21: recálculo masivo restringido a ADMIN/COORDINADOR_LOGISTICA.
router.post('/recalculate', authorize('ADMIN', 'COORDINADOR_LOGISTICA'), controller.recalculate);

export default router;
