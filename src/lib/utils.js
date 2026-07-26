// IDs no adivinables: en HTTPS (siempre en la PWA) usa crypto.randomUUID(),
// que es criptográficamente seguro. Fallback con getRandomValues para navegadores
// antiguos. NUNCA Math.random() — era predecible y los ids de festival viajan en
// los enlaces de invitación, así que un id corto/adivinable era un riesgo de acceso.
export const uid = () => {
  try {
    if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
    const b = new Uint8Array(16);
    globalThis.crypto.getRandomValues(b);
    return Array.from(b, x => x.toString(16).padStart(2, "0")).join("");
  } catch {
    // Último recurso (entorno sin Web Crypto): mantener el formato previo
    return Math.random().toString(36).slice(2, 9) + Math.random().toString(36).slice(2, 9);
  }
};

// Nº máximo de cambios que se pueden deshacer (pila de rollback)
export const UNDO_LIMIT = 10;

export function normalizeFest(f) {
  // Nuevo formato: days es { _stages: [...] }
  if (f.days && !Array.isArray(f.days) && Array.isArray(f.days._stages)) {
    return { ...f, stages: f.days._stages, log: f.days._log || [], undo: f.days._undo || [], roles: f.days._roles || {}, memberInfo: f.days._memberInfo || {}, isTemplate: f.days._isTemplate || false };
  }
  // Ya tiene stages (en memoria, tras normalizar)
  if (Array.isArray(f.stages)) return { ...f, log: f.log || [], undo: f.undo || [], roles: f.roles || {}, memberInfo: f.memberInfo || {}, isTemplate: f.isTemplate || false };
  // Legacy: days es array → migrar a un stage por defecto
  return { ...f, stages: [{ id: "stage_default", name: "ESCENARIO PRINCIPAL", days: Array.isArray(f.days) ? f.days : [] }], log: [], undo: [], roles: {}, memberInfo: {}, isTemplate: false };
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

// Posiciones "abiertas" (con datos) dentro de un stage: FOH, cada posición de
// monitores y escenario. Usado para saltar directo a la sección del técnico.
export function stagePositions(stage) {
  if (!stage) return [];
  const positions = [];
  const totalArtists = (stage.days || []).reduce((a, d) => a + d.artists.length, 0);
  if (totalArtists > 0) positions.push({ kind: "foh", stageId: stage.id, label: "FOH" });
  (stage.monPositions || []).forEach(mp => positions.push({ kind: "mon", stageId: stage.id, monId: mp.id, label: mp.name }));
  const hasEscenario = (stage.escenario?.inputs?.length || 0) > 0 || (stage.escenario?.power?.length || 0) > 0;
  if (hasEscenario) positions.push({ kind: "escenario", stageId: stage.id, label: "ESCENARIO" });
  return positions;
}

export function festPositions(fest) {
  return (fest?.stages || []).flatMap(stagePositions);
}

export function isPositionValid(fest, pos) {
  if (!pos) return false;
  const stage = (fest?.stages || []).find(s => s.id === pos.stageId);
  if (!stage) return false;
  if (pos.kind === "foh") return (stage.days || []).reduce((a, d) => a + d.artists.length, 0) > 0;
  if (pos.kind === "mon") return (stage.monPositions || []).some(p => p.id === pos.monId);
  if (pos.kind === "escenario") return (stage.escenario?.inputs?.length || 0) > 0 || (stage.escenario?.power?.length || 0) > 0;
  return false;
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
