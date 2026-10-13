'use strict';
// Optional standalone process for a host that runs continuously.
const {createPool}=require('./db.cjs');
const {migrate}=require('./migrate.cjs');
const {createPushService}=require('./push.cjs');
(async()=>{
 const db=createPool();
 if(!db)throw Error('Configura DATABASE_URL.');
 const siteUrl=process.env.SITE_URL;
 if(!siteUrl||new URL(siteUrl).protocol!=='https:')throw Error('SITE_URL debe ser la dirección HTTPS pública de Guía FIT.');
 if(process.env.AUTO_MIGRATE!=='false')await migrate(db);
 const push=createPushService({db,siteUrl});
 push.start({keepAlive:true});
 await push.run();
 console.log('Proceso de notificaciones activo. Zona de clases: America/Mexico_City.');
 let closing=false;
 const stop=async()=>{if(closing)return;closing=true;push.stop();await db.end();};
 process.on('SIGTERM',stop);process.on('SIGINT',stop);
})().catch(e=>{console.error('No se pudo iniciar el proceso de notificaciones:',e.message);process.exit(1);});
