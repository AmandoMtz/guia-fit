-- Claves privadas solo en el servidor/base de datos; nunca se entregan al navegador.
create table if not exists fit_push_keys (
 id integer primary key check (id=1), public_key text not null, private_key text not null
);
create table if not exists fit_push_subscriptions (
 endpoint text primary key, user_id uuid not null references users(id) on delete cascade,
 session_hash text not null references sessions(token_hash) on delete cascade,
 p256dh text not null, auth text not null, updated_at timestamptz not null default now()
);
create index if not exists fit_push_subscriptions_user on fit_push_subscriptions(user_id);
create table if not exists fit_push_outbox (
 id uuid primary key, user_id uuid not null references users(id) on delete cascade,
 chat_id uuid not null, expires_at timestamptz not null,
 attempts integer not null default 0, next_attempt timestamptz not null default now(),
 lease_until timestamptz
);
create index if not exists fit_push_outbox_due on fit_push_outbox(next_attempt);
