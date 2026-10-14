# Organizar varios modelos para la demo

## Objetivo y estado

Para economía, cadencia y nuevas mecánicas, usar [EXPERIMENTOS_AGENTES.md](EXPERIMENTOS_AGENTES.md). Los encargos de construcción más abajo son antecedentes de la primera demo; no ejecutarlos de nuevo sobre la versión actual.

Plan de coordinación aplicado a la primera demo; las tareas iniciales de Claude y Codewhale ya terminaron. Todos leen README.md y PLAN_DEMO.md antes de trabajar. El alcance es una pantalla de clicker en TypeScript, dos mejoras, producción durante juego activo y guardado local. Sin cuentas, backend, votaciones, ranking ni Steam.

## Qué necesitamos del usuario

- La Michirata original ya fue confirmada y está conservada en public/assets/michirata-original.jpg. Hay variantes y dos WebP animados aportados por la comunidad.
- La demo ya se comparte por un túnel temporal de Cloudflare. Elegir alojamiento permanente sigue pendiente.
- Probar la demo en un teléfono real y comentar si resulta divertida. Las pruebas automáticas no sustituyen esta opinión.

Los recursos utilizados están conservados dentro de public/assets/. No depender de rutas temporales de adjuntos para nuevos encargos.

## Equipo pequeño: tres modelos y revisión posterior

### Herramientas disponibles en esta máquina

El usuario autoriza usar sus instalaciones de terminal de Claude y Codewhale, que según indica ya tienen credenciales y planes configurados. Se comprobó que ambos comandos existen y se consultó su ayuda; ambas herramientas completaron encargos autenticados. No se comprobó el proveedor/modelo exacto de Codewhale.

- Claude: `claude -p` permite encargos no interactivos. Se asignará inicialmente la interfaz.
- Codewhale: `codewhale exec` permite respuestas no interactivas; `exec --auto` habilita herramientas de archivos y terminal. Se asignará inicialmente la lógica de juego. No asumir que su proveedor configurado es DeepSeek: verificarlo antes de ejecutar la tarea.
- El coordinador puede invocar estos procesos y recoger sus resultados desde la terminal. No es necesario instalar otro orquestador para la demo.
- Codewhale también anuncia `fleet` y `workflow`, pero no se usarán inicialmente: todavía no se ha verificado cómo integran agentes externos como Claude.
- Usar sesiones nuevas para cada encargo, directorios separados y permisos limitados al trabajo necesario. No cambiar credenciales, configuración global ni activar bypass general de permisos.
- Los planes de acceso y sus límites los gestionan las herramientas. Consultar errores de autenticación o cuota sin imprimir secretos.

| Rol | Responsabilidad | Archivos asignados |
| --- | --- | --- |
| Coordinador e integrador | Preparar Vite/TypeScript, fijar contratos, integrar, guardado, temporizador, comandos y entrega | Configuración, package.json y lockfile, index.html, src/main.ts, src/storage.ts y sus pruebas, documentación |
| Modelo de juego | Estado, clics, precios, compras y producción; pruebas de economía | src/game.ts y src/game.test.ts |
| Modelo visual | Una pantalla adaptable, interacción visual, accesibilidad y Michirata | src/ui.ts, src/style.css, public/assets/ |
| Revisor, después de integrar | Buscar fallos y verificar la demo completa | Primero solo lectura; el coordinador asigna correcciones concretas |

El revisor puede ser otra sesión o uno de los modelos que terminó. No es necesario mantener cuatro modelos trabajando simultáneamente.

## Secuencia

1. El coordinador prepara la base, los comandos de desarrollo/build/pruebas y los contratos mínimos de game.ts y ui.ts. Comparte firmas exactas y un ejemplo de uso antes de delegar.
2. Juego y visual trabajan en paralelo únicamente sobre sus archivos asignados. El coordinador desarrolla guardado y conexión de eventos respetando los contratos.
3. Se integra una pantalla completa. El coordinador resuelve incompatibilidades, ajusta el ritmo y ejecuta build y pruebas.
4. El revisor comprueba clics, compras, producción, guardado, recarga, reinicio, suspensión y errores. Reporta fallos reproducibles; no añade funciones.
5. Se corrigen los problemas, se prueba en dispositivos reales y se publica en el destino elegido.
6. La comunidad prueba unos minutos; se ajusta la demo antes de añadir skins o funciones comunitarias.

No asignar estimaciones de tiempo como garantía. Cada entrega debe tener comportamiento comprobable.

## Contratos que debe fijar el coordinador

No crear un sistema de plugins ni abstracciones para futuros poderes. Acordar solamente:

- Estado serializable: puntos y niveles de las dos mejoras; identificar versión del guardado en storage.ts.
- Funciones de juego: estado inicial, clic, precio, compra y avance por segundos activos. Precisar si modifican estado o devuelven uno nuevo; no mezclar ambos estilos.
- Compra fallida: conservar el estado sin gastar puntos ni subir nivel.
- UI: crear la pantalla una vez, conectar eventos de clic/compra/reinicio y actualizar contadores y botones sin reconstruir toda la pantalla en cada cuadro.
- El coordinador controla reloj y persistencia; los otros módulos no duplican temporizadores ni acceden al almacenamiento.
- Suspensión: detener acumulación cuando la página queda oculta y restablecer el reloj al volver. No otorgar puntos por el intervalo suspendido.
- Recursos: nombre y ruta estable de la imagen elegida, sin dependencias de adjuntos temporales.

## Mensaje común para cada sesión

> Trabaja únicamente en michiratagame. Lee README.md, PLAN_DEMO.md y PLAN_MODELOS.md. Implementa solo el alcance de la demo. Respeta los contratos entregados por el coordinador y modifica únicamente tus archivos asignados. Si necesitas cambiar otro archivo o un contrato, comunica el motivo antes de hacerlo. No agregues dependencias, backend, cuentas, nuevas skins ni funciones futuras. Al terminar, informa archivos cambiados, comprobaciones ejecutadas y límites pendientes.

### Encargo al modelo de juego

> Implementa src/game.ts y sus pruebas usando el contrato fijado. Incluye clics, dos mejoras repetibles con costo creciente y producción por tiempo activo. Mantén puntos y costos válidos; una compra sin saldo no altera el estado. Prueba clic, compra válida, compra rechazada, incremento de precio y producción. Usa el mecanismo de pruebas preparado por el coordinador. No añadas reloj, DOM ni almacenamiento. Propón valores iniciales simples que permitan obtener ambas mejoras en pocos minutos.

### Encargo al modelo visual

> Implementa src/ui.ts y src/style.css con el contrato fijado. Una pantalla para teléfono y PC: Michirata como botón, contadores, dos mejoras con precio y efecto, y reinicio. Usa botones accesibles, foco visible, teclado y movimiento reducido. Incluye respuesta breve al clic sin acumular elementos visuales indefinidamente. Usa la referencia original confirmada; si necesitas generar o editar una imagen, aplica la habilidad imagegen. No implementes economía, guardado ni temporizadores de producción. No añadas paneles de votación o ranking del arte conceptual.

### Encargo al revisor

> Revisa la demo integrada contra PLAN_DEMO.md. Ejecuta los comandos existentes y revisa el código conectado. Comprueba cálculos, compras, guardado inválido/incompatible, almacenamiento no disponible, reinicio y suspensión de pestaña. Revisa pantalla pequeña, teclado y movimiento reducido. Reporta cada fallo con pasos para reproducir y efecto para el jugador. Distingue comprobaciones automáticas de pruebas en dispositivos reales. No cambies archivos hasta recibir una asignación concreta; no solicites funciones fuera del alcance.

## Cómo trabajar sin pisarse

- Un solo responsable de configuración, dependencias, contratos e integración: el coordinador.
- Si las sesiones comparten directorio, respetar estrictamente la asignación de archivos. No ejecutar operaciones Git que cambien el trabajo de las demás sesiones.
- Si trabajan en checkouts distintos, usar ramas/worktrees separados y que el coordinador integre los cambios después de revisarlos. No inicializar un repositorio anidado por defecto.
- Compartir contratos y cambios mediante mensajes o documentos del proyecto, no mediante suposiciones sobre el contexto que otra sesión conoce.
- Informar bloqueos pronto. No modificar una firma pública unilateralmente para resolverlos.
- No duplicar implementación: pedir a un modelo que construya y a otro que revise después.

## Condición de entrega

Build y pruebas pasan; el flujo completo se puede jugar y guardar; ambas mejoras se sienten en pocos minutos; el usuario prueba teléfono y PC; las limitaciones conocidas se explican. El coordinador entrega una demo completa, no módulos sueltos.
