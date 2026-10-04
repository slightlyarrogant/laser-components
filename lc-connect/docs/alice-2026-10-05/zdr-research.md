# AI assistants: training, retention, ZDR and EU residency (research 2026-10-04)

Scope: what a mid-sized German manufacturer actually gets when it buys an AI assistant subscription.
Legend: **[default]** = vendor default, no action needed · **[setting]** = admin toggle/config · **[contract]** = needs sales approval / signed addendum.
Note: an MCP connector (e.g. LC Connect) changes nothing in this table. Retention is decided by the assistant subscription that sends the prompt, not by the connector. LC Connect's own outbound call goes to Perplexity `/chat/completions` (`lc-connect/src/tools/ai.ts:76`), which is the endpoint covered by Perplexity's stated API ZDR.

## 1. Slide table

| Vendor · Plan | Trained on your data? | Retention default | ZDR | EU residency |
|---|---|---|---|---|
| Anthropic · Claude Team | No [default] | Chats kept until the user deletes them; backend copy deleted ≤30 days after that. No custom retention | No (Team UI not ZDR-eligible) | No (storage is US only) |
| Anthropic · Claude Enterprise | No [default] | Kept indefinitely unless the admin sets a custom period (minimum 30 days) [setting] | Only for Claude Code on Enterprise [contract]; chat UI not eligible | No native EU. Inference is `us`/`global`, storage US only |
| Anthropic · Claude API | No [default] | Deleted ≤30 days (privacy center). Fable 5/5.1 and Mythos 5/5.1 ("Covered Models"): mandatory 30 days since 9 Jun 2026 | Yes [contract], per org, Messages API only. Not available on Covered Models unless Anthropic authorises it. "EFS" replacement rolling out from autumn 2026 | Via AWS Bedrock / Google Vertex EU regions only |
| OpenAI · ChatGPT Business (ex-Team) | No [default] | Admin controls retention [setting]; deleted chats purged ≤30 days | No | Not listed (Enterprise/Edu/API only) |
| OpenAI · ChatGPT Enterprise | No [default] | Admin-configurable [setting]; deleted chats purged ≤30 days | No ZDR for the ChatGPT UI (ZDR is API-only) | Yes, EEA+CH at rest, new workspaces [setting at setup] |
| OpenAI · API | No [default] | Abuse logs up to 30 days | Yes, by request [contract]; not for Assistants/Threads/Conversations/Vector Stores/Fine-tuning/Evals/Batch | Yes, Europe projects; requires ZDR/MAM/"Modified Retention" amendment [contract] |
| Microsoft · M365 Copilot (now "Microsoft Copilot") | No [default] | Prompts and responses stored in the tenant (Exchange) and governed by Purview retention policies [setting]; default Copilot retention policies switched on 17 Jun 2026 (secondary source) | No ZDR concept. Logging is the design. Human abuse review is opted out | Yes, EU Data Boundary. BUT Flex Routing (inference outside EU at peak) on by default since 17 Apr 2026, and Anthropic models excluded from EUDB (off by default in EU) |
| Microsoft · Azure OpenAI / Foundry | No [default] | Flagged prompts stored for abuse review in the customer's geography (historically "up to 30 days", see section 4) | "Modified abuse monitoring" by application [contract] → no storage, no human review | Yes (EU region / EU DataZone) |
| xAI · Grok Business / Enterprise / API | No [default] | API: 30 days encrypted, then deleted. Business/Enterprise app: vendor says ~30 days | API: yes, admin toggle in xAI Console [setting] (some Enterprise contracts differ) | No EU endpoint documented (US endpoint only) |
| Perplexity · Enterprise Pro / Max | No [default] | Admin-set retention (Pro ≥50 seats or any Max seat) [setting]; files ~7 days | No ZDR for the app documented | Not documented |
| Perplexity · Sonar API (Chat Completions) | No [default] | None: prompts/responses not retained, only billing metadata [default] | Yes, by default (stated for Chat Completions) | Not documented |
| Google · Workspace Gemini / Vertex AI | No [default] | Workspace: within the org per admin settings. Vertex: 24 h in-memory cache plus abuse logging | Vertex: yes, disable caching + abuse-logging exemption [setting + contract] | Yes, Workspace data regions EU [setting]; Vertex EU regions |

## 2. What to tell the customer (≤120 words)

To keep company data out of model training, nobody on a consumer account (Free/Plus/Pro). Every business plan above (Claude Team/Enterprise, ChatGPT Business/Enterprise, Microsoft Copilot, Grok Business, Perplexity Enterprise, Gemini for Workspace) has "no training" as the default. Business plans still store prompts: chat history stays until it is deleted or a retention period expires, and the backend often keeps copies for up to 30 days. Zero data retention is a separate option, mostly for APIs, usually agreed with sales, and never part of the chat apps (Microsoft does not offer it at all). For data residency, check two things: where data is stored at rest, and where inference runs. Our connector adds no extra retention.

## 3. Sources (accessed 2026-10-04)

Anthropic
- Commercial retention ("within 30 days"), updated 2026-07-01: https://privacy.claude.com/en/articles/7996866-how-long-do-you-store-my-organization-s-data
- API and data retention (ZDR scope, Team/Enterprise UI not eligible, Covered Models): https://platform.claude.com/docs/en/manage-claude/api-and-data-retention (live doc, 2026)
- Covered Models 30-day retention, effective 2026-06-09: https://support.claude.com/en/articles/15425996-data-retention-practices-for-covered-models
- Enterprise Frontier Safeguards, 2026-09-01: https://www.anthropic.com/news/enterprise-frontier-safeguards
- Data residency (`inference_geo` us/global; workspace geo us only): https://platform.claude.com/docs/en/manage-claude/data-residency (live doc, 2026)
- Enterprise custom retention (indefinite by default, minimum 30 days, Enterprise only): https://support.claude.com/en/articles/10440198-custom-data-retention-controls-for-claude-enterprise (updated ~Sep 2026)
- ZDR product scope: https://privacy.claude.com/en/articles/8956058-i-have-a-zero-data-retention-agreement-with-anthropic-what-products-does-it-apply-to
- Consumer terms change (opt-in training, 5-year retention, excludes Claude for Work/API/Bedrock/Vertex), 2025-08-28 (**>12 months old**, still the reference): https://www.anthropic.com/news/updates-to-our-consumer-terms

OpenAI
- API data controls (30-day abuse logs, ZDR-ineligible endpoints, Europe residency prerequisites): https://developers.openai.com/api/docs/guides/your-data (live doc, 2026)
- ZDR with Private Safety Processing: https://developers.openai.com/api/docs/guides/private-safety-processing (2026; see also Axios 2026-08-19)
- Business data privacy (no training on Business/Enterprise/Edu/API by default): https://openai.com/business-data/ (vendor page; returned 403 to fetch, content via search snippet)
- Enterprise privacy: https://openai.com/enterprise-privacy/ (403 to fetch)
- Data residency in Europe, 2025-02-06 (**>12 months**): https://openai.com/index/introducing-data-residency-in-europe/ ; expansion: https://openai.com/index/expanding-data-residency-access-to-business-customers-worldwide/ (date not verified)
- NYT preservation order (consumer Free/Plus/Pro/Team and non-ZDR API in scope; Enterprise, Edu and ZDR API exempt; ended 2025-09-26): https://openai.com/index/response-to-nyt-data-demands/ (**2025, >12 months**; 403 to fetch, confirmed via secondary sources)

Microsoft
- Data, Privacy and Security for Microsoft Copilot (no training; prompts stored in tenant; Purview retention; EUDB; Anthropic excluded from EUDB; abuse monitoring opted out), ms.date 2026-07-09, updated 2026-09-30: https://learn.microsoft.com/en-us/microsoft-365/copilot/microsoft-365-copilot-privacy
- AI models in Microsoft Online Services (hosted / subprocessor / independent processor), 2026-09-10: https://learn.microsoft.com/en-us/microsoft-365/copilot/ai-models-overview
- Flex Routing MC1269223, on by default for EU from 2026-04-17 (secondary): https://changepilot.cloud/blog/microsoft-365-copilot-flex-routing-eu-data-boundary-mc1269223
- Azure/Foundry data privacy, 2026-05-18: https://learn.microsoft.com/en-us/azure/ai-foundry/responsible-ai/openai/data-privacy
- Azure/Foundry abuse monitoring and modified abuse monitoring, 2026-05-13: https://learn.microsoft.com/en-us/azure/ai-foundry/openai/concepts/abuse-monitoring
- Consumer Copilot training opt-out, EEA excluded, 2024-08-16 (**>12 months**): https://www.microsoft.com/en-us/microsoft-copilot/blog/2024/08/16/transparency-and-control-in-consumer-data-use/
- Kimi K3 in GitHub Copilot (hosted by GitHub on Fireworks AI; off by default for Business/Enterprise), 2026-08-06: https://github.blog/changelog/2026-08-06-kimi-k3-is-now-available-in-github-copilot/
- Kimi K2.7 Code in GitHub Copilot, 2026-07-01: https://github.blog/changelog/2026-07-01-kimi-k2-7-is-now-available-in-github-copilot/
- Report that Microsoft is evaluating Kimi K3 for Copilot (unconfirmed), 2026-07-21: https://www.digitimes.com/news/a20260721PD239/microsoft-copilot-moonshot-anthropic-openai.html
- Kimi K3 on Microsoft Foundry via Fireworks AI (Azure post, late Jul 2026): https://www.neowin.net/amp/kimi-k3-model-is-now-deployable-on-microsoft-foundry-through-fireworks-ai/

xAI
- API security FAQ (30-day retention, no training, ZDR toggle, US endpoint): https://docs.x.ai/developers/faq/security (live doc, 2026)
- Grok Business/Enterprise launch (no training; Enterprise Vault, CMK): https://www.eweek.com/news/elon-musk-grok-business-enterprise-offerings/ (secondary, ~Jan 2026)
- Grok Build over-collection incident, 2026-07-14: https://www.axios.com/2026/07/14/spacexai-grok-customer-data

Perplexity
- API privacy & security ("We do not retain data sent through the Chat Completions API… do not use customer data to train"): https://docs.perplexity.ai/docs/resources/privacy-security (live doc, undated)
- Enterprise retention/training (help center returned 403; via secondary): https://www.perplexity.ai/help-center/en/articles/11564572-data-collection-at-perplexity ; https://www.strac.io/blog/perplexity-data-privacy (2026)

Google
- Workspace with Gemini FAQ (no training, no human review): https://knowledge.workspace.google.com/admin/gemini/gemini-for-google-workspace-faq
- Gemini app data regions, 2026-06: https://workspaceupdates.googleblog.com/2026/06/gemini-app-data-regions-support.html
- Vertex AI ZDR: https://docs.cloud.google.com/vertex-ai/generative-ai/docs/vertex-ai-zero-data-retention (fetch returned no body; details via secondary sources)

## 4. Microsoft and the "Chinese model" claim

- **Refuted for Microsoft 365 Copilot.** Microsoft's official model page (2026-09-10) names only Microsoft-hosted models (Azure OpenAI and similar), Anthropic and OpenAI as subprocessors, and admin-enabled independent processors. It does not mention Kimi or Moonshot. Microsoft says any model change that affects data processing commitments is announced in Message Center.
- **What is true:** (1) **GitHub Copilot**, a separate developer product, offers Moonshot's open-weight Kimi K2.7 Code (GA 2026-07-01, deprecated 2026-10-02) and Kimi K3 (GA 2026-08-06). Both are hosted by GitHub on Fireworks AI, not in China, and disabled by default for Business/Enterprise orgs. (2) Kimi K3 can be deployed on **Microsoft Foundry** via Fireworks AI (Azure, late July 2026). (3) Press reports from 2026-07-21 (Digitimes and others) say Microsoft was *evaluating* Kimi K3 to cut Copilot inference costs. Microsoft has not confirmed this.
- The accurate wording is: "Open-weight Kimi models are opt-in in GitHub Copilot and Foundry. Microsoft 365 Copilot does not use them according to Microsoft's documentation."

## 5. Uncertain / could not verify

- **Anthropic API default retention wording conflicts.** The privacy center (2026-07-01) says "deleted within 30 days". The developer docs say conversation content is "not retained by default" except for Covered Models. The table uses ≤30 days, the conservative reading.
- **Claude Team chat retention.** No Team-specific article was found. The table assumes "kept until the user deletes, backend ≤30 days" because custom retention is Enterprise-only.
- **Anthropic interim ZDR on Fable 5/5.1.** The EFS announcement says eligible customers get it until EFS ships. Eligibility and rollout dates are not public.
- **Azure abuse-monitoring "30 days".** The current Foundry pages (May 2026) no longer state a number. Older versions said "up to 30 days". Verify in the DPA/Product Terms before quoting.
- **M365 Copilot default retention policies switched on 17 Jun 2026.** This comes only from a secondary source (search snippet) and was not confirmed on Microsoft Learn.
- **Consumer Microsoft Copilot in the EEA.** The no-training statement for the EEA dates from Aug 2024. Whether it changed in 2025–26 was not verified.
- **OpenAI ChatGPT Business EU residency.** Official pages list Enterprise/Edu/API only. openai.com and help.openai.com returned 403, so the dates of the expansion post and the details of "inference residency" were not checked.
- **OpenAI NYT order.** Dates and exemptions come from secondary sources quoting OpenAI, because the vendor page returned 403. The order ended 2025-09-26. April–September 2025 data in scope is still under legal hold.
- **xAI Business/Enterprise app retention ("~30 days") and EU residency.** Only secondary sources were found. xAI's docs show a US endpoint only, and EU coverage needs contractual confirmation.
- **Perplexity.** The ZDR statement names only the Chat Completions API (which LC Connect uses); the Agent API and Search API are not covered by that text. Enterprise retention figures (7-day files, admin retention threshold) come from secondary sources because the help center returned 403. No EU residency statement was found.
- **Google Vertex.** The caching (24 h) and abuse-logging retention figures come from secondary sources, because the official ZDR page did not render. The Workspace Gemini app's default conversation retention was not verified.
