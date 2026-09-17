alter table fit_push_outbox alter column chat_id drop not null;
alter table fit_push_outbox add column payload jsonb;
create table fit_activity_notifications (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references users(id) on delete cascade,
 kind text not null, title text not null, body text not null, view_name text not null,
 created_at timestamptz not null default now(), read_at timestamptz
);
create index fit_activity_user on fit_activity_notifications(user_id,created_at desc);
create table fit_push_delivery_log (
 id bigint generated always as identity primary key, job_id uuid not null, user_id uuid,
 outcome text not null, attempts integer not null, created_at timestamptz not null default now()
);
create trigger fit_activity_audit after insert or update or delete on fit_activity_notifications for each row execute function fit_audit_row();
create trigger fit_push_delivery_audit after insert on fit_push_delivery_log for each row execute function fit_audit_row();
create function fit_queue_activity() returns trigger language plpgsql as $$ begin
 insert into fit_push_outbox(id,user_id,expires_at,payload) values(new.id,new.user_id,now()+interval '1 day',
 jsonb_build_object('title','Guía FIT','body',new.body,'view',new.view_name,'tag','fit-activity-'||new.id,'recipientId',new.user_id));
 return null;
end $$;
create trigger fit_activity_queue after insert on fit_activity_notifications for each row execute function fit_queue_activity();
create function fit_business_notice() returns trigger language plpgsql as $$
declare recipient uuid; label text; target text; begin
 target='profile';
 if TG_TABLE_NAME='notifications' then recipient=new.user_id; label='Hay una actualización de tus pedidos o de tu solicitud de venta.'; target='food';
 elsif TG_TABLE_NAME='event_attendance' then recipient=new.user_id;label='Tu asistencia al evento quedó registrada.';target='events';
 elsif TG_TABLE_NAME='attendance_devices' then
 recipient=new.user_id;
 if TG_OP='INSERT' then label='Tu dispositivo está pendiente de autorización.';
 elsif new.status is distinct from old.status then label='Cambió la autorización de tu dispositivo. Revisa Mi cuenta.';
 else return null; end if;
 elsif TG_TABLE_NAME='admin_benefit_grants' then recipient=new.user_id;label='Administración te asignó monedas o una recompensa.';
 elsif TG_TABLE_NAME='fit_inventory' then recipient=new.user_id;label='Se agregó una recompensa a tu inventario.';
 elsif TG_TABLE_NAME='fit_rewards' then recipient=new.user_id;label='Recibiste una recompensa por tu actividad.';
 elsif TG_TABLE_NAME='institutional_verifications' then
 if TG_OP='UPDATE' and new.status is not distinct from old.status then return null;end if;
 recipient=new.user_id;label='Se actualizó la verificación de tu cuenta.';
 else return null; end if;
 insert into fit_activity_notifications(user_id,kind,title,body,view_name) values(recipient,TG_TABLE_NAME,'Guía FIT',label,target);
 return null;
end $$;
do $$ declare t text; begin
 foreach t in array array['notifications','event_attendance','admin_benefit_grants','fit_inventory','fit_rewards'] loop
 execute format('create trigger fit_business_notice after insert on %I for each row execute function fit_business_notice()',t);
 end loop;
 foreach t in array array['attendance_devices','institutional_verifications'] loop
 execute format('create trigger fit_business_notice after insert or update on %I for each row execute function fit_business_notice()',t);
 end loop;
end $$;
revoke all on fit_activity_notifications,fit_push_delivery_log from public;
