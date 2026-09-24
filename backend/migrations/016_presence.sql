create table if not exists user_presence_preferences (
 user_id uuid primary key references users(id) on delete cascade,
 mode text not null default 'online' check(mode in ('online','away','dnd','offline'))
);
create table if not exists user_presence_sessions (
 session_hash text not null references sessions(token_hash) on delete cascade,
 tab_id uuid not null,
 user_id uuid not null references users(id) on delete cascade,
 seen_at timestamptz not null default now(),
 active_at timestamptz not null default now(),
 primary key(session_hash,tab_id)
);
create index if not exists presence_user_seen on user_presence_sessions(user_id,seen_at);
