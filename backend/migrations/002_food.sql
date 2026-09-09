-- Ampliación aditiva: no modifica las migraciones ya aplicadas.
alter table users add column food_seller_intent boolean not null default false;
create table food_vendors (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null unique references users(id) on delete cascade,
 business_name text not null check(char_length(btrim(business_name)) between 2 and 100),
 description text not null default '' check(char_length(description)<=600),
 pickup_location text not null check(char_length(btrim(pickup_location)) between 3 and 180),
 hours_text text not null default '' check(char_length(hours_text)<=160),
 status text not null default 'pending' check(status in ('pending','approved','rejected','suspended')),
 review_source text,
 reviewed_by uuid references users(id),
 reviewed_at timestamptz,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 check(status<>'approved' or (review_source is not null and char_length(btrim(review_source))>=5 and reviewed_by is not null and reviewed_at is not null))
);
create table food_products (
 id uuid primary key default gen_random_uuid(),
 vendor_id uuid not null references food_vendors(id),
 name text not null check(char_length(btrim(name)) between 2 and 120),
 description text not null default '' check(char_length(description)<=600),
 photo_id uuid references photos(id),
 price_cents integer not null check(price_cents between 1 and 1000000),
 sale_unit text not null check(sale_unit in ('unit','lot')),
 units_per_lot integer not null default 1 check(units_per_lot between 1 and 1000),
 available boolean not null default true,
 deleted_at timestamptz,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 check((sale_unit='unit' and units_per_lot=1) or (sale_unit='lot' and units_per_lot>=2))
);
create index food_products_vendor on food_products(vendor_id) where deleted_at is null;
create table food_orders (
 id uuid primary key default gen_random_uuid(),
 buyer_id uuid not null references users(id),
 vendor_id uuid not null references food_vendors(id),
 product_id uuid not null references food_products(id),
 request_id uuid not null,
 product_name text not null,
 price_cents integer not null check(price_cents>0),
 sale_unit text not null check(sale_unit in ('unit','lot')),
 units_per_lot integer not null,
 quantity integer not null check(quantity between 1 and 50),
 total_cents integer not null check(total_cents=price_cents*quantity),
 note text not null default '' check(char_length(note)<=500),
 pickup_location text not null,
 status text not null default 'requested' check(status in ('requested','accepted','ready','completed','rejected','cancelled')),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(buyer_id,request_id)
);
create index food_orders_buyer on food_orders(buyer_id,created_at desc);
create index food_orders_vendor on food_orders(vendor_id,created_at desc);
create table notifications (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references users(id) on delete cascade,
 kind text not null check(kind in ('food_order','vendor_review')),
 title text not null,
 body text not null,
 order_id uuid references food_orders(id),
 read_at timestamptz,
 created_at timestamptz not null default now()
);
create index notifications_user on notifications(user_id,created_at desc);
revoke all on food_vendors,food_products,food_orders,notifications from public;
