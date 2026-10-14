# UI/UX y progreso para sesiones avanzadas

## Problema observado

El usuario reporta estancamiento alrededor del nivel 16. Los niveles son de mejoras o trabajadoras, no un nivel global del personaje. Antes, el costo siguiente de clic era 9.853 puntos y el clic base valía 17; la mejora aportaba solo +1. Todas las skins ya desbloqueadas dejaban poco que anticipar.

En móvil, juego, mejoras y seis skins formaban una pantalla larga. Ver más efectos no corrige por sí solo estos problemas de economía y orientación.

## Referencias y límites

- [Visibilidad del estado, NN/g](https://www.nngroup.com/articles/visibility-system-status/): mostrar resultados y estado ayuda a entender qué ocurrió y elegir el siguiente paso. Aplicación: próxima meta, puntos faltantes y efecto de una compra.
- [Controles táctiles, Game Accessibility Guidelines](https://gameaccessibilityguidelines.com/ensure-interactive-elements-virtual-controls-are-large-and-well-spaced-particularly-on-small-or-touch-screens/): separar y ampliar controles para facilitar interacción. Decisión del proyecto: botones de al menos 44 píxeles CSS; esa cifra no equivale a una medida física universal.
- [Texto en juegos, Microsoft XAG 101](https://learn.microsoft.com/en-us/gaming/accessibility/xbox-accessibility-guidelines/101): legibilidad según dispositivo y opciones de presentación. Evitar descripciones diminutas y revisar zoom.
- [Matemática de idle games, Anthony Pecorella/Kongregate](https://www.kongregate.com/id/pages/the-math-of-idle-games-part-i): analiza el conflicto entre costos exponenciales y producción y describe hitos ×2 de AdVenture Capitalist a cantidades 25 y 50. Es un análisis de diseño de un productor del juego, no un ensayo clínico ni una demostración de viralidad.

Los hitos cada diez niveles y la curva nueva son decisiones propias para probar. No se copian los números de AdVenture Capitalist ni se presentan como resultados de estudios.

## Cambio de progresión autorizado

- Conservar puntos, niveles y skins. No hay reinicio ni prestigio.
- Multiplicador base por familia: 2 elevado a la parte entera de nivel/10.
- Clic base: (1 + nivel de clic) × multiplicador de clic.
- Producción base: trabajadoras × multiplicador de trabajadoras.
- Costos: base × 1,5 elevado a mínimo(nivel,10) × 1,15 elevado a máximo(0,nivel−10), redondeado hacia arriba y con límite existente.
- Los hitos ya ganados se reconocen automáticamente al cargar: no requieren comprar otra vez ni guardar un nuevo campo.
- Los poderes de skin siguen aplicándose sobre esas bases. Magnate puede perder parte del bono de ahorro al gastar, y la interfaz debe explicarlo.

| Nivel de cada familia | Clic base anterior | Clic base nuevo | Producción base anterior | Producción base nueva | Precio clic anterior | Precio clic nuevo |
| --- | --- | --- | --- | --- | --- | --- |
| 9 | 10 | 10 | 9 | 9 | 577 | 577 |
| 10 | 11 | 22 | 10 | 20 | 865 | 865 |
| 16 | 17 | 34 | 16 | 32 | 9.853 | 2.001 |
| 19 | 20 | 40 | 19 | 38 | 33.253 | 3.043 |
| 20 | 21 | 84 | 20 | 80 | 49.879 | 3.500 |

Son ejemplos sin poderes de skin. La producción supone que el número de trabajadoras coincide con el nivel de la fila. No refundir puntos gastados: se conserva el estado y se ajustan beneficios/precios futuros.

## Jerarquía visual

### Teléfono

Juego, mejoras y colección en secciones con navegación por botones nativos. Puntos y producción deben seguir siendo fáciles de encontrar. La primera vista prioriza personaje tocable, poder equipado y un siguiente objetivo. Botones separados, avisos visibles y compra alcanzable sin recorrer toda la colección.

### Escritorio

Paneles de juego, progreso/mejoras y colección visibles juntos. Aprovechar el ancho, sin agrandar innecesariamente el personaje ni convertir seis skins en una lista vertical enorme. Mantener una lectura clara de acciones principales y controles secundarios.

### Metas y recompensas

Mostrar nivel, próximo hito, compras restantes, progreso real y multiplicador actual/siguiente. Mostrar puntos faltantes para la siguiente compra. Si se muestra espera estimada, calcular solo producción pasiva y etiquetar “Solo cuadrilla”; no asumir clics futuros ni presentarla como una garantía.

Al cruzar un hito, explicar la potencia permanente obtenida. Conservar cara grande exclusivamente para mejora de clic y salto para contratación. Compras de skin tienen texto/confeti; los clics y bonos no disparan esos stickers.

## Comprobaciones requeridas

- Tests de curvas e hitos 9/10 y 19/20; cálculos de nivel 16 y nivel 100.
- Reabrir guardado v2 con niveles avanzados sin perder saldo, mejoras ni colección.
- Una sola aplicación de multiplicadores derivados; no acumulación por recargar.
- Metas correctas cuando una familia llega a 100.
- Navegación por teclado, movimiento reducido, silencio y efectos desactivados.
- Revisar tamaños 320, 390, 768 y 1440; zoom y avisos de almacenamiento.
- La celebración debe verse también al comprar desde la sección Mejoras.
- Simular el tramo 16→20 con política y tasa de clics declaradas; no confundir ese cálculo con un jugador real.

## Lo que sigue pendiente

Pruebas con teléfonos reales, preferencias de jugadores y ajuste de economía a niveles muy altos. No incorporar misiones, eventos de atención, prestigio o monedas nuevas en este cambio. Registrar luego si se entiende la próxima meta, si una compra se siente significativa y cuándo reaparece una espera larga.

## Resultado de esta entrega

Implementado y publicado en el túnel de la demo. Las 51 pruebas y el build pasan. Chromium verifica cuatro tamaños de pantalla, guardado avanzado, compras y metas, navegación, teclado, movimiento reducido y ampliación de texto al 200 %. Capturas en arte/demo-ux-mobile.png y arte/demo-ux-desktop.png. La simulación de Original con 16 niveles de clic, 16 trabajadoras, saldo cero y dos toques/s alcanzó el nivel 20 en 94 s comprando solo clic; es un escenario declarado, no una prueba con personas. Falta hardware real y sesiones largas.
