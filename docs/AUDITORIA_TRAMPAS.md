# Auditoría de trampas y seguridad — Michiratagame

Fecha: 2026-10-13 · Rama: `work/audit` · Base auditada: `8c61a6c` (igual a `main`).
Alcance: sólo reporte y PoC local. No se cambió código de runtime (`server/`, `src/`, `package.json`).

**Qué hace el repo:** un clicker en el navegador (TypeScript + Vite). La partida vive en `localStorage`. Un servidor Node 24 (`server/app.ts`) tiene un único endpoint, `POST /api/presence`: recibe los puntos que el cliente dice tener, guarda el récord en SQLite y devuelve el tablero (top 50 normales + 10 marcados como "Tramposo · sospecha").

**Carga supuesta:** un solo proceso Node detrás de un proxy o túnel (README, `server/start.ts:8` escucha en `127.0.0.1`). Decenas o cientos de jugadores, cada uno con un *heartbeat* (aviso periódico) cada 20 s. Un atacante es una persona con `curl` o un script, no una red de bots.

## Cómo reproducir

```bash
node --experimental-strip-types tools/audit-cheats.ts                       # ~2-3 s
node --experimental-strip-types tools/audit-cheats.ts --json docs/audit-evidence.json
```

- Usa `createApp()` con un SQLite temporal (`mkdtemp`), `127.0.0.1`, puerto efímero y un reloj simulado (`now`). No toca `data/`, ni el dominio público, ni la red externa.
- Cada caso **afirma que el fallo existe**. Si un caso imprime `NO REPRODUCIDO`, ese hallazgo ya no ocurre (probablemente se arregló) y el proceso sale con código 1. No forma parte de `npm test`, a propósito: no debe romper CI.
- `N1` es un control negativo: comprueba que **no** hay carrera de concurrencia.
- Evidencia de la última ejecución: `docs/audit-evidence.json` (sólo `requestMs` de H10 varía según la máquina).

Salida resumida de la última ejecución (Node v24.18.0):

```
REPRODUCIDO H1  {"status":200,"best":1000000000000,"rank":1,"suspected":false}
REPRODUCIDO H2  {"honestRank":52,"topRegular":50,"fakesInTop":50,"suspectedFakes":0}
REPRODUCIDO H3  {"flaggedSuspected":true,"newIdentity":true,"freshName":"Evasora","freshSuspected":false,...}
REPRODUCIDO H4  {"idleSeconds":99996,"jumpedTo":1000000000000,"suspected":false}
REPRODUCIDO H5  {"rotated":{"requests":130,"got429":0},"sameHeader":{"requests":121,"last":429}}
REPRODUCIDO H7  {"requests":100,"newRows":100,...}
REPRODUCIDO H8  {"efficiencyBefore":0.0037,"efficiencyAfterRollback":1}
REPRODUCIDO H9  {"originNull":500,"malformedPath":500}
REPRODUCIDO N1  {"statuses":[200,200,200,200],"suspected":true}
REPRODUCIDO H10 {"rows":100157,"rankQueriesPerRequest":53,"requestMs":492}
REPRODUCIDO H6  {"spoofedIps":10000,"newVisitorStatus":503,"newVisitorAfter1h":503,"knownIpAfter1h":503}
10 hallazgos reproducidos de 10; control N1 OK (sin carrera)
```

`npm test` sigue en verde (60/60) en esta rama.

## Resumen por severidad

| # | Severidad | Hallazgo | Condición real |
|---|---|---|---|
| H1 | Crítica | El primer reporte acepta 1e12 sin marca | Siempre. Una sola petición con `curl`. |
| H6 | Alta | Mapa de límites lleno → 503 **permanente** para todos | Header falsificable (H5) **o** ≥10 000 IPs reales en 60 s (fácil con un bloque IPv6 /64). |
| H2 | Alta | 50 identidades desechables ocupan todo el top 50 | Siempre. 50 peticiones. |
| H3 | Alta | La marca de sospecha se evade borrando la cookie | Siempre. |
| H10 | Alta (escala) | `rank` hace SCAN completo hasta 61 veces por petición | Crece con H7; ~0,5 s con 100 000 filas, ~2 s con 300 000. |
| H4 | Media | El margen de puntos crece sin tope mientras no reportas | Siempre, pero exige esperar ~28 h. |
| H5 | Media | El límite por IP confía en `cf-connecting-ip` | Sólo si el proxy **no** es Cloudflare. Detrás de un proxy sin esa cabecera, todos comparten un único cupo. |
| H7 | Media | Cada petición sin cookie crea una fila permanente | Siempre; ~172 800 filas/día por IP. |
| H8 | Baja | Atrasar el reloj 1 s y recargar borra la fatiga | Siempre, sólo en el cliente. Los autoclickers están permitidos, así que el impacto es bajo. |
| H9 | Baja | `Origin: null` y la ruta `/%E0` dan 500 | Siempre; sólo ensucia los logs y las métricas. |
| N1 | — | No hay carrera en `find→update` | Confirmado: no hay fallo con un solo proceso. |

## Debe arreglarse

1. **H1 — El primer reporte se acepta como "línea base" sin límite** (`server/app.ts:91-98`, `server/app.ts:104`, `server/app.ts:106`)
   - **Qué es:** cuando llega una petición sin cookie, el servidor crea un jugador con `checked_at = 0`. La regla de sospecha sólo se aplica si `checked_at > 0`, así que el primer número que llega se acepta tal cual.
   - **Problema:** `curl -X POST -H 'Content-Type: application/json' -d '{"points":1e12,"name":"X"}' …/api/presence` pone el récord máximo, sin marca, en el puesto 1 (PoC H1). No hace falta modificar el cliente.
   - **Arreglo mínimo:** en `insert` (`app.ts:28`) guardar `checked_at = time` para las identidades **nuevas**. Así el primer reporte se compara con `SCORE_BURST` (40 M). Las filas migradas siguen con `checked_at = 0` y conservan su línea base (el test de migración sigue válido). Consecuencia aceptada: una partida local grande que nunca habló con el servidor recibirá la marca "sospecha"; el texto ya dice "no confirmación". Hay que actualizar la aserción `imported…suspected === false` de `server/app.test.ts:75-76` y los puestos que dependen de ella (`app.test.ts:83`).
   - **Si no se arregla:** la marca de sospecha sólo detiene a quien hace trampa con cuidado de mantener su cookie.

2. **H6 — Un mapa de límites lleno bloquea la API para siempre** (`server/app.ts:61`, `server/app.ts:66`)
   - **Qué es:** `limits` guarda una entrada por IP. Se limpia sólo si `limits.size > 10_000`, pero nunca se inserta cuando `size >= 10_000`.
   - **Problema:** `size` nunca supera 10 000, así que la limpieza no se ejecuta nunca. Una vez lleno, toda IP nueva **y toda IP conocida cuya ventana caducó** recibe 503 hasta reiniciar el proceso. En la PoC sigue en 503 una hora después.
   - **Arreglo mínimo:** cambiar `>` por `>=` en la línea 61 (limpiar antes de rechazar). Mejor aún: limpiar las entradas caducadas en cada ventana, por ejemplo cuando `time - lastSweep >= 60_000`.
   - **Si no se arregla:** cualquiera que pueda presentar 10 000 IPs distintas (H5, o IPv6) tumba el tablero hasta el siguiente despliegue.

3. **H2 + H3 — Identidades gratis: se llena el tablero y la marca no sirve** (`server/app.ts:88-98`, `server/app.ts:31`)
   - **Qué es:** sin cookie hay identidad nueva; los nombres no son únicos.
   - **Problema:** 50 peticiones sin cookie con 1e12 sacan a una jugadora honesta del top 50 (PoC H2: puesto 52). Un jugador marcado borra su cookie, vuelve con el mismo nombre y sale limpio (PoC H3).
   - **Arreglo mínimo:** arreglar H1, que ya obliga a cada identidad nueva a subir poco a poco. Además, limitar la creación de identidades por IP (por ejemplo, 5 por hora) en el mismo mapa `limits`. La identidad fuerte corresponde al frente `work/auth`.
   - **Si no se arregla:** aunque H1 se corrija, se podrían usar muchas identidades nuevas que suben a 40 M cada una.

4. **H10 — El cálculo de puesto escanea toda la tabla en cada fila** (`server/app.ts:33`, `server/app.ts:42`, `server/app.ts:52`)
   - **Qué es:** `publicPlayer()` ejecuta la consulta `rank` para el jugador y para cada una de las hasta 60 filas del tablero. `EXPLAIN QUERY PLAN` da `SCAN players`: lee la tabla entera cada vez.
   - **Problema:** con 100 000 filas, una petición tarda ~0,5 s; con 300 000, ~2 s. `DatabaseSync` es síncrono, así que bloquea a todos los jugadores mientras tanto. Con H7, una sola IP llega a 100 000 filas en menos de un día.
   - **Arreglo mínimo:** en el tablero, el puesto es la posición en la lista: `index + 1` para los normales y `total_normales + index + 1` para los marcados (`total_normales` sale de un único `COUNT(*) … WHERE suspected = 0`). Sólo `me` necesita la consulta `rank`. Esto pasa de 61 escaneos a 2 por petición.
   - **Si no se arregla:** el servidor se vuelve lento para todos al crecer la tabla, por spam o por uso normal.

## Conviene arreglar

5. **H4 — El margen acumulado no tiene tope** (`server/app.ts:102`)
   - **Qué es:** `allowance = score_credit + segundos_desde_último_reporte × 10 000 000`.
   - **Problema:** tras ~100 000 s (~28 h) sin reportar, el margen supera 1e12. Se reporta 0, se espera y se reporta 1e12: no hay marca (PoC H4). Un script que sube 9,9 M/s nunca recibe marca. Pero el juego no produce puntos con la pestaña oculta (`src/main.ts:88`), así que el tiempo sin reportar no corresponde a juego real.
   - **Arreglo mínimo:** limitar los segundos: `Math.min(elapsed, 60_000)`. El heartbeat es cada 20 s; 60 s cubre retrasos. Una reconexión tras un corte largo sólo puede reclamar ~640 M.

6. **H5 — El límite por IP confía en una cabecera del cliente** (`server/app.ts:59`, `server/start.ts:8`)
   - **Qué es:** la IP sale de `cf-connecting-ip` si existe y, si no, de `remoteAddress`.
   - **Condición real:** detrás de Cloudflare (túnel o proxy), Cloudflare reescribe `cf-connecting-ip`, así que no se puede falsificar. Detrás de otro proxy (nginx, Caddy, otro túnel), la cabecera del cliente pasa tal cual: rotarla evita el 429 (PoC H5) y llena el mapa (H6). Si el proxy no la envía, `remoteAddress` es siempre `127.0.0.1` y **todos** los jugadores comparten 120 peticiones/min: con ~40 pestañas activas, todos reciben 429.
   - **Arreglo mínimo:** leer la cabecera sólo si `process.env.MICHI_TRUST_CF === '1'` (o una variable con el nombre de la cabecera de confianza) y documentar en el README qué proxy se espera.

7. **H7 — Filas basura sin límite** (`server/app.ts:91-97`)
   - **Problema:** cada POST sin cookie inserta una fila que nunca se borra (PoC H7: 100 peticiones = 100 filas). A 120/min son ~172 800 filas/día por IP. Alimenta H10.
   - **Arreglo mínimo:** el límite de identidades por IP de H2/H3. Opcional: borrar las filas `Invitado` con `best = 0` y `seen` de hace más de 30 días.

## Bajo

8. **H8 — Atrasar el reloj borra la fatiga al recargar** (`src/fatigue.ts:22`, `src/fatigue.ts:25`)
   - **Problema:** si el `updatedAt` guardado es mayor que `Date.now()`, `loadFatigue` lo descarta y devuelve fatiga nueva (eficiencia 1). Atrasar el reloj 1 s y recargar lleva la eficiencia de 0,0037 a 1 (PoC H8). El test "clock rollback does not grant extra recovery" (`src/fatigue.test.ts:32-37`) sólo cubre `settleFatigue`, no la recarga. También vale borrar la clave `michiratagame.fatigue` o tener el almacenamiento bloqueado (`src/fatigue.test.ts:47-48` lo considera correcto).
   - **Arreglo mínimo:** si `updatedAt > now`, conservar `heat` y `credits` y fijar `updatedAt = now`, en vez de descartarlo.
   - **Contexto:** el README ya dice que un cliente modificado se salta la fatiga, y el servidor no la valida. Es un problema de equilibrio del juego, no de seguridad.

9. **H9 — Errores 500 por entrada mal formada** (`server/app.ts:71`, `server/app.ts:112`)
   - **Problema:** `new URL('null')` lanza una excepción con `Origin: null` (iframes con sandbox, `file://`), y `decodeURIComponent('/%E0')` lanza un `URIError`. Los dos acaban en 500. No hay fuga de datos: el `catch` devuelve un mensaje genérico.
   - **Arreglo mínimo:** envolver el `new URL(origin)` en `try` y responder 403; si `decodeURIComponent` falla, responder 400.

## Revisado sin hallazgo

- **N1, concurrencia del tablero:** `find → cálculo → update → find` (`app.ts:90-108`) no tiene ningún `await` en medio, así que en un solo proceso Node no se intercalan. Cuatro POST en paralelo con la misma cookie no duplican el crédito (PoC N1). **Riesgo hipotético:** sólo si se ejecutan varios procesos sobre el mismo SQLite. En ese caso, envolver en `BEGIN IMMEDIATE … COMMIT`.
- **Robo o falsificación de cookie:** el token tiene 256 bits aleatorios (`randomBytes(32)`) y se guarda como SHA-256. La cookie es `HttpOnly; SameSite=Lax` y no aparece en las respuestas (test existente). No se puede marcar ni editar a otro jugador sin su cookie.
- **Campos extra en el payload:** se ignoran `suspected`, `best`, `id`, etc. (`app.test.ts:85`). `points` está limitado a `[0, 1e12]` y es finito. El nombre se valida con `\p{L}\p{N} _.'-`, lo que excluye caracteres de control y bidi; los homógrafos (letras que se parecen) y los nombres duplicados son posibles y ya están documentados.
- **CSRF:** `SameSite=Lax` junto con el chequeo de `Origin`/`Sec-Fetch-Site` y `Content-Type: application/json` obligatorio bloquean POST desde otros sitios.
- **Recorrido de rutas:** `resolve` + `startsWith(dist + sep)` bloquea `..` (test existente).
- **Falsos positivos para jugadores honestos:** el máximo honesto calculado (clic nivel 100 con Futbolista a 8 clics/s ≈ 2,9 M/s; Robot ≈ 1,6 M/s; producción Magnate nivel 100 ≈ 0,3 M/s) queda por debajo de 10 M/s, y una ráfaga de 24 clics (≈ 9 M) por debajo de 40 M. No se encontró un caso honesto que reciba la marca, **salvo** el efecto aceptado del arreglo de H1 sobre partidas locales antiguas.
- **Reloj del servidor frente al del cliente:** el servidor sólo usa su propio `now()`; el reloj del cliente no influye en la marca.

## Estado frente a `main` actual

Mientras se hacía la auditoría, `main` avanzó hasta `4866551`. `server/`, `src/main.ts` y `src/community.ts` no cambiaron, así que H1-H7, H9 y H10 siguen vigentes. **H8 está corregido en `main`** por `4866551 Preserve fatigue when loading after clock rollback`, con el mismo arreglo propuesto aquí (`updatedAt: Math.min(value.updatedAt, now)`). Esto se verificó leyendo el diff, no ejecutando la PoC sobre `main`. Allí, H8 debería aparecer como `NO REPRODUCIDO` y el script saldría con código 1 por ese motivo.

## Comparación con el frente de defensa (`work/protection`)

En el momento de la auditoría, `work/protection` y `work/auth` no tenían commits sobre `main` (`git log main..work/protection` vacío). Por eso estos hallazgos describen `main` y no evalúan ningún arreglo en curso. Para no duplicar trabajo:

| Hallazgo | Frente natural | Nota |
|---|---|---|
| H1, H4, H6, H9, H10 | protection | Cambios pequeños y locales en `server/app.ts`. |
| H2, H3, H7 | protection (límite por IP) + auth (identidad fuerte) | El límite de creación por IP es inmediato; la identidad real queda en auth. |
| H5 | protection + release/despliegue | Depende del proxy real, que no se pudo verificar (no se revisó el servidor real). |
| H8 | economy / fatiga | Sólo cliente; prioridad baja. |

Cuando protection tenga commits, basta ejecutar `tools/audit-cheats.ts` en esa rama: cada hallazgo arreglado debe pasar a `NO REPRODUCIDO`.

## Plan priorizado para lanzar a arreglar

1. **H6** — `>=` en `app.ts:61` más un barrido periódico. 1 línea. Test: llenar 10 000 entradas, avanzar 61 s y esperar 200.
2. **H1** — `checked_at = time` al crear la identidad. 1 línea más ajustar 1 aserción. Test: primer POST 1e12 sin cookie → `suspected: true`.
3. **H10** — puesto por posición en la lista más un `COUNT`; `rank` sólo para `me`. ~5 líneas. Test: el puesto de cada fila coincide con su índice.
4. **H4** — `Math.min(elapsed, 60_000)` en `app.ts:102`. 1 línea. Test: 0 → esperar 1 día → 1e12 → `suspected: true`.
5. **H2/H3/H7** — límite de identidades nuevas por IP. ~6 líneas. Test: la 6.ª identidad en una hora → 429.
6. **H5** — confiar en `cf-connecting-ip` sólo con una variable de entorno, y documentar el proxy.
7. **H9** — 403/400 en vez de 500.
8. **H8** — no descartar la fatiga cuando el reloj va hacia atrás.

**Veredicto:** el tablero no resiste trampas: con una sola petición (H1) se obtiene el récord máximo sin marca. Lo primero es H6 (cualquiera puede tumbar la API) y H1.

**No revisado:** `src/ui.ts`, `src/sound.ts`, `style.css` y `vite.config.ts` (sin datos de entrada de red); la configuración real del proxy o túnel, y los datos de producción (fuera del alcance acordado). No se ejecutó `tsc` sobre `tools/` (pedía aprobación); el script sí corre con `--experimental-strip-types`.


## Estado después de integrar los frentes

Ver [COLA_DE_CORRECCIONES.md](COLA_DE_CORRECCIONES.md) y `audit-evidence-after.json`. La PoC inicial ya no reproduce H2 en una única IP, H6, H8, H9 ni H10; no significa que se hayan eliminado todas sus variantes. H1/H3/H4 siguen abiertos mientras el servidor acepte puntos del cliente. H5 depende de cómo el proxy sanee cabeceras y H7 está acotado por cuotas, pero continúa creando invitados persistentes. La prueba posterior utilizó un SQLite temporal y no tocó marcadores reales. El test de H6 ahora choca primero con el límite global; los tests de regresión específicos también verifican que el mapa lleno poda entradas caducadas.
