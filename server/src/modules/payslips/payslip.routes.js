import { Router } from 'express';
import { authenticate, requirePermission } from '../../middlewares/auth.js';
import { validate } from '../../middlewares/validate.js';
import { created, noContent, ok } from '../../utils/response.js';
import { idParams } from '../../utils/validators.js';
import { audit } from '../audit/audit.service.js';
import { Company } from '../companies/company.model.js';
import { renderPayslipPdf } from './payslip.pdf.js';
import * as payslipService from './payslip.service.js';
import { createPayslipSchema, defaultsQuery, listPayslipsQuery, updatePayslipSchema } from './payslip.validation.js';

const router = Router();

router.use(authenticate);

router.get('/', requirePermission('payslips', 'view'), validate({ query: listPayslipsQuery }), async (req, res) =>
  ok(res, await payslipService.listPayslips(req.valid.query)),
);

router.get(
  '/defaults',
  requirePermission('payslips', 'create', 'edit'),
  validate({ query: defaultsQuery }),
  async (req, res) => ok(res, await payslipService.getPayslipDefaults(req.valid.query)),
);

router.get('/:id', requirePermission('payslips', 'view'), validate({ params: idParams }), async (req, res) =>
  ok(res, { payslip: await payslipService.getPayslip(req.valid.params.id) }),
);

router.get('/:id/pdf', requirePermission('payslips', 'download'), validate({ params: idParams }), async (req, res) => {
  const payslip = await payslipService.getPayslip(req.valid.params.id);
  const company = await Company.findById(payslip.company?._id ?? payslip.company);
  const pdf = await renderPayslipPdf(payslip, company);

  await audit(req.user, 'payslip.downloaded', 'payslip', payslip._id, `Downloaded payslip ${payslip.payslipNumber}`);
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Length', pdf.length);
  res.setHeader('Content-Disposition', `${req.query.download === 'true' ? 'attachment' : 'inline'}; filename="${payslip.payslipNumber}.pdf"`);
  return res.send(pdf);
});

router.post('/', requirePermission('payslips', 'create'), validate({ body: createPayslipSchema }), async (req, res) =>
  created(res, { payslip: await payslipService.createPayslip(req.valid.body, req.user) }),
);

router.put('/:id', requirePermission('payslips', 'edit'), validate({ params: idParams, body: updatePayslipSchema }), async (req, res) =>
  ok(res, { payslip: await payslipService.updatePayslip(req.valid.params.id, req.valid.body, req.user) }),
);

router.delete('/:id', requirePermission('payslips', 'delete'), validate({ params: idParams }), async (req, res) => {
  await payslipService.deletePayslip(req.valid.params.id, req.user);
  return noContent(res);
});

export default router;
