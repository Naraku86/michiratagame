# Protección del servidor (defensa de aplicación mínima)

Este documento describe lo que **sí** implementa el código de este repositorio
(`server/app.ts`, `server/start.ts`, `server/app.test.ts`) y lo que **no** puede
implementar: la seguridad de red/infraestructura (DNSSEC, WAF, límites de Cloudflare)
se configura en la cuenta de Cloudflare, no aquí.

## Qué es y qué NO es esta defensa

- **Sí es**: una capa de defensa de aplicación para un servidor pequeño, pensada
  para amortiguar ráfagas de miles de peticiones HTTP al endpoint JSON `/api/presence`.
- **No es**: protección contra DDoS a nivel de red ni "seguridad DNS".
  Un ataque DDoS volumetrico o de DNS se mitiga en el borde (Cloudflare), no en un
  proceso Node que escucha en `127.0.0.1`.
- **Aclaración DNS**: DNS ≠ DDoS/HTTP. `localhost` + Cloudflare son el borde de red.
  DNSSEC, WAF y rate limiting reales son infraestructura que se activa en el panel
  de Cloudflare con pasos manuales (ver "Próximos pasos manuales en Cloudflare").
  Este código **no** toca cuentas, credenciales ni firewalls reales y **no finge**
  que la seguridad DNS esté configurada.

## Defensas implementadas en la aplicación

### 1. Límites de peticiones (rate limiting) global y por cliente

- **Token bucket por cliente**: cada cliente dispone de una ráfaga de
  `DEFAULT_RATE_LIMIT` (120) peticiones y se recarga a `120 / 60 s` (2 por segundo).
- **Token bucket global**: `DEFAULT_RATE_LIMIT_GLOBAL` (2000) peticiones totales por
  ventana, independiente del cliente, para que miles de IPs distintas no ahoguen el
  proceso aunque cada una esté bajo su límite individual.
- Los límites se aplican sólo a `/api/*`. Los archivos estáticos quedan libres para
  que un CDN los sirva/cachee; igualmente les aplican los límites de conexión y tiempo.
- Superar el límite devuelve `429` con `retryAfter`; si el mapa de clientes está lleno
  devuelve `503` (servidor ocupado).

### 2. Mapa de clientes acotado (corrección del bug de limpieza)

- El mapa que recuerda el estado de cada cliente está acotado a
  `DEFAULT_RATE_MAX_CLIENTS` (10 000) entradas.
- Corrección: antes, la limpieza sólo se ejecutaba cuando el tamaño era **mayor** que
  10 000, de modo que al llegar exactamente a 10 000 el mapa nunca se limpiaba y todos
  los clientes nuevos recibían `503` para siempre. Ahora, al estar lleno, se eliminan
  las entradas caducadas **antes** de rechazar, y sólo se rechaza si no queda ninguna
  caducada. La memoria está acotada y el CPU de limpieza se paga sólo cuando el mapa
  está lleno.

### 3. Límites de conexión, tamaño de petición y tiempo

En `server/app.ts`:

- `maxConnections = 1000` (rechaza conexiones nuevas más allá del tope).
- `maxRequestsPerSocket = 100` (cierra keep-alive después de 100 peticiones).
- `maxHeadersCount = 100`.
- `requestTimeout`, `headersTimeout` y `timeout` en 10 s; `keepAliveTimeout` en 5 s.
- Cuerpo JSON máximo `MAX_BODY_BYTES = 4096`, verificado por
  `Content-Length` **antes** de leer y también durante la lectura del stream
  (cubre `Transfer-Encoding: chunked`).

### 4. Validación de cabeceras de proxy (sólo bajo localhost)

- `CF-Connecting-IP` y `X-Forwarded-For` sólo se confían cuando la conexión directa
  proviene de una dirección loopback (`127.0.0.1`, `::1`, `::ffff:127.0.0.1`), es
  decir, el proxy/túnel local. Un cliente remoto directo no puede suplantarlos.
- Los valores se validan como IPv4/IPv6 reales con `node:net.isIP`; cualquier otra
  cadena se descarta y se usa `socket.remoteAddress`.
- `X-Forwarded-Proto` sólo marca la cookie como `Secure` cuando el origen es loopback
  y el valor es `https` (o el `Origin` del navegador ya es `https:`).

### 5. Origen, preflight y cuerpos

- El `Origin` se compara con el `Host`; un `Origin` malformado se rechaza con `403`
  (antes podía provocar un `500`). Se mantiene `Sec-Fetch-Site: cross-site` → `403`.
- `OPTIONS` en `/api/presence` responde `204` con cabeceras CORS en lugar de `404`.
- `Content-Type` JSON obligatorio (`415`), `Content-Length` excesivo (`413`),
  JSON inválido (`400`), puntuación y nombre validados (incluidos nombres Unicode
  legales con `\p{L}\p{N}`). Sin captcha obligatorio: los usuarios honestos no se
  bloquean permanentemente ni se les resetean récords.

### 6. Reducción de abuso de CPU/SQLite

- `PRAGMA busy_timeout = 5000` evita errores `SQLITE_BUSY` bajo concurrencia.
- `PRAGMA synchronous = NORMAL` con `journal_mode = WAL` reduce fsyncs (I/O/CPU).
  Los datos siguen siendo seguros ante caídas del proceso; sólo una caída del sistema
  operativo podría perder el último commit, aceptable para este demo.
- Statements preparados reutilizados; el límite de peticiones acota la creación de
  filas y consultas.

## Configuración (variables de entorno)

- `PORT`: puerto (por defecto `4174`).
- `MICHI_HOST`: interfaz de escucha (por defecto `127.0.0.1`; no exponer a `0.0.0.0`
  sin un proxy delante).
- `MICHI_DATA_DIR`: directorio de la base de datos (por defecto `data/`).
- `MICHI_MAX_CONNECTIONS`: sobrescribe `server.maxConnections` (por defecto `1000`).

Los umbrales de rate limiting son constantes exportadas de `server/app.ts` y se pueden
ajustar por código (y en tests mediante el parámetro `AppLimits`); no son variables de
entorno para evitar que una configuración accidental los desactive.

## Prueba de carga local (determinista, sin tráfico externo)

`tools/load-local.ts` arranca un servidor efímero en `127.0.0.1` y envía como máximo
1000 peticiones con 10 workers concurrentes. Mide aceptadas (`200`), limitadas (`429`),
otras, latencia p50/p95/p99 y memoria observada (RSS/heap, sólo informativa).

```bash
node --experimental-strip-types tools/load-local.ts
```

Opcional: apuntar a un servidor ya en marcha.

```bash
LOAD_URL=http://127.0.0.1:4174 node --experimental-strip-types tools/load-local.ts
LOAD_TOTAL=500 LOAD_CONCURRENCY=5 node --experimental-strip-types tools/load-local.ts
```

`LOAD_TOTAL` y `LOAD_CONCURRENCY` se limitan internamente a 1000 y 10.

## Próximos pasos manuales en Cloudflare (fuera de este repositorio)

Estos pasos **requieren tu cuenta** y se hacen en el panel de Cloudflare; no están
configurados ni se pueden configurar desde el código. Sigue la documentación oficial
de Cloudflare (los enlaces exactos cambian; busca en `developers.cloudflare.com`):

1. **Ocultar el origen**: publica el dominio en Cloudflare y activa el proxy (nube
   naranja) para que el tráfico pase por su borde; el origen sólo escucha en
   `127.0.0.1` tras un túnel (`cloudflared`) o un proxy inverso local.
2. **Rate limiting (WAF)**: crea una regla de límite de peticiones en
   Security → WAF → Rate limiting rules para `/api/*` (por IP) con umbrales por
   encima de los de la app para usuarios legítimos.
3. **Bot fight / Managed Rules**: activa el nivel apropiado en Security → Bots y las
   reglas gestionadas del WAF.
4. **DNSSEC**: actívalo en DNS → Settings (y en el registrador si es necesario);
   esto protege la integridad de las respuestas DNS, no mitiga DDoS HTTP.
5. **TLS/HTTPs**: exige "Full (strict)" y redirige HTTP→HTTPS en el borde.

Consideración de IP compartida: detrás de Cloudflare/Túneles los usuarios pueden
compartir la IP vista por el servidor (CGNAT/NAT). Por eso el límite por cliente es
generoso (120/min) y el límite global protege el total. No bajes el límite por cliente
tanto que castigues a usuarios honestos detrás de una misma IP.

## No incluido a propósito

- No hay captcha obligatorio ni bloqueo permanente de usuarios honestos.
- No se resetean récords ni se cambia el anticheat del juego (eso vive en `src/`).
- No se tocan `auth`, `main`, `ui`, `game`, `package.json` ni `README`.
