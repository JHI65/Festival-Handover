import { useState } from "react";
import { useTheme, LT, DK, makeS } from "../lib/theme";
import { useLang } from "../lib/i18n";
import { festTimeToMin } from "../lib/utils";

function HorarioPill({ label, start, end, color, bg, border, T }) {
  const hasTime = start || end;
  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4,
      background: hasTime ? bg : T.card2,
      border: `1px solid ${hasTime ? border : T.border}`,
      borderRadius: 4, padding: "10px 24px", width: "100%",
    }}>
      <span style={{ fontSize: 9, letterSpacing: "0.18em", color: hasTime ? color : T.text4, fontFamily: "'DM Mono',monospace", textTransform: "uppercase" }}>{label}</span>
      {hasTime ? (
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 22, color, fontFamily: "'DM Mono',monospace", letterSpacing: "0.04em" }}>{start || "—"}</span>
          {end && <><span style={{ fontSize: 14, color: T.text4 }}>→</span><span style={{ fontSize: 22, color, fontFamily: "'DM Mono',monospace", letterSpacing: "0.04em" }}>{end}</span></>}
        </div>
      ) : (
        <span style={{ fontSize: 13, color: T.text4, fontFamily: "'DM Mono',monospace" }}>—</span>
      )}
    </div>
  );
}

function HorariosView({ artists, day, onSaveTime }) {
  const { t } = useLang();
  const { dark } = useTheme(); const T = dark ? DK : LT; const S = makeS(T);
  const [editId, setEditId] = useState(null);
  const [editScCall, setEditScCall] = useState("");
  const [editScLoadIn, setEditScLoadIn] = useState("");
  const [editScStart, setEditScStart] = useState("");
  const [editScEnd, setEditScEnd] = useState("");
  const [editShowStart, setEditShowStart] = useState("");
  const [editShowEnd, setEditShowEnd] = useState("");
  const [horariosTab, setHorariosTab] = useState("show");

  const scColor   = "#2A6B6B";
  const scBg      = dark ? "rgba(42,107,107,0.15)" : "rgba(42,107,107,0.08)";
  const scBorder  = dark ? "rgba(42,107,107,0.4)" : "rgba(42,107,107,0.25)";
  const showColor  = "#C94A2A";
  const showBg     = dark ? "rgba(201,74,42,0.15)" : "rgba(201,74,42,0.08)";
  const showBorder = dark ? "rgba(201,74,42,0.4)" : "rgba(201,74,42,0.25)";

  const sorted = [...artists].sort((a, b) => {
    const ta = horariosTab === "sc" ? festTimeToMin(a.scStart || a.showStart) : festTimeToMin(a.showStart || a.scStart);
    const tb = horariosTab === "sc" ? festTimeToMin(b.scStart || b.showStart) : festTimeToMin(b.showStart || b.scStart);
    return ta - tb;
  });

  function openEdit(a) {
    setEditId(a.id);
    setEditScCall(a.scCall || "");
    setEditScLoadIn(a.scLoadIn || "");
    setEditScStart(a.scStart || "");
    setEditScEnd(a.scEnd || "");
    setEditShowStart(a.showStart || "");
    setEditShowEnd(a.showEnd || "");
  }

  async function confirmEdit(artId) {
    await onSaveTime(artId, {
      scCall: editScCall, scLoadIn: editScLoadIn,
      scStart: editScStart, scEnd: editScEnd,
      showStart: editShowStart, showEnd: editShowEnd,
    });
    setEditId(null);
  }

  const accentColor = horariosTab === "sc" ? scColor : showColor;
  const accentBorder = horariosTab === "sc" ? scBorder : showBorder;

  return (
    <div>
      {/* toggle SC / SHOW — estilo Mallorca nav */}
      <div style={{ display: "flex", background: "#1A1410", borderBottom: "1px solid #3D2B1F", marginBottom: 16 }}>
        {[["sc", t("SOUNDCHECK"), scColor], ["show", "SHOW", showColor]].map(([val, lbl, col]) => (
          <button key={val} onClick={() => setHorariosTab(val)} style={{
            flex: 1, padding: "12px 0", border: "none", cursor: "pointer", background: "none",
            fontFamily: "'Bebas Neue',sans-serif", fontSize: 13, letterSpacing: "0.1em",
            color: horariosTab === val ? col : "#7A6652",
            borderBottom: horariosTab === val ? `3px solid ${col}` : "3px solid transparent",
            marginBottom: -1,
          }}>{lbl}</button>
        ))}
      </div>

      {artists.length === 0 && (
        <div style={{ textAlign: "center", color: T.text4, fontSize: 13, marginTop: 40 }}>{t("Sin artistas en este día")}</div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {sorted.map(a => {
          const isEditing = editId === a.id;
          const hasAnytime = a.scStart || a.scEnd || a.showStart || a.showEnd;
          const activePill = horariosTab === "sc"
            ? { label: t("SOUNDCHECK"), start: a.scStart, end: a.scEnd, color: scColor, bg: scBg, border: scBorder }
            : { label: "SHOW", start: a.showStart, end: a.showEnd, color: showColor, bg: showBg, border: showBorder };

          return (
            <div key={a.id} style={{
              background: T.card,
              border: `1px solid ${T.border}`,
              borderLeft: `5px solid ${hasAnytime ? accentColor : T.border}`,
              borderRadius: 4,
              overflow: "hidden",
            }}>
              {isEditing ? (
                <div style={{ padding: "14px 16px" }}>
                  <div style={{ fontSize: 16, color: T.text, marginBottom: 14, fontFamily: "'Bebas Neue',sans-serif", letterSpacing: "0.06em" }}>{a.artist || "—"}</div>
                  <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 9, color: scColor, letterSpacing: "0.12em", marginBottom: 5, fontFamily: "'DM Mono',monospace" }}>LOAD IN</div>
                      <input type="time" value={editScLoadIn} onChange={e => setEditScLoadIn(e.target.value)} style={{ ...S.input, padding: "10px 12px" }} autoFocus />
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 9, color: scColor, letterSpacing: "0.12em", marginBottom: 5, fontFamily: "'DM Mono',monospace" }}>{t("SC INICIO")}</div>
                      <input type="time" value={editScStart} onChange={e => setEditScStart(e.target.value)} style={{ ...S.input, padding: "10px 12px" }} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 9, color: scColor, letterSpacing: "0.12em", marginBottom: 5, fontFamily: "'DM Mono',monospace" }}>{t("SC FIN")}</div>
                      <input type="time" value={editScEnd} onChange={e => setEditScEnd(e.target.value)} style={{ ...S.input, padding: "10px 12px" }} />
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 9, color: showColor, letterSpacing: "0.12em", marginBottom: 5, fontFamily: "'DM Mono',monospace" }}>{t("SH INICIO")}</div>
                      <input type="time" value={editShowStart} onChange={e => setEditShowStart(e.target.value)} style={{ ...S.input, padding: "10px 12px" }} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 9, color: showColor, letterSpacing: "0.12em", marginBottom: 5, fontFamily: "'DM Mono',monospace" }}>{t("SH FIN")}</div>
                      <input type="time" value={editShowEnd} onChange={e => setEditShowEnd(e.target.value)} style={{ ...S.input, padding: "10px 12px" }} />
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={() => confirmEdit(a.id)} style={{ ...S.bigBtn, flex: 1, padding: "11px", marginTop: 0, fontSize: 13 }}>{t("Guardar")}</button>
                    <button onClick={() => setEditId(null)} style={{ ...S.smBtn, flex: 0.5 }}>{t("Cancelar")}</button>
                  </div>
                </div>
              ) : (
                <div style={{ cursor: "pointer" }} onClick={() => openEdit(a)}>
                  {/* header */}
                  <div style={{ padding: "14px 18px 10px", borderBottom: `1px solid ${T.border}`, background: T.card2 }}>
                    <div style={{ fontSize: 20, fontFamily: "'Bebas Neue',sans-serif", color: T.text, letterSpacing: "0.04em" }}>{a.artist || "—"}</div>
                    {a.console && <div style={{ fontSize: 11, color: T.text3, fontFamily: "'DM Mono',monospace", marginTop: 2 }}>{a.console}</div>}
                  </div>
                  {/* time pill */}
                  <div style={{ padding: "12px 18px 14px" }}>
                    <HorarioPill label={activePill.label} start={activePill.start} end={activePill.end} color={activePill.color} bg={activePill.bg} border={activePill.border} T={T} />
                    {horariosTab === "sc" && a.scLoadIn && (
                      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                        <div style={{ flex: 1, background: T.card2, border: `1px solid ${T.border}`, borderRadius: 4, padding: "6px 10px", textAlign: "center" }}>
                          <div style={{ fontSize: 8, color: scColor, letterSpacing: "0.14em", fontFamily: "'DM Mono',monospace", marginBottom: 2 }}>LOAD IN</div>
                          <div style={{ fontSize: 15, color: scColor, fontFamily: "'DM Mono',monospace", fontWeight: 700 }}>{a.scLoadIn}</div>
                        </div>
                      </div>
                    )}
                    <div style={{ textAlign: "center", marginTop: 8 }}>
                      <span style={{ color: T.text4, fontSize: 11 }}>✏️</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export { HorarioPill };
export default HorariosView;
