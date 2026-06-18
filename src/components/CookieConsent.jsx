import { useState } from "react";
import { setConsent } from "../lib/consent";

// Banner de consentimiento (RGPD/LSSI). Hoy la app solo usa almacenamiento
// NECESARIO, así que es informativo y honesto: no bloquea el uso. El toggle de
// "analítica" queda preparado para cuando se incorpore medición; de momento no
// carga ningún script.

const C = {
  card: "#1A1410",
  text: "#F5EFE0",
  muted: "#B0A090",
  faint: "#9A8772",
  accent: "#D4A843",
  border: "rgba(245,239,224,0.14)",
};

export default function CookieConsent({ onDecide, onOpenCookies }) {
  const [showPrefs, setShowPrefs] = useState(false);
  const [analytics, setAnalytics] = useState(false);

  function decide(opts) {
    setConsent(opts);
    onDecide?.();
  }

  return (
    <div style={{ position: "fixed", left: 0, right: 0, bottom: 0, zIndex: 1500, display: "flex", justifyContent: "center", padding: "0 12px calc(12px + env(safe-area-inset-bottom,0px))", pointerEvents: "none" }}>
      <div style={{ pointerEvents: "auto", width: "100%", maxWidth: 480, background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: "18px 18px 16px", boxShadow: "0 16px 50px rgba(0,0,0,0.6)", fontFamily: "'DM Sans',sans-serif" }}>
        {!showPrefs ? (
          <>
            <div style={{ fontSize: 13.5, color: C.muted, lineHeight: 1.55, marginBottom: 14 }}>
              Esta aplicación solo utiliza <strong style={{ color: C.text }}>almacenamiento técnico necesario</strong> para
              funcionar (sesión y preferencias). No usamos cookies de publicidad ni
              seguimiento. Consulta la{" "}
              <button onClick={onOpenCookies} style={{ background: "none", border: "none", padding: 0, color: C.accent, textDecoration: "underline", cursor: "pointer", fontSize: 13.5, fontFamily: "inherit" }}>
                Política de Cookies
              </button>.
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button onClick={() => decide({ analytics: true })} style={btn(C.accent, "#1A1410", true)}>Aceptar</button>
              <button onClick={() => decide({ analytics: false })} style={btn("transparent", C.text, false)}>Solo necesarias</button>
              <button onClick={() => setShowPrefs(true)} style={{ ...btn("transparent", C.faint, false), marginLeft: "auto" }}>Configurar</button>
            </div>
          </>
        ) : (
          <>
            <div style={{ fontSize: 15, fontFamily: "'Bebas Neue',sans-serif", color: C.text, letterSpacing: "0.04em", marginBottom: 12 }}>PREFERENCIAS</div>

            <Row title="Necesarias" desc="Sesión, idioma, tema y registro de consentimiento. Imprescindibles para que la app funcione." on disabled />
            <Row title="Analítica" desc="Medición de uso para mejorar la app. Actualmente no se utiliza." on={analytics} onToggle={() => setAnalytics(v => !v)} />

            <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
              <button onClick={() => decide({ analytics })} style={btn(C.accent, "#1A1410", true)}>Guardar</button>
              <button onClick={() => setShowPrefs(false)} style={btn("transparent", C.faint, false)}>Volver</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Row({ title, desc, on, disabled, onToggle }) {
  return (
    <div style={{ display: "flex", gap: 12, alignItems: "flex-start", padding: "10px 0", borderTop: `1px solid ${C.border}` }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, color: C.text, fontWeight: 700, fontFamily: "'DM Sans',sans-serif" }}>{title}</div>
        <div style={{ fontSize: 11.5, color: C.faint, lineHeight: 1.5, marginTop: 2 }}>{desc}</div>
      </div>
      <button onClick={disabled ? undefined : onToggle} disabled={disabled} aria-pressed={on} style={{
        flexShrink: 0, width: 44, height: 26, borderRadius: 999, border: "none", position: "relative",
        cursor: disabled ? "default" : "pointer", opacity: disabled ? 0.55 : 1,
        background: on ? C.accent : "rgba(245,239,224,0.2)", transition: "background .2s",
      }}>
        <span style={{ position: "absolute", top: 3, left: on ? 21 : 3, width: 20, height: 20, borderRadius: "50%", background: "#1A1410", transition: "left .2s" }} />
      </button>
    </div>
  );
}

const btn = (bg, color, solid) => ({
  padding: "10px 16px", borderRadius: 10, cursor: "pointer",
  fontFamily: "'DM Mono',monospace", fontSize: 12, fontWeight: 700, letterSpacing: "0.04em",
  background: bg, color, border: solid ? "none" : `1px solid ${C.border}`,
});
