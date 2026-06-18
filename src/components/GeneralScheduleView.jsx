import { useState } from "react";
import { useTheme, LT, DK } from "../lib/theme";
import { useLang } from "../lib/i18n";
import { festTimeToMin } from "../lib/utils";

function GeneralScheduleView({ fest }) {
  const { t } = useLang();
  const { dark } = useTheme(); const T = dark ? DK : LT;
  const [mode, setMode] = useState("show");

  const stages = fest.stages || [];
  const getTime = (a) => mode === "show" ? (a.showStart || "") : (a.scStart || "");
  const getEndTime = (a) => mode === "show" ? (a.showEnd || "") : (a.scEnd || "");

  const scColor = dark ? "#34d399" : "#059669";
  const scBg = dark ? "#064e3b" : "#ecfdf5";
  const scBorder = dark ? "#10b98155" : "#6ee7b7";
  const showColor = dark ? "#818cf8" : "#4f46e5";
  const showBg = dark ? "#1e1b4b" : "#eef2ff";
  const showBorder = dark ? "#4338ca55" : "#c7d2fe";
  const loadinColor = dark ? "#fb923c" : "#ea580c";
  const activeColor = mode === "show" ? showColor : scColor;

  // Unique day labels in order of first appearance
  const dayLabels = [];
  for (const st of stages) {
    for (const d of st.days) {
      if (!dayLabels.includes(d.label)) dayLabels.push(d.label);
    }
  }

  const [selectedDay, setSelectedDay] = useState(() => dayLabels[0] || null);

  if (dayLabels.length === 0) {
    return <div style={{ textAlign: "center", color: T.text4, fontSize: 13, marginTop: 40 }}>{t("Sin días configurados")}</div>;
  }

  const activeDay = dayLabels.includes(selectedDay) ? selectedDay : dayLabels[0];

  return (
    <div>
      {/* SHOW / SC toggle + day pills */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        <div style={{ display: "flex", background: T.card2, border: `1px solid ${T.border}`, borderRadius: 10, padding: 2, gap: 2, flexShrink: 0 }}>
          {[{ id: "show", label: "SHOW", color: showColor, bg: showBg, border: showBorder }, { id: "sc", label: "SC", color: scColor, bg: scBg, border: scBorder }].map(opt => (
            <button key={opt.id} onClick={() => setMode(opt.id)} style={{
              padding: "4px 14px", borderRadius: 8, border: "none", cursor: "pointer",
              fontSize: 10, fontWeight: 700, fontFamily: "monospace", letterSpacing: "0.08em",
              background: mode === opt.id ? opt.bg : "transparent",
              color: mode === opt.id ? opt.color : T.text4,
              outline: mode === opt.id ? `1px solid ${opt.border}` : "none",
              transition: "all 0.15s",
            }}>{opt.label}</button>
          ))}
        </div>
        <div style={{ display: "flex", gap: 6, overflowX: "auto", flex: 1 }}>
          {dayLabels.map(label => (
            <button key={label} onClick={() => setSelectedDay(label)} style={{
              flexShrink: 0, padding: "5px 14px", borderRadius: 20, fontSize: 12,
              fontFamily: "'Bebas Neue',sans-serif", letterSpacing: "0.06em", cursor: "pointer",
              whiteSpace: "nowrap", border: "none",
              background: activeDay === label ? (dark ? "#334155" : "#0f172a") : (dark ? "#1e293b" : "#f1f5f9"),
              color: activeDay === label ? "#fff" : T.text4,
            }}>{label}</button>
          ))}
        </div>
      </div>

      {[activeDay].map(dayLabel => {
        // Build { time -> { stageId: artist } } for this day
        const timeMap = {};
        const endTimeMap = {};
        for (const stage of stages) {
          const day = stage.days.find(d => d.label === dayLabel);
          if (!day) continue;
          for (const a of day.artists) {
            const tm = getTime(a);
            if (!tm) continue;
            if (!timeMap[tm]) timeMap[tm] = {};
            timeMap[tm][stage.id] = a;
            const e = getEndTime(a);
            if (e && !endTimeMap[tm]) endTimeMap[tm] = e;
          }
        }

        const sortedTimes = Object.keys(timeMap).sort((a, b) => festTimeToMin(a) - festTimeToMin(b));
        if (sortedTimes.length === 0) return null;

        return (
          <div key={dayLabel}>
            {/* Scrollable grid */}
            <div style={{ overflowX: "auto", borderRadius: 10, border: `1px solid ${T.border}`, overflow: "hidden" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
                <colgroup>
                  <col style={{ width: 58 }} />
                  {stages.map(st => <col key={st.id} />)}
                </colgroup>
                <thead>
                  <tr style={{ background: T.card2 }}>
                    <th style={{ padding: "8px 10px", borderBottom: `1px solid ${T.border}`, borderRight: `1px solid ${T.border}` }} />
                    {stages.map(st => (
                      <th key={st.id} style={{
                        padding: "8px 10px", fontSize: 10,
                        fontFamily: "'Bebas Neue',sans-serif", letterSpacing: "0.1em",
                        color: activeColor, textAlign: "center",
                        borderBottom: `1px solid ${T.border}`,
                        borderRight: `1px solid ${T.border}`,
                        fontWeight: 400,
                      }}>{st.name}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sortedTimes.map((time, idx) => {
                    const rowData = timeMap[time];
                    const isEven = idx % 2 === 0;
                    return (
                      <tr key={time} style={{ background: isEven ? T.card : T.card2 }}>
                        <td style={{
                          padding: "11px 10px",
                          borderBottom: `1px solid ${T.border2}`,
                          borderRight: `1px solid ${T.border}`,
                          textAlign: "right",
                          verticalAlign: "middle",
                        }}>
                          <div style={{ fontSize: 13, fontFamily: "monospace", color: T.text2, fontWeight: 700, whiteSpace: "nowrap" }}>{time}</div>
                          {endTimeMap[time] && (
                            <div style={{ fontSize: 11, fontFamily: "monospace", color: T.text2, fontWeight: 700, whiteSpace: "nowrap", marginTop: 2 }}>{endTimeMap[time]}</div>
                          )}
                        </td>
                        {stages.map(st => {
                          const a = rowData[st.id];
                          return (
                            <td key={st.id} style={{
                              padding: "8px 10px", textAlign: "center",
                              borderBottom: `1px solid ${T.border2}`,
                              borderRight: `1px solid ${T.border}`,
                            }}>
                              {a ? (
                                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                                  <div style={{
                                    fontSize: 13, fontFamily: "'Bebas Neue',sans-serif",
                                    color: T.text, letterSpacing: "0.04em",
                                    border: `1px solid ${T.border}`,
                                    borderRadius: 6, padding: "3px 8px",
                                    background: isEven ? T.card2 : T.card,
                                    maxWidth: "100%", overflow: "hidden",
                                    textOverflow: "ellipsis", whiteSpace: "nowrap",
                                  }}>{a.artist || "—"}</div>
                                  {mode === "sc" && a.scLoadIn && (
                                    <div style={{
                                      display: "flex", alignItems: "center", gap: 3,
                                      fontSize: 10, fontFamily: "'DM Mono',monospace",
                                      color: loadinColor, fontWeight: 600,
                                      background: dark ? "rgba(251,146,60,0.12)" : "rgba(234,88,12,0.08)",
                                      border: `1px solid ${dark ? "rgba(251,146,60,0.3)" : "rgba(234,88,12,0.2)"}`,
                                      borderRadius: 4, padding: "2px 6px",
                                      whiteSpace: "nowrap",
                                    }}>
                                      <span style={{ fontSize: 8, opacity: 0.7 }}>↓</span>
                                      {a.scLoadIn}
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <div style={{ height: 1, background: T.border, margin: "0 auto", width: "50%" }} />
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default GeneralScheduleView;
