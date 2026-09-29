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
