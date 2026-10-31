# Royalty Recovery + Creative-to-Promotion Operations

## The founder's real pain and the commercial problem

Founder often distributes with UnitedMasters first, then postpones PRO paperwork because ASCAP/BMI, SoundExchange and administrative follow-up are laborious. Some royalties may be uncollected or unidentified. Studio2U must reduce this burden by building **persistent post-release follow-ups** and a **Royalty Recovery Dashboard**; it must not assert that any specific user is owed money until verified in the relevant account/records. SoundExchange income is distinct from on-demand streaming master receipts; qualify collection pathways before displaying estimates.

## Royalty Recovery service design

For each cataloged composition/recording and contributor: collect PRO affiliation(s), writer/publisher IDs, ISRC/ISWC/UPC as relevant, title variants, performance/release history, registrant identity, rights ownership, sound-recording owner, featured/nonfeatured performer details where applicable, distributor account, master and composition agreements, and evidence of registrations. Separate tasks for PRO, The MLC (US digital mechanical pathway), SoundExchange (eligible non-interactive digital performance sound-recording royalties), distributor/master royalties, Copyright Office as appropriate. Provide `UNKNOWN`, `NOT_APPLICABLE`, `NEEDS_INFORMATION`, `PACKET_READY`, `AWAITING_USER_SUBMISSION`, `REPORTED_SUBMITTED`, `VERIFICATION_PENDING`, `CONFIRMED`, `BLOCKED`, `DISPUTED` states. Evidence-backed gaps and outreach steps; never guarantee a recovery amount. Source timestamps and territorial qualifiers mandatory. Consent and authorization before access to royalty accounts.

**Important:** Artist can request “Help me find SoundExchange money I may have missed.” Agent gathers catalog, checks whether role/right is eligible, prepares matched-recording/claim checklist, requests missing information via inbox, directs user to official SoundExchange Direct or supported authorized provider capability, preserves official correspondence/receipt, schedules follow-up. A guessed balance is forbidden.

## Creative campaign chain — all handoffs are typed artifacts

1. Artist/Marketing Manager creates release campaign and goals. A&R researches authorized charts/social/genre signals, provides source links and comparisons (no promises of virality).
2. Artist Identity Kit: approved face/body likeness references, optional clothing/shoes, brand colors, permitted use rights, consent/expiry and generated-asset provenance. Never use third-party likeness or apparel photos in a way lacking necessary authorization.
3. Videographer skill produces CreativeConcept(s), emotional tone, scene setting, shot list (framing, lens feel, location, movement, lighting, duration, actor look, wardrobe), storyboard with continuity constraints and source IDs.
4. Artist reviews/selects creative direction via Agent Inbox. Reviewer validates authorization/budget. Higgsfield adapter only after official API/terms, quota, costs and project access are verified; support alternate provider adapters.
5. Generated media asset stored immutable with prompt, model/version, reference IDs, license/provenance and cost/job status. No generated image/video claimed until file/receipt verified.
6. Short-Form Editor consumes audio lyrics with timestamps, proposed hooks, beats/transients, approved footage; uses verified Genjitsu adapter only if real capability exists, otherwise first-party editing pipeline. Creates cut lists, captions, safe zones, platform-specific 9:16 exports and variants with technical QA.
7. Reviewer produces technical, copyright, likeness, brand, caption accuracy and platform-rule report. Artist approves final posts.
8. Social Manager prepares posts per destination via approved APIs or manual handoff. Publishes/schedules only after explicit authorization, saves provider post IDs/status, updates analytics where permitted. No scraping/reposting third-party content without rights.
9. Executive reports campaigns and measurable results; learning compares hypotheses with real test performance rather than treating popularity as guaranteed.

## Engineering handoff model

Use immutable typed artifacts and task events: `ArtistIdentityKit`, `CreativeBrief`, `ShotList`, `Storyboard`, `MediaGenerationJob`, `GeneratedAsset`, `EditDecisionList`, `CaptionTrack`, `PlatformExport`, `ReviewReport`, `SocialDraft`, `Approval`, `PublishingReceipt`, `RoyaltyClaimPacket`, `RegistrationEvidence`. Agent Inbox messages link to these records, not copy their mutable body as source of truth.

## Priority

First real release ZIP/rights package; next Agent Inbox and registration approval/claim packet interaction; text agent invocation; then voice; 3D messaging; activate Higgsfield/video/social providers one by one after checks. Design all schemas/contracts now without making external API delivery a dependency of the first useful release engine.
