# QueDesk

A role-based business management portal: **Leads · Customers · Employees · Leave · Daily Status · Payslips · Invoices · Calendar**, with per-employee module permissions and branded PDF documents.

Built with the MERN stack: **MongoDB + Mongoose · Express 5 · React 19 · Node.js**.

---

## Quick start

**Requirements:** Node.js 20.19 or newer, and a MongoDB connection string.

```bash
npm install                 # installs server + client (npm workspaces)
cp server/.env.example server/.env   # then fill in MONGODB_URI and JWT_SECRET
npm run seed                # first admin + the default Lead/Customer forms (no business data)
npm run seed:companies      # optional: the two company profiles from the supplied templates
npm run dev                 # API on :5000, web app on :5173
```

Add your company under **Settings → Companies** (needed before invoices and payslips), then add employees under **Employees**.

Open http://localhost:5173 and sign in with the admin account set by `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` / `SEED_ADMIN_NAME` in `server/.env`. The login screen has no role picker: each user's role and permissions are read from their account on the server. The admin adds everyone else from **Employees**.

> `npm run seed` is safe to re-run. If the seed admin already exists it is left as is, or promoted back to an active admin if needed. Change the admin password after the first sign-in (**Profile → Change password**).

### Scripts (run from the repository root)

| Command | What it does |
|---|---|
| `npm run dev` | API (with `--watch`) and Vite dev server together |
| `npm run build` | Production build of the React app into `client/dist` |
| `npm start` | Starts the API; with `NODE_ENV=production` it also serves `client/dist` |
| `npm run seed` | First admin + default forms only. **Never creates business data.** Idempotent |
| `npm run seed:companies` | Optional: adds the company profiles taken from the supplied templates |
| `npm run seed:demo` | Demo employees, leave, reports, events and leads — for a throwaway database only |
| `npm test` | API integration tests (48) on a throwaway in-memory MongoDB — no network or credentials needed |
| `npm run lint` | ESLint for the client |

---

## Navigation

```
QueDesk
├── Dashboard
├── CRM            Leads · Customers
├── HR             Employees · Leave · Daily Status · Payslips
├── Finance        Invoices
├── Calendar
└── Administration Permissions · Settings
```

**Companies** deliberately has no sidebar entry. The module is alive and well: it is managed in **Settings → Companies** and supplies the header, tax details, bank information, logo and signature used by invoices and payslips.

The sidebar is permission-aware: employees only see the modules they can open, and a group disappears when it has nothing in it.

---

## Modules

### Payslips (HR)
Generate, view, edit, delete and download employee payslips as PDFs that follow the supplied template. Employee details come from their record, salary components are prefilled from the previous payslip (or the company's configured components), and every total is recalculated on the server. One payslip per employee per pay period.

### Invoices (Finance)
Tax invoices with multiple line items, per-line discount and tax, an automatic tax summary, amount in words and a company-specific number sequence (`INV-202605000017`). Selecting a company fills in its address, TRN, bank details, logo and signature; picking a customer fills in Bill To. Invoices store a snapshot of the seller details so old documents never change. Status flow: draft → sent → paid, with overdue highlighted automatically.

### Customers (CRM)
Built on the same configurable-field engine as Leads, with its own form you can shape in Settings. Customers can be added directly or created by converting a lead.

**Lead → Customer conversion** is an explicit action: open a lead and press *Convert to customer*. Then:

- the customer is created with the lead's details copied across,
- the lead leaves the Kanban board — it is no longer in the pipeline,
- the lead stays in the **List** view marked *Converted to Customer*, linked to its customer, and becomes read-only,
- converting again never creates a second customer — it just returns the existing one (enforced by a unique index, so even simultaneous requests are safe),
- converting requires permission to create customers.

Deleting the customer unlinks the lead, which puts it back on the board as an active lead — the way to undo a conversion made by mistake.

### Permissions (Administration)
Per-employee, per-module permissions with actions such as view, create, edit, delete, download, approve and review. Admins always keep full access.

### Settings (Administration)
Company profiles (branding, bank details, invoice and payslip defaults), the Lead form, the Customer form and an activity log of document and permission changes.

---

## Security model

Every rule is enforced **on the API**; the UI only decides what to show.

- **Module permissions.** `requirePermission(module, ...actions)` guards every route. The React side mirrors the catalogue to hide controls and block routes, but a hand-typed URL or a direct API call is rejected with 403.
- **Private data (Leave, Daily Status).** Employees only ever see their own records. The extra `approve` (Leave) and `review` (Daily Status) permissions unlock the organisation-wide views, so the original privacy rule holds by default. Nobody can approve their own leave.
- **Delegated employee management.** An employee granted employee permissions still cannot create, edit, deactivate, reset or delete an **admin** account, and cannot grant the admin role.
- **Sessions.** JWT in an `httpOnly` cookie. The user is re-loaded on every request and the token carries a `tokenVersion`, so deactivation, password resets and role changes take effect immediately.
- **Uploads.** Logos and signatures are identified by their actual magic bytes, not by the name or the content type the browser claims — a text file renamed `.png` is rejected, and a WebP named `.png` is accepted as a WebP. Limit: 5 MB. Images are served only to authorised users, through the API; the storage URL is never exposed.
- **Input.** Every body, query and URL parameter is parsed by a zod schema that only accepts primitives, which blocks `{ "$ne": null }`-style injection.
- **Money.** Payslip and invoice totals, tax and balances are always recalculated server-side; the browser's numbers are never trusted.

`npm test` covers all of the above end to end.

### Logo and signature storage

Set `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY` and `CLOUDINARY_API_SECRET` in `server/.env` to keep company branding on Cloudinary (under `quedesk/companies/<company id>/`). Leave them blank and the images are stored in MongoDB instead — everything else behaves identically, and the test suite always uses the database so it never touches the network.

Either way the browser only ever loads `/api/companies/:id/:kind`, so access stays behind the same permission checks as the rest of the app.

---

## Project structure

```
quedesk/
├── server/src/
│   ├── config/            env validation, MongoDB, startup migrations
│   ├── constants/         roles, enums, permission catalogue
│   ├── middlewares/       authenticate, requirePermission, validate, uploads, errors
│   ├── modules/           one folder per feature: routes → controller → service → model
│   │   ├── auth/ users/ leaves/ daily-status/ events/
│   │   ├── sales/         leads + the configurable field engine (shared with customers)
│   │   ├── customers/     customers + lead conversion
│   │   ├── companies/     company profiles + logo/signature assets
│   │   ├── payslips/      payslip service + PDF
│   │   ├── invoices/      invoice service + PDF
│   │   ├── documents/     shared PDF toolkit, money & amount-in-words
│   │   ├── permissions/ audit/ dashboard/ notifications/
│   │   └── models.js      registers every model once
│   └── scripts/seed.js
└── client/src/
    ├── app/               router (lazy routes + permission guards), providers
    ├── components/        ui/ design system · layout/ shell + navigation
    ├── features/
    │   ├── records/       shared dynamic form, list and detail sheet (leads + customers)
    │   ├── documents/     PDF preview
    │   └── … one folder per feature (api.js + pages + components)
    ├── hooks/ lib/ pages/ styles/
```

---

## Decisions

| Item | Decision |
|---|---|
| Leave types | Casual, Sick, Earned, Unpaid, Other. Weekends and calendar holidays are not counted. |
| Leave editing | Employees edit only pending requests; they can cancel pending ones, or approved ones that haven't started. |
| Daily status | Structured: work done, next steps, blockers, hours. One report per person per day. |
| Lead → Customer | Converting is an explicit button on the lead, is idempotent, and requires the customer-create permission. A converted lead leaves the board, stays in the list as *Converted*, and is read-only. |
| Employee deletion | Deactivate by default; permanent delete only for people with no history (leave, reports, leads, customers, payslips or invoices). |
| Invoice numbering | `prefix + YYYYMM + padded sequence` per company; the next number and format are configurable, and a number can be typed manually. |
| Document details | Invoices snapshot the seller details at save time so historical documents stay accurate; logos and signatures are always read live. |
| Image storage | Cloudinary when `CLOUDINARY_*` is configured, otherwise MongoDB. Formats pdfkit cannot embed (WebP, AVIF, HEIC…) are converted to PNG on the way into a document. |
| Default permissions | New employees get self-service Leave and Daily Status, Lead view/create/edit and Calendar view. Everything else is off until granted. |
| Not included | Attachments on leave/status, emailed documents, recurring invoices. |

---

## Deployment notes

1. `npm ci && npm run build`
2. On the server: `NODE_ENV=production`, a strong `JWT_SECRET` and `CLIENT_ORIGIN` set to your public URL.
3. `npm start`. Express serves the API under `/api` and the built React app for every other route.
4. Serve over **HTTPS**. Production cookies are `Secure`, and the app trusts one reverse proxy.
5. In MongoDB Atlas, allow-list the server's IP (**Network Access → Add IP Address**). A TLS handshake failure such as `tlsv1 alert internal error` almost always means the current IP is not on that list.

**Troubleshooting:** `querySrv ECONNREFUSED` on Windows means Node's DNS resolver is refusing SRV lookups. The API retries automatically through public DNS; you can also set `DNS_SERVERS=1.1.1.1,8.8.8.8` in `server/.env`.
