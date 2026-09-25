alter table food_orders
  add column if not exists delivery_qr text unique,
  add column if not exists delivery_qr_used boolean not null default false,
  add column if not exists delivery_qr_used_at timestamptz;
