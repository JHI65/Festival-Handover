import { supabase } from "../supabase";
import { normalizeFest } from "./utils";

export async function loadFests(userId) {
  const { data, error } = await supabase
    .from("festivals")
    .select("*")
    .or(`user_id.eq.${userId},members.cs.{${userId}}`)
    .order("created_at", { ascending: true });
  // Si hay error de red, lanzar para que los callers NO sobreescriban el estado local
  if (error) throw error;
  return (data || []).map(normalizeFest);
}

export function festToDB(fest) {
  // Serializa stages en el campo days del schema existente
  return { _stages: fest.stages || [], _log: fest.log || [], _undo: fest.undo || [], _roles: fest.roles || {}, _memberInfo: fest.memberInfo || {}, _isTemplate: fest.isTemplate || false };
}

export async function insertFest(userId, fest) {
  const { error } = await supabase.from("festivals").insert({
    id: fest.id,
    user_id: userId,
    name: fest.name,
    days: festToDB(fest),
    members: [],
  });
  if (error) { console.error("insertFest error:", error); throw error; }
}

export async function updateFestRow(fest) {
  const { error } = await supabase
    .from("festivals")
    .update({ name: fest.name, days: festToDB(fest) })
    .eq("id", fest.id);
  if (error) { console.error("updateFestRow error:", error); throw error; }
}

export async function saveFest(userId, fest) {
  // Si la fila ya existe en DB (tiene user_id), UPDATE; si no, INSERT.
  if (fest.user_id) {
    await updateFestRow(fest);
  } else {
    await insertFest(userId, fest);
  }
}

export async function deleteFest(festId) {
  await supabase.from("festivals").delete().eq("id", festId);
}

// GDPR: borra la cuenta del usuario y todos sus datos vía Edge Function
// (requiere service role para eliminar la cuenta de auth). Tras el borrado,
// cierra la sesión local.
export async function deleteAccount() {
  const { data, error } = await supabase.functions.invoke("delete-account", { body: {} });
  if (error) {
    // functions.invoke envuelve los errores HTTP; intentar extraer el mensaje real
    let msg = error.message;
    try { const ctx = await error.context?.json?.(); if (ctx?.error) msg = ctx.error; } catch { /* noop */ }
    throw new Error(msg || "No se pudo borrar la cuenta");
  }
  await supabase.auth.signOut();
  return data;
}

// Actualiza también la columna members (para expulsar miembros). Solo lo usa el owner.
export async function updateFestMembers(fest) {
  const { error } = await supabase
    .from("festivals")
    .update({ name: fest.name, days: festToDB(fest), members: fest.members || [] })
    .eq("id", fest.id);
  if (error) { console.error("updateFestMembers error:", error); throw error; }
}

// ── Invitaciones (sustituyen a la auto-unión por id) ──
// El owner genera un token con rol fijo y caducidad; el invitado lo canjea.

// Crea una invitación (solo el owner puede). Devuelve el token o null.
export async function createInvite(festId, role = "editor", ttlDays = 14, maxUses = null) {
  const { data, error } = await supabase.rpc("create_festival_invite", {
    fid: festId, invite_role: role, ttl_days: ttlDays, uses_limit: maxUses,
  });
  if (error) { console.error("create_festival_invite error:", error); return null; }
  return data; // token
}

// Canjea una invitación: une al usuario con el rol del token. Devuelve { festival_id, role } o null.
export async function redeemInvite(token) {
  const { data, error } = await supabase.rpc("redeem_festival_invite", { invite_token: token });
  if (error) { console.error("redeem_festival_invite error:", error); return null; }
  return data;
}

// Reconcilia la tabla festival_members (fuente de verdad de permisos) a partir
// del estado de miembros/roles que gestiona el owner en la UI. Solo el owner
// pasa la RLS de festival_members, así que para no-owners es un no-op silencioso.
export async function syncMemberRoles(fest) {
  const members = fest.members || [];
  const roles = fest.roles || {};
  const info = fest.memberInfo || {};
  if (members.length) {
    const rows = members.map(uid => ({
      festival_id: fest.id, user_id: uid,
      role: roles[uid] || "editor", email: info[uid]?.email || null,
    }));
    const { error } = await supabase.from("festival_members")
      .upsert(rows, { onConflict: "festival_id,user_id" });
    if (error) { console.warn("syncMemberRoles upsert:", error.message); return; }
  }
  // Borrar de festival_members los que ya no están en members[]
  let q = supabase.from("festival_members").delete().eq("festival_id", fest.id);
  if (members.length) q = q.not("user_id", "in", `(${members.join(",")})`);
  const { error: delErr } = await q;
  if (delErr) console.warn("syncMemberRoles delete:", delErr.message);
}

// Helpers para notes/checks/slots compartidos en la fila del festival
// Las keys tienen formato `${festId}__${dayId}__${artId}__...`
export function pickFestId(key) {
  return (key || "").split("__")[0];
}

export function filterByFest(obj, festId) {
  const out = {};
  for (const k in obj) if (pickFestId(k) === festId) out[k] = obj[k];
  return out;
}

export function mergeSharedFromFests(fests) {
  const notes = {}, checks = {}, slots = {};
  for (const f of fests || []) {
    Object.assign(notes, f.notes || {});
    Object.assign(checks, f.checks || {});
    Object.assign(slots, f.slots || {});
  }
  return { notes, checks, slots };
}

// Union de arrays de notas por ts — nunca se pierden notas de ningún técnico
export function mergeNoteArrays(remote, local) {
  const remTs = new Set((remote || []).map(n => n.ts));
  const combined = [...(remote || []), ...(local || []).filter(n => !remTs.has(n.ts))];
  combined.sort((a, b) => a.ts - b.ts);
  return combined;
}

// Merge de slots por id — los locales ganan, los remotos no presentes se conservan
export function mergeSlotArrays(remote, local) {
  const locIds = new Set((local || []).map(s => s.id));
  return [...(local || []), ...(remote || []).filter(s => !locIds.has(s.id))];
}

// Reconcilia un array de notas al guardar: newLocal (lo que el usuario acaba
// de guardar: puede tener notas añadidas, editadas o borradas respecto a
// oldLocal) siempre gana para las notas que ya conocía; las notas remotas
// con ts desconocido para oldLocal son adiciones de otro técnico y se
// conservan. Así los borrados y ediciones propios ya no se deshacen al
// unir con el estado remoto.
export function reconcileNoteArray(remote, oldLocal, newLocal) {
  const knownTs = new Set((oldLocal || []).map(n => n.ts));
  const newLocalTs = new Set((newLocal || []).map(n => n.ts));
  const extra = (remote || []).filter(n => !knownTs.has(n.ts) && !newLocalTs.has(n.ts));
  return [...(newLocal || []), ...extra].sort((a, b) => a.ts - b.ts);
}

export async function saveFestShared(festId, localNotes, localChecks, localSlots, changedNoteKeys = [], changedSlotKeys = [], oldLocalNotes = {}) {
  const { data, error: selErr } = await supabase
    .from("festivals")
    .select("notes, checks, slots")
    .eq("id", festId)
    .maybeSingle();
  if (selErr) throw selErr;

  const rN = data?.notes || {};
  const rC = data?.checks || {};
  const rS = data?.slots || {};

  const lN = filterByFest(localNotes, festId);
  const lC = filterByFest(localChecks, festId);
  const lS = filterByFest(localSlots, festId);

  // Notes: para keys que el usuario acaba de cambiar, reconciliar respetando
  // sus borrados/ediciones y conservando adiciones remotas de otros técnicos
  const mergedN = { ...rN, ...lN };
  for (const key of changedNoteKeys) {
    if (lN[key] !== undefined) mergedN[key] = reconcileNoteArray(rN[key], oldLocalNotes[key], lN[key]);
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
  if (error) { console.error("saveFestShared error:", error); throw error; }
}

export async function loadUserData(userId) {
  const { data } = await supabase
    .from("user_data")
    .select("notes, checks, slots")
    .eq("user_id", userId)
    .maybeSingle();
  return data || { notes: {}, checks: {}, slots: {} };
}

export async function saveUserData(userId, notes, checks, slots) {
  await supabase.from("user_data").upsert({
    user_id: userId,
    notes,
    checks,
    slots,
  });
}
