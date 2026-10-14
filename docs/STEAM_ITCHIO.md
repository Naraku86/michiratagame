# Publicación en itch.io y Steam

Revisión: 13 de octubre de 2026. Recomendación: publicar primero una demo HTML5 gratuita en itch.io; conservar el sitio propio para comunidad y cuentas. Después probar un ejecutable Windows con Electron, sin reescribir el juego en Godot. Esta elección es una recomendación técnica, no una comparación de rendimiento medida.

## itch.io: paquete preparado

La documentación oficial acepta ZIP con `index.html` en la raíz y rutas relativas: el juego se sirve desde un subdirectorio de su CDN. [Guía HTML5](https://itch.io/docs/creators/html5).

```bash
npm ci
npm test
npm run build
node --experimental-strip-types tools/package-itch.ts
```

Genera `dist/michiratagame-itch.zip`, excluido del repositorio. Requiere Node 24 y los ejecutables `zip` y `unzip`. Puede indicarse otro destino como primer argumento. No subir el directorio padre: subir el ZIP directamente, elegir proyecto HTML y habilitar ejecución en navegador. Crear inicialmente una página privada y probar escritorio, móvil, pantalla completa, audio tras interacción, reinicio y guardado antes de hacerla pública. La [app de itch](https://github.com/itchio/itch-docs/blob/master/integrating/platforms/web.md) también puede ejecutar juegos HTML5.

El script usa Vite con `base: './'`, cambia las cadenas `/assets/` solamente durante esta compilación y comprueba imágenes referenciadas, rutas absolutas, integridad del ZIP y exclusión de servidor/datos. No modifica la compilación web habitual. Esta transformación es específica de las cadenas actuales; si cambiamos cómo se construyen las rutas de assets hay que actualizar la comprobación.

**Resultado real:** ZIP de 1.614.815 bytes en esta revisión (seis skins y dos animaciones). Browser smoke test en Chromium headless sirviendo el contenido bajo `/nested/`: imagen cargada, clic y guardado local funcionales, API ausente mostrada como «Sin conexión», sin excepciones JavaScript. No significa que se haya probado dentro del iframe real de itch ni que el ZIP funcione abriendo `file://`; probarlo servido por HTTP. El juego local no depende de una API disponible, pero no incluye service worker ni instalación offline web.

## Tablero y autenticación: límite del paquete

itch sirve archivos estáticos; el ZIP no ejecuta nuestro Node/SQLite. Hoy `fetch('/api/presence')` apunta al origen del iframe, no al servidor Michirata, por lo que el tablero no conectará. El cliente ya captura el fallo y deja jugar. No presentar este paquete como una edición con comunidad funcional.

Para conservar tablero/cuentas dentro de itch hace falta trabajo adicional:

1. Dominio HTTPS permanente para el backend; no depender del quick tunnel.
2. URL de API configurable en cliente y una edición local explícita que no muestre controles de cuenta inútiles.
3. CORS con orígenes concretos verificados del iframe, preflight y credenciales si se usan cookies. El backend actual rechaza solicitudes cross-site; quitar ese control sin sustituto sería un fallo de seguridad.
4. Diseñar login fuera del iframe mediante redirección/popup y retorno validado, siguiendo el proveedor elegido. Las cookies cross-site pueden ser bloqueadas aun con CORS correcto; probar navegadores reales. No almacenar secretos OAuth en el ZIP, ni usar `*` con credenciales.
5. Explicar que el guardado local pertenece al origen: no migra automáticamente del túnel al sitio propio, itch o un ejecutable. Se necesitará exportación/importación o sincronización autenticada si queremos continuidad.

Para salir pronto, itch tiene juego local y enlace al sitio propio. Evita invertir en integración cross-site antes de que haya cuentas y reglas de servidor verificadas.

## Ejecutable: Electron primero; Tauri como comparación

[Electron](https://www.electronjs.org/docs/latest/) empaqueta Chromium y Node con HTML/JS/CSS. Es la ruta que recomendaría probar por mantener el comportamiento del navegador y el equipo TypeScript. El wrapper debe cargar archivos locales, tener aislamiento de contexto y Node deshabilitado en el renderer; los permisos nativos irían por un puente mínimo. No cargar código remoto con privilegios nativos.

[Tauri](https://tauri.app/start/) usa Rust y el WebView del sistema. Es una alternativa si reducir el paquete justifica otra cadena de compilación y verificar WebView2/WebKit en cada plataforma. No hay benchmark de este juego en Electron o Tauri: sería incorrecto prometer tamaños, RAM o FPS concretos. El tamaño del ZIP web no es el tamaño del ejecutable.

Antes de elegir definitivamente, construir el mismo contenido en ambas opciones en Windows y registrar: bytes del instalador y descomprimido, tiempo de arranque frío/caliente, memoria del conjunto de procesos, fluidez con trabajadores/animaciones y audio. Repetir con el mismo equipo y estado de partida; conservar versiones y resultados. No se añadieron Electron/Tauri ni se compiló un EXE en este frente.

Para Steam, preferir un juego que arranque y guarde sin depender del servidor. El servidor remoto se mantiene opcional para cuentas/tablero; no distribuir SQLite de jugadores ni credenciales. Guardados nativos deben ir a un archivo del usuario si queremos Steam Cloud; `localStorage` no obtiene Cloud por empaquetar.

## Steam: pasos verificados

[Steam Direct](https://partner.steamgames.com/steamdirect/?l=english) requiere alta del publicador y tarifa de US$100 por producto, además de espera de 30 días desde el pago y página «Coming Soon» pública al menos dos semanas. [Onboarding](https://partner.steamgames.com/doc/gettingstarted/onboarding) describe identidad, datos bancarios y fiscales. La [tarifa](https://partner.steamgames.com/doc/gettingstarted/appfee) puede recuperarse después de US$1.000 de ingresos brutos ajustados; para un juego gratuito sin ingresos no asumir recuperación.

Preparar ejecutable, requisitos de sistema medidos, capturas, cápsulas, descripción y declaraciones de contenido. Completar los formularios vigentes y declarar el uso de IA según el cuestionario actual; la licencia MIT no sustituye derechos sobre imágenes o elementos de terceros. No se verificaron permisos individuales de estos memes ni se completó el cuestionario.

[SteamPipe](https://partner.steamgames.com/doc/sdk/uploading) organiza builds en depots; configurar AppID/DepotID, contenido, ejecutable/opciones de lanzamiento, subir con SteamCMD y probar primero una rama privada. Cada plataforma necesita su build/depot apropiado. Enviar página y build a revisión antes del lanzamiento; no asumir aprobación automática.

Publicar un ejecutable no añade logros por sí solo. Los [logros](https://partner.steamgames.com/doc/features/achievements) requieren configuración e integración Steamworks (`ISteamUserStats`, carga de estadísticas, desbloqueo y persistencia). Un puente nativo JS/Steamworks es trabajo pendiente, con validación de su mantenimiento y licencia; no se eligió una dependencia sin probarla. Los logros locales del juego pueden diseñarse antes. [Steam Cloud](https://partner.steamgames.com/doc/features/cloud) y autenticación Steam son integraciones separadas.

## Próximo paso concreto

Probar el ZIP en una página privada de itch, confirmar el guardado y controles en móvil y enlazar al sitio estable para comunidad. Después hacer el wrapper Windows y el benchmark descrito. Sólo entonces iniciar el pago/onboarding Steam y preparar el lanzamiento con margen para sus esperas y revisión.

No se publicó en tiendas, pagó ninguna tarifa ni crearon cuentas. No se probaron iframe real, EXE, Steam API, hardware Windows ni cookies de terceros.


## Paquete ampliado

El integrador regeneró el ZIP con las 24 skins: `npm run package:itch -- /tmp/michiratagame-24-skins-itch.zip`. La primera salida ampliada pesó 4.805.257 bytes; el tamaño final puede cambiar con código/documentación. Se conserva `index.html` en la raíz, rutas relativas y exclusión de bases/servidor. El tablero sigue requiriendo un servicio externo y la autenticación requiere su configuración. No se publicó en tiendas.
