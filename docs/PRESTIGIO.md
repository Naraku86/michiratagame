# Prestigio: diseño mínimo y simulación

Fecha: 13 de octubre de 2026. Esto es solo análisis. No cambia `src/`, `server/`, `package.json` ni la demo, y no activa ningún reinicio. El coordinador decide si se implementa y cuándo.

Archivos:

- `tools/prestige.ts`: fórmulas puras y benchmark determinista. Importa `cost`, `buy`, `tap` y `advance` de `src/game.ts`, y la fatiga real de `src/fatigue.ts`.
- `tools/prestige.test.ts`: 14 pruebas con `node:test`.

```sh
node --experimental-strip-types tools/prestige.ts          # imprime las tablas de este documento (<1 s)
node --experimental-strip-types --test tools/prestige.test.ts
```

Las pruebas de `tools/` no están en `npm test`, porque eso requeriría tocar `package.json`. `tsconfig` tampoco incluye `tools/`, así que `npm run build` no las revisa con tipos.

## 1. Mecánica propuesta

### Moneda: bigotes dorados

```
bigotesTotales(ganadoHistórico) = floor( cbrt( ganadoHistórico / 400 000 ) )
bigotesPendientes = bigotesTotales − bigotesReclamados
```

- `ganadoHistórico` suma todo lo que entra por clics, bonos y cuadrilla, ya con la fatiga aplicada. Nunca baja, ni siquiera al gastar. Es un contador distinto del saldo `points`, que sí baja al comprar y vuelve a 0 al hacer prestigio.
- La fórmula depende solo del total acumulado. Da lo mismo reiniciar 1 o 1000 veces: la suma de bigotes es la misma (hay una prueba que lo verifica con 1000 reinicios). Por eso reiniciar seguido no puede generar más bigotes.
- La raíz cúbica hace que cada bigote nuevo cueste más. El mecanismo de prestigio sigue la descripción general de Pecorella: reiniciar a cambio de una moneda persistente que acelera la siguiente vuelta ([Math of Idle Games, Part III](https://www.gamedeveloper.com/design/the-math-of-idle-games-part-iii)). El divisor 400 000 y la raíz cúbica son decisiones nuestras calibradas con la curva real, no datos de esa fuente.

### Condición para reiniciar

Clic **y** cuadrilla en nivel ≥ 40, y al menos 1 bigote pendiente. Con la curva real, el primer bigote llega hacia 35/35, así que la regla de nivel 40 manda en la primera vuelta. En las siguientes manda la ganancia: en la simulación, quien intenta reiniciar en 40 en la tercera vuelta tiene que llegar a 51 para que le toque un bigote.

### Super mejoras (permanentes)

| Id | Nombre | Efecto por nivel | Máx. | Costo del nivel n+1 | Costo total |
| --- | --- | --- | --- | --- | --- |
| garra | Garra dorada | ×(1 + 0,2·n) a todo lo que da un clic, bonos de skin incluidos, **antes** de la fatiga | 5 (×2) | n+1 bigotes | 15 |
| sindicato | Sindicato michi | ×(1 + 0,2·n) a la producción por segundo | 5 (×2) | n+1 | 15 |
| regateo | Regateo | precio ×(1 − 0,04·n), redondeado hacia arriba | 5 (−20 %) | n+1 | 15 |

Llevar todo al máximo cuesta 45 bigotes, es decir, 36,45 mil millones de puntos ganados en total. Los topes de ×2 se eligieron por el límite antitrampa (sección 4). Ninguna super mejora regala niveles iniciales. Así, los hitos 20/40/60/100 siguen pidiendo compras reales.

### Qué se reinicia y qué se conserva

| Se pierde | Se conserva |
| --- | --- |
| Saldo (`points`) | Skins compradas y skin equipada, sin reembolso |
| `clickLevel`, `autoLevel` | Ganado histórico, bigotes, super mejoras, logros, número de vueltas |
| Racha en curso (como al cambiar de skin) | Fatiga (clave aparte, sin cambios), sonido y efectos |
| | Nombre público e identidad del tablero, récord del ranking (lo guarda el servidor con `MAX(best, …)`) |

**Skins: se conservan, sin compensación.** No hace falta compensar nada: las cinco skins de pago suman 1950 puntos y en una vuelta nueva eso se gana en **0,9 min** a 5 clics/s (benchmark). Si en el futuro se decide quitarlas, la compensación exacta debería ser devolver su precio, 1950 puntos, como saldo inicial. Aun así, recomiendo conservarlas.

### Skins y logros nuevos

Las skins nuevas son **solo cosméticas**: marco o aura sobre una imagen existente y ningún poder numérico. Así no cambian el balance y no hace falta tocar `SKINS` ni `isGameState` hasta que el coordinador lo decida.

| Logro | Condición | Recompensa |
| --- | --- | --- |
| Primera vuelta | 1.er prestigio | Skin cosmética **Dorada** |
| Vuelta completa | Prestigio con 100/100 | Skin cosmética **Astral** |
| Tercera vuelta | 3 prestigios | Insignia |
| Colección heredada | Prestigio con las 5 skins de pago | Insignia |
| Sindicato total | Las 3 super mejoras al máximo | Insignia |

## 2. Confirmación en la interfaz

La pantalla de confirmación usa `previewPrestige(game, prestige)`, que devuelve `allowed`, `loses`, `keeps` y `gains`. Así la interfaz no calcula nada por su cuenta. Propuesta de diálogo nativo (`<dialog>`), separado de «Reiniciar progreso»:

```
Reiniciar con prestigio
Pierdes:   1.234 puntos · Mejora de clic nivel 100 · Cuadrilla nivel 100
Conservas: 5 skins (Robot equipada) · fatiga · nombre y récord del tablero · super mejoras
Ganas:     +23 bigotes dorados (tendrás 23 para gastar)
           Logros: Primera vuelta (skin Dorada), Vuelta completa (skin Astral), Colección heredada
           Siguiente bigote al llegar a 5.530 millones de puntos ganados en total
[Cancelar]  [Reiniciar y cobrar 23 bigotes]
```

- El botón principal dice exactamente cuántos bigotes se cobran. El foco inicial va en «Cancelar». Escape cierra.
- Si `allowed.ok` es falso, el botón no aparece y se explica el motivo: `levels` → «Llega a nivel 40 en clic y cuadrilla»; `no-gain` → «Aún no ganas un bigote nuevo; faltan N puntos».
- El reinicio duro actual sigue siendo otra acción. Al integrar hay que decidir si también borra el prestigio. Recomiendo que pida una segunda confirmación que lo diga explícitamente.

## 3. Guardado y migración

Se propone un guardado versión 3: `{ version: 3, state: GameState, prestige: PrestigeState }`. `GameState` queda igual (mismas reglas de `isGameState`) y `prestige` se valida con `isPrestigeState`. Esta revisa la coherencia: `claimed ≤ bigotesTotales`, `spent = Σ n(n+1)/2` y topes por mejora.

Migración de v2 sin inventar historia. El historial real no existe, y hay dos opciones honestas:

1. **`derived-floor` (recomendada):** `ganadoHistórico = saldo + Σ precios actuales de los niveles comprados + precios de las skins`. Es un **mínimo comprobable** calculado desde el propio guardado, no un historial. La curva anterior (×1,5 en cada nivel) nunca fue más barata que la actual, así que lo gastado de verdad fue igual o mayor. Se marca `lifetimeBasis: 'derived-floor'` y la interfaz puede decir «contado desde la actualización; incluye un mínimo calculado de tu partida anterior». Un jugador migrado en 100/100 recibe 23 bigotes, los mismos que quien llega a 100/100 por primera vez.
2. **`zero`:** el contador empieza en 0. Es más estricto, pero alguien migrado en 60/60 no podría reiniciar hasta volver a ganar 1,1 millones.

Las versiones v1 y v2 siguen migrando como hoy. Si `prestige` es inválido, se trata igual que un guardado dañado: se conserva y no se sobrescribe.

## 4. Resultados del benchmark

Supuestos:

- Pasos de 1 s de juego activo (la pestaña oculta no produce).
- Clics repartidos de forma uniforme a 5 o 1 por segundo, con la racha continua.
- `roll = 0,5`, fatiga real.
- Cada segundo se compra repetidamente la mejora más barata, sea de clic o de cuadrilla.
- Skin Original salvo que se indique otra.
- Después de cada prestigio, los bigotes se gastan en la mejora de menor nivel.
- No se modelan pausas, compras de skins durante la vuelta ni decisiones humanas.

Son tiempos de un jugador mecánico y sirven para comparar variantes, no para predecir a personas reales.

### Puntos ganados por umbral (ambas familias, curva real)

| Nivel | Puntos ganados (mínimo) | Bigotes totales |
| --- | --- | --- |
| 20 | 57.798 | 0 |
| 40 | 1.133.268 | 1 |
| 60 | 18.734.602 | 3 |
| 100 | 5.021.557.380 | 23 |

### Primera, segunda y tercera vuelta, 5 clics/s

| Reinicio en | Vuelta | Mejoras (g/s/r) | →20 | →40 | →60 | →100 | Duración | Bigotes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 40 | 1 | 0/0/0 | 5,5 min | 16,9 min | | | 16,9 min | 1 |
| 40 | 2 | 1/0/0 | 4,7 min | 14,3 min | | | 15,5 min | 1 |
| 40 | 3 | 1/1/0 | 4,6 min | 14,1 min | | | 25,6 min (llega a 51) | 1 |
| 60 | 1 | 0/0/0 | 5,5 min | 16,9 min | 46,3 min | | 46,3 min | 3 |
| 60 | 2 | 1/1/1 | 4,4 min | 13,5 min | 37,0 min | | 37,0 min | 1 |
| 60 | 3 | 1/1/1 | 4,4 min | 13,5 min | 37,0 min | | 37,0 min | 1 |
| 100 | 1 | 0/0/0 | 5,5 min | 16,9 min | 46,3 min | 6,42 h | 6,42 h | 23 |
| 100 | 2 | 4/3/3 | 2,8 min | 8,4 min | 22,9 min | 3,19 h | 3,19 h | 5 |
| 100 | 3 | 4/4/3 | 2,7 min | 8,3 min | 22,7 min | 3,14 h | 3,14 h | 4 |

A 1 clic/s, la vuelta completa tarda 21,45 h la primera vez, 10,98 h la segunda y 10,49 h la tercera. El script imprime la tabla completa.

Lectura:

- La primera vuelta completa casi reduce a la mitad la segunda.
- Desde la tercera, la mejora es pequeña: las vueltas 4 a 12 duran entre 3,00 h y 2,57 h.
- Se necesitan 9 vueltas completas (29,3 h activas a 5 clics/s) antes de empezar una con todo al máximo.
- Reiniciar en 40 o 60 apenas acelera.

### Reinicio frecuente (límite contra spam)

Las tres estrategias reciben el mismo tiempo: 9,61 h a 5 clics/s.

| Estrategia | Vueltas | Bigotes | Bigotes/h |
| --- | --- | --- | --- |
| Reiniciar en 40 | 13 | 13 | 1,35 |
| Reiniciar en 60 | 11 | 13 | 1,35 |
| Reiniciar en 100 | 2 | 28 | 2,91 |

Reiniciar seguido da menos de la mitad de bigotes por hora. Esto viene de dos cosas: la fórmula depende solo del total, y las ganancias de una vuelta crecen de forma exponencial con el nivel. La regla de nivel 40 además impide reiniciar sin haber jugado.

### Escalado alto y antitrampa

Peor ritmo sostenido con 100/100, todas las super mejoras al máximo, 8 clics/s (la recarga de fatiga), sin cap de saldo y con el Bufón siempre en ×10. Se compara contra `SCORE_RATE = 10 000 000` de `server/app.ts`, copiado como constante sin importar el servidor.

| Skin | Puntos/s | % del umbral |
| --- | --- | --- |
| Original | 1.859.584 | 18,6 % |
| Futbolista | 5.996.576 | 60,0 % |
| Robot | 3.498.020 | 35,0 % |
| Godín | 3.160.747 | 31,6 % |
| Bufón | 5.169.152 | 51,7 % |
| Magnate | 2.269.344 | 22,7 % |

Una prueba exige que todas las skins queden por debajo del 75 % del umbral. Otra comprueba que un autoclicker a 30/s gana menos de 10 % más que a 8/s: la fatiga sigue limitando porque se aplica antes del multiplicador. Hay que tener cuidado: con garra ×3, Futbolista llegaría a unos 9 M/s, muy cerca del umbral. **No subir los topes sin revisar el antitrampa.** Además, el prestigio pone el saldo en 0, así que el récord del ranking no da saltos al reiniciar.

### Efecto de la skin equipada (reinicio en 100, 5 clics/s)

| Skin | Vuelta 1 | Vuelta 2 | Vuelta 3 |
| --- | --- | --- | --- |
| Original | 6,42 h | 3,19 h | 3,14 h |
| Futbolista | 2,02 h | 59,6 min | 59,4 min |
| Godín | 4,00 h | 1,99 h | 1,96 h |

La skin pesa más que el prestigio en la primera vuelta. Que conserven las skins no rompe nada: el jugador las tiene desde la primera vuelta de todos modos.

## 5. Límites del análisis

- No mide motivación, retención ni ganas de jugar otra partida. Las tablas muestran tiempos simulados. Cualquier efecto en personas tiene que probarse con jugadores reales.
- Los ritmos de 5 y 1 clics/s son supuestos y no se midieron en jugadores.
- La simulación no reproduce el cap de saldo de 10^12 (no se alcanza con estas reglas) ni el tope de 1 s por tick de `main.ts`.
- Un tramposo puede editar `ganadoHistórico` igual que el saldo, porque el cliente decide ambos. El prestigio no empeora la confianza actual, pero tampoco la mejora.

## 6. Pasos si se integra

1. Mover las fórmulas a `src/prestige.ts`, sin cambiar `game.ts`, `fatigue.ts` ni el servidor.
2. Guardado v3 y migración `derived-floor`, con pruebas de reapertura.
3. Diálogo de confirmación con `previewPrestige`. Revisar teclado, lector de pantalla y movimiento reducido.
4. Skins Dorada y Astral cosméticas, más los logros.
5. Prueba con la comunidad antes de ajustar el divisor o los topes.


## Integración del catálogo ampliado

El prototipo y sus 14 pruebas se ejecutaron también con las 24 skins. El logro de colección exige ahora todas las skins comprables; se conservan las que tenga el jugador, sin importar cuántas sean. Las estimaciones originales de recompra de cinco skins corresponden al catálogo histórico, no al ampliado. El modelo continúa siendo un experimento: no se activó prestigio en el juego y el botón actual de reinicio sigue borrando sólo la partida local tras confirmación.
