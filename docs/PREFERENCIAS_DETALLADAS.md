# Niveles, gustos explícitos y Spotify

Los cambios se aplican a las nuevas tandas. Las tandas preparadas, la cola y la posición del audio se conservan. La compatibilidad emocional se evalúa antes de ordenar por gustos: ningún nivel permite saltarse ese filtro.

## Cinco niveles

Se guardan en `users.preferences.preferenceLevel`, un entero de 1 a 5. Las cuentas anteriores usan 3. Se puede guardar sólo el nivel, incluso con artistas y géneros vacíos, para usarlo con Spotify.

| Nivel | Nombre | Mezcla objetivo con artistas favoritos, por siete canciones |
| --- | --- | --- |
| 1 | Sorpréndeme | 0 favoritas, 2 cercanas, 5 descubrimientos |
| 2 | Quiero explorar | 2 favoritas, 3 cercanas, 2 descubrimientos |
| 3 | Equilibrado | 4 favoritas, 2 cercanas, 1 descubrimiento |
| 4 | Cerca de mis gustos | 6 favoritas, 1 cercana |
| 5 | Sé lo que quiero escuchar | Sólo coincidencias directas con tus preferencias |

Con sólo géneros, el objetivo de descubrimientos es 5, 3, 2, 1 y 0 respectivamente. Son objetivos de diversidad sujetos al catálogo compatible; los niveles 1–4 pueden completar con otros candidatos válidos. El nivel 5 nunca se completa con gustos ajenos: requiere artista elegido/importado, canción del perfil de Spotify, género elegido o un ajuste explícito «Más de esto». Puede devolver una tanda parcial o vacía si no hay suficientes coincidencias. «Menos de esto» reduce prioridad, pero no equivale a excluir.

## Dos preguntas independientes

- **Encaja con el mood / No encaja:** valoración de esa canción en ese momento. «No encaja» evita la canción en las próximas tandas de ese mood, sin vetar al artista o al género en general. Pulsar de nuevo quita el voto.
- **Mis gustos: canción o artista:** preferencia personal para todos los moods. Permite favorecer la canción o el artista, ocultar la canción o reducir el artista. En Preferencias → Afina tus gustos se puede elegir canción, artista o género y aplicar «Más de esto», «Menos de esto» o «No mostrar».

La regla más específica tiene prioridad: **canción > artista > género**. Así, una canción marcada «Más de esto» puede ser excepción a un artista excluido, pero una canción excluida no reaparece porque guste su artista. Entre reglas de igual especificidad, excluir prevalece sobre reducir y favorecer. La exclusión por mood sigue aplicándose incluso a una canción que guste globalmente.

Los votos nuevos de compatibilidad llevan `intent: mood` y no se generalizan a gustos del artista/género. Los votos anteriores sin intención explícita mantienen su aprendizaje suave anterior; se pueden quitar desde el historial y volver a valorar con la intención nueva. Eliminar el cuestionario no elimina votos ni ajustes detallados.

## Spotify

La importación toma una muestra acotada de nueve fuentes:

- Hasta 50 artistas y 50 canciones principales por cada plazo: corto, medio y largo.
- Hasta 200 canciones guardadas, 100 artistas seguidos y 50 reproducciones recientes.
- Perfil final de hasta 50 artistas, 400 canciones únicas y 80 etiquetas de género; las etiquetas utilizables se cruzan con el catálogo de VibeTrack.

Aquí «seguidos» son los artistas que sigue el usuario; no se consultan gustos de sus seguidores. Las fuentes contribuyen al peso de artistas con distinta intensidad; lo reciente pesa menos que los favoritos habituales. Guardar una canción en Spotify no la asigna a un mood.

Las fuentes se consultan con concurrencia máxima de tres y paginación limitada. Dos actualizaciones simultáneas de la misma cuenta comparten la operación. Una actualización reemplaza su contribución anterior: no acumula artificialmente likes ni reproducciones. Una fuente fallida conserva su última lectura y aparece como no disponible. Una fuente vacía obtenida correctamente sí reemplaza los datos anteriores. Si fallan todas, se informa del error y no se confirma una actualización.

La interfaz muestra fuentes, cantidades, permisos pendientes y muestras limitadas. Para cuentas ya vinculadas: **Cuenta → Vinculaciones → Actualizar permisos de Spotify** y después **Preferencias → Actualizar gustos de Spotify**. Los nuevos permisos son `user-library-read` y `user-follow-read`; también se usan `user-top-read` y `user-read-recently-played`. No se modifica la biblioteca de Spotify. Desvincular espera cualquier importación activa y borra su contribución local.

Referencias oficiales: [top de artistas/canciones](https://developer.spotify.com/documentation/web-api/reference/get-users-top-artists-and-tracks), [artistas seguidos](https://developer.spotify.com/documentation/web-api/reference/get-followed), [canciones guardadas](https://developer.spotify.com/documentation/web-api/reference/get-users-saved-tracks) y [permisos](https://developer.spotify.com/documentation/web-api/concepts/scopes).

## Código y persistencia

- `recommendation-engine.ts`: cupos, elegibilidad y orden; `mood-classifier.ts`: compatibilidad emocional independiente.
- `taste-rules.ts`: identidad normalizada, prioridad y almacenamiento en `taste_rules` por cuenta. Hasta 2.000 ajustes, escrituras atómicas por clave hash y error visible si no se pueden guardar.
- `feedback.ts`: votos por cuenta/mood en `music_feedback`.
- `spotify-taste.ts`: fuentes, normalización y perfil de una lectura; `spotify.service.ts`: OAuth, consultas y estados; `spotify-artists.ts`/`taste-profile.ts`: contribución al recomendador.

Las rutas autenticadas `GET/POST /api/music/taste-rules` y `DELETE /api/music/taste-rules/:key` no aceptan propietario en el cuerpo. Las escrituras usan la protección de origen existente. Sus respuestas son privadas y no se cachean. `PUT /api/auth/preferences` acepta `{ genres, artists, preferenceLevel }`. No hay migración destructiva: los campos nuevos son opcionales con valores predeterminados.

## Validación y prueba con tu cuenta

Se probaron niveles y límites, excepciones canción/artista/género, independencia de mood, aislamiento de cuentas, errores de persistencia, paginación y permisos de Spotify, importaciones repetidas y desvinculación concurrente. La compilación y el arranque de producción se verificaron sin servicios externos. Las capturas de interfaz usan el frontend real y datos sintéticos a 390 y 1280 píxeles; las pruebas DOM comprueban controles y conservación del elemento de audio, no reproducción real de Spotify.

Para cerrar la comprobación con servicios reales:

1. Con la aplicación local abierta y sesión iniciada, actualiza permisos en Cuenta → Vinculaciones. No compartas contraseñas ni tokens.
2. En Preferencias actualiza Spotify y abre «Datos de Spotify utilizados». Comprueba que aparecen las fuentes autorizadas; una biblioteca vacía debe decir 0, y un error debe indicarse como tal.
3. Guarda nivel 1 y luego nivel 5, recarga y verifica que conserva el valor. Pide nuevas tandas en ambos casos; el nivel 5 debe respetar tus gustos y puede ofrecer menos canciones.
4. Mientras escuchas una canción, prueba «No encaja» en un mood y «Me gusta el artista». La reproducción debe continuar; el artista sigue permitido y esa canción se evita en las nuevas tandas de ese mood.
5. En Afina tus gustos excluye un artista y añade «Más de esto» para una canción suya. Comprueba la excepción en nuevas tandas, sin esperar que fuerce una repetición inmediata del tema. Quita los ajustes de prueba al terminar.
6. Repite el recorrido con Tab, Mayús+Tab, flechas en radios/selectores y Enter/Espacio. Comprueba el flujo también desde tu teléfono.

La importación OAuth real, la persistencia en tu MongoDB y el audio real requieren esta comprobación con tu cuenta; no se han simulado como resultados reales.
