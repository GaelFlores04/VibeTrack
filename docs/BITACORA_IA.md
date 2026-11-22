# Bitácora de IA — VibeTrack

Registro del uso de inteligencia artificial como apoyo al desarrollo. Complementa el [diario de decisiones](DIARIO_DECISIONES.md): aquí se documenta el trabajo de cada sesión; allí, las decisiones y sus consecuencias.

**Última ampliación: 22 de noviembre de 2026.** Cubre la propuesta académica, la planeación local, el desarrollo, las verificaciones conservadas y la publicación en GitHub. Las entradas IA-001 e IA-002 conservan el registro de las sesiones conocidas; H-01 a H-10 reconstruyen etapas anteriores sin atribuirlas automáticamente a una IA.

## Alcance, autoría y lectura

La IA utilizada para ayudar a desarrollar y documentar el proyecto es distinta del algoritmo de VibeTrack. La propuesta original define un recomendador basado en reglas; la documentación posterior mantiene una política heurística. Esta bitácora no implica que la aplicación genere recomendaciones con un modelo de lenguaje.

La fecha de un commit indica cuándo se registró ese cambio según Git; la de un push indica cuándo GitHub recibió una actualización de rama. Ninguna demuestra por sí sola cuándo comenzó el trabajo. Las fechas locales del historial usan UTC−08:00; los eventos de GitHub se presentan expresamente en UTC. Un push, un PR, una fusión y un despliegue son hechos diferentes.

Clasificación de evidencia:

| Clase | Qué demuestra | Qué no demuestra |
| --- | --- | --- |
| Observada en esta sesión | Archivos leídos, referencias Git y respuestas de GitHub al consultar | Funcionamiento de todas las funciones de la aplicación |
| Histórica reproducible | Commit, prueba o informe guardado y vinculado | Que la prueba siga pasando con cualquier versión o proveedor |
| Declarada en un documento | Alcance, requisito o decisión que el documento describe | Implementación, aprobación nueva o validación independiente |
| Reconstruida | Relación razonada entre fuentes y cambios | Prompts originales, modelo, horas invertidas o autoría de IA |

No hay un registro completo de conversaciones anteriores. No se inventan prompts, cantidad de tokens, duración de sesiones, porcentajes de código generado ni aprobaciones humanas. Los nombres de herramientas citados en documentos históricos se tratan como evidencia de esos documentos, no como transcripciones.

## Mapa de fuentes

Los originales externos al repositorio permanecen en `C:/Vibetrack`; sus rutas se indican desde esa carpeta. No se publica el PDF académico ni sus datos personales. El [inventario de 52 fuentes](evidencias/fuentes-locales-2026-11-22.json) conserva ruta, tamaño y SHA-256 para identificar la versión consultada.

En ambos JSON los hashes públicos se agrupan de ocho caracteres en ocho con guiones: al quitarlos se recupera el SHA completo. El detector del proyecto marca cualquier cadena hexadecimal de 32 o más caracteres; esta representación evita el falso positivo sin modificar ni desactivar el detector. No se truncaron las huellas.

| ID | Fuente | Aporte y límite |
| --- | --- | --- |
| F01 | `contexto/Proyecto integral_ Plan (1).pdf`, 5 páginas | Propuesta académica fechada el 29-08-2026; usuarios, problema, pantallas, personalización y APIs. Es intención inicial. |
| F02 | `contexto/criterios.txt` | Requisitos de React, NestJS, base de datos, despliegue y criterios D01–D12 de diseño. |
| F03 | `docs/PLAN_PROYECTO.md` fuera del repositorio | Plan técnico del 12-11-2026; arquitectura, datos, fases, aceptación y política de Git. |
| F04 | `docs/AVANCE_FUNCIONAL.md` fuera del repositorio | Primer avance: qué estaba escrito, bloqueos de instalación y comprobaciones pendientes. |
| F05 | [Auditoría parcial](AUDITORIA_RESUELTA.md) | Línea base y matriz A–G del 13 de noviembre; el nombre del archivo no certifica cierre. |
| F06 | [Investigación de moods](INVESTIGACION_MOODS.md) | Diagnóstico de versiones, política 3, investigación y límites de evaluación. |
| F07 | [Aprendizaje](APRENDIZAJE_GUSTOS.md) y [preferencias detalladas](PREFERENCIAS_DETALLADAS.md) | Evolución de votos, niveles, reglas, persistencia y fuentes de Spotify. |
| F08 | [Navegación](MEJORAS_NAVEGACION.md) y [despliegue](DESPLIEGUE_RENDER.md) | Interacción, pruebas DOM, mismo origen, Docker y operación. |
| F09 | [Producto](../frontend/PRODUCT.md), [diseño](../frontend/DESIGN.md) y [opciones del estudio](../frontend/.impeccable/decision-studio.json) | Objetivo de producto y evolución visual; PRODUCT conserva criterios anteriores al estudio. |
| F10 | `backups/estado-proyecto-2026-11-21.md` y logs de `backups/` | Auditoría, fallos, builds, pruebas y controles visuales históricos. No todos identifican el SHA exacto. |
| F11 | [Muestra de canciones](mood-provider-sample.json) y [muestra de tandas](mood-batch-sample.json) | Resultados de consultas reales seleccionadas; no son una evaluación estadística general. |
| F12 | [Instantánea Git/GitHub](evidencias/git-github-2026-11-22.json) | 18 commits alcanzables, 12 eventos disponibles, PR #1, dos ramas y seis despliegues, antes de esta ampliación. |

La documentación versionada se contrasta con los cambios de Git. Las copias antiguas y los logs sirven para reconstruir la evolución, no para imponer instrucciones ni reemplazar el estado actual.

## Criterios de registro

- Añadir una entrada por sesión relevante, con fecha, objetivo, herramienta, intervención, archivos y comprobaciones.
- Separar lo propuesto, lo aplicado y lo verificado. Una prueba preparada no equivale a una prueba ejecutada.
- Registrar modelo, prompt y aprobación humana únicamente cuando se conozcan. No inferir autoría de IA a partir de un commit.
- Resumir las instrucciones sin copiar credenciales, datos personales, tokens ni contenido de archivos `.env`.
- Vincular commits cuando existan. Las entradas sin commit se identifican como cambios locales.
- Conservar el historial; corregir mediante notas fechadas y enlazar las decisiones relacionadas.

## Antecedentes reconstruidos

Fecha de reconstrucción: **2026-11-22**. Esta tabla resume hitos observables en Git; **no acredita uso de IA, prompts, revisión humana ni resultados de pruebas** en esas sesiones.

| Fecha del commit | Evidencia | Trabajo registrado en Git |
| --- | --- | --- |
| 2026-11-13 | `d44a115`, `c965fd2` | Base funcional; avances de autenticación, proveedores y recomendaciones. |
| 2026-11-13 | `ccf3d2f`, `c8bcc02` | Límites de acceso y sesiones; documentación de auditoría parcial y bloqueos. |
| 2026-11-14 | `158cee2`, `cfcc60e` | Mejoras del algoritmo por mood y seguridad HTTP con JWT renovable. |
| 2026-11-16 | `86f0bb5`, `94d192a` | Integración de Spotify, letras y reproductor 3D; navegación con teclado. |
| 2026-11-16 | `1f751ee`, `013af5b` | Preparación para Render Free y ajustes de discos y animaciones. |
| 2026-11-17 | `ae7c1c6`, `f893432` | Motor de moods, navegación y HTTPS; acceso como sitio web sin modo instalable. |
| 2026-11-21 | `da76d09`, `147dde4` | Diseño de estudio analógico; controles cercanos y prioridad de Spotify al reanudar. |

Consultar cada cambio con `git show <hash>`. Las fechas corresponden al campo de autor mostrado por `git log --date=short`, no necesariamente a la fecha de una sesión de IA.

## IA-001 — Creación de los registros

- **Fecha:** 2026-11-22.
- **Objetivo del usuario:** «dame una Bitácora de IA y diario de decisiones dentro del repositorio».
- **Herramienta:** asistente Codex; identificador exacto del modelo no registrado.
- **Contexto:** repositorio local `vibeTrackPJ`, con `HEAD` en `147dde4` al iniciar y sin cambios locales reportados por `git status --short`.
- **Intervención:** lectura del historial de Git, README, documentación de producto y diseño, y configuración del workspace. Redacción de ambos registros y enlaces desde el README.
- **Archivos:** `docs/BITACORA_IA.md`, `docs/DIARIO_DECISIONES.md` y `README.md`.
- **Resultado:** documentación local con antecedentes trazables y plantillas reutilizables; no cambia el comportamiento de la aplicación.
- **Comprobaciones:** revisión documental y comprobación de formato con `git diff --check`. No se ejecutaron build, pruebas funcionales ni validación de servicios externos para este cambio documental.
- **Revisión humana:** solicitud de creación recibida; revisión del contenido pendiente.
- **Decisión relacionada:** DEC-006.
- **Pendiente:** reconciliar contradicciones entre documentación histórica y actual en una tarea posterior (DEC-005). No se certifica aquí el estado funcional del proyecto.
- **Entrega:** cambios locales; sin commit ni publicación en esta sesión.

## IA-002 — README de GitHub y protección de ramas

- **Fecha:** 2026-11-22.
- **Solicitud:** actualizar el README de GitHub y proteger las ramas.
- **Herramientas:** Codex, conector GitHub y GitHub CLI.
- **Intervención:** reescritura del README actual, aclaración de la rama histórica y publicación de los registros documentales.
- **Comprobaciones locales:** `git diff --check` y `npm run check:secrets` sin errores; no se ejecutaron pruebas funcionales por tratarse de documentación.
- **Política solicitada para la entrega:** bloquear borrados y pushes forzados en ambas ramas, incluidos administradores; permitir pushes normales. La configuración efectiva se consulta en GitHub.
- **Autorización:** publicación y protección solicitadas explícitamente por el usuario.

## Reconstrucción detallada del desarrollo

### H-01 — Origen académico y definición del problema

- **Fecha de la propuesta:** 29-08-2026, indicada en F01; no es una fecha de commit.
- **Necesidad:** reducir la búsqueda canción por canción y adaptar los resultados al mood y al gusto individual.
- **Alcance original:** cuenta, seis moods, recomendaciones, búsqueda, favoritos, estrellas de 1 a 5 y estadísticas. Last.fm aportaría candidatas e iTunes portadas y previews; Spotify se planteó como ampliación opcional.
- **Criterios académicos:** al menos cinco rutas, tres custom hooks, estado global, validación, lazy loading, JWT, guards, tres entidades relacionadas con CRUD, índices y despliegue.
- **Resultado documental:** F01 y F02 fijan el problema y los requisitos. No demuestran que favoritos, estrellas, estadísticas o todos los CRUD se hayan terminado.
- **Decisiones:** DEC-007, DEC-008 y DEC-021. Uso de IA en esta etapa: no acreditado.

### H-02 — Planeación técnica y primer avance

- **Fecha:** plan del 12-11-2026; avance funcional sin fecha de sesión confirmada.
- **Trabajo documentado:** React/Vite con JSX, Context y Router; NestJS/TypeScript; MongoDB/Mongoose; servicios separados; un reproductor compartido; DTOs y límites de peticiones.
- **Ajuste respecto de la propuesta:** sustituir enriquecimiento ilimitado con `Promise.all` por concurrencia controlada y resultados parciales. Evitar que un fallo de proveedor elimine toda la lista.
- **Bloqueos:** resolución DNS de npm y ausencia de caché suficiente en el primer avance. El plan también registra una consulta remota de Git fallida por conectividad.
- **Verificación inicial:** F04 sólo acredita análisis sintáctico de 20 archivos y JSON válido; declara pendientes build, tests, audio y navegador. La validación posterior de la primera entrega no debe trasladarse retroactivamente a este momento.
- **Fuentes:** F03 y F04. Decisiones: DEC-001, DEC-009, DEC-012.

### H-03 — Base funcional, cuentas y auditoría parcial

- **Fecha:** 13-11-2026; commits `d44a115`, `c965fd2`, `ccf3d2f` y `c8bcc02`.
- **Entrega inicial:** frontend/backend, salud del servicio, moods, búsqueda iTunes, Last.fm y audio compartido. El README del primer commit registra ocho pruebas aprobadas y confirmación del usuario de Last.fm/Atlas; esa confirmación se conoce por el README histórico.
- **Evolución:** autenticación, preferencias, proveedores y motor; luego límites de sesiones/acceso, RolesGuard, respuestas públicas filtradas y errores con identificador.
- **Problemas documentados:** `npm ci` con error interno/EPERM y descarga de dependencias con ENOTFOUND. Se recuperó una instalación auxiliar desde caché, sin demostrar un `npm ci` normal exitoso.
- **Validación registrada:** base de 37 pruebas y posterior batería de 42 aprobadas con DB/proveedores simulados; build y detector correctos. Lint ausente y auditoría de dependencias bloqueada por red en esa etapa.
- **Límite:** el fallo real de recomendaciones seguía abierto y las fases A–G no estaban cerradas.
- **Fuentes:** F05 y commits citados. Decisiones: DEC-003, DEC-010, DEC-020.

### H-04 — Recomendaciones y renovación de sesiones

- **Fecha:** 14-11-2026; commits `158cee2` y `cfcc60e`.
- **Música:** mayor uso de rasgos de audio, cuotas de favoritos/cercanos/descubrimientos y ranking. La investigación posterior detectó que valencia y energía aún podían decidir emociones sin contexto suficiente.
- **Seguridad:** incorporación de Helmet, compresión, JWT con `@nestjs/jwt`, renovación corta y límite total de sesión. Se retiró Swagger que no se utilizaba, según el README histórico.
- **Validación:** se añadieron pruebas de seguridad HTTP y sesión; no se toma el título del commit como evidencia de auditoría completa.
- **GitHub:** creación de `mejora-algoritmo` y apertura del PR #1 el 15-11 en UTC, equivalentes al 14-11 por la noche en Tijuana.
- **Decisiones:** DEC-002, DEC-003 y DEC-010.

### H-05 — Spotify, letras, 3D, navegación y preparación de producción

- **Fecha:** 16-11-2026; commits `86f0bb5`, `1f5dc22`, `94d192a`, `1f751ee` y `013af5b`.
- **Integraciones:** Spotify opcional con PKCE/state, token de renovación cifrado, coincidencia de canciones y gustos; LRCLIB con léxico español/inglés y almacenamiento de perfil numérico.
- **Interfaz:** Discman/CDs 3D, controles HTML, navegación con teclado, escena diferida, barra compacta y conservación de cola. `1f5dc22` incorporó capturas y notas, no funciones nuevas.
- **Producción:** Docker por etapas, NestJS sirviendo React y API, CSP, compresión, caché y presupuestos de descarga. Las pruebas de producción eran locales; no probaban Render ni construcción de imagen Docker.
- **Corrección concreta:** `013af5b` reparó la caja de una miniatura con `display: block` y sincronizó su animación con el audio; prueba de regresión incluida.
- **Problemas recogidos en el PR:** admisión de candidatas sin verificar, veto de letra omitido sin audio y duplicación de sesiones al combinar gustos. Son hallazgos históricos, no un dictamen actualizado del código.
- **Fuentes:** F08, PR #1, diffs y pruebas. Decisiones: DEC-011 a DEC-015 y DEC-019.

### H-06 — Revisión profunda del motor y preferencias detalladas

- **Periodo:** noche del 16 al 17-11-2026; consolidado en `ae7c1c6`.
- **Respaldo:** F06 registra copia versionable con archivos nuevos y cambios locales, comprobación SHA-256 y `history.bundle` en `backups/antes-motor-moods-20261116-234501`. No incluye base de datos, secretos, dependencias ni builds.
- **Diagnóstico:** fuentes y géneros usados como emoción; favoritos con umbral rebajado; curación que eludía verificaciones; letras emparejadas con poca precisión; aprendizaje a partir de canciones mostradas; duplicados tras resolver identidad.
- **Cambios:** clasificador independiente con evidencia y veto de contradicciones, mismo filtro para favoritos, título/artista para letras, ISRC para identidad, errores temporales distintos de ausencia y aprendizaje a partir de escucha/votos.
- **Preferencias:** cinco niveles; separación entre encaje con mood y gusto global; prioridad canción > artista > género; historial recuperable y Spotify con fuentes acotadas. El commit agrupa trabajo de varios bloques: no se atribuye una sesión distinta a cada archivo sin evidencia.
- **Verificación documentada:** F06 informa 101 pruebas backend y 26 frontend, build y producción local correctos. Logs posteriores de preferencias muestran baterías ampliadas; son ejecuciones distintas.
- **Muestras reales:** doce canciones seleccionadas; seis referencias aceptadas y seis casos rechazados en los moods comprobados. Tandas en frío: feliz, siete canciones en tres intentos y unos 51 s; triste, un intento y unos 13 s. Son mediciones históricas con esperas, no latencia garantizada.
- **Fuentes:** F06, F07, F11 y `verification-after.txt` del respaldo. Decisiones: DEC-002 y DEC-016 a DEC-018.

### H-07 — Sitio web y primeras publicaciones en Render

- **Fecha:** 17-11-2026; commit `f893432`.
- **Cambio:** retirar manifiesto e iconos exclusivos de instalación; conservar acceso web por enlace y actualizar comprobación de producción.
- **Publicación comprobada:** GitHub conserva cuatro deployments de `f893432`: dos con último estado `failure` y dos con `success`. No se atribuye la causa de los fallos sin sus logs.
- **Cambio de estado respecto de la documentación:** «despliegue pendiente» era válido en la preparación local, pero ya no describe todo el historial. Los deployments posteriores prueban que GitHub recibió estados de publicación.
- **Límite:** esta reconstrucción no realizó una prueba funcional nueva de la URL pública ni de Spotify.
- **Fuentes:** F12. Decisiones: DEC-004 y DEC-019.

### H-08 — Auditoría local y evolución del diseño

- **Fecha de la auditoría:** 21-11-2026; F10 identifica 42 entradas locales pendientes respecto de `f893432`. Sus resultados no corresponden exclusivamente a ese commit.
- **Resultados:** build correcto; backend 119/119 y frontend 29/30, total 148/149. Falló el contrato `display:block` de `.playback-disc`. Producción local y consultas de MongoDB, Last.fm, Deezer y ReccoBeats correctas según el informe; no se escribieron datos de usuarios.
- **Corrección registrada en logs:** `front-recheck-tests.txt` conserva 29/30; `front-fixed-tests.txt`, 30/30. `pre-push-tests.txt` registra 30 frontend y 119 backend sin fallos. No se convierten en una afirmación de pruebas ejecutadas hoy.
- **Diseño:** los respaldos muestran océano/CDs, una revista musical de cobalto/lima/rosa y finalmente estudio analógico. No se conoce la fecha exacta de cada alternativa ni se presume que todas se publicaron.
- **Entrega visual:** `da76d09` sustituye Discman por tocadiscos, introduce navegación por objetos, hoja de sesión y `studio.css`. El brief versionado dice que el rediseño total fue pedido por el usuario el 21-11; no conserva una transcripción completa de la elección.
- **Verificación visual histórica:** los logs de controles registran anchos 390, 768 y 1440, sin solapamientos en los casos medidos; apertura, cierre y devolución de foco del plano. Esto no acredita todos los dispositivos, lectores de pantalla ni reproducción real.
- **Decisiones:** DEC-005, DEC-013, DEC-014 y DEC-020.

### H-09 — Controles cercanos y reanudación con Spotify

- **Fecha:** 21-11-2026 a las 23:01:46 UTC−08:00; commit `147dde4`.
- **Problema:** una cola restaurada precargaba el preview y podía reanudarse sin priorizar Spotify ya disponible; controles y volumen necesitaban una ubicación más directa.
- **Cambio verificable en el diff:** antes de reproducir el preview, consultar coincidencia Spotify; comprobar que la canción siga siendo la seleccionada y usar Spotify si existe URI. Sin coincidencia, conservar preview. Volumen trasladado a la barra compacta.
- **Prueba histórica:** `spotify-restore-tests.txt` registra 31/31 pruebas frontend, incluida reanudación con y sin coincidencia. No acredita OAuth ni escucha real en Spotify.
- **Publicación:** push recibido a las 07:01:50 UTC del 22-11; deployment creado a las 07:02:24 y marcado `success` a las 07:02:54 UTC.
- **Decisión:** DEC-022.

### H-10 — Documentación y protección del repositorio

- **Fecha:** 22-11-2026; sesiones IA-001 e IA-002 de esta bitácora.
- **Publicación:** `efd68d9` incorporó README, bitácora y decisiones a `mejora-algoritmo`; `77328d3` añadió a la portada de `base-funcional` enlaces al desarrollo actual; `4e2ece1` normalizó finales de línea.
- **Protección observada:** ambas ramas bloquean borrado y force push, incluso para administradores. No se exigen revisiones de PR ni status checks. Los pushes normales siguen permitidos.
- **Ramas:** `base-funcional` continúa como predeterminada y conserva la primera entrega; no se fusionó el desarrollo por cambiar su README.
- **Decisiones:** DEC-006 y DEC-023.

## Registro de commits y ramas

Los enlaces identifican cambios inmutables. El orden siguiente sigue la secuencia del desarrollo; el commit de la portada histórica pertenece a una rama distinta.

| Fecha local | Commit | Contenido verificable |
| --- | --- | --- |
| 13-11 | [d44a115](https://github.com/GaelFlores04/VibeTrack/commit/d44a115) | Primera base funcional. |
| 13-11 | [c965fd2](https://github.com/GaelFlores04/VibeTrack/commit/c965fd2) | Auth, proveedores y recomendador antes de auditoría. |
| 13-11 | [ccf3d2f](https://github.com/GaelFlores04/VibeTrack/commit/ccf3d2f) | Accesos, sesiones y salida pública. |
| 13-11 | [c8bcc02](https://github.com/GaelFlores04/VibeTrack/commit/c8bcc02) | Registro de auditoría parcial. |
| 14-11 | [158cee2](https://github.com/GaelFlores04/VibeTrack/commit/158cee2) | Algoritmo por mood. |
| 14-11 | [cfcc60e](https://github.com/GaelFlores04/VibeTrack/commit/cfcc60e) | Seguridad HTTP y JWT renovable. |
| 16-11 | [86f0bb5](https://github.com/GaelFlores04/VibeTrack/commit/86f0bb5) | Spotify, letras y escena 3D. |
| 16-11 | [1f5dc22](https://github.com/GaelFlores04/VibeTrack/commit/1f5dc22) | Capturas y notas de diseño. |
| 16-11 | [94d192a](https://github.com/GaelFlores04/VibeTrack/commit/94d192a) | Navegación y teclado. |
| 16-11 | [1f751ee](https://github.com/GaelFlores04/VibeTrack/commit/1f751ee) | Producción y Render. |
| 16-11 | [013af5b](https://github.com/GaelFlores04/VibeTrack/commit/013af5b) | Visibilidad y animación de discos. |
| 17-11 | [ae7c1c6](https://github.com/GaelFlores04/VibeTrack/commit/ae7c1c6) | Política de moods, preferencias, navegación y HTTPS. |
| 17-11 | [f893432](https://github.com/GaelFlores04/VibeTrack/commit/f893432) | Web por enlace, sin modo instalable. |
| 21-11 | [da76d09](https://github.com/GaelFlores04/VibeTrack/commit/da76d09) | Estudio analógico. |
| 21-11 | [147dde4](https://github.com/GaelFlores04/VibeTrack/commit/147dde4) | Controles y prioridad Spotify al reanudar. |
| 22-11 | [efd68d9](https://github.com/GaelFlores04/VibeTrack/commit/efd68d9) | README y registros. |
| 22-11 | [77328d3](https://github.com/GaelFlores04/VibeTrack/commit/77328d3) | README de `base-funcional`; hijo directo de `d44a115`. |
| 22-11 | [4e2ece1](https://github.com/GaelFlores04/VibeTrack/commit/4e2ece1) | Normalización documental. |

### Pushes comprobados

El feed consultado contiene estos nueve `PushEvent` para `mejora-algoritmo`. Es un feed limitado y puede retrasarse; ausencia de un evento no significa ausencia de publicación. Los commits creados mediante API en IA-002 están confirmados por las referencias remotas aunque no figuren aquí como `PushEvent`.

| Recepción UTC | Antes → después |
| --- | --- |
| 2026-11-15 05:18:44 | `158cee2` → `cfcc60e` |
| 2026-11-17 04:29:03 | `cfcc60e` → `86f0bb5` |
| 2026-11-17 04:30:34 | `86f0bb5` → `1f5dc22` |
| 2026-11-17 05:36:52 | `1f5dc22` → `94d192a` |
| 2026-11-17 05:54:29 | `94d192a` → `1f751ee` |
| 2026-11-17 06:30:45 | `1f751ee` → `013af5b` |
| 2026-11-17 11:28:45 | `013af5b` → `ae7c1c6` |
| 2026-11-17 11:31:36 | `ae7c1c6` → `f893432` |
| 2026-11-22 07:01:50 | `da76d09` → `147dde4` |

También constan `CreateEvent` de `base-funcional` (14-11 04:04:39 UTC) y `mejora-algoritmo` (15-11 05:13:38 UTC). Estos eventos acreditan creación de referencias remotas, no una fusión.

### Pull request y fusiones

El [PR #1](https://github.com/GaelFlores04/VibeTrack/pull/1), «VibeTrack: recomendaciones, Spotify, navegación accesible y despliegue en Render», fue abierto el 15-11-2026 a las 05:13:54 UTC, desde `mejora-algoritmo` hacia `base-funcional`.

Al capturar la evidencia: `state: open`, `merged: false`, `merged_at: null` y `merge_commit_sha: null`; GitHub reportaba 16 commits y 156 archivos cambiados. `git log --all --merges` no devolvió commits. **No se documenta ninguna fusión completada.** La falta de commits con dos padres, por sí sola, no descartaría un squash/rebase; en este caso se complementa con el estado explícito del PR. La descripción del PR conserva hallazgos y cifras de una etapa anterior y requiere actualización antes de tratarla como resumen final.

### Despliegues registrados

| Creación UTC | ID de deployment | SHA | Último estado consultado |
| --- | --- | --- | --- |
| 17-11 11:40:02 | 7852156663 | `f893432` | failure |
| 17-11 11:46:56 | 7852300283 | `f893432` | failure |
| 17-11 11:51:16 | 7852392410 | `f893432` | success |
| 17-11 12:01:15 | 7852599580 | `f893432` | success |
| 22-11 06:29:06 | 7974974962 | `da76d09` | success |
| 22-11 07:02:24 | 7975303719 | `147dde4` | success |

El último deployment enlaza a `https://vibetrack-6s5n.onrender.com`. Se registra como URL declarada por GitHub, sin certificar disponibilidad ni funcionamiento actuales. Los estados y horas completos están en F12; las horas de creación de la tabla no son las horas de finalización.

## Evidencia de pruebas y evolución de fallos

| Etapa / fuente | Resultado registrado | Interpretación correcta |
| --- | --- | --- |
| F04, primer avance | Sintaxis de 20 archivos y JSON válido | No equivale a build ni tests. |
| README de `d44a115` | 8 pruebas y compilación aprobadas | Validación de esa entrega inicial. |
| F05 | 37 pruebas de base, luego 42/42 | DB y proveedores simulados; auditoría parcial. |
| PR #1, actualización de discos | 22 frontend; 75 backend en ejecución completa anterior | No mezclar como una única ejecución contemporánea. |
| F06 | 101 backend y 26 frontend; build/producción local correctos | Política revisada y muestras seleccionadas, sin precisión global medida. |
| `preference-backend-tests.txt` / `preference-frontend-tests.txt` | 111/111 y 29/29 | Baterías históricas de preferencias, distintas de las posteriores. |
| `playlist-performance-tests.txt` | 112/112 | Tests controlados; no es prueba de carga real. |
| Auditoría del 21-11 / `audit-tests.txt` | Backend 119/119; frontend 29/30 | La batería global falló: 148/149. |
| `front-fixed-tests.txt` | Frontend 30/30 | Corrección posterior al fallo conservado en `front-recheck-tests.txt`. |
| `pre-push-tests.txt` | Frontend 30/30; backend 119/119 | 149 pruebas sin fallo en ese log. |
| `spotify-restore-tests.txt` | Frontend 31/31 | Incluye reanudación de cola; no acredita Spotify real. |
| `studio-build.txt` | JS 93,3 KiB; CSS 11,5 KiB; escena 248,7 KiB, gzip | Dentro de presupuestos 110/12/300 KiB en ese build. |

Los logs sin SHA no se asignan arbitrariamente a un commit. El informe del 21-11 registra cero vulnerabilidades reportadas por npm en 356 dependencias; es un resultado histórico, no garantía de seguridad actual. Las pruebas visuales guardadas miden casos concretos; no sustituyen accesibilidad con lectores de pantalla, evaluación auditiva ni dispositivos reales.

## Inconsistencias y pendientes que deben conservarse visibles

1. **Alcance académico:** votos y ajustes de gusto no demuestran el CRUD de favoritos con notas, estrellas 1–5, estadísticas, administración de moods ni eliminación de cuenta previstos en F01–F03. Falta contrastar cada criterio con endpoints y recorridos de aceptación.
2. **Diseño:** PRODUCT y MEJORAS_NAVEGACION describen partes del mundo océano; DESIGN y el brief versionado registran el estudio. La historia se conserva, pero las guías operativas necesitan reconciliación.
3. **Seguridad:** la auditoría del 13-11 conserva pendientes que commits posteriores abordaron. No debe marcarse toda la auditoría como cerrada sin revisar hallazgo por hallazgo.
4. **Motor:** existen correcciones posteriores y tests que cubren clasificación/veto de letra; los tres hallazgos del PR necesitan una trazabilidad de cierre individual antes de borrarlos de su descripción.
5. **Despliegue:** hay estados `success` posteriores a documentos que decían «pendiente». Falta una aceptación funcional actual de la web y OAuth/audio real.
6. **Medición:** no hay un conjunto amplio de evaluación ciega ni una prueba de carga real que sostenga una cifra de precisión o latencia general.
7. **Git:** PR #1 abierto; protección básica activa, sin revisiones ni CI obligatorias. Esta ampliación no fusiona ramas ni modifica esas reglas.

## IA-003 — Reconstrucción ampliada con documentos y GitHub

- **Fecha:** 22-11-2026.
- **Solicitud:** ampliar la bitácora y las decisiones con los documentos almacenados, pushes y merges.
- **Contexto inicial:** rama `mejora-algoritmo`, commit `4e2ece1`; árbol limpio antes de crear esta ampliación.
- **Trabajo:** extracción textual de las cinco páginas del PDF, lectura de criterios/plan/avances, documentación técnica y de diseño, logs seleccionados, historial y diffs; consulta de PR, eventos, deployments y protecciones.
- **Herramientas:** Codex, PowerShell, Git, GitHub CLI, conector GitHub y pypdf. Modelo exacto no registrado.
- **Correcciones durante la consulta:** un `git status` ejecutado en la carpeta contenedora no encontró repositorio; se usó `vibeTrackPJ`. La primera extracción del PDF falló al imprimir caracteres Unicode; se repitió con UTF-8. No implicaron cambios de código ni pérdida de archivos.
- **Resultado:** reconstrucción H-01–H-10, cronología de commits/pushes/despliegues, estado real del PR, matriz de pruebas y ampliación de decisiones. Dos JSON conservan metadatos y huellas de fuentes; no incluyen credenciales ni el PDF personal.
- **Validación de entrega:** revisión de enlaces y referencias, JSON, formato y detector de secretos. No se vuelven a ejecutar pruebas funcionales ni se presenta la lectura de logs como una ejecución nueva.
- **Incidencia de validación:** el detector señaló los SHA públicos de los JSON por su longitud hexadecimal. Se comprobó la regla, se agruparon las huellas de forma reversible y el detector pasó; la configuración de seguridad no se modificó.
- **Revisión humana:** ampliación solicitada; revisión del texto final pendiente. Las aprobaciones antiguas sólo se atribuyen cuando una fuente las registra.
- **Publicación:** continuación de la actualización documental autorizada en IA-002, sobre `mejora-algoritmo`; el commit de esta entrega se consulta en el historial del archivo. La instantánea F12 es deliberadamente anterior a esa publicación.

## Plantilla para nuevas sesiones

```markdown
## IA-NNN — Título breve

- Fecha:
- Objetivo / instrucción del usuario:
- Herramienta y modelo (si se conoce):
- Contexto / commit base:
- Propuesta de la IA:
- Cambios aplicados y archivos:
- Comprobaciones ejecutadas y resultados:
- Limitaciones, errores o correcciones humanas:
- Revisión humana (pendiente / revisado, con evidencia):
- Decisiones relacionadas:
- Pendientes:
- Commit / PR o cambios locales:
```
