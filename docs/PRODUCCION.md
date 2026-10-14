# Preparación de producción — 14 de octubre de 2026

## Resultado

El modo `MICHI_AUTHORITATIVE=1` calcula clics, azar, fatiga, ritmo, producción, compras y prestigio en el servidor. El navegador envía acciones y recibe el estado; no puede asignar saldo, nivel, bigotes o deducciones. El protocolo limita cada lote, calcula como máximo 64 recompensas por petición y registra el exceso para sobrecalentamiento. Los tiempos son del servidor. No hay ganancias offline.

Cada lote tiene revisión y requestId: los reintentos no cobran dos veces y una pestaña vieja recibe 409 en vez de sobrescribir la partida. Las compras usan las fórmulas compartidas y las skins realmente poseídas. El azar del servidor usa `crypto.randomInt`.

`games` guarda partidas por identidad del backend. Invitados usan cookie HttpOnly; con una cuenta Supabase verificada se usa la identidad vinculada, lo que permite acceder a la misma partida desde otro dispositivo. Google/correo reales aún requieren configuración y pruebas. No se fusionan automáticamente dos partidas distintas ni se importan saldos del demo al ranking validado.

El ranking filtra `verified=1`. Si se abre una base antigua, `demo_records` conserva una instantánea histórica antes de comenzar; el despliegue preparado usa además una base distinta (`data/production`). El navegador conserva intacto `michiratagame.demo`: modo local y modo validado son partidas distintas. El demo público actual sigue en su ubicación previa.

Esto valida la economía, no demuestra que un humano pulse cada botón. Un bot puede enviar acciones válidas, pero no decidir su recompensa. Quedan las reglas de ritmo y límites HTTP; ataques volumétricos requieren el dominio y configuración externa de Cloudflare.

## Comprobaciones

- 123 pruebas y build pasan: inyección de puntuación/bigotes, compras sin saldo, skins ajenas, prestigio improcedente, exceso de taps, pausas offline, reintentos y revisiones antiguas.
- Navegador móvil emulado: guardado local intacto, clics validados, compra de trabajadora, recarga desde el servidor, rechazo de marcador falsificado y pausa por desconexión.
- Carga aislada: 100 jugadores, 2.100 solicitudes, cero errores, 10,01 s y p95 7,72 ms. RSS 197 MiB incluye cliente y servidor del benchmark en un proceso; no es RAM exclusiva del backend ni prueba sostenida de horas.
- `tools/backup.test.ts` verifica copia online con WAL, integridad y restauración en archivo nuevo. Nunca sobrescribe una base existente.

## Operación preparada

`ops/install-services.sh` instala unidades de usuario con la ruta real de Node 24. `ops/deploy.sh` exige checkout limpio, crea una release inmutable, instala dependencias, ejecuta pruebas/build con modo online, respalda la base anterior y cambia `current` atómicamente. El servicio reinicia ante fallos. Si falla la comprobación de salud, vuelve a la release anterior cuando existe; no restaura automáticamente una base, porque eso podría perder partidas nuevas.

Configuración privada: `~/.config/michiratagame/production.env` (modo 0600). Los secretos nunca van a GitHub. La primera preparación usa `127.0.0.1:4186`; no hay publicación externa ni cambio del túnel del demo.

Respaldos diarios mediante timer, 14 copias con verificación de SQLite, permisos 0600. Comprobación local de salud cada minuto, errores en journal. Los respaldos siguen en este servidor hasta elegir un destino externo; los logs locales no avisan si el servidor completo se cae.

```bash
cd ~/michiratagame
ops/install-services.sh
ops/deploy.sh
systemctl --user status michiratagame.service
journalctl --user -u michiratagame.service -n 40
node --env-file-if-exists="$HOME/.config/michiratagame/production.env" --experimental-strip-types tools/check-health.ts
```

Después de modificar unidades hay que ejecutar `ops/install-services.sh` otra vez. Después de configurar claves VITE hay que generar una release nueva; no basta reiniciar Node. Este servidor ya tiene `Linger=yes`, que permite iniciar servicios de usuario al arrancar.

## Recuperación

Detener el servicio, restaurar la copia en un archivo nuevo, comprobar su contenido y reemplazar la base detenida junto con su WAL/SHM mediante un procedimiento supervisado. Conservar la base anterior para evitar pérdida silenciosa. Primitiva segura:

```bash
node --experimental-strip-types tools/backup.ts --restore /ruta/copia.sqlite /ruta/restaurada-nueva.sqlite
```

## Datos necesarios del propietario y recomendaciones

1. **Dominio y Cloudflare:** indicar dominio/subdominio y configurar un túnel permanente hacia `http://127.0.0.1:4186`. Recomendación: `jugar.<tu-dominio>`; mantener el origen en loopback, HTTPS en el dominio y activar las protecciones disponibles de la zona. No compartir contraseñas o tokens en el chat.
2. **Cuentas opcionales:** proyecto Supabase gratuito; URL y clave publicable, configurar Google y SMTP dentro de los paneles de sus proveedores. Recomendación: invitados + Google/correo primero, Facebook después. La configuración real de SMTP es necesaria para enviar a usuarios generales.
3. **Respaldos y alertas externos:** elegir destino fuera de esta máquina y contacto/canal de avisos. Recomendación: copia diaria externa y monitor externo de `/healthz` después de publicar el dominio.
4. **Responsable y assets:** correo público de contacto y confirmación de que podemos distribuir las imágenes incluidas. El aviso de privacidad está como borrador, sin inventar responsable ni publicar datos de contacto.

Recomendación operativa: usar este servidor para una primera beta limitada y observar carga real antes de contratar otro. Conservar el ranking del demo como histórico y abrir el validado desde cero. Las partidas validadas se sincronizan por cuenta; el guardado local viejo continúa separado. Steam no bloquea esta fase web.

Fuentes verificadas el 14 de octubre:
- [Cloudflare: configurar un túnel](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/get-started/).
- [Supabase: planes y precios](https://supabase.com/pricing).
- [Supabase: correo SMTP](https://supabase.com/docs/guides/auth/auth-smtp).

## Estado instalado en este servidor

La release `df20968` se instaló y arrancó con systemd en `127.0.0.1:4186`, separada del demo público. Servicio y timers habilitados; chequeo de salud correcto; respaldo real restaurado en un archivo temporal con integridad correcta. GitHub Actions pasó en https://github.com/Naraku86/michiratagame/actions/runs/38581698843. El dominio definitivo, cuentas reales, envío SMTP, copia externa y avisos externos siguen pendientes de sus configuraciones. El túnel temporal del demo no se modificó.
