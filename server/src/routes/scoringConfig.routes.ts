import { Router } from 'express';
import * as controller from '../controllers/scoringConfig.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { authorize } from '../middlewares/role.middleware';
import { validate } from '../middlewares/validate.middleware';
import { setScoringConfigRules } from '../validators/scoringConfig.validator';

const router = Router();

router.use(authenticate);

router.get('/', controller.list);
router.put(
  '/',
  authorize('ADMIN', 'COORDINADOR_LOGISTICA'),
  validate(setScoringConfigRules),
  controller.set,
);

export default router;
