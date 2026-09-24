const {Router}=require('express');
const fail=(status,message)=>Object.assign(new Error(message),{status,code:status===409?'conflict':'validation_error'});
function clean(value,userId){
 if(!value||value.userId!==userId||!Array.isArray(value.classes)||value.classes.length>120)throw fail(400,'Horario inválido o de otra cuenta.');
 const out={userId,version:2};
 for(const key of ['career','studentId','studentName','reviewedAt','accountType']){
  if(value[key]!=null&&typeof value[key]!=='string')throw fail(400,'Datos del horario inválidos.');
  out[key]=String(value[key]||'').slice(0,240);
 }
 out.classes=value.classes.map(row=>{
  if(!row||typeof row!=='object')throw fail(400,'Clase inválida.');
  const c={};for(const key of ['id','subject','teacher','classroom','group','day','start','end','place_id']){
   if(row[key]!=null&&!['string','number'].includes(typeof row[key]))throw fail(400,'Clase inválida.');
   c[key]=typeof row[key]==='number'?row[key]:row[key]==null?null:String(row[key]).slice(0,240);
  }return c;
 });return out;
}
function createScheduleRouter({db}){
 const r=Router();
 r.get('/',async(req,res)=>{res.set('Cache-Control','private, no-store');const row=(await db.query('select data,revision,updated_at from user_schedules where user_id=$1',[req.user.id])).rows[0];res.json({data:row||{data:null,revision:0,updated_at:null}});});
 for(const method of ['put','delete'])r[method]('/',async(req,res)=>{
  const revision=req.body?.revision;if(!Number.isSafeInteger(revision)||revision<0)throw fail(400,'Actualiza el horario antes de guardar.');
  const data=method==='put'?clean(req.body.data,req.user.id):null;
  const row=(await db.query(`insert into user_schedules(user_id,data) select $1,$2::jsonb where $3=0
    on conflict(user_id) do update set data=excluded.data,revision=user_schedules.revision+1,updated_at=now() where user_schedules.revision=$3 returning revision,updated_at`,[req.user.id,JSON.stringify(data),revision])).rows[0];
  // Para actualizaciones con una revisión existente no se usa la rama INSERT.
  if(row)return res.json({data:row});
  if(revision>0){const changed=(await db.query('update user_schedules set data=$2::jsonb,revision=revision+1,updated_at=now() where user_id=$1 and revision=$3 returning revision,updated_at',[req.user.id,JSON.stringify(data),revision])).rows[0];if(changed)return res.json({data:changed});}
  throw fail(409,'El horario cambió en otro dispositivo. Actualiza antes de continuar.');
 });return r;
}
module.exports={createScheduleRouter};
