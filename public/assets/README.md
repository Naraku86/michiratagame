# Recursos visuales

Imágenes aportadas por la comunidad para Michiratagame:

- `michirata-original.jpg`: Michirata original.
- `michirata-football.jpg`, `michirata-robot.jpg`, `michirata-godin.jpg`, `michirata-jester.jpg`, `michirata-magnate.jpg`: variantes utilizadas como skins.
- `michirata-reaccion.webp` y `michirata-salto.webp`: stickers animados originales, conservados sin convertirlos a imágenes estáticas.

Algunas variantes conservan bordes o elementos de la captura recibida. El juego las muestra mediante CSS. El «ñiii» se sintetiza en `src/sound.ts`; no requiere archivo de audio.

Estos recursos se incluyen en la publicación del proyecto bajo [MIT](../../LICENSE), sin conceder derechos sobre marcas o elementos de terceros representados.

El concepto generado con IA está en `arte/concepto-01.png`; es una exploración visual y no una captura del juego actual.


## Nueva entrega de la comunidad

Se añadieron 18 WebP originales: 14 estáticos y 4 animados, para 24 skins en total. Mapa, precios y fórmulas en [NUEVAS_MICHIRATAS.md](../../docs/NUEVAS_MICHIRATAS.md). No se alteraron ni se convirtieron los originales. La UI muestra siluetas completas, carga previews sólo al abrir el menú y captura un frame en canvas cuando se apagan efectos o se pide movimiento reducido; ese frame es temporal, no un recurso generado con IA.
