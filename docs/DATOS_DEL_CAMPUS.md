# Completar el directorio y los recorridos

## Datos iniciales

Se transcribieron del croquis: Entrada Blvd. A. López Mateos, Entrada Av. Faja de Oro, Auditorio Posgrado, Sala A, Sala B, Aula Interactiva FIT, Sala de Negocios, Cafetería de Ingeniería y Campo de futbol.

Los pisos, los números no indicados y algunos edificios aparecen como pendientes. Las posiciones porcentuales del croquis son aproximadas. El documento adjunto es la fuente del nombre del espacio, pero no constituye por sí solo una inspección reciente del lugar.

## Agregar cada salón

1. En la web, inicia sesión como administrador y entra a **Administrar → Agregar espacio**.
2. Escribe su nombre o número, edificio, piso y referencias concretas.
3. Si deseas ubicar un marcador en el croquis, proporciona X e Y de 0 a 100, respecto a la imagen completa. Déjalos vacíos si no tienes una posición fiable.
4. Agrega una fotografía real de la entrada con el número visible. Es opcional; usa JPG, PNG o WebP de hasta 5 MB. Evita incluir personas o documentos con datos personales.
5. Registra la fuente y la fecha de comprobación. Activa **Información comprobada por la facultad** solo después de revisar esos datos.

Las fotos son públicas para poder mostrarse en las fichas; no utilices ese espacio para guardar documentos privados.

## Agregar recorridos

El sistema modela puntos y tramos **con sentido**. Un punto puede ser un salón, acceso, pasillo, escalera u otro lugar de referencia. Registra puntos intermedios cuando permitan dar instrucciones más claras.

1. Registra los puntos de partida y destino, incluidos los intermedios, en el directorio y compruébalos.
2. En **Tramos del recorrido**, selecciona desde dónde y hasta dónde se puede caminar.
3. Escribe una indicación específica que corresponda a ese sentido. Por ejemplo, describe la referencia o el salón que se pasa, únicamente después de comprobarlo.
4. Agrega fuente y fecha. Marca el tramo como verificado cuando corresponda.
5. La accesibilidad solo se marca después de confirmar las condiciones del tramo. No se infiere de la ausencia de escaleras en un dibujo.
6. Si se puede volver, agrega otro tramo en sentido contrario con su propia indicación.

La búsqueda utiliza el recorrido con menos tramos disponibles. **No estima metros, tiempo ni distancia mínima física.** Un tramo o punto sin verificar queda fuera de los recorridos reales. Al cambiar una ubicación o cerrar un paso, retira o desmarca sus tramos hasta revisarlos otra vez.

## Demostración

El ejemplo utiliza Entrada de ejemplo → Pasillo de ejemplo → Salón de ejemplo 101 → Salón de ejemplo 102. Estos nombres son ficticios, no se insertan en la base y únicamente permiten probar los controles Anterior, Siguiente, Llegué y Reiniciar.

Los datos de demostración están en `web/dist/js/catalog.js` y `flutter/assets/catalog.json`. En modo real, ambos clientes consultan el mismo catálogo de Aiven mediante la API de Render; el administrador no necesita actualizar los archivos para agregar un salón.
