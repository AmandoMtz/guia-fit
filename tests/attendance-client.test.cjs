const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {JSDOM}=require('jsdom'),{indexedDB}=require('fake-indexeddb'),{webcrypto,createPublicKey,verify}=require('node:crypto');
test('navegador: clave no exportable persistente y firma de cuenta, QR y ubicación',async t=>{
 const dom=new JSDOM('<main id="view"></main>',{url:'https://fit.example.test',runScripts:'outside-only'}),w=dom.window;t.after(()=>w.close());
 Object.defineProperty(w,'crypto',{value:webcrypto});w.indexedDB=indexedDB;w.isSecureContext=true;w.TextEncoder=TextEncoder;
 Object.defineProperty(w.navigator,'geolocation',{value:{getCurrentPosition(ok){ok({coords:{latitude:22,longitude:-97,accuracy:5},timestamp:Date.now()});}}});
 const enrolled=[],user='11111111-1111-4111-8111-111111111111',token='test_token_abcdefghijklmn',nonce='server_random_nonce';
 const c={state:{user:{id:user}},client:{async request(url,method,body){if(url.endsWith('/device')){enrolled.push(body.public_key);return {data:{id:'device',status:'approved'}};}return {data:{id:'challenge',nonce}};}}};
 w.eval(fs.readFileSync(path.join(__dirname,'../web/dist/js/attendance-security.js'),'utf8'));
 const p=await w.FIT_ATTENDANCE.checkin(c,token);const l=p.location;
 assert.ok(verify('sha256',Buffer.from(JSON.stringify([nonce,user,token,l.latitude,l.longitude,l.accuracy,l.timestamp])),{key:createPublicKey({key:enrolled[0],format:'jwk'}),dsaEncoding:'ieee-p1363'},Buffer.from(p.proof.signature,'base64url')));
 await w.FIT_ATTENDANCE.checkin(c,token);assert.deepEqual(enrolled[0],enrolled[1]);
 const db=await new Promise(r=>{const req=indexedDB.open('fit-attendance-key');req.onsuccess=()=>r(req.result);});
 const key=await new Promise(r=>{const req=db.transaction('keys').objectStore('keys').get('primary');req.onsuccess=()=>r(req.result);});
 assert.equal(key.privateKey.extractable,false);await assert.rejects(webcrypto.subtle.exportKey('jwk',key.privateKey));db.close();
});
