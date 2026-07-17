-- Migrate Mason Brown (Phase 1's single hardcoded engineer, `engineers` id=1) into a
-- real `users` + `engineer_profiles` row so he appears in the Phase 2 public directory
-- and booking flow like any other engineer, instead of being invisible to it.
--
-- Login email is a placeholder (Mason had no email on file in Phase 1 — customers only
-- ever emailed Studio2You, not him directly). A temp password is set; Mason should log
-- in and can be given a "change password" flow later, or have it reset manually via D1.
--
-- Cash App handle, bio, genres, and travel radius are copied verbatim from the Phase 1
-- `engineers` seed row. No location (lat/lng) was ever captured for Mason in Phase 1, so
-- location_label/lat/lng are left NULL — he can fill those in via his engineer dashboard
-- (Milestone 2's profile builder) same as any new engineer, rather than us fabricating a
-- location Studio2You never actually recorded.

INSERT INTO users (email, password_hash, name, phone, is_engineer, is_artist)
SELECT
  'mason@studio2u.com',
  'pbkdf2$100000$93176ac61865e1c15a8ad0d140e5076b$b4e356dc372494ed50035601ca0e89a60e26fe5a7ea40ae47eb272d7d74c1beb',
  e.name,
  NULL,
  1,
  0
FROM engineers e
WHERE e.id = 1
  AND NOT EXISTS (SELECT 1 FROM users WHERE email = 'mason@studio2u.com');

INSERT INTO engineer_profiles (
  user_id, display_name, bio, photo_url, hourly_rate,
  first_time_discount_amount, first_time_discount_hours,
  genres, travel_radius_miles, cashapp_handle,
  location_label, lat, lng,
  is_published, is_new, is_suspended
)
SELECT
  u.id,
  e.name,
  e.bio,
  e.photo_url,
  40,                  -- Phase 1's fixed rate ($40/hr) preserved as his starting rate
  100,                 -- Phase 1's first-time flat-rate offer ($100 for first 3 hrs)
  3,
  e.genres,
  e.travel_radius_miles,
  e.cashapp_handle,
  NULL, NULL, NULL,    -- no location on file from Phase 1; Mason sets this via his dashboard
  1,                   -- publish immediately — he's not a "new" engineer, he's the original
  0,                   -- is_new = 0: don't show a "New" badge for the engineer who's been live since Phase 1
  0
FROM engineers e
JOIN users u ON u.email = 'mason@studio2u.com'
WHERE e.id = 1
  AND NOT EXISTS (
    SELECT 1 FROM engineer_profiles ep
    JOIN users u2 ON u2.id = ep.user_id
    WHERE u2.email = 'mason@studio2u.com'
  );

-- Backfill engineer_profile_id on any pre-Phase-2 bookings that used the old hardcoded
-- engineer_id = 1 (Mason), so his existing booking history / future review-eligibility
-- correctly ties back to his new profile instead of dangling on the legacy FK only.
UPDATE bookings
SET engineer_profile_id = (
  SELECT ep.id FROM engineer_profiles ep
  JOIN users u ON u.id = ep.user_id
  WHERE u.email = 'mason@studio2u.com'
)
WHERE engineer_id = 1
  AND engineer_profile_id IS NULL;
