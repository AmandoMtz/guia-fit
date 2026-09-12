# Castor FIT · asistente contextual

El chatbot se abre desde la mascota de Guía FIT en la barra superior o desde el botón flotante **¿Necesitas apoyo?**. Solo está disponible para sesiones autenticadas y con conexión.

## Configuración en Render

Agrega estas variables de entorno al servicio web:

- `GEMINI_API_KEY`: clave privada creada en Google AI Studio. Nunca debe enviarse al navegador ni subirse a Git.
- `CHATBOT_MODEL`: por defecto `gemini-2.5-flash`. Este modelo dispone de nivel gratuito sujeto a límites de uso de Google.

No es necesario habilitar facturación para usar el nivel gratuito disponible. Si se supera el límite gratuito, Castor FIT mostrará un error temporal en lugar de generar cargos automáticamente, salvo que el proyecto se cambie expresamente a un nivel con facturación.

Después de guardar las variables, vuelve a desplegar el servicio. `AUTO_MIGRATE=true` aplica `006_chatbot.sql` automáticamente.

## Comportamiento

- El historial activo es temporal, por sesión, y se conserva en memoria hasta 2 horas.
- Cada petición usa el historial reciente y contexto real del usuario.
- Eventos, pedidos, comida y espacios se consultan en PostgreSQL.
- El horario se toma del almacenamiento local del dispositivo y se envía de forma resumida al backend para ese turno.
- La clave del proveedor nunca sale del backend.
- Se limita a 30 mensajes por usuario cada 15 minutos.
- Las preguntas y respuestas se registran en `chatbot_logs` durante un máximo operativo de 90 días para revisar dudas frecuentes y mejorar el prompt.
- Los casos de pagos, quejas formales, seguridad, problemas delicados de cuenta y otros asuntos que requieren decisión humana se marcan para escalamiento.

## Privacidad

El contexto enviado al modelo evita correo, matrícula y otros identificadores directos. No se almacena el prompt del sistema ni claves/tokens en `chatbot_logs`.


## Nota sobre el nivel gratuito de Gemini

Google indica que el nivel gratuito de determinados modelos puede utilizar las entradas y salidas para mejorar sus productos. Guía FIT minimiza los datos enviados al modelo y no incluye correo ni matrícula en el contexto, pero antes de usarlo con información institucional real conviene revisar la política de privacidad aplicable.
