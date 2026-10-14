# Guardar stickers y animaciones desde WhatsApp Web (Windows)

No hace falta convertir a GIF para el juego: un WebP animado conserva la animación y puede conservar transparencia. Un MP4 se puede usar como video. Cambiar la extensión no convierte el archivo.

## Primero, la descarga normal

En Chrome o Edge, abre tu conversación en WhatsApp Web.

- GIF/video: abre el mensaje y usa Descargar si está disponible. Conserva el formato que entregue WhatsApp.
- Sticker: prueba clic derecho sobre la imagen y Guardar imagen como, si aparece. Conserva la extensión original.

Abre el archivo guardado en el navegador y verifica que realmente se mueva. Algunas vistas muestran una miniatura estática, no la animación original.

## Si no aparece la opción

1. Clic derecho en el sticker o video y selecciona Inspeccionar (o usa F12 y el selector de elementos).
2. En Elements/Elementos, localiza la etiqueta img o video que corresponde al archivo seleccionado.
3. Busca su src; en video puede estar en una etiqueta source. Si hay srcset, utiliza el recurso mostrado actualmente.
4. Si DevTools ofrece Open in new tab/Abrir en nueva pestaña para esa dirección, ábrela. Una dirección blob: solo sirve en esa sesión del navegador.
5. En la pestaña del recurso, usa Guardar imagen como o Guardar video como, según corresponda.

Este método depende de cómo renderice WhatsApp esa versión. Si el elemento es un canvas, no hay un src utilizable o solo se obtiene una miniatura, no garantiza recuperar la animación. En ese caso, pide al autor el archivo original como documento.

Envía los archivos originales al proyecto, con nombre y descripción del meme. No hace falta hacer capturas ni convertirlos antes.

Referencias: [formato WebP de los stickers](https://github.com/WhatsApp/stickers/blob/main/Android/README.md), [Chrome DevTools](https://developer.chrome.com/docs/devtools/network).
