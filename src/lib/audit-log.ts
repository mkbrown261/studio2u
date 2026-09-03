// Audit trail for sensitive actions (migration 0008) — not user-facing, just an
// internal record of who did what for later investigation (e.g. "who suspended this
// engineer and when", "who changed the commission rate"). Logging failures never
// block the underlying action; this is best-effort observability, not a control.

export interface AuditLogEntry {
  actorType: 'admin' | 'user'
  actorId?: string | number | null
  action: string
  targetType?: string
  targetId?: string | number | null
  metadata?: Record<string, unknown>
}

export async function logAuditEvent(db: D1Database, entry: AuditLogEntry): Promise<void> {
  try {
    await db
      .prepare(
        `INSERT INTO audit_log (actor_type, actor_id, action, target_type, target_id, metadata)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .bind(
        entry.actorType,
        entry.actorId != null ? String(entry.actorId) : null,
        entry.action,
        entry.targetType || null,
        entry.targetId != null ? String(entry.targetId) : null,
        entry.metadata ? JSON.stringify(entry.metadata) : null
      )
      .run()
  } catch (err) {
    // Never let audit logging break the actual request.
    console.error('audit log write failed', err)
  }
}
