# Castor FIT · asistente contextual

El chatbot se abre desde la mascota de Guía FIT en la barra superior o desde el botón flotante **¿Necesitas apoyo?**. Solo está disponible para sesiones autenticadas y con conexión.

## Configuración en Render

Agrega estas variables de entorno al servicio web:

- `ANTHROPIC_API_KEY`: clave privada de Claude. Nunca debe enviarse al navegador ni subirse a Git.
- `CHATBOT_MODEL`: por defecto `claude-sonnet-5`.

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
