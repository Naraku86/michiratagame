# Camino de desarrollo en paralelo

El usuario pidió siete frentes independientes el 13 de octubre de 2026. Cada uno trabaja en un worktree y una rama separados; el coordinador integra y comprueba antes de publicar. No ejecutar auditorías o carga contra la demo pública ni subir datos de jugadores.

| Frente | Responsable | Entrega revisable | Criterio de integración |
| --- | --- | --- | --- |
| Economía/habilidades | Agente economy | Simulador determinista, asserts, CSV/JSON y fórmulas | Ejecutar sobre el catálogo final; comprobar niveles 16–100 y autoclick |
| Prestigio | Claude | Análisis y prototipo matemático de reinicios | Evaluar segunda/tercera vuelta antes de activar un reset con premios |
| Autenticación | Claude | Módulos, pruebas y configuración necesaria | Elegir proveedor y configurar claves/redirects; nunca fingir OAuth completo |
| Trampas | Claude | Auditoría y pruebas de concepto locales | Priorizar fallos reproducidos y encargar reparación concreta |
| Steam/itch.io | Agente release | Investigación oficial y empaquetador | Validar rutas/archivos; distinguir frontend offline de servicios online |
| Nuevas Michiratas | Agente skins | 18 variantes, poderes y pruebas | Conservar originales WebP, antiguos guardados y seis skins previas |
| Protección | Codewhale | Defensa HTTP, prueba de carga local y guía de infraestructura | Preservar túnel, limitar memoria/conexiones y probar bajo carga aislada |

## Orden de integración

1. Incorporar catálogo e imágenes y comprobar guardados y UI.
2. Ejecutar el simulador contra todas las skins; documentar qué habilidades requieren ajuste.
3. Integrar protección HTTP y revisar hallazgos de la auditoría antes de exponer más datos de cuentas.
4. Preparar autenticación y lista de claves externas; activar únicamente con configuración válida.
5. Comparar alternativas de prestigio con una simulación antes de modificar partidas existentes.
6. Preparar build de itch.io y ruta de escritorio/Steam. No subir a tiendas sin completar sus requisitos.

El análisis de prestigio y los prototipos no autorizan borrar progreso de jugadores. Los secretos de proveedores, cuentas de tiendas, dominio definitivo y configuración de Cloudflare son dependencias externas; el código y las instrucciones deben quedar preparados sin publicarlos.

## Estado

Los siete frentes entregaron sus artefactos y se integraron en `main`:

| Frente | Entregado | Estado práctico |
| --- | --- | --- |
| Economía | `tools/balance.ts`, tests, CSV/JSON y `ECONOMIA_SIMULADA.md` | 24 skins, 1.296 escenarios y 3.888 corridas reproducibles; sin depender de IA para calcular |
| Prestigio | `tools/prestige.ts`, 14 tests y `PRESTIGIO.md` | Prototipo de bigotes/super mejoras/skins cosméticas; no activa resets en partidas reales |
| Autenticación | Validación remota, PKCE, vínculo de cuentas, UI y tests | Integración conectada pero desactivada sin claves; checklist de Google/Meta/correo y SMTP |
| Auditoría | `AUDITORIA_TRAMPAS.md`, PoC local, evidencia antes/después | Cola de correcciones, incluidos puntos reportados por el cliente y cuentas desechables |
| Steam/itch.io | `STEAM_ITCHIO.md` y `tools/package-itch.ts` | ZIP HTML5 de 24 skins, rutas relativas y licencias; nada publicado en tiendas |
| Nuevas skins | 18 WebP, fórmulas y `NUEVAS_MICHIRATAS.md` | Comprables y equipables, guardados conservados y movimiento reducido |
| Protección | Límites API/global/altas/archivos, streaming, índice y carga local | 1.000 solicitudes: 120 aceptadas, 880 limitadas; DNS/WAF fuera del código pendientes |

Validación integrada: 113 pruebas, build de tipos incluyendo tools, navegador en cinco tamaños, compra/equipado/recarga de las 18 skins y cuentas con HTTP simulado. La configuración real de proveedores, el iframe de itch, Windows/Steamworks y la percepción de diversión no se probaron.

Siguiente trabajo priorizado en [COLA_DE_CORRECCIONES.md](COLA_DE_CORRECCIONES.md). El balance conserva las seis skins anteriores; las nuevas tienen coeficientes explícitos para próximos ajustes. Se ajustaron Queso, Oficinista, Ñi y Mágica con pruebas de nichos: producción pasiva, clic pausado y clic activo en niveles 16, 60 y 100.
