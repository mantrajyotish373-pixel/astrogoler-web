/**
 * Session summary shown to the astrologer when a session ends.
 *
 * The server is the source of truth for duration, price, earnings and platform fee. This helper
 * only EXTRACTS those numbers from whatever the server sent (the session:ended event, the REST end
 * response, or a legacy session document). Only if the server sent nothing usable (e.g. the
 * network failed) does it fall back to an estimate, which is marked `estimated: true`.
 */
export const formatDuration = (totalSeconds) => {
  const s = Math.max(0, Math.floor(Number(totalSeconds) || 0));
  const hrs = Math.floor(s / 3600);
  const mins = Math.floor((s % 3600) / 60);
  const secs = s % 60;
  const pad = (n) => n.toString().padStart(2, "0");
  return hrs > 0 ? `${pad(hrs)}:${pad(mins)}:${pad(secs)}` : `${pad(mins)}:${pad(secs)}`;
};

/** Find the server's final numbers in any of the payload shapes the backend uses. */
export const extractServerFinal = (...payloads) => {
  for (const p of payloads) {
    if (!p || typeof p !== "object") continue;
    const candidates = [p.final, p, p.session, p.data, p.data && p.data.final, p.data && p.data.session].filter(
      (o) => o && typeof o === "object"
    );
    for (const o of candidates) {
      const seconds = o.durationSeconds ?? o.totalDurationSeconds;
      const cost = o.totalCost ?? o.totalAmountDeducted;
      const isFinal = o.status === "COMPLETED" || o.settled === true || o.billingSettled === true;
      if (seconds === undefined || cost === undefined || !isFinal) continue;
      return {
        seconds: Number(seconds),
        cost: Number(cost),
        earnings: o.earnings ?? o.astrologerEarnings,
        platformFee: o.platformFee
      };
    }
  }
  return null;
};

export const buildSessionSummary = ({ clientName, type, payloads = [], fallbackSeconds = 0, ratePerMinute = 0 }) => {
  const f = extractServerFinal(...payloads);
  if (f) {
    const earnings = f.earnings !== undefined && f.earnings !== null ? Number(f.earnings) : Number((f.cost * 0.6).toFixed(2));
    const platformFee = f.platformFee !== undefined && f.platformFee !== null ? Number(f.platformFee) : Number((f.cost - earnings).toFixed(2));
    return {
      clientName,
      type,
      duration: formatDuration(f.seconds),
      totalDeducted: f.cost.toFixed(2),
      platformFee: platformFee.toFixed(2),
      earnings: earnings.toFixed(2),
      estimated: false
    };
  }

  // No final numbers from the server: an estimate, clearly marked
  const seconds = Math.max(0, Math.floor(Number(fallbackSeconds) || 0));
  const gross = Number((seconds * (Number(ratePerMinute) / 60)).toFixed(2));
  const earnings = Number((gross * 0.6).toFixed(2));
  return {
    clientName,
    type,
    duration: formatDuration(seconds),
    totalDeducted: gross.toFixed(2),
    platformFee: Number((gross - earnings).toFixed(2)).toFixed(2),
    earnings: earnings.toFixed(2),
    estimated: true
  };
};
