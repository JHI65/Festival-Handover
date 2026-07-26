import { useTheme, LT, DK } from "../lib/theme";
import { useLang } from "../lib/i18n";
import { festPositions } from "../lib/utils";

const ICON = { foh: "🎛️", mon: "🎧", escenario: "🎪" };

function PositionSelectModal({ fest, onSelect, onClose }) {
  const { t } = useLang();
  const { dark } = useTheme(); const T = dark ? DK : LT;
  const positions = festPositions(fest);
  const multiStage = (fest.stages || []).length > 1;

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}
      onClick={onClose}>
      <div style={{ background: T.card, borderRadius: 20, padding: 28, width: "100%", maxWidth: 360, boxShadow: "0 8px 40px rgba(0,0,0,0.3)" }}
        onClick={e => e.stopPropagation()}>
        <div style={{ fontSize: 32, textAlign: "center", marginBottom: 12 }}>🧑‍🔧</div>
        <div style={{ fontSize: 16, fontFamily: "'Bebas Neue',sans-serif", color: T.text, textAlign: "center", letterSpacing: "0.04em", marginBottom: 8 }}>
          {t("¿En qué posición trabajas?")}
        </div>
        <div style={{ fontSize: 13, color: T.text3, textAlign: "center", marginBottom: 20, lineHeight: 1.5 }}>
          {t("La próxima vez entrarás directo a tu sección. Puedes cambiarla cuando quieras.")}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 14, maxHeight: "50vh", overflowY: "auto" }}>
          {(fest.stages || []).map(st => {
            const stPositions = positions.filter(p => p.stageId === st.id);
            if (stPositions.length === 0) return null;
            return (
              <div key={st.id}>
                {multiStage && (
                  <div style={{ fontSize: 10, color: T.text4, letterSpacing: "0.1em", fontFamily: "'DM Mono',monospace", margin: "6px 0 4px" }}>
                    {st.name}
                  </div>
                )}
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {stPositions.map(p => (
                    <button key={`${p.kind}-${p.monId || ""}`} onClick={() => onSelect(p)} style={{
                      display: "flex", alignItems: "center", gap: 10,
                      padding: "12px 16px", borderRadius: 12, fontSize: 14, fontFamily: "'Bebas Neue',sans-serif",
                      letterSpacing: "0.05em", cursor: "pointer", textAlign: "left",
                      border: `1.5px solid ${T.border}`, background: T.card2, color: T.text,
                    }}>
                      <span>{ICON[p.kind]}</span>
                      <span>{p.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
        <button onClick={onClose} style={{ width: "100%", padding: "12px", background: T.card2, border: `1px solid ${T.border}`, borderRadius: 12, fontSize: 13, cursor: "pointer", fontFamily: "'DM Mono',monospace", color: T.text2 }}>
          {t("Elegir más tarde")}
        </button>
      </div>
    </div>
  );
}

export default PositionSelectModal;
