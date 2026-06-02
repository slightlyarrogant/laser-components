// Seed foundational domain knowledge resources for LC Connect.
// Safe to re-run — checks for existing slugs before inserting.
import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL } } })

// ---------------------------------------------------------------------------
// Resource definitions
// ---------------------------------------------------------------------------

const resources = [
  {
    slug: 'supply_chain_positioning',
    title: 'Supply Chain Positioning — Core Rule',
    category: 'knowledge',
    content: `Laser Components targets customers who are 2-3 steps BEFORE final product manufacturers in the supply chain.

Supply Chain Position:
[Laser Components] → [Component Integrators] → [Board Manufacturers] → [System Integrators] → [Final Product Manufacturers] → [End Users]
                      ↑ TARGET CUSTOMERS ↑      ↑ TARGET CUSTOMERS ↑

## Correct Targets
- Board manufacturers who integrate laser components into sub-assemblies
- Component integrators who build LIDAR sensor modules
- Suppliers who manufacture laser-based measurement systems for OEMs
- Contract manufacturers who assemble laser-based devices
- Optical assembly manufacturers who supply to LIDAR makers
- Component integration houses that build laser emitter modules

## Incorrect Targets
- Automotive manufacturers (end product makers)
- Consumer electronics brands (too far downstream)
- Final system integrators who only package complete solutions
- End users or retailers
- Complete LIDAR system makers (e.g. Velodyne, Luminar)

## Concrete Example — Automotive LIDAR
DO NOT target: Tesla, BMW, Ford (final car manufacturers)
DO NOT target: Velodyne, Luminar (complete LIDAR system makers)
DO target: Companies that supply circuit boards to Velodyne
DO target: Optical assembly manufacturers who supply to LIDAR makers
DO target: Component integration houses that build laser emitter modules

## Why This Matters
Laser Components is a component supplier. The value proposition is highest with companies that incorporate our components into products they sell upstream, not companies assembling the final consumer product.`,
  },
  {
    slug: 'target_customer_criteria',
    title: 'Target Customer Criteria',
    category: 'knowledge',
    content: `Criteria for qualifying a company as a lead for Laser Components.

## Company Profile
- Preferred size: 20–500 employees
- Must be actively operating (not defunct, not dormant)
- Requires verifiable industry presence: website, trade publications, recent news

## Company Types — Qualify
- Component integrators: companies that buy laser components and integrate them into sub-assemblies
- Board manufacturers: PCB/module manufacturers that incorporate laser diodes, APDs, drivers
- Suppliers to larger manufacturers (OEM suppliers, tier-2 suppliers)
- Contract manufacturers specialising in photonics, laser, or optoelectronics
- Research institutes and companies developing laser-based instrumentation for commercial sale

## Company Types — Disqualify
- Consulting companies (no purchasing intent for components)
- Final system integrators who only package complete solutions
- Pure distributors (they buy finished products, not components)
- End users and retailers
- Companies larger than 5,000 employees unless there is a specific division that matches

## Geographic Relevance
- Company must have headquarters OR significant manufacturing/R&D operations in target region
- A small sales office in the region does not qualify
- Export-oriented companies in nearby regions may qualify if they supply into the target region`,
  },
  {
    slug: 'lead_scoring_guide',
    title: 'Lead Scoring Guide',
    category: 'scoring',
    content: `How to evaluate and score lead quality for Laser Components.

## Scoring Dimensions (in order of importance)

### 1. Supply Chain Position (most important)
- Clearly 2-3 steps before final manufacturer: HIGH
- Ambiguous position (could be integrator or system maker): MEDIUM
- Final system maker or end user: DISQUALIFY

### 2. Technical Fit
- Product specifications directly match what the company needs: HIGH
- Some overlap but not a perfect match: MEDIUM
- No apparent technical fit: LOW

### 3. Company Activity & Viability
- Active website, recent news, findable contacts: HIGH
- Website exists but little recent activity: MEDIUM
- No verifiable online presence: LOW / DISQUALIFY

### 4. Geographic Presence
- HQ or manufacturing in target region: HIGH
- Significant R&D or sales operations in region: MEDIUM
- Only marginal presence: LOW

### 5. Company Size
- 20–500 employees: HIGH
- 500–2,000 employees: MEDIUM
- <20 or >2,000: LOW (review case by case)

### 6. Reachability
- Direct email or contact form available: HIGH
- Company name and location only: MEDIUM
- No contact information found: LOW

## Overall Score
HIGH × 4+ dimensions = Priority lead
HIGH × 2–3 dimensions = Standard lead
Mostly MEDIUM = Prospect (may need enrichment)
Any DISQUALIFY dimension = Remove from pipeline`,
  },
  {
    slug: 'research_methodology',
    title: 'Sales Research Methodology',
    category: 'knowledge',
    content: `The standard workflow for identifying potential B2B customers for Laser Components.

## Process Flow
1. Product Discovery → 2. Application Research → 3. Application Grouping → 4. Company Identification → 5. Lead Creation → 6. Learning Capture

## Step 1: Product Discovery
- Query the database for all products in the specified category
- Note key specifications (wavelength, power, package type) — these determine which companies need the product
- Tools: get_products, search_products

## Step 2: Application Research (per product)
- For each product, identify industrial use cases where that specification matters
- Tools: discover_applications, analyze_product_market, get_product_applications
- Output: list of applications per product

## Step 3: Application Grouping
- Group products by shared applications to avoid duplication
- Example groups: Automotive LIDAR (multiple products), Defense Rangefinding, Medical Diagnostics, Telecom
- Identify which products serve multiple applications

## Step 4: Company Identification (per application cluster, per region)
- Focus: who SUPPLIES TO the system integrators, not the integrators themselves
- Search for: board manufacturers for [application], component suppliers to [system maker], optical module manufacturers
- Tools: analyze_competition, generate_insights

## Step 5: Lead Creation
- Store qualified companies as leads with: name, productId, applicationId, industry, description, tags
- Tag format: [region, category, application, research-YYYY-MM]
- Tools: create_lead, batch_create_leads
- Skip duplicates (skipDuplicates: true)

## Step 6: Learning Capture
- Document: applications discovered, leads per application, geographic patterns, quality notes
- Save insights with save_learning tool
- Update methodology resources if new patterns found

## Research Depth Guidelines
- Quick scan (5–10 products): 2–3 applications per product, surface identification
- Standard research (10–30 products): detailed analysis, 5–10 leads per cluster
- Deep research (30+ products): competitive landscape, 10+ leads per cluster, enrichment + scoring

## Documentation Standards
Every research session must capture:
- Methodology used, assumptions made, confidence level, date, tags for retrieval`,
  },
  {
    slug: 'sales_objection_responses',
    title: 'Sales Objection Responses',
    category: 'sales',
    content: `Common objections when demonstrating LC Connect to sales teams, and how to respond.

## "This is the same as ChatGPT"
Response: Run a direct comparison test. Ask ChatGPT about specific laser component SKUs or ask it to identify board manufacturers supplying to LIDAR makers in Austria — it cannot. LC Connect has 245 LC products in its database, understands supply chain positioning, and learns from corrections. ChatGPT does not know your inventory and cannot remember that Velodyne suppliers are better targets than Velodyne itself.

## "How do I know the data is accurate?"
Response: You verify it interactively. Ask the system for a company, go to their website, check the fit. If something is wrong, correct it — and the system remembers. Unlike a static spreadsheet, LC Connect improves with each correction. Accuracy increases over time.

## "Is this GDPR compliant / RODO?"
Response: B2B company data (company name, address, industry, website) is not personal data under GDPR/RODO. We are identifying companies, not tracking individuals. No personal data is stored without consent.

## "What about hallucinations?"
Response: Ask the system to explain its reasoning. If a suggested company seems odd, ask why it was chosen — the reasoning is transparent. When you find an error, correct it and use save_learning. The correction is stored and applied to future sessions. Over time, hallucinations are corrected out of the system.

## "Our CRM already does this"
Response: CRMs manage contacts you already have. LC Connect finds companies you don't know yet, positioned specifically in your supply chain tier. It also understands laser component applications — a generic CRM cannot distinguish between a company that uses lasers and a company that manufactures laser sub-components.

## "We don't have time to learn a new tool"
Response: The interface is a conversation. No training needed. A sales rep asks in natural language, gets structured results, and stores leads with one command. Onboarding takes minutes.`,
  },
  {
    slug: 'session_instructions',
    title: 'Session Instructions (AI Behaviour)',
    category: 'knowledge',
    content: `You are an AI assistant connected to LC Connect — the Laser Components B2B intelligence system.

At the start of each session, read all active resources to load domain knowledge.

## Learning Protocol

Suggest save_learning when the user explicitly wants the connector to remember something reusable, or when the conversation produces a correction that should be reviewed later:
- A user corrects your suggestion (event_type: correction)
- A user confirms an unusual or non-obvious approach (event_type: confirmation)
- You learn something new about a company, region, or market (event_type: new_insight)
- A user flags something as wrong or outdated (event_type: flag)
- You discover a regional pattern worth remembering (event_type: regional_note)

Do not call save_learning for casual conversation or every minor observation; it is a write action and may require confirmation. When saving, include the full context of what was said so future sessions understand why. Suggested updates remain pending review and must be applied explicitly with update_resource.

## Supply Chain Awareness
Always apply supply chain positioning when identifying leads. Target companies 2-3 steps before final manufacturers, not the final manufacturers themselves. If you find yourself suggesting Tesla or BMW as leads, stop — those are end product makers.

## Quality Over Quantity
It is better to suggest 5 well-qualified leads than 20 questionable ones. Explain your reasoning for each lead. If you are uncertain about a company's supply chain position, say so explicitly.

## Regional Sensitivity
What works for Germany may not work for Brazil. Regional market structures differ. When entering a new region, use list_resources to check whether a region-specific resource exists before applying generic criteria.

## Conversation Style
- Be direct and specific. Avoid hedging unless genuinely uncertain.
- When uncertain, say: "I'm not certain — here's my reasoning, please correct if wrong."
- When corrected, acknowledge, apply save_learning immediately, then continue with the corrected approach.`,
  },
]

// ---------------------------------------------------------------------------
// Seed execution
// ---------------------------------------------------------------------------

async function main() {
  console.log('Seeding knowledge resources...\n')
  let created = 0
  let skipped = 0

  for (const r of resources) {
    const existing = await prisma.resource.findUnique({ where: { slug: r.slug } })

    if (existing) {
      console.log(`  SKIP  ${r.slug} (already exists, version ${existing.version})`)
      skipped++
      continue
    }

    await prisma.resource.create({
      data: {
        slug: r.slug,
        title: r.title,
        content: r.content,
        category: r.category,
      },
    })

    console.log(`  CREATE ${r.slug}`)
    created++
  }

  console.log(`\nDone. Created: ${created}, Skipped: ${skipped}`)
}

main()
  .catch((err) => {
    console.error('Seed failed:', err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
