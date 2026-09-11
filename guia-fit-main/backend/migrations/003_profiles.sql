-- Ampliación aditiva: conserva usuarios, pedidos y las migraciones anteriores.
alter table food_vendors add column is_active boolean not null default true;

-- Una foto optimizada por cuenta; nunca se guarda el original de un horario.
create table profile_photos (
  user_id uuid primary key references users(id) on delete cascade,
  mime text not null default 'image/webp' check(mime='image/webp'),
  bytes bytea not null check(octet_length(bytes) between 1 and 524288),
  updated_at timestamptz not null default now()
);
revoke all on profile_photos from public;
