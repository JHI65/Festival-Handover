// Cron job (cada minuto vía pg_cron) que envía hasta 3 avisos push por
// artista — Load In (-30 min), Soundcheck (-15 min) y Show (-15 min) —
// solo a los miembros asignados a ese stage. Ver REMINDER_TYPES abajo.
// Además, en el minuto exacto de showStart, marca automáticamente el tick
// SHOW del artista en la columna `checks` (misma key que usa toggleCheck en
// el cliente: `${festId}__${dayId}__${artId}__show`), sin esperar a que un
// técnico lo pulse a mano.
// Deploy: supabase functions deploy send-soundcheck-reminders --no-verify-jwt
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

// Minuto real del día (0-1439) de una hora "HH:MM".
function minutesOfDay(t?: string | null) {
  if (!t) return null;
  const [h, m] = t.split(":").map(Number);
  return h * 60 + (m || 0);
}

// Suma/resta días a una fecha "YYYY-MM-DD" en aritmética de calendario pura
// (sin zona horaria).
function shiftDate(dateStr: string, delta: number) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + delta);
  return dt.toISOString().slice(0, 10);
}

// Replica festTimeToMin del cliente (src/lib/utils.js: `h < 6 ? h+24 : h`):
// las horas antes de las 06:00 son madrugada y pertenecen, en calendario
// real, al día siguiente a `day.date`. Devuelve la fecha y minuto reales en
// los que debe dispararse el aviso (offset minutos antes de `t`), con
// wraparound de fecha si restar el offset cruza medianoche hacia atrás.
function targetInstant(dayDate: string, t: string | null | undefined, offset: number) {
  const mins = minutesOfDay(t);
  if (mins === null) return null;
  const madrugada = mins < 360;
  let min = mins - offset;
  let dayShift = madrugada ? 1 : 0;
  if (min < 0) { min += 1440; dayShift -= 1; }
  return { dateStr: shiftDate(dayDate, dayShift), min };
}

// Un artista puede disparar hasta 3 avisos independientes.
const REMINDER_TYPES = [
  { field: "scLoadIn", type: "loadin", offset: 30, title: "Load In en 30 min" },
  { field: "scStart", type: "soundcheck", offset: 15, title: "Soundcheck en 15 min" },
  { field: "showStart", type: "show", offset: 15, title: "Show en 15 min" },
] as const;

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
  const dueReminders: { fest: any; stage: any; day: any; artist: any; key: string; title: string; refTime: string }[] = [];
  const autoTickKeys: { festId: string; key: string }[] = [];

  for (const fest of festivals || []) {
    const stages = fest.days?._stages || [];
    const memberInfo = fest.days?._memberInfo || {};
    for (const stage of stages) {
      for (const day of stage.days || []) {
        if (!day.date) continue;
        for (const artist of day.artists || []) {
          for (const rt of REMINDER_TYPES) {
            const refTime = artist[rt.field];
            if (!refTime) continue;
            const target = targetInstant(day.date, refTime, rt.offset);
            if (!target || target.dateStr !== todayStr || target.min !== nowMin) continue;
            const key = `${fest.id}__${stage.id}__${day.id}__${artist.id}__${rt.type}`;
            dueReminders.push({ fest: { ...fest, memberInfo }, stage, day, artist, key, title: rt.title, refTime });
          }

          if (artist.showStart) {
            const target = targetInstant(day.date, artist.showStart, 0);
            if (target && target.dateStr === todayStr && target.min === nowMin) {
              const checkKey = `${fest.id}__${day.id}__${artist.id}__show`;
              if (!fest.checks?.[checkKey]) autoTickKeys.push({ festId: fest.id, key: checkKey });
            }
          }
        }
      }
    }
  }

  // Auto-tick del check SHOW: agrupado por festival para hacer un solo UPDATE
  // por fila aunque varios artistas de ese festival empiecen en el mismo minuto.
  let autoTicked = 0;
  if (autoTickKeys.length) {
    const byFest = new Map<string, Set<string>>();
    for (const { festId, key } of autoTickKeys) {
      if (!byFest.has(festId)) byFest.set(festId, new Set());
      byFest.get(festId)!.add(key);
    }
    for (const [festId, keys] of byFest) {
      const fest = (festivals || []).find((f: any) => f.id === festId);
      const updatedChecks = { ...(fest?.checks || {}) };
      for (const k of keys) updatedChecks[k] = true;
      const { error: tickErr } = await supabase.from("festivals").update({ checks: updatedChecks }).eq("id", festId);
      if (tickErr) console.error("auto-tick SHOW falló", festId, tickErr.message);
      else autoTicked += keys.size;
    }
  }

  for (const { fest, stage, day, artist, key, title, refTime } of dueReminders) {
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
      title,
      body: `${artist.artist || "Artista"} · ${stage.name} · ${refTime}`,
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

  return new Response(JSON.stringify({ checked: dueReminders.length, sent, autoTicked }), {
    headers: { "Content-Type": "application/json" },
  });
});
