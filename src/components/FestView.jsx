import { useState, useEffect } from "react";
import { useTheme, LT, DK, makeS } from "../lib/theme";
import { uid, sigColor, noInfo, festTimeToMin, mkLog, withLog } from "../lib/utils";
import { PALETTE } from "../lib/constants";
import { printHandoverPDF } from "../lib/pdf";
import AddArtistScreen from "./AddArtistScreen";
import { RouteChip } from "./ChainBox";
import ExtraSlots from "./ExtraSlots";
import FohNotes from "./FohNotes";
import LogModal from "./LogModal";
import RulosView, { RuloFormModal } from "./RulosView";
import HorariosView from "./HorariosView";
import EtapasView from "./EtapasView";
import NotasDiaView from "./NotasDiaView";
import CompactArtistCard from "./CompactArtistCard";

function FestView({ fest, stage, userEmail, userRole, dayIdx, setDayIdx, notes, setNotes, checks, toggleCheck, slots, setSlots, onEditFest, onBack, onRefresh, lastSync }) {
  const canEdit = userRole !== "viewer";
  const isOwner = userRole === "owner";
  const [selectedId, setSelectedId] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const [editId, setEditId] = useState(null);
  const [showLog, setShowLog] = useState(false);
  const [menuOpenId, setMenuOpenId] = useState(null);
  const [artGearOpen, setArtGearOpen] = useState(false);
  const [confirmDeleteArt, setConfirmDeleteArt] = useState(false);
  const [tab, setTab] = useState("bandas");
  const [showRuloForm, setShowRuloForm] = useState(false);
  const [prefillPos, setPrefillPos] = useState(null);
  const [showCopy, setShowCopy] = useState(false);
  const [copySelected, setCopySelected] = useState({});
  const [copyTargetDays, setCopyTargetDays] = useState({});
  const [editRuloId, setEditRuloId] = useState(null);
  const [showAddDay, setShowAddDay] = useState(false);
  const [newDayLabel, setNewDayLabel] = useState("");
  const [newDayDate, setNewDayDate] = useState("");

  const { dark } = useTheme();
  const T = dark ? DK : LT;
  const S = makeS(T);

  // Auto-seleccionar el día cuya fecha coincida con hoy
  useEffect(() => {
    const t = new Date();
    const todayStr = `${t.getFullYear()}-${String(t.getMonth()+1).padStart(2,"0")}-${String(t.getDate()).padStart(2,"0")}`;
    const idx = stage.days.findIndex(d => d.date === todayStr);
    if (idx >= 0) setDayIdx(idx);
  }, [stage.id]); // eslint-disable-line

  function updateStage(newDays) {
    const newStages = (fest.stages || []).map(s => s.id === stage.id ? { ...s, days: newDays } : s);
    return { ...fest, stages: newStages };
  }

  async function copyArtistsTodays() {
    const artsToCopy = artists.filter(a => copySelected[a.id]);
    if (!artsToCopy.length) return;
    const targetIdxs = stage.days.map((_, i) => i).filter(i => copyTargetDays[i] && i !== dayIdx);
    if (!targetIdxs.length) return;
    const newDays = stage.days.map((d, i) => {
      if (!targetIdxs.includes(i)) return d;
      const clones = artsToCopy.map(a => ({ ...a, id: uid(), presetOk: false }));
      return { ...d, artists: [...d.artists, ...clones] };
    });
    await onEditFest(updateStage(newDays));
    setShowCopy(false);
    setCopySelected({});
    setCopyTargetDays({});
  }

  function updateDayRulos(newRulos) {
    const newDays = stage.days.map((d, i) => i === dayIdx ? { ...d, rulos: newRulos } : d);
    const newStages = (fest.stages || []).map(s => s.id === stage.id ? { ...s, days: newDays } : s);
    return { ...fest, stages: newStages };
  }

  function updatePermRulos(newRulos) {
    const newStages = (fest.stages || []).map(s => s.id === stage.id ? { ...s, rulos: newRulos } : s);
    return { ...fest, stages: newStages };
  }

  function saveRulo(fields) {
    let newDayRulos = (day.rulos || []).filter(r => r.id !== editRuloId);
    let newPermRulos = (stage.rulos || []).filter(r => r.id !== editRuloId);
    const id = editRuloId || uid();
    if (fields.permanent) {
      newPermRulos = [...newPermRulos, { ...fields, id }];
    } else {
      newDayRulos = [...newDayRulos, { ...fields, id }];
    }
    const newDays = stage.days.map((d, i) => i === dayIdx ? { ...d, rulos: newDayRulos } : d);
    const newStages = (fest.stages || []).map(s => s.id === stage.id ? { ...s, days: newDays, rulos: newPermRulos } : s);
    const action = editRuloId ? "EDIT_RULO" : "ADD_RULO";
    const ruloDetail = [fields.position, fields.type, fields.qty && fields.desc ? `${fields.qty}× ${fields.desc}` : (fields.desc || fields.qty), fields.permanent ? "PERMANENTE" : day.label].filter(Boolean).join(" · ");
    onEditFest(withLog({ ...fest, stages: newStages }, mkLog(userEmail, action, ruloDetail)));
    setShowRuloForm(false);
    setEditRuloId(null);
    setPrefillPos(null);
  }

  function deleteRulo(id, isPerm) {
    const ruloObj = [...(day.rulos || []), ...(stage.rulos || [])].find(r => r.id === id);
    const ruloPos = ruloObj ? [ruloObj.position, ruloObj.type, ruloObj.desc].filter(Boolean).join(" · ") : id;
    let newDayRulos = (day.rulos || []).filter(r => r.id !== id);
    let newPermRulos = (stage.rulos || []).filter(r => r.id !== id);
    const newDays = stage.days.map((d, i) => i === dayIdx ? { ...d, rulos: newDayRulos } : d);
    const newStages = (fest.stages || []).map(s => s.id === stage.id ? { ...s, days: newDays, rulos: newPermRulos } : s);
    onEditFest(withLog({ ...fest, stages: newStages }, mkLog(userEmail, "DEL_RULO", ruloPos)));
  }

  function addDay(label, date) {
    const newDay = { id: uid(), label: (label || `DÍA ${stage.days.length + 1}`).toUpperCase(), artists: [], ...(date ? { date } : {}) };
    onEditFest(withLog(updateStage([...stage.days, newDay]), mkLog(userEmail, "ADD_DAY", newDay.label)));
    setDayIdx(stage.days.length);
    setSelectedId(null);
  }

  function confirmAddDay() {
    if (!newDayLabel.trim() && !newDayDate) return;
    addDay(newDayLabel.trim() || undefined, newDayDate || undefined);
    setShowAddDay(false);
    setNewDayLabel("");
    setNewDayDate("");
  }

  const day = stage.days[dayIdx];
  const artists = day
    ? [...day.artists].sort((a, b) => festTimeToMin(a.showStart) - festTimeToMin(b.showStart))
    : [];
  const art = artists.find(a => a.id === selectedId) || null;

  const ckey = art ? `${fest.id}__${day.id}__${art.id}` : null;
  const ckeysc = ckey ? `${ckey}__sc` : null;
  const ckeyshow = ckey ? `${ckey}__show` : null;
  const scDone = ckeysc ? !!checks[ckeysc] : false;
  const showDone = ckeyshow ? !!checks[ckeyshow] : false;
  const done = scDone && showDone;
  const myNotes = ckey ? (notes[ckey] || []) : [];
  const mySlots = ckey ? (slots[ckey] || []) : [];
  const sc = art ? sigColor(art.signal) : "#64748b";

  async function addArtistToDay(fields) {
    const newArt = { id: uid(), artist: fields.artist || "", console: fields.console || "", connection: fields.connection || "", signal: fields.signal || "", preset: fields.preset || "INITIAL", presetOk: false, toLx: fields.toLx || "", toMon: fields.toMon || "", tecnico: fields.tecnico || "", corriente: fields.corriente || "", scLoadIn: fields.scLoadIn || "", scStart: fields.scStart || "", scEnd: fields.scEnd || "", showStart: fields.showStart || "", showEnd: fields.showEnd || "", comments: [], extraSlots: [] };
    const updatedDays = stage.days.map((d, i) => i === dayIdx ? { ...d, artists: [...d.artists, newArt] } : d);
    const addDetail = [newArt.artist, newArt.console, newArt.connection, newArt.signal].filter(Boolean).join(" · ");
    await onEditFest(withLog(updateStage(updatedDays), mkLog(userEmail, "ADD_ARTIST", addDetail)));
    setShowAdd(false);
    setSelectedId(newArt.id);
  }

  async function saveEditArtist(fields) {
    const LABELS = { artist: "nombre", console: "mesa", connection: "conexión", signal: "señal", preset: "preset", tecnico: "técnico", toLx: "LX", toMon: "Mon", corriente: "corriente" };
    const orig = artists.find(a => a.id === editId);
    const changes = Object.keys(LABELS)
      .filter(k => fields[k] !== undefined && String(fields[k] || "") !== String(orig?.[k] || ""))
      .map(k => `${LABELS[k]}: "${orig?.[k] || "—"}" → "${fields[k] || "—"}"`);
    const editDetail = (fields.artist || orig?.artist || "") + (changes.length ? `\n  ${changes.join("\n  ")}` : " · sin cambios");
    const updatedDays = stage.days.map((d, i) => i === dayIdx ? {
      ...d, artists: d.artists.map(a => a.id === editId ? { ...a, ...fields } : a)
    } : d);
    await onEditFest(withLog(updateStage(updatedDays), mkLog(userEmail, "EDIT_ARTIST", editDetail)));
    setEditId(null);
  }

  async function deleteArtist(artId) {
    const artName = artists.find(a => a.id === artId)?.artist || artId;
    const updatedDays = stage.days.map((d, i) => i === dayIdx ? { ...d, artists: d.artists.filter(a => a.id !== artId) } : d);
    await onEditFest(withLog(updateStage(updatedDays), mkLog(userEmail, "DEL_ARTIST", artName)));
  }

  async function saveArtistTime(artId, fields) {
    const updatedDays = stage.days.map((d, i) => i === dayIdx ? {
      ...d, artists: d.artists.map(a => a.id === artId ? { ...a, ...fields } : a)
    } : d);
    await onEditFest(updateStage(updatedDays));
  }

  function addNote(text) {
    if (!text.trim()) return;
    setNotes({ ...notes, [ckey]: [...myNotes, { text: text.trim(), ts: Date.now() }] });
  }
  function delNote(i) { setNotes({ ...notes, [ckey]: myNotes.filter((_, idx) => idx !== i) }); }
  function addSlot(label, value) {
    if (!label.trim()) return;
    setSlots({ ...slots, [ckey]: [...mySlots, { id: uid(), label: label.trim(), value: value.trim() }] });
  }
  function delSlot(id) { setSlots({ ...slots, [ckey]: mySlots.filter(s => s.id !== id) }); }
  function editSlot(id, fld, val) { setSlots({ ...slots, [ckey]: mySlots.map(s => s.id === id ? { ...s, [fld]: val } : s) }); }

  const TopBar = ({ onBackBtn }) => (
    <div style={{ flexWrap: "wrap", background: "#1A1410", borderBottom: "3px solid #C94A2A", position: "sticky", top: 0, zIndex: 10 }}>
      {/* row 1: back + title + log */}
      <div style={{ display: "flex", alignItems: "center", padding: "10px 12px 8px", gap: 10 }}>
        <button onClick={onBackBtn} style={{ ...S.backBtn, background: "#261E18", borderColor: "#3D2B1F", color: "#D8CEB8" }}>‹</button>
        <div style={{ flex: 1, textAlign: "center", fontSize: 18, fontFamily: "'Bebas Neue',sans-serif", color: "#F5EFE0", letterSpacing: "0.08em" }}>{stage.name}</div>
        <button onClick={() => setShowLog(true)} style={{ ...S.syncBtn }}>{">"}_</button>
      </div>
      {/* row 2: BANDAS / RULOS / HORARIOS + sync */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 12px 8px" }}>
        <div style={{ display: "flex", gap: 0 }}>
          {["bandas", "rulos", "horarios", "etapas", "notas"].map(t => (
            <button key={t} onClick={() => { setTab(t); setSelectedId(null); setShowAdd(false); }} style={{
              padding: "6px 12px", fontSize: 12,
              fontFamily: "'Bebas Neue',sans-serif", letterSpacing: "0.08em", cursor: "pointer",
              border: "none", background: "none",
              color: tab === t ? "#F5EFE0" : "#7A6652",
              borderBottom: tab === t ? "2px solid #D4A843" : "2px solid transparent",
            }}>{t === "bandas" ? "BANDAS" : t === "rulos" ? "RULOS" : t === "horarios" ? "HORARIOS" : t === "etapas" ? "ETAPAS" : "NOTAS"}</button>
          ))}
        </div>
        <button onClick={onRefresh} style={{ ...S.syncBtn }}>↻ {lastSync ? lastSync.toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" }) : ""}</button>
      </div>
      {/* row 3: day tabs */}
      <div style={{ display: "flex", overflowX: "auto", borderTop: "1px solid #3D2B1F" }}>
        {stage.days.map((d, i) => {
          const dn = d.artists.filter(a => checks[`${fest.id}__${d.id}__${a.id}__sc`] && checks[`${fest.id}__${d.id}__${a.id}__show`]).length;
          const active = i === dayIdx;
          const dayColor = PALETTE[i % PALETTE.length];
          const dateLabel = d.date ? new Date(d.date + "T12:00").toLocaleDateString("es", { day: "numeric", month: "short" }) : null;
          return (
            <button key={d.id} onClick={() => { setDayIdx(i); setSelectedId(null); setShowAdd(false); }} style={{
              flexShrink: 0, padding: "10px 20px", cursor: "pointer",
              whiteSpace: "nowrap", border: "none", background: "none", lineHeight: 1.3,
              borderBottom: active ? `3px solid ${dayColor}` : "3px solid transparent",
              marginBottom: -3,
            }}>
              <div style={{ fontFamily: "'Bebas Neue',sans-serif", letterSpacing: "0.1em", fontSize: 14, color: active ? dayColor : "#7A6652" }}>
                {d.label} <span style={{ fontSize: 10, opacity: 0.7 }}>{dn}/{d.artists.length}</span>
              </div>
              {dateLabel && <div style={{ fontSize: 9, color: active ? dayColor : "#7A6652", fontFamily: "'DM Mono',monospace", opacity: 0.8, marginTop: 1 }}>{dateLabel}</div>}
            </button>
          );
        })}
        {showAddDay ? (
          <div style={{ display: "flex", alignItems: "center", gap: 5, flexShrink: 0, padding: "8px 12px" }}>
            <input
              value={newDayLabel}
              onChange={e => setNewDayLabel(e.target.value)}
              placeholder={`DÍA ${stage.days.length + 1}`}
              style={{ width: 70, fontSize: 11, fontFamily: "'Bebas Neue',sans-serif", background: "transparent", border: "none", outline: "none", color: "#F5EFE0", letterSpacing: "0.06em" }}
              autoFocus
            />
            <input
              type="date"
              value={newDayDate}
              onChange={e => setNewDayDate(e.target.value)}
              style={{ fontSize: 10, background: "transparent", border: "none", outline: "none", color: "#B0A090", fontFamily: "'DM Mono',monospace", width: 100 }}
            />
            <button onClick={confirmAddDay} style={{ background: "#C94A2A", border: "none", borderRadius: 2, color: "#fff", fontSize: 12, padding: "3px 8px", cursor: "pointer" }}>✓</button>
            <button onClick={() => { setShowAddDay(false); setNewDayLabel(""); setNewDayDate(""); }} style={{ background: "transparent", border: "none", color: "#7A6652", fontSize: 14, cursor: "pointer", padding: "2px 4px" }}>×</button>
          </div>
        ) : isOwner ? (
          <button onClick={() => setShowAddDay(true)} style={{
            flexShrink: 0, padding: "10px 14px", fontSize: 14,
            fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap",
            border: "none", background: "none", color: "#7A6652",
          }}>+</button>
        ) : null}
      </div>
    </div>
  );

  /* ---- edit screen ---- */
  if (editId) {
    const editArt = artists.find(a => a.id === editId);
    return (
      <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
        <TopBar onBackBtn={() => setEditId(null)} />
        <div style={{ flex: 1, padding: "12px 14px 24px", background: "#f8fafc", overflowY: "auto" }}>
          <AddArtistScreen initial={editArt} onAdd={saveEditArtist} onBack={() => setEditId(null)} />
        </div>
      </div>
    );
  }

  /* ---- add screen ---- */
  if (showAdd) return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      <TopBar onBackBtn={() => setShowAdd(false)} />
      <div style={{ flex: 1, padding: "12px 14px 24px", background: "#f8fafc", overflowY: "auto" }}>
        <AddArtistScreen onAdd={addArtistToDay} onBack={() => setShowAdd(false)} />
      </div>
    </div>
  );

  /* ---- detail screen ---- */
  if (art) return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      <TopBar onBackBtn={() => setSelectedId(null)} />
      <div style={{ flex: 1, padding: "12px 14px", background: T.bg, overflowY: "auto", paddingBottom: "max(24px, env(safe-area-inset-bottom, 24px))" }}>
        <div style={{ background: T.card, border: `0.5px solid ${T.border}`, borderRadius: 16, overflow: "hidden" }}>

          {/* header: nombre + día/hora + botones SC/SHOW */}
          <div style={{ padding: "14px 16px", borderBottom: `0.5px solid ${T.border}` }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 8, minWidth: 0 }}>
                {/* gear */}
                <div style={{ position: "relative", flexShrink: 0 }}>
                  <button onClick={() => setArtGearOpen(o => !o)} style={{
                    background: artGearOpen ? "#f1f5f9" : "none", border: "1px solid #e2e8f0",
                    borderRadius: 10, padding: "6px 10px", cursor: "pointer", fontSize: 15, lineHeight: 1,
                  }}>⚙️</button>
                  {artGearOpen && (
                    <div onClick={e => e.stopPropagation()} style={{
                      position: "absolute", top: 38, left: 0, background: "#fff", borderRadius: 12,
                      boxShadow: "0 4px 16px rgba(0,0,0,0.12)", border: "1px solid #e2e8f0",
                      zIndex: 30, minWidth: 140, overflow: "hidden",
                    }}>
                      {isOwner && <><button onClick={() => { setArtGearOpen(false); setEditId(art.id); setSelectedId(null); }} style={{ display: "block", width: "100%", padding: "12px 16px", background: "none", border: "none", textAlign: "left", fontSize: 13, color: "#334155", cursor: "pointer", fontFamily: "monospace" }}>✏️ Editar</button><div style={{ height: 1, background: "#f1f5f9" }} /></>}
                      <button onClick={() => { setArtGearOpen(false); printHandoverPDF([art], { festName: fest.name, stageName: stage.name, dayLabel: day.label, dayDate: day.date, notes, checks, slots, festId: fest.id, dayId: day.id }); }} style={{ display: "block", width: "100%", padding: "12px 16px", background: "none", border: "none", textAlign: "left", fontSize: 13, color: "#334155", cursor: "pointer", fontFamily: "monospace" }}>🖨 Exportar PDF</button>
                      {isOwner && <><div style={{ height: 1, background: "#f1f5f9" }} /><button onClick={() => { setArtGearOpen(false); setConfirmDeleteArt(true); }} style={{ display: "block", width: "100%", padding: "12px 16px", background: "none", border: "none", textAlign: "left", fontSize: 13, color: "#ef4444", cursor: "pointer", fontFamily: "monospace" }}>🗑 Borrar</button></>}
                    </div>
                  )}
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 20, fontWeight: 500, color: T.text, lineHeight: 1.2, wordBreak: "break-word" }}>{art.artist || "—"}</div>
                </div>
              </div>
              {/* SC + SHOW pills */}
              <div style={{ display: "flex", flexDirection: "column", gap: 5, flexShrink: 0, paddingTop: 2, alignItems: "flex-end" }}>
                <button onClick={() => canEdit && toggleCheck(ckeysc)} style={{
                  display: "inline-flex", alignItems: "center", gap: 4,
                  fontSize: 11, fontWeight: 500, padding: "3px 10px", borderRadius: 99,
                  background: scDone ? "#E1F5EE" : "#f8fafc",
                  color: scDone ? "#085041" : "#94a3b8",
                  border: `0.5px solid ${scDone ? "#1D9E7555" : "#e2e8f0"}`,
                  cursor: canEdit ? "pointer" : "default", transition: "all 0.2s", opacity: canEdit ? 1 : 0.6,
                }}>
                  {scDone && <span style={{ width: 5, height: 5, background: "#1D9E75", borderRadius: "50%", display: "inline-block" }} />}
                  SC
                </button>
                <button onClick={() => canEdit && toggleCheck(ckeyshow)} style={{
                  display: "inline-flex", alignItems: "center", gap: 4,
                  fontSize: 11, fontWeight: 500, padding: "3px 10px", borderRadius: 99,
                  background: showDone ? "#E6F1FB" : "#f8fafc",
                  color: showDone ? "#0C447C" : "#94a3b8",
                  border: `0.5px solid ${showDone ? "#2563eb55" : "#e2e8f0"}`,
                  cursor: canEdit ? "pointer" : "default", transition: "all 0.2s", opacity: canEdit ? 1 : 0.6,
                }}>
                  {showDone && <span style={{ width: 5, height: 5, background: "#2563eb", borderRadius: "50%", display: "inline-block" }} />}
                  SHOW
                </button>
              </div>
            </div>
          </div>

          {/* Setup técnico */}
          <div style={{ borderBottom: `0.5px solid ${T.border}` }}>
            <div style={{ padding: "10px 16px 8px", display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 12, color: T.text4 }}>🖥</span>
              <span style={{ fontSize: 10, fontWeight: 500, letterSpacing: "0.07em", textTransform: "uppercase", color: T.text4 }}>Setup técnico</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5px", background: T.border }}>
              <div style={{ padding: "10px 12px", background: T.card2 }}>
                <div style={{ fontSize: 10, fontWeight: 500, letterSpacing: "0.06em", textTransform: "uppercase", color: T.text4, marginBottom: 4 }}>Mesa</div>
                {art.console
                  ? <div style={{ fontSize: 14, fontWeight: 500, color: T.text, lineHeight: 1.3 }}>{noInfo(art.console)}</div>
                  : <div style={{ fontSize: 13, fontWeight: 400, color: T.text4, fontStyle: "italic" }}>Sin confirmar</div>}
              </div>
              <div style={{ padding: "10px 12px", background: T.card2 }}>
                <div style={{ fontSize: 10, fontWeight: 500, letterSpacing: "0.06em", textTransform: "uppercase", color: T.text4, marginBottom: 4 }}>Técnico</div>
                {art.tecnico
                  ? <div style={{ fontSize: 14, fontWeight: 500, color: T.text, lineHeight: 1.3 }}>{noInfo(art.tecnico)}</div>
                  : <div style={{ fontSize: 13, fontWeight: 400, color: T.text4, fontStyle: "italic" }}>Sin confirmar</div>}
              </div>
              <div style={{ padding: "10px 12px", background: T.card2, gridColumn: "1 / -1" }}>
                <div style={{ fontSize: 10, fontWeight: 500, letterSpacing: "0.06em", textTransform: "uppercase", color: T.text4, marginBottom: 4 }}>Preset</div>
                {art.preset
                  ? <div style={{ fontSize: 14, fontWeight: 500, color: art.presetOk ? "#16a34a" : T.text, lineHeight: 1.3 }}>
                      {noInfo(art.preset)}{art.presetOk && <span style={{ marginLeft: 6, fontSize: 11 }}>✓</span>}
                    </div>
                  : <div style={{ fontSize: 13, fontWeight: 400, color: T.text4, fontStyle: "italic" }}>Sin confirmar</div>}
              </div>
            </div>
          </div>

          {/* Conexiones */}
          <div style={{ borderBottom: `0.5px solid ${T.border}` }}>
            <div style={{ padding: "10px 16px 8px", display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 12, color: T.text4 }}>🔌</span>
              <span style={{ fontSize: 10, fontWeight: 500, letterSpacing: "0.07em", textTransform: "uppercase", color: T.text4 }}>Conexiones</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5px", background: T.border }}>
              <div style={{ padding: "10px 12px", background: T.card2 }}>
                <div style={{ fontSize: 10, fontWeight: 500, letterSpacing: "0.06em", textTransform: "uppercase", color: T.text4, marginBottom: 4 }}>Señal</div>
                {art.signal
                  ? <div style={{ fontSize: 14, fontWeight: 500, color: T.text, lineHeight: 1.3 }}>{noInfo(art.signal)}</div>
                  : <div style={{ fontSize: 13, fontWeight: 400, color: T.text4, fontStyle: "italic" }}>sin confirmar</div>}
              </div>
              <div style={{ padding: "10px 12px", background: T.card2 }}>
                <div style={{ fontSize: 10, fontWeight: 500, letterSpacing: "0.06em", textTransform: "uppercase", color: T.text4, marginBottom: 4 }}>Conexión</div>
                {art.connection
                  ? <div style={{ fontSize: 14, fontWeight: 500, color: T.text, lineHeight: 1.3 }}>{noInfo(art.connection)}</div>
                  : <div style={{ fontSize: 13, fontWeight: 400, color: T.text4, fontStyle: "italic" }}>sin confirmar</div>}
              </div>
            </div>
          </div>

          {/* Corriente */}
          {art.corriente && (
            <div style={{ borderBottom: `0.5px solid ${T.border}` }}>
              <div style={{ padding: "10px 16px 8px", display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontSize: 12, color: T.text4 }}>⚡</span>
                <span style={{ fontSize: 10, fontWeight: 500, letterSpacing: "0.07em", textTransform: "uppercase", color: T.text4 }}>Corriente</span>
              </div>
              <div style={{ padding: "0 12px 12px" }}>
                <div style={{ fontSize: 13, color: T.text, lineHeight: 1.5, padding: "8px 10px", background: T.card2, borderRadius: 8, whiteSpace: "pre-wrap" }}>{art.corriente}</div>
              </div>
            </div>
          )}

          {/* TO LX / TO MON */}
          {(art.toLx || art.toMon) && (
            <div style={{ borderBottom: "0.5px solid #e2e8f0" }}>
              <div style={{ padding: "10px 16px 8px", display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontSize: 10, fontWeight: 500, letterSpacing: "0.07em", textTransform: "uppercase", color: "#94a3b8" }}>Rutas</span>
              </div>
              <div style={{ padding: "0 12px 12px", display: "flex", flexDirection: "column", gap: 7 }}>
                {art.toLx && <RouteChip icon="💡" label="TO LX" value={noInfo(art.toLx)} color="#ea580c" />}
                {art.toMon && <RouteChip icon="🎧" label="TO MON" value={noInfo(art.toMon)} color="#7c3aed" />}
              </div>
            </div>
          )}

          {/* Extra slots estáticos del artista */}
          {(art.extraSlots || []).filter(s => s.label).length > 0 && (
            <div style={{ borderBottom: "0.5px solid #e2e8f0", padding: "0 12px 12px" }}>
              <div style={{ padding: "10px 4px 8px", fontSize: 10, fontWeight: 500, letterSpacing: "0.07em", textTransform: "uppercase", color: "#94a3b8" }}>Campos extra (artista)</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                {(art.extraSlots || []).filter(s => s.label).map(s => (
                  <RouteChip key={s.id} icon="📋" label={s.label} value={s.value || "—"} color="#2563eb" />
                ))}
              </div>
            </div>
          )}

          {/* Notas previas del artista */}
          {(art.comments || []).length > 0 && (
            <div style={{ borderBottom: "0.5px solid #e2e8f0", padding: "10px 16px 12px" }}>
              <div style={{ fontSize: 10, fontWeight: 500, letterSpacing: "0.07em", textTransform: "uppercase", color: "#94a3b8", marginBottom: 8 }}>Notas previas</div>
              {art.comments.map((c, i) => (
                <div key={i} style={{ fontSize: 13, color: "#475569", lineHeight: 1.5, padding: "6px 10px", background: "#f8fafc", borderLeft: "2px solid #cbd5e1", borderRadius: "0 6px 6px 0", marginBottom: 4 }}>{c}</div>
              ))}
            </div>
          )}

          <ExtraSlots slots={mySlots} onAdd={canEdit ? addSlot : null} onDel={canEdit ? delSlot : null} onEdit={canEdit ? editSlot : null} />
          <FohNotes notes={myNotes} onAdd={canEdit ? addNote : null} onDel={canEdit ? delNote : null} />
        </div>
      </div>
      {/* cierre menú gear al tocar fuera */}
      {artGearOpen && <div onClick={() => setArtGearOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 20 }} />}
      {/* popup confirmar borrado artista */}
      {confirmDeleteArt && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}
          onClick={() => setConfirmDeleteArt(false)}>
          <div style={{ background: T.card, borderRadius: 20, padding: 28, width: "100%", maxWidth: 340, boxShadow: "0 8px 40px rgba(0,0,0,0.3)" }}
            onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 32, textAlign: "center", marginBottom: 12 }}>🗑️</div>
            <div style={{ fontSize: 16, fontFamily: "'Bebas Neue',sans-serif", color: T.text, textAlign: "center", letterSpacing: "0.04em", marginBottom: 8 }}>¿Borrar artista?</div>
            <div style={{ fontSize: 13, color: T.text3, textAlign: "center", marginBottom: 24, lineHeight: 1.5 }}>
              Vas a borrar <strong style={{ color: T.text }}>{art.artist}</strong>. Esta acción no se puede deshacer.
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setConfirmDeleteArt(false)} style={{ flex: 1, padding: "14px", background: T.card2, border: `1px solid ${T.border}`, borderRadius: 12, fontSize: 14, cursor: "pointer", fontFamily: "'DM Mono',monospace", color: T.text2 }}>Cancelar</button>
              <button onClick={() => { deleteArtist(art.id); setConfirmDeleteArt(false); setSelectedId(null); }} style={{ flex: 1, padding: "14px", background: "#ef4444", border: "none", borderRadius: 12, fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "'DM Mono',monospace", color: "#fff" }}>Sí, borrar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  /* ---- list screen ---- */
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      <TopBar onBackBtn={onBack} />
      {tab === "rulos" ? (
        <div style={{ flex: 1, padding: "12px 14px", background: T.bg, overflowY: "auto", paddingBottom: "max(24px, env(safe-area-inset-bottom, 24px))" }}>
          <RulosView
            rulos={day.rulos || []}
            permRulos={stage.rulos || []}
            ruloOverrides={day.ruloOverrides || {}}
            onAdd={isOwner ? (pos) => { setEditRuloId(null); setShowRuloForm(true); setPrefillPos(pos || null); } : null}
            onEdit={isOwner ? (id) => { setEditRuloId(id); setShowRuloForm(true); setPrefillPos(null); } : null}
            onDelete={isOwner ? deleteRulo : null}
            onSaveOverride={(ruloId, desc) => {
              const newOverrides = { ...(day.ruloOverrides || {}), [ruloId]: { desc } };
              const newDays = stage.days.map((d, i) => i === dayIdx ? { ...d, ruloOverrides: newOverrides } : d);
              const newStages = (fest.stages || []).map(s => s.id === stage.id ? { ...s, days: newDays } : s);
              onEditFest({ ...fest, stages: newStages });
            }}
            onClearOverride={(ruloId) => {
              const newOverrides = { ...(day.ruloOverrides || {}) };
              delete newOverrides[ruloId];
              const newDays = stage.days.map((d, i) => i === dayIdx ? { ...d, ruloOverrides: newOverrides } : d);
              const newStages = (fest.stages || []).map(s => s.id === stage.id ? { ...s, days: newDays } : s);
              onEditFest({ ...fest, stages: newStages });
            }}
            dayLabel={day.label}
          />
        </div>
      ) : tab === "horarios" ? (
        <div style={{ flex: 1, padding: "12px 14px", background: T.bg, overflowY: "auto", paddingBottom: "max(24px, env(safe-area-inset-bottom, 24px))" }}>
          <HorariosView
            artists={artists}
            day={day}
            onSaveTime={saveArtistTime}
          />
        </div>
      ) : tab === "etapas" ? (
        <div style={{ flex: 1, background: T.bg, overflowY: "auto", paddingBottom: "max(24px, env(safe-area-inset-bottom, 24px))" }}>
          <EtapasView
            etapas={stage.etapas || []}
            onSave={(newEtapas) => {
              const newStages = (fest.stages || []).map(s => s.id === stage.id ? { ...s, etapas: newEtapas } : s);
              onEditFest({ ...fest, stages: newStages });
            }}
          />
        </div>
      ) : tab === "notas" ? (
        <div style={{ flex: 1, background: T.bg, overflowY: "auto", paddingBottom: "max(24px, env(safe-area-inset-bottom, 24px))" }}>
          <NotasDiaView
            festId={fest.id}
            stageId={stage.id}
            day={day}
            dayColor={PALETTE[dayIdx % PALETTE.length]}
            notes={notes}
            setNotes={setNotes}
          />
        </div>
      ) : (
        <div style={{ flex: 1, background: T.bg, overflowY: "auto", paddingBottom: "max(24px, env(safe-area-inset-bottom, 24px))" }}>
          {/* day title */}
          <div style={{ padding: "24px 20px 12px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <span style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: "2.8rem", letterSpacing: "0.04em", color: PALETTE[dayIdx % PALETTE.length], lineHeight: 1 }}>{day?.label || ""}</span>
              {day?.date && <span style={{ fontFamily: "'DM Mono',monospace", fontSize: "0.75rem", color: T.text4, letterSpacing: "0.1em" }}>{new Date(day.date + "T12:00").toLocaleDateString("es", { day: "numeric", month: "long" })} · {stage.name}</span>}
              {artists.length > 0 && (
                <button onClick={() => printHandoverPDF(artists, { festName: fest.name, stageName: stage.name, dayLabel: day.label, dayDate: day.date, notes, checks, slots, festId: fest.id, dayId: day.id })} title="Exportar PDF del día" style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", fontSize: 20, opacity: 0.5, lineHeight: 1, padding: "2px 4px" }} onMouseEnter={e => e.currentTarget.style.opacity = 1} onMouseLeave={e => e.currentTarget.style.opacity = 0.5}>🖨</button>
              )}
            </div>
          </div>
          {artists.length === 0 && (
            <div style={{ textAlign: "center", color: T.text4, fontSize: 13, marginTop: 40 }}>Sin artistas en este día</div>
          )}
          <div style={{ display: "flex", flexDirection: "column", gap: 16, padding: "0 14px" }}>
            {artists.map((a, i) => (
              <CompactArtistCard
                key={a.id}
                a={a}
                fest={fest}
                day={day}
                colorIdx={i}
                onSelect={setSelectedId}
              />
            ))}
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
            {isOwner && <button onClick={() => setShowAdd(true)} style={{ ...S.addBtn, flex: 1, marginTop: 0 }}>+ Añadir artista</button>}
            {isOwner && artists.length > 0 && stage.days.length > 1 && (
              <button onClick={() => { setShowCopy(true); setCopySelected({}); setCopyTargetDays({}); }} style={{ ...S.addBtn, flex: 1, marginTop: 0, color: "#7c3aed", borderColor: "#ddd6fe", background: "#f5f3ff" }}>
                Copiar al día →
              </button>
            )}
          </div>
        </div>
      )}

      {showCopy && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 200, display: "flex", alignItems: "flex-end", justifyContent: "center" }}
          onClick={() => setShowCopy(false)}>
          <div style={{ background: "#fff", borderRadius: "20px 20px 0 0", padding: 24, width: "100%", maxWidth: 480, boxShadow: "0 -4px 32px rgba(0,0,0,0.18)", maxHeight: "80dvh", overflowY: "auto" }}
            onClick={e => e.stopPropagation()}>
            <div style={{ width: 36, height: 4, background: "#e2e8f0", borderRadius: 2, margin: "0 auto 20px" }} />
            <div style={{ fontSize: 15, fontFamily: "'Bebas Neue',sans-serif", letterSpacing: "0.06em", color: "#0f172a", marginBottom: 4 }}>Copiar artistas</div>
            <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 16 }}>Selecciona los artistas a copiar y los días destino.</div>

            <div style={{ fontSize: 9, color: "#7c3aed", letterSpacing: "0.15em", fontWeight: 700, marginBottom: 8 }}>ARTISTAS ({day.label})</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 20 }}>
              {artists.map(a => (
                <label key={a.id} style={{ display: "flex", alignItems: "center", gap: 10, background: copySelected[a.id] ? "#f5f3ff" : "#f8fafc", border: `1px solid ${copySelected[a.id] ? "#c4b5fd" : "#e2e8f0"}`, borderRadius: 10, padding: "10px 12px", cursor: "pointer" }}>
                  <input type="checkbox" checked={!!copySelected[a.id]} onChange={e => setCopySelected(p => ({ ...p, [a.id]: e.target.checked }))} style={{ accentColor: "#7c3aed", width: 16, height: 16 }} />
                  <span style={{ fontSize: 13, color: "#334155", fontFamily: "monospace", fontWeight: 700 }}>{a.artist || "—"}</span>
                  <span style={{ fontSize: 11, color: "#94a3b8", marginLeft: "auto" }}>{a.console || ""}</span>
                </label>
              ))}
            </div>

            <div style={{ fontSize: 9, color: "#7c3aed", letterSpacing: "0.15em", fontWeight: 700, marginBottom: 8 }}>DÍAS DESTINO</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 24 }}>
              {stage.days.map((d, i) => {
                if (i === dayIdx) return null;
                const on = !!copyTargetDays[i];
                return (
                  <button key={d.id} onClick={() => setCopyTargetDays(p => ({ ...p, [i]: !p[i] }))} style={{
                    padding: "7px 16px", borderRadius: 20, fontSize: 12, fontFamily: "'Bebas Neue',sans-serif",
                    letterSpacing: "0.06em", cursor: "pointer", border: "none",
                    background: on ? "#7c3aed" : "#f1f5f9", color: on ? "#fff" : "#64748b",
                  }}>{d.label}</button>
                );
              })}
            </div>

            <button
              onClick={copyArtistsTodays}
              disabled={!Object.values(copySelected).some(Boolean) || !Object.values(copyTargetDays).some(Boolean)}
              style={{ width: "100%", padding: "14px", background: "#7c3aed", color: "#fff", border: "none", borderRadius: 12, fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "monospace", opacity: (Object.values(copySelected).some(Boolean) && Object.values(copyTargetDays).some(Boolean)) ? 1 : 0.4 }}>
              Copiar
            </button>
          </div>
        </div>
      )}

      {showRuloForm && (
        <RuloFormModal
          initial={editRuloId ? ([...(day.rulos || []), ...(stage.rulos || [])].find(r => r.id === editRuloId) || null) : null}
          prefillPos={prefillPos}
          onSave={saveRulo}
          onClose={() => { setShowRuloForm(false); setEditRuloId(null); setPrefillPos(null); }}
        />
      )}
      {showLog && <LogModal log={fest.log || []} festName={fest.name} onClose={() => setShowLog(false)} />}
    </div>
  );
}

export default FestView;
