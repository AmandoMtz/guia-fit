'use strict';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MODES=['online','away','dnd','offline'];
function effectiveStatus(mode,seen,active,now=Date.now()) {
 if(mode==='offline'||!seen||now-new Date(seen).getTime()>90000)return 'offline';
 if(mode==='dnd'||mode==='away')return mode;
 return !active||now-new Date(active).getTime()>=600000?'away':'online';
}
function createPresenceRouter({db,limit}) {
 const router=require('express').Router();
 router.use(async(req,res,next)=>{await limit(req,'presence:'+req.user.id,180);res.set('Cache-Control','no-store');next();});
 router.post('/',async(req,res)=>{
  const {tab_id,idle_ms,mode}=req.body||{};
  if(!UUID.test(String(tab_id))||!Number.isFinite(idle_ms)||idle_ms<0||idle_ms>86400000||(mode!==undefined&&!MODES.includes(mode)))return res.status(400).json({error:{message:'Estado de conexión inválido.'}});
  if(mode!==undefined)await db.query('insert into user_presence_preferences(user_id,mode) values($1,$2) on conflict(user_id) do update set mode=excluded.mode',[req.user.id,mode]);
  await db.query(`insert into user_presence_sessions(session_hash,tab_id,user_id,seen_at,active_at) values($1,$2,$3,now(),now()-($4 * interval '1 millisecond')) on conflict(session_hash,tab_id) do update set seen_at=excluded.seen_at,active_at=excluded.active_at`,[req.sessionHash,tab_id,req.user.id,idle_ms]);
  await db.query("delete from user_presence_sessions where seen_at<now()-interval '1 day'");
  const row=(await db.query('select mode from user_presence_preferences where user_id=$1',[req.user.id])).rows[0];
  res.json({data:{mode:row?.mode||'online'}});
 });
 router.delete('/:tab',async(req,res)=>{
  if(!UUID.test(req.params.tab))return res.sendStatus(400);
  await db.query('delete from user_presence_sessions where session_hash=$1 and tab_id=$2',[req.sessionHash,req.params.tab]);res.json({data:{ok:true}});
 });
 router.get('/',async(req,res)=>{
  const ids=[...new Set(String(req.query.ids||'').split(',').filter(Boolean))];
  if(ids.length>100||ids.some(id=>!UUID.test(id)))return res.sendStatus(400);
  const rows=(await db.query(`select u.id,p.mode,max(h.seen_at) as seen,max(h.active_at) as active from users u
   left join user_presence_preferences p on p.user_id=u.id
   left join (select h.* from user_presence_sessions h join sessions s on s.token_hash=h.session_hash and s.expires_at>now() where h.seen_at>now()-interval '90 seconds') h on h.user_id=u.id
   where u.id=any($1::uuid[]) group by u.id,p.mode`,[ids])).rows;
  res.json({data:rows.map(row=>({id:row.id,status:effectiveStatus(row.mode,row.seen,row.active)}))});
 });
 return router;
}
module.exports={createPresenceRouter,effectiveStatus};
