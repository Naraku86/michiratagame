# Economía medida con las funciones del juego

## Ejecutar, sin servicios ni dependencias nuevas

```sh
node --experimental-strip-types --test tools/balance.test.ts
node --experimental-strip-types tools/balance.ts
```

Node 24. El segundo comando sobrescribe solamente `artifacts/balance-summary.json` y `.csv`. Importa `SKINS`, `tap`, `advance`, `cost`, `production`, `pointsPerClick` y la fatiga real: los poderes añadidos al catálogo se incluyen automáticamente sin copiar fórmulas en el simulador. No importa el servidor ni toca datos de jugadores. Volver a ejecutarlo después de integrar nuevas skins.

Matriz: niveles 0,9,10,16,20,40,60,80,100, con ambos tipos de mejora al mismo nivel; tasas 0,1,4,8,20,100 clics/s; 600 segundos y tres semillas fijas (17,431,20261013). Se parte con 2.000 puntos para medir poderes de ahorro saturados. No compra mejoras durante la ventana: compara el rendimiento local de cada configuración, no una partida optimizada ni tiempo real de progresión. Todas las ganancias, incluidas las automáticas, pasan por las funciones reales. La primera pulsación ocurre a 1/tasa segundos; una separación mayor de1,5s corta la cadena, igual que el cliente.

El coste dividido entre ingreso/s es una **estimación de espera desde saldo cero a rendimiento constante**, no el tiempo real para pagar desde los 2.000 iniciales. Cambiar de skin, comprar o quedar en segundo plano puede cambiar ese rendimiento. `nextClickSeconds` usa la primera semilla; total/ingreso son promedios y margen es el peor de las tres. Nivel100 informa coste próximo nulo porque ya no puede comprarse. El máximo de1e12 también limita las ganancias medidas.

## Fórmulas y comprobaciones

- Base de clic: C=(1+L)·2^floor(L/10); producción base P=W·2^floor(W/10).
- Precio: ceil(base·1,5^min(n,10)·1,15^max(0,n−10)), bases15/30.
- Fatiga: eficiencia=1/(1+calor/20)^2; bolsa24, recarga8/s y recuperación de calor1/s. Se registra cada pulsación, luego se aplica la eficiencia a todo su premio. La producción automática no se reduce.
- Bufón: E[multiplicador]=0,6·2+0,3·5+0,1·10=3,7. Cada cinco clics añade en promedio0,74C/clic. El test comprueba100.000 tiradas y la ganancia observada; los artefactos mantienen tres muestras separadas mediante mínimo/máximo, no presentan el promedio como valor exacto.
- Para cualquier skin nueva `simulate(id, nivel, tasa, segundos, semilla, false)` permite desactivar solamente la fatiga y contrastar poderes. Es diagnóstico; no cambia el cliente.
- Envolvente de sospecha utilizada:40.000.000+10.000.000·segundos. Está copiada explícitamente del servidor para evitar arrancar HTTP/SQLite: si cambian esos dos límites, actualizar la función y el test. El margen positivo no demuestra que un jugador sea legítimo.

## Resultado inicial: seis skins, antes de integrar las nuevas

324 escenarios,972 corridas;1,7 segundos en este servidor. Cuatro tests aprobados. Ningún escenario rebasa la envolvente de sospecha. Regenerar los artefactos para el catálogo ampliado: estas cifras históricas no lo cubren.

Ingreso/s con4clics/s, fatiga activa,600s:

| Nivel | Original | Futbolista | Robot | Godín | Bufón (semilla17) | Magnate |
|---|---:|---:|---:|---:|---:|---:|
|16|168|516|306|287|268|272|
|20|416|1264|746|713|664|616|
|40|3264|9832|5834|5627|5197|4584|
|60|19456|58504|34826|33600|30960|27176|
|80|103424|310792|185354|178773|164526|144424|
|100|516096|1550344|925706|892587|820852|720936|

Espera estimada para siguiente mejora de clic: Original nivel16=11,9s;20=8,4s;40=17,5s;60=48,2s;80=148,3s. Futbolista nivel80=49,4s. Estos resultados muestran una brecha de skins significativa; no son una propuesta de nerf automático. A tasa0 el Magnate triplica producción base mientras haya ahorro; Godín duplica. Los bonos planos +2/clic y +10/clic pierden peso al subir niveles, los bonos proporcionales conservan ventaja.

Original nivel100:8clics/s→929.792 puntos/s;20/s→115.332;100/s→110.582. La producción sola es102.400/s. La fatiga no sólo reduce el premio por pulsación: a largo plazo la tasa excesiva genera menos rendimiento total. Validar si esa penalización es el comportamiento deseado antes de cambiar su fórmula.

## Comprobación del catálogo ampliado

Se ejecutó también el mismo script contra `src` de la rama de skins con24 entradas, desde una carpeta temporal:1.296 escenarios/3.888 corridas en10,75s, cuatro tests aprobados y ningún margen de ranking negativo. Los artefactos de esta rama conservan la matriz inicial de seis; el integrador debe regenerarlos al combinar las ramas. Esta comprobación evita modificar `game.ts` compartido durante el desarrollo paralelo.

## Qué ajustar después de observar a la comunidad

1. Comparar skins en4/s y0/s por separado. Una skin ganadora absoluta en ambas modalidades hace irrelevante la elección; no equilibrarlas sólo por clic base.
2. Comparar niveles justo antes/después del hito (9/10, luego79/80 al investigar). Los hitos duplican producción y producen dientes en el tiempo de compra.
3. Para niveles altos, definir explícitamente un tiempo objetivo de compra antes de modificar el1,15 de precios. Precio crece~1,15 por nivel mientras el multiplicador equivale~1,072 por nivel: la espera acaba creciendo incluso con hitos.
4. Repetir el margen de ranking al añadir cada poder. Este análisis uniforme no cubre mezclas de niveles, ráfagas y alternancia de skins, prestigio futuro, ni un cliente manipulado. No usarlo como detector definitivo.

No cambia economía, progreso guardado ni UI. No mide diversión/retención ni hace una búsqueda global de la mejor estrategia; mide consecuencias reproducibles de las funciones actuales.
