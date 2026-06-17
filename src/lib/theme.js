import { createContext, useContext } from "react";

export const ThemeCtx = createContext({ dark: false, toggle: () => {} });
export const useTheme = () => useContext(ThemeCtx);

export const LT = { bg: "#F5EFE0", card: "#fff", card2: "#FAF6EE", border: "#D8CEB8", border2: "#EDE6D4", text: "#1A1410", text2: "#3D2B1F", text3: "#7A6652", text4: "#B0A090" };
export const DK = { bg: "#1A1410", card: "#261E18", card2: "#1A1410", border: "#3D2B1F", border2: "#261E18", text: "#F5EFE0", text2: "#D8CEB8", text3: "#B0A090", text4: "#7A6652" };

export function makeS(T) {
  return {
    app: { height: "100dvh", overflow: "hidden", background: T.bg, fontFamily: "'DM Sans',sans-serif", width: "100%", color: T.text },
    festCard: { display: "flex", alignItems: "center", gap: 12, background: T.card, border: `1px solid ${T.border}`, borderRadius: 4, padding: "14px 16px", marginBottom: 10, cursor: "pointer", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", borderLeft: `4px solid #C94A2A` },
    bigBtn: { width: "100%", padding: "18px", background: T.bg === DK.bg ? "#3D2B1F" : "#C94A2A", color: "#fff", border: "none", borderRadius: 4, fontSize: 16, fontWeight: 700, fontFamily: "'Bebas Neue',sans-serif", letterSpacing: "0.12em", cursor: "pointer", marginTop: 10 },
    iconBtn: { background: "none", border: "none", color: T.text4, fontSize: 20, cursor: "pointer", padding: "6px 8px" },
    backBtn: { background: T.card2, border: `1px solid ${T.border}`, color: T.text2, fontSize: 22, width: 44, height: 44, borderRadius: 4, cursor: "pointer", lineHeight: 1 },
    input: { width: "100%", background: T.card, border: `1px solid ${T.border}`, borderRadius: 4, color: T.text, fontSize: 16, padding: "13px 14px", fontFamily: "'DM Mono',monospace", outline: "none" },
    daySection: { background: T.card, border: `1px solid ${T.border}`, borderRadius: 4, padding: 16, marginBottom: 14 },
    artForm: { background: T.card2, border: `1px solid ${T.border}`, borderRadius: 4, padding: 14, marginBottom: 12 },
    addBtn: { width: "100%", padding: "14px", background: T.card2, border: `1px solid ${T.border}`, borderRadius: 4, color: T.text3, fontSize: 14, cursor: "pointer", fontFamily: "'DM Mono',monospace", marginTop: 8 },
    smBtn: { padding: "10px 16px", background: T.card2, border: `1px solid ${T.border}`, borderRadius: 4, color: T.text2, fontSize: 13, cursor: "pointer" },
    topBar: { display: "flex", alignItems: "center", gap: 10, padding: "10px 12px 8px", position: "sticky", top: 0, background: "#1A1410", zIndex: 10, borderBottom: `3px solid #C94A2A` },
    syncBtn: { background: "none", border: `1px solid #3D2B1F`, borderRadius: 4, color: "#B0A090", fontSize: 11, padding: "8px 11px", cursor: "pointer" },
    navBtn: { flex: 1, padding: "16px", background: T.card, border: `1px solid ${T.border}`, borderRadius: 4, color: T.text2, fontSize: 14, cursor: "pointer", fontFamily: "'DM Mono',monospace" },
  };
}
