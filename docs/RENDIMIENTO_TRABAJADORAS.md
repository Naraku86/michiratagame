# Trabajadoras y autoclic: revisión de rendimiento

Prueba local del 14 de octubre de 2026 con Chromium headless, viewport 1440×1000, skin Original, nivel de clic 100, saldo inicial 1.000.000, API desconectada y ventanas de tres segundos. Guardado v2 válido; comparar 1 y 100 trabajadoras. Para autoclic, ejecutar diez `.hero__button.click()` cada 10 ms. Medir diferencias de `Performance.getMetrics().TaskDuration` y contar registros de `MutationObserver` sobre `.game`.

| Caso | Tiempo de tareas antes | Después | Mutaciones antes | Después |
|---|---:|---:|---:|---:|
| 1 trabajadora, sin clic | 0,044 s | 0,050 s | 2.436 | 2.436 |
| 100 trabajadoras, sin clic | 0,034 s | 0,064 s | 2.463 | 2.463 |
| 100 trabajadoras, 2.990 clics | 0,756 s | 0,161 s | 245.511 | 5.573 |

El render mantiene como máximo 12 sprites, incluso con 100 trabajadoras; producción es una fórmula sin iterar por trabajadora. Los guardados con niveles mayores que 100 se rechazan. No se reprodujo un coste proporcional al total contratado.

El problema reproducido es llamar al render completo por cada autoclic. Ahora el clic sigue calculando su recompensa y fatiga, pero solo actualiza la interfaz cuando corresponde emitir feedback (intervalo mínimo 80 ms). La producción sigue actualizando cada 100 ms. En este escenario el tiempo de tareas bajó aproximadamente un 79 %; no es una medición del uso total de CPU/GPU ni de la máquina del jugador. Animaciones, imágenes animadas y un autoclicker externo también pueden consumir recursos.

Validación: 114 pruebas pasan, build compilado y prueba de navegador con límite de 12 sprites. Para reproducir el caso original faltan navegador/dispositivo, skin, cantidades, velocidad del autoclicker y si tenía efectos activos. No se modificaron recompensas, guardados ni las penalizaciones de fatiga.
