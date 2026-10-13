'use strict';
const {createHash}=require('node:crypto');
// Campus time is independent of the server/device timezone. No guessed UTC offset.
function campusClock(now) {
 const parts=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:'America/Mexico_City',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23',weekday:'short'}).formatToParts(now).map(x=>[x.type,x.value]));
 return {date:`${parts.year}-${parts.month}-${parts.day}`,day:['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].indexOf(parts.weekday)+1,minute:Number(parts.hour)*60+Number(parts.minute)};
}
function dueClasses(data,clock) {
 return (Array.isArray(data?.classes)?data.classes:[]).filter(c=>{
  if(Number(c.day)!==clock.day || !/^([01]\d|2[0-3]):[0-5]\d$/.test(c.start) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(c.end))return false;
  const minutes=t=>Number(t.slice(0,2))*60+Number(t.slice(3));
  const start=minutes(c.start),end=minutes(c.end);
  // Catch up only during the first five minutes, never notify a finished class.
  return !!c.subject && clock.minute>=start && clock.minute<Math.min(end,start+5);
 });
}
async function queueClassReminders(db) {
 const now=(await db.query('select now() as now')).rows[0].now;
 const clock=campusClock(new Date(now));
 const rows=(await db.query(`select s.user_id,s.data from user_schedules s
 join users u on u.id=s.user_id left join fit_push_preferences p on p.user_id=s.user_id
 where s.data is not null and coalesce(p.class_reminders,true)
 and u.email ~* '^a[0-9]+@alumnos\\.uat\\.edu\\.mx$'`)).rows;
 for(const row of rows)for(const c of dueClasses(row.data,clock)) {
  // Logical identity survives reimporting the same sheet with new random ids.
  const key=createHash('sha256').update(JSON.stringify([c.day,c.start,c.subject,c.classroom||''])).digest('hex');
  await db.query(`with claimed as (
   insert into fit_class_notice_keys(user_id,class_key,class_date) values($1,$2,$3)
   on conflict do nothing returning user_id
  ), notice as (
   insert into fit_activity_notifications(user_id,kind,title,body,view_name)
   select user_id,'class_start','Tu clase está comenzando',$4,'schedule' from claimed returning id
  ) select id from notice`,[row.user_id,key,clock.date,`${c.subject} · ${c.start}–${c.end}${c.classroom?' · Salón '+c.classroom:''}. Consulta tu horario.`]);
 }
 // The trigger queues notices; cap TTL so an offline phone cannot see yesterday's class.
 await db.query(`update fit_push_outbox o set expires_at=least(o.expires_at,n.created_at+interval '5 minutes')
 from fit_activity_notifications n where n.id=o.id and n.kind='class_start'`);
 await db.query("delete from fit_class_notice_keys where class_date < current_date - 14");
}
module.exports={campusClock,dueClasses,queueClassReminders};
