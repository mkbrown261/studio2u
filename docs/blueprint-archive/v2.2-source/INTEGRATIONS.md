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

## v2 additions and explicit status rules
- **UnitedMasters-first customer flow:** prepare delivery-accurate metadata, rights checks, packaging and manual handoff by default; agent submission must not be promised without proven permitted provider method and official receipt.
- **ASCAP/BMI:** separate society-specific work-registration information from ISRC, UPC and federal copyright; prepare and track submissions; user-supervised browser option only if provider's current terms allow.
- **The MLC:** assess US digital mechanical registration/matching and existing administration; connect only via approved access.
- **SoundExchange:** assess qualifying master-side statutory digital performance rights for rights owner/featured performers; distinguish from interactive streams and PRO royalties.
- **Genjitsu:** proposed video editing adapter, **identity/capability/API terms not independently verified for product**. Local FFmpeg-based trim/reframe/caption export is fallback design, not implemented by this bundle.
- **n8n:** bounded workflow and notification tool, not master data store/authorization engine.
- **Tally:** artist onboarding/brief/intake forms with tenant-authorized webhooks and signed/validated input where supported.
- **Computer use/browser assistance:** user-authorized guided session only where provider permissions allow; see `BROWSER_ACCESS_SECURITY.md`.
- **Higgsfield:** planned production gateway provider with reference-photo/wardrobe-based videos if relevant authenticated API capabilities are actually available; independently validate account scopes, models, terms and cost before enabling.
- **Suno:** planned musical creativity provider; verify official permitted integration/commercial output conditions and preserve AI provenance. Unavailable != simulated.


## v2.1 connection and assisted-submission register
Add capabilities per provider: `API_READ`, `API_DRAFT`, `API_SUBMIT`, `MANUAL_PACKET_EXPORT`, `PERMITTED_BROWSER_VIEW`, `PERMITTED_BROWSER_PREFILL`, `USER_SITE_SUBMIT_REQUIRED`, `RECEIPT_LOOKUP`. Presence of credentials is not evidence of API permission. Record provider source, last-verified date, service scopes, costs, user action and status.

ASCAP/BMI/PRO: prepare accurate composition packet and owner approval; official site guided/manual path unless a specific authorized route is verified. UnitedMasters: prepare/review/deliver only through approved workflow; status receipt separate. SoundExchange/MLC: eligibility/claim-readiness and official account evidence; no speculative balance. Higgsfield: creative jobs after verifying intended account/API entitlement. Suno: authorized music generation conditional on commercial/ownership rules. Genjitsu: provider identity/API still requires capability verification; local editor fallback. Google Chrome/user desktop: tab-scoped voluntary viewing only where provider terms and technical controls permit; no unattended global screen access. n8n/Tally: optional bounded workflows and forms, not canonical DB/permission engine.

Every connection must state exactly which agent/skill needs which permissions and present supported versus manual alternatives in hire-agent onboarding.
