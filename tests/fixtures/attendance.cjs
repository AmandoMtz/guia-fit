const {generateKeyPairSync,sign}=require('node:crypto');
const geo={latitude:22.277,longitude:-97.865,radius_m:100,max_accuracy_m:30};
async function enroll(call,who,admin){
 const key=generateKeyPairSync('ec',{namedCurve:'prime256v1'});
 const d=(await call(who,'post','/api/attendance-security/device').send({public_key:key.publicKey.export({format:'jwk'}),label:'Prueba'}).expect(200)).body.data;
 await call(admin,'patch','/api/attendance-security/devices/'+d.id).send({status:'approved',reason:'Credencial verificada presencialmente'}).expect(200);
 return {...key,id:d.id};
}
async function proof(call,who,key,token,overrides={}){
 const challenge=(await call(who,'post','/api/attendance-security/challenge').send({device_id:key.id,token}).expect(200)).body.data;
 const location={latitude:geo.latitude,longitude:geo.longitude,accuracy:5,timestamp:Date.now(),...overrides};
 const l=location,message=JSON.stringify([challenge.nonce,who.id,token,l.latitude,l.longitude,l.accuracy,l.timestamp]);
 return {token,location,proof:{challenge_id:challenge.id,signature:sign('sha256',Buffer.from(message),{key:key.privateKey,dsaEncoding:'ieee-p1363'}).toString('base64url')}};
}
module.exports={geo,enroll,proof};
