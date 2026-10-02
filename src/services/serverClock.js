/**
 * Server clock offset. The server is the only authority for session start/end times; the browser
 * clock is only used to tick between server messages. offset = clientNow - serverNow, learned from
 * any server message that carries `serverNow` (and refined by the `time:sync` probe).
 */
let offsetMs = 0;
let lastServerMs = 0;

/** Learn the offset from a server timestamp. Stale (older) timestamps are ignored. */
export const syncServerClock = (serverNow) => {
  if (!serverNow) return;
  const serverMs = typeof serverNow === "number" ? serverNow : new Date(serverNow).getTime();
  if (isNaN(serverMs) || serverMs < lastServerMs) return;
  lastServerMs = serverMs;
  offsetMs = Date.now() - serverMs;
};

/** Best estimate of the server's current time, in ms. */
export const serverNowMs = () => Date.now() - offsetMs;

/** Whole seconds elapsed since a server-authoritative start time. */
export const elapsedSince = (startedAt) => {
  if (!startedAt) return 0;
  const startMs = typeof startedAt === "number" ? startedAt : new Date(startedAt).getTime();
  if (isNaN(startMs)) return 0;
  return Math.max(0, Math.floor((serverNowMs() - startMs) / 1000));
};

/** Whole seconds until a server deadline (never negative). */
export const secondsUntil = (deadline) => {
  if (!deadline) return null;
  const ms = typeof deadline === "number" ? deadline : new Date(deadline).getTime();
  if (isNaN(ms)) return null;
  return Math.max(0, Math.ceil((ms - serverNowMs()) / 1000));
};
