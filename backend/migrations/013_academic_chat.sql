-- Chat persistente entre alumnos y docentes. Los mensajes visibles duran 7 días.
create table academic_chats (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references users(id) on delete cascade,
  teacher_id uuid not null references users(id) on delete cascade,
  student_read_at timestamptz not null default now(),
  teacher_read_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check(student_id <> teacher_id),
  unique(student_id, teacher_id)
);

create table academic_chat_messages (
  id uuid primary key default gen_random_uuid(),
  chat_id uuid not null references academic_chats(id) on delete cascade,
  sender_id uuid not null references users(id) on delete cascade,
  body text not null check(char_length(btrim(body)) between 1 and 1500 and body !~ '[[:cntrl:]]'),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '7 days',
  check(expires_at > created_at)
);

create index academic_chats_student_updated on academic_chats(student_id, updated_at desc);
create index academic_chats_teacher_updated on academic_chats(teacher_id, updated_at desc);
create index academic_chat_messages_chat_time on academic_chat_messages(chat_id, created_at desc);
create index academic_chat_messages_expiry on academic_chat_messages(expires_at);

create function fit_academic_message_guard() returns trigger language plpgsql as $$
begin
  if not exists (
    select 1 from academic_chats c
    where c.id=new.chat_id and new.sender_id in (c.student_id,c.teacher_id)
  ) then
    raise exception 'El remitente no pertenece a la conversación';
  end if;
  return new;
end $$;
create trigger academic_message_guard before insert on academic_chat_messages for each row execute function fit_academic_message_guard();

create function fit_academic_chat_touch() returns trigger language plpgsql as $$
begin
  update academic_chats set updated_at=new.created_at where id=new.chat_id;
  return null;
end $$;
create trigger academic_chat_touch after insert on academic_chat_messages for each row execute function fit_academic_chat_touch();

create trigger academic_messages_audit after insert or update or delete on academic_chat_messages for each row execute function fit_audit_row();

revoke all on academic_chats, academic_chat_messages from public;
