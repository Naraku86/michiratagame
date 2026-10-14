# Ritmo, recompensas y difusión de Michiratagame

Fecha: 13 de octubre de 2026. Este informe describe la investigación y la versión de referencia de ese momento. Posteriormente el usuario autorizó el cambio de UI/UX y curva por hitos documentado en UI_UX_PROGRESION.md; consultar ese archivo y el código para los valores actuales. Las alternativas de cadencia/eventos siguen siendo propuestas.

## Conclusión para el proyecto

Probar una respuesta pequeña inmediata, una meta corta legible y una recompensa que cambie lo que el jugador puede hacer. Reservar las animaciones grandes para logros y compras, como pidió el usuario. Incorporar ritmo y sorpresas gradualmente, manteniendo la opción de dejar trabajar a la cuadrilla.

Disfrutar, volver a jugar y compartir son resultados distintos. Ninguno de los estudios consultados garantiza viralidad ni demuestra una cadencia óptima para este clicker.

## Evidencia y alcance

1. **Respuesta de la interacción.** La revisión de Pichlmair y Johansen organiza el game feel en física, amplificación y apoyo a la intención del jugador. Para nosotros, es una base para diseñar una respuesta que deje claro que el toque ocurrió y cuánto valió, no una fórmula probada de retención. [Designing Game Feel: A Survey](https://arxiv.org/abs/2011.09201).

2. **Intensidad de efectos.** Kao comparó cuatro intensidades de feedback en un RPG de acción, con 3.018 participantes. Las condiciones sin efectos y con efectos extremos tuvieron peores resultados que las intermedias en experiencia, motivación, tiempo y rendimiento. Es evidencia en ese juego, no un límite universal de partículas para móviles. [The effects of juiciness in an action RPG](https://experts.illinois.edu/en/publications/the-effects-of-juiciness-in-an-action-rpg/).

3. **Motivación más allá de premios.** Los estudios de Ryan, Rigby y Przybylski relacionan competencia, autonomía y conexión con disfrute e intención de jugar. Aplicación propuesta: entender y dominar un poder, elegir cómo producir y reconocer los memes de amigos. Las recompensas numéricas no sustituyen esas experiencias. [The Motivational Pull of Video Games](https://link.springer.com/article/10.1007/s11031-006-9051-8).

4. **Proximidad a una meta.** Kivetz, Urminsky y Zheng observaron aceleración del esfuerzo al acercarse a premios en programas de recompensas. Aplicarlo a una barra de skin o racha es una hipótesis de transferencia, no un experimento con Michiratagame. Usar progreso real y precios claros. [The Goal-Gradient Hypothesis Resurrected](https://business.columbia.edu/faculty/research/goal-gradient-hypothesis-resurrected-purchase-acceleration-illusionary-goal).

5. **Automatización y decisiones.** El análisis de Kittens de Alharthi y colaboradores plantea que parte del placer incremental está en pasar de actuar más a planear más. Es una lectura cualitativa de un juego, no una prueba de que automatizar siempre mejora retención. Nuestra cuadrilla puede dar espacio para decidir y aprovechar eventos. [The Pleasure of Playing Less](https://research.monash.edu/en/publications/the-pleasure-of-playing-less-a-study-of-incremental-games-through/).

6. **Compartir contenido.** Berger y Milkman estudiaron artículos y experimentos de transmisión, encontrando relación entre activación emocional y difusión. Aplicación propuesta: momentos absurdos, sorpresa positiva y logros reconocibles por amigos. El estudio no prueba que un clicker con confeti se vuelva viral. [What Makes Online Content Viral?](https://journals.sagepub.com/doi/10.1509/JMR.10.0353).

No se utiliza “dopamina por clic” como explicación medida de nuestra demo. No medimos actividad cerebral ni tenemos evidencia de un número mágico de clics/segundo.

## Qué observamos en el código actual

- La racha cuenta clics siempre que no pasen más de 1,5 segundos entre ellos. No detecta regularidad: intervalos de 100 ms y de 1.400 ms mantienen la misma racha.
- Cada skin dispara bonos tras cantidades fijas. La velocidad aumenta el número de bonos por minuto, aunque el jugador no esté siguiendo un ritmo.
- El costo de mejoras crece ×1,5 por nivel, mientras su beneficio base crece linealmente. Conviene observar cuándo el tiempo hasta la próxima compra se vuelve demasiado largo.
- Las animaciones grandes ya se reservan para mejoras y contrataciones; este acuerdo permanece.

Promedio calculado con tap() para 120 clics, sin mejoras, trabajadoras ni producción por tiempo, sin alcanzar el límite de puntos y manteniendo racha continua:

| Skin | Precio | Puntos por clic, incluyendo bonos |
| --- | --- | --- |
| Futbolista | 100 | 5,50 |
| Robot | 200 | 3,00 |
| Godín | 350 | 1,25 |
| Bufón | 500 | 1,74 de valor esperado |

Para Bufón se ponderaron ×2 con probabilidad 0,6, ×5 con 0,3 y ×10 con 0,1. Es un cálculo esperado, no una sesión observada. Robot además produce automáticamente y Godín potencia trabajadoras: la tabla no compara todo su valor. Sí muestra que Bufón, orientado a clics, paga bastante menos que Futbolista pese a costar más. Revisar su frecuencia o tamaño de bonos antes de multiplicar efectos visuales.

## Diseño propuesto del clic

### Tres niveles de respuesta

| Evento | Respuesta sugerida |
| --- | --- |
| Cada clic | Rebote pequeño, ñiii corto, puntos junto al toque y avance legible de una barra. |
| Racha/poder | Color, sonido y partículas propios del poder; premio y motivo visibles. Sin stickers de cara/salto. |
| Compra/mejora/contratación | Celebración grande, mensaje de lo ganado y cambio permanente visible. |

Una recompensa necesita tres cosas: anticipación (“me faltan dos”), explicación (“activé un gol”) y consecuencia (“ahora puedo comprar algo”). Conservar lectura de contador y botones durante efectos. Mantener controles de sonido/movimiento y activación por teclado.

### Cadencia: alternativas para comparar, no para sumar todas

| Variante | Mecánica | Hipótesis |
| --- | --- | --- |
| A: racha actual | Bono cada N clics, sin más de 1,5 s de pausa. | Es fácil de entender; sirve como referencia. |
| B: ritmo regular | Probar una ventana de 300–800 ms entre toques; cada toque regular carga un medidor. Un fallo solo deja de cargar, no quita puntos. | Puede aportar sensación de dominio sin exigir la máxima velocidad. |
| C: ráfaga breve | Medidor por clics con un límite inicial de 3 cargas/s; al llenarlo, multiplicador corto y recuperación. Todos los clics siguen dando puntos base. | Puede crear un crescendo con descanso en lugar de acelerar indefinidamente. |

Las ventanas y el límite de cargas son parámetros de prototipo, no resultados científicos ni recomendaciones ergonómicas validadas. Probar ratón, tacto y teclado. No lanzar B y C juntos: no sabríamos qué cambió la diversión.

Si elegimos C, empezar probando 8–12 toques para cargar, 4–6 s de poder y 6–10 s de recuperación. Poder activo puede potenciar trabajadoras para que también haya una decisión entre seguir clicando o comprar. Ajustar potencia con la economía completa.

## Sorpresas y momentos para mirar la pantalla

Propuesta posterior: un solo evento opcional cada 20–40 s visibles, con 6–8 s para responder. Valores de ensayo.

- Michirata fugitiva: tocarla concede un premio inmediato.
- Café: activa temporalmente la producción de la cuadrilla.
- Queso: ofrece un bono con apariencia distinta.

La aparición puede variar, pero la recompensa anunciada debe ser clara. No perder puntos por ignorar un evento; la cuadrilla sigue funcionando. Las sorpresas complementan recompensas garantizadas, no sustituyen el progreso básico.

## Primera sesión: objetivos de diseño, no promesas

- Primer clic: respuesta perceptible inmediatamente.
- En aproximadamente 10–20 s: una primera compra que cambie el comportamiento.
- En 30–60 s: notar la producción de la cuadrilla y activar un poder.
- En 1–3 min: obtener una skin o una meta equivalente visible.
- En 3–5 min: tener una decisión nueva o una satisfacción de cierre.

Ajustar tiempos según observación real. Elegir un solo siguiente objetivo en pantalla; no llenar la demo de misiones y paneles.

## Identidad y difusión

La hipótesis de mayor valor para este grupo es el reconocimiento del meme local: “esta Michirata es de los nuestros”. Probar un momento breve y reconocible que alguien quiera contar o grabar. Después, compartir una tarjeta que muestre skin y logro, con un enlace que abra directamente la demo. Compartir debe ser opcional; no hacerlo requisito para ganar.

No confundir una sesión más larga con más diversión ni con difusión. Separar comentarios de disfrute, regreso voluntario y compartidos.

## Orden de experimentos

1. Mantener una versión de referencia y comprobar tiempo hasta primera compra, primer poder y primera skin.
2. Mejorar la claridad del siguiente objetivo y del motivo del bono. Revisar el valor esperado de Bufón.
3. Comparar la racha actual con una sola alternativa de ritmo, conservando precios, skins y efectos.
4. Probar un único evento de atención si la cadencia funciona.
5. Comparar recompensas visuales suaves y actuales; añadir más solo si ayudan a reconocer eventos.

Para pruebas iniciales basta un grupo pequeño (por ejemplo, 6–10 personas) jugando versiones en orden alternado. Es investigación exploratoria: no implica significancia estadística ni estima viralidad. Registrar dispositivo y experiencia previa con la demo. Empezar desde una copia limpia del progreso, nunca borrar el guardado personal.

Preguntas: ¿qué te dio ganas de seguir?, ¿entendiste cómo activar el poder?, ¿te cansó clicar?, ¿los efectos estorbaron?, ¿qué momento compartirías? Registrar compras/bonos completados y pausas. Si más clics vienen acompañados de más cansancio o menos disfrute, no tratarlo como mejora.

## Recomendación de siguiente paso

Primero claridad y balance, después una barra de ritmo/ráfaga con un premio visible y finalmente un evento opcional. No incorporar simultáneamente todas estas mecánicas. Las propuestas requieren acuerdo antes de cambiar la demo.
