-- Push notifications: aviso 30 min antes del soundcheck de cada artista
-- Ejecutar en el SQL Editor de Supabase (proyecto del festival).

-- 1) Suscripciones Web Push, una fila por dispositivo/navegador del usuario.
create table if not exists push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz default now()
);

alter table push_subscriptions enable row level security;

drop policy if exists "own subscriptions" on push_subscriptions;
create policy "own subscriptions" on push_subscriptions
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- 2) Dedupe de recordatorios ya enviados. Solo la Edge Function (service role)
-- la usa; RLS sin policies = inaccesible desde el cliente con la anon key.
create table if not exists sent_soundcheck_reminders (
  reminder_key text primary key,
  sent_at timestamptz default now()
);

alter table sent_soundcheck_reminders enable row level security;

-- 3) Cron: ejecutar la Edge Function cada minuto.
-- Requiere las extensiones pg_cron y pg_net habilitadas
-- (Database → Extensions, en el panel de Supabase).
-- Sustituye <project-ref> y <CRON_SECRET> por los valores reales
-- (CRON_SECRET debe coincidir con el secret configurado en la Edge Function).
--
-- select cron.schedule(
--   'soundcheck-reminders',
--   '* * * * *',
--   $$
--   select net.http_post(
--     url := 'https://<project-ref>.functions.supabase.co/send-soundcheck-reminders',
--     headers := jsonb_build_object('x-cron-secret', '<CRON_SECRET>', 'Content-Type', 'application/json'),
--     body := '{}'::jsonb
--   );
--   $$
-- );
--
-- Para desactivarlo más adelante: select cron.unschedule('soundcheck-reminders');
