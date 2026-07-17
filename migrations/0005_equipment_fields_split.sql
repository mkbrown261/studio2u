-- Studio2U Phase 3 M2: split the single free-text "Equipment / Spec List" field into
-- three explicit fields (Microphone / DAW / Audio Interface), each displayed next to a
-- matching icon on the public profile. Keeping the old equipment_text/equipment_photo_url
-- columns for backward-compat with any profile saved before this migration (falls back to
-- showing the old free-text block if none of the three new fields are filled in).

ALTER TABLE engineer_profiles ADD COLUMN mic_spec TEXT;
ALTER TABLE engineer_profiles ADD COLUMN daw_spec TEXT;
ALTER TABLE engineer_profiles ADD COLUMN interface_spec TEXT;
