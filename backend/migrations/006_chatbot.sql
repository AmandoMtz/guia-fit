-- Registro de conversaciones del asistente. El historial conversacional activo vive en memoria y es temporal.
create table chatbot_logs (
  id bigserial primary key,
  user_id uuid references users(id) on delete set null,
  account_type text not null check(account_type in ('student','teacher','admin','other')),
  user_message text not null check(char_length(user_message) between 1 and 1200),
  assistant_message text not null check(char_length(assistant_message) between 1 and 4000),
  category text not null default 'system' check(category in ('system','casual','human_support')),
  escalated boolean not null default false,
  provider text,
  model text,
  latency_ms integer check(latency_ms is null or latency_ms >= 0),
  created_at timestamptz not null default now()
);
create index chatbot_logs_user on chatbot_logs(user_id,created_at desc);
create index chatbot_logs_created on chatbot_logs(created_at desc);
revoke all on chatbot_logs from public;
