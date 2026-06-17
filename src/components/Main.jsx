import { useState, useEffect, useRef } from "react";
import { supabase } from "../supabase";
import { ThemeCtx, LT, DK, makeS } from "../lib/theme";
import { uid, getUserRole } from "../lib/utils";
import { SEED } from "../lib/constants";
import { saveOfflineCache, loadOfflineCache } from "../lib/offline";
import {
  loadFests, saveFest, deleteFest, updateFestRow, updateFestMembers,
  joinFestAsMember, pickFestId, mergeSharedFromFests, mergeNoteArrays,
  saveFestShared,
} from "../lib/api";
import Style from "./Style";
import Splash from "./Splash";
import Home from "./Home";
import Builder from "./Builder";
import StageView from "./StageView";
import FestView from "./FestView";
import MonView from "./MonView";
import EscenarioView from "./EscenarioView";

function Main({ session, offlineBannerOffset }) {
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
  const conflictTimerRef = useRef(null);
  const [screen, setScreen] = useState("home");
  const [lastSync, setLastSync] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem("theme") === "dark");
  const toggleDark = () => setDarkMode(d => { const n = !d; localStorage.setItem("theme", n ? "dark" : "light"); return n; });

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
      const joinId = searchParams.get("join") || hashParams.get("join");
      const joinRole = searchParams.get("role") || hashParams.get("role") || "editor";
      const legacyFest = searchParams.get("fest") || hashParams.get("fest");

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
        for (const fest of SEED) await saveFest(userId, fest);
        f = await loadFests(userId);
      }

      if (joinId) {
        const ok = await joinFestAsMember(joinId);
        if (ok) {
          f = await loadFests(userId);
          const joined = f.find(x => x.id === joinId);
          if (joined && joined.user_id !== userId) {
            const role = joinRole === "viewer" ? "viewer" : joinRole === "owner" ? "owner" : "editor";
            const updatedRoles = { ...joined.roles, [userId]: role };
            const updatedInfo = { ...joined.memberInfo, [userId]: { email: userEmail } };
            await updateFestRow({ ...joined, roles: updatedRoles, memberInfo: updatedInfo });
            f = f.map(x => x.id === joinId ? { ...x, roles: updatedRoles, memberInfo: updatedInfo } : x);
          }
        } else console.error("No se pudo unir al festival compartido");
        window.history.replaceState({}, "", window.location.pathname);
      } else if (legacyFest) {
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
    setFests(festsRef.current.map(f => f.id === updated.id ? updated : f));
    if (!navigator.onLine) {
      dirtyFestIds.current.add(updated.id);
      persistOffline();
      return;
    }
    try {
      await saveFest(userId, updated);
    } catch (err) {
      console.warn("updateFest falló, se reintentará al reconectar:", err?.message || err);
      dirtyFestIds.current.add(updated.id);
      persistOffline();
    }
  }

  async function manageMembers(updated) {
    setFests(festsRef.current.map(f => f.id === updated.id ? updated : f));
    try {
      await updateFestMembers(updated);
    } catch (err) {
      console.warn("manageMembers falló:", err?.message || err);
    }
  }

  async function updateNotes(n) {
    const changedKeys = Object.keys(n).filter(k => JSON.stringify(n[k]) !== JSON.stringify(notesRef.current[k]));
    setNotes(n);
    if (!navigator.onLine) { sharedDirtyRef.current = true; return; }
    try {
      const fids = new Set([...Object.keys(n), ...Object.keys(notes)].map(pickFestId));
      for (const fid of fids) if (fid) {
        const fChangedKeys = changedKeys.filter(k => pickFestId(k) === fid);
        await saveFestShared(fid, n, checks, slots, fChangedKeys, []);
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
            onSaveAsTemplate={saveAsTemplate}
            onCreateFromTemplate={createFromTemplate}
            onLogout={logout}
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
            onOpenStage={(sid) => { setStageId(sid); setDayIdx(0); setScreen("view"); }}
            onOpenMon={(sid, mid) => { setStageId(sid); setMonId(mid); setDayIdx(0); setScreen("mon"); }}
            onOpenEscenario={(sid) => { setStageId(sid); setScreen("escenario"); }}
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
        {conflictToast && (
          <div style={{ position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)", background: darkMode ? "#2A2420" : "#1A1410", color: "#D4A843", fontFamily: "'DM Mono',monospace", fontSize: 12, padding: "10px 18px", borderRadius: 20, boxShadow: "0 4px 20px rgba(0,0,0,0.4)", zIndex: 9999, pointerEvents: "none", animation: "lg-fade .25s ease both", letterSpacing: "0.05em" }}>
            ↕ Cambios recibidos de otro técnico
          </div>
        )}
      </div>
    </ThemeCtx.Provider>
  );
}

export default Main;
