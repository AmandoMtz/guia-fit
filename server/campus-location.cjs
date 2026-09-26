const {Router}=require('express');
const targets=['edificio-b','edificio-c','posgrado','administrativo','cafeteria','laboratorios','administracion-posgrado'];
const fail=(status,message)=>Object.assign(new Error(message),{status,code:'campus_location'});
function createCampusLocationRouter({db,administrator,limit}){
 const r=Router();
 r.get('/',async(req,res)=>res.json({data:(await db.query('select id,latitude,longitude,accuracy,updated_at from fit_campus_locations order by id')).rows}));
 r.put('/:id',administrator,async(req,res)=>{
  await limit(req,'campus-location:'+req.user.id,30);
  const b=req.body||{}, {latitude,longitude,accuracy}=b;
  if(!targets.includes(req.params.id)||Object.keys(b).some(k=>!['latitude','longitude','accuracy'].includes(k))||![latitude,longitude,accuracy].every(Number.isFinite)||accuracy<=0||accuracy>25||Math.abs(latitude-22.277055)>.014||Math.abs(longitude+97.864674)>.014)throw fail(400,'Registra un acceso dentro del campus con precisión GPS de 25 m o mejor.');
  const row=(await db.query('insert into fit_campus_locations(id,latitude,longitude,accuracy,updated_by) values($1,$2,$3,$4,$5) on conflict(id) do update set latitude=excluded.latitude,longitude=excluded.longitude,accuracy=excluded.accuracy,updated_by=excluded.updated_by,updated_at=now() returning id,latitude,longitude,accuracy,updated_at',[req.params.id,latitude,longitude,accuracy,req.user.id])).rows[0];
  res.json({data:row});
 });
 return r;
}
module.exports={createCampusLocationRouter};
