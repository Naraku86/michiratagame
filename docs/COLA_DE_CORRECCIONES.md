# Auditoría: arreglos y siguientes encargos

La PoC y la evidencia inicial corresponden al commit 8c61a6c. La nueva evidencia (`audit-evidence-after.json`) se obtuvo después de integrar defensas, autenticación opcional y correcciones. `npm run audit:local` puede terminar con código 1 porque sus asserts intentan demostrar los fallos antiguos: no forma parte de CI ni significa que `npm test` haya fallado.

| Hallazgo | Estado integrado | Siguiente acción |
| --- | --- | --- |
| H8: retroceder reloj elimina desgaste | Corregido y probado | El reloj adelantado sigue manipulable; usar reloj del servidor en economía autoritativa |
| H9: Origin/ruta malformados →500 | Corregido: 403/400 | Mantener los casos de regresión |
| H10: hasta61 scans de ranking | Corregido con índice y posiciones derivadas | Medir backend aislado con base grande antes de ampliar aforo |
| H6: mapa lleno →503 eterno | Corregido y probado en el tope; global limita el abuso antes | Revisar métricas reales sin generar tráfico de ataque público |
| H2: una IP llena top50 | PoC original ya no desplaza al jugador: cuota de altas | No bloquea una red de IPs ni muchas cuentas válidas |
| H5: cabecera IP falsificada | Mitigado para conexiones directas; confianza sólo loopback | Cloudflare debe sanitizar cabeceras; no usar otro proxy que reenvíe las del cliente sin limpiarlas |
| H1: primer saldo inventado | Pendiente, crítica | Calcular progreso competitivo en servidor; importar guardados a una categoría no verificada |
| H3: borrar cookie evade etiqueta | Pendiente en modo anónimo | Identidad de cuenta estable para clasificación y sesiones; no confiar en que login valide los puntos |
| H4: tiempo sin reportar infla margen | Pendiente | Economía/reloj del servidor y política de partidas offline verificable |
| H7: muchas identidades dejan filas | Mitigado por cuotas, no eliminado | Política de retención de invitados y revisión de borrado antes de tocar datos reales |

## Encargo P0: progreso competitivo autoritativo

Crear un modo competitivo donde el servidor sea dueño del estado y valide compras, skins, tiempo y taps con las mismas funciones puras del juego. Mantener una demo local jugable sin conexión. No reemplazar ni borrar guardados históricos: diseñar una importación no verificada y explicar cuál clasificación usa cada modo. Probar un primer reporte de 1e12, borrar cookie, dos pestañas, reintentos duplicados, cambio de reloj y sesiones caducadas. Sólo publicar después de comparar migración y experiencia móvil.

## Encargo P1: configuración real de cuentas

Completar proyecto Supabase, claves publicables, proveedores Google/Meta, redirects exactos y SMTP. La UI/backend están conectados; Google, Facebook, verificación de correo y recuperación necesitan pruebas reales en un proyecto separado. Nunca entregar claves secretas al bundle; el build ya rechaza `service_role` y `sb_secret_`.

## Encargo P2: balance y prestigio

Usar `npm run balance` y `npm run prestige:simulate`, no descripciones de IA como prueba. Definir tiempos objetivo de compra y de una vuelta, luego cambiar coeficientes con comparación antes/después. Prestigio conserva skins y no limpia desgaste, identidad ni marca de sospecha. Prestigio activado el 14 de octubre con confirmación individual y migración v3, conservando skins. Pendiente validar las ganancias y los bigotes en el servidor.

## Encargo P3: infraestructura y publicación

Dominio permanente, túnel administrado, DNSSEC/WAF en la zona propia y monitorización. Probar ZIP en un iframe privado de itch antes de publicarlo. Steam requiere onboarding y build de escritorio; el reporte no sustituye un benchmark Windows real.
