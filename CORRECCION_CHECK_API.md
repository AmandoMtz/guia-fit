# Corrección del check API

"
    "- Se corrigió la ambigüedad de tipos PostgreSQL/PGlite (42P08) al asociar el chat con la cola de push.
"
    "- Se actualizó la prueba del Service Worker para esperar `push-worker.js?v=3`, que es la versión usada actualmente.
"
    "- No se cambió el comportamiento funcional del chat: mensajes persistentes en PostgreSQL por 7 días y notificaciones push.
