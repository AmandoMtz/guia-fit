create table users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique check(email=lower(email) and char_length(email)<=254),
  password_hash text not null,
  email_confirmed_at timestamptz,
  role text not null default 'user' check(role in ('user','admin')),
  created_at timestamptz not null default now()
);
create table profiles (
  id uuid primary key references users(id) on delete cascade,
  full_name text not null check(char_length(btrim(full_name)) between 2 and 100 and full_name !~ '[[:cntrl:]]'),
  student_id text check(student_id is null or (char_length(btrim(student_id)) between 1 and 64 and student_id !~ '[[:cntrl:]]')),
  updated_at timestamptz not null default now()
);
create table institutional_verifications (
  user_id uuid primary key references users(id) on delete cascade,
  status text not null default 'pending' check(status in ('pending','verified')),
  source text,
  verified_by uuid references users(id),
  verified_at timestamptz,
  check(status <> 'verified' or (source is not null and char_length(btrim(source))>=5 and verified_by is not null and verified_at is not null))
);
create table sessions (
  token_hash text primary key,
  user_id uuid not null references users(id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index sessions_user on sessions(user_id);
create table auth_tokens (
  token_hash text primary key,
  user_id uuid not null references users(id) on delete cascade,
  purpose text not null check(purpose in ('confirm','recovery')),
  expires_at timestamptz not null
);
create index auth_tokens_user on auth_tokens(user_id);
create table rate_limits (
  bucket text primary key,
  hits integer not null,
  expires_at timestamptz not null
);
create table places (
  id text primary key default gen_random_uuid()::text,
  name text not null check(char_length(btrim(name)) between 2 and 150),
  code text not null default '' check(char_length(code)<=64),
  category text not null default 'Aula' check(category in ('Aula','Sala','Auditorio','Laboratorio','Acceso','Servicio','Deportivo','Otro')),
  building text not null default '' check(char_length(building)<=120),
  floor text not null default '' check(char_length(floor)<=64),
  description text not null default '' check(char_length(description)<=1000),
  photo_url text,
  x double precision check(x between 0 and 100),
  y double precision check(y between 0 and 100),
  verified boolean not null default false,
  source text not null default '',
  source_date date,
  updated_at timestamptz not null default now(),
  check(not verified or (char_length(btrim(source))>=5 and source_date is not null))
);
create table route_edges (
  id uuid primary key default gen_random_uuid(),
  from_id text not null references places(id) on delete cascade,
  to_id text not null references places(id) on delete cascade,
  instruction text not null check(char_length(btrim(instruction)) between 5 and 1000),
  accessible boolean not null default false,
  verified boolean not null default false,
  source text not null default '',
  source_date date,
  updated_at timestamptz not null default now(),
  check(from_id<>to_id),
  check(not verified or (char_length(btrim(source))>=5 and source_date is not null))
);
create index edges_from on route_edges(from_id);
create index edges_to on route_edges(to_id);
create table photos (
  id uuid primary key default gen_random_uuid(),
  mime text not null check(mime in ('image/jpeg','image/png','image/webp')),
  bytes bytea not null check(octet_length(bytes)<=5242880),
  created_by uuid not null references users(id),
  created_at timestamptz not null default now()
);
create function reset_verification() returns trigger language plpgsql as $$
begin
  new.updated_at=now();
  if new.full_name is distinct from old.full_name or new.student_id is distinct from old.student_id then
    update institutional_verifications set status='pending',source=null,verified_by=null,verified_at=null where user_id=new.id;
  end if;
  return new;
end;
$$;
create trigger profile_changes before update on profiles for each row execute function reset_verification();
-- Los clientes acceden únicamente a la API. No se exponen credenciales SQL.
revoke all on users,profiles,institutional_verifications,sessions,auth_tokens,rate_limits,places,route_edges,photos from public;
