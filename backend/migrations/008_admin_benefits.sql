-- Auditoría de beneficios entregados manualmente por administración.
create table admin_benefit_grants (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid not null references users(id),
  user_id uuid not null references users(id) on delete cascade,
  coins integer not null default 0 check(coins between 0 and 10000),
  item text,
  note text not null check(char_length(btrim(note)) between 3 and 300),
  created_at timestamptz not null default now(),
  check(coins > 0 or item is not null)
);
create index admin_benefit_grants_user on admin_benefit_grants(user_id,created_at desc);
create index admin_benefit_grants_admin on admin_benefit_grants(admin_id,created_at desc);
revoke all on admin_benefit_grants from public;
