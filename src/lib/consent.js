// Gestión del consentimiento de cookies/almacenamiento (RGPD art. 7 + LSSI art. 22).
// Guarda la elección del usuario con marca de tiempo y versión, como prueba de
// consentimiento. Hoy la app solo usa almacenamiento técnico NECESARIO (sesión,
// idioma, tema), así que "necessary" siempre va activo; "analytics" queda
// preparado para el futuro (no carga nada todavía).

import { CONSENT_VERSION } from "./legalData";

const KEY = "cookieConsent";

export function getConsent() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const c = JSON.parse(raw);
    // Si la versión del texto cambió, el consentimiento anterior ya no vale.
    if (c.version !== CONSENT_VERSION) return null;
    return c;
  } catch {
    return null;
  }
}

export function setConsent({ analytics = false }) {
  const c = {
    necessary: true,            // técnico, no se puede desactivar
    analytics: !!analytics,
    version: CONSENT_VERSION,
    ts: new Date().toISOString(),
  };
  try { localStorage.setItem(KEY, JSON.stringify(c)); } catch { /* noop */ }
  return c;
}

export function hasDecided() {
  return getConsent() !== null;
}
