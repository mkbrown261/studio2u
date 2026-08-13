# Studio2U

Mobile recording session booking marketplace. "We bring the studio to you."

## Project Overview
- **Name**: Studio2U
- **Goal**: Let clients browse a directory of mobile recording engineers, pick one based on rate/reviews/genres, book directly, pay a Cash App deposit, get confirmed, get recorded.
- **Phase**: Phase 3 in progress — M1 (admin-editable commission), M2 (branding), and M3 (per-engineer availability calendar) are complete. M4 (Resend email) and M5 (Stripe Connect, mandatory onboarding — no more Cash App) are still to come. Phase 2's full multi-engineer marketplace (public directory, per-engineer pricing, portfolios, reviews, directory-wide map) remains the foundation. Payments are still manual Cash App per engineer until M5 ships.

## Currently Completed Features

### Phase 3 (in progress)
- **M1 — Platform commission** (`/admin/settings/commission`): admin-editable commission percentage (default 10%), stored in `platform_settings` (key/value table), read live everywhere it's needed rather than hardcoded. `splitCommission()` in `src/lib/db-settings.ts` is pre-built for M5's Stripe Connect payout split (`application_fee_amount`) but not wired into any payout code yet since there is no Stripe integration yet.
- **M2 — Branding**: custom favicon (16/32/48/180px, cropped tight to content so it reads clearly at browser-tab size), header/footer logo badge (transparent PNG), and a 3-way equipment field split (Microphone / DAW / Audio Interface) each shown on the public profile next to a matching 48px icon in a card grid — replacing the old single free-text "equipment" blob. Profiles saved before this migration still show their old free-text equipment via an automatic fallback.
- **M3 — Engineer availability calendar** (`/dashboard/availability`): each engineer sets their own **weekly recurring schedule** (Mon–Sun day boxes, click a day to toggle open hours) plus **one-off date overrides** (close a specific date for vacation, or open extra hours beyond the weekly template, with a "reset to default" action). The public booking flow (`/book/:engineerId`) now shows only real, currently-open start times fetched live from `/api/available-slots` — no more free-text time entry with just an advisory note. Every booking is also **hard-validated server-side** on submit (`POST /api/bookings` returns 409 if the slot isn't actually open), and a slot **auto-blocks the instant it's booked** and **auto-frees if the booking is later cancelled/rejected** (blocking is derived live from the `bookings` table, not a separate lock table, so it's always in sync). Engineers who haven't touched their calendar yet automatically keep the old platform-wide default (Mon–Fri, 11am–10pm start times) — nothing breaks for existing profiles.

### Marketplace (Phase 2)
- **Auth**: real email+password accounts (`/signup`, `/login`, `/logout`), PBKDF2 (Web Crypto) password hashing, session cookie. Users can be an engineer, an artist, or both.
- **Engineer profile builder** (`/dashboard/profile`): bio, photo, engineer-set hourly rate, optional first-time-client discount (flat price for N hours), genres, travel radius, equipment description + photo, Cash App handle, location (city/zip). Saving instantly publishes the profile to the public directory. Location is geocoded once (OpenStreetMap Nominatim, free/no API key) and jittered 1–2 miles before being stored — the engineer's exact address is never saved or shown.
- **Portfolio** (`/dashboard/portfolio`): engineers add embed links (SoundCloud/YouTube/Spotify); auto-converted to inline players on their public profile via `src/lib/embed.ts`.
- **Public engineer directory** (`/engineers`): grid of published, non-suspended engineers with genre filter, plus a Leaflet/OpenStreetMap map showing a pulsing gold dot per engineer's rough (jittered) location. No API key needed.
- **Individual engineer profile** (`/engineers/:id`): bio, genres, equipment, portfolio embeds, reviews, rate/discount, "New" badge until first review lands, and a client-side **distance-from-you** readout (browser geolocation + Haversine distance vs. the engineer's jittered coordinates — no map, no exact address on this page).
- **Booking flow rework** (`/book/:engineerId`): customer picks an engineer first; pricing pulls from that engineer's own rate/discount instead of a fixed platform rate. "First-time" pricing is now per-engineer (has this customer booked *this* engineer before), not platform-wide.
- **Reviews**: mic-icon rating (1–5, not stars). Gated to customers with a `completed` booking with that specific engineer who haven't already reviewed it (`/review/:id`). Submitting a review recalculates the engineer's `rating_avg`/`rating_count` and clears their "New" badge.
- **Engineer's own booking queue** (`/dashboard/bookings`): each engineer approves/rejects/completes/cancels their own bookings and sees uploaded payment proof — no longer routed through the platform admin.
- **Platform admin oversight** (`/admin`, password-protected): cross-engineer view of all bookings plus a suspend/reactivate kill switch per engineer profile (instantly pulls a suspended engineer off the public directory and booking flow) — kept as a separate surface from each engineer's own dashboard.

### Carried over from Phase 1
- Dark "midnight ember" theme (charcoal + gold + wine accents).
- Cash App deposit workflow: customer uploads a screenshot/PDF (R2) or transaction ID; booking sits in `pending_approval` until the engineer (or admin) confirms.
- Customer status lookup (`/status`) — email → booking history + live status + (new) "Leave a Review" prompt once a booking is completed.
- Services section: Recording is bookable instantly; Mixing, Mastering, Songwriting, Podcast Recording, Voice Over remain "Contact for pricing".
- Mason Brown (the original Phase 1 engineer) has been migrated into a real account + engineer profile (`migrations/0003_migrate_mason_to_marketplace.sql`) so he appears in the directory like any other engineer, carrying over his original bio/genres/travel radius/Cash App handle/$100-for-3hrs first-time offer. He has no "New" badge (grandfathered) and no location set yet — he can add one via his own dashboard like any engineer.

## Entry URIs
| Path | Method | Description |
|---|---|---|
| `/` | GET | Landing page |
| `/engineers?genre=` | GET | Public engineer directory + map |
| `/engineers/:id` | GET | Individual engineer profile (404s if unpublished/suspended) |
| `/media/*` | GET | R2 proxy for engineer photos/equipment images (namespaced, payment proofs are not reachable here) |
| `/signup` | GET/POST | Create an account (email/password, engineer/artist/both) |
| `/login` / `/logout` | GET/POST / POST | Session login/logout |
| `/dashboard` | GET | Account home |
| `/dashboard/become-engineer` | GET/POST | Opt an existing account into the engineer role |
| `/dashboard/profile` | GET/POST | Engineer profile builder (instant publish) |
| `/dashboard/portfolio` | GET/POST | Add/list portfolio embed links |
| `/dashboard/portfolio/:id/delete` | POST | Remove a portfolio item |
| `/dashboard/bookings` | GET | Engineer's own booking queue |
| `/dashboard/bookings/:id/status` | POST | Engineer approves/rejects/completes/cancels a booking |
| `/dashboard/bookings/:id/proof` | GET | Streams payment-proof file from R2 (engineer-owned only) |
| `/dashboard/availability` | GET/POST | Engineer's weekly recurring availability calendar |
| `/dashboard/availability/override` | POST | Save one-off open/closed hour overrides for a specific date |
| `/dashboard/availability/override/delete` | POST | Reset a specific date's overrides back to the weekly default |
| `/book/:engineerId` | GET | Booking form for a specific engineer (client-rendered multi-step; date/duration → live open-slot buttons) |
| `/api/available-slots?engineerId=&date=` | GET | Returns `{ hours: number[] }` — every open start hour for that engineer on that date (weekly template + overrides, minus already-booked hours) |
| `/api/price-check?engineerId=&email=&duration=` | GET | Returns `{ amount, breakdown, isFirstTimeRate }` for that engineer |
| `/api/bookings` | POST (JSON) | Creates a booking (`engineerId` required); server re-validates the slot is still open and returns 409 if not, otherwise returns `{ bookingId }` |
| `/book/confirmation/:id` | GET | Post-booking confirmation + that engineer's Cash App instructions |
| `/book/pay/:id` | GET/POST | Upload payment screenshot or transaction ID |
| `/review/:id?email=` | GET/POST | Leave a mic-rating review for a completed, unreviewed booking |
| `/status?email=` | GET | Customer's booking history + live status + review prompts |
| `/admin/login` | GET/POST | Admin password login |
| `/admin` | GET | Platform bookings dashboard (requires session cookie) |
| `/admin/bookings/:id/status` | POST | Approve/reject/complete/cancel a booking (platform-level) |
| `/admin/engineers/:id/suspend` | POST | Suspend/reactivate an engineer profile (kill switch) |
| `/admin/proof/:id` | GET | Streams the uploaded payment-proof file from R2 |
| `/admin/logout` | POST | Clears admin session |

## Features Not Yet Implemented
- **M4 — Resend email** (transactional emails: booking confirmations, status updates) — not started. Test/sandbox sender approved for initial rollout.
- **M5 — Stripe Connect** — automated customer payments, live commission split via `splitCommission()`, automatic engineer payouts, **mandatory engineer onboarding (no more Cash App fallback)**. Blocked on Stripe API keys. Cash App remains the only payment path until this ships.
- Password reset / email verification (simple email+password only, by design for now)
- Reschedule / cancel self-service (still goes through the engineer or admin)
- Messaging between customer and engineer
- Upsell services beyond "contact for pricing" listing (Mixing, Mastering, etc.)
- Type-check cleanup: `tsconfig.json` lacks `@cloudflare/workers-types`/DOM lib, so `tsc --noEmit` reports many pre-existing type errors. These do not block the Vite/Wrangler build (the actual deploy pipeline) and were consciously left as-is.

## Recommended Next Steps
1. Build **M4** — Resend transactional email (booking confirmation, status-change notifications), starting with a test/sandbox sender.
2. Build **M5** — Stripe Connect: mandatory engineer onboarding, live commission split via `splitCommission()`, remove the Cash App payment-proof flow entirely once Stripe is live.
3. Get real engineers signed up and publishing profiles; validate directory/booking conversion.
4. Add self-service reschedule/cancel requests from the customer status page.
5. Fix the `tsconfig.json` type-config gap (`@cloudflare/workers-types` + `"lib": ["ESNext", "DOM"]`) for a clean `tsc --noEmit` pass.

## Data Architecture
- **Storage**: Cloudflare D1 (SQLite) for relational data; Cloudflare R2 for engineer photos/equipment images and payment-proof uploads.
- **Tables**: `engineers` (legacy Phase 1 seed, kept for FK back-compat), `services`, `customers`, `bookings`, `users`, `sessions`, `engineer_profiles`, `portfolio_items`, `reviews`, `platform_settings` (M1), `engineer_availability` + `engineer_availability_overrides` (M3) — see `migrations/0001` through `0006`.
- **Availability model** (M3): `engineer_availability` is the weekly recurring template (`day_of_week` 0–6, `hour` 0–23 = "open to start a session at this hour on this weekday"). `engineer_availability_overrides` holds one-off exceptions for a specific `date` (force-open or force-close a given hour). An engineer with zero rows in `engineer_availability` hasn't customized their calendar yet and falls back to the legacy default (Mon–Fri, hours 11–22) — see `src/lib/db-availability.ts`. Actual booked-slot blocking is derived live from `bookings` (any row not `cancelled`/`rejected` occupies its hour range) rather than stored in a separate table, so a slot blocks the instant it's booked and frees automatically if the booking is cancelled.
- **Pricing model**: `calculatePrice(durationHours, isFirstTimeWithThisEngineer, rate)` where `rate` is pulled from the specific `engineer_profiles` row being booked; "first time" is determined per (customer email, engineer) pair via `hasCustomerBookedEngineerBefore`.
- **Location privacy**: engineers type a city/zip; it's geocoded once (Nominatim) and jittered 1–2 miles before being stored in `engineer_profiles.lat/lng`. The exact typed location and any street address are never stored or shown publicly.

## User Guide
- **To find and book an engineer**: Go to `/engineers`, browse the directory (filter by genre, see the map), open a profile you like, check their rate/reviews/distance from you, then hit "Book".
- **To become an engineer**: Sign up at `/signup` (check "I'm an engineer"), then fill out your profile at `/dashboard/profile` — it publishes instantly. Add portfolio links at `/dashboard/portfolio`.
- **To manage your bookings as an engineer**: `/dashboard/bookings` — approve, reject, or mark sessions completed; view uploaded payment proof.
- **To leave a review**: after a session is marked completed, go to `/status` (enter the email you booked with) and use the "Leave a Review" link, or use the direct `/review/:id` link.
- **To pay your deposit**: Send the amount shown to the engineer's Cash App handle (shown on the confirmation/pay page), then upload your screenshot or transaction ID.
- **Admin**: Go to `/admin/login`, enter the admin password (set via the `ADMIN_PASSWORD` secret) to see all bookings across engineers, or `/admin/engineers` to suspend/reactivate an engineer's public profile.

## Deployment
- **Platform**: Cloudflare Pages (Workers) — user's own Cloudflare account (BYOK)
- **Production URL**: https://studio2u.pages.dev
- **Tech Stack**: Hono + TypeScript + TailwindCSS (CDN) + Leaflet/OpenStreetMap (CDN) + Cloudflare D1 + Cloudflare R2
- **Status**: ✅ Production is live on the M1–M3 build (migration `0006_engineer_availability.sql` applied to remote D1; `wrangler pages deploy` completed and confirmed as the current Production deployment on `main`). Verified directly against `https://studio2u.pages.dev`: favicon links (16/32/48/180), the equipment-icon card grid on the one live engineer profile, and `/api/available-slots` all serve correctly.
- **Admin password**: Set as the `ADMIN_PASSWORD` Cloudflare secret (not stored in code/repo). Rotate anytime with `wrangler pages secret put ADMIN_PASSWORD --project-name studio2u`.
