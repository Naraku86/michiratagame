# Comparación del texto sobre clickers con la demo

Fecha: 13 de octubre de 2026. Revisión del código; no se implementaron cambios.

## Qué aplicamos

| Elemento | Estado real |
| --- | --- |
| Clic → recurso → mejora | Implementado con puntos, clic y contrataciones. |
| Automatización | Trabajadoras producen con la pestaña activa; no hay ingreso offline. |
| Premios predecibles | Goles cada 8 clics, descargas cada 10 y café cada 12 dentro de racha. |
| Sorpresa aleatoria | Bufón paga un bono de tamaño variable cada 5 clics: ×2/×5/×10 con probabilidades 60/30/10 %. Es frecuencia fija con magnitud variable. |
| Prestigio | Ausente. Reiniciar progreso borra el guardado; no entrega beneficios. |
| Metas | Siguiente compra, skins e hitos ×2 cada diez niveles. No hay un sistema adicional de misiones o objetivos de dos horas calibrados. |
| Recuperación del estancamiento | Costos crecen ×1,15 después del nivel 10 y bases se multiplican por hitos; se conserva el progreso. |
| Identidad de comunidad | Memes aportados por amigos, pruebas y difusión fuera del juego. No hay conexión social dentro de la demo. |
| Ranking, referidos y compartir desde la app | Pendientes. |
| Estado visible | Saldo, puntos/clic, producción/s, poder, progreso de metas, puntos faltantes y estimación pasiva. |
| Interacción central | Botón grande, teclado/tacto, rebote, sonido ñiii y textos flotantes. |
| Gestión móvil | Botones inferiores Jugar/Mejoras/Colección; marcador visible entre secciones. |
| Gestión escritorio | Juego, metas/mejoras y colección en paneles. |
| Revelación progresiva | Descripciones con Ver poder y un siguiente objetivo; las seis skins se muestran desde el inicio. |
| Compra por lotes | Ausente; una mejora o trabajadora por acción. |
| Estado de tienda | Color al poder comprar, gris al no alcanzar, faltante y progreso. No se usan requisitos adicionales ni candados. |
| Haptics | Ausente; no se llama a vibración. |
| Color y efectos | Acentos por skin y partículas por poder. No existe aumento gradual de saturación por velocidad. |
| Números compactos | Ausente. Intl.NumberFormat es-MX con cifras completas y separadores. |
| Cadencia regular | Ausente. Racha por cantidad, con intervalo máximo de 1,5 s, sin medir regularidad. |

Los stickers grandes de cara/salto se reservan a subir mejora de clic/contratar. No se disparan con clics ni premios de racha. Se mantienen controles de sonido/efectos y movimiento reducido.

## Afirmaciones del texto que necesitan matices

- Condicionamiento operante es una lente útil, no una explicación exclusiva. Investigación sobre videojuegos también relaciona autonomía, competencia y conexión con disfrute y deseo de volver. [Ryan, Rigby y Przybylski](https://link.springer.com/article/10.1007/s11031-006-9051-8).
- No tenemos mediciones de dopamina, adicción, retención o retorno de esta demo. No presentar esas propiedades como resultados ya probados.
- Más saturación no garantiza eliminar aburrimiento: un estudio de RPG encontró peores resultados con efectos extremos que con intensidades intermedias. No generalizar sus cifras a todos los clickers. [Kao](https://experts.illinois.edu/en/publications/the-effects-of-juiciness-in-an-action-rpg/).
- Prestigio puede entregar moneda del juego o multiplicadores, sin ser una compra premium. La referencia de Kongregate lo describe como un reinicio con beneficios persistentes. [Matemática de idle games](https://www.kongregate.com/id/pages/the-math-of-idle-games-part-i).
- Diseñar ocasiones para compartir no garantiza difusión masiva. Aquí solo tenemos señales cualitativas del grupo.
- El crecimiento actual es finito: límite de 100 niveles por familia y 10 elevado a 12 puntos.
- En español, billón significa 10 elevado a 12. El B anglosajón representa 10 elevado a 9. Si compactamos, usar etiquetas coherentes o mil/millones con valor exacto disponible.

## Siguiente prioridad propuesta

1. Evaluar si el nuevo balance realmente resuelve el estancamiento después del nivel 16.
2. Probar un evento de atención opcional o una meta corta repetible, una cosa cada vez.
3. Comparar una alternativa de cadencia con la referencia actual, con economía comparable.
4. Incorporar cifras compactas si los números grandes afectan lectura; mantener exactitud de precios y disponibilidad.
5. Considerar lotes de compra cuando se observe fricción real.

Prestigio, offline, ranking y referidos quedan como decisiones futuras, no como requisitos derivados del texto. Ver EXPERIMENTOS_AGENTES.md para evaluaciones aisladas y UI_UX_PROGRESION.md para la curva vigente.


## Actualización: desgaste de clics

Autoclickers permitidos con rendimiento decreciente en clics y bonos: reserva de 24 clics, recarga de 8/s, exceso convertido en calor y recuperación de 1 unidad/s. Factor `1/(1+calor/20)^2`. Las trabajadoras mantienen su producción. Persistencia separada: recargar, reiniciar o cambiar de skin no elimina el desgaste. No se borraron récords ni se clasificó a ningún usuario como bot: los marcadores actuales no conservan cadencia y el backend aún recibe puntos del cliente.
