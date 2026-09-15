# My Portal

A role-based employee management portal: **Leave**, **Daily Status**, **Company Calendar**, **Employees** and **Sales** (List + Kanban with an admin-configurable form) in one place.

Built with the MERN stack: **MongoDB + Mongoose · Express 5 · React 19 · Node.js**.

---

## Quick start

**Requirements:** Node.js 20.19 or newer, and a MongoDB connection string.

```bash
npm install                 # installs server + client (npm workspaces)
cp server/.env.example server/.env   # then fill in MONGODB_URI and JWT_SECRET
npm run seed                # creates the first admin and the default Sales form
npm run seed:demo           # optional: demo employees, leave, reports, events and leads
npm run dev                 # API on :5000, web app on :5173
```

Open http://localhost:5173 and sign in with the admin account set by `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` / `SEED_ADMIN_NAME` in `server/.env`. The login screen has no role picker: each user's role is read from their account on the server. The admin adds everyone else from **Employee Management**.

> `npm run seed` is safe to re-run. If the seed admin already exists, it is left as is, or promoted back to an active admin if needed. Change the admin password after the first sign-in (**Profile → Change password**).

### Scripts (run from the repository root)

| Command | What it does |
|---|---|
| `npm run dev` | API (with `--watch`) and Vite dev server together |
| `npm run build` | Production build of the React app into `client/dist` |
| `npm start` | Starts the API; with `NODE_ENV=production` it also serves `client/dist` |
| `npm run seed` / `npm run seed:demo` | Idempotent seeding; never overwrites existing data |
| `npm test` | API integration tests (uses a throwaway `<db>_test` database, dropped afterwards) |
| `npm run lint` | ESLint for the client |

---

## Project structure

```
quedesk/
├── package.json              # npm workspaces + root scripts
├── server/
│   ├── .env.example
│   ├── src/
│   │   ├── server.js         # bootstrap: DB connect, default data, graceful shutdown
│   │   ├── app.js            # Express app: security middleware, routes, error handling
│   │   ├── config/           # env validation (zod), MongoDB connection
│   │   ├── constants/        # roles, statuses, enums
│   │   ├── middlewares/      # authenticate/authorize, validate, rate limiting, errors
│   │   ├── modules/          # one folder per feature
│   │   │   ├── auth/         #   *.routes → *.controller → *.service → *.model
│   │   │   ├── users/        #   (+ *.validation with zod schemas)
│   │   │   ├── leaves/
│   │   │   ├── daily-status/
│   │   │   ├── events/
│   │   │   ├── sales/        #   fields, settings, leads, dynamic validation
│   │   │   ├── dashboard/
│   │   │   └── notifications/
│   │   ├── routes/           # mounts module routers under /api
│   │   ├── scripts/seed.js
│   │   └── utils/            # ApiError, dates, pagination, ownership scope, logger
│   └── tests/api.test.js     # privacy, RBAC and dynamic-form tests
└── client/
    ├── vite.config.js        # @ alias, /api proxy, Tailwind v4
    └── src/
        ├── main.jsx
        ├── app/              # router (lazy routes + guards), providers
        ├── components/
        │   ├── ui/           # design system: Button, Form, Modal/Sheet, Table, Tabs, …
        │   └── layout/       # AppLayout, Sidebar, Topbar, navigation config
        ├── features/         # one folder per feature: api.js (TanStack Query hooks) + pages + components
        ├── hooks/            # URL-synced filter state, debounce, etc.
        ├── lib/              # axios client, formatting, date helpers, constants
        ├── pages/            # 404, route error boundary
        └── styles/index.css  # Tailwind theme tokens
```

---

## Security model

Every rule from spec §13 is enforced **on the API**. The UI hides actions for convenience only.

- **Private data (Leave, Daily Status).** Every query on those collections starts from `ownershipScope(actor)` (`server/src/utils/scope.js`). For employees it pins `employee = me`, including reads, updates and cancels. A request for someone else's record returns **404**, so employees can't even probe whether a record exists. An employee who passes `?employee=<other id>` gets that filter ignored.
- **Shared data (Calendar, Sales).** Everyone can read. Calendar writes and Sales configuration are admin-only through `authorize('admin')`.
- **Sessions.** A JWT in an `httpOnly` cookie (`SameSite=Lax` in dev, `Strict` + `Secure` in production). The user is re-loaded on every request and the token carries a `tokenVersion`. Deactivating a user, resetting their password or changing their role signs them out everywhere immediately.
- **Input.** Every body, query string and URL parameter is parsed by a zod schema that only accepts plain values, which blocks `{ "$ne": null }`-style injection. Sales values are checked against the admin's field configuration.
- **Hardening.** `helmet`; a CORS allow-list; rate limits on the API and on failed sign-ins; constant-time login responses (no account enumeration); bcrypt with 12 rounds; password hashes are never serialised.

The test suite (`npm test`) covers all of the above end to end.

---

## Decisions on the open items (spec §20)

These are sensible defaults. Each one is isolated and easy to change.

| # | Item | Decision |
|---|---|---|
| 1 | Leave types | Casual, Sick, Earned, Unpaid, Other (`constants/index.js`). |
| 2 | Leave approval | Any active admin can approve. All admins are notified of new requests. |
| 3 | Leave editing | Employees can edit **pending** requests, and cancel pending ones or approved ones that haven't started. Admins can edit any non-cancelled request and can reverse a decision. |
| 4 | Daily status format | Structured: *Work done* (required), *Plan for next day*, *Blockers*, *Hours*. One report per employee per day; no future dates. |
| 5 | Calendar event types | Holiday, Event, Meeting, Other; all-day or timed; multi-day supported. Holidays are excluded from leave day counts. |
| 6 | Sales ownership | Every lead has an **Owner** (defaults to its creator, can be reassigned). |
| 7 | Kanban grouping | Grouped by *Lead Status* by default. Admins can group by any dropdown field and pick the field used for pipeline value. |
| 8 | Sales editing | All authenticated users can edit all leads, as the spec interprets it. Deleting a lead is admin-only. |
| 9 | Employee deletion | **Deactivate** keeps history and blocks sign-in. Permanent delete is only allowed for employees with no leave, reports or leads. |
| 10 | Notifications | In-app notifications (bell) for leave submitted, approved, rejected or cancelled. Kept for 90 days. |
| 11 | Attachments | Not in v1. |
| 12 | Dashboard KPIs | **Admin:** active employees, pending leave, today's report completion, pipeline value, requests awaiting review, who's on leave today, latest reports, upcoming events, pipeline by stage, recent leads. **Employee:** quick actions, leave taken, pending requests, reports this month, today's status, recent leave and reports, upcoming events, pipeline. |

### Configurable Sales form

- Field types: text, long text, number, currency, email, phone, URL, date, dropdown (with coloured options), checkbox.
- Per field: label, required, default value, placeholder, help text, show on form, show in List View, order.
- A field's **key and type are fixed after creation**, so stored values never become inconsistent. To change a type, archive the field and add a new one.
- **Archive** hides a field and keeps its data. **Delete** is only allowed while no lead holds a value for it.
- *Lead Name* and *Lead Status* are system fields: they can be relabelled and their options edited, but they can't be hidden or removed.

---

## Deployment notes

1. `npm ci && npm run build`
2. On the server: `NODE_ENV=production`, a strong `JWT_SECRET` and `CLIENT_ORIGIN` set to your public URL.
3. `npm start`. Express serves the API under `/api` and the built React app for every other route.
4. Serve over **HTTPS**. Production cookies are `Secure`, and the app trusts one reverse proxy (`trust proxy = 1`).
5. In MongoDB Atlas, allow-list the server's IP.

**Troubleshooting:** `querySrv ECONNREFUSED` on Windows means Node's DNS resolver is refusing SRV lookups. The API retries automatically through public DNS; you can also set `DNS_SERVERS=1.1.1.1,8.8.8.8` in `server/.env`.
