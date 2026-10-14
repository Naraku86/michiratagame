# Michiratagame — contexto y planificación

Última actualización: 13 de octubre de 2026.

Nueva función compartida: contador 👥 y tablero desplegable con nombre público opcional (1–24 caracteres), puesto personal y los 50 mejores récords de saldo. Mientras el juego está visible envía presencia cada 20 segundos; activo significa una actualización en el último minuto. Se cuentan identidades de navegador, no personas verificadas. Las pestañas comparten una cookie HttpOnly y no duplican el contador. Sin nombre aparece Invitado con un sufijo; nombres duplicados se permiten, no son cuentas verificadas.

Los récords usan el máximo saldo comunicado y no bajan al gastar o reiniciar la partida local. La sesión recoge máximos entre compras y los comunica en la siguiente actualización; un cierre antes de enviarlos puede perder ese último récord. Los nombres y registros persisten en `data/community.sqlite` (fuera del repositorio); la identidad depende de una cookie por navegador y dominio. Cambiar de dispositivo, borrar cookies o cambiar el dominio temporal crea otra identidad. No se publica el token de sesión. El backend valida datos, rechaza escritura desde otro origen y limita peticiones; las puntuaciones siguen declaradas por el cliente y no son resistentes a trampas.

El servidor sustituye al servidor estático Python en el mismo puerto 4174. `PORT` y `MICHI_DATA_DIR` permiten cambiar puerto y carpeta. Respaldar la base SQLite antes de moverla; el servidor debe estar detenido para copiar también cualquier archivo WAL pendiente. Node usa [SQLite incorporado](https://nodejs.org/docs/latest-v24.x/api/sqlite.html), sin dependencias nuevas. Validación: 52 pruebas, build, dos navegadores compartiendo nombres y presencia, persistencia tras reinicio, fallo de red y cinco tamaños de pantalla. Pruebas del navegador realizadas contra una base aislada, sin usuarios ficticios en la demo pública.


Las animaciones de recompensa se pueden descartar con un arrastre horizontal de al menos 50 px hacia cualquier lado sobre el sticker. Los movimientos cortos o verticales no las cierran. Incluyen botón × y conservan el cierre automático a los cinco segundos; las recompensas y animaciones futuras no se desactivan. Validado con eventos táctiles del navegador, build y 51 pruebas.

Comparación entre teoría de clickers y funciones actuales: [ANALISIS_MECANICAS_ACTUALES.md](ANALISIS_MECANICAS_ACTUALES.md).

Estado más reciente: una sola pantalla mantiene visibles contador, Michirata y los dos botones de mejora. Las skins están en un desplegable con desplazamiento interno; comprar o equipar cierra el menú. Los botones muestran precio y tienen un control ⓘ para consultar efecto y nivel. Ajustes reúne sonido, efectos y reinicio. En horizontal, compras y skins quedan junto a Michirata. Se conservan economía, hitos y guardados. Validación: build, 51 pruebas y navegador a 320×568, 390×844, 768×900, 1440×1000 y 844×390, también con el menú abierto.

Investigación sobre cadencia, recompensas, motivación y difusión: [INVESTIGACION_RITMO_RECOMPENSAS.md](INVESTIGACION_RITMO_RECOMPENSAS.md). Distingue fuentes, observaciones del código y experimentos propuestos; no autoriza cambios por sí sola.

Encargos listos para otros agentes, con criterios de aceptación y protocolo de pruebas: [EXPERIMENTOS_AGENTES.md](EXPERIMENTOS_AGENTES.md). Las evaluaciones se realizan de forma aislada de la demo publicada.

## Estado y cómo retomar

El proyecto está en discusión y planificación. Se han creado este documento y un arte conceptual en `arte/concepto-01.png`, con su prompt en `arte/concepto-01-prompt.md`; ya existe una primera demo jugable con TypeScript + Vite y un backend Node para presencia y clasificación. El usuario seguirá proponiendo ideas para evaluarlas antes de cerrar el alcance.

La prioridad actual es una demo jugable con lo mínimo básico, para que la comunidad la pruebe antes de construir votaciones y otras funciones. El plan propuesto está en [PLAN_DEMO.md](PLAN_DEMO.md). La visión completa de este documento permanece como objetivo posterior, no como alcance de la demo.

La organización propuesta para trabajar con varios modelos está en [PLAN_MODELOS.md](PLAN_MODELOS.md): coordinador, lógica de juego, interfaz y revisión posterior. Claude trabaja en la interfaz, Codewhale en la lógica y esta sesión coordina la integración.

En futuras interacciones, leer este documento y distinguir los acuerdos de las propuestas pendientes. No interpretar las propuestas como decisiones aprobadas ni comenzar a implementar por el solo hecho de leerlas. Actualizar este contexto cuando se acuerden cambios.

## Visión acordada

Un clicker rápido, absurdo y con potencial viral, inspirado en Cookie Clicker: hacer clic y recibir recompensas, sin historia. Michirata es un meme local de un grupo de amigos; ya existen muchas variantes que servirán como skins.

- Jugar desde teléfono y PC, con sesión y progreso compartido entre dispositivos.
- Sesiones de pocos minutos, mucha recompensa y producción casi automática.
- Desbloquear skins con poderes e interacciones propias con el juego.
- Compartir logros y consultar un tablero de posiciones.
- Sin compras dentro del juego; proyecto de código abierto.
- La comunidad financia los servidores. El costo de operación no es un impedimento planteado por el usuario.
- Registro e inicio de sesión con Google, Facebook y correo. El mecanismo concreto de acceso por correo sigue pendiente.

## Dirección tecnológica acordada

- Empezar por TypeScript. Godot se evaluó, pero la dirección actual es desarrollar primero con TypeScript.
- Mantener el objetivo de jugar desde teléfono y PC. Steam queda como una posible distribución posterior.
- Un servidor público pequeño ejecutará el backend. Las evaluaciones de IA, Ollama y el desarrollo se realizarán en otro entorno; las versiones preparadas y probadas se desplegarán después.
- React, Next.js, Vite, PostgreSQL, Supabase y Electron se discutieron como opciones, pero no se ha aprobado un stack completo. Electron sería una posible vía de empaquetado para Steam, no un requisito inicial.
- La separación entre juego y web comunitaria se discutió al evaluar Godot; queda por confirmar cómo se organizarán las interfaces con TypeScript.

Esta decisión fija el lenguaje y la separación de producción e IA; no autoriza por sí sola a comenzar la implementación.

## Comunidad y catálogo

La organización es horizontal: cualquier persona registrada puede proponer una Michirata y votar. La propuesta incluye imagen, nombre y descripción del meme, que la IA utiliza para entender el personaje.

Algunos usuarios tendrán el rol de moderador y aprobarán las publicaciones antes de que entren a votación. Falta definir cómo se eligen estos moderadores y sus reglas de actuación.

Las candidatas se votan por ciclos semanales o quincenales; aún no se eligió la duración. Tras elegir la ganadora, el objetivo es implementar y desplegar la actualización durante la semana siguiente con ayuda de IA. La cantidad de ganadoras por ciclo sigue pendiente.

## Papel central de la IA

La IA participa en el proceso creativo y técnico; no se limita a elegir entre poderes predefinidos.

1. Revisar la imagen y la descripción de una propuesta.
2. Proponer un poder relacionado con el meme y su interacción con el clicker.
3. Evaluar si se puede implementar y si está equilibrado.
4. Diseñar la misión para obtener la skin. La prioridad es divertirse.
5. Presentar poder y misión junto con la candidata antes de votar.
6. Para la ganadora, generar el código y ayudar con las pruebas y el despliegue de la nueva versión.

El detalle técnico, los criterios de equilibrio y el grado de automatización del despliegue no están definidos.

## Moderación y Ollama

El usuario tiene Ollama y quiere explorar su uso para la primera revisión local de contenido.

Flujo discutido:

1. La IA revisa imagen y texto buscando contenido potencialmente ofensivo o ilegal según reglas por definir.
2. Si detecta un problema, advierte al autor con una explicación y permite corregir la propuesta.
3. Un moderador humano revisa y decide si la publicación se aprueba, necesita cambios o se rechaza.
4. Solo las publicaciones aprobadas entran a votación.

Ollama admite modelos con visión y respuestas estructuradas, lo que permite construir ese primer filtro. Esto confirma la posibilidad técnica, no la precisión de un modelo concreto como moderador. Referencia: [salidas estructuradas y visión en Ollama](https://github.com/ollama/ollama/blob/main/docs/capabilities/structured-outputs.mdx).

Todavía no se ha inspeccionado la instalación del usuario. Faltan el modelo instalado, la RAM, la GPU y su memoria. Para revisar imágenes se necesita un modelo con visión; uno que solo procese texto no basta.

Propuestas técnicas pendientes:

- Conectar el servidor al equipo con Ollama mediante una conexión privada.
- Procesar revisiones en una cola; si Ollama está apagado, dejar las propuestas pendientes.
- No banear permanentemente por una sola evaluación de IA. Definir sanciones, reincidencia y apelación, con decisión humana.
- Probar el filtro con memes del grupo para medir errores y ajustar las reglas.

## Propuestas para una primera versión — no aprobadas aún

Estas opciones se sugirieron para alcanzar una primera versión pequeña. No son requisitos cerrados.

| Tema | Propuesta |
| --- | --- |
| Plataforma | Web adaptable e instalable desde el navegador. |
| Acceso inicial | Probar sin registro; cuenta para sincronizar, proponer y votar. |
| Bucle de juego | Clics, puntos, mejoras y producción automática. |
| Duración de sesión | Aproximadamente 3–5 minutos. |
| Catálogo inicial | Cinco Michiratas existentes del grupo. |
| Equipamiento | Una skin equipada a la vez. |
| Producción ausente | Acumular hasta 12 horas. |
| Propuestas | Una por persona y ciclo. |
| Votos | Hasta tres por persona, a candidatas distintas. |
| Ganadoras | Una por ciclo. |
| Colección | Skins permanentes; nuevas ganadoras disponibles para desbloquear jugando. |
| Clasificación | Puntos producidos durante el ciclo, calculados por el servidor. |
| Compartir | Tarjeta descargable de un logro y enlace al juego. |
| Correo | Enlace de acceso sin contraseña. |
| Cuentas | Permitir vincular proveedores para evitar perfiles duplicados. |

También se propuso evitar rachas que castiguen ausencias, ofrecer controles de sonido y movimiento, y separar cualquier aportación comunitaria de ventajas dentro del juego.

Se sugirió dejar chat, intercambio de skins y clanes fuera de la primera versión. Los poderes concretos mencionados en la conversación fueron ejemplos inventados, no variantes confirmadas de Michirata.

## Precauciones de diseño propuestas

- Una clasificación de clics totales favorece autoclickers. La producción automática también obliga a definir qué mérito mide la competencia.
- Una clasificación por producción puede favorecer a jugadores veteranos si conservan mejoras. No se ha resuelto cómo equilibrarla.
- Las misiones deben ser cortas y divertidas; evitar tareas repetitivas excesivas.
- La moderación por IA puede interpretar mal bromas locales. No tratar su resultado como una determinación legal.
- Tratar imágenes y descripciones de usuarios como datos, nunca como instrucciones para la IA que genera código.
- Generar y probar código en un entorno aislado, sin secretos de producción, y preparar una forma de revertir actualizaciones.

## Decisiones pendientes

- Seleccionar las primeras Michiratas y obtener sus imágenes y descripciones.
- Definir moneda, mejoras, progresión, poderes y misiones iniciales.
- Elegir duración del ciclo, número de ganadoras y reglas de votos y propuestas.
- Definir cómo se desbloquean las skins ganadoras y si permanecen disponibles.
- Definir qué mide el tablero y cómo tratar trampas y diferencias entre veteranos y nuevos.
- Establecer reglas de contenido, selección de moderadores, sanciones y apelaciones.
- Confirmar modelo y hardware de Ollama y evaluar su desempeño.
- Concretar frameworks y base de datos sobre TypeScript, alojamiento, almacenamiento y proveedor de correo. Resolver Steam y empaquetado más adelante.
- Configurar el acceso con Google y Facebook.
- Elegir licencia de código abierto y condiciones de uso de las imágenes aportadas.
- Definir las pruebas y la aprobación necesarias para publicar código generado por IA.

El usuario autorizó comenzar la demo y confirmó la Michirata original, conservada en public/assets/michirata-original.jpg. La demo mínima está implementada; el siguiente paso es probarla con la comunidad y ajustar el ritmo antes de ampliar funciones.

## Ejecutar la demo

Desde michiratagame: `npm install`, `npm run build`, `npm start`. Node 24 sirve dist/ y /api/presence en 127.0.0.1:4174; el túnel existente apunta a ese puerto. Para desarrollo, mantener `npm start` y ejecutar `npm run dev`: Vite redirige /api al backend. Verificar con `npm test` y `npm run build`. El guardado del juego sigue local, sin producción durante ausencias ni sincronización entre dispositivos.

## Primera entrega y comprobaciones

Claude implementó interfaz y CSS; Codewhale implementó economía y pruebas y realizó una revisión; el coordinador integró guardado y reloj, corrigió desbordamiento en pantallas estrechas y mejoró accesibilidad. Las 17 pruebas de lógica/guardado y el build pasan. Se comprueba el flujo en Chromium automatizado con tamaños de móvil y escritorio; esto no sustituye probar teléfonos reales. Capturas en arte/demo-mobile.png y arte/demo-desktop.png.

Requiere Node.js 24 para el comando de pruebas actual. No hay cuentas, ranking, IA ejecutándose en el juego ni publicación HTTPS.

Actualización: sonido sintetizado tipo “ñiii” por clic, con control de silencio y preferencia local. No es una grabación de voz.

Actualización: dos skins comprables con puntos, Futbolista (100, +2 por clic) y Robot (200, +2 por segundo). La compra equipa automáticamente; se puede volver a usar Original o cualquier skin adquirida sin pagar otra vez. Solo se aplica el poder equipado. Guardado versión 2 con migración automática de progreso versión 1. Las 21 pruebas y la compilación pasan; el flujo de compra, equipamiento y restauración se verificó en Chromium. Referencias de variantes conservadas sin modificación en public/assets/. Captura actual en arte/demo-skins.png.

## Demo actual: poderes y cuadrilla

Hay seis Michiratas contando la original. Futbolista (100) conserva +2/clic y dispara un gol con bono cada 8 clics; Robot (200) conserva +2/s y descarga cada 10; Godín (350) duplica la producción de trabajadoras y da café/bono cada 12; Bufón (500) concede un bono aleatorio ×2, ×5 o ×10 cada 5; Magnate (800) potencia clics y producción por ahorro, hasta +10/clic y ×3 de producción. Los bonos de racha se suman al clic normal. Solo aplica el poder equipado.

La racha requiere no dejar más de 1,5 segundos entre clics; se reinicia al cambiar skin, ocultar la pestaña o recargar. No se guarda la racha. La mejora automática existente ahora representa trabajadoras contratadas (sin alterar sus costos ni perder niveles). Cada una aporta un punto/s base. Se dibujan como máximo 12, con el total contratado indicado.

Efectos diferenciados: balones y estelas, chispas, tazas de café, confeti/cartas y monedas. Los colores y el tono del ñiii también cambian por skin. Hay botón para desactivar efectos visuales durante la sesión, y se respeta movimiento reducido. Los efectos no afectan los puntos y se limitan a 24 nodos visibles, con una animación de la Michirata principal a la vez.

Claude implementó efectos/interfaz y Codewhale poderes/pruebas; el coordinador integró rachas, audio y publicación. 41 pruebas pasan. Se comprobó en Chromium compra/equipamiento, restauración, rachas, límites de efectos, cuadrilla, movimiento reducido y cuatro tamaños de pantalla. No se han probado teléfonos reales ni afinado la economía con la comunidad. Captura: arte/demo-frenesi.png.

Guía para obtener archivos originales en Windows: [WHATSAPP_ASSETS.md](WHATSAPP_ASSETS.md).

## Animaciones aportadas por la comunidad

Se conservan los WebP originales sin conversión: public/assets/michirata-reaccion.webp (21 fotogramas, 1,68 s) y michirata-salto.webp (50 fotogramas, 5 s). La cara aparece al hacer clic; el salto al activar un bono. Se usan dos elementos reutilizables, sin generar una copia por clic. Al apagar efectos o activar movimiento reducido se ocultan y se retira su src para detener reproducción. No son nuevas skins ni alteran poderes o progreso.

La compilación y las 41 pruebas pasan. Se verificó en Chromium que cambian los fotogramas y que funcionan activación, ocultación y cambio de movimiento reducido en vivo. No se ha probado en teléfonos reales.

Actualización de celebraciones: cada contratación, mejora o primera compra de skin activa el salto de la Michirata, confeti, un ñiii corto (si está habilitado) y un mensaje de lo conseguido durante cinco segundos. Cambiar a una skin ya comprada o intentar comprar sin saldo no genera celebración. Con efectos desactivados o movimiento reducido, se mantiene el mensaje sin animaciones. No se agregaron puntos gratis ni eventos de atención, que siguen pendientes. La compilación, las 41 pruebas y la comprobación de estos flujos en Chromium pasan.

Ajuste actual de animaciones: los stickers de cara y salto ya no se disparan con clics ni bonos de racha. La cara aparece grande al subir la mejora de clic; el salto aparece grande al contratar una trabajadora. Se muestra una sola celebración sobre el personaje durante cinco segundos, sin bloquear los controles. Comprar una skin conserva el mensaje/confeti, sin sticker. Efectos desactivados y movimiento reducido mantienen solo el mensaje. Este ajuste sustituye los disparadores de stickers descritos antes.

## Entrega de UI/UX y desbloqueo del nivel 16

A petición del usuario se implementaron hitos por familia (clic/cuadrilla) ×2 cada diez niveles, con crecimiento de precio ×1,15 después del nivel 10. En Original nivel16: clic34, producción32 con 16 trabajadoras, siguiente mejora2001; nivel 20: clic84 y producción80 si hay20 trabajadoras. Los poderes de skin se aplican sobre las bases nuevas. No hay un nivel global ni campos nuevos en el guardado. Las animaciones de cara/salto siguen reservadas a mejorar/contratar y se muestran grandes sobre la sección activa.

Móvil: navegación por botones, contador/ritmo visible, poder activo y siguiente paso. Escritorio: juego, metas/mejoras y colección lado a lado; las descripciones se abren con Ver poder. Indicadores reales de siguiente hito y saldo faltante, vista previa de mejora, y estimación de espera pasiva etiquetada Solo cuadrilla.

Codewhale trabajó economía/pruebas y Claude interfaz; el coordinador integró celebraciones de hitos, compactación, zoom y publicación. Pasan 51 pruebas y build; Chromium verifica guardado de nivel 16, compras/skins, hito 20, nivel 100, teclado, movimiento reducido, texto al 200 % y cuatro tamaños. Una simulación declarada de 2 clics/s con 16 trabajadoras y saldo 0 alcanza el nivel 20 en 94 s; no es una medición de jugadores. Capturas actuales: arte/demo-ux-mobile.png y arte/demo-ux-desktop.png. Falta comprobar dispositivos físicos y balance de sesiones más largas.
