import { useState, useEffect, useRef } from "react";
import { supabase } from "../supabase";
import { ThemeCtx, LT, DK, makeS } from "../lib/theme";
import { uid, getUserRole, UNDO_LIMIT, festPositions, isPositionValid } from "../lib/utils";
import { useLang } from "../lib/i18n";
import { SEED } from "../lib/constants";
import { saveOfflineCache, loadOfflineCache } from "../lib/offline";
import {
  loadFests, saveFest, deleteFest, updateFestRow, updateFestMembers,
  redeemInvite, syncMemberRoles, pickFestId, mergeSharedFromFests, mergeNoteArrays,
  saveFestShared,
} from "../lib/api";
import { isPushSupported } from "../lib/push";
import Style from "./Style";
import Splash from "./Splash";
import Home from "./Home";
import Builder from "./Builder";
import StageView from "./StageView";
import FestView from "./FestView";
import MonView from "./MonView";
import EscenarioView from "./EscenarioView";
import PositionSelectModal from "./PositionSelectModal";
import NotificationSettings from "./NotificationSettings";

function Main({ session, offlineBannerOffset, onOpenLegal }) {
  const { t } = useLang();
  const userId = session.user.id;
  const userEmail = session.user.email;
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
  const sharedDirtyRef = useRef(false);
  const [conflictToast, setConflictToast] = useState(false);
  const [inviteToast, setInviteToast] = useState(null);
  const conflictTimerRef = useRef(null);
  const [screen, setScreen] = useState("home");
  const [positionPromptFestId, setPositionPromptFestId] = useState(null);
  const [lastSync, setLastSync] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem("theme") === "dark");
  const toggleDark = () => setDarkMode(d => { const n = !d; localStorage.setItem("theme", n ? "dark" : "light"); return n; });
  const [showNotifPrompt, setShowNotifPrompt] = useState(false);

  useEffect(() => {
    const key = `pushPromptShown:${userId}`;
    if (localStorage.getItem(key)) return;
    localStorage.setItem(key, "1");
    if (isPushSupported() && typeof Notification !== "undefined" && Notification.permission === "default") {
      setShowNotifPrompt(true);
    }
  }, [userId]);

  function persistOffline() {
    saveOfflineCache(userId, festsRef.current || [], notesRef.current, checksRef.current, slotsRef.current, dirtyFestIds.current, sharedDirtyRef.current);
  }
  function setNotes(n) { notesRef.current = n; setNotesState(n); persistOffline(); }
  function setChecks(c) { checksRef.current = c; setChecksState(c); persistOffline(); }
  function setSlots(s) { slotsRef.current = s; setSlotsState(s); persistOffline(); }
  function setFests(f) { festsRef.current = f; setFestsState(f); persistOffline(); }

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
      // Nuevo flujo seguro: invitación con token (rol fijo, caducidad, revocable).
      const inviteToken = searchParams.get("invite") || hashParams.get("invite");
      // Enlaces antiguos (?join=<id> / ?fest=<base64>) eran auto-unión insegura por
      // id; ya no se honran. Quien los abra simplemente carga su sesión normal.
      const legacyJoin = searchParams.get("join") || searchParams.get("fest")
        || hashParams.get("join") || hashParams.get("fest");

      let f;
      try {
        f = await loadFests(userId);
      } catch {
        // Offline al arrancar: hidratar todo desde la caché local
        const cache = loadOfflineCache(userId);
        if (cache && Array.isArray(cache.fests)) {
          (cache.dirty || []).forEach(id => dirtyFestIds.current.add(id));
          sharedDirtyRef.current = !!cache.sharedDirty;
          setFests(cache.fests);
          setNotes(cache.notes || {});
          setChecks(cache.checks || {});
          setSlots(cache.slots || {});
          console.warn("Arranque offline: datos cargados desde caché local");
        } else {
          setLoadError("Sin conexión y sin datos guardados localmente");
        }
        return;
      }

      // Reemplazar seed antiguo si existe
      const oldSeedId = "cooltural25";
      if (f.some(x => x.id === oldSeedId)) {
        await deleteFest(oldSeedId);
        f = f.filter(x => x.id !== oldSeedId);
      }

      if (f.length === 0) {
        // id único por usuario: el SEED trae un id fijo ("ejemplo_fest") y, si se
        // usara tal cual, todos los usuarios colisionarían en el mismo id.
        for (const fest of SEED) await saveFest(userId, { ...fest, id: uid() });
        f = await loadFests(userId);
      }

      if (inviteToken) {
        const res = await redeemInvite(inviteToken);
        if (res?.festival_id) {
          f = await loadFests(userId);   // la RPC ya espejó members/roles en la fila
        } else {
          setInviteToast(t("La invitación no es válida, ha caducado o ha sido revocada. Pide un enlace nuevo."));
          setTimeout(() => setInviteToast(null), 5000);
        }
        window.history.replaceState({}, "", window.location.pathname);
      } else if (legacyJoin) {
        // Enlace antiguo inseguro: lo ignoramos y limpiamos la URL.
        console.warn("Enlace de invitación antiguo ignorado; pide una invitación nueva.");
        window.history.replaceState({}, "", window.location.pathname);
      }

      const sd = mergeSharedFromFests(f);

      // Reaplicar cambios offline pendientes que no llegaron al servidor
      const cache = loadOfflineCache(userId);
      if (cache && Array.isArray(cache.dirty) && cache.dirty.length) {
        for (const id of cache.dirty) {
          const local = (cache.fests || []).find(x => x.id === id);
          if (!local) continue;
          dirtyFestIds.current.add(id);
          f = f.some(x => x.id === id) ? f.map(x => x.id === id ? local : x) : [...f, local];
        }
      }

      setFests(f);

      // Reaplicar datos compartidos pendientes (notes/checks/slots editados offline)
      if (cache && cache.sharedDirty) {
        sharedDirtyRef.current = true;
        const mNotes = { ...sd.notes };
        for (const k in (cache.notes || {})) {
          mNotes[k] = Array.isArray(sd.notes[k]) && Array.isArray(cache.notes[k])
            ? mergeNoteArrays(sd.notes[k], cache.notes[k]) : cache.notes[k];
        }
        setNotes(mNotes);
        setChecks({ ...sd.checks, ...(cache.checks || {}) });
        setSlots({ ...sd.slots, ...(cache.slots || {}) });
      } else {
        setNotes(sd.notes);
        setChecks(sd.checks);
        setSlots(sd.slots);
      }
      setLastSync(new Date());

      if ((dirtyFestIds.current.size || sharedDirtyRef.current) && navigator.onLine) syncOfflineChanges();

      // Backfill: registrar mi email en los festivales donde soy miembro (no owner)
      if (navigator.onLine && userEmail) {
        for (const x of f) {
          if (x.user_id !== userId && (x.members || []).includes(userId) && x.memberInfo?.[userId]?.email !== userEmail) {
            const updatedInfo = { ...x.memberInfo, [userId]: { email: userEmail } };
            updateFestRow({ ...x, memberInfo: updatedInfo }).catch(() => {});
          }
        }
      }

      // Backfill para el owner: consultar emails de miembros sin identificar via RPC
      if (navigator.onLine) {
        const missingIds = new Set();
        for (const x of f) {
          if (x.user_id === userId) {
            for (const mid of (x.members || [])) {
              if (mid !== userId && !x.memberInfo?.[mid]?.email) missingIds.add(mid);
            }
          }
        }
        if (missingIds.size) {
          supabase.rpc('get_member_emails', { user_ids: [...missingIds] }).then(({ data: emailData }) => {
            if (!emailData?.length) return;
            const emailMap = Object.fromEntries(emailData.map(e => [e.id, e.email]));
            let updatedF = festsRef.current;
            let changed = false;
            updatedF = updatedF.map(x => {
              if (x.user_id !== userId) return x;
              const needsUpdate = (x.members || []).some(mid => mid !== userId && emailMap[mid] && !x.memberInfo?.[mid]?.email);
              if (!needsUpdate) return x;
              const newInfo = { ...x.memberInfo };
              for (const mid of (x.members || [])) {
                if (emailMap[mid] && !newInfo[mid]?.email) newInfo[mid] = { email: emailMap[mid] };
              }
              updateFestRow({ ...x, memberInfo: newInfo }).catch(() => {});
              changed = true;
              return { ...x, memberInfo: newInfo };
            });
            if (changed) setFests(updatedF);
          }).catch(() => { /* RPC no disponible o sin red */ });
        }
      }
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
          let f;
          try {
            f = await loadFests(userId);
          } catch (e) {
            console.warn("Realtime: recarga falló, conservando estado local", e);
            return;
          }
          const sd = mergeSharedFromFests(f);
          const remoteIds = new Set(f.map(r => r.id));
          const merged = f.map(remote => {
            if (dirtyFestIds.current.has(remote.id)) {
              return festsRef.current.find(loc => loc.id === remote.id) || remote;
            }
            return remote;
          });
          for (const loc of festsRef.current) {
            if (!remoteIds.has(loc.id) && dirtyFestIds.current.has(loc.id)) merged.push(loc);
          }
          setFests(merged);

          const prevNotes = notesRef.current;
          const mergedNotes = { ...sd.notes };
          for (const key in prevNotes) {
            if (Array.isArray(prevNotes[key]) && Array.isArray(sd.notes[key])) {
              mergedNotes[key] = mergeNoteArrays(sd.notes[key], prevNotes[key]);
            }
          }

          const mergedChecks = sharedDirtyRef.current ? { ...sd.checks, ...checksRef.current } : sd.checks;
          const mergedSlots = sharedDirtyRef.current ? { ...sd.slots, ...slotsRef.current } : sd.slots;

          const notesChanged = JSON.stringify(mergedNotes) !== JSON.stringify(prevNotes);
          const checksChanged = JSON.stringify(mergedChecks) !== JSON.stringify(checksRef.current);
          const slotsChanged = JSON.stringify(mergedSlots) !== JSON.stringify(slotsRef.current);

          if (notesChanged) setNotes(mergedNotes);
          if (checksChanged) setChecks(mergedChecks);
          if (slotsChanged) setSlots(mergedSlots);
          if (notesChanged || checksChanged || slotsChanged) showConflictToast();
          setLastSync(new Date());
        }
      )
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [userId]);

  const syncingRef = useRef(false);
  async function syncOfflineChanges() {
    if (syncingRef.current) return;
    if (!dirtyFestIds.current.size && !sharedDirtyRef.current) return;
    syncingRef.current = true;

    const doSync = async () => {
      for (const fid of [...dirtyFestIds.current]) {
        const fest = festsRef.current.find(f => f.id === fid);
        if (fest) {
          await saveFest(userId, fest);
          if (!fest.user_id) {
            setFests(festsRef.current.map(f => f.id === fid ? { ...f, user_id: userId, members: f.members || [] } : f));
          }
          dirtyFestIds.current.delete(fid);
          persistOffline();
        }
      }
      const ids = new Set();
      [...Object.keys(notesRef.current), ...Object.keys(checksRef.current), ...Object.keys(slotsRef.current)]
        .forEach(k => { const fid = pickFestId(k); if (fid) ids.add(fid); });
      for (const fid of ids) {
        await saveFestShared(fid, notesRef.current, checksRef.current, slotsRef.current);
      }
    };

    let delay = 1200;
    for (let attempt = 0; attempt < 6; attempt++) {
      await new Promise(r => setTimeout(r, delay));
      if (!navigator.onLine) break;
      try {
        await doSync();
        sharedDirtyRef.current = false;
        persistOffline();
        setLastSync(new Date());
        console.log("✓ Cambios offline sincronizados");
        syncingRef.current = false;
        return;
      } catch (err) {
        console.warn(`Sync intento ${attempt + 1} falló, reintentando...`, err?.message || err);
        delay = Math.min(Math.round(delay * 1.6), 8000);
      }
    }
    console.error("No se pudieron sincronizar los cambios offline tras varios intentos");
    syncingRef.current = false;
  }

  useEffect(() => {
    const handleOnline = () => { syncOfflineChanges(); };
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

  function cloneStructure(sourceFest, overrides = {}) {
    return {
      id: uid(),
      stages: (sourceFest.stages || []).map(s => ({
        ...s,
        id: uid(),
        days: (s.days || []).map(d => ({
          ...d,
          id: uid(),
          artists: (d.artists || []).map(a => ({ ...a, id: uid() })),
        })),
      })),
      log: [],
      roles: {},
      memberInfo: {},
      isTemplate: false,
      ...overrides,
    };
  }

  async function saveAsTemplate(sourceFest, templateName) {
    const tpl = cloneStructure(sourceFest, { name: templateName, isTemplate: true });
    await addFest(tpl);
  }

  async function createFromTemplate(template, festName) {
    const fest = cloneStructure(template, { name: festName, isTemplate: false });
    await addFest(fest);
  }

  async function addFest(fest) {
    if (!navigator.onLine) {
      setFests([...festsRef.current, fest]);
      dirtyFestIds.current.add(fest.id);
      persistOffline();
      return;
    }
    try {
      await saveFest(userId, fest);
      setFests([...festsRef.current, { ...fest, user_id: userId, members: [] }]);
    } catch (err) {
      console.warn("addFest falló, se insertará al reconectar:", err?.message || err);
      setFests([...festsRef.current, fest]);
      dirtyFestIds.current.add(fest.id);
      persistOffline();
    }
  }

  async function removeFest(id) {
    setFests(festsRef.current.filter(f => f.id !== id));
    try {
      await deleteFest(id);
    } catch (err) {
      console.warn("removeFest: no se pudo borrar en el servidor (sin red):", err?.message || err);
    }
  }

  async function updateFest(updated) {
    // Rollback: si este cambio añadió una entrada al log (y no es un UNDO),
    // guardamos una instantánea de los stages PREVIOS en la pila de deshacer (máx UNDO_LIMIT).
    const prev = festsRef.current.find(f => f.id === updated.id);
    let next = updated;
    if (prev) {
      const prevLogLen = prev.log?.length || 0;
      const newLogLen = updated.log?.length || 0;
      if (newLogLen > prevLogLen) {
        const entry = updated.log[newLogLen - 1];
        if (entry.action !== "UNDO") {
          const snapshot = { ts: entry.ts, action: entry.action, detail: entry.detail, user: entry.user, stages: prev.stages };
          next = { ...updated, undo: [...(updated.undo || []).slice(-(UNDO_LIMIT - 1)), snapshot] };
        }
      }
    }
    setFests(festsRef.current.map(f => f.id === next.id ? next : f));
    if (!navigator.onLine) {
      dirtyFestIds.current.add(next.id);
      persistOffline();
      return;
    }
    try {
      await saveFest(userId, next);
    } catch (err) {
      console.warn("updateFest falló, se reintentará al reconectar:", err?.message || err);
      dirtyFestIds.current.add(next.id);
      persistOffline();
    }
  }

  // Navega directamente a una posición (FOH / mon / escenario) sin pasar por "stages".
  function navigateToPosition(pos) {
    setStageId(pos.stageId);
    setDayIdx(0);
    if (pos.kind === "foh") setScreen("view");
    else if (pos.kind === "mon") { setMonId(pos.monId); setScreen("mon"); }
    else if (pos.kind === "escenario") setScreen("escenario");
  }

  // Guarda la posición elegida por el usuario para este festival y navega a ella.
  // Se llama tanto desde el modal de bienvenida como al pinchar una posición
  // manualmente en StageView, así un cambio de posición se recuerda para la próxima vez.
  function choosePosition(fest, pos) {
    const updatedInfo = { ...fest.memberInfo, [userId]: { ...fest.memberInfo?.[userId], assignedPosition: pos } };
    updateFest({ ...fest, memberInfo: updatedInfo });
    navigateToPosition(pos);
    setPositionPromptFestId(null);
  }

  function openFest(id) {
    setFestId(id);
    const f = festsRef.current.find(x => x.id === id);
    const assigned = f?.memberInfo?.[userId]?.assignedPosition;
    if (assigned && isPositionValid(f, assigned)) {
      navigateToPosition(assigned);
      return;
    }
    setScreen("stages");
    if (festPositions(f).length > 0) setPositionPromptFestId(id);
  }

  async function manageMembers(updated) {
    setFests(festsRef.current.map(f => f.id === updated.id ? updated : f));
    try {
      await updateFestMembers(updated);       // espejo (members[]/_roles/_memberInfo)
      await syncMemberRoles(updated);          // fuente de verdad (festival_members)
    } catch (err) {
      console.warn("manageMembers falló:", err?.message || err);
    }
  }

  async function updateNotes(n) {
    const oldNotes = notesRef.current;
    const changedKeys = Object.keys(n).filter(k => JSON.stringify(n[k]) !== JSON.stringify(oldNotes[k]));
    setNotes(n);
    if (!navigator.onLine) { sharedDirtyRef.current = true; return; }
    try {
      const fids = new Set([...Object.keys(n), ...Object.keys(notes)].map(pickFestId));
      for (const fid of fids) if (fid) {
        const fChangedKeys = changedKeys.filter(k => pickFestId(k) === fid);
        await saveFestShared(fid, n, checks, slots, fChangedKeys, [], oldNotes);
      }
    } catch (err) {
      console.warn("updateNotes falló, se reintentará al reconectar:", err?.message || err);
      sharedDirtyRef.current = true;
    }
  }

  async function toggleCheck(ckey) {
    const next = { ...checks, [ckey]: !checks[ckey] };
    setChecks(next);
    if (!navigator.onLine) { sharedDirtyRef.current = true; return; }
    try {
      const fid = pickFestId(ckey);
      if (fid) await saveFestShared(fid, notes, next, slots, [], []);
    } catch (err) {
      console.warn("toggleCheck falló, se reintentará al reconectar:", err?.message || err);
      sharedDirtyRef.current = true;
    }
  }

  async function updateSlots(sl) {
    const changedKeys = Object.keys(sl).filter(k => JSON.stringify(sl[k]) !== JSON.stringify(slotsRef.current[k]));
    setSlots(sl);
    if (!navigator.onLine) { sharedDirtyRef.current = true; return; }
    try {
      const fids = new Set([...Object.keys(sl), ...Object.keys(slots)].map(pickFestId));
      for (const fid of fids) if (fid) {
        const fChangedKeys = changedKeys.filter(k => pickFestId(k) === fid);
        await saveFestShared(fid, notes, checks, sl, [], fChangedKeys);
      }
    } catch (err) {
      console.warn("updateSlots falló, se reintentará al reconectar:", err?.message || err);
      sharedDirtyRef.current = true;
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
        <strong>{t("Error al conectar con la base de datos")}</strong><br /><br />
        {loadError}<br /><br />
        <span style={{ color: "#B0A090", fontSize: 11 }}>
          {t("Asegúrate de haber ejecutado el SQL en Supabase y de tener las tablas")} <code>festivals</code> {t("y")} <code>user_data</code> {t("creadas.")}
        </span>
      </div>
      <button onClick={() => supabase.auth.signOut()} style={{ marginTop: 8, background: "#F5EFE0", border: "none", borderRadius: 4, padding: "10px 20px", cursor: "pointer", fontSize: 13 }}>
        {t("Cerrar sesión")}
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
      <div style={{ ...S.app, paddingTop: `calc(env(safe-area-inset-top, 0px) + ${offlineBannerOffset ? 33 : 0}px)` }}>
        {screen === "home" && (
          <Home
            fests={fests}
            user={session.user}
            userId={userId}
            onOpen={openFest}
            onNew={() => setScreen("builder")}
            onDelete={removeFest}
            onEdit={updateFest}
            onSaveAsTemplate={saveAsTemplate}
            onCreateFromTemplate={createFromTemplate}
            onLogout={logout}
            onOpenLegal={onOpenLegal}
          />
        )}
        {screen === "stages" && fest && (
          <StageView
            fest={fest}
            userEmail={session.user.email}
            userId={userId}
            userRole={getUserRole(fest, userId)}
            onBack={() => setScreen("home")}
            onEditFest={updateFest}
            onManageMembers={manageMembers}
            onOpenStage={(sid) => choosePosition(fest, { kind: "foh", stageId: sid })}
            onOpenMon={(sid, mid) => choosePosition(fest, { kind: "mon", stageId: sid, monId: mid })}
            onOpenEscenario={(sid) => choosePosition(fest, { kind: "escenario", stageId: sid })}
          />
        )}
        {screen === "builder" && (
          <Builder
            onCancel={() => setScreen("home")}
            onSave={async (obj) => { await addFest(obj); setScreen("home"); }}
            onSaveAsTemplate={async (obj) => { await saveAsTemplate(obj, obj.name); setScreen("home"); }}
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
        {positionPromptFestId && positionPromptFestId === festId && fest && (
          <PositionSelectModal
            fest={fest}
            onSelect={(pos) => choosePosition(fest, pos)}
            onClose={() => setPositionPromptFestId(null)}
          />
        )}
        {showNotifPrompt && <NotificationSettings userId={userId} onClose={() => setShowNotifPrompt(false)} />}
        {conflictToast && (
          <div style={{ position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)", background: darkMode ? "#2A2420" : "#1A1410", color: "#D4A843", fontFamily: "'DM Mono',monospace", fontSize: 12, padding: "10px 18px", borderRadius: 20, boxShadow: "0 4px 20px rgba(0,0,0,0.4)", zIndex: 9999, pointerEvents: "none", animation: "lg-fade .25s ease both", letterSpacing: "0.05em" }}>
            {t("↕ Cambios recibidos de otro técnico")}
          </div>
        )}
        {inviteToast && (
          <div onClick={() => setInviteToast(null)} style={{ position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)", maxWidth: 340, background: "#7C2D12", color: "#FFE4D6", fontFamily: "'DM Mono',monospace", fontSize: 12, padding: "12px 18px", borderRadius: 14, boxShadow: "0 4px 20px rgba(0,0,0,0.4)", zIndex: 9999, animation: "lg-fade .25s ease both", letterSpacing: "0.03em", textAlign: "center" }}>
            {inviteToast}
          </div>
        )}
      </div>
    </ThemeCtx.Provider>
  );
}

export default Main;
