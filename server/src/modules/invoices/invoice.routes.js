import { Router } from 'express';
import { z } from 'zod';
import { authenticate, requirePermission } from '../../middlewares/auth.js';
import { validate } from '../../middlewares/validate.js';
import { created, noContent, ok } from '../../utils/response.js';
import { idParams, objectId } from '../../utils/validators.js';
import { audit } from '../audit/audit.service.js';
import { Company } from '../companies/company.model.js';
import { listCustomerOptions } from '../customers/customer.service.js';
import { renderInvoicePdf } from './invoice.pdf.js';
import * as invoiceService from './invoice.service.js';
import {
  createInvoiceSchema,
  listInvoicesQuery,
  updateInvoiceSchema,
  updateInvoiceStatusSchema,
} from './invoice.validation.js';

const router = Router();
const canWrite = requirePermission('invoices', 'create', 'edit');

router.use(authenticate);

router.get('/', requirePermission('invoices', 'view'), validate({ query: listInvoicesQuery }), async (req, res) =>
  ok(res, await invoiceService.listInvoices(req.valid.query)),
);

router.get('/summary', requirePermission('invoices', 'view'), async (_req, res) =>
  ok(res, await invoiceService.getInvoiceSummary()),
);

router.get('/defaults', canWrite, validate({ query: z.object({ company: objectId('company') }) }), async (req, res) =>
  ok(res, await invoiceService.getInvoiceDefaults(req.valid.query.company)),
);

/** Customer picker for the invoice form, available to invoice creators. */
router.get('/lookups/customers', canWrite, async (_req, res) => ok(res, { items: await listCustomerOptions() }));

router.get('/:id', requirePermission('invoices', 'view'), validate({ params: idParams }), async (req, res) =>
  ok(res, { invoice: await invoiceService.getInvoice(req.valid.params.id) }),
);

router.get('/:id/pdf', requirePermission('invoices', 'download'), validate({ params: idParams }), async (req, res) => {
  const invoice = await invoiceService.getInvoice(req.valid.params.id);
  const company = await Company.findById(invoice.company?._id ?? invoice.company);
  const pdf = await renderInvoicePdf(invoice, company);

  await audit(req.user, 'invoice.downloaded', 'invoice', invoice._id, `Downloaded invoice ${invoice.invoiceNumber}`);
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Length', pdf.length);
  res.setHeader('Content-Disposition', `${req.query.download === 'true' ? 'attachment' : 'inline'}; filename="${invoice.invoiceNumber}.pdf"`);
  return res.send(pdf);
});

router.post('/', requirePermission('invoices', 'create'), validate({ body: createInvoiceSchema }), async (req, res) =>
  created(res, { invoice: await invoiceService.createInvoice(req.valid.body, req.user) }),
);

router.put('/:id', requirePermission('invoices', 'edit'), validate({ params: idParams, body: updateInvoiceSchema }), async (req, res) =>
  ok(res, { invoice: await invoiceService.updateInvoice(req.valid.params.id, req.valid.body, req.user) }),
);

router.patch(
  '/:id/status',
  requirePermission('invoices', 'edit'),
  validate({ params: idParams, body: updateInvoiceStatusSchema }),
  async (req, res) => ok(res, { invoice: await invoiceService.updateInvoiceStatus(req.valid.params.id, req.valid.body, req.user) }),
);

router.delete('/:id', requirePermission('invoices', 'delete'), validate({ params: idParams }), async (req, res) => {
  await invoiceService.deleteInvoice(req.valid.params.id, req.user);
  return noContent(res);
});

export default router;
