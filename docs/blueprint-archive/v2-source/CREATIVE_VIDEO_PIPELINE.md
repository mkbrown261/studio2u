# Music Marketing Creative Pipeline: Identity -> Video -> Shorts -> Distribution

## Goal
An artist supplies a finished recording and optional photo, outfit/shoe references, style inspiration and footage. Studio2U creates **rights-cleared, technically validated** promotional assets through specialized agents and authorized creative providers.

## Identity and reference stage
Artist selects: original uploaded photo, approved stylistic self-portrait/character, and optional outfit, footwear, jewelry, hairstyle, environment and mood references. Record ownership/consent to use likeness and every uploaded reference. Reject unauthorized impersonation. Preserve brand kit and selected look version so clips remain visually consistent.

## Videographer handoff artifact
Produce a `VideoCreativeBrief` with song id + approved audio section, campaign concept, audience/genre, desired emotion, creative hook, format objectives (vertical 9:16 or other), shot locations, wardrobe/identity references, visual restrictions, budget, rights/source check, artistic storyboard and generation prompt variants.

## Shot list and storyboard
For every shot: `shotId`, duration range, framing, camera motion, subject behavior, light/color mood, reference image IDs, prompt, continuity notes, intended edit point and fallback. Storyboard uses frames/sketches or render previews where available. Show artist storyboard for signoff prior to paid rendering at requested cost thresholds.

## Generation gateway (Higgsfield candidate)
Adapter contract: `capabilities`, `credentials`, `referenceUpload`, `submitJob`, `getStatus`, `cancelJob`, `downloadOutput`, `usageCost`, `modelLimitations`. Activate only after checking account's verified provider API scopes, permitted commercial usage, rights, pricing, data policies and model capabilities. Treat missing support as `UNAVAILABLE`, not a browser hack. Save source refs, prompt, model/version, generation timestamp, costs, licenses and result hashes.

## Editing provider (Genjitsu candidate)
Verify exact product identity, API, required permissions, and capabilities before using the name as an automated production guarantee. Implement `VideoEditorProvider` generic adapter with operations `trim`, `split`, `reframe`, `caption`, `sequence`, `audioSync`, `transitions`, `render`, `export`. Provide locally controlled FFmpeg-based baseline for predictable trim/reframe/overlay/captions when technically suitable. Keep provider interface separate from orchestration.

## Hook Intelligence
Sources: owned master, approved time-aligned transcript, actual waveform/transients, BPM/beat estimate where measured, user-supplied favorite sections, verified audience tests. Output ranked candidates with start/end milliseconds, hook hypothesis and notes; avoid claiming exact virality prediction. Generate 3-5 variations of first-seconds opening, CTA/caption, visual concept and hook placement for legitimate A/B testing. Never build a database of copyrighted lyrics/audio sampled from other artists for reuse without rights.

## Aspect presets
Default vertical preset **9:16**, common delivery **1080x1920**, use platform config overrides for TikTok, Instagram Reels and YouTube Shorts; don't conflate platform-specific upload duration, music licensing, safe area, max file size, bitrate or ad specs. Keep profiles versioned and source-linked. Add landscape 16:9, square 1:1 and feed-friendly 4:5 as optional variants where needed. Validate aspect ratio, pixels, FPS, codec, file duration and audio sync with actual inspection.

## Creative QA
- Consent and likeness: approved source/subject identity, no unauthorized third-party footage or celebrity lookalikes.
- Reference continuity: face/clothing/shoes, subject count, scene continuity and consistent visual identity.
- Technical: black frames, corrupt audio, resolution/aspect, clipping, captions readable and within safe zones, lip-sync assessed if used, no unintended brand logos.
- Commercial: rights/usage and provider terms, copyright/provenance record, explicit artist approval before publication.
- Honesty: generate realistic preview or flagged test asset only when genuinely rendered.

## Responsibilities
Videographer = concept, shot list, storyboard, generation, continuity. Editor = timing, beat sync, captions, versions and exports. Marketing = strategy, hook and creative test hypotheses. Reviewer = evidence QA. Social = copy, scheduling, publish receipts, analytics. Executive = budget, priorities, owner decisions.
