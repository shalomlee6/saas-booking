# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Boki is one Angular application that serves three distinct audiences with (at least) two
distinct design languages:

1. **Business owners / staff** (boki admin, `/dashboard`, `/appointments`, `/customers`,
   `/services`, `/settings`, etc.) — independent beauty/personal-care professionals (nail
   salons confirmed in test data: manicure, pedicure, gel nails) running their own
   business day-to-day. Targets **both solo practitioners and small teams with multiple
   staff** — not solo-only, even though the codebase has no staff-picker UI yet
   (appointments/services are currently business-wide, not staff-scoped; multi-staff
   support is a near-term product direction, not a later ambition). They use the admin
   **heavily on mobile, between clients** — it is a fast working tool, not a considered
   dashboard session.
2. **The tenant's own customers** (chen-nails-style public site, `/b/:slug/...`) — the
   end clients of an individual salon, booking an appointment. They are not Boki's
   customers directly; they experience the *tenant's* brand, not Boki's. Login is
   optional (guest checkout is supported) and passwordless (phone OTP) when used.
3. **Internal Boki staff** (super-admin console, `/super-admin/...`) — Boki's own team
   managing every tenant business and user platform-wide (business list, per-tenant UI
   editing, user management, analytics, alerts, audit log, platform settings). A
   different persona from (1): this is an internal operations tool, not a customer-facing
   product. Priorities here are **data density, efficiency, and clarity** over the
   working-tool polish of the owner admin — it can share the owner admin's design system
   (components, tokens) rather than needing its own visual language.

## Product Purpose

Boki is a multi-tenant booking SaaS for independent beauty/personal-care businesses in
Israel. Each business gets: an admin console to manage appointments, customers, and
services; a customizable, themeable public booking site their own customers use to book
appointments (own custom domain supported, e.g. `chen-nails.co.il`); and a
"Smart Client Card" layer that goes beyond raw scheduling (customer preferences,
per-customer service overrides, auto-derived visit insights).

## Positioning

Hebrew-first, Israeli-market-native — not a Western booking product (Fresha, Booksy,
SimplyBook.me, etc.) with a translation layer bolted on. Hebrew is the default language
and RTL is the default document direction end-to-end (shell, nav, tables, forms, dialogs
— not page-by-page); English is a full secondary language, not an afterthought. Israeli
phone number formats and local SMS/OTP norms are native assumptions, not edge cases.

## Operating Context

- **boki admin** is a **work tool**: staff open it in short bursts, often on a phone,
  between appointments with actual clients. Speed and clarity beat visual flourish here.
- **The tenant site** is a **brand moment for the salon, not for Boki**: its sole
  functional goal is getting a visitor to book, but it must read as a premium,
  professional salon presence — themed per business, not a generic booking widget.
- **Super-admin** is an internal ops console used by Boki's own staff, not by tenants or
  their customers — optimize for scanning many businesses/users/records quickly over any
  per-tenant branding concern.
- Business owner, tenant-customer, and internal Boki staff are three separate identity
  systems with separate auth (staff email/password + role check for super-admin vs.
  customer phone OTP) and separate sessions.
- Timezone and currency are business-local (confirmed default: `Asia/Jerusalem`, ILS ₪).

## Capabilities and Constraints

Confirmed built and working (as of this session):
- Multi-tenant data isolation, per-business custom domain routing to a canonical
  `/b/:slug` path.
- Admin: appointment calendar (day/week + mobile 3-day agenda), customer list with
  bulk-delete (blocked server-side when a customer has appointment history), customer
  "Client Card" (notes, preferred time, allergies, tags, per-service duration/price
  overrides, auto-derived stats and insights), services catalog, working hours + one-off
  exceptions, business theme + landing-page content settings.
- Tenant site: browsable landing page (hero/services/gallery/products/reviews/contact),
  a 3-step booking flow (service → date/time → confirm), guest checkout *or* phone-OTP
  login, an upcoming-appointments view, appointment cancellation.
- Bilingual UI (Hebrew default, English toggle) with the whole document direction
  (`<html dir>`) switching at the shell level, not per page.
- Customer OTP/SMS auth exists in code but is **not production-ready**: Twilio
  credentials are not configured for production, and a dev-only OTP bypass code is
  currently enabled.

Explicitly not yet built (roadmap, confirmed from prior product discussion, not to be
treated as present): a cross-business customer "Handoff Network," a "Boki Community"
forum/posts feature, a native mobile app (Capacitor), a Reels/video landing feature.
Multi-staff support (if pursued) is not yet started.

## Brand Commitments

- Product/platform name: **boki** (shown as the wordmark in the admin shell).
- Each tenant business has and expresses **its own** brand identity on its public site
  (business name, theme color, logo) — the tenant site is not meant to look like "Boki
  the platform," it's meant to look like that salon.
- Admin's current primary color is a pink/rose tone (`#F35271`, referred to by the
  product owner as "Rose Gold") — explicitly **open to being replaced**; do not treat it
  as a fixed brand constraint for upcoming design work.
- Preferred typeface for upcoming design work: **Heebo**. Not currently loaded in the
  app (current stack is system fonts / Inter) — this is a forward commitment for the
  design phase, not a description of the present state.

## Evidence on Hand

- No live production deployment yet; **pre-launch / internal testing stage**. Test
  tenants in the local database (e.g. "chen's business," "demo's business") are
  placeholder/seed data, not real customers — do not treat their names, appointment
  counts, or reviews as real evidence, and do not fabricate testimonials, press, or
  benchmarks.
- No README or other product documentation exists in the repo; this file and
  `design-audit/pages.md` (route inventory) are the current source of truth.
- `design-audit/complaints.md` was referenced as UX-complaint context for upcoming
  design work but does not exist yet in the repo — needs to be provided before it can be
  used.

## Product Principles

1. Hebrew and RTL are first-class, not a localization pass — every new surface must work
   correctly in both directions from the start, not "mostly right in Hebrew."
2. The admin is a fast work tool used one-handed on mobile between clients: prioritize
   speed and unambiguous state over dashboard-style visual density.
3. The tenant site sells the *salon's* brand, not Boki's — design decisions there should
   default to "does this feel like a premium, trustworthy local business," themeable per
   tenant, not "does this look like Boki."
4. Don't invent evidence: this is a pre-launch product with seed/test data only: real
   testimonials, business counts, or usage claims do not exist yet.
