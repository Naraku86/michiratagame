# Plan de acción: primera demo jugable

Fecha: 13 de octubre de 2026.

## Objetivo

Compartir un enlace con la comunidad para probar un clicker de Michirata en teléfono y PC. Comprobar si hacer clic, comprar mejoras y ver subir los puntos resulta divertido antes de construir funciones comunitarias.

El usuario autorizó iniciar la implementación el 13 de octubre y proporcionó la imagen original. Se adopta TypeScript + Vite + HTML/CSS para esta demo.

## Alcance mínimo propuesto

- Una pantalla adaptable a teléfono y PC.
- Michirata original como botón principal. Ampliación autorizada: Futbolista, Robot, Godín, Bufón y Magnate, comprables con puntos y equipables con poderes distintos.
- Un clic o toque genera un punto, con rebote visual y un indicador breve de recompensa.
- Contadores de puntos disponibles, puntos por clic y producción por segundo.
- Dos mejoras comprables con puntos: aumentar puntos por clic y aumentar producción automática. Ambas se pueden comprar varias veces, con costo creciente visible.
- Guardado automático local en el navegador y restauración al volver a abrirlo.
- Reinicio del progreso con confirmación para facilitar nuevas pruebas.
- Sin producción durante ausencias en esta primera demo: no acumula con el juego cerrado o suspendido. Explicar este límite en la interfaz.
- A petición del usuario, sonido nasal sintetizado tipo “ñiii” en cada clic, con botón para activar/silenciar y preferencia local. Respetar movimiento reducido y permitir teclado.

La intención es que una sesión de pocos minutos permita comprar ambas mejoras y notar claramente sus efectos. Los precios se ajustarán jugando, sin fijar todavía la economía definitiva.

## Orden de trabajo

### 1. Preparar una base pequeña

Propuesta tecnológica: TypeScript, Vite y HTML/CSS, sin framework de interfaz para esta única pantalla. Confirmar esta elección al iniciar implementación. No agregar backend ni arquitectura para funciones futuras.

Preparar la imagen de la Michirata original; las capturas de WhatsApp son referencias, no recursos finales. Conservar un archivo fuente y el recurso preparado.

### 2. Construir el ciclo jugable completo

Implementar clics, puntos, compras y producción automática. Mostrar precio y efecto de cada mejora; impedir compras sin puntos suficientes. Asegurar que la producción dependa del tiempo activo transcurrido, no de contar cuadros de animación.

### 3. Completar guardado y comprobaciones

Guardar progreso local. Validar el contenido guardado y manejar datos dañados o almacenamiento no disponible sin bloquear el juego. No sobrescribir silenciosamente un guardado incompatible.

Agregar pruebas pequeñas para puntos, compras, aumento de costos y restauración. Revisar interacción táctil, teclado, movimiento reducido y comportamiento al suspender o reabrir el juego.

### 4. Publicar la demo para pruebas

Generar archivos estáticos y publicarlos en una dirección HTTPS. No requiere servidor de lógica de juego. Elegir alojamiento antes de publicar.

Comprobar al menos un teléfono y una PC reales. No considerar esta comprobación terminada si solo se ha usado una simulación de pantalla móvil.

### 5. Recoger comentarios y hacer una segunda iteración

Usar inicialmente el grupo de WhatsApp, sin formularios ni analítica dentro del juego. Pedir que prueben unos minutos y comenten:

- ¿Entendiste cómo jugar sin explicación?
- ¿Compraste las dos mejoras y notaste la diferencia?
- ¿En qué momento se volvió lento o aburrido?
- ¿Funcionó bien en tu dispositivo?
- ¿Te dieron ganas de seguir jugando?

Anotar problemas de funcionamiento y ajustes de ritmo. Corregirlos antes de ampliar el alcance.

## Criterio para compartir la primera demo

- El enlace abre y permite jugar inmediatamente, sin cuenta.
- Clics, compras y producción automática funcionan en teléfono y PC.
- Ambas mejoras pueden conseguirse en una prueba de pocos minutos.
- Recargar conserva el progreso; reiniciar pide confirmación.
- Los contadores y botones se entienden y no se salen de la pantalla.
- No hay errores que impidan jugar en los dispositivos probados.

## Qué viene después, según las pruebas

La ampliación actual incluye cinco skins comprables, rachas con bonos y una cuadrilla visible. La mejora automática existente representa trabajadoras contratadas; no se agregó una segunda economía. Las misiones y funciones comunitarias siguen pendientes.

Después se decidirá cuándo incorporar cuentas y sincronización, progreso durante ausencias, ranking, propuestas, revisión con Ollama, moderación y votaciones. Steam y empaquetado siguen pendientes.

## Límites de esta demo

El progreso pertenece a ese navegador y dispositivo; borrar sus datos puede eliminarlo. Los puntos son manipulables y no sirven para una clasificación competitiva. No habrá votaciones, cuentas, IA en ejecución, servidor de juego ni integración con Steam. Esos límites no cambian la visión de largo plazo del README.
