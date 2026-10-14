# Autenticación (Google, Facebook y correo)

Estado: 13 de octubre de 2026. **Integración conectada, desactivada sin configuración.** La decisión Supabase frente a servidor propio sigue pendiente; esta rama prepara la ruta Supabase como opción recomendada. Nada de esto se ha probado contra un proyecto Supabase real ni contra Google o Meta: **no está verificado que Google o Facebook funcionen de extremo a extremo**. Sin configuración, el juego, el guardado local, el modo offline y el tablero anónimo funcionan exactamente igual que antes.

## Qué incluye la integración

| Archivo | Qué hace |
| --- | --- |
| `server/auth.ts` | Lee la configuración (`MICHI_AUTH_PROVIDER`, `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`), valida sesiones preguntando a Supabase `GET /auth/v1/user`, y enlaza jugador anónimo → cuenta en una tabla propia `auth_links`. |
| `server/auth.test.ts` | 13 pruebas con HTTP simulado (servidor y cliente). Ninguna toca Supabase, Google, Meta ni el dominio público. |
| `src/auth.ts` | Ayudante de navegador sin interfaz y **sin SDK**: OAuth con PKCE, registro, confirmación, inicio de sesión, recuperación y cambio de contraseña, renovación de tokens y cierre de sesión. |
| `.env.example` | Variables sin secretos. `.gitignore` excluye `.env` pero conserva explícitamente `.env.example`. |

La integración usa `POST /api/presence` con Bearer y la UI `src/account-ui.ts` dentro del tablero. No se añadió un endpoint separado `/api/auth/link`. Los módulos se prepararon en una rama independiente y luego se conectaron; el checklist externo sigue pendiente.

**No se necesita el SDK `@supabase/supabase-js`.** Las llamadas son pocas y documentadas; el ayudante usa `fetch` y WebCrypto. Si en el futuro se prefiere el SDK (por ejemplo, para sincronizar sesiones entre pestañas), la dependencia sería `@supabase/supabase-js`, y debe añadirla el coordinador; esta rama no edita `package.json`.

## Decisiones de seguridad

- **El servidor nunca confía en el contenido del token.** No decodifica ni verifica JWT localmente: cada token se envía a `GET {SUPABASE_URL}/auth/v1/user` con cabeceras `apikey: <clave publicable>` y `Authorization: Bearer <token>`. Esto identifica al usuario consultando al proveedor, pero no promete revocación instantánea: [Supabase documenta que los access tokens emitidos pueden seguir válidos hasta expirar](https://supabase.com/docs/guides/auth/signout). Nuestro botón elimina la sesión local y revoca la renovación; una copia previa del token debe considerarse válida hasta su caducidad si el proveedor todavía la acepta. Costo: una petición a Supabase por validación; si hace falta, el coordinador puede validar sólo al enlazar y luego usar la cookie propia.
- **Falla cerrado.** Con `MICHI_AUTH_PROVIDER=supabase` y una URL que no sea https, con ruta, con credenciales, sin clave, o con una clave `sb_secret_…`, `loadAuthConfig` lanza error y el servidor no debe arrancar. Al validar: tiempo agotado (5 s por defecto), red caída, 429, 5xx, respuesta no JSON, mayor de 64 KB o sin `id` UUID ⇒ **no autenticado** (`unavailable`, 503). 401/403 ⇒ `invalid`. Usuarios anónimos de Supabase ⇒ rechazados. Cuentas de correo sin `email_confirmed_at` ⇒ `unverified`. Las redirecciones HTTP se rechazan (`redirect: 'error'`).
- **Sin claves elevadas.** Ni servidor ni cliente usan `service_role`/`sb_secret_…`; no hacen falta para validar sesiones. La clave heredada `anon` también se acepta, pero no se puede distinguir de una `service_role` heredada sin decodificarla: **usa la nueva `sb_publishable_…`**. Supabase anuncia la retirada de las claves heredadas para finales de 2026.
- **En el navegador**, la clave publicable y la URL son públicas por diseño. La sesión se guarda en `localStorage` (`michiratagame.auth.session`), como hace el SDK por defecto; un XSS podría leerla. La interfaz actual usa `textContent`, lo que reduce ese riesgo; se recomienda añadir una CSP cuando se active. El guardado del juego (`michiratagame.demo`) nunca se lee ni se borra.
- **PKCE (S256)** en OAuth, registro y recuperación. El verificador vive en `localStorage` (`michiratagame.auth.pkce`), se borra al usarse y caduca a las 24 h. Sólo hay un flujo pendiente por navegador: pedir otro enlace invalida el anterior.
- **Contraseñas**: 8 a 72 bytes en el cliente (bcrypt sólo usa 72). Configurar el mismo mínimo en Supabase.

### Límites conocidos de PKCE con correo

El enlace de confirmación o recuperación debe abrirse **en el mismo navegador** donde se pidió. Si se abre en otro (por ejemplo, el correo en el teléfono y el registro en el PC), el intercambio falla con `missing_verifier`. En la confirmación de registro el correo sí queda confirmado en Supabase, así que basta con iniciar sesión con contraseña. En recuperación hay que volver a pedirlo desde el dispositivo donde se abrirá el correo. El código de intercambio caduca a los 5 minutos y sólo se puede usar una vez (documentación de Supabase).

## Enlace seguro jugador anónimo → cuenta

Tabla nueva, independiente de `players` y de las tablas de Supabase:

```sql
auth_links(auth_user_id TEXT PRIMARY KEY, player_id TEXT UNIQUE NOT NULL, provider TEXT NOT NULL, linked_at INTEGER NOT NULL)
```

`createAuthLinks(db).link(user, playerId)` se ejecuta en `BEGIN IMMEDIATE` y las dos restricciones de unicidad impiden dobles enlaces aunque lleguen peticiones simultáneas:

| Situación | Resultado |
| --- | --- |
| Cuenta sin enlace, jugador sin dueño | `linked`: ese jugador pasa a la cuenta. |
| Cuenta ya enlazada | `existing` con su jugador original (aunque la cookie de este dispositivo sea otro jugador). El jugador anónimo de este dispositivo **no se fusiona ni se borra**. |
| Jugador ya enlazado a otra cuenta | `conflict`: no se roba la identidad. |

Reglas para el coordinador:

1. `playerId` debe salir de la cookie HttpOnly `michi_player` ya resuelta por `app.ts`, **nunca del cuerpo** de la petición.
2. El token llega en `Authorization: Bearer`, se lee con `bearerToken()` y se valida con `validateSession()` antes de enlazar. Aplicar las mismas comprobaciones de origen, JSON y límite de peticiones que `/api/presence`.
3. Ruta integrada: `POST /api/presence` valida Bearer y enlaza en la misma operación; errores con `sessionStatus(reason)` (401/403/503; 404 si las cuentas están desactivadas).

Decisiones aplicadas y límites:

- **Varios dispositivos.** Una sesión Bearer validada identifica al mismo jugador por `auth_links`, sin rotar la cookie de otro dispositivo ni fusionar los invitados. La cookie sola no puede escribir un jugador ya enlazado.
- **Récords al unir.** Propuesta: conservar el jugador enlazado y, como máximo, actualizar `best = MAX(best, récord del anónimo)` marcando la importación igual que hoy se marcan saltos sospechosos.
- **Progreso del juego.** Sigue en `localStorage`. La sincronización entre dispositivos es una función futura; la cuenta sólo da identidad.
- **Cerrar sesión** no borra el progreso local ni la cookie anónima.

## Uso previsto del ayudante de navegador

```ts
import { setupAuth } from './auth.ts';
const auth = setupAuth(import.meta.env, { storage: localStorage, origin: location.origin });
if (auth.status === 'ready') {
  const back = await auth.client.completeRedirect(location.href); // una vez al cargar
  if (back.handled) history.replaceState(null, '', back.cleanUrl);
  // back.kind === 'recovery' ⇒ mostrar formulario de nueva contraseña → auth.client.updatePassword()
  // Botones: location.assign(await auth.client.oauthUrl('google' | 'facebook'))
  // Formularios: signUp, signIn, resendConfirmation, requestPasswordReset, signOut('local' | 'global')
  // API propia: fetch('/api/presence', { method: 'POST', headers: { Authorization: `Bearer ${await auth.client.accessToken()}` } })
}
// 'disabled' o 'misconfigured': no mostrar acceso; el juego sigue igual.
```

Todos los errores son `AuthError` con `code` de Supabase (`invalid_credentials`, `email_not_confirmed`, `over_email_send_rate_limit`, `flow_state_expired`, `bad_code_verifier`…) o propios (`timeout`, `network`, `missing_verifier`) y un mensaje en español.

Endpoints usados (de la especificación OpenAPI de `supabase/auth` y del cliente oficial `auth-js`): `GET /authorize?provider&redirect_to&code_challenge&code_challenge_method=s256`, `POST /signup?redirect_to`, `POST /token?grant_type=password|pkce|refresh_token`, `POST /recover?redirect_to`, `POST /resend`, `GET|PUT /user`, `POST /logout?scope=local|global`. Se envía `X-Supabase-Api-Version: 2024-01-01` para recibir el campo `code` en los errores.

## Lo que debe configurar el usuario (externo, exacto)

Nada de esto existe todavía; no hay proyecto, claves ni dominio configurados. Reemplaza `DOMINIO` por el dominio permanente y `<project-ref>` por el identificador del proyecto.

### 0. Dominio permanente (requisito previo)

- Un dominio estable con https (no el temporal actual: cambiar de dominio rompe redirecciones, cookies y el enlace con proveedores).
- Opcional, recomendado por Google: dominio personalizado para Supabase (por ejemplo `auth.DOMINIO`), para que la pantalla de consentimiento no muestre `<project-ref>.supabase.co`. Es un complemento de Supabase con costo según el plan; confirmar antes.

### 1. Proyecto Supabase

1. Crear el proyecto y elegir región cercana a los jugadores.
2. **Settings → API Keys**: crear/copiar la clave publicable `sb_publishable_…`. No copiar la secreta a ningún sitio de este repositorio.
3. **Authentication → URL Configuration**:
   - Site URL: `https://DOMINIO/`
   - Redirect URLs: exactamente `https://DOMINIO/` (Supabase recomienda URL exactas en producción; comodines sólo para desarrollo, p. ej. `http://localhost:5173/**`).
4. **Authentication → Providers → Email**: activado, *Confirm email* activado, longitud mínima de contraseña 8. Revisar *Secure password change* y *Secure email change*.
5. **SMTP propio (obligatorio en producción)**: el correo por defecto de Supabase sólo envía a miembros del equipo del proyecto y unas 2 por hora. Configurar host, puerto, usuario, contraseña y remitente (`no-reply@DOMINIO`) en **Authentication → SMTP Settings**; luego ajustar **Rate Limits** (por defecto 30 correos/hora tras configurar SMTP). Configurar SPF/DKIM del dominio en el proveedor de correo.
6. **Email Templates**: traducir al español *Confirm signup* y *Reset password*, manteniendo `{{ .ConfirmationURL }}`. Probar en un proyecto de pruebas que el enlace vuelve a `https://DOMINIO/?code=…` (no verificado aún).
7. Opcional: CAPTCHA (Turnstile/hCaptcha) en **Attack Protection**; requeriría pasar el token en el ayudante (no implementado).
8. Colocar `MICHI_AUTH_PROVIDER=supabase`, `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` en el `.env` del servidor y del build (no en git).

### 2. Google

1. Google Cloud: crear o elegir proyecto → **Google Auth Platform**.
2. *Branding*: nombre de la app, logo, correo de soporte, dominio autorizado `DOMINIO`, enlaces a política de privacidad y términos. La verificación de marca puede tardar días hábiles.
3. *Audience*: externo; publicar la app (en modo prueba sólo entran usuarios de prueba).
4. *Data Access*: añadir `openid`; `userinfo.email` y `userinfo.profile` vienen por defecto. No pedir alcances sensibles.
5. *Clients* → **Web application**:
   - Authorized JavaScript origins: `https://DOMINIO` (y `http://localhost:<puerto>` sólo en desarrollo, quitarlo antes de producción).
   - Authorized redirect URIs: la URL de callback que muestra Supabase en **Authentication → Providers → Google**, normalmente `https://<project-ref>.supabase.co/auth/v1/callback` (o la del dominio personalizado).
6. Pegar Client ID y Client Secret en Supabase → Providers → Google y activar.

### 3. Facebook (Meta)

1. developers.facebook.com → **My Apps → Create App**; añadir el caso de uso **Authentication and Account Creation** (Facebook Login).
2. *Facebook Login → Settings → Valid OAuth Redirect URIs*: `https://<project-ref>.supabase.co/auth/v1/callback` (copiar el valor exacto de Supabase → Providers → Facebook).
3. En el caso de uso, comprobar que `public_profile` y `email` estén listos; sin `email` Facebook no entrega el correo.
4. *Settings → Basic*: icono, URL de política de privacidad, dominio de la app, términos e **instrucciones o URL de eliminación de datos** (Meta lo exige para apps con inicio de sesión).
5. En modo desarrollo sólo entran personas con rol en la app. Para el público: solicitar `email` en *App Review* y pasar la app a **Live**.
6. Copiar App ID y App Secret a Supabase → Providers → Facebook (Client ID / Client Secret) y activar.
7. Algunas cuentas de Facebook no tienen correo: esas cuentas no tendrán `email`; el enlace funciona igual porque usa el `id` de Supabase.

### 4. Privacidad

Antes de abrir el registro: publicar política de privacidad (qué se guarda: correo, id del proveedor, nombre público, récords), procedimiento de borrado de cuenta y aviso de que el progreso sigue siendo local.

## Verificación pendiente (requiere proyecto real, fuera del alcance de esta rama)

- Proyecto Supabase de pruebas separado del de producción, con usuarios de prueba de Google/Meta.
- Recorrer: registro + confirmación, inicio y cierre de sesión, recuperación, Google, Facebook, sesión caducada, enlace en otro navegador, SMTP real y límites de envío.
- Revisar que la validación por `/auth/v1/user` rechaza un token tras `/logout` (comportamiento esperado, no comprobado contra un proyecto real).

## Fuentes consultadas (13-oct-2026)

- Supabase, inicio con Google: https://supabase.com/docs/guides/auth/social-login/auth-google
- Supabase, inicio con Facebook: https://supabase.com/docs/guides/auth/social-login/auth-facebook
- Supabase, claves de API: https://supabase.com/docs/guides/api/api-keys
- Supabase, flujo PKCE: https://supabase.com/docs/guides/auth/sessions/pkce-flow
- Supabase, URLs de redirección: https://supabase.com/docs/guides/auth/redirect-urls
- Supabase, SMTP propio: https://supabase.com/docs/guides/auth/auth-smtp
- Supabase, códigos de error: https://supabase.com/docs/guides/auth/debugging/error-codes
- OpenAPI de Supabase Auth: https://github.com/supabase/auth/blob/master/openapi.yaml
- Cliente oficial `auth-js` (`GoTrueClient.ts`, `GoTrueAdminApi.ts`, `lib/helpers.ts`, `lib/fetch.ts`): https://github.com/supabase/supabase-js/tree/master/packages/core/auth-js/src


## Estado integrado en main

La interfaz opcional está conectada al tablero y envía el token Bearer en presencia. El backend valida la sesión remotamente antes de vincularla con el jugador de la cookie; una cuenta reconocida usa la misma identidad del tablero en otro dispositivo. Salir vuelve a un jugador anónimo y no permite editar la cuenta anterior con su cookie. El progreso del juego sigue local, sin fusión de partidas ni sincronización de saldo. Los tokens anónimos/invalidos y los correos no confirmados se rechazan. Se bloquean también claves legacy `service_role` en la configuración del cliente y del servidor; decodificar su role sólo filtra una clave de configuración, no autentica usuarios.

`npm start` carga `.env` si existe. Para activar: copiar `.env.example`, completar el mismo origen y la misma clave publicable en ambos pares de variables, poner `MICHI_AUTH_PROVIDER=supabase`, completar proveedores/redirects/SMTP del checklist, reconstruir y reiniciar. No se han colocado claves ni activado cuentas en la demo pública. La validación se hizo con HTTP simulado y navegador; falta recorrer Google, Facebook, confirmación y recuperación con un proyecto real. La marca de tramposo y el saldo importado no prueban legitimidad aunque una cuenta esté autenticada.
