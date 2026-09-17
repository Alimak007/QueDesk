import { Router } from 'express';
import { z } from 'zod';
import { ROLES } from '../../constants/index.js';
import { authenticate, authorize } from '../../middlewares/auth.js';
import { validate } from '../../middlewares/validate.js';
import { paginationQuery } from '../../utils/pagination.js';
import { ok } from '../../utils/response.js';
import { objectId } from '../../utils/validators.js';
import { listAuditLogs } from './audit.service.js';

const router = Router();

const listQuery = z.object({
  ...paginationQuery,
  entityType: z.enum(['customer', 'payslip', 'invoice', 'permission', 'company']).optional(),
  entityId: objectId('entity').optional(),
  actor: objectId('actor').optional(),
});

router.get('/', authenticate, authorize(ROLES.ADMIN), validate({ query: listQuery }), async (req, res) =>
  ok(res, await listAuditLogs(req.valid.query)),
);

export default router;
