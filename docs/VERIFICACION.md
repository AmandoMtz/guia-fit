# Comprobaciones de la actualización 2

Fecha: 9 de septiembre de 2026.

| Comprobación ejecutada | Resultado |
|---|---|
| `npm test` | 35 pruebas contabilizadas por Node; todas aprobadas |
| `npm audit` | 0 vulnerabilidades reportadas en esta revisión, incluidas dependencias de desarrollo |
| `flutter analyze --no-pub` | Sin incidencias |
| `flutter test --no-pub` | 13 pruebas aprobadas |
| `flutter build web --release --no-pub` | Compilación JavaScript completada, con OCR local y fuentes de iconos incluidas |
| Rutas y MIME de motores locales | Scripts, worker PDF, worker OCR y WASM servidos correctamente por Express |
| Política CSP del lector local | Permite WebAssembly y workers propios; no se habilitó `unsafe-eval` para JavaScript |
| Blueprint Render | Validado con el esquema JSON oficial de Render |
| JavaScript de la web | Sintaxis comprobada con Node |
| Migración 001, logos y croquis | SHA-256 idéntico a los archivos del ZIP de origen |
| Motores OCR de web y Flutter Web | Copias idénticas de scripts, WASM y modelo español |

## Funciones comprobadas

La API se probó con Express real, solicitudes HTTP de Supertest y PostgreSQL embebido PGlite. El correo se simuló: no se enviaron mensajes externos. Se revisaron autenticación, confirmación de correo, hash de contraseñas y sesiones, cookies HttpOnly/Secure, perfiles y administración.

Las pruebas de Comidas cubren alta pendiente, revisión administrativa con fuente, aislamiento de productos y fotografías por vendedor, catálogo de puestos aprobados, precio calculado por servidor, lotes, reintentos sin duplicación, cambios de estado, permisos de compradores/vendedores, conservación de avisos al recrear la API, lectura de avisos solo de la cuenta e historial conservado al borrar productos.

El lector PDF se ejecutó contra un PDF sintético generado en memoria. El OCR se ejecutó con Tesseract y el modelo español local sobre una imagen sintética, comprobando nombre del alumno, matrícula, grupo, día y horas. No se proporcionó un horario real para validar su formato concreto.

El almacenamiento web se probó con IndexedDB simulado: reabrir conserva PDF y datos; editar y borrar una cuenta no modifica otra; una escritura inválida conserva el registro anterior. El almacenamiento nativo se probó con archivos temporales: dos cuentas aisladas, actualización, eliminación, imagen y tabla sin original.

Las pruebas Flutter incluyen validación del horario, cruces, datos del alumno/grupo, conservación de datos y tabla sin PDF/imagen en 360 y 1280 px. Se comprobó que el botón Editar identifica la clase correcta. Las pruebas originales de acceso, directorio y rutas siguen aprobando.

## Alcance de la comprobación

Entorno: Node 24.19 y Flutter 3.35.3 / Dart 3.9.2. Dependencias fijadas por archivos lock. El servidor admite Node desde 22.16 y Render selecciona la rama 22.

No se realizó inspección visual de la web en navegador. No se compiló ni firmó APK/IPA, ni se probó ML Kit en un teléfono Android/iOS físico. Flutter Web se compila para JavaScript; su soporte Wasm general no forma parte de esta entrega. El OCR web sí utiliza un motor WebAssembly local.

No se publicaron cambios en GitHub/Render, no se conectó a tu base real de Aiven ni se probó correo externo. Esas comprobaciones requieren las variables y servicios de tus cuentas, siguiendo `ACTUALIZAR_V2.md` y `RENDER_AIVEN_GIT.md`. No hay prueba de entrega push con la aplicación cerrada porque esa función no se implementó; los avisos son persistentes dentro de la app.

El resultado de OCR depende de legibilidad, orientación y estructura del documento. El alumno revisa y corrige todos los datos. No se certifican matrículas, inscripciones o permisos de vendedor mediante OCR. El croquis conserva su estado de referencia pendiente y no se inventaron nuevos salones o caminos.

El ZIP contiene fuentes, plataformas, configuración de ejemplo, modelos OCR y librerías estáticas de la web. No incluye credenciales, node_modules, SDK, compilaciones ni datos reales de alumnos.
