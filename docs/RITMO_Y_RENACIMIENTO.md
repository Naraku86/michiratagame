# Ritmo humano, sobrecalentamiento y renacimiento

Reglas activas desde el 14 de octubre de 2026, autorizadas por el usuario.

## Clic y penalizaciones

- Contador acotado por ventanas de un segundo, sin guardar miles de timestamps.
- De 1 a 8 clics/s durante cinco ventanas seguidas: +10% al clic, incluidos sus bonos, además del prestigio. Una pausa o exceso rompe la racha. La fatiga anterior sigue aplicándose.
- Más de 30 clics/s durante diez ventanas consecutivas: sobrecalentamiento. No hay recompensas por clic ni producción automática; saldo y puntuación de clasificación pierden 1% por segundo de forma proporcional al tiempo (`saldo × 0.99^segundos`). Nunca hay deuda. Dos segundos de descanso dejan expirar el sobrecalentamiento; la fatiga puede tardar más en recuperarse.
- Una ráfaga aislada no basta. 30/s es una regla de diseño, no prueba fisiológica de que un usuario es un bot. No se etiqueta automáticamente como tramposo solo por superar ese ritmo.
- El aviso y los contadores de clic/producción reflejan la pausa. La interfaz conserva el límite de render para que el spam no vuelva a producir miles de actualizaciones DOM por segundo.

## Renacer con premios

En Ajustes → Renacer y super mejoras, se necesita nivel 40 tanto en clic como en trabajadoras y al menos un bigote pendiente. Se muestra la recompensa y se confirma antes de perder saldo y niveles. No reiniciamos automáticamente a nadie.

`bigotesTotales = floor(cbrt(gananciasAcumuladas / 400000))`. Se reclaman solamente bigotes todavía no reclamados; reiniciar repetidamente sin ganar más no genera premios. El contador de ganancias no baja al gastar ni al ser penalizado. Las skins, logros y mejoras permanentes se conservan.

Los bigotes compran Garra dorada (+20% clic por nivel, máximo ×2), Sindicato michi (+20% producción por nivel, máximo ×2) y Regateo (−4% precios de mejoras por nivel, máximo −20%). Cada familia tiene cinco niveles, con coste 1, 2, 3, 4 y 5 bigotes. El primer renacimiento muestra un borde dorado; completar una vuelta 100/100 desbloquea un borde astral. Son auras cosméticas, no nuevas imágenes ni poderes acumulables de skins.

El botón Borrar partida continúa siendo una acción distinta y con confirmación explícita. No elimina la identidad, récord ni penalizaciones del tablero.

## Marcador

`clasificación = max(0, floor(récordHistórico × (1 + min(25, bigotesReclamados)/100) − deducciones))`.

Cada bigote reclamado da +1%, hasta +25%. El récord permanece separado del saldo gastable. Las deducciones acumuladas bajan la clasificación aunque el récord histórico no disminuya. La base de datos retiene el máximo de bigotes y deducciones recibidos; una pestaña vieja no puede revertirlos. Nombres, cookies, récords y marcas previas de sospecha se conservan mediante migración aditiva de SQLite.

## Persistencia y validación

Guardado v3 atómico con juego, prestigio, ritmo, récord y deducciones; versiones 1 y 2 se leen sin perder skins o niveles. Su ganancia histórica inicial es un mínimo derivado del saldo y costes actuales de lo comprado, no una reconstrucción completa de su historia. Un guardado incompatible se conserva sin sobrescribirlo.

119 pruebas pasan y el build compila. En navegador con reloj controlado se verificó: ritmo 4/s con bono; spam 100/s con saldo decreciente y producción pausada; recuperación al descansar; migración, confirmación de renacimiento, conservación de skins, compra de super mejora y persistencia después de recargar. La prueba de escalado de las 24 skins incluye el margen del bono de ritmo (+10%) bajo el 75% del umbral de sospecha.

**Límite conocido:** el cliente todavía reporta ganancias, bigotes y deducciones. Las validaciones numéricas y retención del servidor no prueban que esos valores se hayan ganado legítimamente; un cliente modificado puede evadir o falsificar esta mecánica. La siguiente corrección competitiva es ejecutar economía y validación de acciones en el backend (ver COLA_DE_CORRECCIONES.md). Estas reglas no son un antitrampa autoritativo.
