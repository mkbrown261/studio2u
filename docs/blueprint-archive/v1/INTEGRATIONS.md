# Integration Registry

**All statuses below are UNVERIFIED for this specific product as of this planning baseline.** An external service's existence does not establish access, API entitlements or permitted automation.

| Service | Intended use | Initial approach | Activation gate |
|---|---|---|---|
| Claude / other model APIs | Agent reasoning/tool invocation | Provider-neutral adapter | Verified API entitlement, secure keys, budgets |
| MCP-compatible clients | External agent tools | MCP server over shared domain services | Authentication and tool scope tests |
| Higgsfield | AI short-form video, promotional content | Creative Production Gateway adapter | Verify actual available actions, account/API permissions, commercial terms and costs |
| Suno | Optional music generation/production | Optional music-provider adapter | Verify official supported integration, rights and commercial permissions |
| ASCAP | Work registration preparation/status | Form-ready structured data first | Verify approved submission method; owner confirmation and official receipts |
| US Copyright Office | Federal registration preparation | Guided packet and fee/eligibility checks | Verified official workflow, legal review, authorized submission |
| UnitedMasters | Distribution prep and delivery | Distributor-ready export/handoff first | Verify approved API or authorized workflow; do not use passwords to bypass terms |
| Instagram/Meta | Artist pages, Reels, scheduling/insights | Drafts first; OAuth/API later | Verified scopes, account eligibility, API restrictions |
| TikTok | Short-form posting and analytics | Drafts first | Verified creator API access, scopes and review |
| YouTube | Shorts, channel publishing and analytics | Drafts first | OAuth, API scopes, quotas, platform policies |
| Spotify/Apple/charts | A&R research | Permitted feeds, official charts, licensed data | Access rights, rate limits, data provenance |
| SoundCloud/Bandcamp/blogs | Underground discovery | Permitted public sources or approved APIs | Terms and attribution verified |
| Storage | Originals and outputs | Tenant-scoped object storage | Access control, checksums, backup and restore tests |

Never put service passwords into agent system prompts. Prefer OAuth, scoped tokens and secure vaults. Browser-based operations require explicit provider permission, isolation, user consent and auditable steps; if unavailable, use guided manual handoff.
