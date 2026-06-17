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
  return { _stages: fest.stages || [], _log: fest.log || [], _roles: fest.roles || {}, _memberInfo: fest.memberInfo || {}, _isTemplate: fest.isTemplate || false };
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

// Actualiza también la columna members (para expulsar miembros). Solo lo usa el owner.
export async function updateFestMembers(fest) {
  const { error } = await supabase
    .from("festivals")
    .update({ name: fest.name, days: festToDB(fest), members: fest.members || [] })
    .eq("id", fest.id);
  if (error) { console.error("updateFestMembers error:", error); throw error; }
}

export async function joinFestAsMember(festId) {
  // SECURITY DEFINER function bypasea RLS para que el usuario se pueda añadir
  // aunque aún no esté en members
  const { data, error } = await supabase.rpc("join_festival", { festival_id: festId });
  if (error) console.error("join_festival error:", error);
  return !error;
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

export async function saveFestShared(festId, localNotes, localChecks, localSlots, changedNoteKeys = [], changedSlotKeys = []) {
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
