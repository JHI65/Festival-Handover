export const uid = () => Math.random().toString(36).slice(2, 9);

export function normalizeFest(f) {
  // Nuevo formato: days es { _stages: [...] }
  if (f.days && !Array.isArray(f.days) && Array.isArray(f.days._stages)) {
    return { ...f, stages: f.days._stages, log: f.days._log || [], roles: f.days._roles || {}, memberInfo: f.days._memberInfo || {}, isTemplate: f.days._isTemplate || false };
  }
  // Ya tiene stages (en memoria, tras normalizar)
  if (Array.isArray(f.stages)) return { ...f, log: f.log || [], roles: f.roles || {}, memberInfo: f.memberInfo || {}, isTemplate: f.isTemplate || false };
  // Legacy: days es array → migrar a un stage por defecto
  return { ...f, stages: [{ id: "stage_default", name: "ESCENARIO PRINCIPAL", days: Array.isArray(f.days) ? f.days : [] }], log: [], roles: {}, memberInfo: {}, isTemplate: false };
}

export function getUserRole(fest, userId) {
  if (!fest || !userId) return "viewer";
  if (fest.user_id === userId) return "owner";
  return fest.roles?.[userId] || "editor";
}

// Festival 24h sort: hours 00-05 are treated as "next day" (after midnight)
export function festTimeToMin(t) {
  if (!t) return Infinity;
  const [h, m] = t.split(":").map(Number);
  return (h < 6 ? h + 24 : h) * 60 + (m || 0);
}

export const noInfo = v => v === "?" ? "NO INFO" : v;

export function mkLog(userEmail, action, detail) {
  return { ts: new Date().toISOString(), user: userEmail || "?", action, detail: detail || "" };
}

export function withLog(fest, entry) {
  return { ...fest, log: [...(fest.log || []).slice(-999), entry] };
}

export function sigColor(s) {
  const t = (s || "").toUpperCase();
  if (t.includes("AES")) return "#2563eb";
  if (t.includes("MADI")) return "#ea580c";
  if (t.includes("OPTO")) return "#16a34a";
  if (t.includes("XLR")) return "#db2777";
  if (t.includes("RJ")) return "#7c3aed";
  return "#64748b";
}
