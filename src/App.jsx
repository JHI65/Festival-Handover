import { useState, useEffect, useRef, useContext, createContext, useCallback } from "react";
import { supabase } from "./supabase";

/* ---------- seed ---------- */
const SEED = [{
  id: "ejemplo_fest", name: "FESTIVAL EJEMPLO",
  stages: [
    {
      id: "stage1", name: "ESCENARIO PRINCIPAL",
      days: [
        {
          id: "day1", label: "DÍA 1", artists: [
            { id: "s1", artist: "ARTISTA A", console: "SSL 9000", connection: "OPTO DUO 1/2 (point-point)", signal: "AES 1/2", preset: "ARTISTA A", presetOk: true, toLx: "SMPT 1 (naranja)", toMon: "", tecnico: "Local", comments: ["Mesa compartida con artista siguiente", "Señal de video directo desde FOH"], extraSlots: [{ id: "e1", label: "RF", value: "Shure ULXD4Q · CH 38-40" }] },
            { id: "s2", artist: "ARTISTA B", console: "DiGiCo SD10", connection: "MADI 1-4 Festival Box", signal: "MADI", preset: "INITIAL", presetOk: false, toLx: "TIMECODE", toMon: "CH16 → MON WORLD", tecnico: "Banda", comments: [], extraSlots: [] },
            { id: "s3", artist: "ARTISTA C", console: "Avid S6L", connection: "HMA 1/2 (ALL DAY)", signal: "AES 3/4", preset: "INITIAL", presetOk: false, toLx: "", toMon: "", tecnico: "", comments: [], extraSlots: [] },
          ]
        },
        {
          id: "day2", label: "DÍA 2", artists: [
            { id: "s4", artist: "ARTISTA D", console: "Yamaha PM5", connection: "RJ 1/2 SP (Festival Box)", signal: "AES 1/2", preset: "ARTISTA D", presetOk: true, toLx: "SMPT 1 & 2", toMon: "", tecnico: "Local", comments: ["Comparte GAIN con monitor"], extraSlots: [] },
            { id: "s5", artist: "ARTISTA E", console: "DiGiCo SD7", connection: "OPTO DUO (anillo)", signal: "AES 3/4", preset: "INITIAL", presetOk: false, toLx: "", toMon: "", tecnico: "", comments: [], extraSlots: [{ id: "e2", label: "IEM", value: "Sennheiser 2000 · CH 28" }] },
          ]
        },
      ]
    },
  ],
}];

/* ---------- migration: normaliza fest al modelo con stages ---------- */
function normalizeFest(f) {
  // Nuevo formato: days es { _stages: [...] }
  if (f.days && !Array.isArray(f.days) && Array.isArray(f.days._stages)) {
    return { ...f, stages: f.days._stages, log: f.days._log || [], roles: f.days._roles || {} };
  }
  // Ya tiene stages (en memoria, tras normalizar)
  if (Array.isArray(f.stages)) return { ...f, log: f.log || [], roles: f.roles || {} };
  // Legacy: days es array → migrar a un stage por defecto
  return { ...f, stages: [{ id: "stage_default", name: "ESCENARIO PRINCIPAL", days: Array.isArray(f.days) ? f.days : [] }], log: [], roles: {} };
}

function getUserRole(fest, userId) {
  if (!fest || !userId) return "viewer";
  if (fest.user_id === userId) return "owner";
  return fest.roles?.[userId] || "editor";
}

/* ---------- theme ---------- */
const ThemeCtx = createContext({ dark: false, toggle: () => {} });
const useTheme = () => useContext(ThemeCtx);
const LT = { bg: "#F5EFE0", card: "#fff", card2: "#FAF6EE", border: "#D8CEB8", border2: "#EDE6D4", text: "#1A1410", text2: "#3D2B1F", text3: "#7A6652", text4: "#B0A090" };
const DK = { bg: "#1A1410", card: "#261E18", card2: "#1A1410", border: "#3D2B1F", border2: "#261E18", text: "#F5EFE0", text2: "#D8CEB8", text3: "#B0A090", text4: "#7A6652" };

/* ---------- helpers ---------- */
function sigColor(s) {
  const t = (s || "").toUpperCase();
  if (t.includes("AES")) return "#2563eb";
  if (t.includes("MADI")) return "#ea580c";
  if (t.includes("OPTO")) return "#16a34a";
  if (t.includes("XLR")) return "#db2777";
  if (t.includes("RJ")) return "#7c3aed";
  return "#64748b";
}
const uid = () => Math.random().toString(36).slice(2, 9);
const PALETTE = ["#C94A2A", "#2A6B6B", "#D4A843", "#7B5EA7", "#1E6B8C", "#B85C38", "#3D7A5C", "#8C4A6B"];
// Festival 24h sort: hours 00-05 are treated as "next day" (after midnight)
function festTimeToMin(t) {
  if (!t) return Infinity;
  const [h, m] = t.split(":").map(Number);
  return (h < 6 ? h + 24 : h) * 60 + (m || 0);
}
const noInfo = v => v === "?" ? "NO INFO" : v;
function mkLog(userEmail, action, detail) {
  return { ts: new Date().toISOString(), user: userEmail || "?", action, detail: detail || "" };
}
function withLog(fest, entry) {
  return { ...fest, log: [...(fest.log || []).slice(-999), entry] };
}

/* ---------- PDF export ---------- */
function printHandoverPDF(artists, { festName, stageName, dayLabel, dayDate, notes, checks, slots, festId, dayId }) {
  const dateStr = dayDate ? new Date(dayDate + "T12:00").toLocaleDateString("es", { day: "numeric", month: "long", year: "numeric" }) : "";
  const field = (label, value) => value
    ? `<div class="field"><span class="label">${label}</span><span class="value">${value}</span></div>`
    : `<div class="field"><span class="label">${label}</span><span class="value empty">Sin confirmar</span></div>`;

  const artistBlocks = artists.map(art => {
    const ckey = `${festId}__${dayId}__${art.id}`;
    const scDone = !!checks[`${ckey}__sc`];
    const showDone = !!checks[`${ckey}__show`];
    const myNotes = notes[ckey] || [];
    const mySlots = slots[ckey] || [];
    const extraStatic = (art.extraSlots || []).filter(s => s.label);
    const comments = art.comments || [];

    return `
      <div class="artist-block">
        <div class="artist-header">
          <div class="artist-name">${art.artist || "—"}</div>
          <div class="pills">
            <span class="pill ${scDone ? "pill-ok" : ""}">SC${scDone ? " ✓" : ""}</span>
            <span class="pill ${showDone ? "pill-show" : ""}">SHOW${showDone ? " ✓" : ""}</span>
          </div>
        </div>

        <div class="section-title">Setup técnico</div>
        <div class="grid2">
          ${field("Mesa", art.console)}
          ${field("Técnico", art.tecnico)}
          <div class="field full-width">
            <span class="label">Preset</span>
            <span class="value ${art.presetOk ? "preset-ok" : ""}">${art.preset || "Sin confirmar"}${art.presetOk ? " ✓" : ""}</span>
          </div>
        </div>

        <div class="section-title">Conexiones</div>
        <div class="grid2">
          ${field("Señal", art.signal)}
          ${field("Conexión", art.connection)}
        </div>

        ${art.corriente ? `<div class="section-title">Corriente</div><div class="note-block">${art.corriente}</div>` : ""}

        ${(art.toLx || art.toMon) ? `
          <div class="section-title">Rutas</div>
          <div class="grid2">
            ${art.toLx ? `<div class="route-chip">💡 TO LX &nbsp;<strong>${art.toLx}</strong></div>` : ""}
            ${art.toMon ? `<div class="route-chip">🎧 TO MON &nbsp;<strong>${art.toMon}</strong></div>` : ""}
          </div>` : ""}

        ${extraStatic.length ? `
          <div class="section-title">Campos extra</div>
          <div class="grid2">
            ${extraStatic.map(s => `<div class="route-chip">📋 ${s.label} &nbsp;<strong>${s.value || "—"}</strong></div>`).join("")}
          </div>` : ""}

        ${comments.length ? `
          <div class="section-title">Notas previas</div>
          ${comments.map(c => `<div class="note-block">${c}</div>`).join("")}` : ""}

        ${mySlots.length ? `
          <div class="section-title">Slots en directo</div>
          <div class="grid2">
            ${mySlots.map(s => `<div class="route-chip">📋 ${s.label} &nbsp;<strong>${s.value || "—"}</strong></div>`).join("")}
          </div>` : ""}

        ${myNotes.length ? `
          <div class="section-title">Notas FOH</div>
          ${myNotes.map(n => `<div class="note-block">${n.text}</div>`).join("")}` : ""}
      </div>`;
  }).join('<div class="page-break"></div>');

  const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">
  <title>Handover – ${festName} · ${stageName} · ${dayLabel}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Arial', sans-serif; font-size: 12px; color: #1a1a1a; background: #fff; padding: 24px; }
    .doc-header { border-bottom: 3px solid #C94A2A; padding-bottom: 12px; margin-bottom: 20px; }
    .doc-title { font-size: 22px; font-weight: 700; letter-spacing: 0.05em; text-transform: uppercase; }
    .doc-sub { font-size: 11px; color: #666; margin-top: 4px; letter-spacing: 0.08em; text-transform: uppercase; }
    .artist-block { margin-bottom: 0; }
    .artist-header { display: flex; justify-content: space-between; align-items: center; background: #1A1410; color: #F5EFE0; padding: 10px 14px; border-radius: 6px 6px 0 0; margin-bottom: 1px; }
    .artist-name { font-size: 16px; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase; }
    .pills { display: flex; gap: 6px; }
    .pill { font-size: 10px; padding: 3px 10px; border-radius: 99px; border: 1px solid #555; color: #aaa; font-weight: 600; }
    .pill-ok { background: #dcfce7; color: #166534; border-color: #86efac; }
    .pill-show { background: #dbeafe; color: #1e40af; border-color: #93c5fd; }
    .section-title { font-size: 9px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: #888; padding: 8px 14px 4px; background: #fafafa; border-left: 3px solid #C94A2A; margin: 1px 0; }
    .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 1px; background: #e5e7eb; margin-bottom: 1px; }
    .field { padding: 8px 12px; background: #fff; }
    .full-width { grid-column: 1 / -1; }
    .label { display: block; font-size: 9px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: #888; margin-bottom: 3px; }
    .value { font-size: 13px; font-weight: 500; }
    .value.empty { font-style: italic; color: #aaa; font-weight: 400; font-size: 12px; }
    .preset-ok { color: #16a34a; }
    .route-chip { padding: 8px 12px; background: #fff; font-size: 12px; }
    .note-block { font-size: 12px; line-height: 1.5; padding: 7px 12px; background: #f8fafc; border-left: 2px solid #cbd5e1; margin: 1px 0; }
    .page-break { page-break-after: always; margin: 20px 0; }
    .footer { margin-top: 20px; font-size: 10px; color: #aaa; text-align: right; border-top: 1px solid #e5e7eb; padding-top: 8px; }
    @media print {
      body { padding: 12px; }
      .page-break { margin: 0; }
    }
  </style></head><body>
  <div class="doc-header">
    <div class="doc-title">${festName}</div>
    <div class="doc-sub">${stageName} · ${dayLabel}${dateStr ? " · " + dateStr : ""}</div>
  </div>
  ${artistBlocks}
  <div class="footer">Generado: ${new Date().toLocaleString("es")}</div>
  </body></html>`;

  const w = window.open("", "_blank");
  if (!w) return;
  w.document.write(html);
  w.document.close();
  w.focus();
  setTimeout(() => { w.print(); }, 400);
}

/* ---------- Supabase storage ---------- */
async function loadFests(userId) {
  const { data } = await supabase
    .from("festivals")
    .select("*")
    .or(`user_id.eq.${userId},members.cs.{${userId}}`)
    .order("created_at", { ascending: true });
  return (data || []).map(normalizeFest);
}

function festToDB(fest) {
  // Serializa stages en el campo days del schema existente
  return { _stages: fest.stages || [], _log: fest.log || [], _roles: fest.roles || {} };
}

async function insertFest(userId, fest) {
  const { error } = await supabase.from("festivals").insert({
    id: fest.id,
    user_id: userId,
    name: fest.name,
    days: festToDB(fest),
    members: [],
  });
  if (error) console.error("insertFest error:", error);
}

async function updateFestRow(fest) {
  const { error } = await supabase
    .from("festivals")
    .update({ name: fest.name, days: festToDB(fest) })
    .eq("id", fest.id);
  if (error) console.error("updateFestRow error:", error);
}

async function saveFest(userId, fest) {
  // Si la fila ya existe en DB (tiene user_id), UPDATE; si no, INSERT.
  if (fest.user_id) {
    await updateFestRow(fest);
  } else {
    await insertFest(userId, fest);
  }
}

async function deleteFest(festId) {
  await supabase.from("festivals").delete().eq("id", festId);
}

async function joinFestAsMember(festId) {
  // SECURITY DEFINER function bypasea RLS para que el usuario se pueda añadir
  // aunque aún no esté en members
  const { data, error } = await supabase.rpc("join_festival", { festival_id: festId });
  if (error) console.error("join_festival error:", error);
  return !error;
}

// Helpers para notes/checks/slots compartidos en la fila del festival
// Las keys tienen formato `${festId}__${dayId}__${artId}__...`
function pickFestId(key) {
  return (key || "").split("__")[0];
}
function filterByFest(obj, festId) {
  const out = {};
  for (const k in obj) if (pickFestId(k) === festId) out[k] = obj[k];
  return out;
}
function mergeSharedFromFests(fests) {
  const notes = {}, checks = {}, slots = {};
  for (const f of fests || []) {
    Object.assign(notes, f.notes || {});
    Object.assign(checks, f.checks || {});
    Object.assign(slots, f.slots || {});
  }
  return { notes, checks, slots };
}
// Union de arrays de notas por ts — nunca se pierden notas de ningún técnico
function mergeNoteArrays(remote, local) {
  const remTs = new Set((remote || []).map(n => n.ts));
  const combined = [...(remote || []), ...(local || []).filter(n => !remTs.has(n.ts))];
  combined.sort((a, b) => a.ts - b.ts);
  return combined;
}
// Merge de slots por id — los locales ganan, los remotos no presentes se conservan
function mergeSlotArrays(remote, local) {
  const locIds = new Set((local || []).map(s => s.id));
  return [...(local || []), ...(remote || []).filter(s => !locIds.has(s.id))];
}
async function saveFestShared(festId, localNotes, localChecks, localSlots, changedNoteKeys = [], changedSlotKeys = []) {
  const { data } = await supabase
    .from("festivals")
    .select("notes, checks, slots")
    .eq("id", festId)
    .maybeSingle();

  const rN = data?.notes || {};
  const rC = data?.checks || {};
  const rS = data?.slots || {};

  const lN = filterByFest(localNotes, festId);
  const lC = filterByFest(localChecks, festId);
  const lS = filterByFest(localSlots, festId);

  // Notes: para keys que el usuario acaba de cambiar, hacer union por ts
  const mergedN = { ...rN, ...lN };
  for (const key of changedNoteKeys) {
    if (lN[key] !== undefined) mergedN[key] = mergeNoteArrays(rN[key], lN[key]);
  }

  // Checks: local gana (sabemos exactamente qué toggle se hizo)
  const mergedC = { ...rC, ...lC };

  // Slots: para keys cambiadas, merge por id (local gana)
  const mergedS = { ...rS, ...lS };
  for (const key of changedSlotKeys) {
    if (lS[key] !== undefined) mergedS[key] = mergeSlotArrays(rS[key], lS[key]);
  }

  const { error } = await supabase
    .from("festivals")
    .update({ notes: mergedN, checks: mergedC, slots: mergedS })
    .eq("id", festId);
  if (error) console.error("saveFestShared error:", error);
}

async function loadUserData(userId) {
  const { data } = await supabase
    .from("user_data")
    .select("notes, checks, slots")
    .eq("user_id", userId)
    .maybeSingle();
  return data || { notes: {}, checks: {}, slots: {} };
}

async function saveUserData(userId, notes, checks, slots) {
  await supabase.from("user_data").upsert({
    user_id: userId,
    notes,
    checks,
    slots,
  });
}

/* ============================================================ */
export default function App() {
  const [session, setSession] = useState(undefined);
  const [isOnline, setIsOnline] = useState(() => navigator.onLine);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const goOnline = () => setIsOnline(true);
    const goOffline = () => setIsOnline(false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => { window.removeEventListener('online', goOnline); window.removeEventListener('offline', goOffline); };
  }, []);

  if (session === undefined) return <Splash />;
  return (
    <>
      {!isOnline && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 99999, background: "#7C3A1A", color: "#F5EFE0", fontFamily: "'DM Mono',monospace", fontSize: 12, textAlign: "center", padding: "8px 16px", letterSpacing: "0.08em" }}>
          SIN CONEXIÓN — mostrando últimos datos guardados
        </div>
      )}
      {!session ? <LoginScreen /> : <Main session={session} offlineBannerOffset={!isOnline} />}
    </>
  );
}

/* ---------- login ---------- */
const INSTALL_STEPS = {
  ios: [
    <>"Compartir" <span style={{ color: "#D4A843" }}>⎙</span> en la barra inferior</>,
    <>"<span style={{ color: "#D4A843" }}>Añadir a pantalla de inicio</span>"</>,
    <>Pulsa "<span style={{ color: "#D4A843" }}>Añadir</span>"</>,
  ],
  android: [
    <>Menú <span style={{ color: "#D4A843" }}>⋮</span> arriba a la derecha</>,
    <>"<span style={{ color: "#D4A843" }}>Añadir a pantalla de inicio</span>"</>,
    <>Pulsa "<span style={{ color: "#D4A843" }}>Instalar</span>"</>,
  ],
};

function InstallSteps({ icon, title, steps }) {
  return (
    <div style={{ background: "rgba(245,239,224,0.05)", borderRadius: 16, padding: "16px 18px", border: "1px solid rgba(245,239,224,0.08)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <span style={{ fontSize: 18 }}>{icon}</span>
        <span style={{ fontSize: 13, color: "#F5EFE0", fontFamily: "'DM Sans',sans-serif", fontWeight: 700 }}>{title}</span>
      </div>
      {steps.map((step, t) => (
        <div key={t} style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: t < 2 ? 8 : 0 }}>
          <div style={{ width: 20, height: 20, borderRadius: "50%", background: "rgba(212,168,67,0.18)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, color: "#D4A843", fontFamily: "'DM Mono',monospace", flexShrink: 0, marginTop: 1 }}>{t + 1}</div>
          <div style={{ fontSize: 13, color: "#9A8772", fontFamily: "'DM Sans',sans-serif", lineHeight: 1.45 }}>{step}</div>
        </div>
      ))}
    </div>
  );
}

function LoginScreen() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showInstall, setShowInstall] = useState(
    () => !(window.navigator.standalone || window.matchMedia("(display-mode: standalone)").matches)
  );

  useEffect(() => {
    const el = document.documentElement;
    el.style.backgroundImage = "url('./bg-login.jpg')";
    el.style.backgroundSize = "cover";
    el.style.backgroundPosition = "center 30%";
    el.style.backgroundRepeat = "no-repeat";
    return () => {
      el.style.backgroundImage = "";
      el.style.backgroundSize = "";
      el.style.backgroundPosition = "";
      el.style.backgroundRepeat = "";
    };
  }, []);

  async function loginWithGoogle() {
    setLoading(true);
    setError(null);
    const sp = new URLSearchParams(window.location.search);
    const joinParam = sp.get("join") || sp.get("fest");
    const redirectTo = window.location.origin + "/Festival-Handover/" + (joinParam ? `?join=${encodeURIComponent(joinParam)}` : "");
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo },
    });
    if (error) { setError(error.message); setLoading(false); }
  }

  return (
    <div style={{ minHeight: "100vh", position: "relative", overflow: "hidden", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24, fontFamily: "'DM Sans',sans-serif" }}>
      <Style />
      <div style={{ position: "absolute", inset: 0, backgroundImage: "url('./bg-login.jpg')", backgroundSize: "cover", backgroundPosition: "center 30%", zIndex: 0 }} />
      <div style={{ position: "absolute", inset: 0, background: "linear-gradient(160deg, rgba(10,7,5,0.45) 0%, rgba(15,10,7,0.55) 100%)", zIndex: 0 }} />

      <div className="lg-card" style={{ position: "relative", zIndex: 1, width: "100%", maxWidth: 380, background: "rgba(28,22,17,0.10)", border: "1px solid rgba(245,239,224,0.15)", borderRadius: 20, padding: "44px 34px 30px", boxShadow: "0 30px 80px rgba(0,0,0,0.55), inset 0 1px 0 rgba(245,239,224,0.05)", backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)", textAlign: "center" }}>
        <div style={{ width: 72, height: 72, margin: "0 auto 22px", borderRadius: 18, background: "linear-gradient(145deg, #221A14, #14100B)", border: "1px solid rgba(245,239,224,0.10)", boxShadow: "0 8px 24px rgba(0,0,0,0.45), inset 0 1px 0 rgba(245,239,224,0.06)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div className="lg-mark" style={{ display: "flex", alignItems: "center", gap: 4, height: 32 }}>
            <span /><span /><span /><span /><span />
          </div>
        </div>
        <div style={{ fontSize: 11, color: "#B0A090", letterSpacing: "0.32em", fontFamily: "'DM Mono',monospace", marginBottom: 10 }}>FESTIVAL HANDOVER</div>
        <div style={{ fontSize: 46, lineHeight: 1, fontFamily: "'Bebas Neue',sans-serif", color: "#F5EFE0", letterSpacing: "0.04em", marginBottom: 12 }}>
          TUS <span style={{ color: "#D4A843" }}>FESTIVALES</span>
        </div>
        <div style={{ fontSize: 13, color: "#9A8772", marginBottom: 30, fontFamily: "'DM Sans',sans-serif", lineHeight: 1.5 }}>
          Gestiona y sincroniza tus handovers de sonido en tiempo real con todo tu equipo.
        </div>
        <button onClick={loginWithGoogle} disabled={loading} className="lg-btn" style={{
          display: "flex", alignItems: "center", gap: 12,
          background: "#F5EFE0", border: "none", borderRadius: 12,
          padding: "15px 24px", fontSize: 14, fontWeight: 700,
          fontFamily: "'DM Mono',monospace", cursor: loading ? "not-allowed" : "pointer",
          opacity: loading ? 0.6 : 1, color: "#1A1410",
          boxShadow: "0 4px 18px rgba(0,0,0,0.4)",
          width: "100%", justifyContent: "center",
        }}>
          <GoogleIcon />
          {loading ? "Conectando…" : "Continuar con Google"}
        </button>
        {error && (
          <div style={{ marginTop: 16, padding: "10px 14px", borderRadius: 10, background: "rgba(201,74,42,0.12)", border: "1px solid rgba(201,74,42,0.3)", color: "#E58A6E", fontSize: 12, textAlign: "center", fontFamily: "'DM Mono',monospace" }}>{error}</div>
        )}
      </div>

      {showInstall && (
        <div onClick={() => setShowInstall(false)} style={{ position: "fixed", inset: 0, zIndex: 100, background: "rgba(10,7,5,0.30)", backdropFilter: "blur(3px)", WebkitBackdropFilter: "blur(3px)", display: "flex", alignItems: "center", justifyContent: "center", padding: "24px 20px", animation: "lg-fade .3s cubic-bezier(.2,.7,.3,1) both" }}>
          <div onClick={e => e.stopPropagation()} style={{ width: "100%", maxWidth: 360, background: "linear-gradient(160deg, #2E2318, #1E1610)", border: "1px solid rgba(245,239,224,0.14)", borderRadius: 28, padding: "30px 26px 26px", boxShadow: "0 24px 80px rgba(0,0,0,0.7), inset 0 1px 0 rgba(245,239,224,0.08)", textAlign: "center" }}>
            <div style={{ fontSize: 44, marginBottom: 14, lineHeight: 1 }}>📲</div>
            <div style={{ fontSize: 11, color: "#C94A2A", letterSpacing: "0.25em", fontFamily: "'DM Mono',monospace", marginBottom: 6 }}>INSTALAR APP</div>
            <div style={{ fontSize: 26, fontFamily: "'Bebas Neue',sans-serif", color: "#F5EFE0", letterSpacing: "0.04em", marginBottom: 8 }}>Úsala como app nativa</div>
            <div style={{ fontSize: 13, color: "#9A8772", fontFamily: "'DM Sans',sans-serif", lineHeight: 1.6, marginBottom: 24 }}>
              Añádela a tu pantalla de inicio para abrirla en pantalla completa, sin barras del navegador.
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12, textAlign: "left", marginBottom: 24 }}>
              <InstallSteps icon="🍎" title="iPhone / iPad — Safari" steps={INSTALL_STEPS.ios} />
              <InstallSteps icon="🤖" title="Android — Chrome" steps={INSTALL_STEPS.android} />
            </div>
            <button onClick={() => setShowInstall(false)} className="lg-btn" style={{ width: "100%", padding: "15px", borderRadius: 14, background: "#D4A843", border: "none", color: "#1A1410", fontFamily: "'DM Mono',monospace", fontSize: 13, fontWeight: 700, cursor: "pointer", letterSpacing: "0.12em", boxShadow: "0 4px 18px rgba(212,168,67,0.3)" }}>¡ENTENDIDO!</button>
          </div>
        </div>
      )}
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18">
      <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"/>
      <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"/>
      <path fill="#FBBC05" d="M3.964 10.707A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.707V4.961H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.039l3.007-2.332z"/>
      <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.961L3.964 7.293C4.672 5.163 6.656 3.58 9 3.58z"/>
    </svg>
  );
}

/* ---------- main app (autenticado) ---------- */
function Main({ session, offlineBannerOffset }) {
  const userId = session.user.id;
  const isOnline = () => navigator.onLine;

  const [fests, setFestsState] = useState(null);
  const [festId, setFestId] = useState(null);
  const [stageId, setStageId] = useState(null);
  const [monId, setMonId] = useState(null);
  const [dayIdx, setDayIdx] = useState(0);
  const [artIdx, setArtIdx] = useState(0);
  const [notes, setNotesState] = useState({});
  const [checks, setChecksState] = useState({});
  const [slots, setSlotsState] = useState({});
  const notesRef = useRef({});
  const checksRef = useRef({});
  const slotsRef = useRef({});
  const festsRef = useRef([]);
  const dirtyFestIds = useRef(new Set());
  const [conflictToast, setConflictToast] = useState(false);
  const conflictTimerRef = useRef(null);
  const [screen, setScreen] = useState("home");
  const [lastSync, setLastSync] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem("theme") === "dark");
  const toggleDark = () => setDarkMode(d => { const n = !d; localStorage.setItem("theme", n ? "dark" : "light"); return n; });

  function setNotes(n) { notesRef.current = n; setNotesState(n); }
  function setChecks(c) { checksRef.current = c; setChecksState(c); }
  function setSlots(s) { slotsRef.current = s; setSlotsState(s); }
  function setFests(f) { festsRef.current = f; setFestsState(f); }

  function showConflictToast() {
    setConflictToast(true);
    if (conflictTimerRef.current) clearTimeout(conflictTimerRef.current);
    conflictTimerRef.current = setTimeout(() => setConflictToast(false), 3000);
  }

  useEffect(() => {
    (async () => {
      try {
      // Check URL for shared festival
      const searchParams = new URLSearchParams(window.location.search);
      const hashParams = new URLSearchParams(window.location.hash.replace(/^#\??/, ""));
      // ?join=<id>[&role=viewer|editor] (new short format) or legacy ?fest=<base64>
      const joinId = searchParams.get("join") || hashParams.get("join");
      const joinRole = searchParams.get("role") || hashParams.get("role") || "editor";
      const legacyFest = searchParams.get("fest") || hashParams.get("fest");

      let f = await loadFests(userId);

      // Reemplazar seed antiguo si existe
      const oldSeedId = "cooltural25";
      if (f.some(x => x.id === oldSeedId)) {
        await deleteFest(oldSeedId);
        f = f.filter(x => x.id !== oldSeedId);
      }

      if (f.length === 0) {
        for (const fest of SEED) await saveFest(userId, fest);
        f = await loadFests(userId);
      }

      if (joinId) {
        // New short format: ?join=<festId>[&role=viewer|editor]
        const ok = await joinFestAsMember(joinId);
        if (ok) {
          f = await loadFests(userId);
          // Guardar rol si es viewer (editor es el default, no hace falta escribirlo)
          if (joinRole === "viewer") {
            const joined = f.find(x => x.id === joinId);
            if (joined && joined.user_id !== userId) {
              const updatedRoles = { ...joined.roles, [userId]: "viewer" };
              await updateFestRow({ ...joined, roles: updatedRoles });
              f = f.map(x => x.id === joinId ? { ...x, roles: updatedRoles } : x);
            }
          }
        } else console.error("No se pudo unir al festival compartido");
        window.history.replaceState({}, "", window.location.pathname);
      } else if (legacyFest) {
        // Legacy format: ?fest=<base64 JSON>
        try {
          const imported = JSON.parse(decodeURIComponent(escape(atob(legacyFest))));
          if (imported && imported.id) {
            const ok = await joinFestAsMember(imported.id);
            if (ok) f = await loadFests(userId);
            else console.error("No se pudo unir al festival compartido");
          }
        } catch (err) {
          console.error("Error importando festival compartido:", err);
        }
        window.history.replaceState({}, "", window.location.pathname);
      }

      const sd = mergeSharedFromFests(f);
      setFests(f);
      setNotes(sd.notes);
      setChecks(sd.checks);
      setSlots(sd.slots);
      setLastSync(new Date());
      } catch (err) {
        setLoadError(err.message || "Error al cargar datos");
      }
    })();
  }, [userId]);

  // Realtime: recarga datos cuando cambia cualquier festival accesible
  useEffect(() => {
    const channel = supabase
      .channel("festivals-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "festivals" },
        async () => {
          const f = await loadFests(userId);
          const sd = mergeSharedFromFests(f);
          // No sobreescribir festivales con cambios locales pendientes
          const merged = f.map(remote => {
            if (dirtyFestIds.current.has(remote.id)) {
              return festsRef.current.find(loc => loc.id === remote.id) || remote;
            }
            return remote;
          });
          setFests(merged);

          // Merge de notas: conservar notas locales no guardadas aún
          const prevNotes = notesRef.current;
          const mergedNotes = { ...sd.notes };
          for (const key in prevNotes) {
            if (Array.isArray(prevNotes[key]) && Array.isArray(sd.notes[key])) {
              mergedNotes[key] = mergeNoteArrays(sd.notes[key], prevNotes[key]);
            }
          }

          const notesChanged = JSON.stringify(mergedNotes) !== JSON.stringify(prevNotes);
          const checksChanged = JSON.stringify(sd.checks) !== JSON.stringify(checksRef.current);
          const slotsChanged = JSON.stringify(sd.slots) !== JSON.stringify(slotsRef.current);

          if (notesChanged) setNotes(mergedNotes);
          if (checksChanged) setChecks(sd.checks);
          if (slotsChanged) setSlots(sd.slots);
          if (notesChanged || checksChanged || slotsChanged) showConflictToast();
          setLastSync(new Date());
        }
      )
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [userId]);

  // Sincronizar cambios offline cuando se vuelve online
  useEffect(() => {
    const handleOnline = async () => {
      // Esperar 1.5s a que la conexión se estabilice completamente
      await new Promise(r => setTimeout(r, 1500));

      try {
        // 1. Primero guardar cambios estructurales (stages, artists)
        for (const fid of dirtyFestIds.current) {
          const fest = festsRef.current.find(f => f.id === fid);
          if (fest) await saveFest(userId, fest);
        }
        dirtyFestIds.current.clear();

        // 2. Luego guardar notes/checks/slots
        const allFestIds = new Set();
        [...Object.keys(notesRef.current), ...Object.keys(checksRef.current), ...Object.keys(slotsRef.current)]
          .forEach(k => {
            const fid = pickFestId(k);
            if (fid) allFestIds.add(fid);
          });

        for (const fid of allFestIds) {
          await saveFestShared(fid, notesRef.current, checksRef.current, slotsRef.current);
        }

        setLastSync(new Date());
        console.log("✓ Cambios offline sincronizados");
      } catch (err) {
        console.error("Error sincronizando cambios offline:", err);
      }
    };

    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [userId]);

  async function refresh() {
    const f = await loadFests(userId);
    const sd = mergeSharedFromFests(f);
    setFests(f);
    setNotes(sd.notes);
    setChecks(sd.checks);
    setSlots(sd.slots);
    setLastSync(new Date());
  }

  async function persistFests(next) {
    setFests(next);
  }

  async function addFest(fest) {
    await saveFest(userId, fest);
    // Marcar user_id en el estado local para que próximas ediciones hagan UPDATE
    setFests([...festsRef.current, { ...fest, user_id: userId, members: [] }]);
  }

  async function removeFest(id) {
    await deleteFest(id);
    setFests(festsRef.current.filter(f => f.id !== id));
  }

  async function updateFest(updated) {
    setFests(festsRef.current.map(f => f.id === updated.id ? updated : f));
    if (!navigator.onLine) {
      dirtyFestIds.current.add(updated.id);
      return;
    }
    await saveFest(userId, updated);
  }

  async function updateNotes(n) {
    const changedKeys = Object.keys(n).filter(k => JSON.stringify(n[k]) !== JSON.stringify(notesRef.current[k]));
    setNotes(n);
    if (!navigator.onLine) return;
    const fids = new Set([...Object.keys(n), ...Object.keys(notes)].map(pickFestId));
    for (const fid of fids) if (fid) {
      const fChangedKeys = changedKeys.filter(k => pickFestId(k) === fid);
      await saveFestShared(fid, n, checks, slots, fChangedKeys, []);
    }
  }

  async function toggleCheck(ckey) {
    const next = { ...checks, [ckey]: !checks[ckey] };
    setChecks(next);
    if (!navigator.onLine) return;
    const fid = pickFestId(ckey);
    if (fid) await saveFestShared(fid, notes, next, slots, [], []);
  }

  async function updateSlots(sl) {
    const changedKeys = Object.keys(sl).filter(k => JSON.stringify(sl[k]) !== JSON.stringify(slotsRef.current[k]));
    setSlots(sl);
    if (!navigator.onLine) return;
    const fids = new Set([...Object.keys(sl), ...Object.keys(slots)].map(pickFestId));
    for (const fid of fids) if (fid) {
      const fChangedKeys = changedKeys.filter(k => pickFestId(k) === fid);
      await saveFestShared(fid, notes, checks, sl, [], fChangedKeys);
    }
  }

  async function logout() {
    await supabase.auth.signOut();
  }

  if (loadError) return (
    <div style={{ minHeight: "100vh", background: "#1A1410", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24, fontFamily: "'DM Mono',monospace", gap: 16 }}>
      <Style />
      <div style={{ fontSize: 32 }}>⚠️</div>
      <div style={{ color: "#C94A2A", fontSize: 13, textAlign: "center", maxWidth: 340 }}>
        <strong>Error al conectar con la base de datos</strong><br /><br />
        {loadError}<br /><br />
        <span style={{ color: "#B0A090", fontSize: 11 }}>
          Asegúrate de haber ejecutado el SQL en Supabase y de tener las tablas <code>festivals</code> y <code>user_data</code> creadas.
        </span>
      </div>
      <button onClick={() => supabase.auth.signOut()} style={{ marginTop: 8, background: "#F5EFE0", border: "none", borderRadius: 4, padding: "10px 20px", cursor: "pointer", fontSize: 13 }}>
        Cerrar sesión
      </button>
    </div>
  );
  if (!fests) return <Splash />;
  const fest = fests.find(f => f.id === festId);
  const stage = fest && stageId ? (fest.stages || []).find(s => s.id === stageId) : null;

  const S = makeS(darkMode ? DK : LT);
  return (
    <ThemeCtx.Provider value={{ dark: darkMode, toggle: toggleDark }}>
      <Style dark={darkMode} />
      <div style={{ ...S.app, paddingTop: offlineBannerOffset ? 33 : undefined }}>
        {screen === "home" && (
          <Home
            fests={fests}
            user={session.user}
            userId={userId}
            onOpen={(id) => { setFestId(id); setScreen("stages"); }}
            onNew={() => setScreen("builder")}
            onDelete={removeFest}
            onEdit={updateFest}
            onLogout={logout}
          />
        )}
        {screen === "stages" && fest && (
          <StageView
            fest={fest}
            userEmail={session.user.email}
            userRole={getUserRole(fest, userId)}
            onBack={() => setScreen("home")}
            onEditFest={updateFest}
            onOpenStage={(sid) => { setStageId(sid); setDayIdx(0); setScreen("view"); }}
            onOpenMon={(sid, mid) => { setStageId(sid); setMonId(mid); setDayIdx(0); setScreen("mon"); }}
            onOpenEscenario={(sid) => { setStageId(sid); setScreen("escenario"); }}
          />
        )}
        {screen === "builder" && (
          <Builder
            onCancel={() => setScreen("home")}
            onSave={async (obj) => { await addFest(obj); setScreen("home"); }}
          />
        )}
        {screen === "view" && fest && stage && (
          <FestView
            fest={fest}
            stage={stage}
            userEmail={session.user.email}
            userRole={getUserRole(fest, userId)}
            dayIdx={dayIdx} setDayIdx={setDayIdx}
            notes={notes} setNotes={updateNotes}
            checks={checks} toggleCheck={toggleCheck}
            slots={slots} setSlots={updateSlots}
            onEditFest={updateFest}
            onBack={() => setScreen("stages")}
            onRefresh={refresh}
            lastSync={lastSync}
          />
        )}
        {screen === "mon" && fest && stage && (() => {
          const monPos = (stage.monPositions || []).find(p => p.id === monId);
          return monPos ? (
            <MonView
              fest={fest}
              stage={stage}
              monPos={monPos}
              dayIdx={dayIdx}
              setDayIdx={setDayIdx}
              onEditFest={updateFest}
              onBack={() => setScreen("stages")}
            />
          ) : null;
        })()}
        {screen === "escenario" && fest && stage && (
          <EscenarioView
            fest={fest}
            stage={stage}
            onEditFest={updateFest}
            onBack={() => setScreen("stages")}
            onDelete={() => {
              const newStages = (fest.stages || []).map(s => s.id === stage.id ? { ...s, escenario: undefined } : s);
              updateFest({ ...fest, stages: newStages });
              setScreen("stages");
            }}
          />
        )}
        {conflictToast && (
          <div style={{ position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)", background: darkMode ? "#2A2420" : "#1A1410", color: "#D4A843", fontFamily: "'DM Mono',monospace", fontSize: 12, padding: "10px 18px", borderRadius: 20, boxShadow: "0 4px 20px rgba(0,0,0,0.4)", zIndex: 9999, pointerEvents: "none", animation: "lg-fade .25s ease both", letterSpacing: "0.05em" }}>
            ↕ Cambios recibidos de otro técnico
          </div>
        )}
      </div>
    </ThemeCtx.Provider>
  );
}

/* ---------- splash ---------- */
function Splash() {
  return (
    <div style={{ minHeight: "100vh", background: "#F5EFE0", display: "flex", alignItems: "center", justifyContent: "center", color: "#B0A090", fontFamily: "'DM Mono',monospace" }}>
      <Style />
      cargando…
    </div>
  );
}

/* ---------- home ---------- */
function Home({ fests, user, userId, onOpen, onNew, onDelete, onEdit, onLogout }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [confirmId, setConfirmId] = useState(null);
  const [editFestId, setEditFestId] = useState(null);
  const { dark, toggle } = useTheme();
  const T = dark ? DK : LT;
  const S = makeS(T);

  return (
    <div style={{ height: "100dvh", display: "flex", flexDirection: "column", padding: "20px 20px 24px", overflow: "hidden", background: T.bg }}
      onClick={() => { menuOpen && setMenuOpen(false); }}>

      {/* header */}
      <div style={{ position: "relative", marginBottom: 20, flexShrink: 0 }}>
        {/* gear top-left */}
        <div style={{ position: "absolute", top: 0, left: 0 }}>
          <button
            onClick={e => { e.stopPropagation(); setEditMode(m => !m); }}
            style={{
              width: 38, height: 38, borderRadius: "50%", border: `2px solid ${T.border}`,
              background: editMode ? "#fef2f2" : T.card2, cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 16, color: editMode ? "#ef4444" : T.text3,
              transition: "all 0.15s",
            }}
          >⚙️</button>
        </div>
        {/* avatar top-right */}
        <div style={{ position: "absolute", top: 0, right: 0 }}>
          <img
            src={user.user_metadata?.avatar_url || "https://ui-avatars.com/api/?name=U&background=e2e8f0&color=64748b"}
            alt=""
            onClick={e => { e.stopPropagation(); setMenuOpen(o => !o); }}
            style={{ width: 38, height: 38, borderRadius: "50%", border: "2px solid #e2e8f0", cursor: "pointer", display: "block" }}
          />
          {menuOpen && (
            <div onClick={e => e.stopPropagation()} style={{
              position: "absolute", right: 0, top: 46, background: T.card,
              border: `1px solid ${T.border}`, borderRadius: 12, boxShadow: "0 4px 20px rgba(0,0,0,0.18)",
              padding: "6px", minWidth: 180, zIndex: 50,
            }}>
              <div style={{ padding: "8px 12px 10px", borderBottom: `1px solid ${T.border2}`, marginBottom: 4 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: T.text }}>{user.user_metadata?.full_name || user.email}</div>
                <div style={{ fontSize: 11, color: T.text4, marginTop: 2 }}>{user.email}</div>
              </div>
              <button onClick={toggle} style={{
                width: "100%", padding: "10px 12px", background: "none", border: "none",
                borderRadius: 8, color: T.text3, fontSize: 13, cursor: "pointer",
                textAlign: "left", fontFamily: "'DM Mono',monospace",
                display: "flex", alignItems: "center", justifyContent: "space-between",
              }}>
                <span>{dark ? "☀️ Modo claro" : "🌙 Modo oscuro"}</span>
                <span style={{
                  fontSize: 11, padding: "2px 8px", borderRadius: 99,
                  background: dark ? "#334155" : "#f1f5f9",
                  color: dark ? "#94a3b8" : "#64748b",
                }}>{dark ? "oscuro" : "claro"}</span>
              </button>
              <div style={{ height: 1, background: T.border2, margin: "2px 0" }} />
              <button onClick={onLogout} style={{
                width: "100%", padding: "10px 12px", background: "none", border: "none",
                borderRadius: 8, color: "#ef4444", fontSize: 13, cursor: "pointer",
                textAlign: "left", fontFamily: "'DM Mono',monospace",
              }}>Cerrar sesión</button>
            </div>
          )}
        </div>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 11, color: T.text4, letterSpacing: "0.2em", marginBottom: 2 }}>FOH HANDOVER</div>
          <div style={{ fontSize: 32, fontFamily: "'Bebas Neue',sans-serif", color: T.text, letterSpacing: "0.05em", lineHeight: 1 }}>
            TUS <span style={{ color: "#D4A843" }}>FESTIVALES</span>
          </div>
        </div>
      </div>

      {/* lista festivales */}
      <div style={{ flex: 1, overflowY: "auto", marginBottom: 14 }}>
        {fests.map(f => {
          const total = (f.stages || []).reduce((s, st) => s + st.days.reduce((a, d) => a + d.artists.length, 0), 0);
          const fRole = getUserRole(f, userId);
          const fIsOwner = fRole === "owner";
          return (
            <div key={f.id} style={{ ...S.festCard, background: T.card, border: `1px solid ${T.border}`, position: "relative", overflow: "visible" }}
              onClick={() => { if (!editMode) onOpen(f.id); }}>
              {/* slot izquierdo — siempre ocupa el mismo espacio */}
              <div style={{ width: 32, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                {editMode && fIsOwner && (
                  <button
                    onClick={e => { e.stopPropagation(); setConfirmId(f.id); }}
                    style={{
                      width: 28, height: 28, borderRadius: "50%", border: "none",
                      background: "#ef4444", color: "#fff", fontSize: 20, lineHeight: 1,
                      cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                      boxShadow: "0 2px 8px rgba(239,68,68,0.4)",
                      fontWeight: 700, flexShrink: 0,
                    }}
                  >−</button>
                )}
              </div>
              {/* nombre siempre centrado */}
              <div style={{ flex: 1, minWidth: 0, textAlign: "center" }}>
                <div style={{ fontSize: 18, fontFamily: "'Bebas Neue',sans-serif", color: T.text, letterSpacing: "0.04em", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{f.name}</div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, marginTop: 2 }}>
                  <span style={{ fontSize: 12, color: T.text4 }}>{(f.stages || []).length} stages · {total} artistas</span>
                  {!fIsOwner && <span style={{ fontSize: 9, fontFamily: "'DM Mono',monospace", letterSpacing: "0.08em", padding: "1px 6px", borderRadius: 4, background: fRole === "viewer" ? "#e0e7ff" : "#f0fdf4", color: fRole === "viewer" ? "#3730a3" : "#166534" }}>{fRole === "viewer" ? "VISOR" : "EDITOR"}</span>}
                </div>
              </div>
              {/* slot derecho — mismo ancho que el izquierdo */}
              <div style={{ width: 32, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                {editMode && fIsOwner ? (
                  <button
                    onClick={e => { e.stopPropagation(); setEditFestId(f.id); }}
                    style={{
                      width: 28, height: 28, borderRadius: "50%", border: "none",
                      background: "#D4A843", color: "#fff", fontSize: 14, lineHeight: 1,
                      cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                      boxShadow: "0 2px 8px rgba(245,158,11,0.4)",
                      flexShrink: 0,
                    }}
                  >✏️</button>
                ) : (
                  <span style={{ color: "#cbd5e1", fontSize: 18 }}>›</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <button onClick={onNew} style={{ ...S.bigBtn, marginTop: 0, flexShrink: 0 }}>+ CREAR FESTIVAL</button>

      {/* popup confirmación borrado */}
      {confirmId && (() => {
        const fest = fests.find(f => f.id === confirmId);
        return (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}
            onClick={() => setConfirmId(null)}>
            <div style={{ background: T.card, borderRadius: 20, padding: 28, width: "100%", maxWidth: 340, boxShadow: "0 8px 40px rgba(0,0,0,0.3)" }}
              onClick={e => e.stopPropagation()}>
              <div style={{ fontSize: 32, textAlign: "center", marginBottom: 12 }}>🗑️</div>
              <div style={{ fontSize: 16, fontFamily: "'Bebas Neue',sans-serif", color: T.text, textAlign: "center", letterSpacing: "0.04em", marginBottom: 8 }}>
                ¿Borrar festival?
              </div>
              <div style={{ fontSize: 13, color: T.text3, textAlign: "center", marginBottom: 24, lineHeight: 1.5 }}>
                Vas a borrar <strong style={{ color: T.text }}>{fest?.name}</strong>. Esta acción no se puede deshacer.
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                <button onClick={() => setConfirmId(null)} style={{ flex: 1, padding: "14px", background: T.card2, border: `1px solid ${T.border}`, borderRadius: 12, fontSize: 14, cursor: "pointer", fontFamily: "'DM Mono',monospace", color: T.text2 }}>
                  Cancelar
                </button>
                <button onClick={() => { onDelete(confirmId); setConfirmId(null); setEditMode(false); }} style={{ flex: 1, padding: "14px", background: "#ef4444", border: "none", borderRadius: 12, fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "'DM Mono',monospace", color: "#fff" }}>
                  Sí, borrar
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* modal editar festival */}
      {editFestId && (() => {
        const fest = fests.find(f => f.id === editFestId);
        return (
          <FestEditModal
            fest={fest}
            onSave={updated => { onEdit(updated); setEditFestId(null); }}
            onClose={() => setEditFestId(null)}
          />
        );
      })()}
    </div>
  );
}

/* ---------- builder helpers ---------- */
function BuilderNotes({ comments, onAdd, onDel }) {
  const [draft, setDraft] = useState("");
  const { dark } = useTheme(); const T = dark ? DK : LT; const S = makeS(T);
  return (
    <div style={{ marginTop: 10 }}>
      <div style={{ fontSize: 9, color: T.text4, letterSpacing: "0.1em", marginBottom: 6 }}>NOTAS PREVIAS</div>
      {comments.map((c, i) => (
        <div key={i} style={{ display: "flex", gap: 6, alignItems: "flex-start", marginBottom: 5 }}>
          <div style={{ flex: 1, fontSize: 13, color: T.text3, lineHeight: 1.4, padding: "7px 10px", background: T.card2, borderLeft: `2px solid ${T.border}`, borderRadius: "0 6px 6px 0" }}>{c}</div>
          <button onClick={() => onDel(i)} style={S.iconBtn}>×</button>
        </div>
      ))}
      <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
        <input value={draft} onChange={e => setDraft(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") { onAdd(draft); setDraft(""); } }}
          placeholder="Añadir nota…" style={{ ...S.input, flex: 1 }} />
        <button onClick={() => { onAdd(draft); setDraft(""); }} style={{ ...S.smBtn, flexShrink: 0 }}>+</button>
      </div>
    </div>
  );
}

/* ---------- builder ---------- */
function Builder({ onCancel, onSave }) {
  const [name, setName] = useState("");
  const [days, setDays] = useState([{ id: uid(), label: "DÍA 1", artists: [] }]);
  const [expDay, setExpDay] = useState(0);

  const addDay = () => { setDays([...days, { id: uid(), label: `DÍA ${days.length + 1}`, artists: [] }]); setExpDay(days.length); };
  const setDayLabel = (i, v) => { const d = [...days]; d[i].label = v; setDays(d); };
  const delDay = (i) => { setDays(days.filter((_, idx) => idx !== i)); setExpDay(0); };

  const addArtist = (di) => {
    const d = [...days];
    d[di].artists.push({ id: uid(), artist: "", console: "", connection: "", signal: "", preset: "INITIAL", presetOk: false, toLx: "", toMon: "", comments: [], extraSlots: [] });
    setDays(d);
  };
  const setAF = (di, ai, k, v) => { const d = [...days]; d[di].artists[ai][k] = v; setDays(d); };
  const delArtist = (di, ai) => { const d = [...days]; d[di].artists.splice(ai, 1); setDays(d); };

  const addExtraSlot = (di, ai) => {
    const d = [...days];
    d[di].artists[ai].extraSlots = [...(d[di].artists[ai].extraSlots || []), { id: uid(), label: "", value: "" }];
    setDays(d);
  };
  const setES = (di, ai, sid, fld, val) => {
    const d = [...days];
    d[di].artists[ai].extraSlots = (d[di].artists[ai].extraSlots || []).map(s => s.id === sid ? { ...s, [fld]: val } : s);
    setDays(d);
  };
  const delES = (di, ai, sid) => {
    const d = [...days];
    d[di].artists[ai].extraSlots = (d[di].artists[ai].extraSlots || []).filter(s => s.id !== sid);
    setDays(d);
  };
  const addComment = (di, ai, t) => {
    if (!t.trim()) return;
    const d = [...days]; d[di].artists[ai].comments = [...(d[di].artists[ai].comments || []), t.trim()]; setDays(d);
  };
  const delComment = (di, ai, ci) => {
    const d = [...days]; d[di].artists[ai].comments = d[di].artists[ai].comments.filter((_, idx) => idx !== ci); setDays(d);
  };

  const valid = name.trim() && days.some(d => d.artists.length);
  const { dark } = useTheme(); const T = dark ? DK : LT; const S = makeS(T);

  return (
    <div style={{ padding: "20px 16px 40px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
        <button onClick={onCancel} style={S.backBtn}>‹</button>
        <div style={{ fontSize: 18, fontFamily: "'Bebas Neue',sans-serif", color: T.text, letterSpacing: "0.05em" }}>NUEVO FESTIVAL</div>
      </div>

      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 10, color: T.text4, letterSpacing: "0.1em", marginBottom: 6 }}>NOMBRE</div>
        <input value={name} onChange={e => setName(e.target.value)} placeholder="Ej: Mad Cool 26" style={S.input} />
      </div>

      {days.map((d, di) => (
        <div key={d.id} style={S.daySection}>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input value={d.label} onChange={e => setDayLabel(di, e.target.value)} style={{ ...S.input, flex: 1, fontWeight: 700 }} />
            <button onClick={() => setExpDay(expDay === di ? -1 : di)} style={S.smBtn}>{expDay === di ? "▾" : "▸"}</button>
            {days.length > 1 && <button onClick={() => delDay(di)} style={S.iconBtn}>🗑</button>}
          </div>
          <div style={{ fontSize: 10, color: T.text4, marginTop: 4 }}>{d.artists.length} artistas</div>

          {expDay === di && (
            <div style={{ marginTop: 10 }}>
              {d.artists.map((a, ai) => (
                <div key={a.id} style={S.artForm}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                    <span style={{ fontSize: 10, color: "#D4A843", letterSpacing: "0.1em", fontWeight: 700 }}>ARTISTA {ai + 1}</span>
                    <button onClick={() => delArtist(di, ai)} style={S.iconBtn}>×</button>
                  </div>
                  <input value={a.artist} onChange={e => setAF(di, ai, "artist", e.target.value)} placeholder="Nombre artista" style={{ ...S.input, marginBottom: 6 }} />
                  <div style={{ display: "flex", gap: 6, marginBottom: 6 }}>
                    <input value={a.console} onChange={e => setAF(di, ai, "console", e.target.value)} placeholder="Consola" style={S.input} />
                    <input value={a.signal} onChange={e => setAF(di, ai, "signal", e.target.value)} placeholder="Señal" style={S.input} />
                  </div>
                  <input value={a.connection} onChange={e => setAF(di, ai, "connection", e.target.value)} placeholder="Conexión" style={{ ...S.input, marginBottom: 6 }} />
                  <div style={{ display: "flex", gap: 6, marginBottom: 6 }}>
                    <input value={a.toLx} onChange={e => setAF(di, ai, "toLx", e.target.value)} placeholder="TO LX" style={S.input} />
                    <input value={a.toMon} onChange={e => setAF(di, ai, "toMon", e.target.value)} placeholder="TO MON" style={S.input} />
                  </div>
                  <div style={{ display: "flex", gap: 6, marginBottom: 6, alignItems: "center" }}>
                    <input value={a.preset} onChange={e => setAF(di, ai, "preset", e.target.value)} placeholder="Preset" style={{ ...S.input, flex: 1 }} />
                    <button onClick={() => setAF(di, ai, "presetOk", !a.presetOk)} style={{
                      ...S.smBtn, background: a.presetOk ? "#dcfce7" : "#f1f5f9",
                      color: a.presetOk ? "#16a34a" : "#94a3b8", border: `1px solid ${a.presetOk ? "#86efac" : "#e2e8f0"}`,
                    }}>{a.presetOk ? "✓ OK" : "preset?"}</button>
                  </div>

                  <div style={{ marginTop: 10 }}>
                    <div style={{ fontSize: 9, color: dark ? "#93c5fd" : "#2563eb", letterSpacing: "0.1em", marginBottom: 6 }}>CAMPOS EXTRA</div>
                    {(a.extraSlots || []).map(s => (
                      <div key={s.id} style={{ display: "flex", gap: 6, marginBottom: 6 }}>
                        <input value={s.label} onChange={e => setES(di, ai, s.id, "label", e.target.value)} placeholder="Etiqueta (RF…)" style={{ ...S.input, flex: 1 }} />
                        <input value={s.value} onChange={e => setES(di, ai, s.id, "value", e.target.value)} placeholder="Valor" style={{ ...S.input, flex: 1.5 }} />
                        <button onClick={() => delES(di, ai, s.id)} style={S.iconBtn}>×</button>
                      </div>
                    ))}
                    <button onClick={() => addExtraSlot(di, ai)} style={{ ...S.addBtn, color: "#2563eb", borderColor: "#bfdbfe", background: "#eff6ff" }}>+ Campo</button>
                  </div>

                  <BuilderNotes
                    comments={a.comments || []}
                    onAdd={t => addComment(di, ai, t)}
                    onDel={ci => delComment(di, ai, ci)}
                  />
                </div>
              ))}
              <button onClick={() => addArtist(di)} style={S.addBtn}>+ Añadir artista</button>
            </div>
          )}
        </div>
      ))}

      <button onClick={addDay} style={{ ...S.addBtn, marginTop: 12 }}>+ Añadir día</button>
      <button onClick={() => valid && onSave({ id: uid(), name: name.trim(), stages: [{ id: uid(), name: "ESCENARIO PRINCIPAL", days }] })} disabled={!valid}
        style={{ ...S.bigBtn, marginTop: 24, opacity: valid ? 1 : 0.4 }}>
        GUARDAR FESTIVAL
      </button>
    </div>
  );
}

/* ---------- stage view ---------- */
function StageView({ fest, userEmail, userRole, onBack, onEditFest, onOpenStage, onOpenMon, onOpenEscenario }) {
  const isOwner = userRole === "owner";
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState("");
  const [selectedStage, setSelectedStage] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [renamingId, setRenamingId] = useState(null);
  const [renameVal, setRenameVal] = useState("");
  const [showShare, setShowShare] = useState(false);
  const [viewTab, setViewTab] = useState("stages"); // "stages" | "horarios"
  const [showDayAdd, setShowDayAdd] = useState(false);
  const [newDayLabel, setNewDayLabel] = useState("");
  const [newDayDate, setNewDayDate] = useState("");
  const dayLabelRefs = useRef([]);
  const { dark } = useTheme(); const T = dark ? DK : LT; const S = makeS(T);

  function addMonPosition() {
    const existing = activeStage.monPositions || [];
    const baseName = "MON WORLD";
    let name = baseName;
    let n = 2;
    while (existing.some(p => p.name === name)) { name = `${baseName} ${n++}`; }
    const newPos = { id: uid(), name, console: "", tecnico: "", inputs: [], outputs: [], rfEntries: [] };
    const newStages = (fest.stages || []).map(s => s.id === activeStage.id
      ? { ...s, monPositions: [...existing, newPos] }
      : s
    );
    onEditFest({ ...fest, stages: newStages });
  }

  function deleteMonPosition(mid) {
    const newStages = (fest.stages || []).map(s => s.id === activeStage.id
      ? { ...s, monPositions: (s.monPositions || []).filter(p => p.id !== mid) }
      : s
    );
    onEditFest({ ...fest, stages: newStages });
  }

  function deleteEscenario() {
    const newStages = (fest.stages || []).map(s =>
      s.id === activeStage.id ? { ...s, escenario: undefined } : s
    );
    onEditFest({ ...fest, stages: newStages });
  }

  function addDayToStage(stageId, label, date) {
    const st = (fest.stages || []).find(s => s.id === stageId);
    if (!st) return;
    const newDay = { id: uid(), label: (label || `DÍA ${st.days.length + 1}`).toUpperCase(), artists: [], ...(date ? { date } : {}) };
    const newStages = (fest.stages || []).map(s => s.id === stageId ? { ...s, days: [...s.days, newDay] } : s);
    onEditFest(withLog({ ...fest, stages: newStages }, mkLog(userEmail, "ADD_DAY", newDay.label)));
  }

  function deleteDayFromStage(stageId, dayId) {
    const newStages = (fest.stages || []).map(s => s.id === stageId ? { ...s, days: s.days.filter(d => d.id !== dayId) } : s);
    onEditFest(withLog({ ...fest, stages: newStages }, mkLog(userEmail, "DEL_DAY", dayId)));
  }

  function updateDayDate(stageId, dayId, date) {
    const newStages = (fest.stages || []).map(s => s.id === stageId ? { ...s, days: s.days.map(d => d.id === dayId ? { ...d, date } : d) } : s);
    onEditFest({ ...fest, stages: newStages });
  }

  function updateDayLabel(stageId, dayId, label) {
    if (!label.trim()) return;
    const newStages = (fest.stages || []).map(s => s.id === stageId ? { ...s, days: s.days.map(d => d.id === dayId ? { ...d, label: label.trim().toUpperCase() } : d) } : s);
    onEditFest({ ...fest, stages: newStages });
  }

  function addStage() {
    if (!newName.trim()) return;
    const stageName = newName.trim().toUpperCase();
    const newStage = { id: uid(), name: stageName, days: [{ id: uid(), label: "DÍA 1", artists: [] }] };
    onEditFest(withLog({ ...fest, stages: [...(fest.stages || []), newStage] }, mkLog(userEmail, "ADD_STAGE", stageName)));
    setNewName("");
    setShowAdd(false);
  }

  function deleteStage(sid) {
    const stageName = (fest.stages || []).find(s => s.id === sid)?.name || sid;
    onEditFest(withLog({ ...fest, stages: (fest.stages || []).filter(s => s.id !== sid) }, mkLog(userEmail, "DEL_STAGE", stageName)));
    if (selectedStage === sid) setSelectedStage(null);
  }

  const totalForStage = (st) => st.days.reduce((a, d) => a + d.artists.length, 0);
  const activeStage = selectedStage ? (fest.stages || []).find(s => s.id === selectedStage) : null;
  const hasFoh = activeStage ? totalForStage(activeStage) > 0 : false;
  const hasEscenario = activeStage ? ((activeStage.escenario?.inputs?.length || 0) > 0 || (activeStage.escenario?.power?.length || 0) > 0) : false;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100dvh", overflow: "hidden" }}>
      {/* top bar */}
      <div style={{ ...S.topBar, padding: "10px 12px 10px" }}>
        <button onClick={selectedStage ? () => setSelectedStage(null) : onBack} style={S.backBtn}>‹</button>
        <div style={{ flex: 1, textAlign: "center", fontSize: 18, fontFamily: "'Bebas Neue',sans-serif", color: T.text, letterSpacing: "0.06em" }}>
          {activeStage ? activeStage.name : fest.name}
        </div>
        <button onClick={() => setShowShare(true)} style={S.syncBtn}>
          <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49" stroke="currentColor" strokeWidth="2"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49" stroke="currentColor" strokeWidth="2"/></svg>
        </button>
      </div>

      <div style={{ flex: 1, padding: "16px 14px", background: T.bg, overflowY: "auto", paddingBottom: "max(24px, env(safe-area-inset-bottom, 24px))" }}>

        {activeStage ? (
          <div>
            <div style={{ fontSize: 10, letterSpacing: "0.08em", color: T.text4, textTransform: "uppercase", marginBottom: 14 }}>POSICIONES</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {/* FOH — solo si tiene artistas */}
              {hasFoh && (
                <button
                  onClick={() => onOpenStage(activeStage.id)}
                  style={{ display: "flex", alignItems: "center", gap: 14, background: "#1A1410", border: "none", borderLeft: "4px solid #C94A2A", borderRadius: 4, padding: "16px 20px", cursor: "pointer", textAlign: "left" }}>
                  <div style={{ width: 36, height: 36, borderRadius: 4, background: "rgba(201,74,42,0.15)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>🎛️</div>
                  <div>
                    <div style={{ fontSize: 15, fontFamily: "'Bebas Neue',sans-serif", color: "#F5EFE0", letterSpacing: "0.08em" }}>FOH</div>
                    <div style={{ fontSize: 11, color: "#B0A090", marginTop: 1, fontFamily: "'DM Mono',monospace" }}>{totalForStage(activeStage)} artistas · {activeStage.days.length} días</div>
                  </div>
                </button>
              )}
              {/* MON positions — encima de Escenario */}
              {(activeStage.monPositions || []).map(mp => (
                <div key={mp.id} style={{ display: "flex", alignItems: "center", gap: 10, position: "relative" }}>
                  <button
                    onClick={() => onOpenMon(activeStage.id, mp.id)}
                    style={{ flex: 1, display: "flex", alignItems: "center", gap: 14, background: "#1A1410", border: "none", borderLeft: "4px solid #D4A843", borderRadius: 4, padding: "16px 20px", cursor: "pointer", textAlign: "left" }}>
                    <div style={{ width: 36, height: 36, borderRadius: 4, background: "rgba(212,168,67,0.15)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>🎧</div>
                    <div>
                      <div style={{ fontSize: 15, fontFamily: "'Bebas Neue',sans-serif", color: "#F5EFE0", letterSpacing: "0.08em" }}>{mp.name}</div>
                      <div style={{ fontSize: 11, color: "#B0A090", marginTop: 1, fontFamily: "'DM Mono',monospace" }}>
                        {(mp.inputs || []).length} inputs · {(mp.outputs || []).length} outputs · {(mp.rfEntries || []).length} RF
                      </div>
                    </div>
                  </button>
                  {editMode && (
                    <button onClick={() => deleteMonPosition(mp.id)} style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "#ef4444", border: "none", borderRadius: 4, color: "#fff", fontSize: 14, width: 28, height: 28, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>×</button>
                  )}
                </div>
              ))}
              {/* ESCENARIO — solo si tiene contenido, debajo de MON */}
              {hasEscenario && (
                <div style={{ display: "flex", alignItems: "center", gap: 10, position: "relative" }}>
                <button
                  onClick={() => !editMode && onOpenEscenario(activeStage.id)}
                  style={{ flex: 1, display: "flex", alignItems: "center", gap: 14, background: "#1A1410", border: "none", borderLeft: "4px solid #2A6B6B", borderRadius: 4, padding: "16px 20px", cursor: editMode ? "default" : "pointer", textAlign: "left" }}>
                  <div style={{ width: 36, height: 36, borderRadius: 4, background: "rgba(42,107,107,0.15)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#2A6B6B" strokeWidth="1.6" strokeLinecap="round">
                      <circle cx="12" cy="12" r="9"/>
                      <circle cx="12" cy="7" r="1.4" fill="#2A6B6B" stroke="none"/>
                      <circle cx="8.2" cy="15" r="1.4" fill="#2A6B6B" stroke="none"/>
                      <circle cx="15.8" cy="15" r="1.4" fill="#2A6B6B" stroke="none"/>
                    </svg>
                  </div>
                  <div>
                    <div style={{ fontSize: 15, fontFamily: "'Bebas Neue',sans-serif", color: "#F5EFE0", letterSpacing: "0.08em" }}>NUEVA POSICIÓN DE ESCENARIO</div>
                    <div style={{ fontSize: 11, color: "#B0A090", marginTop: 1, fontFamily: "'DM Mono',monospace" }}>
                      {(activeStage.escenario?.inputs || []).length} inputs · {(activeStage.escenario?.power || []).length} grupos corriente
                    </div>
                  </div>
                </button>
                {editMode && (
                  <button onClick={() => deleteEscenario()} style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "#ef4444", border: "none", borderRadius: 4, color: "#fff", fontSize: 14, width: 28, height: 28, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>×</button>
                )}
                </div>
              )}
              {/* Añadir posiciones */}
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {!hasFoh && (
                    <button onClick={() => onOpenStage(activeStage.id)} style={{ display: "flex", alignItems: "center", gap: 14, background: T.card, border: `1.5px dashed ${T.border}`, borderRadius: 4, padding: "14px 20px", cursor: "pointer", textAlign: "left", width: "100%" }}>
                      <div style={{ width: 32, height: 32, borderRadius: 4, background: T.card2, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, flexShrink: 0 }}>🎛️</div>
                      <div>
                        <div style={{ fontSize: 13, fontFamily: "'Bebas Neue',sans-serif", color: T.text3, letterSpacing: "0.08em" }}>AÑADIR FOH</div>
                        <div style={{ fontSize: 11, color: T.text4, marginTop: 1, fontFamily: "'DM Mono',monospace" }}>Gestión de consola y artistas</div>
                      </div>
                    </button>
                  )}
                  {!hasEscenario && (
                    <button onClick={() => onOpenEscenario(activeStage.id)} style={{ display: "flex", alignItems: "center", gap: 14, background: T.card, border: `1.5px dashed ${T.border}`, borderRadius: 4, padding: "14px 20px", cursor: "pointer", textAlign: "left", width: "100%" }}>
                      <div style={{ width: 32, height: 32, borderRadius: 4, background: T.card2, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={T.text3} strokeWidth="1.6" strokeLinecap="round">
                          <circle cx="12" cy="12" r="9"/>
                          <circle cx="12" cy="7" r="1.4" fill={T.text3} stroke="none"/>
                          <circle cx="8.2" cy="15" r="1.4" fill={T.text3} stroke="none"/>
                          <circle cx="15.8" cy="15" r="1.4" fill={T.text3} stroke="none"/>
                        </svg>
                      </div>
                      <div>
                        <div style={{ fontSize: 13, fontFamily: "'Bebas Neue',sans-serif", color: T.text3, letterSpacing: "0.08em" }}>AÑADIR ESCENARIO</div>
                        <div style={{ fontSize: 11, color: T.text4, marginTop: 1, fontFamily: "'DM Mono',monospace" }}>Inputs, corriente y plano</div>
                      </div>
                    </button>
                  )}
                  <button onClick={addMonPosition} style={{ display: "flex", alignItems: "center", gap: 14, background: T.card, border: `1.5px dashed ${T.border}`, borderRadius: 4, padding: "14px 20px", cursor: "pointer", textAlign: "left", width: "100%" }}>
                    <div style={{ width: 32, height: 32, borderRadius: 4, background: T.card2, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, flexShrink: 0 }}>🎧</div>
                    <div>
                      <div style={{ fontSize: 13, fontFamily: "'Bebas Neue',sans-serif", color: T.text3, letterSpacing: "0.08em" }}>AÑADIR MONITORES</div>
                      <div style={{ fontSize: 11, color: T.text4, marginTop: 1, fontFamily: "'DM Mono',monospace" }}>Nueva posición de monitores</div>
                    </div>
                  </button>
                </div>
            </div>
          </div>
        ) : (
          <>
            {/* Tab switcher: STAGES | HORARIOS */}
            <div style={{ display: "flex", gap: 4, background: T.card2, borderRadius: 10, padding: 3, marginBottom: 14 }}>
              {[{ id: "stages", label: "STAGES" }, { id: "horarios", label: "HORARIOS" }].map(t => (
                <button key={t.id} onClick={() => setViewTab(t.id)} style={{
                  flex: 1, padding: "5px 14px", borderRadius: 8, fontSize: 11,
                  fontFamily: "'Bebas Neue',sans-serif", letterSpacing: "0.06em", cursor: "pointer",
                  border: "none",
                  background: viewTab === t.id ? (dark ? "#334155" : "#0f172a") : "transparent",
                  color: viewTab === t.id ? "#fff" : T.text4,
                  transition: "all 0.2s",
                }}>{t.label}</button>
              ))}
            </div>

            {viewTab === "horarios" ? (
              <GeneralScheduleView fest={fest} />
            ) : (
            <>
            <div style={{ display: "flex", alignItems: "center", marginBottom: 12 }}>
              {isOwner && <button onClick={() => { setEditMode(m => !m); setRenamingId(null); }} style={{
                background: editMode ? "#fef2f2" : T.card2, border: `1px solid ${editMode ? "#fecaca" : T.border}`,
                borderRadius: 8, padding: "4px 8px", cursor: "pointer", fontSize: 14, color: editMode ? "#ef4444" : T.text3, lineHeight: 1,
              }}>⚙️</button>}
              <div style={{ fontSize: 10, letterSpacing: "0.08em", color: T.text4, textTransform: "uppercase", marginLeft: 10 }}>STAGES</div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {(fest.stages || []).map(st => {
                const total = totalForStage(st);
                const isExpanded = renamingId === st.id;
                if (isExpanded) {
                  return (
                    <div key={st.id} style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 16, padding: "14px 16px", boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}>
                      {/* nombre editable + cerrar */}
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
                        <input value={renameVal} onChange={e => setRenameVal(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === "Enter" && renameVal.trim()) {
                              onEditFest({ ...fest, stages: (fest.stages || []).map(s => s.id === st.id ? { ...s, name: renameVal.trim().toUpperCase() } : s) });
                              setRenamingId(null);
                            }
                            if (e.key === "Escape") setRenamingId(null);
                          }}
                          style={{ ...S.input, flex: 1, padding: "6px 10px", fontSize: 14, fontWeight: 700 }}
                          autoFocus />
                        <button onClick={() => {
                          if (renameVal.trim()) onEditFest({ ...fest, stages: (fest.stages || []).map(s => s.id === st.id ? { ...s, name: renameVal.trim().toUpperCase() } : s) });
                          setRenamingId(null); setShowDayAdd(false); setNewDayLabel(""); setNewDayDate("");
                        }} style={{ background: T.card2, border: `1px solid ${T.border}`, borderRadius: 8, padding: "5px 10px", fontSize: 13, color: T.text2, cursor: "pointer", flexShrink: 0 }}>✓</button>
                      </div>

                      {/* DÍAS */}
                      <div style={{ fontSize: 10, letterSpacing: "0.08em", color: T.text4, textTransform: "uppercase", marginBottom: 8 }}>DÍAS</div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        {st.days.map((d, i) => (
                          <div key={d.id} style={{ background: T.card2, borderRadius: 10, padding: "8px 10px", display: "flex", alignItems: "center", gap: 8 }}>
                            <div style={{ width: 24, height: 24, borderRadius: 7, background: T.border, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, fontFamily: "monospace", color: T.text3, flexShrink: 0 }}>{i + 1}</div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <input
                                ref={el => dayLabelRefs.current[i] = el}
                                defaultValue={d.label}
                                onBlur={e => updateDayLabel(st.id, d.id, e.target.value)}
                                onKeyDown={e => {
                                  if (e.key === "Enter") {
                                    e.target.blur();
                                    const next = dayLabelRefs.current[i + 1];
                                    if (next) next.focus();
                                  }
                                }}
                                style={{ width: "100%", background: "transparent", border: "none", outline: "none", fontSize: 13, fontWeight: 700, fontFamily: "'Bebas Neue',sans-serif", letterSpacing: "0.06em", color: T.text }}
                              />
                              <input
                                type="date"
                                value={d.date || ""}
                                onChange={e => updateDayDate(st.id, d.id, e.target.value)}
                                style={{ fontSize: 11, background: "transparent", border: "none", outline: "none", color: T.text3, fontFamily: "monospace", width: "100%" }}
                              />
                            </div>
                            <div style={{ fontSize: 10, color: T.text4, flexShrink: 0 }}>{d.artists.length} art.</div>
                            {st.days.length > 1 && (
                              <button onClick={() => deleteDayFromStage(st.id, d.id)}
                                style={{ width: 24, height: 24, borderRadius: "50%", border: "none", background: "#ef4444", color: "#fff", fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>−</button>
                            )}
                          </div>
                        ))}
                      </div>

                      {showDayAdd ? (
                        <div style={{ marginTop: 8, background: T.card2, borderRadius: 10, padding: "10px" }}>
                          <input
                            value={newDayLabel}
                            onChange={e => setNewDayLabel(e.target.value)}
                            placeholder={`DÍA ${st.days.length + 1}`}
                            style={{ ...S.input, marginBottom: 6, fontSize: 13 }}
                            autoFocus
                          />
                          <input
                            type="date"
                            value={newDayDate}
                            onChange={e => setNewDayDate(e.target.value)}
                            style={{ ...S.input, marginBottom: 8, fontSize: 13, fontFamily: "monospace" }}
                          />
                          <div style={{ display: "flex", gap: 8 }}>
                            <button onClick={() => {
                              addDayToStage(st.id, newDayLabel.trim() || undefined, newDayDate || undefined);
                              setShowDayAdd(false); setNewDayLabel(""); setNewDayDate("");
                            }} style={{ ...S.bigBtn, flex: 1, padding: "9px", marginTop: 0, fontSize: 12 }}>Añadir día</button>
                            <button onClick={() => { setShowDayAdd(false); setNewDayLabel(""); setNewDayDate(""); }} style={{ ...S.navBtn, flex: 0.5, fontSize: 12 }}>Cancelar</button>
                          </div>
                        </div>
                      ) : (
                        <button onClick={() => setShowDayAdd(true)} style={{ ...S.addBtn, marginTop: 8, fontSize: 12, padding: "9px" }}>+ Añadir día</button>
                      )}

                      {/* POSICIONES */}
                      {(() => {
                        const stHasFoh = totalForStage(st) > 0;
                        const stHasEscenario = ((st.escenario?.inputs?.length || 0) > 0 || (st.escenario?.power?.length || 0) > 0);
                        const stHasMon = (st.monPositions || []).length > 0;
                        if (!stHasFoh && !stHasMon && !stHasEscenario) return null;
                        return (
                          <div style={{ marginTop: 16 }}>
                            <div style={{ fontSize: 10, letterSpacing: "0.08em", color: T.text4, textTransform: "uppercase", marginBottom: 8 }}>POSICIONES</div>
                            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                              {stHasFoh && (
                                <div style={{ background: T.card2, borderRadius: 10, padding: "8px 10px", display: "flex", alignItems: "center", gap: 8 }}>
                                  <div style={{ fontSize: 16, flexShrink: 0 }}>🎛️</div>
                                  <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontSize: 12, fontFamily: "'Bebas Neue',sans-serif", color: T.text, letterSpacing: "0.06em" }}>FOH</div>
                                    <div style={{ fontSize: 10, color: T.text4, fontFamily: "monospace" }}>{totalForStage(st)} artistas</div>
                                  </div>
                                  <button onClick={() => {
                                    if (!window.confirm(`¿Eliminar todos los artistas de FOH en ${st.name}?`)) return;
                                    const newStages = (fest.stages || []).map(s => s.id === st.id
                                      ? { ...s, days: s.days.map(d => ({ ...d, artists: [] })) }
                                      : s
                                    );
                                    onEditFest({ ...fest, stages: newStages });
                                  }} style={{ width: 24, height: 24, borderRadius: "50%", border: "none", background: "#ef4444", color: "#fff", fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>−</button>
                                </div>
                              )}
                              {(st.monPositions || []).map(mp => (
                                <div key={mp.id} style={{ background: T.card2, borderRadius: 10, padding: "8px 10px", display: "flex", alignItems: "center", gap: 8 }}>
                                  <div style={{ fontSize: 16, flexShrink: 0 }}>🎧</div>
                                  <div style={{ flex: 1, minWidth: 0 }}>
                                    <input
                                      defaultValue={mp.name}
                                      onBlur={e => {
                                        if (!e.target.value.trim()) return;
                                        const newStages = (fest.stages || []).map(s => s.id === st.id
                                          ? { ...s, monPositions: (s.monPositions || []).map(p => p.id === mp.id ? { ...p, name: e.target.value.trim().toUpperCase() } : p) }
                                          : s
                                        );
                                        onEditFest({ ...fest, stages: newStages });
                                      }}
                                      style={{ width: "100%", background: "transparent", border: "none", outline: "none", fontSize: 12, fontWeight: 700, fontFamily: "'Bebas Neue',sans-serif", letterSpacing: "0.06em", color: T.text }}
                                    />
                                    <div style={{ fontSize: 10, color: T.text4, fontFamily: "monospace" }}>{(mp.inputs || []).length} inputs · {(mp.rfEntries || []).length} RF</div>
                                  </div>
                                  <button onClick={() => {
                                    const newStages = (fest.stages || []).map(s => s.id === st.id
                                      ? { ...s, monPositions: (s.monPositions || []).filter(p => p.id !== mp.id) }
                                      : s
                                    );
                                    onEditFest({ ...fest, stages: newStages });
                                  }} style={{ width: 24, height: 24, borderRadius: "50%", border: "none", background: "#ef4444", color: "#fff", fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>−</button>
                                </div>
                              ))}
                              {stHasEscenario && (
                                <div style={{ background: T.card2, borderRadius: 10, padding: "8px 10px", display: "flex", alignItems: "center", gap: 8 }}>
                                  <div style={{ fontSize: 16, flexShrink: 0 }}>🎪</div>
                                  <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontSize: 12, fontFamily: "'Bebas Neue',sans-serif", color: T.text, letterSpacing: "0.06em" }}>ESCENARIO</div>
                                    <div style={{ fontSize: 10, color: T.text4, fontFamily: "monospace" }}>{(st.escenario?.inputs || []).length} inputs · {(st.escenario?.power || []).length} grupos corriente</div>
                                  </div>
                                  <button onClick={() => {
                                    const newStages = (fest.stages || []).map(s => s.id === st.id
                                      ? { ...s, escenario: undefined }
                                      : s
                                    );
                                    onEditFest({ ...fest, stages: newStages });
                                  }} style={{ width: 24, height: 24, borderRadius: "50%", border: "none", background: "#ef4444", color: "#fff", fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>−</button>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  );
                }
                return (
                  <div key={st.id}
                    onClick={() => { if (!editMode) setSelectedStage(st.id); }}
                    style={{ background: T.card, border: `1px solid ${editMode ? "#fecaca" : T.border}`, borderRadius: 16, padding: "14px 16px", display: "flex", alignItems: "center", gap: 10, boxShadow: "0 1px 4px rgba(0,0,0,0.05)", cursor: editMode ? "default" : "pointer" }}>
                    {editMode && (
                      <button onClick={e => { e.stopPropagation(); deleteStage(st.id); }}
                        style={{ width: 26, height: 26, borderRadius: "50%", border: "none", background: "#ef4444", color: "#fff", fontSize: 16, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, flexShrink: 0 }}>−</button>
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 17, fontFamily: "'Bebas Neue',sans-serif", color: T.text, letterSpacing: "0.04em" }}>{st.name}</div>
                      <div style={{ fontSize: 11, color: T.text4, marginTop: 2 }}>{st.days.length} días · {total} artistas</div>
                    </div>
                    {editMode && (
                      <button onClick={e => { e.stopPropagation(); setRenamingId(st.id); setRenameVal(st.name); setShowDayAdd(false); }}
                        style={{ background: T.card2, border: `1px solid ${T.border}`, borderRadius: 8, padding: "5px 10px", fontSize: 11, color: T.text2, cursor: "pointer", flexShrink: 0 }}>✏️</button>
                    )}
                    {!editMode && <span style={{ color: T.text4, fontSize: 18 }}>›</span>}
                  </div>
                );
              })}
            </div>

            {isOwner && (showAdd ? (
              <div style={{ marginTop: 12, background: T.card, border: `1px solid ${T.border}`, borderRadius: 14, padding: "14px 16px" }}>
                <input value={newName} onChange={e => setNewName(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && addStage()}
                  placeholder="Nombre del stage" style={{ ...S.input, marginBottom: 10 }} autoFocus />
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={addStage} disabled={!newName.trim()} style={{ ...S.bigBtn, flex: 1, padding: "11px", marginTop: 0, fontSize: 13, opacity: newName.trim() ? 1 : 0.4 }}>Añadir</button>
                  <button onClick={() => { setShowAdd(false); setNewName(""); }} style={{ ...S.navBtn, flex: 0.5 }}>Cancelar</button>
                </div>
              </div>
            ) : (
              <button onClick={() => setShowAdd(true)} style={{ ...S.addBtn, marginTop: 12 }}>+ Añadir stage</button>
            ))}
            </>
            )}
          </>
        )}
      </div>
      {showShare && <ShareModal fest={fest} onClose={() => setShowShare(false)} />}
    </div>
  );
}

/* ---------- fest view ---------- */
function FestView({ fest, stage, userEmail, userRole, dayIdx, setDayIdx, notes, setNotes, checks, toggleCheck, slots, setSlots, onEditFest, onBack, onRefresh, lastSync }) {
  const canEdit = userRole !== "viewer";    // editor + owner
  const isOwner = userRole === "owner";     // solo owner puede tocar estructura
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
    const newArt = { id: uid(), artist: fields.artist || "", console: fields.console || "", connection: fields.connection || "", signal: fields.signal || "", preset: fields.preset || "INITIAL", presetOk: false, toLx: fields.toLx || "", toMon: fields.toMon || "", tecnico: fields.tecnico || "", corriente: fields.corriente || "", comments: [], extraSlots: [] };
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

  /* shared top bar */
  const { dark, toggle } = useTheme();
  const T = dark ? DK : LT;
  const S = makeS(T);
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
      <div style={{ display: "flex", flexDirection: "column", height: "100dvh", overflow: "hidden" }}>
        <TopBar onBackBtn={() => setEditId(null)} />
        <div style={{ flex: 1, padding: "12px 14px 24px", background: "#f8fafc", overflowY: "auto" }}>
          <AddArtistScreen initial={editArt} onAdd={saveEditArtist} onBack={() => setEditId(null)} />
        </div>

      </div>
    );
  }

  /* ---- add screen ---- */
  if (showAdd) return (
    <div style={{ display: "flex", flexDirection: "column", height: "100dvh", overflow: "hidden" }}>
      <TopBar onBackBtn={() => setShowAdd(false)} />
      <div style={{ flex: 1, padding: "12px 14px 24px", background: "#f8fafc", overflowY: "auto" }}>
        <AddArtistScreen onAdd={addArtistToDay} onBack={() => setShowAdd(false)} />
      </div>
    </div>
  );

  /* ---- detail screen ---- */
  if (art) return (
    <div style={{ display: "flex", flexDirection: "column", height: "100dvh", overflow: "hidden" }}>
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
    <div style={{ display: "flex", flexDirection: "column", height: "100dvh", overflow: "hidden" }}>
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

/* ---------- small components ---------- */
function AddArtistScreen({ onAdd, onBack, initial }) {
  const [f, setF] = useState(initial ? { artist: initial.artist || "", console: initial.console || "", connection: initial.connection || "", signal: initial.signal || "", preset: initial.preset || "INITIAL", toLx: initial.toLx || "", toMon: initial.toMon || "", tecnico: initial.tecnico || "", corriente: initial.corriente || "", escConsole: initial.escConsole || "", escSignal: initial.escSignal || "", escConnection: initial.escConnection || "", escTecnico: initial.escTecnico || "" } : { artist: "", console: "", connection: "", signal: "", preset: "INITIAL", toLx: "", toMon: "", tecnico: "", corriente: "", escConsole: "", escSignal: "", escConnection: "", escTecnico: "" });
  const set = (k, v) => setF(p => ({ ...p, [k]: v }));
  const isEdit = !!initial;

  async function confirm() {
    if (!f.artist.trim()) return;
    await onAdd(f);
  }

  const { dark } = useTheme(); const T = dark ? DK : LT; const S = makeS(T);
  return (
    <div style={{ background: T.card, borderRadius: 20, padding: 20, border: `2px dashed ${T.border}`, boxShadow: "0 1px 8px rgba(0,0,0,0.07)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
        <div style={{ width: 36, height: 36, borderRadius: 10, background: isEdit ? (dark ? "#3730a3" : "#ede9fe") : (dark ? "#713f12" : "#fef9c3"), border: `1px solid ${isEdit ? (dark ? "#4f46e5" : "#c4b5fd") : (dark ? "#92400e" : "#fde68a")}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>{isEdit ? "✏️" : "+"}</div>
        <div>
          <div style={{ fontSize: 9, color: T.text4, letterSpacing: "0.15em" }}>{isEdit ? "EDITAR ARTISTA" : "NUEVO ARTISTA"}</div>
          <div style={{ fontSize: 13, color: T.text, fontWeight: 700 }}>{isEdit ? f.artist || "—" : "Añadir al día"}</div>
        </div>
      </div>
      <input value={f.artist} onChange={e => set("artist", e.target.value)} placeholder="Nombre artista *" style={{ ...S.input, marginBottom: 8 }} autoFocus />
      <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
        <input value={f.console} onChange={e => set("console", e.target.value)} placeholder="Consola" style={S.input} />
        <input value={f.signal} onChange={e => set("signal", e.target.value)} placeholder="Señal" style={S.input} />
      </div>
      <input value={f.connection} onChange={e => set("connection", e.target.value)} placeholder="Conexión" style={{ ...S.input, marginBottom: 8 }} />
      <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
        <input value={f.toLx} onChange={e => set("toLx", e.target.value)} placeholder="TO LX" style={S.input} />
        <input value={f.toMon} onChange={e => set("toMon", e.target.value)} placeholder="TO MON" style={S.input} />
        <input value={f.tecnico || ""} onChange={e => set("tecnico", e.target.value)} placeholder="Técnico" style={S.input} />
      </div>
      <input value={f.preset} onChange={e => set("preset", e.target.value)} placeholder="Preset" style={{ ...S.input, marginBottom: 8 }} />
      <textarea value={f.corriente} onChange={e => set("corriente", e.target.value)} placeholder="Corriente" rows={1} style={{ ...S.input, marginBottom: 14, resize: "vertical", fontFamily: "inherit", fontSize: 12 }} />
      <div style={{ fontSize: 10, color: T.text4, letterSpacing: "0.1em", marginBottom: 6 }}>ESCENARIO</div>
      <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
        <input value={f.escConsole} onChange={e => set("escConsole", e.target.value)} placeholder="Consola escenario" style={S.input} />
        <input value={f.escSignal} onChange={e => set("escSignal", e.target.value)} placeholder="Señal escenario" style={S.input} />
      </div>
      <input value={f.escConnection} onChange={e => set("escConnection", e.target.value)} placeholder="Conexión escenario" style={{ ...S.input, marginBottom: 8 }} />
      <input value={f.escTecnico} onChange={e => set("escTecnico", e.target.value)} placeholder="Técnico escenario" style={{ ...S.input, marginBottom: 14 }} />
      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={confirm} disabled={!f.artist.trim()} style={{ ...S.bigBtn, flex: 1, padding: "13px", marginTop: 0, opacity: f.artist.trim() ? 1 : 0.4 }}>{isEdit ? "Guardar cambios" : "Guardar artista"}</button>
        <button onClick={onBack} style={{ ...S.navBtn, flex: 0.5 }}>‹ Volver</button>
      </div>
    </div>
  );
}

/* ---------- log modal ---------- */
function LogModal({ log, festName, onClose }) {
  const entries = [...(log || [])].reverse();
  const { dark } = useTheme(); const T = dark ? DK : LT;
  const fmtTs = (iso) => {
    try {
      const d = new Date(iso);
      return d.toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit", second: "2-digit" }) + " " + d.toLocaleDateString("es", { day: "2-digit", month: "2-digit" });
    } catch { return iso; }
  };
  const actionMeta = (a) => {
    if (a.startsWith("ADD")) return { label: a, color: "#16a34a" };
    if (a.startsWith("DEL")) return { label: a, color: "#dc2626" };
    if (a.startsWith("EDIT")) return { label: a, color: "#d97706" };
    return { label: a, color: T.text3 };
  };

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 300, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
      <div onClick={e => e.stopPropagation()} style={{ width: "100%", maxWidth: 600, maxHeight: "85dvh", background: T.card, borderRadius: "16px 16px 0 0", display: "flex", flexDirection: "column", overflow: "hidden", border: `1px solid ${T.border}`, borderBottom: "none" }}>
        {/* header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", background: T.card2, borderBottom: `1px solid ${T.border}`, flexShrink: 0 }}>
          <span style={{ fontFamily: "monospace", fontSize: 12, color: T.text3, letterSpacing: "0.06em" }}>{">_"} CHANGELOG</span>
          <span style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 14, color: T.text, letterSpacing: "0.08em" }}>{festName}</span>
          <button onClick={onClose} style={{ background: "none", border: "none", color: T.text3, fontSize: 16, cursor: "pointer", lineHeight: 1 }}>✕</button>
        </div>
        {/* log entries */}
        <div style={{ flex: 1, overflowY: "auto", padding: "6px 0 20px", background: T.bg }}>
          {entries.length === 0 ? (
            <div style={{ fontFamily: "monospace", fontSize: 11, color: T.text4, padding: "20px 16px" }}>// sin entradas</div>
          ) : (
            entries.map((e, i) => {
              const { label, color } = actionMeta(e.action);
              return (
                <div key={i} style={{ display: "grid", gridTemplateColumns: "auto auto 1fr", gap: "0 10px", padding: "5px 16px", borderBottom: `1px solid ${T.border2}`, alignItems: "start" }}>
                  <span style={{ fontFamily: "monospace", fontSize: 10, color: T.text4, whiteSpace: "nowrap", paddingTop: 1 }}>{fmtTs(e.ts)}</span>
                  <span style={{ fontFamily: "monospace", fontSize: 10, color, fontWeight: 700, whiteSpace: "nowrap", paddingTop: 1 }}>{label}</span>
                  <div style={{ minWidth: 0 }}>
                    <span style={{ fontFamily: "monospace", fontSize: 10, color: T.text2, display: "block", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{e.user}</span>
                    {e.detail && e.detail.split("\n").map((line, li) => (
                      <span key={li} style={{ fontFamily: "monospace", fontSize: 10, color: T.text3, display: "block", lineHeight: 1.6 }}>{line}</span>
                    ))}
                  </div>
                </div>
              );
            })
          )}
        </div>
        {/* footer */}
        <div style={{ padding: "8px 16px", background: T.card2, borderTop: `1px solid ${T.border}`, flexShrink: 0 }}>
          <span style={{ fontFamily: "monospace", fontSize: 10, color: T.text4 }}>{entries.length} entradas · últimos 1000 cambios</span>
        </div>
      </div>
    </div>
  );
}

function ShareModal({ fest, onClose }) {
  const editorUrl = `${window.location.origin}/Festival-Handover/?join=${fest.id}`;
  const viewerUrl = `${window.location.origin}/Festival-Handover/?join=${fest.id}&role=viewer`;
  const [activeTab, setActiveTab] = useState("editor"); // "editor" | "viewer"
  const [copied, setCopied] = useState(false);
  const { dark } = useTheme(); const T = dark ? DK : LT; const S = makeS(T);

  const currentUrl = activeTab === "editor" ? editorUrl : viewerUrl;

  function copy() {
    navigator.clipboard.writeText(currentUrl).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  }

  async function share() {
    if (navigator.share) {
      try { await navigator.share({ title: fest.name, text: `Festival ${fest.name}`, url: currentUrl }); return; } catch { /* cancelado */ }
    }
    copy();
  }

  const tabs = [
    { key: "editor", label: "Editor", desc: "Puede editar notas, checks y slots en vivo" },
    { key: "viewer", label: "Visor", desc: "Solo lectura — ideal para producción o promotora" },
  ];

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 100, display: "flex", alignItems: "flex-end" }} onClick={onClose}>
      <div style={{ background: T.card, borderRadius: "20px 20px 0 0", padding: "24px 20px 36px", width: "100%", maxWidth: 480, margin: "0 auto" }} onClick={e => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 9, color: T.text4, letterSpacing: "0.15em" }}>COMPARTIR</div>
            <div style={{ fontSize: 18, fontFamily: "'Bebas Neue',sans-serif", color: T.text, letterSpacing: "0.04em" }}>{fest.name}</div>
          </div>
          <button onClick={onClose} style={S.iconBtn}>✕</button>
        </div>
        {/* Tab selector */}
        <div style={{ display: "flex", gap: 6, marginBottom: 16, background: T.card2, borderRadius: 10, padding: 4 }}>
          {tabs.map(t => (
            <button key={t.key} onClick={() => { setActiveTab(t.key); setCopied(false); }} style={{
              flex: 1, padding: "8px", borderRadius: 8, border: "none", cursor: "pointer", fontFamily: "'DM Mono',monospace",
              fontSize: 12, fontWeight: 700, transition: "all 0.15s",
              background: activeTab === t.key ? T.card : "transparent",
              color: activeTab === t.key ? T.text : T.text4,
              boxShadow: activeTab === t.key ? "0 1px 4px rgba(0,0,0,0.1)" : "none",
            }}>{t.label}</button>
          ))}
        </div>
        <div style={{ padding: "12px 14px", background: T.card2, border: `1px solid ${T.border}`, borderRadius: 10, marginBottom: 12 }}>
          <div style={{ fontSize: 11, color: T.text3, fontFamily: "monospace" }}>
            {tabs.find(t => t.key === activeTab)?.desc}
          </div>
        </div>
        <div style={{ background: T.card2, border: `1px solid ${T.border}`, borderRadius: 10, padding: "10px 12px", marginBottom: 12, wordBreak: "break-all", fontSize: 10, color: T.text3, maxHeight: 60, overflow: "hidden" }}>{currentUrl.slice(0, 120)}{currentUrl.length > 120 ? "…" : ""}</div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={share} style={{ ...S.bigBtn, marginTop: 0, flex: 1, background: dark ? "#334155" : "#0f172a" }}>Compartir</button>
          <button onClick={copy} style={{ ...S.bigBtn, marginTop: 0, flex: 1, background: copied ? "#16a34a" : T.card2, color: copied ? "#fff" : T.text2, border: `1px solid ${T.border}` }}>
            {copied ? "✓ Copiado" : "Copiar URL"}
          </button>
        </div>
      </div>
    </div>
  );
}

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

function ExtraSlots({ slots, onAdd, onDel, onEdit }) {
  const [adding, setAdding] = useState(false);
  const [newLabel, setNL] = useState("");
  const [newValue, setNV] = useState("");
  const [editingId, setEditId] = useState(null);
  const { dark } = useTheme(); const T = dark ? DK : LT; const S = makeS(T);
  const slotBg = dark ? "#1e3a5f" : "#eff6ff";
  const slotBorder = dark ? "#2563eb55" : "#bfdbfe";
  const slotLabel = dark ? "#93c5fd" : "#2563eb";
  const slotText = dark ? "#bfdbfe" : "#1e3a5f";

  function confirmAdd() {
    if (!newLabel.trim()) return;
    onAdd(newLabel, newValue); setNL(""); setNV(""); setAdding(false);
  }

  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 9, color: slotLabel, letterSpacing: "0.15em", marginBottom: 7, fontWeight: 700 }}>CAMPOS EXTRA</div>
      {slots.map(s => (
        <div key={s.id} style={{ marginBottom: 7 }}>
          {editingId === s.id ? (
            <div style={{ background: slotBg, border: `1px solid ${slotBorder}`, borderRadius: 10, padding: 10 }}>
              <input value={s.label} onChange={e => onEdit(s.id, "label", e.target.value)} style={{ ...S.input, marginBottom: 6, fontWeight: 700 }} placeholder="Etiqueta" />
              <input value={s.value} onChange={e => onEdit(s.id, "value", e.target.value)} style={{ ...S.input, marginBottom: 8 }} placeholder="Valor" />
              <button onClick={() => setEditId(null)} style={S.smBtn}>Hecho</button>
            </div>
          ) : (
            <div onClick={() => setEditId(s.id)} style={{ display: "flex", alignItems: "center", gap: 10, background: slotBg, border: `1px solid ${slotBorder}`, borderRadius: 10, padding: "9px 12px", cursor: "pointer" }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 8, color: slotLabel, letterSpacing: "0.15em", fontWeight: 700 }}>{s.label}</div>
                <div style={{ fontSize: 13, color: slotText, fontFamily: "monospace", marginTop: 2, wordBreak: "break-word" }}>{s.value || "—"}</div>
              </div>
              <button onClick={e => { e.stopPropagation(); onDel(s.id); }} style={S.iconBtn}>×</button>
            </div>
          )}
        </div>
      ))}
      {adding ? (
        <div style={{ background: slotBg, border: `1px solid ${slotBorder}`, borderRadius: 10, padding: 10 }}>
          <input value={newLabel} onChange={e => setNL(e.target.value)} placeholder="Etiqueta (RF, Backline…)" autoFocus style={{ ...S.input, marginBottom: 6, fontWeight: 700 }} />
          <input value={newValue} onChange={e => setNV(e.target.value)} placeholder="Valor" onKeyDown={e => { if (e.key === "Enter") confirmAdd(); }} style={{ ...S.input, marginBottom: 8 }} />
          <div style={{ display: "flex", gap: 6 }}>
            <button onClick={confirmAdd} style={{ ...S.smBtn, background: "#2563eb", color: "#fff", flex: 1 }}>Añadir</button>
            <button onClick={() => { setAdding(false); setNL(""); setNV(""); }} style={{ ...S.smBtn, flex: 1 }}>Cancelar</button>
          </div>
        </div>
      ) : (
        <button onClick={() => setAdding(true)} style={{ ...S.addBtn, color: slotLabel, borderColor: slotBorder, background: slotBg }}>+ Nuevo campo</button>
      )}
    </div>
  );
}

function FohNotes({ notes, onAdd, onDel }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const { dark } = useTheme(); const T = dark ? DK : LT; const S = makeS(T);
  const noteBg = dark ? "#292524" : "#fffbeb";
  const noteBorder = dark ? "#92400e" : "#fcd34d";
  const noteText = dark ? "#fde68a" : "#92400e";
  const noteLabel = dark ? "#fbbf24" : "#d97706";

  return (
    <div style={{ padding: "12px 16px" }}>
      <div style={{ fontSize: 9, color: noteLabel, letterSpacing: "0.15em", marginBottom: 7, fontWeight: 700 }}>NOTAS FOH (turno)</div>
      {notes.map((n, i) => (
        <div key={i} style={{ display: "flex", gap: 6, alignItems: "flex-start", marginBottom: 5 }}>
          <div style={{ flex: 1, fontSize: 12, color: noteText, lineHeight: 1.5, padding: "7px 10px", background: noteBg, borderLeft: `2px solid ${noteBorder}`, borderRadius: "0 6px 6px 0" }}>{n.text}</div>
          <button onClick={() => onDel(i)} style={S.iconBtn}>×</button>
        </div>
      ))}
      {editing ? (
        <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
          <textarea value={draft} onChange={e => setDraft(e.target.value)} rows={2} autoFocus
            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); onAdd(draft); setDraft(""); setEditing(false); } }}
            placeholder="Nota para tu compañero…"
            style={{ ...S.input, flex: 1, resize: "none", borderColor: noteBorder }} />
          <button onClick={() => { onAdd(draft); setDraft(""); setEditing(false); }} style={{ ...S.smBtn, background: "#D4A843", color: "#fff" }}>OK</button>
        </div>
      ) : (
        <button onClick={() => setEditing(true)} style={{ ...S.addBtn, color: noteLabel, borderColor: noteBorder, background: noteBg, marginTop: 0 }}>+ Añadir nota</button>
      )}
    </div>
  );
}

/* ---------- fest edit modal ---------- */
function FestEditModal({ fest, onSave, onClose }) {
  const [name, setName] = useState(fest.name);
  const [stages, setStages] = useState(() => (fest.stages || []).map(s => ({ ...s, days: (s.days || []).map(d => ({ ...d })) })));
  const { dark } = useTheme(); const T = dark ? DK : LT; const S = makeS(T);

  function updDay(stageId, dayId, patch) {
    setStages(ss => ss.map(s => s.id === stageId
      ? { ...s, days: s.days.map(d => d.id === dayId ? { ...d, ...patch } : d) }
      : s
    ));
  }
  function delDay(stageId, dayId) {
    setStages(ss => ss.map(s => s.id === stageId
      ? { ...s, days: s.days.filter(d => d.id !== dayId) }
      : s
    ));
  }
  function addDay(stageId) {
    const st = stages.find(s => s.id === stageId);
    const newDay = { id: uid(), label: `DÍA ${(st?.days?.length || 0) + 1}`, artists: [] };
    setStages(ss => ss.map(s => s.id === stageId ? { ...s, days: [...s.days, newDay] } : s));
  }

  function save() {
    if (!name.trim()) return;
    onSave({ ...fest, name: name.trim(), stages });
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 200, display: "flex", alignItems: "flex-end", justifyContent: "center" }}
      onClick={onClose}>
      <div style={{ background: T.card, borderRadius: "20px 20px 0 0", padding: "24px 20px 36px", width: "100%", maxWidth: 480, maxHeight: "88dvh", overflowY: "auto" }}
        onClick={e => e.stopPropagation()}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <div style={{ fontSize: 18, fontFamily: "'Bebas Neue',sans-serif", color: T.text, letterSpacing: "0.05em" }}>EDITAR FESTIVAL</div>
          <button onClick={onClose} style={S.iconBtn}>✕</button>
        </div>

        <div style={{ fontSize: 10, color: T.text4, letterSpacing: "0.1em", marginBottom: 6 }}>NOMBRE</div>
        <input value={name} onChange={e => setName(e.target.value)} style={{ ...S.input, marginBottom: 24 }} autoFocus />

        {stages.map(st => (
          <div key={st.id} style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 10, color: T.text4, letterSpacing: "0.1em", marginBottom: 8 }}>
              {stages.length > 1 ? `${st.name} · DÍAS` : "DÍAS"}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {st.days.map((d, i) => (
                <div key={d.id} style={{ background: T.card2, borderRadius: 10, padding: "8px 10px", display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ width: 24, height: 24, borderRadius: 7, background: T.border, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, fontFamily: "monospace", color: T.text3, flexShrink: 0 }}>{i + 1}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <input
                      defaultValue={d.label}
                      onBlur={e => { if (e.target.value.trim()) updDay(st.id, d.id, { label: e.target.value.trim().toUpperCase() }); }}
                      onKeyDown={e => { if (e.key === "Enter") e.target.blur(); }}
                      style={{ width: "100%", background: "transparent", border: "none", outline: "none", fontSize: 13, fontWeight: 700, fontFamily: "'Bebas Neue',sans-serif", letterSpacing: "0.06em", color: T.text }}
                    />
                    <input
                      type="date"
                      value={d.date || ""}
                      onChange={e => updDay(st.id, d.id, { date: e.target.value })}
                      style={{ fontSize: 11, background: "transparent", border: "none", outline: "none", color: T.text3, fontFamily: "monospace", width: "100%" }}
                    />
                  </div>
                  <div style={{ fontSize: 10, color: T.text4, flexShrink: 0 }}>{(d.artists || []).length} art.</div>
                  {st.days.length > 1 && (
                    <button onClick={() => delDay(st.id, d.id)}
                      style={{ width: 24, height: 24, borderRadius: "50%", border: "none", background: "#ef4444", color: "#fff", fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>−</button>
                  )}
                </div>
              ))}
            </div>
            <button onClick={() => addDay(st.id)} style={{ ...S.addBtn, marginTop: 8, fontSize: 12, padding: "9px" }}>+ Añadir día</button>
          </div>
        ))}

        <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
          <button onClick={onClose} style={{ flex: 1, padding: "14px", background: T.card2, border: `1px solid ${T.border}`, borderRadius: 12, fontSize: 14, cursor: "pointer", fontFamily: "'DM Mono',monospace", color: T.text2 }}>
            Cancelar
          </button>
          <button onClick={save} disabled={!name.trim()} style={{ flex: 1, padding: "14px", background: dark ? "#334155" : "#0f172a", border: "none", borderRadius: 12, fontSize: 14, fontWeight: 700, cursor: name.trim() ? "pointer" : "not-allowed", fontFamily: "'DM Mono',monospace", color: "#fff", opacity: name.trim() ? 1 : 0.4 }}>
            Guardar
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------- etapas view ---------- */
function EtapasView({ etapas, onSave }) {
  const { dark } = useTheme(); const T = dark ? DK : LT; const S = makeS(T);
  const [editGrupoId, setEditGrupoId] = useState(null); // id del grupo en edición, o "new"
  const [grupoName, setGrupoName] = useState("");
  const [grupoRows, setGrupoRows] = useState([]); // [{ id, amp, ampId }]
  const [expandedId, setExpandedId] = useState(null);
  const rowAmpRefs = useRef([]);

  function openNew() {
    setEditGrupoId("new");
    setGrupoName("");
    setGrupoRows([{ id: uid(), amp: "", ampId: "" }]);
  }

  function openEdit(g) {
    setEditGrupoId(g.id);
    setGrupoName(g.name);
    setGrupoRows(g.rows.map(r => ({ ...r })));
  }

  function addRow() {
    setGrupoRows(r => {
      const next = [...r, { id: uid(), amp: "", ampId: "" }];
      setTimeout(() => {
        const el = rowAmpRefs.current[next.length - 1];
        if (el) el.focus();
      }, 0);
      return next;
    });
  }
  function delRow(id) { setGrupoRows(r => r.filter(x => x.id !== id)); }
  function setRow(id, field, val) { setGrupoRows(r => r.map(x => x.id === id ? { ...x, [field]: val } : x)); }

  function saveGrupo() {
    if (!grupoName.trim()) return;
    const validRows = grupoRows.filter(r => r.amp.trim() || r.ampId.trim());
    if (editGrupoId === "new") {
      onSave([...etapas, { id: uid(), name: grupoName.trim().toUpperCase(), rows: validRows }]);
    } else {
      onSave(etapas.map(g => g.id === editGrupoId ? { ...g, name: grupoName.trim().toUpperCase(), rows: validRows } : g));
    }
    setEditGrupoId(null);
  }

  function deleteGrupo(id) {
    onSave(etapas.filter(g => g.id !== id));
    if (expandedId === id) setExpandedId(null);
  }

  function duplicateGrupo(g) {
    const copy = { ...g, id: uid(), name: g.name + " COPIA", rows: g.rows.map(r => ({ ...r, id: uid() })) };
    const idx = etapas.findIndex(x => x.id === g.id);
    const next = [...etapas];
    next.splice(idx + 1, 0, copy);
    onSave(next);
    openEdit(copy);
  }

  if (editGrupoId !== null) {
    return (
      <div style={{ padding: "16px 14px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
          <button onClick={() => setEditGrupoId(null)} style={{ ...S.backBtn, background: "#261E18", borderColor: "#3D2B1F", color: "#D8CEB8" }}>‹</button>
          <div style={{ flex: 1, fontSize: 16, fontFamily: "'Bebas Neue',sans-serif", color: T.text, letterSpacing: "0.06em" }}>
            {editGrupoId === "new" ? "NUEVO GRUPO" : "EDITAR GRUPO"}
          </div>
        </div>

        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 9, color: T.text4, letterSpacing: "0.14em", fontFamily: "'DM Mono',monospace", marginBottom: 6 }}>NOMBRE DEL GRUPO</div>
          <input value={grupoName} onChange={e => setGrupoName(e.target.value.toUpperCase())}
            placeholder="PA L" style={{ ...S.input }} autoFocus />
        </div>

        <div style={{ fontSize: 9, color: T.text4, letterSpacing: "0.14em", fontFamily: "'DM Mono',monospace", marginBottom: 8 }}>FILAS · AMP — ID</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 10 }}>
          {grupoRows.map((row, i) => (
            <div key={row.id} style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <input ref={el => rowAmpRefs.current[i] = el} value={row.amp} onChange={e => setRow(row.id, "amp", e.target.value.toUpperCase())}
                placeholder="GSL8" style={{ ...S.input, flex: "0 0 90px", padding: "10px 10px", fontSize: 13, fontFamily: "'DM Mono',monospace" }} />
              <input value={row.ampId} onChange={e => setRow(row.id, "ampId", e.target.value)}
                placeholder="A/B 0.01" style={{ ...S.input, flex: 1, padding: "10px 10px", fontSize: 13, fontFamily: "'DM Mono',monospace" }}
                onKeyDown={e => { if (e.key === "Enter") addRow(); }} />
              <button onClick={() => delRow(row.id)} style={{ background: "none", border: "none", color: T.text4, fontSize: 18, cursor: "pointer", padding: "0 4px", flexShrink: 0 }}>×</button>
            </div>
          ))}
        </div>
        <button onClick={addRow} style={{ ...S.addBtn, marginBottom: 20 }}>+ Añadir fila</button>
        <button onClick={saveGrupo} disabled={!grupoName.trim()} style={{ ...S.bigBtn, opacity: grupoName.trim() ? 1 : 0.4 }}>
          {editGrupoId === "new" ? "CREAR GRUPO" : "GUARDAR CAMBIOS"}
        </button>
      </div>
    );
  }

  return (
    <div style={{ padding: "16px 14px" }}>
      {etapas.length === 0 && (
        <div style={{ textAlign: "center", color: T.text4, fontSize: 13, marginTop: 40, fontFamily: "'DM Mono',monospace" }}>
          Sin grupos de etapas
        </div>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 14 }}>
        {etapas.map(g => {
          const isExpanded = expandedId === g.id;
          return (
            <div key={g.id} style={{ background: T.card, border: `1px solid ${T.border}`, borderLeft: "4px solid #D4A843", borderRadius: 4, overflow: "hidden" }}>
              {/* header */}
              <div style={{ display: "flex", alignItems: "center", padding: "10px 14px", background: T.card2, cursor: "pointer" }}
                onClick={() => setExpandedId(isExpanded ? null : g.id)}>
                <span style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 15, letterSpacing: "0.08em", color: T.text, flex: 1 }}>{g.name}</span>
                <span style={{ fontSize: 10, color: T.text4, fontFamily: "'DM Mono',monospace", marginRight: 10 }}>{g.rows.length} filas</span>
                <button onClick={e => { e.stopPropagation(); openEdit(g); }}
                  style={{ background: "none", border: "none", color: T.text4, fontSize: 13, cursor: "pointer", padding: "0 6px" }}>✏️</button>
                <button onClick={e => { e.stopPropagation(); duplicateGrupo(g); }}
                  title="Duplicar grupo"
                  style={{ background: "none", border: "none", color: T.text4, fontSize: 13, cursor: "pointer", padding: "0 6px" }}>⎘</button>
                <button onClick={e => { e.stopPropagation(); deleteGrupo(g.id); }}
                  style={{ background: "none", border: "none", color: "#C94A2A", fontSize: 14, cursor: "pointer", padding: "0 4px" }}>×</button>
                <span style={{ color: T.text4, fontSize: 14, marginLeft: 4 }}>{isExpanded ? "▾" : "▸"}</span>
              </div>
              {/* filas */}
              {isExpanded && (
                <div style={{ padding: "0 0 8px" }}>
                  {/* cabecera columnas */}
                  <div style={{ display: "grid", gridTemplateColumns: "90px 1fr", gap: 0, padding: "5px 14px 3px", borderBottom: `1px solid ${T.border}` }}>
                    <span style={{ fontSize: 8, color: T.text4, fontFamily: "'DM Mono',monospace", letterSpacing: "0.12em" }}>AMP</span>
                    <span style={{ fontSize: 8, color: T.text4, fontFamily: "'DM Mono',monospace", letterSpacing: "0.12em" }}>ID</span>
                  </div>
                  {g.rows.map((row, i) => (
                    <div key={row.id} style={{
                      display: "grid", gridTemplateColumns: "90px 1fr", gap: 0,
                      padding: "6px 14px",
                      background: i % 2 === 0 ? "transparent" : (dark ? "rgba(255,255,255,0.02)" : "rgba(0,0,0,0.02)"),
                      borderBottom: i < g.rows.length - 1 ? `1px solid ${T.border2}` : "none",
                    }}>
                      <span style={{ fontSize: 12, fontFamily: "'DM Mono',monospace", color: "#D4A843", fontWeight: 600 }}>{row.amp || "—"}</span>
                      <span style={{ fontSize: 12, fontFamily: "'DM Mono',monospace", color: T.text2 }}>{row.ampId || "—"}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
      <button onClick={openNew} style={{ ...S.bigBtn, marginTop: 0 }}>+ AÑADIR GRUPO</button>
    </div>
  );
}

/* ---------- compact artist card (ficha compacta) ---------- */
function CompactArtistCard({ a, fest, day, colorIdx, onSelect }) {
  const color = sigColor(a.signal);
  const { dark } = useTheme(); const T = dark ? DK : LT; const S = makeS(T);

  const cardBg = T.card;
  const cardText = T.text;
  const borderC = T.border;
  const chipBg = T.card2;
  const chipBorder = T.border;
  const textTertiary = T.text4;
  const textSecondary = T.text3;
  const accentLeft = PALETTE[(colorIdx ?? 0) % PALETTE.length];

  return (
    <div
      onClick={() => onSelect(a.id)}
      style={{
        border: `1px solid ${borderC}`,
        borderLeft: `5px solid ${accentLeft}`,
        borderRadius: 4,
        background: cardBg,
        color: cardText,
        cursor: "pointer",
        overflow: "hidden",
        position: "relative",
      }}>

      {/* header: name + tecnico/mesa */}
      <div style={{ padding: "16px 18px 12px 18px", borderBottom: `1px solid ${borderC}`, background: T.card2 }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
          <span style={{ fontSize: 22, fontFamily: "'Bebas Neue',sans-serif", letterSpacing: "0.03em", lineHeight: 1, color: cardText }}>
            {a.artist || "—"}
          </span>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 14, flexShrink: 0, lineHeight: 1 }}>
            {a.tecnico && (
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 8, color: textTertiary, textTransform: "uppercase", letterSpacing: "0.1em", fontFamily: "'DM Mono',monospace" }}>técnico</div>
                <div style={{ fontSize: 13, fontFamily: "'DM Mono',monospace" }}>{noInfo(a.tecnico)}</div>
              </div>
            )}
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 8, color: textTertiary, textTransform: "uppercase", letterSpacing: "0.1em", fontFamily: "'DM Mono',monospace" }}>mesa</div>
              <div style={{ fontSize: 15, fontFamily: "'DM Mono',monospace" }}>{noInfo(a.console) || "—"}</div>
            </div>
          </div>
        </div>
      </div>

      {/* body: signal chain chips */}
      <div style={{ padding: "12px 18px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
          <span style={{ fontSize: 11, fontFamily: "'DM Mono',monospace", padding: "4px 10px", borderRadius: 2, background: chipBg, border: `1px solid ${chipBorder}`, color: cardText }}>
            {noInfo(a.connection) || "—"}
          </span>
          <span style={{ color: textTertiary, fontSize: 12 }}>·</span>
          <span style={{ fontSize: 11, fontFamily: "'DM Mono',monospace", padding: "4px 10px", borderRadius: 2, background: chipBg, border: `1px solid ${chipBorder}`, color }}>
            {noInfo(a.signal) || "—"}
          </span>
          {a.preset && (
            <span style={{
              marginLeft: "auto", fontSize: 11, fontFamily: "'DM Mono',monospace",
              padding: "4px 10px", borderRadius: 2,
              background: a.presetOk ? "rgba(42,107,107,0.1)" : chipBg,
              border: `1px solid ${a.presetOk ? "#2A6B6B" : chipBorder}`,
              color: a.presetOk ? "#2A6B6B" : textSecondary,
              display: "inline-flex", alignItems: "center", gap: 4,
            }}>
              ⚙ {noInfo(a.preset)}
            </span>
          )}
        </div>

        {/* footer: lx · mon */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: textSecondary, paddingTop: 10, borderTop: `1px solid ${borderC}` }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 4, opacity: a.toLx ? 1 : 0.45 }}>
            💡 LX <strong style={{ color: cardText, fontFamily: "'DM Mono',monospace", fontWeight: 500 }}>{noInfo(a.toLx) || "No"}</strong>
          </span>
          <span style={{ color: textTertiary }}>·</span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 4, opacity: a.toMon ? 1 : 0.45 }}>
            🎧 Mon <strong style={{ color: cardText, fontFamily: "'DM Mono',monospace", fontWeight: 500 }}>{noInfo(a.toMon) || "No"}</strong>
          </span>
          {a.corriente && (
            <>
              <span style={{ color: textTertiary }}>·</span>
              <span style={{
                fontSize: 9, fontFamily: "'DM Mono',monospace", letterSpacing: "0.06em",
                padding: "2px 6px", borderRadius: 2,
                background: "#FFF8EC", border: "1px solid #D4A843", color: "#8a6e2a",
                display: "inline-flex", alignItems: "center", gap: 3,
                maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              }}>⚡ {a.corriente}</span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------- rulos ---------- */
const RULO_TYPES = ["HMA OPTOCORE", "RJ / CAT6", "OPTICALCON", "MULTIPAR", "OTRO"];

function ruloColor(type) {
  const t = (type || "").toUpperCase();
  if (t.includes("OPTOCORE")) return "#2A6B6B";
  if (t.includes("RJ") || t.includes("CAT")) return "#7B5EA7";
  if (t.includes("OPTICAL")) return "#C94A2A";
  if (t.includes("MULTIPAR")) return "#D4A843";
  if (t.includes("ETHERNET")) return "#1E6B8C";
  return "#7A6652";
}

const POSITIONS = ["SR", "SL"];

function RulosView({ rulos, permRulos, ruloOverrides = {}, onAdd, onEdit, onDelete, onSaveOverride, onClearOverride, dayLabel }) {
  const { dark } = useTheme(); const T = dark ? DK : LT; const S = makeS(T);
  const [confirmId, setConfirmId] = useState(null);
  const [confirmIsPerm, setConfirmIsPerm] = useState(false);
  const [sheetRulo, setSheetRulo] = useState(null);
  const [overrideDraft, setOverrideDraft] = useState(null); // null | string

  const allRulos = [
    ...permRulos.map(r => ({ ...r, _perm: true })),
    ...rulos.map(r => ({ ...r, _perm: false })),
  ];
  const byPos = pos => allRulos.filter(r => r.position === pos);
  const noPos = allRulos.filter(r => !POSITIONS.includes(r.position));

  function openSheet(r) {
    setSheetRulo(r);
    setOverrideDraft(r._perm ? (ruloOverrides[r.id]?.desc ?? null) : null);
  }

  function RuloChip({ r }) {
    const color = ruloColor(r.type);
    const displayDesc = r._perm ? (ruloOverrides[r.id]?.desc ?? r.desc) : r.desc;
    const hasOverride = r._perm && ruloOverrides[r.id] !== undefined;
    return (
      <div onClick={() => openSheet(r)}
        style={{ background: T.card, border: `1px solid ${T.border}`, borderLeft: `4px solid ${color}`, borderRadius: 4, padding: "10px 12px", cursor: "pointer" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: displayDesc || r.note ? 5 : 0 }}>
          {r._perm && <span style={{ fontSize: 10, lineHeight: 1 }}>📌</span>}
          <span style={{ fontSize: 11, fontFamily: "'DM Mono',monospace", letterSpacing: "0.06em", color, fontWeight: 600 }}>{r.type || "CABLE"}{r.qty ? ` ×${r.qty}` : ""}</span>
          {hasOverride && <span style={{ fontSize: 9, color: "#D4A843", fontFamily: "'DM Mono',monospace", marginLeft: "auto" }}>{dayLabel}</span>}
        </div>
        {displayDesc && <div style={{ fontSize: 12, color: T.text2, fontFamily: "'DM Mono',monospace", lineHeight: 1.3 }}>{displayDesc}</div>}
        {r.note && <div style={{ fontSize: 11, color: "#D4A843", fontFamily: "'DM Mono',monospace", marginTop: 4 }}>⚠ {r.note}</div>}
      </div>
    );
  }

  return (
    <div>
      {/* Stage plot SR / SL */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 9, color: T.text4, letterSpacing: "0.14em", marginBottom: 8, fontFamily: "'DM Mono',monospace", textAlign: "center", textTransform: "uppercase" }}>Escenario</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          {POSITIONS.map(pos => {
            const posRulos = byPos(pos);
            return (
              <div key={pos} style={{ background: T.card2, border: `1px solid ${T.border}`, borderRadius: 4, overflow: "hidden", minHeight: 70 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "7px 10px", borderBottom: `1px solid ${T.border}`, background: "#1A1410" }}>
                  <span style={{ fontSize: 11, fontFamily: "'Bebas Neue',sans-serif", color: "#F5EFE0", letterSpacing: "0.12em" }}>{pos}</span>
                  <button onClick={() => onAdd(pos)} style={{ background: "none", border: "none", color: "#B0A090", fontSize: 18, cursor: "pointer", lineHeight: 1, padding: "0 2px" }}>+</button>
                </div>
                <div style={{ padding: 8, display: "flex", flexDirection: "column", gap: 6 }}>
                  {posRulos.length === 0
                    ? <div style={{ fontSize: 11, color: T.text4, textAlign: "center", padding: "10px 0", fontFamily: "'DM Mono',monospace" }}>—</div>
                    : posRulos.map(r => <RuloChip key={r.id} r={r} />)
                  }
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Sin posición — chips compactos */}
      {noPos.length > 0 && (
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 9, color: T.text4, letterSpacing: "0.14em", marginBottom: 8, fontFamily: "'DM Mono',monospace", textTransform: "uppercase" }}>General</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {noPos.map(r => <RuloChip key={r.id} r={r} />)}
          </div>
        </div>
      )}


      {/* detail sheet */}
      {sheetRulo && (() => {
        const r = sheetRulo;
        const color = ruloColor(r.type);
        const hasOverride = r._perm && ruloOverrides[r.id] !== undefined;
        const baseDesc = r.desc;
        return (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 200, display: "flex", alignItems: "flex-end" }}
            onClick={() => setSheetRulo(null)}>
            <div style={{ background: T.card, borderRadius: "8px 8px 0 0", padding: "20px 20px 36px", width: "100%", maxWidth: 480, margin: "0 auto", borderTop: `4px solid ${color}` }}
              onClick={e => e.stopPropagation()}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
                {r._perm && <span>📌</span>}
                <span style={{ fontSize: 14, color, fontFamily: "'DM Mono',monospace", letterSpacing: "0.06em", fontWeight: 600 }}>{r.type || "CABLE"}{r.qty ? ` ×${r.qty}` : ""}</span>
                {r.position && <span style={{ fontSize: 11, color: T.text4, fontFamily: "'DM Mono',monospace", marginLeft: "auto" }}>{r.position}</span>}
              </div>

              {/* Descripción editable por día — solo para rulos permanentes */}
              {r._perm ? (
                <div style={{ marginBottom: 14 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                    <span style={{ fontSize: 9, color: "#D4A843", fontFamily: "'DM Mono',monospace", letterSpacing: "0.12em", textTransform: "uppercase" }}>
                      Descripción · {dayLabel}
                    </span>
                    {hasOverride && (
                      <button onClick={() => { onClearOverride(r.id); setOverrideDraft(null); }}
                        style={{ background: "none", border: "none", fontSize: 10, color: T.text4, cursor: "pointer", fontFamily: "'DM Mono',monospace", padding: 0 }}>
                        Usar global ↩
                      </button>
                    )}
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <input
                      value={overrideDraft ?? (ruloOverrides[r.id]?.desc ?? baseDesc ?? "")}
                      onChange={e => setOverrideDraft(e.target.value)}
                      placeholder={baseDesc || "Sin descripción"}
                      style={{ ...S.input, flex: 1, padding: "10px 12px", fontSize: 13 }}
                    />
                    <button
                      onClick={() => { if (overrideDraft !== null) { onSaveOverride(r.id, overrideDraft); } }}
                      style={{ padding: "10px 14px", background: "#D4A843", border: "none", borderRadius: 4, color: "#1A1410", fontSize: 13, fontFamily: "'DM Mono',monospace", fontWeight: 600, cursor: "pointer", flexShrink: 0 }}>
                      ✓
                    </button>
                  </div>
                  {hasOverride && baseDesc && (
                    <div style={{ fontSize: 10, color: T.text4, fontFamily: "'DM Mono',monospace", marginTop: 5 }}>Global: {baseDesc}</div>
                  )}
                </div>
              ) : (
                r.desc && <div style={{ fontSize: 15, color: T.text, fontFamily: "'DM Mono',monospace", lineHeight: 1.4, marginBottom: 14 }}>{r.desc}</div>
              )}

              {r.note && <div style={{ fontSize: 12, color: "#D4A843", lineHeight: 1.4, padding: "8px 10px", background: dark ? "rgba(212,168,67,0.1)" : "#FFF8EC", borderLeft: "3px solid #D4A843", marginBottom: 14 }}>⚠ {r.note}</div>}
              <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                <button onClick={() => { setSheetRulo(null); onEdit(r.id); }}
                  style={{ flex: 1, padding: "13px", background: T.card2, border: `1px solid ${T.border}`, borderRadius: 4, fontSize: 13, color: T.text2, cursor: "pointer", fontFamily: "'DM Mono',monospace" }}>✏️ Editar</button>
                <button onClick={() => { setSheetRulo(null); setConfirmId(r.id); setConfirmIsPerm(r._perm); }}
                  style={{ flex: 1, padding: "13px", background: "rgba(201,74,42,0.08)", border: "1px solid rgba(201,74,42,0.3)", borderRadius: 4, fontSize: 13, color: "#C94A2A", cursor: "pointer", fontFamily: "'DM Mono',monospace" }}>🗑 Borrar</button>
              </div>
            </div>
          </div>
        );
      })()}

      {confirmId && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}
          onClick={() => setConfirmId(null)}>
          <div style={{ background: T.card, borderRadius: 4, padding: 28, width: "100%", maxWidth: 320, boxShadow: "0 8px 40px rgba(0,0,0,0.3)", borderTop: "4px solid #C94A2A" }}
            onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 13, color: T.text3, textAlign: "center", marginBottom: 20, fontFamily: "'DM Mono',monospace" }}>¿Borrar esta conexión?</div>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setConfirmId(null)} style={{ flex: 1, padding: "13px", background: T.card2, border: `1px solid ${T.border}`, borderRadius: 4, fontSize: 13, cursor: "pointer", fontFamily: "'DM Mono',monospace", color: T.text2 }}>Cancelar</button>
              <button onClick={() => { onDelete(confirmId, confirmIsPerm); setConfirmId(null); }} style={{ flex: 1, padding: "13px", background: "#C94A2A", border: "none", borderRadius: 4, fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "'DM Mono',monospace", color: "#fff" }}>Borrar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function RuloCard({ r, onEdit, onDelete }) {
  const { dark } = useTheme(); const T = dark ? DK : LT;
  const color = ruloColor(r.type);
  const bg = dark ? `${color}18` : `${color}0d`;
  const border = dark ? `${color}44` : `${color}28`;

  return (
    <div style={{ background: T.card, border: `1px solid ${T.border}`, borderLeft: `5px solid ${color}`, borderRadius: 4, overflow: "hidden" }}>
      <div style={{ padding: "12px 14px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 11, fontFamily: "'DM Mono',monospace", color, letterSpacing: "0.06em", fontWeight: 600 }}>
              {r.type || "CABLE"}{r.qty ? ` ×${r.qty}` : ""}
            </span>
          </div>
          <div style={{ display: "flex", gap: 4 }}>
            <button onClick={onEdit} style={{ background: T.card2, border: `1px solid ${T.border}`, borderRadius: 4, padding: "4px 9px", fontSize: 12, color: T.text3, cursor: "pointer" }}>✏️</button>
            <button onClick={onDelete} style={{ background: "none", border: "none", padding: "4px 6px", fontSize: 14, color: T.text4, cursor: "pointer" }}>×</button>
          </div>
        </div>
        {r.desc && <div style={{ fontSize: 14, color: T.text, marginBottom: 8, lineHeight: 1.3, fontFamily: "'DM Mono',monospace" }}>{noInfo(r.desc)}</div>}
        {(r.from || r.to) && (
          <div style={{ display: "flex", alignItems: "stretch", gap: 0, marginBottom: r.note ? 8 : 0 }}>
            <div style={{ flex: 1, background: bg, border: `1px solid ${border}`, borderRadius: "2px 0 0 2px", padding: "6px 10px" }}>
              <div style={{ fontSize: 8, color, letterSpacing: "0.12em", fontFamily: "'DM Mono',monospace", marginBottom: 2 }}>DE</div>
              <div style={{ fontSize: 11, color: T.text, fontFamily: "'DM Mono',monospace", lineHeight: 1.3 }}>{noInfo(r.from) || "—"}</div>
            </div>
            <div style={{ display: "flex", alignItems: "center", background: bg, border: `1px solid ${border}`, borderLeft: "none", borderRight: "none", padding: "0 6px" }}>
              <span style={{ color, fontSize: 10 }}>→</span>
            </div>
            <div style={{ flex: 1, background: bg, border: `1px solid ${border}`, borderRadius: "0 2px 2px 0", padding: "6px 10px" }}>
              <div style={{ fontSize: 8, color, letterSpacing: "0.12em", fontFamily: "'DM Mono',monospace", marginBottom: 2 }}>PARA</div>
              <div style={{ fontSize: 11, color: T.text, fontFamily: "'DM Mono',monospace", lineHeight: 1.3 }}>{noInfo(r.to) || "—"}</div>
            </div>
          </div>
        )}
        {r.note && (
          <div style={{ fontSize: 11, color: "#D4A843", lineHeight: 1.5, padding: "6px 10px", background: dark ? "rgba(212,168,67,0.1)" : "#FFF8EC", borderLeft: "2px solid #D4A843", marginTop: r.from || r.to ? 8 : 0 }}>
            ⚠ {r.note}
          </div>
        )}
      </div>
    </div>
  );
}

function RuloFormModal({ initial, prefillPos, onSave, onClose }) {
  const isEdit = !!initial;
  const [f, setF] = useState(initial ? {
    type: initial.type || "HMA OPTOCORE",
    qty: initial.qty || "",
    desc: initial.desc || "",
    note: initial.note || "",
    position: initial.position || "",
    permanent: initial.permanent || false,
  } : { type: "HMA OPTOCORE", qty: "", desc: "", note: "", position: prefillPos || "", permanent: false });

  const set = (k, v) => setF(p => ({ ...p, [k]: v }));
  const { dark } = useTheme(); const T = dark ? DK : LT; const S = makeS(T);

  function confirm() {
    if (!f.desc.trim() && !f.qty.trim()) return;
    onSave(f);
  }

  const valid = f.desc.trim() || f.qty.trim();
  const color = ruloColor(f.type);

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 200, display: "flex", alignItems: "flex-end" }} onClick={onClose}>
      <div style={{ background: T.card, borderRadius: "20px 20px 0 0", padding: "24px 20px 36px", width: "100%", maxWidth: 480, margin: "0 auto", maxHeight: "90dvh", overflowY: "auto" }}
        onClick={e => e.stopPropagation()}>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 9, color: T.text4, letterSpacing: "0.15em" }}>CONEXIÓN</div>
            <div style={{ fontSize: 18, fontFamily: "'Bebas Neue',sans-serif", color: T.text, letterSpacing: "0.04em" }}>
              {isEdit ? "EDITAR RULO" : "NUEVO RULO"}
            </div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: T.text4, fontSize: 20, cursor: "pointer", padding: "6px 8px" }}>✕</button>
        </div>

        {/* type selector */}
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 10, color: T.text4, letterSpacing: "0.1em", marginBottom: 8 }}>TIPO DE CABLE</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {RULO_TYPES.map(t => {
              const tc = ruloColor(t);
              const active = f.type === t;
              return (
                <button key={t} onClick={() => set("type", t)} style={{
                  padding: "5px 12px", borderRadius: 8, fontSize: 12, fontFamily: "monospace",
                  border: `1.5px solid ${active ? tc : T.border}`,
                  background: active ? `${tc}18` : T.card2,
                  color: active ? tc : T.text3,
                  cursor: "pointer", fontWeight: active ? 700 : 400,
                }}>{t}</button>
              );
            })}
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
          <div style={{ flex: 0.4 }}>
            <div style={{ fontSize: 10, color: T.text4, letterSpacing: "0.1em", marginBottom: 6 }}>CANTIDAD</div>
            <input value={f.qty} onChange={e => set("qty", e.target.value)} placeholder="2×" style={S.input} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 10, color: T.text4, letterSpacing: "0.1em", marginBottom: 6 }}>DESCRIPCIÓN</div>
            <input value={f.desc} onChange={e => set("desc", e.target.value)} placeholder="Ej: HMA OPTOCORE Festival Box" style={S.input} autoFocus />
          </div>
        </div>

        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 10, color: T.text4, letterSpacing: "0.1em", marginBottom: 6 }}>NOTA (opcional)</div>
          <input value={f.note} onChange={e => set("note", e.target.value)} placeholder="Ej: El sábado mover a Cultura Jaén SL" style={S.input} />
        </div>

        {/* posición en escenario */}
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 10, color: T.text4, letterSpacing: "0.1em", marginBottom: 8 }}>POSICIÓN EN ESCENARIO</div>
          <div style={{ display: "flex", gap: 6 }}>
            {["SR", "SL"].map(pos => (
              <button key={pos} onClick={() => set("position", f.position === pos ? "" : pos)} style={{
                flex: 1, padding: "10px", borderRadius: 10, fontSize: 13, fontFamily: "monospace", fontWeight: 700,
                border: `1.5px solid ${f.position === pos ? color : T.border}`,
                background: f.position === pos ? `${color}18` : T.card2,
                color: f.position === pos ? color : T.text3, cursor: "pointer",
              }}>{pos}</button>
            ))}
          </div>
        </div>

        {/* permanente */}
        <label style={{ display: "flex", alignItems: "center", gap: 12, background: f.permanent ? "#fef3c7" : T.card2, border: `1px solid ${f.permanent ? "#fcd34d" : T.border}`, borderRadius: 12, padding: "12px 14px", cursor: "pointer", marginBottom: 20 }}>
          <input type="checkbox" checked={!!f.permanent} onChange={e => set("permanent", e.target.checked)} style={{ accentColor: "#d97706", width: 18, height: 18 }} />
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: f.permanent ? "#92400e" : T.text, fontFamily: "monospace" }}>📌 Rulo permanente</div>
            <div style={{ fontSize: 11, color: f.permanent ? "#b45309" : T.text4, marginTop: 2 }}>Visible en todos los días del stage</div>
          </div>
        </label>

        <button onClick={confirm} disabled={!valid} style={{ ...S.bigBtn, marginTop: 0, opacity: valid ? 1 : 0.4 }}>
          {isEdit ? "GUARDAR CAMBIOS" : "AÑADIR CONEXIÓN"}
        </button>
      </div>
    </div>
  );
}

/* ---------- horarios ---------- */
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

function NotasDiaView({ festId, stageId, day, dayColor, notes, setNotes }) {
  const [draft, setDraft] = useState("");
  const textareaRef = useRef(null);
  const { dark } = useTheme();
  const T = dark ? DK : LT;

  const noteKey = `${festId}__${stageId}__${day.id}__general`;
  const dayNotes = notes[noteKey] || [];

  function addNota() {
    if (!draft.trim()) return;
    setNotes({ ...notes, [noteKey]: [...dayNotes, { text: draft.trim(), ts: Date.now() }] });
    setDraft("");
    if (textareaRef.current) textareaRef.current.focus();
  }

  function delNota(i) {
    setNotes({ ...notes, [noteKey]: dayNotes.filter((_, idx) => idx !== i) });
  }

  return (
    <div style={{ padding: "20px 14px" }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 20 }}>
        <span style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: "2.2rem", letterSpacing: "0.04em", color: dayColor, lineHeight: 1 }}>{day.label}</span>
        <span style={{ fontSize: 11, color: T.text4, fontFamily: "'DM Mono',monospace", letterSpacing: "0.1em" }}>NOTAS DEL DÍA</span>
      </div>

      {/* input nueva nota */}
      <div style={{ marginBottom: 20 }}>
        <textarea
          ref={textareaRef}
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) addNota(); }}
          placeholder="Escribe una nota…"
          rows={3}
          style={{
            width: "100%", boxSizing: "border-box",
            padding: "12px 14px", borderRadius: 10,
            border: `1.5px solid ${T.border}`,
            background: T.card, color: T.text,
            fontFamily: "'DM Sans',sans-serif", fontSize: 14,
            resize: "vertical", outline: "none",
            lineHeight: 1.5,
          }}
        />
        <button
          onClick={addNota}
          style={{
            marginTop: 8, width: "100%", padding: "13px",
            background: "#D4A843", border: "none", borderRadius: 10,
            fontFamily: "'Bebas Neue',sans-serif", letterSpacing: "0.1em",
            fontSize: 15, color: "#1A1410", cursor: "pointer",
          }}
        >+ AÑADIR NOTA</button>
      </div>

      {/* lista de notas */}
      {dayNotes.length === 0 ? (
        <div style={{ textAlign: "center", color: T.text4, fontSize: 13, marginTop: 32, fontFamily: "'DM Mono',monospace" }}>
          Sin notas para este día
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {[...dayNotes].reverse().map((n, ri) => {
            const i = dayNotes.length - 1 - ri;
            const time = new Date(n.ts).toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" });
            return (
              <div key={n.ts} style={{
                background: T.card, border: `1px solid ${T.border}`,
                borderLeft: `3px solid ${dayColor}`,
                borderRadius: "0 10px 10px 0",
                padding: "12px 14px",
                position: "relative",
              }}>
                <div style={{ fontSize: 9, color: T.text4, fontFamily: "'DM Mono',monospace", letterSpacing: "0.08em", marginBottom: 6 }}>{time}</div>
                <div style={{ fontSize: 14, color: T.text, fontFamily: "'DM Sans',sans-serif", lineHeight: 1.55, whiteSpace: "pre-wrap", wordBreak: "break-word", paddingRight: 28 }}>{n.text}</div>
                <button
                  onClick={() => delNota(i)}
                  style={{
                    position: "absolute", top: 10, right: 10,
                    width: 24, height: 24, borderRadius: "50%",
                    background: "none", border: `1px solid ${T.border2}`,
                    color: T.text4, fontSize: 14, cursor: "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    lineHeight: 1,
                  }}
                >×</button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function HorariosView({ artists, day, onSaveTime }) {
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
        {[["sc", "SOUNDCHECK", scColor], ["show", "SHOW", showColor]].map(([val, lbl, col]) => (
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
        <div style={{ textAlign: "center", color: T.text4, fontSize: 13, marginTop: 40 }}>Sin artistas en este día</div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {sorted.map(a => {
          const isEditing = editId === a.id;
          const hasAnytime = a.scStart || a.scEnd || a.showStart || a.showEnd;
          const activePill = horariosTab === "sc"
            ? { label: "SOUNDCHECK", start: a.scStart, end: a.scEnd, color: scColor, bg: scBg, border: scBorder }
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
                      <div style={{ fontSize: 9, color: scColor, letterSpacing: "0.12em", marginBottom: 5, fontFamily: "'DM Mono',monospace" }}>SC INICIO</div>
                      <input type="time" value={editScStart} onChange={e => setEditScStart(e.target.value)} style={{ ...S.input, padding: "10px 12px" }} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 9, color: scColor, letterSpacing: "0.12em", marginBottom: 5, fontFamily: "'DM Mono',monospace" }}>SC FIN</div>
                      <input type="time" value={editScEnd} onChange={e => setEditScEnd(e.target.value)} style={{ ...S.input, padding: "10px 12px" }} />
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 9, color: showColor, letterSpacing: "0.12em", marginBottom: 5, fontFamily: "'DM Mono',monospace" }}>SH INICIO</div>
                      <input type="time" value={editShowStart} onChange={e => setEditShowStart(e.target.value)} style={{ ...S.input, padding: "10px 12px" }} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 9, color: showColor, letterSpacing: "0.12em", marginBottom: 5, fontFamily: "'DM Mono',monospace" }}>SH FIN</div>
                      <input type="time" value={editShowEnd} onChange={e => setEditShowEnd(e.target.value)} style={{ ...S.input, padding: "10px 12px" }} />
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={() => confirmEdit(a.id)} style={{ ...S.bigBtn, flex: 1, padding: "11px", marginTop: 0, fontSize: 13 }}>Guardar</button>
                    <button onClick={() => setEditId(null)} style={{ ...S.smBtn, flex: 0.5 }}>Cancelar</button>
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

/* ---------- mon view ---------- */
function MonView({ fest, stage, monPos, dayIdx, setDayIdx, onEditFest, onBack }) {
  const { dark } = useTheme(); const T = dark ? DK : LT; const S = makeS(T);
  const [tab, setTab] = useState("bandas"); // "bandas" | "inputs" | "outputs" | "rf" | "horarios"
  const [selectedArtistId, setSelectedArtistId] = useState(null);
  // inline editing for static fields
  const [editingConsole, setEditingConsole] = useState(false);
  const [editingTecnico, setEditingTecnico] = useState(false);
  const [consoleVal, setConsoleVal] = useState(monPos.console || "");
  const [tecnicoVal, setTecnicoVal] = useState(monPos.tecnico || "");
  // add-row forms
  const [showAddInput, setShowAddInput] = useState(false);
  const [showAddOutput, setShowAddOutput] = useState(false);
  const [showAddRf, setShowAddRf] = useState(false);
  // new row fields
  const [newInput, setNewInput] = useState({ ch: "", source: "", type: "Mic" });
  const [newOutput, setNewOutput] = useState({ mix: "", dest: "", type: "Wedge" });
  const [newRf, setNewRf] = useState({ ch: "", freq: "", user: "", type: "IEM" });
  // editing rows
  const [editInputId, setEditInputId] = useState(null);
  const [editInputVal, setEditInputVal] = useState({});
  const [editOutputId, setEditOutputId] = useState(null);
  const [editOutputVal, setEditOutputVal] = useState({});
  const [editRfId, setEditRfId] = useState(null);
  const [editRfVal, setEditRfVal] = useState({});

  // sync local vals when monPos changes (e.g. after save)
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

  // INPUTS
  function addInput() {
    if (!newInput.ch.trim() && !newInput.source.trim()) return;
    const entry = { id: uid(), ch: newInput.ch.trim(), source: newInput.source.trim(), type: newInput.type };
    saveMonPos({ ...monPos, inputs: [...(monPos.inputs || []), entry] });
    setNewInput({ ch: "", source: "", type: "Mic" });
    setShowAddInput(false);
  }
  function deleteInput(id) { saveMonPos({ ...monPos, inputs: (monPos.inputs || []).filter(x => x.id !== id) }); }
  function saveInput(id) {
    saveMonPos({ ...monPos, inputs: (monPos.inputs || []).map(x => x.id === id ? { ...x, ...editInputVal } : x) });
    setEditInputId(null);
  }

  // OUTPUTS
  function addOutput() {
    if (!newOutput.mix.trim() && !newOutput.dest.trim()) return;
    const entry = { id: uid(), mix: newOutput.mix.trim(), dest: newOutput.dest.trim(), type: newOutput.type };
    saveMonPos({ ...monPos, outputs: [...(monPos.outputs || []), entry] });
    setNewOutput({ mix: "", dest: "", type: "Wedge" });
    setShowAddOutput(false);
  }
  function deleteOutput(id) { saveMonPos({ ...monPos, outputs: (monPos.outputs || []).filter(x => x.id !== id) }); }
  function saveOutput(id) {
    saveMonPos({ ...monPos, outputs: (monPos.outputs || []).map(x => x.id === id ? { ...x, ...editOutputVal } : x) });
    setEditOutputId(null);
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

  const tabBtnStyle = (active) => ({
    flex: 1, padding: "5px 8px", borderRadius: 8, fontSize: 11,
    fontFamily: "'Bebas Neue',sans-serif", letterSpacing: "0.06em", cursor: "pointer",
    border: "none",
    background: active ? (dark ? "#334155" : "#0f172a") : "transparent",
    color: active ? "#fff" : T.text4,
    transition: "all 0.2s",
  });

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

  /* ---- detail screen ---- */
  const selectedArt = selectedArtistId ? (day?.artists || []).find(a => a.id === selectedArtistId) : null;
  if (selectedArt) return (
    <div style={{ display: "flex", flexDirection: "column", height: "100dvh", overflow: "hidden" }}>
      <MonTopBar onBackBtn={() => setSelectedArtistId(null)} />
      <div style={{ flex: 1, padding: "12px 14px", background: T.bg, overflowY: "auto", paddingBottom: "max(24px, env(safe-area-inset-bottom, 24px))" }}>
        <div style={{ background: T.card, border: `0.5px solid ${T.border}`, borderRadius: 16, overflow: "hidden" }}>

          {/* nombre */}
          <div style={{ padding: "14px 16px", borderBottom: `0.5px solid ${T.border}` }}>
            <div style={{ fontSize: 24, fontWeight: 500, fontFamily: "'Bebas Neue',sans-serif", letterSpacing: "0.02em", color: T.text, lineHeight: 1.1 }}>{selectedArt.artist || "—"}</div>
            <div style={{ fontSize: 11, color: "#7c3aed", marginTop: 4, fontFamily: "monospace" }}>{monPos.name}</div>
          </div>

          {/* setup monitor */}
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

          {/* conexiones FOH (para parcheo) */}
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

          {/* To LX */}
          {selectedArt.toLx && (
            <div style={{ borderBottom: `0.5px solid ${T.border}`, padding: "0 12px 12px" }}>
              <div style={{ padding: "10px 4px 8px", fontSize: 10, fontWeight: 500, letterSpacing: "0.07em", textTransform: "uppercase", color: T.text4 }}>Rutas</div>
              <RouteChip icon="💡" label="TO LX" value={noInfo(selectedArt.toLx)} color="#ea580c" />
            </div>
          )}

          {/* Notas previas */}
          {(selectedArt.comments || []).length > 0 && (
            <div style={{ borderBottom: `0.5px solid ${T.border}`, padding: "10px 16px 12px" }}>
              <div style={{ fontSize: 10, fontWeight: 500, letterSpacing: "0.07em", textTransform: "uppercase", color: T.text4, marginBottom: 8 }}>Notas previas</div>
              {selectedArt.comments.map((c, i) => (
                <div key={i} style={{ fontSize: 13, color: T.text2, lineHeight: 1.5, padding: "6px 10px", background: T.card2, borderLeft: `2px solid ${T.border}`, borderRadius: "0 6px 6px 0", marginBottom: 4 }}>{c}</div>
              ))}
            </div>
          )}

          {/* Extra slots */}
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
    <div style={{ display: "flex", flexDirection: "column", height: "100dvh", overflow: "hidden" }}>
      <MonTopBar onBackBtn={onBack} />

      <div style={{ flex: 1, overflowY: "auto", padding: "14px 14px", background: T.bg, paddingBottom: "max(24px, env(safe-area-inset-bottom, 24px))" }}>

        {/* BANDAS TAB — fichas compactas como FOH */}
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

/* ---------- EscenarioView ---------- */
const PLOT_COLS = 7;
const PLOT_ROWS = 5;
const PLOT_ICONS = [
  { icon: "🎤", label: "Voz" },
  { icon: "🥁", label: "Batería" },
  { icon: "🎸", label: "Guitarra" },
  { icon: "🎹", label: "Teclado" },
  { icon: "🎺", label: "Viento" },
  { icon: "🎻", label: "Cuerda" },
  { icon: "🔊", label: "Sub" },
  { icon: "📦", label: "Amp" },
  { icon: "💡", label: "Luz" },
  { icon: "📺", label: "Pantalla" },
  { icon: "🧍", label: "Persona" },
  { icon: "⬜", label: "Libre" },
];

function EscenarioView({ fest, stage, onEditFest, onBack, onDelete }) {
  const { dark } = useTheme(); const T = dark ? DK : LT; const S = makeS(T);
  const [tab, setTab] = useState("bandas");
  const [dayIdx, setDayIdx] = useState(0);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pickerCell, setPickerCell] = useState(null); // { row, col } or null
  const [pickerTab, setPickerTab] = useState("icon");  // icon | subbox | corriente
  const [selectedPlotId, setSelectedPlotId] = useState(null);
  const [customLabel, setCustomLabel] = useState("");
  const [sbDraft, setSbDraft] = useState({ name: "", from: "", to: "" });

  const esc = stage.escenario || { inputs: [], power: [], plot: [] };

  function saveEsc(updated) {
    const newStages = (fest.stages || []).map(s =>
      s.id === stage.id ? { ...s, escenario: updated } : s
    );
    onEditFest({ ...fest, stages: newStages });
  }

  // Inputs
  function addInput(entry) {
    saveEsc({ ...esc, inputs: [...(esc.inputs || []), { id: uid(), ch: entry.ch || "", source: entry.source || "", type: entry.type || "Mic" }] });
  }
  function editInput(id, field, val) {
    saveEsc({ ...esc, inputs: (esc.inputs || []).map(x => x.id === id ? { ...x, [field]: val } : x) });
  }
  function delInput(id) { saveEsc({ ...esc, inputs: (esc.inputs || []).filter(x => x.id !== id) }); }

  // Power
  function addPower(entry) {
    saveEsc({ ...esc, power: [...(esc.power || []), { id: uid(), grupo: entry.grupo || "", tomas: entry.tomas || "", kw: entry.kw || "", notas: entry.notas || "" }] });
  }
  function editPower(id, field, val) {
    saveEsc({ ...esc, power: (esc.power || []).map(x => x.id === id ? { ...x, [field]: val } : x) });
  }
  function delPower(id) { saveEsc({ ...esc, power: (esc.power || []).filter(x => x.id !== id) }); }

  // Plot
  const plotItems = esc.plot || [];
  const kindOf = (p) => p.kind || "icon";
  function cellItem(row, col) { return plotItems.find(p => p.row === row && p.col === col); }
  function placeAt(row, col, data) {
    const filtered = plotItems.filter(p => !(p.row === row && p.col === col));
    saveEsc({ ...esc, plot: [...filtered, { id: uid(), row, col, ...data }] });
  }
  function updateItem(id, patch) {
    saveEsc({ ...esc, plot: plotItems.map(p => p.id === id ? { ...p, ...patch } : p) });
  }
  function removeItem(id) { saveEsc({ ...esc, plot: plotItems.filter(p => p.id !== id) }); }

  // links to other tabs
  const powerById = (id) => (esc.power || []).find(p => p.id === id);
  function inputsInRange(from, to) {
    const a = parseInt(from, 10), b = parseInt(to, 10);
    if (isNaN(a) && isNaN(b)) return [];
    const lo = isNaN(a) ? b : isNaN(b) ? a : Math.min(a, b);
    const hi = isNaN(b) ? a : isNaN(a) ? b : Math.max(a, b);
    return (esc.inputs || []).filter(i => { const n = parseInt(i.ch, 10); return !isNaN(n) && n >= lo && n <= hi; });
  }
  const rangeStr = (p) => (p.from && p.to) ? `${p.from}–${p.to}` : (p.from || p.to || "");

  // category palette
  const CAT = {
    icon:      { color: dark ? "#34d399" : "#16a34a", bg: dark ? "#064e3b" : "#dcfce7", border: dark ? "#10b981" : "#16a34a", glyph: "🎚️", label: "Instrumento" },
    subbox:    { color: dark ? "#60a5fa" : "#2563eb", bg: dark ? "#172554" : "#dbeafe", border: dark ? "#3b82f6" : "#2563eb", glyph: "🔌", label: "Subbox" },
    corriente: { color: dark ? "#fbbf24" : "#d97706", bg: dark ? "#422006" : "#fef3c7", border: dark ? "#D4A843" : "#d97706", glyph: "⚡", label: "Corriente" },
  };

  function renderPlotCell(item) {
    const k = kindOf(item);
    if (k === "subbox") return (
      <>
        <div style={{ fontSize: 13, lineHeight: 1 }}>🔌</div>
        <div style={{ fontSize: 8, fontWeight: 700, color: CAT.subbox.color, marginTop: 1, lineHeight: 1.05, textAlign: "center", wordBreak: "break-word", maxWidth: "100%" }}>{item.name || "SB"}</div>
        {rangeStr(item) && <div style={{ fontSize: 7, color: T.text4, lineHeight: 1 }}>{rangeStr(item)}</div>}
      </>
    );
    if (k === "corriente") {
      const g = powerById(item.refId);
      return (
        <>
          <div style={{ fontSize: 14, lineHeight: 1 }}>⚡</div>
          <div style={{ fontSize: 8, fontWeight: 700, color: CAT.corriente.color, marginTop: 1, lineHeight: 1.05, textAlign: "center", wordBreak: "break-word", maxWidth: "100%" }}>{g?.grupo || "—"}</div>
          {g?.kw && <div style={{ fontSize: 7, color: T.text4, lineHeight: 1 }}>{g.kw}kW</div>}
        </>
      );
    }
    return (
      <>
        <div style={{ fontSize: 18, lineHeight: 1 }}>{item.icon}</div>
        <div style={{ fontSize: 7, color: T.text3, marginTop: 1, textAlign: "center", lineHeight: 1.1, wordBreak: "break-word", maxWidth: "100%" }}>{item.label}</div>
      </>
    );
  }

  const inputCols = [
    { key: "ch", placeholder: "CH", width: 44 },
    { key: "source", placeholder: "Nombre / Fuente", flex: 2 },
    { key: "type", placeholder: "Tipo", flex: 1, options: ["Mic", "DI", "Line", "SB", "MADI", "AES", "Otro"] },
  ];
  const powerCols = [
    { key: "grupo", placeholder: "Grupo", width: 60 },
    { key: "tomas", placeholder: "Tomas", width: 54 },
    { key: "kw", placeholder: "kW", width: 44 },
    { key: "notas", placeholder: "Notas", flex: 2 },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100dvh", overflow: "hidden" }}>
      {/* top bar + tabs combined, same pattern as FestView */}
      <div style={{ ...S.topBar, flexWrap: "wrap", rowGap: 8, padding: "10px 12px 8px" }}>
        <div style={{ display: "flex", alignItems: "center", width: "100%" }}>
          <button onClick={onBack} style={S.backBtn}>‹</button>
          <div style={{ flex: 1, textAlign: "center", fontSize: 18, fontFamily: "'Bebas Neue',sans-serif", color: T.text, letterSpacing: "0.06em" }}>
            {stage.name}
          </div>
          <div style={{ width: 36 }} />
        </div>

        {/* bottom sheet de confirmación — unused, kept for safety */}
        {confirmDelete && (
          <div onClick={() => setConfirmDelete(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 300, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
            <div onClick={e => e.stopPropagation()} style={{ background: T.card, borderRadius: "20px 20px 0 0", padding: "24px 20px 40px", width: "100%", maxWidth: 480, margin: "0 auto" }}>
              <div style={{ width: 36, height: 4, borderRadius: 2, background: T.border, margin: "0 auto 20px" }} />
              <div style={{ fontSize: 18, fontFamily: "'Bebas Neue',sans-serif", color: T.text, letterSpacing: "0.04em", marginBottom: 6 }}>Eliminar posición de escenario</div>
              <div style={{ fontSize: 13, color: T.text3, fontFamily: "'DM Mono',monospace", marginBottom: 24 }}>
                Se borrarán todos los inputs, grupos de corriente y el plano de {stage.name}. Esta acción no se puede deshacer.
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                <button onClick={() => setConfirmDelete(false)} style={{ flex: 1, padding: "14px", background: T.card2, border: `1px solid ${T.border}`, borderRadius: 12, fontSize: 14, cursor: "pointer", color: T.text3, fontFamily: "'DM Mono',monospace" }}>
                  Cancelar
                </button>
                <button onClick={onDelete} style={{ flex: 1, padding: "14px", background: "#ef4444", border: "none", borderRadius: 12, fontSize: 14, fontWeight: 700, cursor: "pointer", color: "#fff", fontFamily: "'DM Mono',monospace" }}>
                  Eliminar
                </button>
              </div>
            </div>
          </div>
        )}
        {/* tab pills */}
        <div style={{ display: "flex", gap: 4, background: T.card2, borderRadius: 10, padding: 3 }}>
          {[["bandas", "BANDAS"], ["inputs", "INPUTS"], ["power", "CORRIENTE"], ["plot", "PLANO"]].map(([id, lbl]) => (
            <button key={id} onClick={() => setTab(id)} style={{
              padding: "4px 10px", borderRadius: 8, fontSize: 11,
              fontFamily: "'Bebas Neue',sans-serif", letterSpacing: "0.06em", cursor: "pointer",
              border: "none",
              background: tab === id ? (dark ? "#334155" : "#0f172a") : "transparent",
              color: tab === id ? "#fff" : T.text4,
              transition: "all 0.2s",
            }}>{lbl}</button>
          ))}
        </div>
      </div>

      {/* day selector — visible on bandas tab */}
      {tab === "bandas" && stage.days.length > 1 && (
        <div style={{ display: "flex", gap: 6, overflowX: "auto", padding: "6px 14px 8px", background: T.topBar, borderBottom: `1px solid ${T.border}`, alignItems: "center" }}>
          {stage.days.map((d, i) => {
            const dateLabel = d.date ? new Date(d.date + "T12:00").toLocaleDateString("es", { day: "numeric", month: "short" }) : null;
            return (
              <button key={d.id} onClick={() => setDayIdx(i)} style={{
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
      )}

      <div style={{ flex: 1, overflowY: "auto", padding: "16px 14px", paddingBottom: "max(24px, env(safe-area-inset-bottom, 24px))" }}>

        {tab === "bandas" && (() => {
          const day = stage.days[dayIdx] || stage.days[0];
          const artists = day ? [...(day.artists || [])].sort((a, b) => festTimeToMin(a.showStart) - festTimeToMin(b.showStart)) : [];
          const dayRulos = day?.rulos || [];
          const permRulos = stage.rulos || [];
          return (
            <div>
              {artists.length === 0 && (
                <div style={{ textAlign: "center", color: T.text4, fontSize: 13, marginTop: 40, fontFamily: "monospace" }}>Sin artistas en este día</div>
              )}
              {artists.length > 0 && (
                <span style={{ fontSize: 10, letterSpacing: "0.08em", color: T.text4, textTransform: "uppercase", display: "block", marginBottom: 6 }}>Ficha compacta</span>
              )}
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {artists.map(a => (
                  <EscenarioCompactArtistCard key={a.id} a={a} dayRulos={dayRulos} permRulos={permRulos} T={T} dark={dark} />
                ))}
              </div>
            </div>
          );
        })()}

        {tab === "inputs" && (
          <QuickTable
            items={esc.inputs || []}
            cols={inputCols}
            onAdd={addInput}
            onEdit={editInput}
            onDelete={delInput}
            T={T} S={S}
          />
        )}

        {tab === "power" && (
          <QuickTable
            items={esc.power || []}
            cols={powerCols}
            onAdd={addPower}
            onEdit={editPower}
            onDelete={delPower}
            T={T} S={S}
          />
        )}

        {tab === "plot" && (
          <div>
            {/* Stage frame */}
            <div style={{ border: `1.5px solid ${T.border}`, borderRadius: 16, background: dark ? "#0b1220" : "#fbfdff", padding: 12, boxShadow: dark ? "none" : "inset 0 1px 4px rgba(0,0,0,0.04)" }}>
              {/* back wall */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 22, marginBottom: 10, borderRadius: 7, background: T.card2, border: `1px solid ${T.border}`, color: T.text4, fontSize: 9, letterSpacing: "0.18em", fontFamily: "'Bebas Neue',sans-serif" }}>
                FONDO · BACKLINE
              </div>
              {/* Grid */}
              <div style={{ display: "grid", gridTemplateColumns: `repeat(${PLOT_COLS}, 1fr)`, gap: 5 }}>
                {Array.from({ length: PLOT_ROWS }, (_, row) =>
                  Array.from({ length: PLOT_COLS }, (_, col) => {
                    const item = cellItem(row, col);
                    const sel = item && selectedPlotId === item.id;
                    const cat = item ? CAT[kindOf(item)] : null;
                    return (
                      <div key={`${row}-${col}`}
                        onClick={() => {
                          if (item) { setSelectedPlotId(sel ? null : item.id); }
                          else { setPickerCell({ row, col }); setPickerTab("icon"); setSelectedPlotId(null); setCustomLabel(""); setSbDraft({ name: "", from: "", to: "" }); }
                        }}
                        style={{
                          aspectRatio: "1", borderRadius: 9, display: "flex", flexDirection: "column",
                          alignItems: "center", justifyContent: "center", cursor: "pointer",
                          background: item ? (sel ? cat.bg : T.card) : "transparent",
                          border: item ? `1.5px solid ${sel ? cat.border : T.border}` : `1px dashed ${T.border}`,
                          boxShadow: sel ? `0 0 0 2px ${cat.border}55` : "none",
                          borderLeft: item && !sel ? `2.5px solid ${cat.border}` : undefined,
                          transition: "all 0.15s", overflow: "hidden", padding: 3,
                        }}>
                        {item ? renderPlotCell(item) : <div style={{ fontSize: 15, color: T.border, opacity: 0.55 }}>+</div>}
                      </div>
                    );
                  })
                )}
              </div>
              {/* downstage edge */}
              <div style={{ height: 10, marginTop: 10, borderRadius: 6, background: dark ? "#334155" : "#0f172a" }} />
            </div>
            <div style={{ textAlign: "center", fontSize: 9, color: T.text4, letterSpacing: "0.2em", marginTop: 6, marginBottom: 14, fontFamily: "'Bebas Neue',sans-serif" }}>▼ PÚBLICO ▼</div>

            {/* Legend */}
            <div style={{ display: "flex", gap: 16, justifyContent: "center", marginBottom: 14 }}>
              {["icon", "subbox", "corriente"].map(k => (
                <div key={k} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 10, color: T.text4 }}>
                  <span style={{ width: 9, height: 9, borderRadius: 3, background: CAT[k].bg, border: `1.5px solid ${CAT[k].border}` }} />
                  {CAT[k].label}
                </div>
              ))}
            </div>

            {/* Selected item panel */}
            {selectedPlotId && (() => {
              const item = plotItems.find(p => p.id === selectedPlotId);
              if (!item) return null;
              const k = kindOf(item);
              const cat = CAT[k];
              const chip = { fontSize: 11, fontFamily: "monospace", padding: "3px 8px", borderRadius: 6, background: T.card2, border: `0.5px solid ${T.border}`, color: T.text2 };
              return (
                <div style={{ background: T.card, border: `1px solid ${cat.border}`, borderLeft: `3px solid ${cat.border}`, borderRadius: 14, padding: "12px 14px", marginBottom: 12 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ fontSize: 24 }}>{k === "icon" ? item.icon : cat.glyph}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 9, color: cat.color, letterSpacing: "0.1em", fontWeight: 700 }}>{cat.label.toUpperCase()}</div>
                      <div style={{ fontSize: 11, color: T.text4 }}>Fila {item.row + 1} · Col {item.col + 1}</div>
                    </div>
                    <button onClick={() => { removeItem(selectedPlotId); setSelectedPlotId(null); }}
                      style={{ background: "#fee2e2", border: "1px solid #fecaca", borderRadius: 8, color: "#ef4444", padding: "6px 12px", fontSize: 12, cursor: "pointer" }}>
                      Borrar
                    </button>
                  </div>

                  {k === "icon" && (
                    <input value={item.label || ""} onChange={e => updateItem(item.id, { label: e.target.value })} placeholder="Etiqueta" style={{ ...S.input, fontSize: 13, marginTop: 10 }} />
                  )}

                  {k === "subbox" && (
                    <div style={{ marginTop: 10 }}>
                      <input value={item.name || ""} onChange={e => updateItem(item.id, { name: e.target.value })} placeholder="Nombre (ej. SB1)" style={{ ...S.input, fontSize: 13, marginBottom: 8 }} />
                      <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                        <input value={item.from || ""} onChange={e => updateItem(item.id, { from: e.target.value })} placeholder="CH desde" inputMode="numeric" style={{ ...S.input, fontSize: 13 }} />
                        <input value={item.to || ""} onChange={e => updateItem(item.id, { to: e.target.value })} placeholder="CH hasta" inputMode="numeric" style={{ ...S.input, fontSize: 13 }} />
                      </div>
                      {(() => {
                        const ins = inputsInRange(item.from, item.to);
                        return (
                          <>
                            <div style={{ fontSize: 10, color: T.text4, letterSpacing: "0.08em", marginBottom: 6 }}>{ins.length} INPUT{ins.length !== 1 ? "S" : ""} EN RANGO</div>
                            {ins.length > 0 ? (
                              <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                                {ins.map(i => (
                                  <span key={i.id} style={chip}><b style={{ color: CAT.subbox.color }}>{i.ch}</b> {i.source || ""}</span>
                                ))}
                              </div>
                            ) : (
                              <div style={{ fontSize: 11, color: T.text4 }}>Sin inputs en este rango — defínelos en la pestaña INPUTS.</div>
                            )}
                          </>
                        );
                      })()}
                    </div>
                  )}

                  {k === "corriente" && (
                    <div style={{ marginTop: 10 }}>
                      <div style={{ fontSize: 10, color: T.text4, letterSpacing: "0.08em", marginBottom: 6 }}>GRUPO VINCULADO</div>
                      <select value={item.refId || ""} onChange={e => updateItem(item.id, { refId: e.target.value })} style={{ ...S.input, fontSize: 13 }}>
                        <option value="">— Sin vincular —</option>
                        {(esc.power || []).map(g => <option key={g.id} value={g.id}>{g.grupo || "(sin nombre)"}{g.kw ? ` · ${g.kw}kW` : ""}</option>)}
                      </select>
                      {(() => {
                        const g = powerById(item.refId);
                        return g ? (
                          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
                            {g.tomas && <span style={chip}>Tomas {g.tomas}</span>}
                            {g.kw && <span style={chip}>{g.kw} kW</span>}
                            {g.notas && <span style={chip}>{g.notas}</span>}
                          </div>
                        ) : <div style={{ fontSize: 11, color: T.text4, marginTop: 8 }}>Vincula un grupo de la pestaña CORRIENTE.</div>;
                      })()}
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Picker */}
            {pickerCell && (
              <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 14, padding: "14px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                  <div style={{ fontSize: 10, color: T.text4, letterSpacing: "0.12em" }}>AÑADIR AL PLANO</div>
                  <button onClick={() => setPickerCell(null)} style={{ background: "none", border: "none", color: T.text4, fontSize: 20, cursor: "pointer", lineHeight: 1, padding: 0 }}>×</button>
                </div>

                {/* category tabs */}
                <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
                  {[["icon", "Instrumento"], ["subbox", "Subbox"], ["corriente", "Corriente"]].map(([id, lbl]) => {
                    const active = pickerTab === id; const c = CAT[id];
                    return (
                      <button key={id} onClick={() => setPickerTab(id)}
                        style={{ flex: 1, padding: "6px 8px", borderRadius: 9, border: `1px solid ${active ? c.border : T.border}`, background: active ? c.bg : "transparent", color: active ? c.color : T.text4, fontSize: 11, fontFamily: "'Bebas Neue',sans-serif", letterSpacing: "0.06em", cursor: "pointer" }}>
                        {lbl}
                      </button>
                    );
                  })}
                </div>

                {pickerTab === "icon" && (
                  <>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, marginBottom: 12 }}>
                      {PLOT_ICONS.map(({ icon, label }) => (
                        <button key={icon} onClick={() => { placeAt(pickerCell.row, pickerCell.col, { kind: "icon", icon, label: customLabel || label }); setPickerCell(null); }}
                          style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3, background: T.card2, border: `1px solid ${T.border}`, borderRadius: 10, padding: "8px 4px", cursor: "pointer" }}>
                          <div style={{ fontSize: 22 }}>{icon}</div>
                          <div style={{ fontSize: 9, color: T.text3 }}>{label}</div>
                        </button>
                      ))}
                    </div>
                    <input value={customLabel} onChange={e => setCustomLabel(e.target.value)} placeholder="Etiqueta personalizada (opcional)" style={{ ...S.input, fontSize: 12 }} />
                  </>
                )}

                {pickerTab === "subbox" && (
                  <>
                    <input value={sbDraft.name} onChange={e => setSbDraft(v => ({ ...v, name: e.target.value }))} placeholder="Nombre (ej. SB1)" style={{ ...S.input, fontSize: 13, marginBottom: 8 }} />
                    <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                      <input value={sbDraft.from} onChange={e => setSbDraft(v => ({ ...v, from: e.target.value }))} placeholder="CH desde" inputMode="numeric" style={{ ...S.input, fontSize: 13 }} />
                      <input value={sbDraft.to} onChange={e => setSbDraft(v => ({ ...v, to: e.target.value }))} placeholder="CH hasta" inputMode="numeric" style={{ ...S.input, fontSize: 13 }} />
                    </div>
                    {(sbDraft.from || sbDraft.to) && (() => {
                      const n = inputsInRange(sbDraft.from, sbDraft.to).length;
                      return <div style={{ fontSize: 10, color: CAT.subbox.color, marginBottom: 10 }}>{n} input{n !== 1 ? "s" : ""} de la pestaña INPUTS en este rango</div>;
                    })()}
                    <button onClick={() => { placeAt(pickerCell.row, pickerCell.col, { kind: "subbox", name: sbDraft.name.trim(), from: sbDraft.from.trim(), to: sbDraft.to.trim() }); setPickerCell(null); }}
                      style={{ width: "100%", padding: 14, borderRadius: 12, border: "none", cursor: "pointer", background: CAT.subbox.border, color: "#fff", fontSize: 14, fontFamily: "'Bebas Neue',sans-serif", letterSpacing: "0.08em" }}>
                      Colocar subbox
                    </button>
                  </>
                )}

                {pickerTab === "corriente" && (
                  (esc.power || []).length === 0 ? (
                    <div style={{ fontSize: 12, color: T.text4, textAlign: "center", padding: "16px 8px", lineHeight: 1.6 }}>
                      No hay grupos de corriente.<br />Créalos primero en la pestaña <b style={{ color: CAT.corriente.color }}>CORRIENTE</b>.
                    </div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      {(esc.power || []).map(g => (
                        <button key={g.id} onClick={() => { placeAt(pickerCell.row, pickerCell.col, { kind: "corriente", refId: g.id }); setPickerCell(null); }}
                          style={{ display: "flex", alignItems: "center", gap: 10, background: T.card2, border: `1px solid ${T.border}`, borderRadius: 10, padding: "10px 12px", cursor: "pointer", textAlign: "left" }}>
                          <span style={{ fontSize: 18 }}>⚡</span>
                          <span style={{ flex: 1 }}>
                            <span style={{ display: "block", fontSize: 13, fontWeight: 700, color: T.text }}>{g.grupo || "(sin nombre)"}</span>
                            <span style={{ fontSize: 11, color: T.text4, fontFamily: "monospace" }}>{[g.tomas && `${g.tomas} tomas`, g.kw && `${g.kw}kW`].filter(Boolean).join(" · ") || "—"}</span>
                          </span>
                        </button>
                      ))}
                    </div>
                  )
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------- QuickTable: inline add row, tap to edit ---------- */
function QuickTable({ label, items, cols, onAdd, onEdit, onDelete, T, S }) {
  const autoCol = cols.find(c => !c.options); // first text col (CH / MIX) gets auto-number
  const emptyDraft = (nextN) => {
    const d = Object.fromEntries(cols.map(c => [c.key, c.options ? c.options[0] : ""]));
    if (autoCol) d[autoCol.key] = String(nextN ?? items.length + 1);
    return d;
  };
  const [draft, setDraft] = useState(() => emptyDraft());
  const [editId, setEditId] = useState(null);
  const [editField, setEditField] = useState(null);
  const [editDraft, setEditDraft] = useState({});
  const sourceRef = useRef(null); // foco directo al campo Source/Dest
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

  // keep auto-number in sync after each add
  useEffect(() => {
    if (autoCol) setDraft(v => ({ ...v, [autoCol.key]: String(items.length + 1) }));
  }, [items.length]); // eslint-disable-line react-hooks/exhaustive-deps

  function commitAdd() {
    const hasValue = cols.some(c => !c.options && (draft[c.key] || "").trim());
    if (!hasValue) return;
    onAdd(draft);
    // reset all fields except autoCol (CH/MIX) — useEffect handles that
    setDraft(v => Object.fromEntries(cols.map(c => [c.key, c === autoCol ? v[c.key] : c.options ? c.options[0] : ""])));
    setTimeout(() => sourceRef.current?.focus(), 0);
  }

  const rowBase = { display: "flex", alignItems: "center", gap: 6, padding: "7px 10px", borderRadius: 10, marginBottom: 5, fontFamily: "monospace", fontSize: 13 };

  return (
    <div>
      {/* header */}
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

      {/* existing rows */}
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

      {/* inline add row — siempre visible */}
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

/* ---------- compact artist card for Mon view ---------- */
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
        {/* nombre + técnico + consola MON */}
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

        {/* chips: señal FOH · toMon */}
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

        {/* footer: inputs · outputs · RF del monPos */}
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

/* ---------- EscenarioCompactArtistCard ---------- */
function EscenarioCompactArtistCard({ a, T, dark }) {
  const chipBg = T.card2;
  const chipBorder = T.border;

  return (
    <div style={{ borderRadius: 14, overflow: "hidden", border: `0.5px solid ${T.border}`, borderLeft: "3px solid #2A6B6B", background: T.card }}>
      {/* cabecera: nombre + señal + técnico */}
      <div style={{ padding: "12px 14px 10px", display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10 }}>
        <span style={{ fontSize: 20, fontWeight: 500, fontFamily: "'Bebas Neue',sans-serif", letterSpacing: "0.02em", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", color: T.text }}>
          {a.artist || "—"}
        </span>
        {a.escTecnico && (
          <div style={{ textAlign: "right", flexShrink: 0 }}>
            <div style={{ fontSize: 9, color: T.text4, textTransform: "uppercase", letterSpacing: "0.06em" }}>técnico</div>
            <div style={{ fontSize: 13, fontWeight: 500, fontFamily: "monospace", color: T.text2 }}>{noInfo(a.escTecnico)}</div>
          </div>
        )}
      </div>

      {/* chips: señal · conexión — campos propios de escenario */}
      {(a.escSignal || a.escConnection || a.escConsole) && (
        <div style={{ display: "flex", alignItems: "center", gap: 5, padding: "0 14px 10px", flexWrap: "wrap" }}>
          {a.escSignal && (
            <span style={{ fontSize: 11, fontWeight: 500, fontFamily: "monospace", padding: "3px 8px", borderRadius: 6, background: chipBg, border: `0.5px solid ${chipBorder}`, color: sigColor(a.escSignal) }}>
              {noInfo(a.escSignal)}
            </span>
          )}
          {a.escConnection && (
            <>
              {a.escSignal && <span style={{ color: T.text4, opacity: 0.5, fontSize: 12 }}>·</span>}
              <span style={{ fontSize: 11, fontFamily: "monospace", padding: "3px 8px", borderRadius: 6, background: chipBg, border: `0.5px solid ${chipBorder}`, color: T.text2 }}>
                {noInfo(a.escConnection)}
              </span>
            </>
          )}
          {a.escConsole && (
            <>
              <span style={{ color: T.text4, opacity: 0.5, fontSize: 12 }}>·</span>
              <span style={{ fontSize: 11, fontFamily: "monospace", padding: "3px 8px", borderRadius: 6, background: chipBg, border: `0.5px solid ${chipBorder}`, color: T.text3 }}>
                {noInfo(a.escConsole)}
              </span>
            </>
          )}
        </div>
      )}

    </div>
  );
}

/* ---------- horarios generales (parrilla) ---------- */
function GeneralScheduleView({ fest }) {
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
    return <div style={{ textAlign: "center", color: T.text4, fontSize: 13, marginTop: 40 }}>Sin días configurados</div>;
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
            const t = getTime(a);
            if (!t) continue;
            if (!timeMap[t]) timeMap[t] = {};
            timeMap[t][stage.id] = a;
            const e = getEndTime(a);
            if (e && !endTimeMap[t]) endTimeMap[t] = e;
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

/* ---------- styles ---------- */
function makeS(T) {
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

function Style({ dark }) {
  useEffect(() => {
    let meta = document.querySelector('meta[name="viewport"]');
    if (!meta) { meta = document.createElement("meta"); meta.name = "viewport"; document.head.appendChild(meta); }
    meta.content = "width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no";
  }, []);
  useEffect(() => {
    document.body.style.background = dark ? DK.bg : LT.bg;
  }, [dark]);
  return <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:wght@300;400;500;600&family=DM+Mono:wght@400;500&display=swap');
    * { box-sizing:border-box; margin:0; padding:0; -webkit-tap-highlight-color:transparent; touch-action:manipulation; }
    ::-webkit-scrollbar { width:4px; height:4px; }
    ::-webkit-scrollbar-thumb { background:#C94A2A; border-radius:2px; }
    input::placeholder, textarea::placeholder { color:#B0A090; }
    input, textarea, select { font-size:16px !important; }
    button { font-family:'DM Mono',monospace; }

    /* ---------- login screen ---------- */
    @keyframes lg-fade { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:translateY(0); } }
    @keyframes lg-glow { 0%,100% { opacity:0.45; } 50% { opacity:0.75; } }
    @keyframes lg-eq { 0%,100% { transform:scaleY(0.35); } 50% { transform:scaleY(1); } }
    .lg-card { animation:lg-fade .6s cubic-bezier(.2,.7,.3,1) both; }
    .lg-glow { animation:lg-glow 6s ease-in-out infinite; }
    .lg-mark span { display:block; width:4px; border-radius:2px; transform-origin:center; animation:lg-eq 1.2s ease-in-out infinite; }
    .lg-mark span:nth-child(1){ height:14px; background:#C94A2A; animation-delay:0s; }
    .lg-mark span:nth-child(2){ height:22px; background:#D4A843; animation-delay:.15s; }
    .lg-mark span:nth-child(3){ height:30px; background:#F5EFE0; animation-delay:.3s; }
    .lg-mark span:nth-child(4){ height:22px; background:#D4A843; animation-delay:.45s; }
    .lg-mark span:nth-child(5){ height:14px; background:#C94A2A; animation-delay:.6s; }
    .lg-btn { transition:transform .15s ease, box-shadow .15s ease, background .15s ease; }
    .lg-btn:not(:disabled):hover { transform:translateY(-2px); box-shadow:0 10px 28px rgba(0,0,0,.5); }
    .lg-btn:not(:disabled):active { transform:translateY(0); box-shadow:0 4px 14px rgba(0,0,0,.4); }
  `}</style>;
}
