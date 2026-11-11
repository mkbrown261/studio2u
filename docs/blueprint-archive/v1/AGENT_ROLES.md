# Agent Workforce Specifications

Each role has: stable ID, persona/reference image, professional SOP/knowledge sources, allowed tools, denied tools, input/output schemas, task queue, evidence requirements, escalation rules, budget, audit and evaluation scorecard. Roles are logical workers, not necessarily continuously running models.

| Role | Expertise | Outputs | Boundaries / evaluation |
|---|---|---|---|
| Executive / Orchestrator | Label economics, A&R strategy, publishing/distribution basics, budgets, artist development, delegation | Strategic plans, assignments, budgets, approval requests, summaries | Cannot sign, pay, publish or file without authorization; measure task delivery and budget variance |
| A&R Researcher (woman with glasses/blue jacket, per user's role mapping) | Music scenes, drill variants, charts, regional trends, audience and emerging artists | Sourced discovery dossiers, requirements research, watchlists | No invented streams or unauthorized scraping; measure source quality and actionable findings |
| Producer / Builder (man holding tablet, per user's role mapping) | Creative operations, audio file formats, artwork, metadata, music/video provider tools | Organized assets, prepared masters, creative jobs, release packages | Not a generic software engineer; preserve originals; measure package integrity |
| Reviewer | Technical QC, metadata completeness, policy/rights checklist | Evidence-based PASS/FAIL/WARNING/NEEDS_HUMAN_REVIEW/NOT_TESTED reports | Must never approve unperformed checks or impersonate a lawyer; measure escaped defects |
| Catalog Manager | Composition vs master vs release metadata, identifiers, duplicate/version control | Structured catalog, inventories, cross-references | Never invent ISRC/ISWC/IPI/UPC; measure catalog consistency |
| Release Manager | Tracklists, distributor requirements, delivery specs, scheduling | Readiness checklists, release ZIP, delivery manifest | External submission only via approved integration and user authorization |
| Publishing Administrator | Writers, publishers, splits, PRO registration | ASCAP-ready work data, tracked status and receipts | Preparation != registration; verify official confirmation |
| Rights Administrator | Master/composition ownership, samples, agreements, US copyright registration basics | Rights matrix, missing-doc report, filing prep | Legal ambiguity escalated; no blanket free-registration claims |
| Marketing Manager | Campaign strategy, positioning, audiences, content calendar | Release campaigns, captions, briefs, performance summaries | No unauthorized posting or fabricated metrics |
| Creative Director / Content Producer | Short-form formats, storyboards, editing, provider orchestration | Video briefs, generation jobs, provenance and outputs | Use owned/licensed source footage; cost approvals |
| Social Media Manager | Platform-specific copy, posting formats, authorized scheduling, analytics | Drafts, scheduled posts, verified publishing receipts | No password-in-prompt, no prohibited browser automation |

## Shared operational pattern
1. Executive receives goal and creates a durable task graph.
2. Specialist retrieves current label data and trusted reference documents.
3. Tool calls pass schema validation, tenant auth, budget and policy checks.
4. Artifacts and evidence are stored; events stream to the 3D scene.
5. Reviewer applies deterministic tests and specialist review where needed.
6. Owner approves consequential actions; only then authorized connector executes.
7. Receipt/confirmation and audit event are stored.

## A&R discovery specification
Sources: authorized chart APIs/feeds, music discovery services, public official charts, licensed trend analytics, permitted social APIs, music blogs and local-scene sources. Per finding: artist, track, genre/subgenre, market, observed timestamp, URLs, verifiable metrics, momentum hypothesis, confidence, rights/availability caveats, next action. Distinguish chart performance from underground discovery and editorial assessment. Schedule optional watchlists after source connectors are verified.
