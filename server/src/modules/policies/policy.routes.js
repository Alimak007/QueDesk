import { Router } from 'express';
import { ROLES } from '../../constants/index.js';
import { authenticate, authorize } from '../../middlewares/auth.js';
import { validate } from '../../middlewares/validate.js';
import { idParams } from '../../utils/validators.js';
import * as controller from './policy.controller.js';
import {
  acceptPoliciesSchema,
  createPolicySchema,
  listPoliciesQuery,
  policyStatusSchema,
  updatePolicySchema,
} from './policy.validation.js';

const router = Router();
const adminOnly = authorize(ROLES.ADMIN);

router.use(authenticate);

// Everyone reads the policies meant for them; what each person sees is decided in the service.
router.get('/', validate({ query: listPoliciesQuery }), controller.list);
router.get('/pending', controller.pending);
router.post('/accept', validate({ body: acceptPoliciesSchema }), controller.accept);
router.get('/:id', validate({ params: idParams }), controller.getOne);

router.get('/:id/acceptances', adminOnly, validate({ params: idParams }), controller.acceptances);
router.post('/', adminOnly, validate({ body: createPolicySchema }), controller.create);
router.put('/:id', adminOnly, validate({ params: idParams, body: updatePolicySchema }), controller.update);
router.patch('/:id/status', adminOnly, validate({ params: idParams, body: policyStatusSchema }), controller.setStatus);
router.delete('/:id', adminOnly, validate({ params: idParams }), controller.remove);

export default router;
