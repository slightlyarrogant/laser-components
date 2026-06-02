import { EventEmitter } from "events";

/**
 * Lightweight session-event log + SSE emitter, ported from VendoConnect but
 * stripped of the Vendo transaction machinery (LC has no backend ERP and no
 * open/close transaction model). It powers the live `/session-log` view and
 * surfaces pending OAuth login links so the user can click through.
 */

export type SessionEventType = "open" | "tool" | "auth";

export interface SessionLogEvent {
  ts: number;
  sessionId: string;
  type: SessionEventType;
  detail: string;
}

const MAX_EVENTS = 500;
const recentEvents: SessionLogEvent[] = [];
export const logEmitter = new EventEmitter();

function emit(event: SessionLogEvent): void {
  if (recentEvents.length >= MAX_EVENTS) recentEvents.shift();
  recentEvents.push(event);
  logEmitter.emit("event", event);
}

export function getRecentEvents(): SessionLogEvent[] {
  return [...recentEvents];
}

export function recordToolCall(sessionId: string, detail: string): void {
  emit({ ts: Date.now(), sessionId, type: "tool", detail });
}

export function emitAuthRequest(loginUrl: string): void {
  emit({ ts: Date.now(), sessionId: "auth", type: "auth", detail: loginUrl });
}
