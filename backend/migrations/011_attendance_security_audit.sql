alter table events add column latitude double precision check(latitude between -90 and 90);
alter table events add column longitude double precision check(longitude between -180 and 180);
alter table events add column radius_m integer not null default 100 check(radius_m between 10 and 1000);
alter table events add column max_accuracy_m integer not null default 50 check(max_accuracy_m between 1 and 200);
create table attendance_devices (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references users(id),
 fingerprint text not null unique, public_key jsonb not null, label text not null,
 status text not null default 'pending' check(status in ('pending','approved','revoked')),
 created_at timestamptz not null default now(), reviewed_by uuid references users(id), reviewed_at timestamptz, reason text
);
create unique index attendance_one_device on attendance_devices(user_id) where status='approved';
create table attendance_challenges (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references users(id) on delete cascade,
 device_id uuid not null references attendance_devices(id), token_hash text not null,
 nonce text not null, expires_at timestamptz not null default now()+interval '90 seconds'
);
alter table event_attendance add column device_id uuid references attendance_devices(id);
alter table event_attendance add column distance_m double precision;
alter table event_attendance add column accuracy_m double precision;
create table audit_log (
 id bigint generated always as identity primary key, created_at timestamptz not null default now(),
 request_id text, actor_id uuid, action text not null, entity text not null, record_id text,
 before_data jsonb, after_data jsonb
);
create index audit_log_time on audit_log(id desc);
create index audit_log_actor on audit_log(actor_id,id desc);
create function fit_audit_row() returns trigger language plpgsql as $$
declare b jsonb; a jsonb; r jsonb;
begin
 -- Exclude secrets, binary assets and conversation text. Retain transaction fields.
 if TG_OP <> 'INSERT' then b=to_jsonb(old)-array['password_hash','token_hash','token_value','bytes','public_key','fingerprint','p256dh','auth','endpoint','session_hash','private_key','body','message','prompt','response','user_message','assistant_message']; end if;
 if TG_OP <> 'DELETE' then a=to_jsonb(new)-array['password_hash','token_hash','token_value','bytes','public_key','fingerprint','p256dh','auth','endpoint','session_hash','private_key','body','message','prompt','response','user_message','assistant_message']; end if;
 r=coalesce(a,b);
 insert into audit_log(request_id,actor_id,action,entity,record_id,before_data,after_data)
 values(nullif(current_setting('fit.request_id',true),''),nullif(current_setting('fit.actor_id',true),'')::uuid,TG_OP,TG_TABLE_NAME,
 coalesce(r->>'id',r->>'user_id',r->>'event_id',r->>'order_id'),b,a);
 return null;
end $$;
do $$ declare t text; begin
 foreach t in array array['users','profiles','institutional_verifications','sessions','auth_tokens','places','route_edges','photos','profile_photos','food_vendors','food_products','food_orders','notifications','events','event_careers','event_teacher_invites','event_checkin_tokens','event_attendance','event_documents','fit_progress','fit_rewards','fit_inventory','fit_vendor_categories','fit_ratings','admin_benefit_grants','attendance_devices','fit_push_subscriptions','chatbot_logs'] loop
 execute format('create trigger fit_audit after insert or update or delete on %I for each row execute function fit_audit_row()',t);
 end loop;
end $$;
create function fit_audit_immutable() returns trigger language plpgsql as $$ begin raise exception 'Audit records are append-only'; end $$;
create trigger audit_no_edit before update or delete or truncate on audit_log for each statement execute function fit_audit_immutable();
revoke all on attendance_devices,attendance_challenges,audit_log from public;
