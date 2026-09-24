-- Recompensas permanentes; importes y claves de actividad controlados por servidor.
create table fit_progress (
 user_id uuid primary key references users(id) on delete cascade,
 xp integer not null default 0 check(xp>=0), coins integer not null default 0 check(coins>=0),
 equipped jsonb not null default '{}', animations boolean not null default true
);
create table fit_rewards (
 user_id uuid not null references users(id) on delete cascade,
 activity text not null, xp integer not null check(xp>0), created_at timestamptz not null default now(),
 primary key(user_id,activity)
);
create table fit_inventory (
 user_id uuid not null references users(id) on delete cascade, item text not null,
 purchased_at timestamptz not null default now(), primary key(user_id,item)
);
create table fit_vendor_categories (
 vendor_id uuid not null references food_vendors(id) on delete cascade,
 category text not null check(category in ('comida','postres','botanas','bebidas','otros')),
 primary key(vendor_id,category)
);
insert into fit_vendor_categories(vendor_id,category) select id,'comida' from food_vendors;
create table fit_ratings (
 order_id uuid primary key references food_orders(id),
 buyer_id uuid not null references users(id), vendor_id uuid not null references food_vendors(id),
 stars integer not null check(stars between 1 and 5),
 category text not null check(category in ('comida','postres','botanas','bebidas','otros')),
 created_at timestamptz not null default now()
);
create index fit_ratings_vendor on fit_ratings(vendor_id,category);
revoke all on fit_progress,fit_rewards,fit_inventory,fit_vendor_categories,fit_ratings from public;
