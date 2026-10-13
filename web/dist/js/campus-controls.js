/* Controles de recorrido: joystick y orientación del celular. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.FIT_CAMPUS_CONTROLS=api;})(typeof window!=='undefined'?window:globalThis,function(){
 'use strict';
 const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
 const angle=v=>Math.atan2(Math.sin(v),Math.cos(v));
 function joystick(dx,dy,radius){const n=Math.hypot(dx,dy)/radius;if(n<.12)return {side:0,forward:0};const gain=Math.min(1,(n-.12)/.88);return {side:dx/(n*radius)*gain,forward:-dy/(n*radius)*gain};}
 // Camera forward vector from intrinsic Z-X-Y orientation; optical axis is
 // invariant to portrait/landscape screen rotation (no compass required).
 function orientation(a,b,g){if(![a,b,g].every(Number.isFinite))return null;const r=Math.PI/180,A=a*r,B=b*r,G=g*r;
  const x=-Math.cos(A)*Math.sin(G)-Math.sin(A)*Math.sin(B)*Math.cos(G),y=-Math.sin(A)*Math.sin(G)+Math.cos(A)*Math.sin(B)*Math.cos(G),z=-Math.cos(B)*Math.cos(G);
  if(Math.hypot(x,y)<.08)return null;return {yaw:Math.atan2(x,y),elevation:Math.asin(clamp(z,-1,1))};
 }
 function mount(host,campus){
  let section=null,api=null,pointer=null,vector={side:0,forward:0},raf=0,last=0,gyro=false,gyroToken=0,gyroBase=null,lastLook=null,sensorTimer=0,dead=false;
  const q=s=>campus.querySelector(s),message=t=>{const e=q('[data-input-status]');if(e)e.textContent=t;};
  function stopJoystick(){pointer=null;vector={side:0,forward:0};if(raf)cancelAnimationFrame(raf);raf=0;const knob=q('.cm-joystick-knob');if(knob)knob.style.transform='translate(0px,0px)';}
  function tick(t){if(dead||!section?.isConnected||document.hidden){stopJoystick();return;}const dt=Math.min(.04,(t-last)/1000);last=t;api?.walk(vector.side,vector.forward,dt);raf=requestAnimationFrame(tick);}
  function stick(e){const pad=e.currentTarget,r=pad.getBoundingClientRect(),radius=Math.min(r.width,r.height)*.34,dx=e.clientX-r.left-r.width/2,dy=e.clientY-r.top-r.height/2;vector=joystick(dx,dy,radius);const n=Math.max(1,Math.hypot(dx,dy)/radius);pad.querySelector('.cm-joystick-knob').style.transform=`translate(${dx/n}px,${dy/n}px)`;}
  function stopGyro(){gyroToken++;gyro=false;gyroBase=null;lastLook=null;clearTimeout(sensorTimer);window.removeEventListener('deviceorientation',sensor);const b=q('[data-gyro]');if(b){b.setAttribute('aria-pressed','false');b.textContent='Activar giro del celular';}}
  function sensor(e){if(!gyro||document.hidden)return;const pose=orientation(e.alpha,e.beta,e.gamma);if(!pose)return;
   clearTimeout(sensorTimer);if(!gyroBase){gyroBase={sensor:pose,view:api.getPose()};lastLook={yaw:gyroBase.view.yaw,elevation:gyroBase.view.elevation};}
   const target=gyroBase.view.yaw+angle(pose.yaw-gyroBase.sensor.yaw),elevation=clamp(gyroBase.view.elevation+pose.elevation-gyroBase.sensor.elevation,-.65,.65);
   lastLook.yaw+=angle(target-lastLook.yaw)*.35;lastLook.elevation+=(elevation-lastLook.elevation)*.35;api.look(lastLook.yaw,lastLook.elevation);message('Giro activo · mueve el celular para mirar; joystick para caminar.');
  }
  async function enableGyro(){if(gyro||!api)return;const token=++gyroToken;
   if(!window.isSecureContext||!window.DeviceOrientationEvent){message('Giro no disponible aquí. Puedes arrastrar para mirar.');return;}
   try {const E=window.DeviceOrientationEvent;if(typeof E.requestPermission==='function'&&await E.requestPermission()!=='granted')throw Error('permission');if(dead||token!==gyroToken)return;
    gyro=true;gyroBase=null;window.addEventListener('deviceorientation',sensor);const b=q('[data-gyro]');b?.setAttribute('aria-pressed','true');if(b)b.textContent='Desactivar giro';message('Mueve suavemente el teléfono…');
    sensorTimer=setTimeout(()=>{if(gyro){stopGyro();message('No se recibieron datos del sensor. Usa arrastre o vuelve a activar el giro.');}},4500);
   }catch{message('Permiso de movimiento denegado. Puedes usar el joystick y arrastrar para mirar.');}
  }
  function recalibrate(){gyroBase=null;lastLook=null;message('Mirada recentrada.');}
  function attach(){stopJoystick();stopGyro();section=q('.cm-interior');api=q('.cm-walk')?.cmWalk;if(!section||!api)return;section.classList.add('cm-has-joystick');
   section.insertAdjacentHTML('beforeend','<div class="cm-mobile-controls"><div class="cm-joystick" tabindex="0" role="group" aria-label="Joystick: arrastra para caminar, o usa las flechas del teclado"><span class="cm-joystick-knob"></span></div><div class="cm-look-actions"><button type="button" data-gyro aria-pressed="false">Activar giro del celular</button><button type="button" data-recenter>Recentrar mirada</button><small>Joystick: caminar · arrastra la vista: mirar</small></div></div><p data-input-status role="status">Explora con el joystick o con WASD.</p>');
   const pad=q('.cm-joystick');pad.onpointerdown=e=>{if(pointer!==null)return;e.preventDefault();pointer=e.pointerId;pad.setPointerCapture(pointer);stick(e);last=performance.now();raf=requestAnimationFrame(tick);};pad.onpointermove=e=>{if(pointer===e.pointerId)stick(e);};pad.onpointerup=pad.onpointercancel=pad.onlostpointercapture=stopJoystick;
   pad.onkeydown=e=>{const v={ArrowUp:[0,1],ArrowDown:[0,-1],ArrowLeft:[-1,0],ArrowRight:[1,0]}[e.key];if(v){e.preventDefault();api.walk(...v,.08);}};
   const canvas=q('.cm-walk');canvas.addEventListener('pointerdown',()=>{if(gyro){stopGyro();message('Mirada manual. Puedes volver a activar el giro del celular.');}});
  }
  function click(e){if(e.target.closest('[data-room]')){gyroBase=null;lastLook=null;}if(e.target.closest('[data-gyro]')){gyro?stopGyro():enableGyro();}if(e.target.closest('[data-recenter]'))recalibrate();}

  const pause=()=>{stopJoystick();stopGyro();};const hidden=()=>{if(document.hidden){pause();}};
  campus.addEventListener('click',click);window.addEventListener('blur',pause);document.addEventListener('visibilitychange',hidden);
  return {attach,enableGyro,stop(){pause();},destroy(){dead=true;pause();campus.removeEventListener('click',click);window.removeEventListener('blur',pause);document.removeEventListener('visibilitychange',hidden);}};
 }
 return {mount,orientation,joystick,angle};
});
