// Appended to data-widget tool descriptions. The card shows the full result;
// the model answers in text only when the user asked for more than "show me".
// See server.ts "Presentation rule" for the umbrella guidance.
// One-call rule: a real claude.ai run issued one search_leads per company
// (hunting for an empty location field) and stalled. Keep this short.
export const ONE_CALL_RULE =
  "ONE CALL: one filtered call answers a list question. Never call a lead tool once per " +
  "company. A field that is empty in the rows (e.g. location) is simply not recorded — " +
  "write 'not recorded' and move on; do not search again for it.";

export const PRESENT_BRIEFLY =
  "PRESENTATION: the card shows the full result. If the user asked to show/list/see the " +
  "data, reply with at most one sentence. If the user asked for specific fields per item, " +
  "a written list, a comparison, a count, or which items match a condition, ANSWER IN TEXT " +
  "from the rows listed in the tool result text (when it ends with \"total N · shown M\", say the card holds the complete set).";

// Long-running AI tools. claude.ai allows ~240 s per tool call, ChatGPT ~60 s;
// a multi-area enrichment can exceed both, so it runs as a background job.
export const SLOW_AI_RULE =
  "Run one at a time; do not fan out across many leads or products in one turn.";

export const LONG_JOB_RULE =
  "JOBS: when a tool returns a job id, tell the user in one sentence that it is running and " +
  "the expected time, then stop. Do not poll in a loop; check get_enrichment_status only when " +
  "the user asks or at the next turn.";
