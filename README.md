# Studio2U

Mobile recording session booking app. "We bring the studio to you."

## Project Overview
- **Name**: Studio2U
- **Goal**: Let clients book a mobile recording engineer (Mason Brown) directly — no studio search, no back-and-forth. Book, pay a Cash App deposit, get confirmed, get recorded.
- **Phase**: Phase 1 — single engineer, manual Cash App payments, no Stripe yet. Architecture (D1 schema with `engineer_id` / `service_id` relations) is designed so Phase 2 (multiple engineer profiles) and Phase 3 (Stripe Connect marketplace, automatic payouts, platform commission) are additive, not a rebuild.

## Currently Completed Features
- **Landing page**: Hero, "How It Works", Services grid, About Mason, Pricing, FAQ, Contact — dark "midnight ember" premium theme (charcoal + gold + wine accents, no default blue/black).
- **Booking flow** (`/book`): 3-step form — session details → contact info → review & confirm. Auto-detects first-time vs. returning clients by email and shows correct price live.
- **Pricing logic**: First-time clients get $100 flat for up to 3 hours (extra hours at $40/hr); returning clients pay $40/hr straight. Encoded in `src/lib/pricing.ts`.
- **Availability rules**: Mon–Fri, 11am–11pm is standard. Anything outside that window is still bookable but flagged as a **Special Time Request** for manual confirmation instead of auto-accepting (see `isWithinStandardAvailability` in `src/lib/pricing.ts`).
- **Payment workflow (Phase 1, no Stripe)**: After booking, customer sees Cash App deposit instructions (`$KEYZGMG`) and can upload a screenshot (PNG/JPEG/PDF, stored in R2) or enter a transaction ID. Booking moves to `pending_approval` until admin confirms.
- **Customer status lookup** (`/status`): enter email → see all bookings + status + a link to submit payment proof if still pending.
- **Admin dashboard** (`/admin`, password-protected): filter bookings by status, view customer info, view uploaded payment proof, Approve / Reject / Mark Completed / Cancel.
- **Services page section**: Recording is bookable instantly; Mixing, Mastering, Songwriting, Podcast Recording, Voice Over are listed as "Contact for pricing" (Future Upsells from the product plan).
- **Data layer**: Cloudflare D1 (SQLite) for `engineers`, `services`, `customers`, `bookings`; Cloudflare R2 for payment-proof file uploads.

## Entry URIs
| Path | Method | Description |
|---|---|---|
| `/` | GET | Landing page |
| `/book` | GET | Booking form (client-rendered multi-step) |
| `/api/availability-check?date=YYYY-MM-DD&time=HH:MM` | GET | Returns `{ withinStandardHours: boolean }` |
| `/api/price-check?email=&duration=` | GET | Returns `{ amount, breakdown, isFirstTimeRate }` |
| `/api/bookings` | POST (JSON) | Creates a booking, returns `{ bookingId }` |
| `/book/confirmation/:id` | GET | Post-booking confirmation + Cash App instructions |
| `/book/pay/:id` | GET/POST | Upload payment screenshot or transaction ID |
| `/status?email=` | GET | Customer's booking history + live status |
| `/admin/login` | GET/POST | Admin password login |
| `/admin` | GET | Dashboard (requires session cookie) |
| `/admin/bookings/:id/status` | POST | Approve/reject/complete/cancel a booking |
| `/admin/proof/:id` | GET | Streams the uploaded payment-proof file from R2 |
| `/admin/logout` | POST | Clears admin session |

## Features Not Yet Implemented (Phase 2 / Phase 3 per the product plan)
- Multiple engineer profiles, ratings, travel radius search, GPS-based matching
- Stripe Connect — automated customer payments, platform commission, automatic engineer payouts
- Customer accounts / login (currently email-lookup only, no password)
- Reschedule / cancel self-service (currently view-only from customer side; changes go through admin)
- Messaging between customer and engineer
- Upsell services beyond "contact for pricing" listing (Mixing, Mastering, etc. have no bookable flow yet)

## Recommended Next Steps
1. Get real bookings running Phase 1 in production, validate demand and pricing.
2. Add self-service reschedule/cancel requests from the customer status page.
3. When ready to add a second engineer, extend the `engineers` table usage (already modeled) and add an engineer-selection step to the booking flow.
4. When ready for automated payments, integrate Stripe Connect and use the existing `stripe_account_id` column already present on `engineers`.

## Data Architecture
- **Storage**: Cloudflare D1 (SQLite) for relational data; Cloudflare R2 for payment-proof uploads (screenshots/PDFs).
- **Tables**: `engineers`, `services`, `customers`, `bookings` — see `migrations/0001_initial_schema.sql` for full schema and seed data.
- **Design note**: `bookings.engineer_id` and `bookings.service_id` exist from day one even though Phase 1 only ever has engineer #1 (Mason) and one bookable service (Recording), so Phase 2/3 don't require a schema rebuild.

## User Guide
- **To book a session**: Go to `/book`, fill out date/time/location/contact info, review your price, confirm. You'll get Cash App deposit instructions immediately after.
- **To pay your deposit**: Send the amount shown to `$KEYZGMG` on Cash App, then upload your screenshot or transaction ID on the confirmation page (or later via `/status`).
- **To check your booking**: Go to `/status`, enter the email you booked with.
- **Admin**: Go to `/admin/login`, enter the admin password (set via the `ADMIN_PASSWORD` secret) to manage bookings.

## Deployment
- **Platform**: Cloudflare Pages (Workers) — user's own Cloudflare account (BYOK)
- **Tech Stack**: Hono + TypeScript + TailwindCSS (CDN) + Cloudflare D1 + Cloudflare R2
- **Status**: See deployment section below for live URL
