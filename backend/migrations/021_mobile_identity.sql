-- Preserve existing real names; every account receives a unique editable handle.
alter table profiles add column username text;
update profiles set username='fit_'||substr(replace(gen_random_uuid()::text,'-',''),1,16);
alter table profiles alter column username set not null;
alter table profiles add constraint profiles_username_format check(username ~ '^[A-Za-z0-9_]{3,40}$');
create unique index profiles_username_unique on profiles(lower(username));
create function fit_default_username() returns trigger language plpgsql as $$ begin
 if new.username is null then new.username='fit_'||substr(replace(gen_random_uuid()::text,'-',''),1,16); end if;
 return new;
end $$;
create trigger fit_default_username before insert on profiles for each row execute function fit_default_username();
-- The imported name is only applied after the user reviews and saves the sheet.
create function fit_schedule_identity() returns trigger language plpgsql as $$ begin
 if new.data->>'accountType'='teacher' then return new; end if;
 if TG_OP='UPDATE' then
  if new.data->>'studentName' is not distinct from old.data->>'studentName' then return new; end if;
 end if;
 if length(trim(new.data->>'studentName')) between 2 and 100 then
  update profiles set full_name=trim(new.data->>'studentName') where id=new.user_id;
 end if;
 return new;
end $$;
create trigger fit_schedule_identity after insert or update on user_schedules for each row execute function fit_schedule_identity();
create table fit_class_notice_keys (
 user_id uuid not null references users(id) on delete cascade,
 class_key text not null, class_date date not null,
 primary key(user_id,class_key,class_date)
);
create table fit_push_preferences (
 user_id uuid primary key references users(id) on delete cascade,
 class_reminders boolean not null default true
);
create or replace function fit_queue_activity() returns trigger language plpgsql as $$ begin
 insert into fit_push_outbox(id,user_id,expires_at,payload) values(new.id,new.user_id,now()+interval '1 day',
 jsonb_build_object('title',new.title,'body',new.body,'view',new.view_name,'tag','fit-activity-'||new.id,'recipientId',new.user_id));
 return null;
end $$;
revoke all on fit_class_notice_keys,fit_push_preferences from public;
