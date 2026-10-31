-- Merch with no inventory: the owner's own Fourthwall shop (free plan) prints and ships
-- each order. Studio2U keeps designs, the products it created and their mockups.
-- The Fourthwall API user is a shop key (not the owner's login), stored encrypted and
-- never returned. Card, bank and payout details stay inside Fourthwall.
CREATE TABLE lw_merch_shops (
 label_id TEXT PRIMARY KEY REFERENCES lw_labels(id),
 provider TEXT NOT NULL DEFAULT 'fourthwall' CHECK(provider IN ('fourthwall')),
 encrypted_creds TEXT NOT NULL, shop_json TEXT NOT NULL DEFAULT '{}',
 connected_by INTEGER NOT NULL, connected_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE lw_merch_designs (
 id TEXT PRIMARY KEY, label_id TEXT NOT NULL REFERENCES lw_labels(id), case_id TEXT,
 title TEXT NOT NULL CHECK(length(title) BETWEEN 1 AND 120), prompt TEXT,
 source TEXT NOT NULL CHECK(source IN ('UPLOAD','AI','IDEA')),
 status TEXT NOT NULL DEFAULT 'DRAFT' CHECK(status IN ('IDEA','DRAFT','APPROVED','REJECTED')),
 object_key TEXT, width INTEGER, height INTEGER, byte_size INTEGER, sha256 TEXT, transparent INTEGER,
 fw_image_json TEXT NOT NULL DEFAULT '{}',
 rights_attested_by INTEGER, rights_attested_at TEXT,
 created_by TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX lw_merch_designs_label ON lw_merch_designs(label_id,created_at);
CREATE TABLE lw_merch_products (
 id TEXT PRIMARY KEY, label_id TEXT NOT NULL REFERENCES lw_labels(id),
 design_id TEXT NOT NULL REFERENCES lw_merch_designs(id), kind TEXT NOT NULL, template_id TEXT NOT NULL,
 name TEXT NOT NULL, fw_product_id TEXT NOT NULL, colors_json TEXT NOT NULL DEFAULT '[]',
 base_price REAL, profit_margin REAL NOT NULL, mockups_json TEXT NOT NULL DEFAULT '[]',
 state TEXT NOT NULL DEFAULT 'HIDDEN' CHECK(state IN ('HIDDEN','PUBLIC')),
 created_by INTEGER NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, published_at TEXT
);
CREATE INDEX lw_merch_products_label ON lw_merch_products(label_id,created_at);
