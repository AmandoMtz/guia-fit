-- Eventos, carreras de perfil y asistencia por QR. Migración aditiva.
alter table profiles add column career text check(career is null or (char_length(btrim(career)) between 2 and 160 and career !~ '[[:cntrl:]]'));

create table events (
  id uuid primary key default gen_random_uuid(),
  title text not null check(char_length(btrim(title)) between 3 and 160 and title !~ '[[:cntrl:]]'),
  description text not null default '' check(char_length(description)<=2500),
  location text not null check(char_length(btrim(location)) between 2 and 180 and location !~ '[[:cntrl:]]'),
  audience text not null check(audience in ('students','teachers')),
  visibility text not null default 'public' check(visibility in ('public','targeted')),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  created_by uuid not null references users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check(ends_at > starts_at)
);
create index events_when on events(starts_at desc);
create index events_audience on events(audience,starts_at desc);

create table event_careers (
  event_id uuid not null references events(id) on delete cascade,
  career text not null check(char_length(btrim(career)) between 2 and 160),
  primary key(event_id,career)
);

create table event_teacher_invites (
  event_id uuid not null references events(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  primary key(event_id,user_id)
);

create table event_checkin_tokens (
  event_id uuid primary key references events(id) on delete cascade,
  token_hash text not null unique,
  token_value text not null unique check(char_length(token_value) between 16 and 80),
  created_by uuid not null references users(id),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);

create table event_attendance (
  event_id uuid not null references events(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  checked_in_at timestamptz not null default now(),
  method text not null default 'qr' check(method='qr'),
  primary key(event_id,user_id)
);
create index event_attendance_user on event_attendance(user_id,checked_in_at desc);

create table event_documents (
  code text primary key,
  document_type text not null check(document_type in ('my_attendance','event_attendees')),
  owner_user_id uuid references users(id) on delete set null,
  event_id uuid references events(id) on delete set null,
  event_title text,
  subject_name text,
  item_count integer not null check(item_count>=0),
  generated_at timestamptz not null default now()
);

revoke all on events,event_careers,event_teacher_invites,event_checkin_tokens,event_attendance,event_documents from public;
