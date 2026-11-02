# Release Operations: Artist-First, High-Automation

## Founder-validated behavior
Founder has personally released many records, has used UnitedMasters directly and achieved meaningful streams. Current personal pattern: get music to UnitedMasters quickly; postpone ASCAP registration and SoundExchange/mechanical registration because the administrative work takes too much time. Product opportunity = **automate repetitive paperwork and follow-through, not force tedious manual pre-distribution forms.**

## Two release modes
### FAST_RELEASE: release first with accountable paperwork queue
1. **New Release Wizard:** artist chooses FAST, uploads audio and artwork (or requests generated art), selects target distributor and release date; capture minimum required info.
2. **Automated analysis:** hash/preserve audio; inspect duration, sample rate, bit depth, channels, clipping, format; optionally transcribe and word-align vocals; every lyric marked DRAFT until owner approves. Classify explicit-content candidate as advisory, never authoritative.
3. **Minimum rights gate:** confirm artist has distribution authority for this recording, beat license or ownership if third party, samples/loops/cover/interpolation clearances as applicable, authorized features, recording ownership. Raise BLOCKED when real known risk is unresolved; do not use 'who made beat doesn't matter' as a compliance rule.
4. **Distribution-ready assembly:** credits, primary/featured names, explicit flag, release/art identifiers, track sequence, release date, version, territories, metadata, valid artwork/audio specs per **current verified** distributor rules. Composer/split data can be pending *only where distributor permits and rights declarations remain truthful*.
5. **Submission:** prefer approved API; where none exists, prepared export + user-controlled guided browser assistance (only if terms allow), not agent bypass of prohibited automation. Show status `READY_FOR_MANUAL_DELIVERY` until verified submitted. `DELIVERED` requires provider acknowledgment; `LIVE` requires checked store availability.
6. **Automatic paperwork queue** created on release submission/confirmation, independent of streaming success: PRO writer/publisher work registration; MLC eligibility/registration/matching; SoundExchange rights-owner and featured-artist registration where applicable; copyright-registration consideration; lyrics, splits, publishing metadata completion; license reminders; official receipt reconciliation. User may prioritize based on time/impact, but items remain open and visible.
7. **Post-release follow-through:** periodic backlog review, alerts of missing documents, deadlines if grounded, reconciliation checks for distributor/PRO/MLC/SoundExchange status, source-linked confirmations; agent cannot fabricate money owed or make universal revenue promises.

### MANAGED_RELEASE: prepare registrations concurrently
Same rights/QA gates but begin composition/writer/split intake and publishing/royalty readiness before scheduled distributor delivery. Prepare registrations early, obtain approvals and confirmations; may submit only via approved authorized services. Legal status remains precise: PREPARED, AWAITING_APPROVAL, SUBMITTED, ACKNOWLEDGED, CONFIRMED, REJECTED, NOT_APPLICABLE or UNKNOWN.

### Release state machine
DRAFT -> INTAKE_PENDING -> RIGHTS_REVIEW -> ASSETS_VALIDATING -> PACKAGE_PREPARING -> REVIEW_PENDING -> APPROVED -> READY_FOR_DELIVERY -> DELIVERY_PENDING -> SUBMITTED -> ACCEPTED -> LIVE; plus BLOCKED / FAILED / CANCELLED / TAKEDOWN_REQUESTED. Registration workflows run as *separate* processes, never as a fake part of distributor status.

## Mandatory work before a track can be marked READY_FOR_DELIVERY
- Confirm master delivery permission and applicable beat/sample/cover licenses; acknowledge unresolved rights explicitly and block where required.
- Valid master and artwork technical checks against target distributor's current documented specs.
- Metadata and required artist/credit information per distributor.
- User approval of legally significant and externally visible declarations.

## Don't force unnecessary hurdles
Optional artist interview and guided enrichment can happen after distribution preparation. A skill may use an answer-once form, reuse verified profile data and intelligently prefill fields. Keep progress saved; never make people re-enter the same contributor details each release.

## Registration responsibility map
| Process | Concerns | What agent can reliably do | What requires authorized external confirmation |
|---|---|---|---|
| PRO (ASCAP/BMI/etc) | Composition public-performance royalty registration/affiliations | Capture writer/publisher data, splits, affiliation, prepare form/checklist, track | Official work registration and acknowledgment |
| The MLC | US digital mechanical royalties for eligible works | Assess eligibility, prepare matching data, queue account/work actions | Official member/work confirmation |
| SoundExchange | US statutory digital sound recording royalties for covered noninteractive uses | Record featured artist / rights owner data and recording identifiers; prepare claims | Confirm registration/claims via supported process |
| Copyright Office | Federal registration separate from PRO | Prepare recording/composition application data, asset list, rights conflicts | Filing, fees, receipts, final status |
| Distributor | Digital delivery, master-side reporting per agreement | Prepare manifest, QA, export, status plan | Platform accepted, delivered, live, statements |

## Artist-facing experience
Ask the fewest questions needed to move safely. Show: **Release: 90% packaged; Rights: 2 items require answers; Publishing: 5 follow-up tasks assigned.** Do not conflate these percentages or represent guessed progress as fact.
