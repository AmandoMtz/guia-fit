# Actualizar Comidas en GitHub y Render · versión 4

Este ZIP completo continúa la actualización 3 que ya subiste a `AmandoMtz/guia-fit`. Incluye web, servidor y Flutter. Los cambios de esta entrega todavía deben subirse desde tu equipo.

## 1. Descargar lo último de GitHub

En PowerShell, ejecuta estos comandos uno por uno:

```powershell
cd "C:\Users\elnoo\Downloads\Guia_FIT_Render_Aiven_Flutter\Guia_FIT"
git status
git pull --ff-only origin main
explorer .
```

La última instrucción abre la carpeta correcta en el Explorador. Si tienes modificaciones propias sin guardar, consérvalas antes de copiar esta entrega; no uses un push forzado. Si pull muestra un error, resuélvelo antes de continuar.

## 2. Copiar esta actualización

1. Extrae `Guia_FIT_Actualizacion_4.zip` en otra ubicación.
2. Dentro de la carpeta extraída `Guia_FIT`, selecciona todos sus archivos y subcarpetas.
3. Cópialos dentro de la ventana que abrió `explorer .`, combinando carpetas y reemplazando los archivos existentes.
4. Mantén `.git`, `.env`, certificados, `flutter/config.local.json` y archivos de firma. El ZIP no incluye esos archivos privados.

`package.json` debe quedar directamente en la raíz de tu repositorio, junto a `server`, `web`, `backend` y `flutter`. No pegues otra carpeta `Guia_FIT` envolviendo el contenido ni subas el ZIP como sustituto de los archivos. Copia todo el proyecto: los avisos y contadores también necesitan el servidor nuevo.

## 3. Subir a GitHub

Vuelve a la misma PowerShell:

```powershell
git status
git add .
git commit -m "Mejora Comidas, seguimiento y pedidos recibidos"
git push origin main
```

Git debe mostrar los archivos modificados y nuevos antes del commit. Cuando push termine con `main -> main`, anota su commit para identificar el despliegue en Render. Si vuelve a aparecer `nothing to commit`, comprueba la ubicación de la copia o si esos cambios ya estaban subidos.

## 4. Render y Aiven

Mantén el mismo servicio, dominio y configuración:

| Ajuste                        | Valor                                    |
| ----------------------------- | ---------------------------------------- |
| Build Command                 | `npm ci --omit=dev`                      |
| Start Command                 | `npm start`                              |
| AUTO_MIGRATE                  | `true`, una sola variable con ese nombre |
| DATABASE_URL y certificado CA | Tus valores actuales                     |

Esta entrega no añade migraciones ni modifica las migraciones 001, 002 o 003. Continúa utilizando tus usuarios, puestos, productos, pedidos y fotos en Aiven. No necesita una base nueva, claves nuevas ni cambios manuales de tablas.

Revisa **Deploys**. Si no se inicia automáticamente, usa **Manual Deploy → Deploy latest commit**. Espera a que el commit aparezca activo y abre tu dominio habitual. Si aún ves la interfaz anterior, usa Ctrl+F5; evita borrar los datos del sitio porque ahí están los horarios locales.

## 5. Probar el flujo

- Con la cuenta vendedora, abre **Comidas → Mi puesto** y consulta su estado y menú.
- Con otra cuenta, solicita un producto y comprueba la cantidad y el precio antes de enviarlo.
- En la cuenta vendedora, abre **Pedidos recibidos → Nuevos**, acepta y marca **Listo para recoger**.
- En el comprador, abre **Mis compras** o la campana → **Ver pedido**; comprueba el estado y punto de entrega.
- Confirma la entrega desde el vendedor únicamente cuando el comprador la reciba.
- Si una cuenta compra y vende, sus compras y sus ventas aparecen por separado.

La revisión administrativa está en **Revisar vendedores**. Se conserva tu cuenta administradora existente. Los avisos siguen siendo internos a la aplicación; no son WhatsApp ni notificaciones push con la app cerrada.

## Desarrollo local y Flutter

```powershell
npm ci
npm start
```

Abre `http://localhost:3000`. Para operar con cuentas reales, tu `.env` debe estar conectado a la misma Aiven; sin configuración puedes usar la demostración.

Flutter también incorpora la navegación, el seguimiento, el resumen por lotes y los enlaces de avisos. Usa `flutter pub get` y sigue `docs/FLUTTER.md` para recompilar. El ZIP contiene las fuentes; no incluye APK/IPA firmado ni builds. La configuración de conexión sigue siendo tuya.
