// Appended to data-widget tool descriptions. The card shows the full result;
// the model answers in text only when the user asked for more than "show me".
// See server.ts "Presentation rule" for the umbrella guidance.
export const PRESENT_BRIEFLY =
  "PRESENTATION: the card shows the full result. If the user asked to show/list/see the " +
  "data, reply with at most one sentence. If the user asked for specific fields per item, " +
  "a written list, a comparison, a count, or which items match a condition, ANSWER IN TEXT " +
  "from structuredContent.rows (when truncated=true, say the card holds the complete set).";
