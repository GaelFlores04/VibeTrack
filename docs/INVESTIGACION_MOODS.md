# Motor de moods: investigación, decisiones y verificación

Revisión del 16–17 de noviembre de 2026. Política `MOOD_POLICY_VERSION = 3`.

## Respaldo y diagnóstico

Antes de editar se creó `C:\Vibetrack\backups\antes-motor-moods-20261116-234501`: copia del código versionable, incluidos cambios sin commit y archivos nuevos, verificada por SHA-256; `history.bundle` contiene el historial Git completo. No incluye dependencias, compilaciones, archivos ignorados ni una copia de MongoDB. Se conservaron las credenciales locales sin modificarlas.

Se revisaron el estado de trabajo y tres etapas del historial:

| Versión | Comportamiento relevante | Problema encontrado |
| --- | --- | --- |
| `c965fd2` | Etiquetas, selección editorial y peso alto de preferencias | Géneros y fuentes de búsqueda podían sustituir evidencia emocional |
| `158cee2` | Rasgos de audio, cuotas y descubrimientos | Valencia/energía podían decidir la emoción sin contexto |
| `86f0bb5` y estado previo | Letras, tempo percibido y margen para favoritos | Un favorito podía entrar con ajuste de audio de 0,6; la curación eludía comprobaciones |

También se encontraron coincidencias laxas de letras (primer fragmento del artista, sin comprobar título), aprendizaje a partir de canciones simplemente mostradas y deduplicación basada principalmente en nombres antes de resolver el catálogo final. Los tests anteriores defendían algunas de esas reglas; se actualizaron sus contratos explícitamente, sin eliminar las pruebas de preferencias, variedad, caché o recuperación.

## Investigación externa

La emoción musical no se reduce a velocidad, modo mayor/menor o valencia. El estudio de [Cowen y colaboradores, PNAS 2020](https://www.pnas.org/doi/full/10.1073/pnas.1910704117), con muestras de participantes de Estados Unidos y China, identifica experiencias más específicas que valencia y activación, con mezclas entre categorías. Esto fundamenta separar tristeza de tensión y afecto de baja energía. No proporciona umbrales transferibles a ReccoBeats ni garantiza la emoción de una persona concreta.

Se inspeccionó código público de dos sistemas, no sólo sus descripciones:

- [Resonance: política de selección](https://github.com/JoseVelazcoH/Resonance/blob/main/backend/mood_dj/domain/mood_selection_policy.py) y [selección desde biblioteca](https://github.com/JoseVelazcoH/Resonance/blob/main/backend/mood_dj/application/recommend_from_library.py). Separa perfiles almacenados de criterios de admisión por mood, ajustados allí con datos etiquetados. VibeTrack adopta la separación entre admisión y ranking; **no** importa sus umbrales, su modelo ni sus afirmaciones de precisión. Su estrategia que excluye instrumentales no sirve para nuestros moods de descanso.
- [VibeNet: procesamiento de audio](https://github.com/jaeheonshim/vibenet/blob/main/vibenet/core.py). Convierte audio a mono, remuestrea a 16 kHz, extrae características y transforma salidas del modelo en rasgos perceptuales. Confirma que estimar rasgos es una tarea distinta de seleccionar una playlist. Mantuvimos ReccoBeats para obtener esos rasgos sin añadir procesamiento local de audio.

Ambos repositorios consultados publican código bajo GPL-3.0. No se copió su implementación. Se estudiaron sus decisiones y se escribió la política propia en TypeScript.

Se revisaron los [modelos oficiales de Essentia](https://essentia.upf.edu/models.html): ofrecen estimadores de rasgos y moods, requieren audio de entrada y tienen condiciones de licencia específicas (los modelos MTG publicados allí usan CC BY-NC-SA 4.0, con alternativas comerciales). No se añadieron modelos pesados ni servicios de pago a Render Free. No se afirma haber medido su rendimiento en nuestro despliegue.

Se conservan las APIs: Last.fm para catálogo y etiquetas, Deezer para identidad/preview/ISRC, [ReccoBeats](https://reccobeats.com/docs/apis/get-audio-features) para rasgos, [LRCLIB](https://lrclib.net/docs) para letras, iTunes como respaldo de preview y Spotify para gustos/reproducción. Se comprobó en vivo que ReccoBeats acepta los ISRC utilizados. Las letras no se guardan: sólo su perfil numérico.

## Política implementada

| Mood | Señales necesarias | Confusión que se evita |
| --- | --- | --- |
| Feliz | Sonido positivo compatible y contexto alegre de canción; sin contradicción textual | Funk/disco, ritmo o valencia alta como prueba suficiente de alegría |
| Triste | Sonido de baja valencia y activación moderada/baja, con contexto melancólico o de pérdida | Banda sonora oscura o tensión instrumental clasificadas automáticamente como tristeza |
| Romántico | Contexto de afecto y sonido compatible | Confundir una pista tranquila o una historia de ruptura con romance |
| Relajado | Baja/moderada activación y ausencia de señales intensas contradictorias | Tratar todo lo acústico o un género completo como relajante |
| Cansado | Activación particularmente baja y poco estímulo rítmico | Equiparar descanso con cualquier piano o canción lenta |
| Motivado | Energía sostenida, pulso compatible y ausencia de contradicciones relevantes | Confundir energía media y oscuridad con impulso |

`mood-classifier.ts` contiene perfiles y `assessMood`: devuelve puntuación, evidencias utilizadas y motivo de aceptación/rechazo. Es una **política heurística**, no una probabilidad calibrada ni un modelo entrenado. Los rangos, umbral de admisión 0,8 y ajuste mínimo de audio son decisiones de producto pendientes de evaluación con usuarios.

El orden de decisión es:

1. Etiquetas contrarias y contradicciones de letra descartan. La curación tampoco elude esas reglas.
2. Un error temporal al consultar letras deja la candidata pendiente. Ausencia confirmada y error son estados diferentes.
3. Si existe audio, debe ser válido y alcanzar un ajuste de 0,8. Para feliz, triste y romántico se necesita además contexto propio de la canción. Para los otros tres moods, audio solo requiere un ajuste de 0,9.
4. Sin audio, una etiqueta emocional directa o una referencia editorial puede servir como respaldo. Género, artista, popularidad y presencia en una lista de búsqueda nunca son suficientes por sí mismos. Las letras solas tampoco describen el arreglo musical.
5. Sólo después se aplican gustos, likes/dislikes, cuotas y orden de reproducción. Un favorito no reduce el umbral. Los likes afinan el ranking y las fuentes futuras, conservando los demás votos; el dislike concreto excluye la canción, no todo su artista o género.

El léxico español/inglés añade señales de amenaza y sustancias, y evita contar algunas negaciones cercanas como alegría o afecto. Esto reduce contradicciones detectadas en la revisión, pero no equivale a entender narración, metáfora o ironía.

## Identidad, eficiencia y mantenimiento

- Deduplicación por alias normalizados, ID del proveedor e ISRC, antes de contar canciones. El historial conserva también las identidades resueltas. Live/remix/acoustic mantienen identidades distintas; el ISRC del proveedor identifica la grabación.
- Título y artista deben coincidir también al buscar letras. La versión de caché cambia para no reutilizar perfiles obtenidos con el emparejamiento anterior.
- Se recupera la ficha Deezer cuando falta ISRC en búsqueda, sólo si confirma la misma canción.
- Enriquecer previews conserva metadatos de clasificación y evita introducir una colisión en la tanda. Likes y dislikes pueden consultar también la identidad resuelta.
- Se mantiene agrupación de solicitudes, caché de metadatos y lotes de rasgos. LRCLIB comparte el límite de concurrencia por proveedor; los errores no se cachean como respuestas vacías.
- Audio y etiquetas se comprueban antes de pedir letras: un rechazo ya concluyente evita esa llamada adicional. Una prueba específica verifica que un catálogo de audio incompatible no haga ninguna petición a LRCLIB.
- Si diez o más candidatas de un grupo tienen menos de 20 % de coincidencias, se reduce su esfuerzo de búsqueda y se amplía el espacio para otras fuentes. **No** se reducen los criterios de admisión ni se cambian los cupos por esta razón.
- Se retiró el aprendizaje que interpretaba la propia recomendación como aceptación. Las escuchas y valoraciones siguen aportando señales.
- Se conservan API, páginas, navegación, reproductor y tandas ya preparadas. Si no hay siete coincidencias, se informa del avance o agotamiento y se conserva la tanda anterior.

## Evidencia de verificación

La muestra reproducible está en [mood-provider-sample.json](mood-provider-sample.json). Son doce canciones elegidas para revisar errores y referencias, **no** una muestra aleatoria ni una medición de precisión global. La consulta real rechaza los cuatro casos ambiguos de las capturas para los moods señalados, además de “Pumped Up Kicks” y “Semi-Charmed Life” para feliz. Acepta las seis referencias: Happy, Fix You, All of Me, Banana Pancakes, River Flows in You y Lose Yourself.

También se probaron tandas contra APIs reales, con preferencias de ejemplo y sin tocar cuentas o MongoDB; [mood-batch-sample.json](mood-batch-sample.json) registra estados, intentos y tiempos. La latencia y cobertura cambian con las APIs. Un filtro más estricto puede necesitar reintentos y devolver menos coincidencias mientras faltan datos; no se oculta esa limitación rellenando canciones dudosas.

En la última ejecución en frío, feliz completó siete canciones en tres intentos (~51 s, incluidas esperas) y triste en uno (~13 s). No es un objetivo de rendimiento satisfecho para toda combinación: las consultas externas siguen siendo el principal límite. Las tandas ya preparadas se recuperan desde la sesión y los metadatos públicos se reutilizan desde caché.

Para reproducir la auditoría de metadatos (requiere build y clave de Last.fm local):

```powershell
npm run build -w backend
node backend/scripts/check-moods.cjs
# Opcional: sobrescribir únicamente el informe público de la muestra
node backend/scripts/check-moods.cjs --write
```

Las pruebas automatizadas cubren contradicciones, fuentes insuficientes, favoritos, grabaciones duplicadas entre tandas, errores y recuperación de letras, identidad entre proveedores, señales corruptas, persistencia simulada, diversidad y continuidad de reproducción. No sustituyen una evaluación auditiva ciega: el siguiente paso para medir precisión sería etiquetar un conjunto amplio por mood, usuario e idioma, separar calibración de evaluación y reportar aceptación incorrecta, cobertura y latencia por separado. No se ha entrenado ni validado estadísticamente un clasificador nuevo.

Validación local: 101 pruebas de backend y 26 de frontend aprobadas; compilación de producción y presupuestos de bundle aprobados; comprobación HTTP de producción (web, rutas React, API, caché y CSP) aprobada; revisión de secretos sin coincidencias. No se desplegó en Render ni se realizó una escucha humana ciega de las playlists.
