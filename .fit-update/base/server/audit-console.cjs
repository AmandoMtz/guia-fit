"use strict";
const { Router } = require('express');
const groups = {
 schedules: ['user_schedules'],
 events: ['events','event_careers','event_teacher_invites','event_attendance','event_documents','event_checkin_tokens'],
 chats: ['academic_chats','academic_chat_messages','academic_chat_content','food_chats','food_chat_messages'],
 food: ['food_vendors','food_products','food_orders','fit_ratings'],
 rewards: ['fit_progress','fit_rewards','fit_inventory','admin_benefit_grants','fit_vendor_categories'],
 accounts: ['users','profiles','institutional_verifications','sessions','auth_tokens','profile_photos','attendance_devices'],
 notifications: ['notifications','fit_activity_notifications','fit_push_delivery_log','fit_push_subscriptions'],
 campus: ['places','route_edges','photos'],
 http: ['http']
};
function invalid() { return Object.assign(new Error('Revisa los filtros de búsqueda.'), {status:400,code:'validation_error'}); }
function createAuditRouter({db}) {
 const router=Router();
 router.get('/', async(req,res)=>{
  res.set('Cache-Control','no-store');
  const q=req.query; const values=[]; const where=[];
  if(q.technical!=='1'&&!q.group)where.push("a.entity not in ('http','sessions','auth_tokens','fit_push_subscriptions','fit_activity_notifications','fit_push_delivery_log','notifications','academic_chat_messages','event_checkin_tokens') and not (a.entity in ('academic_chats','food_chats') and a.action='UPDATE')");
  const add=(sql,value)=>{values.push(value);where.push(sql.replace('?', '$'+values.length));};
  if(q.group){if(!groups[q.group])throw invalid();add('a.entity = any(?::text[])',groups[q.group]);}
  if(q.action){if(!['INSERT','UPDATE','DELETE','MESSAGE','REQUEST','RESPONSE'].includes(q.action))throw invalid();add('a.action=?',q.action);}
  if(q.before){if(!/^[1-9][0-9]{0,18}$/.test(q.before)||BigInt(q.before)>9223372036854775807n)throw invalid();add('a.id < ?::bigint',q.before);}
  for(const key of ['from','to'])if(q[key]){
   if(typeof q[key]!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(q[key])||!Number.isFinite(Date.parse(q[key]))||new Date(q[key]).toISOString().slice(0,10)!==q[key])throw invalid();
   add(key==='from'?'a.created_at >= ?::date':"a.created_at < ?::date + interval '1 day'",q[key]);
  }
  if(q.from&&q.to&&q.from>q.to)throw invalid();
  if(q.search){if(typeof q.search!=='string'||q.search.length>150)throw invalid();
   values.push('%'+q.search.replace(/[\\%_]/g,'\\$&')+'%');const n='$'+values.length;
   where.push(`(coalesce(p.full_name,'') ilike ${n} or coalesce(u.email,'') ilike ${n} or coalesce(a.actor_id::text,'') ilike ${n} or coalesce(a.record_id,'') ilike ${n} or coalesce(a.after_data::text,'') ilike ${n} or coalesce(a.before_data::text,'') ilike ${n})`);
  }
  const result=await db.query(`select a.*,p.full_name as actor_name,u.email as actor_email,u.role as actor_role
   from audit_log a left join users u on u.id=a.actor_id left join profiles p on p.id=a.actor_id
   ${where.length?'where '+where.join(' and '):''} order by a.id desc limit 51`,values);
  const rows=result.rows.slice(0,50);
  res.json({data:{items:rows,next:result.rows.length>50?String(rows.at(-1).id):null}});
 });
 return router;
}
module.exports={createAuditRouter};
