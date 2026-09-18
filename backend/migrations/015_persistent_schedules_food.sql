alter table food_vendors add column deleted_at timestamptz;
create table user_schedules (
 user_id uuid primary key references users(id) on delete cascade,
 data jsonb, revision integer not null default 1, updated_at timestamptz not null default now()
);
create trigger schedule_audit after insert or update or delete on user_schedules for each row execute function fit_audit_row();
create table food_chats (
 id uuid primary key default gen_random_uuid(), buyer_id uuid not null references users(id), seller_user_id uuid not null references users(id),
 vendor_id uuid not null references food_vendors(id), product_id uuid not null references food_products(id),
 product_name text not null,business_name text not null,buyer_name text not null,pickup_location text not null,
 order_id uuid references food_orders(id),created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 expires_at timestamptz not null default now()+interval '12 hours',buyer_read_at timestamptz not null default now(),seller_read_at timestamptz not null default 'epoch',
 check(buyer_id<>seller_user_id)
);
create index food_chats_buyer on food_chats(buyer_id,expires_at);
create index food_chats_seller on food_chats(seller_user_id,expires_at);
create index food_chats_expiry on food_chats(expires_at);
create table food_chat_messages (
 id uuid primary key default gen_random_uuid(),chat_id uuid not null references food_chats(id) on delete cascade,
 sender_id uuid not null references users(id),kind text not null check(kind in('text','image')),
 text text,bytes bytea,mime text,created_at timestamptz not null default now(),
 check((kind='text' and char_length(btrim(text)) between 1 and 1200 and bytes is null) or (kind='image' and text is null and bytes is not null and mime='image/webp'))
);
create index food_chat_messages_time on food_chat_messages(chat_id,created_at);
create function fit_food_message_guard() returns trigger language plpgsql as $$ begin
 if not exists(select 1 from food_chats where id=new.chat_id and new.sender_id in(buyer_id,seller_user_id) and expires_at>now()) then raise exception 'Conversación no disponible'; end if;
 return new;
end $$;
create trigger food_message_guard before insert on food_chat_messages for each row execute function fit_food_message_guard();
create trigger food_chats_audit after insert or update or delete on food_chats for each row execute function fit_audit_row();
create function fit_food_message_audit() returns trigger language plpgsql as $$ begin
 insert into audit_log(request_id,actor_id,action,entity,record_id,after_data)
 select nullif(current_setting('fit.request_id',true),''),new.sender_id,'MESSAGE','food_chat_messages',new.id::text,
 jsonb_build_object('chat_id',new.chat_id,'buyer_id',c.buyer_id,'seller_user_id',c.seller_user_id,'product_name',c.product_name,'business_name',c.business_name,'sender_id',new.sender_id,'kind',new.kind,'text',new.text,'image_bytes',octet_length(new.bytes)) from food_chats c where c.id=new.chat_id;
 return null;
end $$;
create trigger food_messages_audit after insert on food_chat_messages for each row execute function fit_food_message_audit();
revoke all on user_schedules,food_chats,food_chat_messages from public;
