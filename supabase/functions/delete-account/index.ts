// GDPR: borra la cuenta del usuario que llama y TODOS sus datos.
// El usuario se identifica por su JWT (Authorization header que añade
// supabase.functions.invoke automáticamente). El borrado de la cuenta de
// auth requiere el service role, por eso vive en una Edge Function.
//
// Deploy: supabase functions deploy delete-account
//   (con verificación de JWT activada — la opción por defecto — para que solo
//    un usuario autenticado pueda borrarse a sí mismo)
// Secrets: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY
//   (los tres están disponibles por defecto en el runtime de las Edge Functions)
//
// Qué borra:
//   1. Festivales de los que el usuario es propietario (user_id)
//   2. Su pertenencia (members[] / roles / memberInfo) en festivales de otros
//   3. Su fila en user_data
//   4. Sus suscripciones push (push_subscriptions)
//   5. Su cuenta en auth.users

import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "missing authorization" }, 401);

  // Identificar al usuario a partir de su JWT
  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user }, error: userErr } = await userClient.auth.getUser();
  if (userErr || !user) return json({ error: "invalid session" }, 401);

  const uid = user.id;
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  try {
    // 1) Festivales propios
    const { error: ownErr } = await admin.from("festivals").delete().eq("user_id", uid);
    if (ownErr) throw ownErr;

    // 2) Quitar mi pertenencia de festivales de otros
    const { data: memberFests, error: selErr } = await admin
      .from("festivals")
      .select("id, days, members")
      .contains("members", [uid]);
    if (selErr) throw selErr;

    for (const f of memberFests || []) {
      const newMembers = (f.members || []).filter((m: string) => m !== uid);
      const days = (f.days && typeof f.days === "object" && !Array.isArray(f.days)) ? { ...f.days } : f.days;
      if (days && typeof days === "object" && !Array.isArray(days)) {
        if (days._roles && typeof days._roles === "object") {
          const roles = { ...days._roles }; delete roles[uid]; days._roles = roles;
        }
        if (days._memberInfo && typeof days._memberInfo === "object") {
          const info = { ...days._memberInfo }; delete info[uid]; days._memberInfo = info;
        }
      }
      const { error: updErr } = await admin
        .from("festivals")
        .update({ members: newMembers, days })
        .eq("id", f.id);
      if (updErr) throw updErr;
    }

    // 3) user_data
    const { error: udErr } = await admin.from("user_data").delete().eq("user_id", uid);
    if (udErr) throw udErr;

    // 4) push_subscriptions
    const { error: psErr } = await admin.from("push_subscriptions").delete().eq("user_id", uid);
    if (psErr) throw psErr;

    // 5) cuenta de auth
    const { error: authErr } = await admin.auth.admin.deleteUser(uid);
    if (authErr) throw authErr;

    return json({ ok: true });
  } catch (err) {
    console.error("delete-account error:", err);
    return json({ error: (err as Error)?.message || "delete failed" }, 500);
  }
});
