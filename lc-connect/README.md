# LC Connect MCP

MCP server for the Laser Components B2B intelligence system.

## Current Status

This connector has been updated to match the current root Prisma schema and to use explicit tool-routing descriptions:

- Read-only lookup and analysis tools include `readOnlyHint: true`, `destructiveHint: false`, and `idempotentHint: true`.
- Write tools are marked non-read-only and non-idempotent.
- Destructive tools, such as deletes, are marked with `destructiveHint: true`.
- External AI or WhatsApp tools are marked with `openWorldHint: true`.
- Tool descriptions use `USE WHEN`, `DO NOT USE WHEN`, `REQUIRED FIELDS`, `RETURNS`, and `GOTCHAS` style guidance where relevant.

The connector currently lives under `archive/legacy-2026-05-28/lc-connect`. If it is meant to become active again, move it to a first-class connector path such as `connectors/lc-connect` and keep generated folders (`node_modules`, `dist`) out of source control.

## Setup

Install dependencies:

```bash
npm install
```

Generate Prisma client from the root project schema:

```bash
npm run prisma:generate
```

Build:

```bash
npm run build
```

Start:

```bash
npm start
```

## Tool Design Notes

Use lookup tools before write tools. Do not guess `productId`, `applicationId`, `leadId`, `regionId`, or `countryId`.

Use `find_workflow_guidance` and `read_workflow_guide` before multi-step workflows. These expose guidance as normal read-only tools so clients that do not reliably load MCP resources/prompts can still discover the workflow.

Large exports are still returned inline today. The next structural improvement should be dataset/widget handles for result sets larger than a small sample.
