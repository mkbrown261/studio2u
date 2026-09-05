// Lightweight self-hosted analytics (migration 0013) — D1-backed, no third-party service.
// Every call is meant to be best-effort/non-blocking, matching the audit-log.ts pattern:
// callers should not await-and-throw on this in a way that could break a real request.
export type AnalyticsEventType = 'pageview' | 'booking_started' | 'booking_completed' | 'signup' | 'engineer_view'

export async function logEvent(
  db: D1Database,
  params: {
    eventType: AnalyticsEventType
    path?: string
    referrer?: string
    engineerProfileId?: number | null
    sessionId?: string | null
    metadata?: Record<string, unknown>
  }
): Promise<void> {
  try {
    await db
      .prepare(
        `INSERT INTO analytics_events (event_type, path, referrer, engineer_profile_id, session_id, metadata)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .bind(
        params.eventType,
        params.path ?? null,
        params.referrer ?? null,
        params.engineerProfileId ?? null,
        params.sessionId ?? null,
        params.metadata ? JSON.stringify(params.metadata) : null
      )
      .run()
  } catch (err) {
    console.error('analytics logEvent failed', err)
  }
}

export interface AnalyticsSummary {
  total_pageviews: number
  total_signups: number
  total_bookings_started: number
  total_bookings_completed: number
  top_paths: { path: string; count: number }[]
}

// Simple 30-day summary for an admin dashboard tile — intentionally coarse (counts only,
// no unique-visitor dedup) to keep this a single cheap query set instead of a real
// analytics pipeline.
export async function getAnalyticsSummary(db: D1Database): Promise<AnalyticsSummary> {
  const since = `datetime('now', '-30 days')`
  const counts = await db
    .prepare(
      `SELECT
         SUM(CASE WHEN event_type = 'pageview' THEN 1 ELSE 0 END) as total_pageviews,
         SUM(CASE WHEN event_type = 'signup' THEN 1 ELSE 0 END) as total_signups,
         SUM(CASE WHEN event_type = 'booking_started' THEN 1 ELSE 0 END) as total_bookings_started,
         SUM(CASE WHEN event_type = 'booking_completed' THEN 1 ELSE 0 END) as total_bookings_completed
       FROM analytics_events WHERE created_at >= ${since}`
    )
    .first<{ total_pageviews: number; total_signups: number; total_bookings_started: number; total_bookings_completed: number }>()

  const { results: topPaths } = await db
    .prepare(
      `SELECT path, COUNT(*) as count FROM analytics_events
       WHERE event_type = 'pageview' AND path IS NOT NULL AND created_at >= ${since}
       GROUP BY path ORDER BY count DESC LIMIT 10`
    )
    .all<{ path: string; count: number }>()

  return {
    total_pageviews: counts?.total_pageviews || 0,
    total_signups: counts?.total_signups || 0,
    total_bookings_started: counts?.total_bookings_started || 0,
    total_bookings_completed: counts?.total_bookings_completed || 0,
    top_paths: topPaths || []
  }
}
