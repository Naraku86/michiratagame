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

Trabajo iniciado en paralelo. Este documento se actualiza con los commits, resultados y pendientes al integrar cada entrega.
