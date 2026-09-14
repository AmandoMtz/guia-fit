# Mapa del campus · Conjunto oriente

Esta actualización incorpora al apartado **Mapa del campus** una representación vectorial interactiva del plano de planta alta compartido por el responsable de Guía FIT.

## Qué incluye

- Ocho lugares identificables: campo de futbol, Laboratorios, Salones de Posgrado, Administrativo, cancha de basquetbol, Cafetería, edificios B y C.
- Vista superior 2D y volumen esquemático 3D, giro, zoom, arrastre y restablecimiento.
- Selección desde el mapa y una lista accesible, con búsqueda por edificio y por espacios que ya tengan ese edificio asociado en el directorio.
- Referencia «Estoy en este lugar», elegida manualmente y mantenida únicamente mientras está abierta esa vista.
- Fondo blanco, acentos guinda y animación que respeta la preferencia de reducir movimiento.
- Acceso al croquis anterior, con sus marcadores originales.
- Demostración independiente en /mapa-campus-demo.html. No necesita iniciar sesión.
- Sin cambios de base de datos ni migraciones, nuevas claves API o dependencias de producción.

## Alcance del trazado

La geometría se trazó aproximadamente sobre la imagen de 815 × 943 píxeles suministrada, cuyo norte apunta hacia arriba. Son coordenadas de dibujo, no metros, latitud o longitud. El PDF no se convirtió automáticamente: esta versión parte de la imagen visible del plano.

Los nombres legibles se conservaron. Los bloques sin identificación segura se dibujan en gris. Las alturas son uniformes e ilustrativas; no representan mediciones ni número de pisos. El volumen de planta alta tampoco describe necesariamente la huella completa de planta baja.

No se han inventado números de salón, puertas, escaleras, entradas ni rutas. Una ficha del directorio asociada a Posgrado no confirma su posición interior. Los puntos porcentuales del croquis anterior nunca se reutilizan sobre el plano nuevo.

## Probar antes de actualizar

Con Node 22, en una copia del proyecto:

~~~powershell
npm ci
npm test
~~~

Para ver exclusivamente el mapa, también puedes abrir web/dist/mapa-campus-demo.html directamente desde el explorador de archivos. Sus recursos son locales y no consulta la API.

En GitHub Actions se ejecutan las pruebas existentes y ocho pruebas específicas de geometría, búsqueda y escape de contenido. El flujo **Validar mapa del campus** además abre Chromium a 1365 y 390 píxeles, comprueba interacciones y genera capturas descargables durante siete días. Playwright se instala en una carpeta temporal del ejecutor; no se añade al servidor de producción.

## Siguiente etapa: llegar a cada salón

1. Confirmar sobre este plano nombres, entradas, escaleras, rampas y pasillos transitables. Registrar las conexiones reales por planta.
2. Añadir números de salón y asociar las fichas del directorio con esos puntos confirmados.
3. Colocar QR físicos en entradas o cruces. El usuario escanea uno para fijar su punto de partida y se calcula la ruta por las conexiones verificadas.
4. Para exteriores, calibrar el plano con puntos GPS conocidos y comprobar la precisión en campo antes de dibujar una posición.
5. Capturar fotografías panorámicas reales de 360° en entradas y cruces, con autorización y cuidando rostros o información privada. Cada panorama se vincula a un punto del mapa y los enlaces entre panoramas corresponden a pasos comprobados.

Un plano permite construir este modelo de orientación. No contiene las fotografías necesarias para un recorrido 360° ni garantiza la localización automática dentro de los edificios. La API de geolocalización del navegador requiere HTTPS y permiso del usuario; por sí sola no identifica un salón. Referencia: https://developer.mozilla.org/en-US/docs/Web/API/Geolocation_API

## Archivos

- web/dist/js/campus-map.js: geometría, proyección y componente.
- web/dist/campus-map.css: apariencia y adaptación móvil.
- web/dist/js/app.js: integración y acceso al croquis previo.
- web/dist/index.html y web/dist/sw.js: carga y actualización de caché.
- web/dist/mapa-campus-demo.html y web/dist/js/campus-map-demo.js: demostración.
- tests/campus-map.test.cjs: pruebas del modelo y contenido seguro.
- scripts/test-campus-map-browser.cjs y .github/workflows/campus-map.yml: comprobaciones en navegador.

Si se ajustan los contornos, mantener documentado su origen y comprobarlos contra el plano. La constante BUILDINGS es el único lugar para editar la geometría de los edificios identificados.
