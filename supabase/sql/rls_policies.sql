-- ============================================================================
-- Festival Handover — Seguridad: RLS con roles reales + invitaciones revocables
-- ============================================================================
-- Ejecutar en el SQL Editor de Supabase (proyecto del festival).
--
-- POR QUÉ ESTE ARCHIVO
-- --------------------
-- El modelo anterior tenía dos fallos graves:
--   1. El ROL (viewer/editor/owner) vivía en `festivals.days._roles`, un JSON que
--      CUALQUIER miembro podía sobrescribir con un UPDATE. Por tanto el rol no era
--      de fiar: un "visor" podía auto-promocionarse o escribir directamente contra
--      la API con la anon key. El control de roles del cliente era solo cosmético.
--   2. `join_festival` permitía a CUALQUIERA unirse a CUALQUIER festival con solo
--      conocer el id (corto y, antes, generado con Math.random). El enlace no
--      caducaba ni se podía revocar.
--
-- Solución:
--   - Los roles pasan a la tabla `festival_members`, cuya RLS solo deja al OWNER
--     asignar/cambiar roles. La fuente de verdad de los permisos ya no es editable
--     por el propio usuario.
--   - La unión pasa por `festival_invites`: tokens largos, con caducidad, límite de
--     usos, rol fijo definido por el owner y revocables. Sustituye a join_festival.
--
-- ⚠️ ROLLOUT — ORDEN DE APLICACIÓN
-- --------------------------------
-- El CLIENTE YA ESTÁ MIGRADO a este modelo (invitaciones con token + festival_members;
-- ya no usa ?join=<id> ni join_festival). La RPC redeem espeja la pertenencia en la
-- fila festivals, así que las Edge Functions (reminders, delete-account) NO requieren
-- cambios. Pasos recomendados:
--   1. Pruébalo PRIMERO en un proyecto Supabase de staging (o asume el riesgo).
--   2. Ejecuta este archivo entero (secciones 0-7).
--   3. Ejecuta el backfill (sección 8) UNA vez.
--   4. Despliega el cliente nuevo (build de este repo) → gh-pages.
--   5. Cuando confirmes que todo va, ejecuta la limpieza (sección 9): drop join_festival.
-- Nota: los enlaces de invitación ANTIGUOS (?join=<id>) dejarán de funcionar; hay que
-- regenerarlos desde el botón Compartir (ahora generan ?invite=<token>).
--
-- El archivo es idempotente: puedes re-ejecutarlo sin romper nada.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 0) Sin dependencias de extensiones
-- ----------------------------------------------------------------------------
-- Los tokens e ids se generan con gen_random_uuid(), que está en el core de
-- Postgres (pg_catalog) desde la v13, así que no hace falta pgcrypto. Esto evita
-- el problema de en qué esquema (public vs extensions) vive gen_random_bytes.


-- ----------------------------------------------------------------------------
-- 1) Tablas (deben existir ANTES que las funciones que las referencian)
-- ----------------------------------------------------------------------------

-- 1·pre0) Deduplicar ids de festival. El festival de ejemplo (SEED) se insertaba
-- con un id fijo ("ejemplo_fest"), así que cada usuario sembrado creó una fila con
-- ese mismo id → ids no únicos. Damos un id nuevo y único a todas las filas
-- duplicadas salvo la primera de cada grupo. Idempotente (tras correr, no quedan
-- duplicados y el WHERE no casa nada). Nota: las notas/checks en vivo de esas filas
-- (claves con prefijo del id antiguo) quedarán huérfanas; es dato de ejemplo.
update festivals f
set id = f.id || '_' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)
where exists (
  select 1 from festivals f2
  where f2.id = f.id and f2.ctid < f.ctid
);

-- 1·pre) Asegurar que festivals.id tiene una restricción UNIQUE/PK. Es requisito
-- para poder referenciarla con FOREIGN KEY desde festival_members/festival_invites.
-- (En este proyecto la tabla festivals no la tenía declarada.) Idempotente.
do $$
begin
  if not exists (
    select 1
    from pg_constraint c
    join pg_attribute a on a.attrelid = c.conrelid and a.attnum = any (c.conkey)
    where c.conrelid = 'public.festivals'::regclass
      and c.contype in ('p','u')
      and array_length(c.conkey, 1) = 1
      and a.attname = 'id'
  ) then
    alter table public.festivals add constraint festivals_id_key unique (id);
  end if;
end $$;

-- 1a) Pertenencia + rol (fuente de verdad de permisos)
create table if not exists public.festival_members (
  festival_id text not null references festivals(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  role        text not null default 'editor' check (role in ('viewer','editor','owner')),
  email       text,
  added_at    timestamptz not null default now(),
  primary key (festival_id, user_id)
);
alter table public.festival_members enable row level security;

-- 1b) Invitaciones revocables (sustituyen a join_festival)
create table if not exists public.festival_invites (
  token        text primary key default (replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '')),
  festival_id  text not null references festivals(id) on delete cascade,
  role         text not null default 'editor' check (role in ('viewer','editor','owner')),
  created_by   uuid not null default auth.uid() references auth.users(id),
  expires_at   timestamptz not null default now() + interval '14 days',
  max_uses     int,                         -- null = ilimitado
  uses         int not null default 0,
  revoked      boolean not null default false,
  created_at   timestamptz not null default now()
);
alter table public.festival_invites enable row level security;


-- ----------------------------------------------------------------------------
-- 2) Funciones auxiliares (SECURITY DEFINER para evitar recursión de RLS)
-- ----------------------------------------------------------------------------
-- Se consultan desde las policies; al ser SECURITY DEFINER no re-disparan RLS y
-- evitan recursión infinita al referenciar las mismas tablas.

create or replace function public.is_festival_owner(fid text)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (select 1 from festivals where id = fid and user_id = auth.uid());
$$;

create or replace function public.is_festival_member(fid text)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (select 1 from festivals where id = fid and user_id = auth.uid())
      or exists (select 1 from festival_members where festival_id = fid and user_id = auth.uid());
$$;

-- Rol efectivo del usuario actual: 'owner' si es dueño, si no el de festival_members.
create or replace function public.my_festival_role(fid text)
returns text language sql security definer stable set search_path = public as $$
  select case
    when exists (select 1 from festivals where id = fid and user_id = auth.uid()) then 'owner'
    else (select role from festival_members where festival_id = fid and user_id = auth.uid())
  end;
$$;


-- ----------------------------------------------------------------------------
-- 3) Políticas de festival_members
-- ----------------------------------------------------------------------------
-- Ver miembros: cualquier miembro del festival ve a sus compañeros.
drop policy if exists fm_select on public.festival_members;
create policy fm_select on public.festival_members
  for select using (is_festival_member(festival_id));

-- Crear/editar/borrar pertenencia y roles: SOLO el owner.
-- (La auto-unión vía invitación se hace con SECURITY DEFINER en la sección 5,
--  así que el invitado no necesita policy de INSERT.)
drop policy if exists fm_owner_write on public.festival_members;
create policy fm_owner_write on public.festival_members
  for all using (is_festival_owner(festival_id))
  with check (is_festival_owner(festival_id));


-- ----------------------------------------------------------------------------
-- 4) RLS de `festivals` con roles aplicados en BD
-- ----------------------------------------------------------------------------
alter table public.festivals enable row level security;

drop policy if exists fest_select on public.festivals;
drop policy if exists fest_insert on public.festivals;
drop policy if exists fest_update on public.festivals;
drop policy if exists fest_delete on public.festivals;

-- SELECT: owner o miembro (cualquier rol, incl. viewer).
create policy fest_select on public.festivals
  for select using (user_id = auth.uid() or is_festival_member(id));

-- INSERT: solo creando una fila propia.
create policy fest_insert on public.festivals
  for insert with check (user_id = auth.uid());

-- UPDATE: owner o editor. El VIEWER queda fuera → ya no puede escribir.
create policy fest_update on public.festivals
  for update using (my_festival_role(id) in ('owner','editor'))
  with check  (my_festival_role(id) in ('owner','editor'));

-- DELETE: SOLO el owner (antes podía cualquier miembro).
create policy fest_delete on public.festivals
  for delete using (user_id = auth.uid());

-- Trigger: blindar la columna de propietario. Ni un editor ni nadie puede
-- robar la titularidad cambiando user_id vía un UPDATE normal.
create or replace function public.festivals_guard()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.user_id is distinct from old.user_id then
    raise exception 'no se permite cambiar el propietario del festival';
  end if;
  return new;
end;
$$;

drop trigger if exists festivals_guard_trg on public.festivals;
create trigger festivals_guard_trg before update on public.festivals
  for each row execute function public.festivals_guard();


-- ----------------------------------------------------------------------------
-- 5) RPC de invitaciones
-- ----------------------------------------------------------------------------
-- 5a) Crear invitación (solo owner). Devuelve el token para la URL: ?invite=<token>
create or replace function public.create_festival_invite(
  fid text,
  invite_role text default 'editor',
  ttl_days int default 14,
  uses_limit int default null
) returns text language plpgsql security definer set search_path = public as $$
declare tok text;
begin
  if not is_festival_owner(fid) then raise exception 'solo el owner puede invitar'; end if;
  if invite_role not in ('viewer','editor','owner') then raise exception 'rol inválido'; end if;
  -- 64 hex chars (256 bits) sin depender de pgcrypto/gen_random_bytes
  tok := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
  insert into festival_invites (token, festival_id, role, expires_at, max_uses)
    values (tok, fid, invite_role, now() + make_interval(days => greatest(ttl_days, 1)), uses_limit);
  return tok;
end;
$$;

-- 5b) Canjear invitación (cualquier usuario autenticado). Une al usuario con el
--     rol DEL TOKEN (no uno elegido por él). Reemplaza a join_festival.
--     Al ser SECURITY DEFINER, además ESPEJA la pertenencia en la fila festivals
--     (members[], days._roles, days._memberInfo) para que las Edge Functions
--     (reminders, borrado de cuenta) y la UI sigan funcionando sin cambios, y para
--     que un viewer pueda unirse aunque la RLS le impida escribir la fila.
create or replace function public.redeem_festival_invite(invite_token text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare inv festival_invites; uid_ uuid := auth.uid(); uemail text; eff_role text;
begin
  if uid_ is null then raise exception 'no autenticado'; end if;
  select * into inv from festival_invites where token = invite_token for update;
  if inv is null then raise exception 'invitación no válida'; end if;
  if inv.revoked then raise exception 'invitación revocada'; end if;
  if inv.expires_at < now() then raise exception 'invitación caducada'; end if;
  if inv.max_uses is not null and inv.uses >= inv.max_uses then raise exception 'invitación agotada'; end if;

  -- El owner no necesita unirse a su propio festival.
  if exists (select 1 from festivals where id = inv.festival_id and user_id = uid_) then
    return jsonb_build_object('festival_id', inv.festival_id, 'role', 'owner');
  end if;

  select email into uemail from auth.users where id = uid_;

  -- Fuente de verdad de permisos. No degradar a un owner ya existente.
  insert into festival_members (festival_id, user_id, role, email)
    values (inv.festival_id, uid_, inv.role, uemail)
  on conflict (festival_id, user_id) do update
    set role  = case when festival_members.role = 'owner' then 'owner' else excluded.role end,
        email = excluded.email
  returning role into eff_role;

  -- Espejo en la fila festivals (compat con Edge Functions y UI existente).
  update festivals set
    members = (
      select coalesce(array_agg(distinct m), '{}')
      from unnest(coalesce(members, '{}') || array[uid_::text]) as m
    ),
    days = jsonb_set(
             jsonb_set(
               coalesce(days, '{}'::jsonb),
               '{_roles}',     coalesce(days->'_roles','{}'::jsonb) || jsonb_build_object(uid_::text, eff_role), true),
             '{_memberInfo}',  coalesce(days->'_memberInfo','{}'::jsonb) || jsonb_build_object(uid_::text, jsonb_build_object('email', uemail)), true)
  where id = inv.festival_id;

  update festival_invites set uses = uses + 1 where token = invite_token;
  return jsonb_build_object('festival_id', inv.festival_id, 'role', eff_role);
end;
$$;


-- ----------------------------------------------------------------------------
-- 6) Políticas de festival_invites
-- ----------------------------------------------------------------------------
-- Solo el owner ve/gestiona las invitaciones de su festival.
-- (El invitado NUNCA lee esta tabla directamente: canjea con redeem_festival_invite.)
drop policy if exists inv_owner_all on public.festival_invites;
create policy inv_owner_all on public.festival_invites
  for all using (is_festival_owner(festival_id))
  with check (is_festival_owner(festival_id));


-- ----------------------------------------------------------------------------
-- 7) Endurecer el resto de tablas
-- ----------------------------------------------------------------------------
-- user_data: cada usuario solo accede a su propia fila.
alter table public.user_data enable row level security;
drop policy if exists ud_own on public.user_data;
create policy ud_own on public.user_data
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- push_subscriptions y sent_soundcheck_reminders ya cubiertas en push_notifications.sql.


-- ----------------------------------------------------------------------------
-- 8) Backfill — migrar pertenencia/roles existentes a festival_members
-- ----------------------------------------------------------------------------
-- Ejecutar UNA vez. Idempotente (on conflict do nothing).
insert into public.festival_members (festival_id, user_id, role, email)
select f.id,
       m::uuid,
       coalesce((f.days->'_roles')->>m, 'editor'),
       (f.days->'_memberInfo'->m)->>'email'
from public.festivals f, unnest(f.members) as m
where m ~ '^[0-9a-f-]{36}$'              -- solo uuids válidos
on conflict (festival_id, user_id) do nothing;


-- ----------------------------------------------------------------------------
-- 9) Limpieza final (ejecutar SOLO cuando el cliente nuevo esté en producción)
-- ----------------------------------------------------------------------------
-- Retirar la auto-unión insegura por id:
--   drop function if exists public.join_festival(text);
-- Opcional, una vez migrado: dejar de usar la columna festivals.members como
-- fuente de verdad (queda solo festival_members). No la borres aún si las Edge
-- Functions todavía la leen.
