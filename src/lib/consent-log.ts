// Consent log (migration 0009) — evidence trail for legal-document acceptance
// (Terms of Service at signup, Recording Consent Agreement at booking time).
// Best-effort: a logging failure must never block the underlying signup or
// booking action, but it is written *before* we tell the caller everything
// succeeded so a failure is at least visible in logs.

export type ConsentDocumentType = 'terms' | 'privacy' | 'recording_consent'

export interface ConsentLogEntry {
  userId?: number | null
  bookingId?: number | null
  documentType: ConsentDocumentType
  documentVersion: string
  email?: string | null
  ipAddress?: string | null
  userAgent?: string | null
}

export async function logConsentEvent(db: D1Database, entry: ConsentLogEntry): Promise<void> {
  try {
    await db
      .prepare(
        `INSERT INTO consent_log (user_id, booking_id, document_type, document_version, email, ip_address, user_agent)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        entry.userId ?? null,
        entry.bookingId ?? null,
        entry.documentType,
        entry.documentVersion,
        entry.email || null,
        entry.ipAddress || null,
        entry.userAgent || null
      )
      .run()
  } catch (err) {
    // Never let consent logging break the actual signup/booking request.
    console.error('consent log write failed', err)
  }
}

// Central place to bump when a legal document is revised — keeps the version
// string used when writing consent_log rows in sync with the doc actually
// served at /terms and /consent.
export const CURRENT_TERMS_VERSION = '1.0'
export const CURRENT_RECORDING_CONSENT_VERSION = '1.0'
