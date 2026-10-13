/* Controles de recorrido: joystick, orientación y seguimiento relativo WebXR. */
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
 function trackedPose(p,base,anchor){const dx=p.x-base.x,dz=p.z-base.z,delta=anchor.yaw-base.yaw;
  // WebXR looks along -Z. Model looks along +Z.
  return {x:anchor.x+dx*Math.cos(delta)-dz*Math.sin(delta),z:anchor.z-dx*Math.sin(delta)-dz*Math.cos(delta),yaw:anchor.yaw+angle(p.yaw-base.yaw),elevation:p.elevation};
 }
 function xrPose(transform){const m=transform.matrix,p=transform.position;return {x:p.x,z:p.z,yaw:Math.atan2(-m[8],m[10]),elevation:Math.asin(clamp(-m[9],-1,1))};}
 function mount(host,campus){
  let section=null,api=null,pointer=null,vector={side:0,forward:0},raf=0,last=0,gyro=false,gyroToken=0,gyroBase=null,lastLook=null,sensorTimer=0,dead=false;
  let session=null,xrStarting=false,xrToken=0,xrFrame=0,base=null,anchor=null,xrSpace=null,gl=null,trackingLost=false;
  const q=s=>campus.querySelector(s),message=t=>{const e=q('[data-input-status]');if(e)e.textContent=t;};
  const arMessage=t=>{const e=q('[data-ar-status]');if(e)e.textContent=t;};
  function stopJoystick(){pointer=null;vector={side:0,forward:0};if(raf)cancelAnimationFrame(raf);raf=0;const knob=q('.cm-joystick-knob');if(knob)knob.style.transform='translate(0px,0px)';}
  function tick(t){if(dead||!section?.isConnected||document.hidden){stopJoystick();return;}const dt=Math.min(.04,(t-last)/1000);last=t;api?.walk(vector.side,vector.forward,dt);raf=requestAnimationFrame(tick);}
  function stick(e){const pad=e.currentTarget,r=pad.getBoundingClientRect(),radius=Math.min(r.width,r.height)*.34,dx=e.clientX-r.left-r.width/2,dy=e.clientY-r.top-r.height/2;vector=joystick(dx,dy,radius);const n=Math.max(1,Math.hypot(dx,dy)/radius);pad.querySelector('.cm-joystick-knob').style.transform=`translate(${dx/n}px,${dy/n}px)`;}
  function stopGyro(){gyroToken++;gyro=false;gyroBase=null;lastLook=null;clearTimeout(sensorTimer);window.removeEventListener('deviceorientation',sensor);const b=q('[data-gyro]');if(b){b.setAttribute('aria-pressed','false');b.textContent='Activar giro del celular';}}
  function sensor(e){if(!gyro||session||document.hidden)return;const pose=orientation(e.alpha,e.beta,e.gamma);if(!pose)return;
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
  function recalibrate(){gyroBase=null;lastLook=null;if(session){base=null;anchor=api?.getPose();arMessage('Realinea el teléfono con la vista inicial y pulsa Confirmar origen.');q('[data-ar-confirm]').hidden=false;}else message('Mirada recentrada.');}
  function miniMap(){const canvas=q('[data-ar-map]');if(!canvas||!api)return;const ctx=canvas.getContext('2d');if(!ctx)return;const p=api.getPose();ctx.clearRect(0,0,320,220);ctx.fillStyle='#fff6f6';ctx.fillRect(0,0,320,220);ctx.fillStyle='#a81d2e';ctx.font='bold 15px sans-serif';
   let px,pz;if(p.campus){ctx.fillRect(45,35,22,130);ctx.fillRect(235,35,22,130);ctx.fillRect(100,184,115,16);ctx.fillStyle='#4d1020';ctx.fillText('B',49,25);ctx.fillText('C',239,25);ctx.fillText('Cafetería',117,215);ctx.strokeStyle='#c78585';ctx.strokeRect(67,30,168,142);px=56+p.x*5.94;pz=35+p.z*1.3;}else{ctx.strokeStyle='#c78585';ctx.strokeRect(125,25,70,160);ctx.fillText('Pasillo ilustrativo',90,18);px=160+p.x*8;pz=30+p.z*2;}
   if(px<8||px>312||pz<8||pz>212){arMessage('Fuera del esquema. Detén AR y vuelve a elegir tu origen.');}
   ctx.save();ctx.translate(clamp(px,9,311),clamp(pz,9,211));ctx.rotate(-p.yaw);ctx.fillStyle='#ed0018';ctx.strokeStyle='#fff';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(0,12);ctx.lineTo(-8,-7);ctx.lineTo(0,-3);ctx.lineTo(8,-7);ctx.closePath();ctx.fill();ctx.stroke();ctx.restore();
  }
  function releaseXR(){const panel=q('.cm-camera-panel');if(panel)delete panel.dataset.confirmOrigin;session=null;xrStarting=false;base=null;xrSpace=null;trackingLost=false;if(gl){gl.getExtension('WEBGL_lose_context')?.loseContext();gl=null;}campus.classList.remove('cm-ar-active');const b=q('[data-ar-start]');if(b)b.disabled=false;const c=q('[data-ar-confirm]');if(c)c.hidden=true;}
  function stopAR(){xrToken++;if(session){const current=session;session=null;if(xrFrame)current.cancelAnimationFrame(xrFrame);current.end().catch(()=>{});}xrFrame=0;releaseXR();}
  async function startAR(){if(session||xrStarting)return;stopJoystick();stopGyro();
   const panel=q('.cm-camera-panel'),confirm=q('[data-ar-origin]');if(!confirm?.checked){arMessage('Primero confirma que estás en el lugar que seleccionaste y mirando en la misma dirección que el recorrido.');return;}
   if(!window.isSecureContext||!navigator.xr){arMessage('Este navegador no ofrece seguimiento AR. La cámara sola no puede seguir tus pasos; usa el joystick.');return;}
   xrStarting=true;const token=++xrToken;const start=q('[data-ar-start]');if(start)start.disabled=true;
   // Release getUserMedia before WebXR takes ownership of the camera.
   panel.dispatchEvent(new Event('cm-release-video'));arMessage('Abriendo AR…');
   try {
    const xr=await navigator.xr.requestSession('immersive-ar',{requiredFeatures:['local','dom-overlay'],domOverlay:{root:panel}});
    if(dead||token!==xrToken){await xr.end();return;}session=xr;
    xr.addEventListener('end',()=>{if(session===xr){releaseXR();arMessage('AR finalizada. Vuelve al recorrido para elegir otro origen.');}});
    const surface=document.createElement('canvas');gl=surface.getContext('webgl',{alpha:true,xrCompatible:true});if(!gl)throw Error('graphics');await gl.makeXRCompatible();
    if(token!==xrToken)return;xr.updateRenderState({baseLayer:new XRWebGLLayer(xr,gl,{alpha:true})});xrSpace=await xr.requestReferenceSpace('local');if(token!==xrToken)return;
    xrSpace.addEventListener('reset',()=>{base=null;trackingLost=true;arMessage('El seguimiento cambió de referencia. Vuelve a tu origen y confirma para recalibrar.');q('[data-ar-confirm]').hidden=false;});
    xr.addEventListener('visibilitychange',()=>{if(xr.visibilityState!=='visible'){base=null;trackingLost=true;arMessage('Seguimiento pausado. Vuelve a tu origen y confirma para continuar.');q('[data-ar-confirm]').hidden=false;}});
    xrStarting=false;campus.classList.add('cm-ar-active');anchor=api.getPose();base=null;q('[data-ar-confirm]').hidden=false;arMessage('Apunta como la vista inicial. En tu origen, pulsa Confirmar origen.');
    function frame(t,f){if(session!==xr||!gl)return;xrFrame=xr.requestAnimationFrame(frame);gl.bindFramebuffer(gl.FRAMEBUFFER,xr.renderState.baseLayer.framebuffer);gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
     const pose=f.getViewerPose(xrSpace);if(!pose||pose.emulatedPosition){trackingLost=true;arMessage('Seguimiento perdido. Vuelve al origen y confirma para continuar.');q('[data-ar-confirm]').hidden=false;return;}
     const current=xrPose(pose.transform);if(!base||panel.dataset.confirmOrigin==='yes'){if(panel.dataset.confirmOrigin==='yes'){delete panel.dataset.confirmOrigin;base=current;trackingLost=false;q('[data-ar-confirm]').hidden=true;arMessage('Siguiendo tus pasos · posición relativa aproximada.');}else{miniMap();return;}}
     if(trackingLost)return;const next=trackedPose(current,base,anchor),previous=api.getPose();if(Math.hypot(next.x-previous.x,next.z-previous.z)>3){trackingLost=true;arMessage('Salto de seguimiento detectado. Regresa al origen y recalibra.');q('[data-ar-confirm]').hidden=false;return;}api.track(next);miniMap();
    }
    xrFrame=xr.requestAnimationFrame(frame);
   }catch(e){if(token!==xrToken)return;stopAR();arMessage(e.name==='NotAllowedError'?'Permiso AR denegado. Puedes volver al recorrido y usar el joystick.':'AR no disponible en este dispositivo o navegador. Usa el joystick; no se están siguiendo tus pasos.');}
  }
  function attach(){stopJoystick();stopGyro();stopAR();section=q('.cm-interior');api=q('.cm-walk')?.cmWalk;if(!section||!api)return;section.classList.add('cm-has-joystick');
   section.insertAdjacentHTML('beforeend','<div class="cm-mobile-controls"><div class="cm-joystick" tabindex="0" role="group" aria-label="Joystick: arrastra para caminar, o usa las flechas del teclado"><span class="cm-joystick-knob"></span></div><div class="cm-look-actions"><button type="button" data-gyro aria-pressed="false">Activar giro del celular</button><button type="button" data-recenter>Recentrar mirada</button><small>Joystick: caminar · arrastra la vista: mirar</small></div></div><p data-input-status role="status">Explora con el joystick o con WASD.</p>');
   const pad=q('.cm-joystick');pad.onpointerdown=e=>{if(pointer!==null)return;e.preventDefault();pointer=e.pointerId;pad.setPointerCapture(pointer);stick(e);last=performance.now();raf=requestAnimationFrame(tick);};pad.onpointermove=e=>{if(pointer===e.pointerId)stick(e);};pad.onpointerup=pad.onpointercancel=pad.onlostpointercapture=stopJoystick;
   pad.onkeydown=e=>{const v={ArrowUp:[0,1],ArrowDown:[0,-1],ArrowLeft:[-1,0],ArrowRight:[1,0]}[e.key];if(v){e.preventDefault();api.walk(...v,.08);}};
   const canvas=q('.cm-walk');canvas.addEventListener('pointerdown',()=>{if(gyro){stopGyro();message('Mirada manual. Puedes volver a activar el giro del celular.');}});
  }
  function click(e){if(e.target.closest('[data-room]')){gyroBase=null;lastLook=null;}if(e.target.closest('[data-gyro]')){gyro?stopGyro():enableGyro();}if(e.target.closest('[data-recenter]'))recalibrate();if(e.target.closest('[data-ar-start]'))startAR();if(e.target.closest('[data-ar-confirm]')){q('.cm-camera-panel').dataset.confirmOrigin='yes';base=null;trackingLost=false;}}
  const pause=()=>{stopJoystick();stopGyro();};const hidden=()=>{if(document.hidden){pause();stopAR();}};
  campus.addEventListener('click',click);window.addEventListener('blur',pause);document.addEventListener('visibilitychange',hidden);
  return {attach,enableGyro,stopAR,miniMap,stop(){pause();stopAR();},get arActive(){return !!session||xrStarting;},destroy(){dead=true;pause();stopAR();campus.removeEventListener('click',click);window.removeEventListener('blur',pause);document.removeEventListener('visibilitychange',hidden);}};
 }
 return {mount,orientation,joystick,trackedPose,xrPose,angle};
});
