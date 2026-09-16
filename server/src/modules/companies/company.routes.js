import { Router } from 'express';
import { ROLES } from '../../constants/index.js';
import { authenticate, authorize, requirePermission } from '../../middlewares/auth.js';
import { uploadImage } from '../../middlewares/upload.js';
import { validate } from '../../middlewares/validate.js';
import { ApiError } from '../../utils/ApiError.js';
import { can } from '../../utils/permissions.js';
import { created, noContent, ok } from '../../utils/response.js';
import { idParams } from '../../utils/validators.js';
import * as companyService from './company.service.js';
import { assetKindParams, createCompanySchema, listCompaniesQuery, updateCompanySchema } from './company.validation.js';

const router = Router();
const adminOnly = authorize(ROLES.ADMIN);

/**
 * Companies are configured by admins in Settings, but anyone who can raise an
 * invoice or payslip needs to read them to fill in the document header.
 */
function canReadCompanies(req, _res, next) {
  const user = req.user;
  const allowed =
    can(user, 'invoices', 'view', 'create', 'edit') || can(user, 'payslips', 'view', 'create', 'edit');
  return allowed ? next() : next(ApiError.forbidden());
}

router.use(authenticate);

router.get('/', canReadCompanies, validate({ query: listCompaniesQuery }), async (req, res) =>
  ok(res, { items: await companyService.listCompanies(req.valid.query) }),
);
router.get('/:id', canReadCompanies, validate({ params: idParams }), async (req, res) =>
  ok(res, { company: await companyService.getCompany(req.valid.params.id) }),
);

// Logo / signature images: readable by anyone who may read companies, so previews work.
router.get('/:id/:kind', canReadCompanies, validate({ params: assetKindParams }), async (req, res) => {
  const { id, kind } = req.valid.params;
  const image = await companyService.getCompanyAsset(id, kind);
  res.setHeader('Content-Type', image.mimeType);
  res.setHeader('Cache-Control', 'private, max-age=60');
  res.setHeader('Content-Disposition', `inline; filename="${kind}"`);
  return res.send(image.buffer);
});

router.post('/', adminOnly, validate({ body: createCompanySchema }), async (req, res) =>
  created(res, { company: await companyService.createCompany(req.valid.body, req.user) }),
);
router.patch('/:id', adminOnly, validate({ params: idParams, body: updateCompanySchema }), async (req, res) =>
  ok(res, { company: await companyService.updateCompany(req.valid.params.id, req.valid.body, req.user) }),
);
router.delete('/:id', adminOnly, validate({ params: idParams }), async (req, res) => {
  await companyService.deleteCompany(req.valid.params.id, req.user);
  return noContent(res);
});

router.post('/:id/:kind', adminOnly, validate({ params: assetKindParams }), uploadImage, async (req, res) => {
  const { id, kind } = req.valid.params;
  return ok(res, { company: await companyService.setCompanyAsset(id, kind, req.file, req.user) });
});
router.delete('/:id/:kind', adminOnly, validate({ params: assetKindParams }), async (req, res) => {
  const { id, kind } = req.valid.params;
  return ok(res, { company: await companyService.removeCompanyAsset(id, kind, req.user) });
});

export default router;
