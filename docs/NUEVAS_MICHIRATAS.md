# Nuevas Michiratas — demo, 2026-10-13

18 originales WebP conservados sin modificación; 24 skins en total. Sólo la equipada aplica poderes; comprar no acumula buffs. Precios en puntos del juego, nunca dinero. Los coeficientes son propuestas pendientes de pruebas comunitarias.

C=(1+nivel clic)×2^floor(nivel/10); P=nivel trabajadoras×2^floor(nivel/10). Cada clic da C×c. Producción por segundo P×a. Cada N clics seguidos añade C×b + (P×a)×s. El desgaste existente reduce **todo** el premio del clic, incluido el bono, sin afectar producción. Cambiar skin no modifica el desgaste.

|Skin / archivo|Prefijo origen|Precio|c|a|N|b|s|
|---|---|---:|---:|---:|---:|---:|---:|
|Mapache / michirata-mapache.webp|1791950524029|900|1.4|1|6|5|0|
|Walkman / michirata-walkman.webp|1791950524108|1100|1.2|1.2|8|7|0|
|Sirena / michirata-sirena.webp|1791950527303|1400|1|1.4|10|2|5|
|Ranita / michirata-ranita.webp|1791950524317|1700|1.6|1|4|3|0|
|Garabato / michirata-dibujo.webp|1791950524112|2000|1.8|1|12|10|0|
|Peluca / michirata-peluca.webp|1791950524150|2400|1.3|1.3|6|4|1|
|Presidenta / michirata-presidenta.webp|1791950524145|2800|1|2.2|15|2|4|
|Queso gigante / michirata-queso.webp|1791950524543|3300|1|3|16|0|4|
|Brujita / michirata-brujita.webp|1791950524351|3900|1.5|1.2|9|8|1|
|Calabaza / michirata-calabaza.webp|1791950524213|4500|1.2|1.5|7|5|2|
|Sumo / michirata-sumo.webp|1791950524227|5200|2|1|10|8|0|
|Mole / michirata-mole.webp|1791950524460|6000|1.1|2|12|1|4|
|Venadito alado / michirata-venadito.webp|1791950527478|6900|1.7|1.3|8|6|1|
|Oficinista / michirata-oficinista.webp|1791950524268|7900|1.1|3.4|18|0|4|
|Tecladista / michirata-tecladista.webp|1791950527284|9000|1.3|1.8|11|3|3|
|Ñi / michirata-ni.webp|1791950524043|10200|2.5|1|3|4|0|
|Locutora / michirata-locutora.webp|1791950524401|11500|1.5|1.6|10|4|2|
|Mágica / michirata-magica.webp|1791950527454|13000|2|1.8|14|16|3|

Sirena, Venadito, Tecladista y Mágica son animados. Las miniaturas se cargan al abrir la colección y se descargan de los elementos al cerrarla; la skin equipada permanece animada cuando los efectos están activos. Al apagarlos o pedir movimiento reducido, la UI conserva un frame en canvas (también en miniaturas), sin modificar los archivos. Ningún formato se convirtió.

Perfiles: Sumo/Ñi favorecen clic; Queso/Oficinista producción pasiva; Brujita/Calabaza/Mágica combinan ambos; Walkman/Locutora premian cadenas intermedias. Las fórmulas siguen escalando en niveles 16,60,100. Los coeficientes no crecen con el número de skins adquiridas. La fórmula mantiene producción máxima ≤348160/s a nivel100 sin otros modificadores.

Este frente no activa prestigio ni implementa cuentas (la integración de autenticación está documentada por separado); se reutilizan los seis efectos ya disponibles.
