alter table fit_ratings add column service_stars integer check(service_stars between 1 and 5);
alter table fit_ratings add column product_stars integer check(product_stars between 1 and 5);
-- Historical global stars are preserved; no invented service/product rating.
alter table admin_benefit_grants add column request_id uuid;
create unique index admin_benefit_request_unique on admin_benefit_grants(request_id) where request_id is not null;
alter table admin_benefit_grants add column xp integer not null default 0 check(xp between 0 and 10000);
alter table admin_benefit_grants drop constraint admin_benefit_grants_check;
alter table admin_benefit_grants add check(coins>0 or xp>0 or item is not null);
