-- Duración configurable y revalidación del QR de eventos.
alter table event_checkin_tokens
  add column duration_hours integer not null default 6
  check(duration_hours between 1 and 168);
