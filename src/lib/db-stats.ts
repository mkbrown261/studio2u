// Real platform social-proof numbers for the homepage (replacing/augmenting static
// placeholder copy like "Growing" / "On-Demand"). Single cheap query set, no caching —
// D1 reads are fast enough for a handful of aggregate COUNTs on a homepage render.
export interface PlatformStats {
  completed_sessions: number
  published_engineers: number
  average_rating: number | null
  total_reviews: number
}

export async function getPlatformStats(db: D1Database): Promise<PlatformStats> {
  const bookingStats = await db
    .prepare(`SELECT COUNT(*) as completed_sessions FROM bookings WHERE status = 'completed'`)
    .first<{ completed_sessions: number }>()

  const engineerStats = await db
    .prepare(`SELECT COUNT(*) as published_engineers FROM engineer_profiles WHERE is_published = 1 AND is_suspended = 0`)
    .first<{ published_engineers: number }>()

  const reviewStats = await db
    .prepare(`SELECT COUNT(*) as total_reviews, AVG(mic_rating) as average_rating FROM reviews`)
    .first<{ total_reviews: number; average_rating: number | null }>()

  return {
    completed_sessions: bookingStats?.completed_sessions || 0,
    published_engineers: engineerStats?.published_engineers || 0,
    average_rating: reviewStats?.average_rating ?? null,
    total_reviews: reviewStats?.total_reviews || 0
  }
}
