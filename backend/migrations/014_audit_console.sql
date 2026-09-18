create index audit_log_entity_time on audit_log(entity,id desc);
create index audit_log_created on audit_log(created_at,id desc);
create trigger academic_chats_audit after insert or update or delete on academic_chats for each row execute function fit_audit_row();
create function fit_audit_academic_text() returns trigger language plpgsql as $$
begin
 insert into audit_log(request_id,actor_id,action,entity,record_id,after_data)
 select nullif(current_setting('fit.request_id',true),''),new.sender_id,'MESSAGE','academic_chat_content',new.id::text,
 jsonb_build_object('chat_id',new.chat_id,'sender_id',new.sender_id,'student_id',c.student_id,'teacher_id',c.teacher_id,'body',new.body,'expires_at',new.expires_at)
 from academic_chats c where c.id=new.chat_id;
 return null;
end $$;
create trigger academic_text_audit after insert on academic_chat_messages for each row execute function fit_audit_academic_text();
