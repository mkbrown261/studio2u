# Canonical Music and Release Data Contract (v2)
The database is authoritative; every claimed identifier/status must have provenance and optional verification evidence. Separate normalized entities for COMPOSITION, RECORDING, RELEASE, RELEASE_TRACK, CONTRIBUTOR, CONTRIBUTION, OWNERSHIP_SHARE, PARTY, PUBLISHER, AFFILIATION, DISTRIBUTION_DELIVERY, REGISTRATION, LICENSE, ASSET, CAMPAIGN and TASK.

## Composition (songwriting work)
- compositionId, canonical title, alternate titles, language, composition writers with legal names and roles, publisher(s), PRO memberships and territory, IPI/CAE if supplied/verified, ISWC if assigned, writer/publisher shares with basis and effective date, co-write agreements, samples and interpolations, derivative/cover status, lyrics versions with approval and provenance.
- Split figures have explicit **share type and denominator**: composition ownership, writer share, publisher share, master income, producer points and distributor revenue splits are **not interchangeable**. Validate applicable totals for *each* framework separately, account for regional PRO conventions and missing share agreements. Never simply assume 100% writer + 100% publisher convention applies universally.

## Recording (master)
- recordingId, compositionId(s), display title/version, master rightsholder(s), ℗ owner/year, performers/featured artists, producers, co-producers, mixing/mastering engineers, recording date and original release date where known, recording ISRC or pending, audio format, sample rate, bit depth, channels, measured exact durationMs, integrated loudness/true peak where measured, BPM/key estimates flagged estimates, explicit status confirmed by human, AI provenance, recording location if needed, file source and immutable hash, clearance status, potential duplicate fingerprints.

## Release
- releaseId, labelId, public label imprint, release title/type (single/EP/album), primary artist and approved display names, distributor account/target, track order, release UPC/EAN (existing or distributor-assigned), ℗/© lines and verified owners, territories, release timing/time zone, presave/preorder links if supported, genre/subgenre, language, clean/explicit designation, cover image assets, contributor credits, metadata version, artwork compliance report, approvals, delivery status, provider receipt, platform live URLs and date observed.
- An ISRC identifies a **recording**; UPC/EAN identifies a **release/product**; ISWC identifies a **composition**; IPI/CAE identifies a **rightsholder**. Don't require a UPC or ISRC for every PRO work registration without source-specific proof; provider rules vary.

## Lyrics and timed music intelligence
- lyricTranscript: language, source audio, raw text, transcription engine/model, transcription date, confidence at segment/word level where available, wordStartMs/wordEndMs, lineStartMs/lineEndMs, section labels (verse, prechorus, chorus, bridge, intro, outro), manual corrections and approved version.
- No transcript is authoritative until contributor/artist verifies. Preserve the recording's true duration separate from timed lyrics. Allow instrumental/no vocals and tracks with untranscribable content.
- Hook candidates: source recording/approved transcript, exact startMs/endMs, reason (refrain, first verse entrance, drop, emotional moment, memorable phrase), musical metrics if actually computed, confidence and reviewer feedback. AI predictions of virality must be labeled hypotheses.

## Identity / likeness / visual assets
- artist identity kit: consent/rights to likeness, uploaded photos, authorized clothing/shoe/accessory refs, description, brand guide, owner, permitted scope, revocation handling, generated-image/video provenance and disclosure requirements. Don't use third-party likeness absent authorization.

## Source of truth / confidence
Each nontrivial field may carry `value`, `status = USER_CONFIRMED | DOCUMENT_VERIFIED | FILE_EXTRACTED | MACHINE_INFERRED | UNKNOWN | DISPUTED`, `sourceId`, `updatedAt`, `verifiedBy`, `effectiveAt`. Machine-inferred credits, splits and rights are never silently accepted.

## Intake questions (ordered to minimize friction)
1. What song and which artist? Single or project? What is the distributor/date?
2. Upload master, artwork (or request design), optional lyrics and promo reference.
3. Do you own/control the master and have rights to beats, samples, covers and collaborator contributions?
4. Who wrote the composition? Who produced and performed? Any featured artist? What credits are known?
5. Are you registered with ASCAP, BMI or another PRO? Publisher entity? IPI? Do you have split sheets?
6. Do you already have ISRC/UPC? If not, leave pending and obtain via eligible provider process; never generate arbitrary codes.
7. What distribution territories/content advisories? What platforms and marketing goals?
8. Is this Fast Release or Fully Managed? Which official accounts can be connected?
Only ask questions necessary for the chosen workflow phase; reuse confirmed artist and label profiles.

## Validation gates
- File technical: format/container/codec, playable, checksums, duration, corruption, clipping/peak measurements if collected, current provider specs.
- Metadata: consistent identifiers, primary vs featured naming, credits vs split docs, language/title consistency, nonempty required distributor fields.
- Rights: recording authority, beat/sample/cover permissions, AI output rights and sources, portrait/footage licenses; uncertain known risks block high-consequence external actions.
- Packaging: deterministic manifest of every asset, report artifact provenance, provider-specific delivery schema or manual checklist.
- Registrations: distinguish planned vs prepared vs submitted vs confirmed with evidence; account for societies and territories.
