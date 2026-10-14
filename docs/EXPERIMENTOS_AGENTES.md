# Encargos para probar economía, mecánicas y ritmo

Fecha: 13 de octubre de 2026.

## Punto de entrada

Leer README.md e INVESTIGACION_RITMO_RECOMPENSAS.md. La investigación contiene las fuentes, sus límites y las hipótesis. Este documento las transforma en tareas de evaluación. No se han iniciado estos encargos.

Trabajar en simulaciones y prototipos aislados. No modificar la demo compartida ni su dist/, no reiniciar servidores o túneles y no desplegar resultados. El coordinador integra una variante seleccionada después de revisar la evidencia. Las credenciales no forman parte de ningún encargo.

## Restricciones actuales del producto

- TypeScript, Vite y HTML/CSS; sin nuevos frameworks ni dependencias para los experimentos.
- Seis Michiratas contando Original; mantener las imágenes originales.
- Puntos virtuales, dos mejoras, trabajadoras y una skin equipada.
- Guardado local versión 2; migración de versión 1. Conservar puntos, niveles y skins compradas.
- Producción solo con la pestaña activa; no generar puntos durante ausencias.
- Cara grande solo al mejorar el clic; salto grande solo al contratar. Nunca disparar estos stickers con clics o bonos.
- Sonido silenciable, efectos desactivables, movimiento reducido y teclado.
- Sin cuentas, ranking, votación, compras con dinero ni nuevas skins en estos encargos.

## Reparto y archivos

| Responsable | Tarea | Área asignada |
| --- | --- | --- |
| Coordinador | Conservar referencia, acordar variante y contratos, integrar | Documentación, integración y publicación |
| Codewhale / agente de economía | Simulación y balance | experiments/economia/; lee src/game.ts |
| Claude / agente de experiencia | Diseño del ritmo y prototipo visual aislado | experiments/ritmo/; lee src/ui.ts, src/style.css y src/main.ts |
| Otro agente como revisor | Revisar supuestos, cálculos y pruebas | experiments/revision.md; inicialmente solo lectura del código |
| Comunidad | Prueba real y comentarios | experiments/RESULTADOS_COMUNIDAD.md |

Las carpetas son destinos para futuras entregas; no contienen una implementación todavía. Un agente no escribe en el área del otro. Si trabajan en checkouts diferentes, el coordinador integra únicamente los archivos asignados, sin incluir cambios ajenos del repositorio principal.

## 1. Economía: encargo listo para copiar

> Lee INVESTIGACION_RITMO_RECOMPENSAS.md y EXPERIMENTOS_AGENTES.md. Trabaja solo en experiments/economia/. Lee el motor real src/game.ts; no lo cambies. Crea una simulación reproducible en TypeScript usando sus funciones. Usa node:test o asserts para comprobar la simulación. Entrega un informe Markdown y datos CSV o JSON con supuestos, comandos y resultados. No instales dependencias ni publiques.
>
> Reproduce primero los promedios de 120 clics: Futbolista 5,50; Robot 3,00; Godín 1,25; Bufón 1,74 esperado. Sin mejoras, trabajadoras ni ingreso por tiempo, con racha mantenida. Para Bufón, integra exactamente las probabilidades; para sesiones completas, usa aleatoriedad reproducible y varias semillas.
>
> Después evalúa sesiones de 300 segundos: solo trabajadoras; 1, 2 y 4 clics/s; ráfagas de 5 segundos separadas por descansos de 3 segundos; y regreso tras ocultar la pestaña. Modela la pausa de racha de 1,5 s de main.ts. La producción durante ocultación es cero y la racha se reinicia. Usa tiempo simulado, no esperas reales.
>
> Declara y fija la política de compras antes de comparar. Como referencia simple, compra una mejora de clic cuando sea posible, luego una trabajadora, alternando; compra la skin objetivo cuando haya saldo antes de seguir mejorando, y deja de intentar comprarla tras obtenerla. Ejecuta por separado una política de ahorro directo para no confundir el balance con una sola estrategia.
>
> Registra primera mejora, primera trabajadora, skin objetivo, puntos ganados/gastados, producción final, bonos activados y mayor intervalo entre compras. Incluye todos los costos y el cambio de bonificación de Magnate al gastar. No compares skins solo por recompensa de clic: incorpora producción automática.
>
> Propón como máximo dos ajustes pequeños, comenzando por Bufón. Para cada uno indica fórmula actual/propuesta, valor esperado, variación del premio, efecto en tiempo de desbloqueo y qué identidad conserva. Aplica parámetros candidatos solo dentro de la simulación aislada, con una función pequeña; no crees un sistema de configuración del juego. Devuelve una recomendación y sus límites.

### Aceptación

- Resultados reproducibles y fórmulas vinculadas al código.
- Sin puntos negativos, compras duplicadas ni ingresos por tiempo oculto.
- Probabilidades suman 1; el premio esperado incluye clic normal y bono.
- Diferenciar análisis exacto de resultados simulados.
- Si una simulación de 300 s no alcanza una meta, indicar “no alcanzada”; no inventar tiempo ni atribuirle cero segundos.
- Verificar al menos una compra y un ciclo de bono manualmente o con asserts.
- No declarar un ajuste divertido porque suben los puntos: eso lo prueba la comunidad.

## 2. Ritmo y respuesta: encargo listo para copiar

> Lee la investigación y este documento. Trabaja solo en experiments/ritmo/. Entrega primero DISENO.md con una alternativa al ritmo actual, su regla exacta y un diagrama de estados sencillo. Después prepara un prototipo aislado si la regla está suficientemente definida. No cambies src/, dist/, guardados personales ni servidores. Reutiliza recursos y estilo del juego cuando resulte simple, sin copiar la aplicación completa.
>
> Conserva una referencia A: racha actual por cantidad de clics, con pausa máxima de 1,5 s. Elige solo una candidata para la primera comparación:
> B: intervalos regulares con ventana inicial 300–800 ms; toques fuera de ventana siguen dando puntos base pero no cargan poder.
> C: carga con límite inicial de 3 cargas/s y una ráfaga temporal. El punto base de todos los clics se mantiene.
>
> Define explícitamente primer toque, bordes de tiempo, carga completa, inactividad, efecto activo, recuperación, cambio de skin, ocultación y recarga. Para C, los rangos a explorar son 8–12 cargas, 4–6 s de poder y 6–10 s de recuperación; elige un valor por rango para el prototipo y documenta por qué. No agregues modos seleccionables a la demo.
>
> Especifica si reemplazas o complementas los bonos actuales y cómo evitar duplicar premios. Si cambia el pago esperado, calcula o solicita al agente de economía el ajuste; no atribuyas una mejora a la cadencia cuando también cambió la cantidad de puntos.
>
> Diseña respuesta pequeña por clic, señal clara del próximo premio y efecto propio al activarlo. Conserva cara/salto exclusivamente en compras de mejora/contratación. Deja contadores y controles legibles. Mantén silencio, efectos apagados, movimiento reducido y teclado.
>
> La demo/prototipo debe correr en otro puerto elegido comprobando antes que esté libre, sobre 127.0.0.1 para pruebas locales. Si necesita publicarse para la comunidad, entrega el build al coordinador; no crees túneles por tu cuenta.
>
> Agrega pruebas de tiempo deterministas para reglas nuevas. Reporta qué comprobaste de verdad y qué quedó como propuesta. No afirmes pruebas en teléfonos físicos si solo emulaste el tamaño.

### Aceptación

- El clic normal siempre recompensa; fallar ritmo no quita puntos.
- Una barra refleja progreso real y un texto explica el premio.
- Tocar más rápido no permite saltar el límite de carga.
- Pausa/ocultación/recarga no duplican ni prolongan indebidamente el poder.
- Los estados temporales no se guardan accidentalmente en el progreso permanente.
- El prototipo no lee ni escribe la clave michiratagame.demo; usar un contexto separado o una clave experimental.
- Pruebas de límites de tiempo, activación única, recuperación, cambio de skin y suspensión.
- Declarar diferencias económicas entre A y candidata, incluso si son intencionales.

## 3. Revisión cruzada: encargo listo para copiar

> Revisa las entregas de economía y ritmo contra la investigación y este documento. Primero solo lectura. Reproduce sus comandos. Comprueba probabilidad y valor esperado, políticas de compra, ingreso automático, intervalos, premios duplicados, pausa, accesibilidad y preservación del guardado. Busca hipótesis presentadas como evidencia científica. Entrega experiments/revision.md con fallos reproducibles, gravedad práctica, diferencias entre versiones y recomendación. No amplíes el alcance ni publiques.

## 4. Prueba con la comunidad

Probar una sola diferencia a la vez. Orden recomendado:

1. Medir la demo actual.
2. Elegir y probar un ajuste económico.
3. Congelar la economía seleccionada y comparar ritmo A contra una candidata.
4. Solo después explorar un evento opcional de atención.

Un grupo inicial de 6–10 personas sirve para detectar problemas y preferencias, no para demostrar significancia estadística ni viralidad. Alternar el orden de las versiones. Usar progreso inicial equivalente en contextos de navegador separados; nunca pedir borrar el guardado personal.

Durante 3–5 minutos, registrar dispositivo, versión, primera compra, primer poder, primera skin y pausas. Al terminar preguntar:

- ¿Qué te dio ganas de seguir?
- ¿Entendiste qué activaba el poder?
- ¿Sentiste que dominabas el ritmo o que debías clicar sin parar?
- ¿Te cansó el clic?
- ¿Los efectos te ayudaron o estorbaron?
- ¿Qué momento compartirías?

Más clics o minutos no bastan: contrastarlos con disfrute y cansancio. Registrar resultados anónimos; no recopilar cuentas o datos personales.

Formato sugerido para RESULTADOS_COMUNIDAD.md:

| Participante | Dispositivo | Orden A/B o A/C | Primera compra | Primer poder | Primera skin | Preferencia | Cansancio | Comentario |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |

## Entrega al coordinador

Cada agente entrega archivos, comando reproducible, supuestos, comprobaciones, resultado y límites. El coordinador elige el cambio mínimo respaldado por las pruebas, revisa migración si corresponde y ejecuta los comandos existentes de pruebas/build antes de actualizar la demo pública. Estas tareas no autorizan construir cuentas, analítica de producción ni un sistema de experimentos permanente.
