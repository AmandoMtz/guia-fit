# Actualización de Castor FIT

- Interpreta saludos con preguntas, abreviaturas y errores comunes de escritura.
- Responde localmente sobre acceso, recuperación, docentes, validación institucional, QR y chat temporal de pedidos.
- Usa el último mensaje del usuario para seguimientos concretos, como “no me llega” al recuperar la contraseña y preguntas de precio sobre comida.
- Busca nombres de espacios, productos y eventos en los datos autorizados del turno. Ordena la comida por precio cuando se pide una opción económica.
- Consulta clases por día, hoy, mañana o siguiente clase según el horario semanal guardado y la zona horaria de Tampico. No incorpora vacaciones ni cambios oficiales.
- Consulta eventos vigentes en orden cronológico. Mantiene los filtros de autorización existentes.
- Si falla la consulta de datos, lo indica; no presenta el fallo como ausencia de productos o eventos.
- Gemini es opcional. Sus intentos comparten un máximo de 12 segundos; un error de cuota conduce a la respuesta local.
- El chat se recupera ante errores de conexión y descarta respuestas de una sesión anterior al cambiar de usuario.
- Actualiza la versión de caché para distribuir los cambios del navegador.

Las respuestas se adaptan automáticamente al contexto consultado en cada petición. No hay entrenamiento automático ni incorporación de afirmaciones de usuarios a una base de conocimiento. Las preguntas frecuentes funcionan sin una clave de Gemini; requieren conexión con el servidor.

## Actualizar

Extrae el ZIP y copia el contenido de guia-fit-main dentro de tu repositorio local, reemplazando los archivos. Conserva .git y tu .env. No requiere migraciones nuevas ni dependencias nuevas.

Desde PowerShell, dentro del repositorio:

```powershell
npm ci
npm test
git status
git add server/chatbot.cjs server/chatbot-understanding.cjs web/dist/js/chatbot.js web/dist/sw.js tests/chatbot.test.cjs docs/CHATBOT_MEJORAS_V2.md
git commit -m "Mejora respuestas y estabilidad de Castor FIT"
git push origin main
```

Si Render tiene despliegue automático, espera a que termine. Si no, inicia un despliegue manual del último commit. Recarga la página con Ctrl+F5.

## Fondo blanco y conversación gentil

El fondo principal de la aplicación ahora es blanco. Se conservan los acentos rojos.
Se añadieron respuestas sociales locales, aclaraciones que usan el tema anterior, atención respetuosa ante insultos y detección prioritaria de relatos de maltrato. Las instrucciones de Gemini exigen un trato amable y la salida pasa por un filtro adicional de expresiones ofensivas conocidas. Este filtro no constituye una garantía absoluta para todas las frases que un modelo pueda generar.

Validación: las 15 pruebas del chatbot pasaron. No se realizó una llamada a Gemini real.

Para instalar, abre PowerShell en la carpeta extraída y ejecuta:

```powershell
powershell -ExecutionPolicy Bypass -File .\ACTUALIZAR_FIT.ps1
```

El script clona main en una carpeta nueva, copia los archivos de esta actualización y hace commit y push. Conserva el historial de Git. Después espera el despliegue en Render y recarga con Ctrl+F5.

## Conversación con IA como primera opción

El proveedor recibe cada consulta normal, el historial temporal de la sesión (hasta 16 mensajes) y los datos autorizados del turno. La orientación local ayuda a describir pasos del sistema sin sustituir la respuesta conversacional. Los insultos y casos de seguridad mantienen una respuesta local controlada. Ante un error, falta de clave, respuesta vacía, formato inválido o lenguaje ofensivo detectado, vuelve a la ayuda local. No hay entrenamiento automático.

### Activar en Render

1. Ejecuta ACTUALIZAR_FIT.ps1 desde PowerShell y espera el despliegue.
2. En las variables de entorno del servicio configura GEMINI_API_KEY con tu clave real, exclusivamente en el servidor. Nunca la pegues en el chat, código del navegador ni GitHub.
3. CHATBOT_MODEL es opcional. Si tienes un valor antiguo no disponible, elimínalo para utilizar la selección predeterminada del servidor. La disponibilidad del modelo depende del proveedor.
4. Guarda las variables y espera el reinicio/despliegue. Recarga con Ctrl+F5.
5. Prueba “estoy triste”, luego “me fue mal en clase”, y después una pregunta de Guía FIT.

Si aparece “Modo básico”, revisa el registro del servicio: `chatbot fallback` informa `credentials` (rechazo de credenciales/permisos), `quota` (cuota), `timeout` (tiempo agotado) o `provider_error` (otro fallo). Sin clave, la API indica `fallback_reason: not_configured`. La ruta de estado solo confirma configuración, no que el proveedor haya aceptado la clave. La respuesta de cada mensaje informa `source: ai` cuando la llamada fue exitosa.

No se pudo verificar la configuración del servicio desplegado ni hacer una llamada real con la clave del propietario. Pasaron 19 pruebas del chatbot, incluidas prioridad de IA, historial, respuestas emocionales, errores del proveedor y control del tono, con proveedor simulado.
