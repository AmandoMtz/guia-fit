// Solo usa el contexto autorizado de este turno; no aprende hechos de usuarios.
const normalize = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9@]+/g, ' ').trim();
const fixes = { k:'que', q:'que', ke:'que', komo:'como', dnd:'donde', registarme:'registrarme', rejistrarme:'registrarme', inicar:'iniciar', secion:'sesion', horaro:'horario', evenos:'eventos' };
const days = ['domingo','lunes','martes','miercoles','jueves','viernes','sabado'];
const reply = (text, escalate = false) => ({ reply:text, handled:true, category:escalate ? 'human_support':'system', escalate });
function understand(message, context = {}, options = {}) {
  let q = normalize(message).split(/\s+/).map(w => fixes[w] || w).join(' ');
  q = q.replace(/^(hola|buenas tardes|buenas noches|buenos dias|buen dia|hey|buenas)\b\s*/, '').trim() || q;
  const prior = (options.history || []).filter(m => m.role === 'user').slice(-1)[0];
  if (prior && q.split(' ').length <= 6) {
    const previous = normalize(prior.content);
    if (/contrasena|recuper/.test(previous) && /no me llega/.test(q)) q += ' correo recuperacion';
    else if (/verific|confirmacion/.test(previous) && /no me llega/.test(q)) q += ' correo verificacion';
    else if (/comida|comer|menu/.test(previous) && /barat|precio|cuanto/.test(q)) q += ' comida';
  }
  if (/\b(emergencia|acoso|amenaza|riesgo)\b/.test(q)) return { message:q };
  if (/^(gracias|muchas gracias|ok|listo|perfecto)( por todo)?$/.test(q)) return { answer:reply('¡Con gusto! Si tienes otra duda sobre Guía FIT, aquí estoy.') };
  if (/persona real|hablar con alguien|soporte humano/.test(q)) return { answer:reply('Cuéntame qué estabas intentando hacer y qué error aparece, sin compartir tu contraseña. Si necesitas que revisen tu cuenta, acude con el personal responsable de la facultad; desde este chat no puedo modificar accesos.', true) };
  if (/no me llega.*correo|correo.*no (me )?llega/.test(q)) return { answer:reply('Revisa spam y que hayas escrito correctamente tu correo. Para recuperar el acceso usa “Olvidé mi contraseña”; para confirmar el registro usa “Reenviar correo de verificación”. Si ya lo intentaste y sigue sin llegar, solicita revisión con el personal responsable. No compartas enlaces ni códigos de recuperación.') };
  if (/contrasena|clave/.test(q) && /olvid|recuper|recuerdo|perdi|cambiar/.test(q)) q = 'recuperar contrasena';
  if (/verificacion institucional|validacion institucional/.test(q)) return { answer:reply('La verificación del correo y la validación institucional son procesos distintos. Confirma tu correo con el enlace recibido y revisa el estado de tu validación en “Mi cuenta”. Si sigue pendiente o fue rechazada, consulta al personal responsable; no puedo aprobarla desde el chat.') };
  if (/\b(docente|maestro|profesor)\b/.test(q) && !/horario|clase|materia|evento/.test(q)) q += ' registro correo';
  if (/\b(iniciar sesion|ingresar|entrar|acceder|login)\b/.test(q) && !/registr/.test(q)) return { answer:reply('En la pantalla de inicio elige “Iniciar sesión”, escribe el correo con el que te registraste y tu contraseña. Si no la recuerdas, pulsa “Olvidé mi contraseña”. Si aparece un error, dime el texto del aviso sin enviarme tus credenciales.') };
  if (/\b(chat|mensaje|mensajes|conversacion)\b/.test(q) && /vendedor|pedido|imagen|foto|dura|temporal/.test(q)) return { answer:reply('Abre tu pedido en “Comidas” para conversar con el vendedor y enviar imágenes. El chat y sus imágenes duran 12 horas. Consulta el tiempo restante dentro de la conversación.') };
  if (/\b(qr|asistencia|constancia)\b/.test(q)) return { message:'asistencia qr' };
  if (/\b(pedido|pedidos|orden|compras|ventas)\b/.test(q)) {
    if (!options.authenticated) return { answer:reply('Inicia sesión y entra a “Comidas” para consultar tus pedidos. Desde la pantalla pública no puedo acceder a compras ni ventas personales.') };
    return { message:'pedidos' };
  }
  if (options.authenticated && /horario|clase|materia/.test(q)) {
    const classes = context.schedule?.classes || [];
    const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone:'America/Monterrey', weekday:'long', hour:'2-digit', minute:'2-digit', hourCycle:'h23' }).formatToParts(new Date(context.now || Date.now())).map(p => [p.type,p.value]));
    const day = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'].indexOf(parts.weekday);
    let requested = days.findIndex(d => new RegExp('\\b'+d+'\\b').test(q));
    if (/\bhoy\b/.test(q)) requested = day;
    if (/\bmanana\b/.test(q)) requested = (day+1)%7;
    const dayOf = c => /^\d$/.test(String(c.day)) ? Number(c.day)%7 : days.indexOf(normalize(c.day));
    if (classes.length && (requested >= 0 || /proxim|siguiente/.test(q))) {
      let selected = classes.filter(c => requested < 0 || dayOf(c) === requested);
      if (requested < 0) {
        const minute = Number(parts.hour)*60+Number(parts.minute);
        const delta = c => { const m = /^(\d{1,2}):(\d{2})$/.exec(c.start || ''); if (!m || dayOf(c)<0) return Infinity; return (((dayOf(c)-day)*1440+Number(m[1])*60+Number(m[2])-minute)%10080+10080)%10080; };
        selected = selected.filter(c => Number.isFinite(delta(c))).sort((a,b) => delta(a)-delta(b)).slice(0,1);
      } else selected.sort((a,b) => String(a.start).localeCompare(String(b.start)));
      return { answer:reply(selected.length ? 'Según tu horario semanal guardado:\n'+selected.slice(0,8).map(c => `• ${c.subject || 'Materia'} · ${days[dayOf(c)] || c.day} · ${c.start || ''}-${c.end || ''}${c.room ? ' · '+c.room : ''}`).join('\n')+'\nNo contempla vacaciones ni cambios oficiales.' : 'No encuentro clases para ese día en tu horario guardado. Puedes revisarlo en “Mi horario”.') };
    }
  }
  for (const [key,fields,intent] of [['verified_places',['name','code'],'ubicacion'],['available_food',['name'],'comida'],[context.events ? 'events':'public_events',['title'],'eventos']]) {
    const matches = (context[key] || []).filter(item => fields.some(f => { const n = normalize(item[f]); return n.length >= 3 && (' '+q+' ').includes(' '+n+' '); }));
    if (matches.length) return { message:q+' '+intent, context:{ ...context,[key]:matches } };
  }
  if (/comida|comer|menu|hambre/.test(q)) {
    q += ' comida';
    if (/barat|econom|precio menor/.test(q)) return { message:q, context:{ ...context,available_food:[...(context.available_food || [])].sort((a,b) => (a.price_cents ?? Infinity)-(b.price_cents ?? Infinity)) } };
  }
  return { message:q };
}
module.exports = { understand };
