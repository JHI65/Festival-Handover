import { useTheme, LT, DK } from "../lib/theme";

function ChainBox({ label, value, color, big }) {
  return (
    <div style={{ flex: big ? 1.4 : 1, background: "#f8fafc", border: `1px solid ${color}30`, borderRadius: 10, padding: "9px 7px", textAlign: "center", minWidth: 0 }}>
      <div style={{ fontSize: 8, color: "#94a3b8", letterSpacing: "0.1em", marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 11, color, fontFamily: "monospace", fontWeight: 700, wordBreak: "break-word", lineHeight: 1.3 }}>{value}</div>
    </div>
  );
}

function ChainArrow({ color }) {
  return (
    <div style={{ display: "flex", alignItems: "center", padding: "0 2px", gap: 2 }}>
      <div style={{ width: 10, height: 1, background: `${color}55`, borderRadius: 1 }} />
      <div style={{ width: 4, height: 4, borderRadius: "50%", background: `${color}55` }} />
      <div style={{ width: 10, height: 1, background: `${color}55`, borderRadius: 1 }} />
    </div>
  );
}

function RouteChip({ icon, label, value, color }) {
  const { dark } = useTheme(); const T = dark ? DK : LT;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, background: `${color}${dark ? "22" : "0d"}`, border: `1px solid ${color}${dark ? "55" : "30"}`, borderRadius: 10, padding: "9px 12px" }}>
      <span style={{ fontSize: 15 }}>{icon}</span>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 8, color, letterSpacing: "0.15em", fontWeight: 700 }}>{label}</div>
        <div style={{ fontSize: 12, color: T.text2, fontFamily: "monospace", lineHeight: 1.4, wordBreak: "break-word" }}>{value}</div>
      </div>
    </div>
  );
}

export { ChainBox, ChainArrow, RouteChip };
