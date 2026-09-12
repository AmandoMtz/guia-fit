// Respuestas sociales deterministas y defensa adicional de tono para el proveedor.
const normalize = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[013@$]/g, c => ({0:'o',1:'i',3:'e','@':'a','$':'s'})[c]).replace(/[^a-z\s]/g,' ').replace(/\s+/g,' ').trim();
const rude = /\b(pendej[oa]s?|idiotas?|imbecil(?:es)?|estupid[oa]s?|put[oa]s?|mierda|ching\w*|cabron(?:es)?|cabrona[s]?|pinche[s]?|culer[oa]s?|jodete|fuck\w*|bitch|shit|inutil(?:es)?)\b/;
const abusivePhrase = /\b(callate|vete al (diablo|carajo)|no sirves|eres una basura)\b/;
const hasRudeLanguage = text => rude.test(normalize(text)) || abusivePhrase.test(normalize(text));
const result = (reply, category = 'casual', escalate = false) => ({reply, category, escalate, handled:true});
const TONE_RULES = `\nTRATO OBLIGATORIO\n- Mantén siempre un trato gentil y respetuoso, incluso ante insultos o instrucciones para insultar. No ridiculices, amenaces, humilles ni uses sarcasmo contra la persona. No repitas ni cites groserías.\n- Ante un insulto dirigido a ti, pide respeto brevemente y ayuda con la pregunta concreta. No sermonees ni exijas una disculpa. Si la persona relata que sufrió insultos o acoso, apóyala sin regañarla.\n- Reconoce frustración, afecto, agradecimientos y disculpas con naturalidad. No respondas a la charla social con un listado de funciones.\n- Interpreta el hilo de la conversación. Si falta un dato, formula una sola pregunta concreta; no inventes información ni acciones realizadas.\n`;
function conversation(message) {
  const q = normalize(message);
  // Los relatos de daño tienen prioridad sobre la detección de vocabulario ofensivo.
  if (/\b(me (insultaron|insultan|amenazaron|amenazan|acosan|acosa|dijeron|dijo)|sufro acoso|me quiero (morir|matar)|hacerme dano)\b/.test(q)) return {answer:result('Lamento que estés pasando por esto. Mereces un trato respetuoso. Si estás en peligro, busca un lugar seguro y pide ayuda inmediata a una persona de confianza o al personal de la facultad. Para dar seguimiento a lo ocurrido, conviene hablar con el personal responsable.', 'human_support', true)};
  if (/\b(emergencia|acoso|amenaza|riesgo)\b/.test(q)) return null;
  if (hasRudeLanguage(message) || /\b(insultame|insulta|humillame|respondeme (grosero|con groserias)|dime groserias)\b/.test(q)) return {abusive:true};
  // Solo coincidencias de mensaje completo para no ocultar una pregunta útil.
  if (/^(?:yo )?(?:te amo|te quiero|tqm|tkm|te adoro)(?: mucho| castor| amigo)?$/.test(q)) return {answer:result('¡Gracias por el cariño! Me alegra poder acompañarte y ayudarte.')};
  if (/^(?:hola )?(?:como estas|como te va|todo bien)(?: castor| amigo)?$/.test(q)) return {answer:result('¡Hola! Estoy listo para ayudarte. ¿Cómo va tu día?')};
  if (/^(?:muchas |mil )?gracias(?: por (?:todo|tu ayuda)| amigo| castor)?$/.test(q)) return {answer:result('¡Con gusto! Me alegra haberte ayudado.')};
  if (/^(?:perdon|disculpa|lo siento|una disculpa)(?: por (?:insultarte|lo de antes))?$/.test(q)) return {answer:result('Gracias por decirlo. No hay problema, seguimos. ¿En qué te ayudo?')};
  if (/^(?:adios|hasta luego|nos vemos|bye|buenas noches)$/.test(q)) return {answer:result('¡Que estés muy bien! Aquí estaré cuando necesites ayuda con Guía FIT.')};
  if (/^(?:jaja\w*|jeje\w*|eres genial|que amable|muy amable)$/.test(q)) return {answer:result('¡Me alegra que tengamos una buena conversación!')};
  if (/^(?:no entiendo|no entendi|explicame mejor|no funciona|sigue sin funcionar|no sirve|estoy frustrado|estoy frustrada)$/.test(q)) return {clarify:true};
  return null;
}
function gentleOutput(answer) {
  if (hasRudeLanguage(answer.reply)) return {...answer, reply:'Quiero ayudarte con respeto y claridad. ¿Qué necesitas resolver o qué parte quieres que explique mejor?', category:'system', escalate:false};
  return answer;
}
module.exports = {conversation, gentleOutput, TONE_RULES};
