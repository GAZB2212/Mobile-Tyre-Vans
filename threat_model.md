# Threat Model

## Project Overview

This is a React/Vite frontend with an Express/TypeScript backend and PostgreSQL/Drizzle database for a mobile tyre van conversion business. Public visitors can browse vans, submit leads, build quotes, and receive customer email links. Staff and admins can log in to manage quotes, leads, stock, uploads, build sheets, and email-driven workflows.

Production assumptions for this scan:
- Only production-reachable code matters.
- `NODE_ENV=production` in production.
- Replit handles TLS for deployed traffic.
- Mockup sandbox and local experimental paths are not production surfaces unless separately exposed.

## Assets

- **Admin accounts and sessions** — full-admin access can change quotes, users, content, uploads, and customer workflows.
- **Customer quote data** — names, email addresses, phone numbers, company names, van registrations, pricing, finance details, notes, and build status.
- **Customer action links** — quote confirmation links, spec approval links, comparison choice links, and build-progress QR links. These act as capability URLs and must be treated like secrets when they change state.
- **Object storage** — public product images, upgrade images, van media, videos, avatars, and private uploaded assets.
- **Business workflow state** — chosen comparison option, build progress, quote status, admin notes, finance state, and email-triggered actions.
- **Application secrets and infrastructure access** — session secret, database access, email provider access, storage credentials, and any bootstrap admin credentials.

## Trust Boundaries

- **Browser to API** — all client input is untrusted, including public forms, customer link visits, authenticated user actions, and admin actions.
- **Public to authenticated** — registration is public, but many routes are meant only for logged-in users.
- **Authenticated user to admin** — regular users must never gain access to admin-only uploads, quote management, or staff workflows.
- **Customer link holder to internal workflow state** — emailed and QR-linked flows cross from external recipients into quote state changes.
- **API to PostgreSQL session/data store** — the server loads user identity and quote state directly from the database and session store.
- **API to object storage** — upload endpoints mint public URLs and write files into shared storage.
- **API to email provider** — outbound email contains customer data and action links, so link design and token handling matter.

## Scan Anchors

- **Production entry points:** `server/index.ts`, `server/routes.ts`, `server/auth.ts`, `client/src/App.tsx`
- **Highest-risk areas:** auth/session handling in `server/auth.ts`; public/admin route boundaries in `server/routes.ts`; upload/storage code in `server/objectStorage.ts`; customer email action links in `server/email.ts`
- **Public surfaces:** quote creation, lead capture, quote confirmation, spec approval, comparison choice links, build-progress links, public media serving
- **Authenticated surfaces:** user avatar upload, customer-owned quote/logo actions, any route using `isAuthenticated`
- **Admin surfaces:** `/api/admin/*`, quote editing, inventory/media management, user management, email sending
- **Usually dev-only / lower priority:** `scripts/`, vitest config/tests, `.local/tasks`, Vite-only tooling, one-off migration helpers unless they are invoked in production startup

## Threat Categories

### Spoofing

The app uses Express sessions, but some routes also accept a raw session ID in `Authorization: Bearer ...`. This project must treat session identifiers as secrets equivalent to logged-in identity. Admin and customer-link actions must require credentials that are hard to steal, are not exposed to JavaScript unnecessarily, and are not guessable or reusable beyond their intended scope.

### Tampering

Quote state, build progress, chosen comparison option, pricing-related workflow state, and uploaded media are all sensitive business records. The server must enforce who can change each of these fields. Public or customer-facing links must only change the specific thing they were designed to change, and only with an explicit, safe action.

### Information Disclosure

Customer quotes contain personal and business data. Public and customer-link endpoints must return only the minimum fields needed, and internal identifiers should not become reusable authorizers for other actions. Session IDs, reset links, approval links, and storage URLs must not be exposed in ways that let unrelated parties reuse them.

### Denial of Service

The app accepts uploads and supports media-heavy workflows. Upload endpoints must enforce role checks, file type checks, and hard size limits before buffering content in memory. Public or low-privilege users must not be able to consume unbounded RAM, storage, or bandwidth.

### Elevation of Privilege

This codebase has clear regular-user, basic-admin, and full-admin roles. The server must enforce those boundaries on every route. Public registration must never become a stepping stone into admin-only storage, quote management, or internal workflow updates. Production bootstrapping must fail safely rather than creating powerful accounts with predictable credentials.
