import { useEffect, useState } from "react";
import { useTheme, LT, DK } from "../lib/theme";
import { isPushSupported, getPushSubscriptionStatus, subscribeToPush, unsubscribeFromPush } from "../lib/push";

function NotificationSettings({ userId, onClose }) {
  const { dark } = useTheme(); const T = dark ? DK : LT;
  const [supported] = useState(isPushSupported());
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(supported);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!supported) return;
    getPushSubscriptionStatus().then(setEnabled).finally(() => setLoading(false));
  }, [supported]);

  async function toggle() {
    setError("");
    setBusy(true);
    try {
      if (enabled) {
        await unsubscribeFromPush();
        setEnabled(false);
      } else {
        await subscribeToPush(userId);
        setEnabled(true);
      }
    } catch (err) {
      setError(err.message || "No se pudo actualizar la suscripción");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}
      onClick={onClose}>
      <div style={{ background: T.card, borderRadius: 20, padding: 28, width: "100%", maxWidth: 360, boxShadow: "0 8px 40px rgba(0,0,0,0.3)" }}
        onClick={e => e.stopPropagation()}>
        <div style={{ fontSize: 32, textAlign: "center", marginBottom: 12 }}>🔔</div>
        <div style={{ fontSize: 16, fontFamily: "'Bebas Neue',sans-serif", color: T.text, textAlign: "center", letterSpacing: "0.04em", marginBottom: 8 }}>
          Avisos de soundcheck
        </div>
        <div style={{ fontSize: 13, color: T.text3, textAlign: "center", marginBottom: 20, lineHeight: 1.5 }}>
          Recibe una notificación 30 min antes del soundcheck de cada artista del escenario en el que estés trabajando.
        </div>

        {!supported && (
          <div style={{ fontSize: 12, color: "#ef4444", textAlign: "center", marginBottom: 16 }}>
            Este navegador no soporta notificaciones push, o falta configurar la clave VAPID.
          </div>
        )}

        {supported && !loading && (
          <button onClick={toggle} disabled={busy} style={{
            width: "100%", padding: "14px", borderRadius: 12, fontSize: 14, fontWeight: 700,
            cursor: busy ? "default" : "pointer", fontFamily: "'DM Mono',monospace", border: "none",
            background: enabled ? "#ef4444" : "#16a34a", color: "#fff", opacity: busy ? 0.6 : 1, marginBottom: 10,
          }}>
            {busy ? "..." : enabled ? "Desactivar avisos" : "Activar avisos"}
          </button>
        )}
        {error && <div style={{ fontSize: 12, color: "#ef4444", textAlign: "center", marginBottom: 10 }}>{error}</div>}

        <button onClick={onClose} style={{ width: "100%", padding: "12px", background: T.card2, border: `1px solid ${T.border}`, borderRadius: 12, fontSize: 13, cursor: "pointer", fontFamily: "'DM Mono',monospace", color: T.text2 }}>
          Cerrar
        </button>
      </div>
    </div>
  );
}

export default NotificationSettings;
