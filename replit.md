# Mobile Tyre Vans — Platform Documentation

## Overview

A full-stack, production web platform for **Mobile Tyre Vans**, a UK business specialising in custom mobile tyre van conversions. The platform serves two audiences:

- **Customers** — browse van stock, use an interactive multi-step configurator or AI chat assistant to design a bespoke conversion, and submit quote requests.
- **Staff & Partners** — manage the entire business workflow from initial enquiry through specification, pricing, finance, build, and completion via a comprehensive admin panel.

Primary business goals: lead generation, quote conversion, and operational efficiency across the full sales-to-build pipeline.

---

## User Preferences

Preferred communication style: Simple, everyday language.

---

## System Architecture

### Frontend
- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite
- **Routing**: Wouter
- **Styling**: TailwindCSS with shadcn/ui component library
- **State Management**: TanStack Query (server state) + React Context (configurator state)
- **Forms**: React Hook Form with Zod validation
- **UI/UX**: Mobile-first responsive design with industrial/automotive styling, optimised images, interactive multi-step configurator with real-time pricing
- **Interactive Tutorial**: `react-joyride` for onboarding users through the configurator (progress persisted in localStorage)

### Backend
- **Runtime**: Node.js with Express in TypeScript
- **API Design**: RESTful
- **ORM**: Drizzle ORM
- **Database**: PostgreSQL (Replit built-in, via `pg` / `drizzle-orm/node-postgres`)
- **Session Management**: Express sessions — memory store in development, PostgreSQL (`connect-pg-simple`) in production

---

## Documentation Index

Detailed documentation lives in `docs/`:

| Doc | Covers |
|---|---|
| [`docs/public-pages.md`](docs/public-pages.md) | Customer-facing routes, programmatic SEO pages, token-gated approval pages |
| [`docs/configurator.md`](docs/configurator.md) | Seven-step build wizard, state architecture, exclusivity rules, quote submission |
| [`docs/max-ai.md`](docs/max-ai.md) | Max AI conversational configurator, 9-question flow, admin conversion tracking |
| [`docs/admin-panel.md`](docs/admin-panel.md) | Roles, every admin page including build sheet & kiosk pipeline |
| [`docs/integrations.md`](docs/integrations.md) | Sage, AutoTradeOS, CheckCarDetails, OpenAI, Resend/SendGrid, Jigsaw Finance, GCS, WrapGen |
| [`docs/seo.md`](docs/seo.md) | SSR, JSON-LD, sitemap, robots, www redirect, image optimisation |
| [`docs/technical-notes.md`](docs/technical-notes.md) | Startup migrations, post-merge, React 18 state notes, headline machines helper, key files reference |

See also: `threat_model.md` for security-relevant architecture, trust boundaries, and required guarantees.
