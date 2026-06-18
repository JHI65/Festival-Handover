import { useState, useRef, useEffect } from "react";
import { useTheme, LT, DK, makeS } from "../lib/theme";
import { uid, noInfo, sigColor, festTimeToMin } from "../lib/utils";
import { RouteChip } from "./ChainBox";

function QuickTable({ label, items, cols, onAdd, onEdit, onDelete, T, S }) {
  const autoCol = cols.find(c => !c.options);
  const emptyDraft = (nextN) => {
    const d = Object.fromEntries(cols.map(c => [c.key, c.options ? c.options[0] : ""]));
    if (autoCol) d[autoCol.key] = String(nextN ?? items.length + 1);
    return d;
  };
  const [draft, setDraft] = useState(() => emptyDraft());
  const [editId, setEditId] = useState(null);
  const [editField, setEditField] = useState(null);
  const [editDraft, setEditDraft] = useState({});
  const sourceRef = useRef(null);
  const skipBlur = useRef(false);

  function saveItem(item) {
    cols.forEach(c => {
      const val = editDraft[c.key];
      onEdit(item.id, c.key, val !== undefined && val !== "" ? val : item[c.key]);
    });
  }
  function commitEdit(item) {
    saveItem(item);
    setEditId(null); setEditField(null); setEditDraft({});
  }
  function commitAndMoveNext(item) {
    skipBlur.current = true;
    saveItem(item);
    const nextIdx = items.findIndex(x => x.id === item.id) + 1;
    if (nextIdx < items.length) {
      setEditId(items[nextIdx].id);
      setEditField(editField);
      setEditDraft({});
    } else {
      setEditId(null); setEditField(null); setEditDraft({});
    }
  }
  function cancelEdit() { setEditId(null); setEditField(null); setEditDraft({}); }

  useEffect(() => {
    if (autoCol) setDraft(v => ({ ...v, [autoCol.key]: String(items.length + 1) }));
  }, [items.length]); // eslint-disable-line react-hooks/exhaustive-deps

  function commitAdd() {
    const hasValue = cols.some(c => !c.options && (draft[c.key] || "").trim());
    if (!hasValue) return;
    onAdd(draft);
    setDraft(v => Object.fromEntries(cols.map(c => [c.key, c === autoCol ? v[c.key] : c.options ? c.options[0] : ""])));
    setTimeout(() => sourceRef.current?.focus(), 0);
  }

  const rowBase = { display: "flex", alignItems: "center", gap: 6, padding: "7px 10px", borderRadius: 10, marginBottom: 5, fontFamily: "monospace", fontSize: 13 };

  return (
    <div>
      {items.length > 0 && (
        <div style={{ display: "flex", gap: 6, padding: "0 10px", marginBottom: 3 }}>
          {cols.map(c => (
            <span key={c.key} style={{ fontSize: 9, color: T.text4, letterSpacing: "0.1em", textTransform: "uppercase", flexShrink: 0, ...(c.width ? { width: c.width } : { flex: c.flex || 1 }) }}>
              {c.placeholder.toUpperCase()}
            </span>
          ))}
          <span style={{ width: 20 }} />
        </div>
      )}

      {items.map(item => {
        const isRowEditing = editId === item.id;
        return (
          <div key={item.id} style={{ ...rowBase, background: isRowEditing ? T.card2 : T.card, border: `1px solid ${T.border}` }}>
            {cols.map(c => {
              const isCellEditing = isRowEditing && editField === c.key;
              if (isCellEditing) {
                return c.options ? (
                  <select key={c.key} autoFocus
                    value={editDraft[c.key] ?? item[c.key]}
                    onChange={e => setEditDraft(v => ({ ...v, [c.key]: e.target.value }))}
                    onBlur={() => commitEdit(item)}
                    onKeyDown={e => { if (e.key === "Enter") commitEdit(item); if (e.key === "Escape") cancelEdit(); }}
                    style={{ ...S.input, padding: "4px 6px", fontSize: 12, ...(c.width ? { width: c.width } : { flex: c.flex || 1 }) }}>
                    {c.options.map(o => <option key={o}>{o}</option>)}
                  </select>
                ) : (
                  <input key={c.key} autoFocus
                    value={editDraft[c.key] ?? ""}
                    placeholder={item[c.key] || ""}
                    onChange={e => setEditDraft(v => ({ ...v, [c.key]: e.target.value }))}
                    onBlur={() => { if (skipBlur.current) { skipBlur.current = false; return; } commitEdit(item); }}
                    onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); commitAndMoveNext(item); } if (e.key === "Escape") cancelEdit(); }}
                    style={{ ...S.input, padding: "4px 6px", fontSize: 12, ...(c.width ? { width: c.width } : { flex: c.flex || 1 }) }} />
                );
              }
              return (
                <span key={c.key}
                  onClick={() => { setEditId(item.id); setEditField(c.key); setEditDraft({}); }}
                  style={{ color: c.options ? T.text3 : T.text2, fontSize: c.options ? 11 : 13, flexShrink: 0, cursor: "text", ...(c.width ? { width: c.width, fontWeight: 700 } : { flex: c.flex || 1 }) }}>
                  {item[c.key] || "—"}
                </span>
              );
            })}
            {isRowEditing ? (
              <>
                <button onClick={() => commitEdit(item)}
                  style={{ background: "none", border: "none", color: "#16a34a", fontSize: 17, cursor: "pointer", padding: "0 4px", flexShrink: 0 }}>✓</button>
                <button onClick={() => { onDelete(item.id); cancelEdit(); }}
                  style={{ background: "none", border: "none", color: "#ef4444", fontSize: 17, cursor: "pointer", padding: "0 4px", flexShrink: 0 }}>🗑</button>
              </>
            ) : (
              <button onClick={e => { e.stopPropagation(); onDelete(item.id); }}
                style={{ background: "none", border: "none", color: T.text4, fontSize: 18, cursor: "pointer", padding: "4px 8px", flexShrink: 0 }}>×</button>
            )}
          </div>
        );
      })}

      {/* inline add row */}
      <div style={{ ...rowBase, background: T.card2, border: `1.5px dashed ${T.border}`, marginTop: 4 }}>
        {cols.map((c, ci) => {
          const isSourceCol = ci === 1 && !c.options;
          return c.options ? (
            <select key={c.key} value={draft[c.key]} onChange={e => setDraft(v => ({ ...v, [c.key]: e.target.value }))}
              style={{ ...S.input, padding: "4px 6px", fontSize: 12, background: "transparent", border: "none", color: T.text3, ...(c.width ? { width: c.width } : { flex: c.flex || 1 }) }}>
              {c.options.map(o => <option key={o}>{o}</option>)}
            </select>
          ) : (
            <input key={c.key} ref={isSourceCol ? sourceRef : null}
              value={draft[c.key]} onChange={e => setDraft(v => ({ ...v, [c.key]: e.target.value }))}
              onKeyDown={e => { if (e.key === "Enter") commitAdd(); }}
              placeholder={c.placeholder}
              autoFocus={isSourceCol}
              style={{ ...S.input, padding: "4px 6px", fontSize: 12, background: "transparent", border: "none", ...(c.width ? { width: c.width } : { flex: c.flex || 1 }) }} />
          );
        })}
        <button onClick={commitAdd}
          style={{ background: "none", border: "none", color: T.text3, fontSize: 18, cursor: "pointer", padding: "0 2px", flexShrink: 0, lineHeight: 1 }}>+</button>
      </div>
    </div>
  );
}

function MonCompactArtistCard({ a, monPos, T, dark, onSelect }) {
  const chipBg = T.card2;
  const chipBorder = T.border;
  const monConsole = monPos?.console;

  return (
    <div style={{ background: T.bg, borderRadius: 14, padding: "0.75rem" }}>
      <div style={{
        border: `0.5px solid ${T.border}`,
        borderLeft: "3px solid #7c3aed",
        borderRadius: 12,
        padding: "0.85rem 1rem",
        background: T.card,
        cursor: onSelect ? "pointer" : "default",
      }}
      onClick={() => onSelect && onSelect(a.id)}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10 }}>
          <span style={{ fontSize: 21, fontWeight: 500, fontFamily: "'Bebas Neue',sans-serif", letterSpacing: "0.02em", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", color: T.text }}>
            {a.artist || "—"}
          </span>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 14, flexShrink: 0, lineHeight: 1 }}>
            {a.tecnico && (
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 9, color: T.text4, textTransform: "uppercase", letterSpacing: "0.06em" }}>técnico</div>
                <div style={{ fontSize: 13, fontWeight: 500, fontFamily: "monospace", color: T.text2 }}>{noInfo(a.tecnico)}</div>
              </div>
            )}
            {monConsole && (
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 9, color: "#7c3aed", textTransform: "uppercase", letterSpacing: "0.06em" }}>consola mon</div>
                <div style={{ fontSize: 15, fontWeight: 500, fontFamily: "monospace", color: T.text }}>{noInfo(monConsole)}</div>
              </div>
            )}
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 5, margin: "10px 0", flexWrap: "wrap" }}>
          {a.signal && (
            <span style={{ fontSize: 11, fontWeight: 500, fontFamily: "monospace", padding: "3px 8px", borderRadius: 6, background: chipBg, border: `0.5px solid ${chipBorder}`, color: sigColor(a.signal) }}>
              {noInfo(a.signal)}
            </span>
          )}
          {a.toMon && (
            <>
              <span style={{ color: T.text4, opacity: 0.5, fontSize: 12 }}>·</span>
              <span style={{ fontSize: 11, fontWeight: 500, fontFamily: "monospace", padding: "3px 8px", borderRadius: 6, background: "#f5f3ff", border: "0.5px solid #ddd6fe", color: "#7c3aed" }}>
                🎧 {noInfo(a.toMon)}
              </span>
            </>
          )}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 11, color: T.text4, paddingTop: 8, borderTop: `0.5px solid ${T.border}` }}>
          <span>{(monPos?.inputs || []).length} inputs</span>
          <span style={{ color: T.border }}>·</span>
          <span>{(monPos?.outputs || []).length} outputs</span>
          <span style={{ color: T.border }}>·</span>
          <span>{(monPos?.rfEntries || []).length} RF</span>
          {a.toLx && (
            <>
              <span style={{ color: T.border, marginLeft: "auto" }}>·</span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 3, color: T.text3 }}>
                💡 <span style={{ fontFamily: "monospace", fontSize: 10 }}>{noInfo(a.toLx)}</span>
              </span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function MonView({ fest, stage, monPos, dayIdx, setDayIdx, onEditFest, onBack }) {
  const { dark } = useTheme(); const T = dark ? DK : LT; const S = makeS(T);
  const [tab, setTab] = useState("bandas");
  const [selectedArtistId, setSelectedArtistId] = useState(null);
  const [editingConsole, setEditingConsole] = useState(false);
  const [editingTecnico, setEditingTecnico] = useState(false);
  const [consoleVal, setConsoleVal] = useState(monPos.console || "");
  const [tecnicoVal, setTecnicoVal] = useState(monPos.tecnico || "");
  const [newRf, setNewRf] = useState({ ch: "", freq: "", user: "", type: "IEM" });
  const [showAddRf, setShowAddRf] = useState(false);
  const [editRfId, setEditRfId] = useState(null);
  const [editRfVal, setEditRfVal] = useState({});

  const monPosRef = useRef(monPos);
  if (monPosRef.current.id !== monPos.id) {
    monPosRef.current = monPos;
  }

  function saveMonPos(updated) {
    const newStages = (fest.stages || []).map(s => s.id === stage.id
      ? { ...s, monPositions: (s.monPositions || []).map(p => p.id === monPos.id ? updated : p) }
      : s
    );
    onEditFest({ ...fest, stages: newStages });
  }

  function saveConsole() {
    setEditingConsole(false);
    saveMonPos({ ...monPos, console: consoleVal });
  }
  function saveTecnico() {
    setEditingTecnico(false);
    saveMonPos({ ...monPos, tecnico: tecnicoVal });
  }

  // RF
  function addRf() {
    if (!newRf.ch.trim() && !newRf.freq.trim()) return;
    const entry = { id: uid(), ch: newRf.ch.trim(), freq: newRf.freq.trim(), user: newRf.user.trim(), type: newRf.type };
    saveMonPos({ ...monPos, rfEntries: [...(monPos.rfEntries || []), entry] });
    setNewRf({ ch: "", freq: "", user: "", type: "IEM" });
    setShowAddRf(false);
  }
  function deleteRf(id) { saveMonPos({ ...monPos, rfEntries: (monPos.rfEntries || []).filter(x => x.id !== id) }); }
  function saveRf(id) {
    saveMonPos({ ...monPos, rfEntries: (monPos.rfEntries || []).map(x => x.id === id ? { ...x, ...editRfVal } : x) });
    setEditRfId(null);
  }

  const day = stage.days[dayIdx] || stage.days[0];
  const sortedArtists = day ? [...(day.artists || [])].sort((a, b) => festTimeToMin(a.showStart) - festTimeToMin(b.showStart)) : [];

  const rowStyle = { display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", borderRadius: 10, background: T.card, border: `1px solid ${T.border}`, marginBottom: 6, fontFamily: "monospace", fontSize: 12 };
  const cellStyle = { color: T.text2, minWidth: 0, flex: 1 };
  const labelStyle = { fontSize: 9, color: T.text4, letterSpacing: "0.1em", textTransform: "uppercase", marginRight: 4, flexShrink: 0 };

  const MonTopBar = ({ onBackBtn }) => (
    <div style={{ ...S.topBar, flexDirection: "column", alignItems: "stretch", gap: 0, padding: 0 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px 8px" }}>
        <button onClick={onBackBtn} style={S.backBtn}>‹</button>
        <div style={{ flex: 1, textAlign: "center" }}>
          <div style={{ fontSize: 18, fontFamily: "'Bebas Neue',sans-serif", color: T.text, letterSpacing: "0.06em" }}>🎧 {monPos.name}</div>
          <div style={{ fontSize: 10, color: T.text3, fontFamily: "monospace", letterSpacing: "0.04em" }}>{stage.name}</div>
        </div>
        <div style={{ width: 44 }} />
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "4px 12px 4px", borderBottom: `1px solid ${T.border}` }}>
        <div style={{ display: "flex", gap: 4, background: T.card2, borderRadius: 10, padding: 3 }}>
          {["bandas", "inputs", "outputs", "rf", "horarios"].map(t => (
            <button key={t} onClick={() => { setTab(t); setSelectedArtistId(null); }} style={{
              padding: "4px 8px", borderRadius: 8, fontSize: 11,
              fontFamily: "'Bebas Neue',sans-serif", letterSpacing: "0.06em", cursor: "pointer",
              border: "none",
              background: tab === t ? (dark ? "#334155" : "#0f172a") : "transparent",
              color: tab === t ? "#fff" : T.text4,
              transition: "all 0.2s",
            }}>
              {t === "bandas" ? "BANDAS" : t === "inputs" ? "INPUTS" : t === "outputs" ? "OUTPUTS" : t === "rf" ? "RF" : "HORARIOS"}
            </button>
          ))}
        </div>
      </div>
      <div style={{ display: "flex", gap: 6, overflowX: "auto", padding: "6px 12px 8px", alignItems: "center" }}>
        {stage.days.map((d, i) => {
          const dateLabel = d.date ? new Date(d.date + "T12:00").toLocaleDateString("es", { day: "numeric", month: "short" }) : null;
          return (
            <button key={d.id} onClick={() => { setDayIdx(i); setSelectedArtistId(null); }} style={{
              flexShrink: 0, padding: dateLabel ? "4px 12px" : "5px 12px", borderRadius: 20, fontSize: 12,
              fontFamily: "'Bebas Neue',sans-serif", letterSpacing: "0.06em", cursor: "pointer",
              whiteSpace: "nowrap", border: "none", lineHeight: 1.2,
              background: i === dayIdx ? (dark ? "#334155" : "#0f172a") : (dark ? "#1e293b" : "#f1f5f9"),
              color: i === dayIdx ? "#fff" : T.text4,
            }}>
              <div>{d.label}</div>
              {dateLabel && <div style={{ fontSize: 9, opacity: 0.7, fontFamily: "monospace", letterSpacing: 0, marginTop: 1 }}>{dateLabel}</div>}
            </button>
          );
        })}
      </div>
    </div>
  );

  /* detail screen */
  const selectedArt = selectedArtistId ? (day?.artists || []).find(a => a.id === selectedArtistId) : null;
  if (selectedArt) return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      <MonTopBar onBackBtn={() => setSelectedArtistId(null)} />
      <div style={{ flex: 1, padding: "12px 14px", background: T.bg, overflowY: "auto", paddingBottom: "max(24px, env(safe-area-inset-bottom, 24px))" }}>
        <div style={{ background: T.card, border: `0.5px solid ${T.border}`, borderRadius: 16, overflow: "hidden" }}>

          <div style={{ padding: "14px 16px", borderBottom: `0.5px solid ${T.border}` }}>
            <div style={{ fontSize: 24, fontWeight: 500, fontFamily: "'Bebas Neue',sans-serif", letterSpacing: "0.02em", color: T.text, lineHeight: 1.1 }}>{selectedArt.artist || "—"}</div>
            <div style={{ fontSize: 11, color: "#7c3aed", marginTop: 4, fontFamily: "monospace" }}>{monPos.name}</div>
          </div>

          <div style={{ borderBottom: `0.5px solid ${T.border}` }}>
            <div style={{ padding: "10px 16px 8px", display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 12, color: T.text4 }}>🎧</span>
              <span style={{ fontSize: 10, fontWeight: 500, letterSpacing: "0.07em", textTransform: "uppercase", color: T.text4 }}>Setup monitor</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5px", background: T.border }}>
              <div style={{ padding: "10px 12px", background: T.card2 }}>
                <div style={{ fontSize: 10, fontWeight: 500, letterSpacing: "0.06em", textTransform: "uppercase", color: "#7c3aed", marginBottom: 4 }}>Consola MON</div>
                <div style={{ fontSize: 14, fontWeight: 500, color: T.text, lineHeight: 1.3 }}>{noInfo(monPos.console) || <span style={{ fontStyle: "italic", color: T.text4, fontWeight: 400, fontSize: 13 }}>Sin confirmar</span>}</div>
              </div>
              <div style={{ padding: "10px 12px", background: T.card2 }}>
                <div style={{ fontSize: 10, fontWeight: 500, letterSpacing: "0.06em", textTransform: "uppercase", color: T.text4, marginBottom: 4 }}>Técnico</div>
                <div style={{ fontSize: 14, fontWeight: 500, color: T.text, lineHeight: 1.3 }}>{noInfo(selectedArt.tecnico) || <span style={{ fontStyle: "italic", color: T.text4, fontWeight: 400, fontSize: 13 }}>Sin confirmar</span>}</div>
              </div>
              {selectedArt.toMon && (
                <div style={{ padding: "10px 12px", background: T.card2, gridColumn: "1 / -1" }}>
                  <div style={{ fontSize: 10, fontWeight: 500, letterSpacing: "0.06em", textTransform: "uppercase", color: "#7c3aed", marginBottom: 4 }}>To MON</div>
                  <div style={{ fontSize: 14, fontWeight: 500, color: T.text, lineHeight: 1.3 }}>{noInfo(selectedArt.toMon)}</div>
                </div>
              )}
            </div>
          </div>

          <div style={{ borderBottom: `0.5px solid ${T.border}` }}>
            <div style={{ padding: "10px 16px 8px", display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 12, color: T.text4 }}>🔌</span>
              <span style={{ fontSize: 10, fontWeight: 500, letterSpacing: "0.07em", textTransform: "uppercase", color: T.text4 }}>Parcheo FOH</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5px", background: T.border }}>
              <div style={{ padding: "10px 12px", background: T.card2 }}>
                <div style={{ fontSize: 10, fontWeight: 500, letterSpacing: "0.06em", textTransform: "uppercase", color: T.text4, marginBottom: 4 }}>Señal</div>
                <div style={{ fontSize: 14, fontWeight: 500, color: sigColor(selectedArt.signal), lineHeight: 1.3 }}>{noInfo(selectedArt.signal) || <span style={{ fontStyle: "italic", color: T.text4, fontWeight: 400, fontSize: 13 }}>—</span>}</div>
              </div>
              <div style={{ padding: "10px 12px", background: T.card2 }}>
                <div style={{ fontSize: 10, fontWeight: 500, letterSpacing: "0.06em", textTransform: "uppercase", color: T.text4, marginBottom: 4 }}>Mesa FOH</div>
                <div style={{ fontSize: 14, fontWeight: 500, color: T.text, lineHeight: 1.3 }}>{noInfo(selectedArt.console) || <span style={{ fontStyle: "italic", color: T.text4, fontWeight: 400, fontSize: 13 }}>—</span>}</div>
              </div>
              {selectedArt.connection && (
                <div style={{ padding: "10px 12px", background: T.card2, gridColumn: "1 / -1" }}>
                  <div style={{ fontSize: 10, fontWeight: 500, letterSpacing: "0.06em", textTransform: "uppercase", color: T.text4, marginBottom: 4 }}>Conexión</div>
                  <div style={{ fontSize: 14, fontWeight: 500, color: T.text, lineHeight: 1.3 }}>{noInfo(selectedArt.connection)}</div>
                </div>
              )}
            </div>
          </div>

          {selectedArt.toLx && (
            <div style={{ borderBottom: `0.5px solid ${T.border}`, padding: "0 12px 12px" }}>
              <div style={{ padding: "10px 4px 8px", fontSize: 10, fontWeight: 500, letterSpacing: "0.07em", textTransform: "uppercase", color: T.text4 }}>Rutas</div>
              <RouteChip icon="💡" label="TO LX" value={noInfo(selectedArt.toLx)} color="#ea580c" />
            </div>
          )}

          {(selectedArt.comments || []).length > 0 && (
            <div style={{ borderBottom: `0.5px solid ${T.border}`, padding: "10px 16px 12px" }}>
              <div style={{ fontSize: 10, fontWeight: 500, letterSpacing: "0.07em", textTransform: "uppercase", color: T.text4, marginBottom: 8 }}>Notas previas</div>
              {selectedArt.comments.map((c, i) => (
                <div key={i} style={{ fontSize: 13, color: T.text2, lineHeight: 1.5, padding: "6px 10px", background: T.card2, borderLeft: `2px solid ${T.border}`, borderRadius: "0 6px 6px 0", marginBottom: 4 }}>{c}</div>
              ))}
            </div>
          )}

          {(selectedArt.extraSlots || []).filter(s => s.label).length > 0 && (
            <div style={{ padding: "10px 16px 12px" }}>
              <div style={{ fontSize: 10, fontWeight: 500, letterSpacing: "0.07em", textTransform: "uppercase", color: T.text4, marginBottom: 8 }}>Campos extra</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                {(selectedArt.extraSlots || []).filter(s => s.label).map(s => (
                  <RouteChip key={s.id} icon="📋" label={s.label} value={s.value || "—"} color="#2563eb" />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      <MonTopBar onBackBtn={onBack} />

      <div style={{ flex: 1, overflowY: "auto", padding: "14px 14px", background: T.bg, paddingBottom: "max(24px, env(safe-area-inset-bottom, 24px))" }}>

        {/* BANDAS TAB */}
        {tab === "bandas" && (
          <div>
            {sortedArtists.length === 0 && (
              <div style={{ textAlign: "center", color: T.text4, fontSize: 13, marginTop: 40, fontFamily: "monospace" }}>Sin artistas en este día</div>
            )}
            {sortedArtists.length > 0 && (
              <span style={{ fontSize: 10, letterSpacing: "0.08em", color: T.text4, textTransform: "uppercase", display: "block", marginBottom: 6 }}>Ficha compacta</span>
            )}
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {sortedArtists.map(a => (
                <MonCompactArtistCard key={a.id} a={a} monPos={monPos} T={T} dark={dark} onSelect={setSelectedArtistId} />
              ))}
            </div>
          </div>
        )}

        {/* INPUTS TAB */}
        {tab === "inputs" && (
          <QuickTable
            label="INPUTS"
            items={monPos.inputs || []}
            cols={[
              { key: "ch", placeholder: "CH", width: 52 },
              { key: "source", placeholder: "Name", flex: 2 },
              { key: "type", placeholder: "Mic / DI", flex: 1.2 },
            ]}
            onAdd={entry => { const e = { id: uid(), ch: entry.ch || "", source: entry.source || "", type: entry.type || "" }; saveMonPos({ ...monPos, inputs: [...(monPos.inputs || []), e] }); }}
            onEdit={(id, field, val) => saveMonPos({ ...monPos, inputs: (monPos.inputs || []).map(x => x.id === id ? { ...x, [field]: val } : x) })}
            onDelete={id => saveMonPos({ ...monPos, inputs: (monPos.inputs || []).filter(x => x.id !== id) })}
            T={T} S={S}
          />
        )}

        {/* OUTPUTS TAB */}
        {tab === "outputs" && (
          <QuickTable
            label="OUTPUTS"
            items={monPos.outputs || []}
            cols={[
              { key: "mix", placeholder: "MIX", width: 52 },
              { key: "dest", placeholder: "Dest", flex: 2 },
              { key: "type", placeholder: "Type", flex: 1, options: ["Wedge", "IEM", "Fill", "Sub"] },
            ]}
            onAdd={entry => { const e = { id: uid(), mix: entry.mix || "", dest: entry.dest || "", type: entry.type || "Wedge" }; saveMonPos({ ...monPos, outputs: [...(monPos.outputs || []), e] }); }}
            onEdit={(id, field, val) => saveMonPos({ ...monPos, outputs: (monPos.outputs || []).map(x => x.id === id ? { ...x, [field]: val } : x) })}
            onDelete={id => saveMonPos({ ...monPos, outputs: (monPos.outputs || []).filter(x => x.id !== id) })}
            T={T} S={S}
          />
        )}

        {/* RF TAB */}
        {tab === "rf" && (
          <div>
            <div style={{ fontSize: 10, color: T.text4, letterSpacing: "0.08em", marginBottom: 10 }}>RF — {(monPos.rfEntries || []).length} unidades</div>
            {(monPos.rfEntries || []).length > 0 && (
              <div style={{ display: "flex", gap: 8, padding: "4px 10px", marginBottom: 4 }}>
                <span style={{ ...labelStyle, width: 28 }}>CH</span>
                <span style={{ ...labelStyle, flex: 1 }}>FREQ</span>
                <span style={{ ...labelStyle, flex: 2 }}>USER</span>
                <span style={{ ...labelStyle, flex: 1 }}>TYPE</span>
                <span style={{ width: 24 }} />
              </div>
            )}
            {(monPos.rfEntries || []).map(rf => (
              editRfId === rf.id ? (
                <div key={rf.id} style={{ ...rowStyle, flexDirection: "column", alignItems: "stretch", gap: 6 }}>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    <input value={editRfVal.ch ?? rf.ch} onChange={e => setEditRfVal(v => ({ ...v, ch: e.target.value }))} placeholder="CH" style={{ ...S.input, padding: "5px 8px", width: 60, fontSize: 13 }} autoFocus />
                    <input value={editRfVal.freq ?? rf.freq} onChange={e => setEditRfVal(v => ({ ...v, freq: e.target.value }))} placeholder="Freq" style={{ ...S.input, padding: "5px 8px", flex: 1, fontSize: 13 }} />
                    <input value={editRfVal.user ?? rf.user} onChange={e => setEditRfVal(v => ({ ...v, user: e.target.value }))} placeholder="User" style={{ ...S.input, padding: "5px 8px", flex: 2, fontSize: 13 }} />
                    <select value={editRfVal.type ?? rf.type} onChange={e => setEditRfVal(v => ({ ...v, type: e.target.value }))} style={{ ...S.input, padding: "5px 8px", width: 80, fontSize: 13 }}>
                      {["IEM", "Radio"].map(t => <option key={t}>{t}</option>)}
                    </select>
                  </div>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button onClick={() => saveRf(rf.id)} style={{ ...S.smBtn, flex: 1, padding: "6px", fontSize: 12 }}>✓ Guardar</button>
                    <button onClick={() => setEditRfId(null)} style={{ ...S.smBtn, flex: 0.5, padding: "6px", fontSize: 12 }}>Cancelar</button>
                  </div>
                </div>
              ) : (
                <div key={rf.id} style={rowStyle} onClick={() => { setEditRfId(rf.id); setEditRfVal({}); }}>
                  <span style={{ width: 28, color: T.text3, fontWeight: 700, fontSize: 11, flexShrink: 0 }}>{rf.ch || "—"}</span>
                  <span style={{ ...cellStyle, flex: 1, color: "#D4A843", fontWeight: 600 }}>{rf.freq || "—"}</span>
                  <span style={{ ...cellStyle, flex: 2 }}>{rf.user || "—"}</span>
                  <span style={{ ...cellStyle, flex: 1, color: T.text3, fontSize: 11 }}>{rf.type}</span>
                  <button onClick={e => { e.stopPropagation(); deleteRf(rf.id); }} style={{ background: "none", border: "none", color: T.text4, fontSize: 16, cursor: "pointer", padding: "0 2px", flexShrink: 0 }}>×</button>
                </div>
              )
            ))}
            {showAddRf ? (
              <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: "12px", marginTop: 8 }}>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
                  <input value={newRf.ch} onChange={e => setNewRf(v => ({ ...v, ch: e.target.value }))} placeholder="CH" style={{ ...S.input, padding: "7px 8px", width: 60, fontSize: 13 }} autoFocus />
                  <input value={newRf.freq} onChange={e => setNewRf(v => ({ ...v, freq: e.target.value }))} placeholder="Freq" style={{ ...S.input, padding: "7px 8px", flex: 1, fontSize: 13 }} />
                  <input value={newRf.user} onChange={e => setNewRf(v => ({ ...v, user: e.target.value }))} placeholder="User / artista" style={{ ...S.input, padding: "7px 8px", flex: 2, fontSize: 13 }} />
                  <select value={newRf.type} onChange={e => setNewRf(v => ({ ...v, type: e.target.value }))} style={{ ...S.input, padding: "7px 8px", width: 80, fontSize: 13 }}>
                    {["IEM", "Radio"].map(t => <option key={t}>{t}</option>)}
                  </select>
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  <button onClick={addRf} style={{ ...S.bigBtn, flex: 1, padding: "10px", marginTop: 0, fontSize: 13 }}>Añadir</button>
                  <button onClick={() => { setShowAddRf(false); setNewRf({ ch: "", freq: "", user: "", type: "IEM" }); }} style={{ ...S.navBtn, flex: 0.5 }}>Cancelar</button>
                </div>
              </div>
            ) : (
              <button onClick={() => setShowAddRf(true)} style={{ ...S.addBtn, marginTop: 4 }}>+ Añadir RF</button>
            )}
          </div>
        )}

        {/* HORARIOS TAB */}
        {tab === "horarios" && (
          <div>
            <div style={{ fontSize: 10, color: T.text4, letterSpacing: "0.08em", marginBottom: 10 }}>
              HORARIOS — {day ? day.label : ""} · {sortedArtists.length} artistas
            </div>
            {sortedArtists.length === 0 && (
              <div style={{ color: T.text4, fontSize: 13, textAlign: "center", padding: "32px 0", fontFamily: "monospace" }}>No hay artistas en este día</div>
            )}
            {sortedArtists.map(a => (
              <div key={a.id} style={{ ...rowStyle, justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0, flex: 1 }}>
                  {a.showStart && (
                    <span style={{ fontSize: 13, fontWeight: 700, color: dark ? "#818cf8" : "#4f46e5", fontFamily: "monospace", flexShrink: 0 }}>{a.showStart}</span>
                  )}
                  <span style={{ color: T.text, fontSize: 13, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.artist}</span>
                </div>
                {a.console && <span style={{ color: T.text3, fontSize: 11, flexShrink: 0, marginLeft: 8 }}>{a.console}</span>}
              </div>
            ))}
          </div>
        )}

      </div>
    </div>
  );
}

export { QuickTable, MonCompactArtistCard };
export default MonView;
