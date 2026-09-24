# Marcos, temas y modo offline

- Mi cuenta y Mi progreso y premios > Personalizar: Previsualizar abre una ventana con tu foto. Cerrar o Escape restaura tu estilo; no cobra monedas.
- Mi progreso y premios > Crear diseños: disponible únicamente para administradores. Permite publicar marcos con partículas, temas de la aplicación y fondos del chatbot. Se eligen colores, precio y nivel; los marcos también incluyen efecto y velocidad. Los diseños quedan en PostgreSQL y aparecen en Personalizar para la comunidad (otras sesiones actualizan el catálogo al volver a abrir Personalizar).
- Las animaciones funcionan en escritorio y móvil. Si el equipo tiene movimiento reducido, se puede activar expresamente la opción correspondiente en Personalizar. Se conserva la opción de apagar animaciones.
- Perfil accesible en el encabezado móvil, salida compacta con etiqueta accesible y menú que conserva la posición seleccionada.
- Castor Runner también aparece cuando se entra manualmente al modo offline, aunque el dispositivo indique que tiene red. Caché sincronizada con las versiones de recursos actuales; el juego debe quedar descargado antes de activar la nueva caché.

## Actualizar

Actualizar los archivos del proyecto completo en el repositorio y desplegar como habitualmente. La migración nueva es backend/migrations/017_custom_styles.sql; no modificar migraciones anteriores. El arranque normal de este proyecto aplica las migraciones. Si se usa un arranque personalizado, ejecutar npm run db:migrate antes de iniciar.

Después del despliegue abrir una vez con internet y recargar para que se instale la nueva versión offline. Sin esa primera descarga ningún navegador puede guardar los archivos nuevos.

## Validación

Pasaron 11 pruebas del módulo de recompensas (incluye permiso de administrador, validación de diseños, canje y equipamiento) y 2 pruebas de DOM/caché (foto en ventana, partículas, restauración al cerrar, editor y dependencias locales).

No fue posible ejecutar la revisión visual ni la desconexión real en navegador en este entorno porque la descarga de Chromium falló. Comprobar después de desplegar: ventana en celular/escritorio, posición del menú, perfil visible, editor con cuenta administradora y juego tras abrir con internet y activar modo avión. Se incluye scripts/test-style-preview-browser.cjs para esa validación con Playwright y un servidor local en el puerto 8765.
