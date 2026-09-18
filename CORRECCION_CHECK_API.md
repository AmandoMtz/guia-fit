# Corrección final del check API

Se corrigieron dos problemas detectados por GitHub Actions:

1. La inserción de mensajes ya no calcula `expires_at` desde Node. PostgreSQL usa su propio `DEFAULT now() + interval '7 days'`, evitando diferencias de reloj y garantizando que `expires_at > created_at`.
2. La prueba de expiración mueve `created_at` y `expires_at` juntos al pasado, respetando la restricción de integridad de la tabla.

Se conserva el comportamiento del chat: mensajes persistentes durante 7 días y notificaciones push al destinatario.
