import { ApiError } from '../../utils/ApiError.js';
import { audit } from '../audit/audit.service.js';
import { getImageBuffer, removeImage, storeImage } from '../documents/imageStore.js';
import { Company } from './company.model.js';

export async function listCompanies({ includeInactive = false } = {}) {
  const filter = includeInactive ? {} : { isActive: true };
  return Company.find(filter).sort({ isDefault: -1, name: 1 });
}

export async function getCompany(id) {
  const company = await Company.findById(id);
  if (!company) throw ApiError.notFound('Company not found');
  return company;
}

/** The company used to pre-select forms: the flagged default, else the first one. */
export async function getDefaultCompany() {
  return (await Company.findOne({ isDefault: true, isActive: true })) ?? (await Company.findOne({ isActive: true }).sort({ name: 1 }));
}

async function clearOtherDefaults(companyId) {
  await Company.updateMany({ _id: { $ne: companyId }, isDefault: true }, { $set: { isDefault: false } });
}

export async function createCompany(data, actor) {
  const isFirst = (await Company.estimatedDocumentCount()) === 0;
  const company = await Company.create({ ...data, isDefault: data.isDefault || isFirst, createdBy: actor._id });
  if (company.isDefault) await clearOtherDefaults(company._id);
  await audit(actor, 'company.created', 'company', company._id, `Created company “${company.name}”`);
  return company;
}

export async function updateCompany(id, data, actor) {
  const company = await getCompany(id);
  Object.assign(company, data, { updatedBy: actor._id });
  await company.save();
  if (company.isDefault) await clearOtherDefaults(company._id);
  await audit(actor, 'company.updated', 'company', company._id, `Updated company “${company.name}”`);
  return company;
}

export async function deleteCompany(id, actor) {
  const company = await getCompany(id);

  const [{ Invoice }, { Payslip }] = await Promise.all([
    import('../invoices/invoice.model.js'),
    import('../payslips/payslip.model.js'),
  ]);
  const [invoices, payslips] = await Promise.all([
    Invoice.countDocuments({ company: company._id }),
    Payslip.countDocuments({ company: company._id }),
  ]);
  if (invoices + payslips > 0) {
    throw ApiError.conflict(
      'This company is used by existing invoices or payslips. Deactivate it instead so those documents stay intact.',
      { code: 'COMPANY_IN_USE' },
    );
  }

  await Promise.all([removeImage(company.logo), removeImage(company.signature)]);
  await company.deleteOne();
  await audit(actor, 'company.deleted', 'company', company._id, `Deleted company “${company.name}”`);
}

/** Replaces the company logo or signature, removing the previous image. */
export async function setCompanyAsset(id, kind, file, actor) {
  const company = await getCompany(id);

  company[kind] = await storeImage({
    file,
    kind,
    companyId: company._id.toString(),
    uploadedBy: actor._id,
    previous: company[kind],
  });
  company.updatedBy = actor._id;
  await company.save();

  await audit(actor, `company.${kind}Updated`, 'company', company._id, `Updated ${kind} for “${company.name}”`);
  return company;
}

export async function removeCompanyAsset(id, kind, actor) {
  const company = await getCompany(id);
  await removeImage(company[kind]);
  company[kind] = null;
  company.updatedBy = actor._id;
  await company.save();
  await audit(actor, `company.${kind}Removed`, 'company', company._id, `Removed ${kind} from “${company.name}”`);
  return company;
}

/** The raw image bytes, for the download endpoint. Returns `{ buffer, mimeType }`. */
export async function getCompanyAsset(id, kind) {
  const company = await getCompany(id);
  const image = company[kind] ? await getImageBuffer(company[kind]) : null;
  if (!image) throw ApiError.notFound(`This company has no ${kind}`);
  return image;
}

/** Company details frozen onto a document so it stays historically accurate. */
export function companySnapshot(company) {
  return {
    name: company.name,
    address: company.address,
    phone: company.phone,
    email: company.email,
    website: company.website,
    taxLabel: company.taxLabel,
    taxNumber: company.taxNumber,
    registrationNumber: company.registrationNumber,
    bank: {
      bankName: company.bank?.bankName ?? '',
      accountName: company.bank?.accountName ?? '',
      accountNumber: company.bank?.accountNumber ?? '',
      iban: company.bank?.iban ?? '',
      swift: company.bank?.swift ?? '',
      branchAddress: company.bank?.branchAddress ?? '',
    },
  };
}

/** Atomically reserves the next invoice number for a company. */
export async function nextInvoiceNumber(companyId, date = new Date()) {
  const company = await Company.findOneAndUpdate(
    { _id: companyId },
    { $inc: { 'invoice.nextNumber': 1 } },
    { returnDocument: 'before' },
  );
  if (!company) throw ApiError.notFound('Company not found');

  const { prefix = 'INV-', includeYearMonth = true, sequencePadding = 6, nextNumber = 1 } = company.invoice ?? {};
  const yearMonth = includeYearMonth ? `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}` : '';
  return `${prefix}${yearMonth}${String(nextNumber).padStart(sequencePadding, '0')}`;
}
