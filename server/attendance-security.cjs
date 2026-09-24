'use strict';
const {createPublicKey,createHash,verify,randomBytes}=require('node:crypto');
const {transaction}=require('./db.cjs');
const {hashToken}=require('./security.cjs');
const fail=(code,message,status=403)=>Object.assign(new Error(message),{status,code});
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
function geoConfig(body){
 const fields=['latitude','longitude','radius_m','max_accuracy_m'];
 const n=fields.map(k=>typeof body[k]==='number'?body[k]:NaN);
 if(!n.every(Number.isFinite)||Math.abs(n[0])>90||Math.abs(n[1])>180||!Number.isInteger(n[2])||n[2]<10||n[2]>1000||!Number.isInteger(n[3])||n[3]<1||n[3]>200||n[3]>n[2])throw fail('invalid_geofence','Configura coordenadas válidas, radio de 10 a 1000 m y precisión máxima de 1 a 200 m, no mayor al radio.',400);
 return Object.fromEntries(fields.map((k,i)=>[k,n[i]]));
}
function checkLocation(event,location,now=Date.now()){
 if(event.latitude==null||event.longitude==null)throw fail('geofence_missing','El organizador debe configurar el área del evento.');
 if(!location||!['latitude','longitude','accuracy','timestamp'].every(k=>typeof location[k]==='number'&&Number.isFinite(location[k]))||Math.abs(location.latitude)>90||Math.abs(location.longitude)>180||location.accuracy<=0)throw fail('location_required','Se requiere una ubicación válida para registrar asistencia.');
 if(now-location.timestamp>30000||location.timestamp-now>5000)throw fail('location_stale','La ubicación venció. Vuelve a intentarlo.');
 if(location.accuracy>event.max_accuracy_m)throw fail('location_inaccurate','La ubicación no tiene suficiente precisión. Activa ubicación precisa y vuelve a intentarlo.');
 const rad=x=>x*Math.PI/180, a=rad(event.latitude), b=rad(location.latitude);
 const h=Math.sin((b-a)/2)**2+Math.cos(a)*Math.cos(b)*Math.sin(rad(location.longitude-event.longitude)/2)**2;
 const distance=6371000*2*Math.asin(Math.sqrt(Math.min(1,h)));
 // Conservative boundary: the entire reported accuracy circle must fit inside.
 if(distance+location.accuracy>event.radius_m)throw fail('outside_area','Tu ubicación no queda completamente dentro del área permitida. Acércate al recinto y vuelve a intentarlo.');
 return {distance,accuracy:location.accuracy};
}
function canonicalKey(value){
 try{
 if(value?.kty!=='EC'||value.crv!=='P-256'||value.d||typeof value.x!=='string'||typeof value.y!=='string')throw Error();
 const key=createPublicKey({key:{kty:'EC',crv:'P-256',x:value.x,y:value.y},format:'jwk'});
 const jwk=key.export({format:'jwk'});return {jwk,fingerprint:createHash('sha256').update(key.export({format:'der',type:'spki'})).digest('hex')};
 }catch{throw fail('invalid_device','Clave del dispositivo no válida.',400);}
}
function securityRouter({db,limit}){
 const r=require('express').Router();
 r.use(async(req,res,next)=>{await limit(req,'attendance-security:'+req.user.id,req.user.role==='admin'?600:40);next();});
 r.get('/device',async(req,res)=>res.json({data:(await db.query('select id,label,status,created_at,reviewed_at,reason from attendance_devices where user_id=$1 order by created_at desc',[req.user.id])).rows}));
 r.post('/device',async(req,res)=>{
 const {jwk,fingerprint}=canonicalKey(req.body?.public_key);
 const label=String(req.body?.label||'Mi dispositivo').trim().slice(0,80);
 const result=await transaction(db,async c=>{
 await c.query('select pg_advisory_xact_lock(hashtext($1))',['attendance:'+req.user.id]);
 const existing=(await c.query('select id,user_id,status from attendance_devices where fingerprint=$1',[fingerprint])).rows[0];
 if(existing){if(existing.user_id!==req.user.id)throw fail('device_other_account','Este navegador ya está vinculado a otra cuenta.');return existing;}
 const n=(await c.query("select count(*)::int n from attendance_devices where user_id=$1 and status='pending'",[req.user.id])).rows[0].n;
 if(n>=3)throw fail('device_pending','Ya tienes solicitudes pendientes. Consulta a administración.');
 return (await c.query('insert into attendance_devices(user_id,fingerprint,public_key,label) values($1,$2,$3,$4) returning id,status',[req.user.id,fingerprint,JSON.stringify(jwk),label])).rows[0];
 });res.json({data:{id:result.id,status:result.status}});
 });
 r.post('/challenge',async(req,res)=>{
 if(!UUID.test(req.body?.device_id||'')||!/^[-\w]{16,80}$/.test(req.body?.token||''))throw fail('invalid_challenge','Datos de verificación no válidos.',400);
 await db.query('delete from attendance_challenges where expires_at<now()');
 const device=(await db.query("select id from attendance_devices where id=$1 and user_id=$2 and status='approved'",[req.body.device_id,req.user.id])).rows[0];
 if(!device)throw fail('device_unapproved','Solicita la autorización de este dispositivo en Mi cuenta.');
 const row=(await db.query('insert into attendance_challenges(user_id,device_id,token_hash,nonce) values($1,$2,$3,$4) returning id,nonce',[req.user.id,device.id,hashToken(req.body.token),randomBytes(32).toString('base64url')])).rows[0];
 res.json({data:row});
 });
 r.use((req,res,next)=>req.user.role==='admin'?next():next(fail('forbidden','Solo administración puede consultar este panel.')));
 r.get('/devices',async(req,res)=>res.json({data:(await db.query(`select d.id,d.label,d.status,d.created_at,d.reason,p.full_name,u.email from attendance_devices d join users u on u.id=d.user_id join profiles p on p.id=d.user_id order by d.created_at desc limit 300`)).rows}));
 r.patch('/devices/:id',async(req,res)=>{
 const status=req.body?.status,reason=String(req.body?.reason||'').trim();
 if(!UUID.test(req.params.id)||!['approved','revoked'].includes(status)||reason.length<8||reason.length>500)throw fail('validation_error','Indica aprobar/revocar y un motivo de 8 a 500 caracteres.',400);
 await transaction(db,async c=>{
 // Serialize all approvals, including replacement and simultaneous reviews.
 await c.query('select pg_advisory_xact_lock(946211)');
 const d=(await c.query('select * from attendance_devices where id=$1 for update',[req.params.id])).rows[0];
 if(!d)throw fail('not_found','Dispositivo no encontrado.',404);
 if(status==='approved')await c.query("update attendance_devices set status='revoked',reviewed_by=$2,reviewed_at=now(),reason=$3 where user_id=$1 and status='approved' and id<>$4",[d.user_id,req.user.id,'Sustituido: '+reason,d.id]);
 await c.query('update attendance_devices set status=$2,reviewed_by=$3,reviewed_at=now(),reason=$4 where id=$1',[d.id,status,req.user.id,reason]);
 });res.json({data:{status}});
 });
 r.get('/audit',async(req,res)=>{
 const before=String(req.query.before||'9223372036854775807'),entity=String(req.query.entity||'').slice(0,80);
 if(!/^\d{1,19}$/.test(before)||BigInt(before)>9223372036854775807n)throw fail('validation_error','Cursor inválido.',400);
 const rows=(await db.query("select * from audit_log where id<$1::bigint and ($2='' or entity=$2) order by id desc limit 100",[before,entity])).rows;
 res.json({data:rows,next:rows.length===100?String(rows.at(-1).id):null});
 });return r;
}
async function secureCheckin(db,req,event,token){
 checkLocation(event,req.body.location);
 const proof=req.body.proof;
 if(!proof||!UUID.test(proof.challenge_id||'')||typeof proof.signature!=='string'||!/^[\w-]{86}$/.test(proof.signature))throw fail('device_proof_required','Verifica la asistencia desde tu dispositivo autorizado.');
 return transaction(db,async c=>{
 // Recheck QR, schedule and geofence under row lock to prevent concurrent edits.
 const current=(await c.query(`select e.* from events e join event_checkin_tokens t on t.event_id=e.id where e.id=$1 and t.token_hash=$2 and t.expires_at>now() and now() between e.starts_at and e.ends_at for update of e,t`,[event.id,hashToken(token)])).rows[0];
 if(!current)throw fail('checkin_closed','El evento no está dentro del horario de registro o el QR venció.');
 const checked=checkLocation(current,req.body.location);
 // Target/audience changes invalidate the token in the event editor.
 const challenge=(await c.query(`select c.*,d.public_key from attendance_challenges c join attendance_devices d on d.id=c.device_id where c.id=$1 and c.user_id=$2 and c.token_hash=$3 and c.expires_at>now() and d.user_id=$2 and d.status='approved' for update of c,d`,[proof.challenge_id,req.user.id,hashToken(token)])).rows[0];
 if(!challenge)throw fail('challenge_expired','Verificación vencida, utilizada o dispositivo no autorizado.');
 const l=req.body.location;
 const message=JSON.stringify([challenge.nonce,req.user.id,token,l.latitude,l.longitude,l.accuracy,l.timestamp]);
 const key=createPublicKey({key:challenge.public_key,format:'jwk'});
 if(!verify('sha256',Buffer.from(message),{key,dsaEncoding:'ieee-p1363'},Buffer.from(proof.signature,'base64url')))throw fail('invalid_signature','El dispositivo no pudo verificar esta asistencia.');
 await c.query('delete from attendance_challenges where id=$1',[challenge.id]);
 return c.query('insert into event_attendance(event_id,user_id,device_id,distance_m,accuracy_m) values($1,$2,$3,$4,$5) on conflict(event_id,user_id) do nothing returning checked_in_at',[event.id,req.user.id,challenge.device_id,checked.distance,checked.accuracy]);
 });
}
module.exports={securityRouter,geoConfig,checkLocation,canonicalKey,secureCheckin};
