// Cron job (cada minuto vía pg_cron) que envía un push 30 min antes del
// soundcheck de cada artista, solo a los miembros asignados a ese stage.
// Deploy: supabase functions deploy send-soundcheck-reminders
// Secrets requeridos (supabase secrets set ...):
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (ya disponibles por defecto en runtime)
//   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT (mailto:tu@email.com)
//   CRON_SECRET (string aleatorio; debe coincidir con el header que manda pg_cron)

import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY")!;
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY")!;
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") || "mailto:noreply@example.com";
const CRON_SECRET = Deno.env.get("CRON_SECRET");

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

// Mismo criterio que src/lib/utils.js festTimeToMin: horas 00-05 se tratan
// como "después de medianoche" para que el orden/comparación tenga sentido.
function festTimeToMin(t?: string | null) {
  if (!t) return Infinity;
  const [h, m] = t.split(":").map(Number);
  return (h < 6 ? h + 24 : h) * 60 + (m || 0);
}

function madridNow() {
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Madrid",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(now);
  const get = (type: string) => parts.find(p => p.type === type)?.value;
  const todayStr = `${get("year")}-${get("month")}-${get("day")}`;
  const nowMin = Number(get("hour")) * 60 + Number(get("minute"));
  return { todayStr, nowMin };
}

Deno.serve(async (req) => {
  if (CRON_SECRET && req.headers.get("x-cron-secret") !== CRON_SECRET) {
    return new Response("unauthorized", { status: 401 });
  }

  const { todayStr, nowMin } = madridNow();

  const { data: festivals, error } = await supabase.from("festivals").select("*");
  if (error) {
    console.error("load festivals failed", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }

  let sent = 0;
  const dueReminders: { fest: any; stage: any; day: any; artist: any; key: string }[] = [];

  for (const fest of festivals || []) {
    const stages = fest.days?._stages || [];
    const memberInfo = fest.days?._memberInfo || {};
    for (const stage of stages) {
      for (const day of stage.days || []) {
        if (day.date !== todayStr) continue;
        for (const artist of day.artists || []) {
          if (!artist.scStart) continue;
          const reminderMin = festTimeToMin(artist.scStart) - 30;
          if (reminderMin !== nowMin) continue;
          const key = `${fest.id}__${stage.id}__${day.id}__${artist.id}`;
          dueReminders.push({ fest: { ...fest, memberInfo }, stage, day, artist, key });
        }
      }
    }
  }

  for (const { fest, stage, day, artist, key } of dueReminders) {
    // Dedupe: si ya existe la key, ya se envió en una invocación anterior.
    const { error: insertErr } = await supabase
      .from("sent_soundcheck_reminders")
      .insert({ reminder_key: key });
    if (insertErr) continue; // conflicto de PK => ya enviado, saltar

    const recipientIds = [fest.user_id, ...(fest.members || [])].filter(Boolean);
    const targetIds = recipientIds.filter((uid: string) => {
      const assigned = fest.memberInfo?.[uid]?.assignedStageId;
      return assigned === stage.id || assigned === "all";
    });
    if (!targetIds.length) continue;

    const { data: subs } = await supabase
      .from("push_subscriptions")
      .select("*")
      .in("user_id", targetIds);

    const payload = JSON.stringify({
      title: "Soundcheck en 30 min",
      body: `${artist.artist || "Artista"} · ${stage.name} · ${artist.scStart}`,
      url: "/Festival-Handover/",
      tag: key,
    });

    for (const sub of subs || []) {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload,
        );
        sent++;
      } catch (err: any) {
        if (err?.statusCode === 404 || err?.statusCode === 410) {
          await supabase.from("push_subscriptions").delete().eq("id", sub.id);
        } else {
          console.error("push send failed", sub.id, err?.message || err);
        }
      }
    }
  }

  return new Response(JSON.stringify({ checked: dueReminders.length, sent }), {
    headers: { "Content-Type": "application/json" },
  });
});
