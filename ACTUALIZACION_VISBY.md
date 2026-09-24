# Identidad institucional y Visby

Esta version reemplaza el encabezado anterior por los logos UAT y FIT suministrados, incorpora Correcaminos y la campana Ingenieria es lo de hoy en el pie de pagina, y usa la textura institucional en la tarjeta de aspirantes. Se han retirado solo los margenes transparentes de FIT y de la campana para mostrarlos legibles, conservando su imagen.

Visby CF queda como fuente predeterminada de la pagina, formularios y mapa. Las tipografias que el usuario equipe en Mi progreso y premios siguen teniendo prioridad. Al desequiparlas vuelve Visby. Las fuentes se sirven desde el proyecto, sin depender de servicios externos.

El modulo Conecta con la FIT esta disponible desde el menu, y sus tres tarjetas tambien aparecen en la pagina de acceso. Enlaza al sitio de la facultad, su Facebook y el registro de aspirantes. Los enlaces abren en otra pestana. El pie institucional aparece tanto antes como despues de iniciar sesion.

## Actualizar GitHub desde Windows

1. Extrae el ZIP en una carpeta distinta de tu repositorio local.
2. Abre PowerShell dentro de la carpeta extraida `guia-fit-main`.
3. Ejecuta (sustituye la ruta por la de tu repositorio):

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\ACTUALIZAR_GITHUB.ps1 -Repositorio "C:\Proyectos\guia-fit"
```

Necesitas Git instalado y acceso de escritura a `AmandoMtz/guia-fit`. El script verifica el remoto, la rama main, que no tengas cambios pendientes ni commits locales sin publicar. Descarga la ultima version de main y comprueba los archivos contra el ZIP original antes de copiar. Si cambiaron, se detiene para que se puedan integrar sin perder trabajo. Copia exclusivamente los archivos de esta actualizacion y crea un commit antes de hacer push. No copia configuraciones .env ni modifica la base de datos.

Si el push falla por autenticacion o por nuevos cambios en GitHub, el commit queda guardado localmente; resuelve el mensaje de Git antes de volver a publicarlo. No utiliza push forzado.

El ZIP contiene el proyecto completo. El script independiente es el mismo incluido en el ZIP: debe estar junto a `actualizacion-manifest.json` y las carpetas del proyecto extraido.

## Verificacion

Se comprobo la sintaxis JavaScript, los archivos de fuentes e imagenes y los enlaces del modulo. Las siete pruebas existentes de core pasan. La prueba de gamificacion requiere @electric-sql/pglite, no disponible en el entorno de revision. No se modifico la logica de recompensas ni la API. No se pudo completar la revision visual en navegador ni ejecutar PowerShell en este entorno; comprueba la pagina despues del despliegue. No se ha publicado ningun cambio en GitHub desde esta entrega.
