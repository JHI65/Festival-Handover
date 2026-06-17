import { useTheme, LT, DK } from "../lib/theme";

function StageSelectModal({ stages, current, onSelect, onClose }) {
  const { dark } = useTheme(); const T = dark ? DK : LT;

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}
      onClick={onClose}>
      <div style={{ background: T.card, borderRadius: 20, padding: 28, width: "100%", maxWidth: 360, boxShadow: "0 8px 40px rgba(0,0,0,0.3)" }}
        onClick={e => e.stopPropagation()}>
        <div style={{ fontSize: 32, textAlign: "center", marginBottom: 12 }}>📍</div>
        <div style={{ fontSize: 16, fontFamily: "'Bebas Neue',sans-serif", color: T.text, textAlign: "center", letterSpacing: "0.04em", marginBottom: 8 }}>
          ¿En qué escenario trabajas?
        </div>
        <div style={{ fontSize: 13, color: T.text3, textAlign: "center", marginBottom: 20, lineHeight: 1.5 }}>
          Tus avisos de soundcheck se ajustarán a este escenario. Puedes cambiarlo cuando quieras.
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 14 }}>
          {stages.map(st => (
            <button key={st.id} onClick={() => onSelect(st.id)} style={{
              padding: "12px 16px", borderRadius: 12, fontSize: 14, fontFamily: "'Bebas Neue',sans-serif",
              letterSpacing: "0.05em", cursor: "pointer", textAlign: "left",
              border: `1.5px solid ${current === st.id ? "#C94A2A" : T.border}`,
              background: current === st.id ? "rgba(201,74,42,0.1)" : T.card2,
              color: T.text,
            }}>{st.name}</button>
          ))}
          <button onClick={() => onSelect("all")} style={{
            padding: "12px 16px", borderRadius: 12, fontSize: 13, fontFamily: "'DM Mono',monospace",
            cursor: "pointer", textAlign: "left",
            border: `1.5px solid ${current === "all" ? "#C94A2A" : T.border}`,
            background: current === "all" ? "rgba(201,74,42,0.1)" : "transparent",
            color: T.text3,
          }}>Todos los escenarios</button>
        </div>
        <button onClick={onClose} style={{ width: "100%", padding: "12px", background: T.card2, border: `1px solid ${T.border}`, borderRadius: 12, fontSize: 13, cursor: "pointer", fontFamily: "'DM Mono',monospace", color: T.text2 }}>
          Cerrar
        </button>
      </div>
    </div>
  );
}

export default StageSelectModal;
