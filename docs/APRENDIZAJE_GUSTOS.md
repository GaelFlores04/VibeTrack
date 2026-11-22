# Preferencias y valoraciones por mood

**Evolución actual:** consulta [PREFERENCIAS_DETALLADAS.md](PREFERENCIAS_DETALLADAS.md). Los votos nuevos separan compatibilidad con el mood de gustos personales, existen cinco niveles y reglas globales. La generalización de votos descrita abajo se conserva sólo para valoraciones anteriores sin intención explícita; los cupos indicados corresponden al nivel 3.

El catálogo de `backend/src/modules/music/genres.ts` sirve tanto a la validación de preferencias como al formulario mediante `GET /api/music/genres`. Hay 16 familias y sus subgéneros; se pueden elegir hasta 12 estilos y cinco artistas. Los valores de preferencias anteriores siguen siendo válidos. Elegir una familia permite sus subgéneros; elegir un subgénero requiere esa evidencia concreta, no basta la etiqueta de su familia.

Las cuentas pueden valorar cada canción de las tandas con «Me gusta» o «No para este mood». Pulsar de nuevo quita la valoración. Hay un solo voto vigente por cuenta, mood y combinación normalizada de artista/título. Las coincidencias entre proveedores y los remasters conservan el voto; live, remix y acoustic siguen siendo versiones diferentes según el normalizador existente.

## Cómo se resuelven las señales

- El dislike de una canción la excluye de las **nuevas** tandas de ese mood. No excluye al artista ni al género.
- El like concreto añade 0,30 al ranking y prevalece sobre la afinidad general negativa de artista/género. Las reglas de compatibilidad con el mood siguen aplicándose.
- Las demás canciones reciben ajustes suaves por saldo de likes y dislikes del artista (máximo ±0,12), género (±0,06), artistas similares (+0,08) y semejanza con perfiles de audio positivos/negativos (±0,04). Dos votos neutros previos atenúan la generalización a partir de pocas canciones. Una opinión aislada no se convierte en un veto general.
- Todos los votos vigentes del mood participan; un like nuevo no reemplaza los anteriores. Cambiar o quitar un voto recalcula su efecto, sin acumular clics.
- Se añaden fuentes de los artistas/géneros con saldo positivo y similares. Rotan entre tandas para dar espacio a otros likes. Las fuentes del mood y las preferencias explícitas se conservan.
- Se mantienen los cupos existentes de favoritos, cercanos y descubrimientos. Sin cuestionario se intenta limitar a dos temas por artista; si falta catálogo compatible, se completa con las alternativas disponibles.

Las valoraciones son independientes entre moods. Las tandas ya preparadas se conservan, así como la cola, el audio y su posición. El historial de canciones mostradas sigue evitando repeticiones; un like aumenta la afinidad de las recomendaciones futuras, no fuerza una repetición inmediata de esa canción.

## Persistencia y recuperación

MongoDB guarda `music_feedback`, un documento por cuenta/mood con clave derivada de la cuenta y votos bajo claves hash. Cada modificación usa `$set`/`$unset` del voto concreto. El índice `_id` integrado basta; no se necesita migrar datos ni crear índices adicionales. No tiene caducidad automática. Hay un límite de 2.000 canciones valoradas por mood; al alcanzarlo se solicita quitar una valoración, sin borrar dislikes automáticamente. El almacenamiento en memoria se usa únicamente cuando no se inyecta una base de datos (pruebas).

En Preferencias, «Tus likes y dislikes» permite buscar valoraciones por mood y quitarlas aunque la canción ya no aparezca en las recomendaciones o el servidor haya reiniciado. Eliminar el cuestionario no elimina esas valoraciones.

Las escrituras requieren sesión y protección de origen. Para valorar, el servidor acepta únicamente IDs de canciones que haya mostrado a esa cuenta en ese mood, incluidas selecciones parciales. Artista, etiquetas y audio se obtienen de esos metadatos del servidor. La recuperación del historial y su borrado están aislados por la cuenta autenticada. Las respuestas de valoraciones usan `private, no-store`.

## Comprobaciones

Las pruebas cubren votos reversibles, aislamiento por cuenta/mood, persistencia simulando reinicio, fallos de guardado, contradicciones entre canción/artista/género, variedad, tandas parciales, conservación de la tanda actual, recuperación de dislikes y navegación de los nuevos controles por teclado en DOM simulado. También se comprueba que toda recomendación se clasifique antes de mostrarse y que la letra conserve su veto cuando no haya rasgos de audio.

Las pruebas no sustituyen una verificación visual y de reproducción en navegadores reales ni una conexión a MongoDB desplegado.
