'use strict';
const {AsyncLocalStorage}=require('node:async_hooks');
const {randomUUID}=require('node:crypto');
const context=new AsyncLocalStorage();
function auditedDb(pool){
 if(!pool)return pool;
 async function annotate(c){const req=context.getStore();await c.query("select set_config('fit.actor_id',$1,true),set_config('fit.request_id',$2,true)",[req?.user?.id||'',req?.auditId||'']);}
 return {
 async query(sql,params){
 if(!context.getStore() || /^\s*(select)\b/i.test(sql))return pool.query(sql,params);
 const c=await pool.connect();try{await c.query('begin');await annotate(c);const result=await c.query(sql,params);await c.query('commit');return result;}catch(e){await c.query('rollback');throw e;}finally{c.release();}
 },
 async connect(){const c=await pool.connect();return {release:()=>c.release(),async query(sql,params){const result=await c.query(sql,params);if(/^begin\b/i.test(sql.trim()))await annotate(c);return result;}};}
 };
}
function auditMiddleware(db){return (req,res,next)=>{
 req.auditId=randomUUID();res.set('X-Request-Id',req.auditId);
 context.run(req,async()=>{
 try{
 if(!['GET','HEAD','OPTIONS'].includes(req.method)){
 // No query strings, request bodies, credentials or raw location in the HTTP trail.
 await db.query("insert into audit_log(request_id,action,entity,record_id,after_data) values($1,'REQUEST','http',$2,$3)",[req.auditId,req.path.slice(0,180),JSON.stringify({method:req.method})]);
 res.on('finish',()=>db.query("insert into audit_log(request_id,actor_id,action,entity,record_id,after_data) values($1,$2,'RESPONSE','http',$3,$4)",[req.auditId,req.user?.id||null,req.path.slice(0,180),JSON.stringify({status:res.statusCode,code:res.locals.auditError||null})]).catch(()=>console.error('Audit response could not be persisted',{requestId:req.auditId})));
 }
 next();
 }catch(e){next(e);}
 });
 };}
module.exports={auditedDb,auditMiddleware};
