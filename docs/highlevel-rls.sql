-- Postgres schema + row-level security for the HighLevel AI Studio Cloud database.
-- Apply this when moving the app into AI Studio. It mirrors src/db.js.
-- Assumes the Cloud auth exposes the signed-in user id as auth.uid() and the owner flag
-- lives in a protected profiles.role column that users cannot edit.
-- If AI Studio uses a different helper name, swap auth.uid() for it.

create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  role text not null default 'user' check (role in ('user','owner')),
  marketing_opt_in boolean not null default false,
  created_at timestamptz not null default now()
);
create or replace function is_owner() returns boolean language sql stable security definer as
$$ select exists (select 1 from profiles where id = auth.uid() and role = 'owner') $$;

alter table profiles enable row level security;
create policy profiles_self_read on profiles for select using (id = auth.uid() or is_owner());
create policy profiles_self_insert on profiles for insert with check (id = auth.uid() and role = 'user');
-- users may change their own name/marketing flag but never their role
create policy profiles_self_update on profiles for update using (id = auth.uid())
  with check (id = auth.uid() and role = (select role from profiles p where p.id = auth.uid()));

-- ---------- compliance ----------
create table if not exists consent_records (
  id uuid primary key default gen_random_uuid(),
  visitor_id text not null,
  user_id uuid null,
  choice text not null check (choice in ('accept_all','reject_all','custom')),
  categories jsonb not null,
  banner_version text not null,
  policy_version text not null,
  region text not null,
  gpc boolean not null default false,
  created_at timestamptz not null default now(),
  user_agent text
);
alter table consent_records enable row level security;
-- visitors (anon or signed in) may only INSERT; user_id must be null or themselves; created_at is server-set
create policy consent_insert on consent_records for insert to anon, authenticated
  with check (user_id is null or user_id = auth.uid());
create policy consent_owner_read on consent_records for select using (is_owner());
-- no update/delete policies => nobody can update or delete. Belt and braces:
revoke update, delete on consent_records from anon, authenticated;

create table if not exists signup_consents (
  id bigserial primary key,
  user_id uuid not null,
  terms_version text not null,
  privacy_version text not null,
  marketing_opt_in boolean not null default false,
  created_at timestamptz not null default now()
);
alter table signup_consents enable row level security;
create policy signup_insert on signup_consents for insert to authenticated with check (user_id = auth.uid());
create policy signup_read on signup_consents for select using (user_id = auth.uid() or is_owner());
revoke update, delete on signup_consents from anon, authenticated;

create table if not exists data_requests (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  type text not null check (type in ('access','delete','correct')),
  status text not null default 'new' check (status in ('new','in_progress','done')),
  details text,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  notes text
);
alter table data_requests enable row level security;
create policy dr_insert on data_requests for insert to anon, authenticated with check (status = 'new' and completed_at is null and notes is null);
create policy dr_owner_read on data_requests for select using (is_owner());
create policy dr_owner_update on data_requests for update using (is_owner()) with check (is_owner());

-- ---------- product tables (owner column = user_id) ----------
create table if not exists label_scans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null, serving text,
  added_sugar numeric not null, fiber numeric not null, protein numeric not null, total_carbs numeric not null, fat numeric not null default 0,
  ingredients text not null default '', score int not null, result jsonb not null, photo_path text,
  created_at timestamptz not null default now()
);
create table if not exists plates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null, items jsonb not null, totals jsonb not null, tips jsonb not null, photo_path text,
  created_at timestamptz not null default now()
);
create table if not exists food_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  log_date date not null, meal text not null check (meal in ('breakfast','lunch','dinner','snack')),
  label text not null, emoji text,
  protein numeric not null default 0, fiber numeric not null default 0, added_sugar numeric not null default 0, carbs numeric not null default 0, fat numeric not null default 0,
  source text, created_at timestamptz not null default now()
);
create table if not exists targets (
  user_id uuid primary key references auth.users(id) on delete cascade,
  protein numeric not null default 90, fiber numeric not null default 25, added_sugar numeric not null default 25
);
create table if not exists meal_plans (
  user_id uuid not null references auth.users(id) on delete cascade,
  week_start date not null, slots jsonb not null, updated_at timestamptz not null default now(),
  primary key (user_id, week_start)
);
create table if not exists lesson_progress (
  user_id uuid not null references auth.users(id) on delete cascade,
  lesson_id text not null, completed_at timestamptz not null default now(),
  primary key (user_id, lesson_id)
);

do $$
declare t text;
begin
  foreach t in array array['label_scans','plates','food_logs','targets','meal_plans','lesson_progress'] loop
    execute format('alter table %I enable row level security', t);
    execute format('create policy %I on %I for select using (user_id = auth.uid())', t || '_sel', t);
    execute format('create policy %I on %I for insert with check (user_id = auth.uid())', t || '_ins', t);
    execute format('create policy %I on %I for update using (user_id = auth.uid()) with check (user_id = auth.uid())', t || '_upd', t);
    execute format('create policy %I on %I for delete using (user_id = auth.uid())', t || '_del', t);
  end loop;
end $$;

-- ---------- file storage ----------
-- Bucket "photos", private. Path convention: <user_id>/<file_id>.<ext>. Allowed: image/jpeg, image/png, image/webp, max 5 MB.
-- Storage policy (adapt to AI Studio storage syntax): a user may read/write/delete only objects whose
-- first path segment equals auth.uid(). No public URLs.
