import { Router } from 'express';
import { authenticate, requirePermission } from '../../middlewares/auth.js';
import { validate } from '../../middlewares/validate.js';
import { idParams } from '../../utils/validators.js';
import * as controller from './customer.controller.js';
import { createCustomerSchema, listCustomersQuery, updateCustomerSchema } from './customer.validation.js';

const router = Router();

router.use(authenticate);

router.get('/', requirePermission('customers', 'view'), validate({ query: listCustomersQuery }), controller.list);
router.post('/', requirePermission('customers', 'create'), validate({ body: createCustomerSchema }), controller.create);
router.get('/:id', requirePermission('customers', 'view'), validate({ params: idParams }), controller.getOne);
router.patch(
  '/:id',
  requirePermission('customers', 'edit'),
  validate({ params: idParams, body: updateCustomerSchema }),
  controller.update,
);
router.delete('/:id', requirePermission('customers', 'delete'), validate({ params: idParams }), controller.remove);

export default router;
