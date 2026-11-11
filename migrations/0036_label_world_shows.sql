-- Shows: the owner's own live shows. Each published show gets a public page and a QR code
-- (for flyers, posters, merch). "Buy tickets" goes to the owner's OWN ticket link (any seller:
-- their Eventbrite, a Stripe Payment Link from their own Stripe account, a venue page) or the show
-- is free. Studio2U never takes payments, never sees card details and never stores buyer data;
-- it only counts page views and QR scans.
CREATE TABLE lw_shows (
 id TEXT PRIMARY KEY, label_id TEXT NOT NULL REFERENCES lw_labels(id),
 slug TEXT NOT NULL UNIQUE CHECK(length(slug) BETWEEN 6 AND 80),
 title TEXT NOT NULL CHECK(length(title) BETWEEN 1 AND 120),
 starts_at TEXT NOT NULL,
 venue TEXT NOT NULL CHECK(length(venue) BETWEEN 1 AND 120), city TEXT NOT NULL CHECK(length(city) BETWEEN 1 AND 80),
 address TEXT, details TEXT CHECK(details IS NULL OR length(details)<=1000),
 ticket_url TEXT, price_text TEXT, free INTEGER NOT NULL DEFAULT 0 CHECK(free IN (0,1)),
 status TEXT NOT NULL DEFAULT 'DRAFT' CHECK(status IN ('DRAFT','PUBLISHED','CANCELLED')),
 url TEXT NOT NULL, views INTEGER NOT NULL DEFAULT 0, qr_scans INTEGER NOT NULL DEFAULT 0,
 created_by INTEGER NOT NULL, published_at TEXT,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CHECK(free=1 OR ticket_url IS NOT NULL OR status<>'PUBLISHED')
);
CREATE INDEX lw_shows_label ON lw_shows(label_id,starts_at);
