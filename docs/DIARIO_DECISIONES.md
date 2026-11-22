# Diario de decisiones — VibeTrack

Registro de decisiones técnicas, de producto y de proceso. Para el trabajo realizado con IA, consultar la [bitácora](BITACORA_IA.md).

**Ampliación: 22 de noviembre de 2026.** Se conservan DEC-001 a DEC-006 y se incorporan DEC-007 a DEC-023. Las fuentes F01–F12 se describen en el mapa de fuentes de la bitácora. Los [metadatos Git/GitHub](evidencias/git-github-2026-11-22.json) y las [huellas de los originales locales](evidencias/fuentes-locales-2026-11-22.json) permiten identificar la evidencia consultada.

## Índice de decisiones

| ID | Tema | Situación documentada |
| --- | --- | --- |
| DEC-001 | Workspace y stack | Adoptada |
| DEC-002 | Compatibilidad emocional antes de gustos | Adoptada, evaluación con usuarios pendiente |
| DEC-003 | JWT corto y sesiones revocables | Adoptada tras migración |
| DEC-004 | Sitio web por enlace | Adoptada |
| DEC-005 | Estudio analógico | Sustituye la dirección visual anterior |
| DEC-006 | Registros Markdown | Adoptada |
| DEC-007 | Recomendador por reglas y alcance académico | Base conservada; alcance pendiente de aceptación completa |
| DEC-008 | Descubrimiento público y cuestionario opcional | Evolución respecto del plan inicial |
| DEC-009 | Proveedores con responsabilidades separadas | Adoptada |
| DEC-010 | Seguridad por capas y errores controlados | Adoptada parcialmente; no certifica auditoría completa |
| DEC-011 | Audio compartido y continuidad de cola | Adoptada |
| DEC-012 | Concurrencia, caché e identidad musical | Adoptada |
| DEC-013 | 3D subordinado a controles y rendimiento | Adoptada; Spline no acreditado como exportación final |
| DEC-014 | Teclado, foco y movimiento reducido | Adoptada con validación parcial |
| DEC-015 | Spotify opcional y reversible | Adoptada |
| DEC-016 | Política de admisión y letras | Adoptada en la revisión del motor |
| DEC-017 | Votos de mood y gustos independientes | Adoptada, compatibilidad con votos anteriores |
| DEC-018 | Cinco niveles y diversidad | Adoptada |
| DEC-019 | Un origen HTTPS y presupuestos | Adoptada; despliegues registrados |
| DEC-020 | Validación por capas y evidencia | Aplicada en registros; cobertura incompleta |
| DEC-021 | Separar avance de cumplimiento académico | Pendiente de cierre |
| DEC-022 | Spotify al reanudar y controles cercanos | Adoptada con regresión específica |
| DEC-023 | Ramas protegidas y PR sin fusionar | Protección aplicada; integración pendiente |

## Cómo mantenerlo

Usar identificadores consecutivos `DEC-NNN`. Cada entrada debe explicar contexto, decisión, consecuencias y evidencia. Estados: **propuesta**, **adoptada**, **sustituida** o **pendiente de confirmar**. Una decisión adoptada no certifica que toda su implementación esté validada.

Las entradas DEC-001 a DEC-005 fueron reconstruidas el **2026-11-22** a partir de archivos e historial del repositorio. Sus motivos son síntesis de la documentación, no transcripciones de conversaciones. Las alternativas indicadas son comparaciones para entender la decisión; no prueban que fueran debatidas originalmente.

## DEC-001 — Workspace con frontend y API separados

- **Estado:** adoptada; observada en la configuración actual.
- **Fecha original:** no confirmada; base funcional registrada el 2026-11-13 en `d44a115`.
- **Contexto:** VibeTrack necesita interfaz web, API y persistencia de cuentas y preferencias.
- **Decisión:** mantener React + Vite en `frontend`, NestJS en `backend` y MongoDB como persistencia; gestionar ambos paquetes mediante workspaces npm.
- **Alternativa de contraste:** repositorios independientes para frontend y backend.
- **Consecuencias:** instalación y comandos compartidos; los cambios de contrato pueden revisarse juntos. Cada paquete conserva su compilación y responsabilidades.
- **Evidencia:** [package.json](../package.json), [README](../README.md), commit `d44a115`.

## DEC-002 — Separar compatibilidad emocional de gustos

- **Estado:** adoptada según la documentación del motor.
- **Referencias temporales:** mejoras registradas el 2026-11-14 (`158cee2`) y 2026-11-17 (`ae7c1c6`); fecha exacta de la decisión no confirmada.
- **Contexto:** un artista favorito o un género no garantizan que una canción corresponda al mood elegido.
- **Decisión:** combinar evidencia de canción, rasgos de audio y etiquetas; evaluar por separado compatibilidad emocional, preferencias y diversidad. Las puntuaciones son heurísticas, no probabilidades de un modelo entrenado.
- **Alternativa de contraste:** seleccionar sólo por género, popularidad o artista favorito.
- **Consecuencias:** recomendaciones con motivos más explícitos, a cambio de depender de varias fuentes. Puede faltar material compatible; se documentan respuestas `retry` y `exhausted` en vez de completar con canciones dudosas.
- **Evidencia:** [investigación de moods](INVESTIGACION_MOODS.md), [preferencias detalladas](PREFERENCIAS_DETALLADAS.md), [motor](../backend/src/modules/music/recommendation-engine.ts), [README](../README.md).

## DEC-003 — Sesiones revocables y renovación de JWT

- **Estado:** adoptada según el apartado de seguridad integrada del README.
- **Referencia temporal:** 2026-11-14, commit `cfcc60e`.
- **Contexto:** las cuentas requieren autenticación y posibilidad de cerrar o revocar sesiones.
- **Decisión:** usar cookie HttpOnly y sesiones persistidas con hash del token; renovar JWT mediante `@nestjs/jwt`, con tokens de 60 minutos y límite original de sesión de siete días según la documentación de la migración.
- **Alternativa de contraste:** token de larga duración sin renovación ni registro revocable.
- **Consecuencias:** la API consulta el estado de sesión; el frontend debe renovar. Las cookies previas a la migración requieren iniciar sesión de nuevo.
- **Evidencia:** [servicio de tokens](../backend/src/modules/auth/token.service.ts), [README](../README.md), commit `cfcc60e`.
- **Límite del registro:** el README también conserva una descripción anterior de JWT de siete días. Esta entrada distingue la migración documentada; no constituye una auditoría de seguridad ni una nueva prueba de ejecución.

## DEC-004 — Distribuir como sitio web accesible por enlace

- **Estado:** adoptada en el historial.
- **Referencias temporales:** 2026-11-16 (`1f751ee`) y 2026-11-17 (`f893432`).
- **Contexto:** facilitar el acceso desde el navegador y preparar el despliegue.
- **Decisión:** distribuir una web sin modo de app instalable y preparar frontend y API bajo una misma URL HTTPS mediante la configuración de Render.
- **Alternativa de contraste:** distribución como aplicación instalable.
- **Consecuencias:** acceso por enlace; el despliegue necesita configurar variables de entorno y servicios externos. Tener archivos de despliegue no demuestra que exista una publicación activa.
- **Evidencia:** [guía de despliegue](DESPLIEGUE_RENDER.md), [Dockerfile](../Dockerfile), [render.yaml](../render.yaml), commit `f893432`.

## DEC-005 — Evolucionar la identidad visual a estudio analógico

- **Estado:** adoptada en el historial; reconciliación de documentación pendiente.
- **Referencia temporal:** 2026-11-21, commit `da76d09`.
- **Contexto:** el proyecto conserva referencias a una estética anterior de música y océano.
- **Decisión observada:** el documento de diseño actual define un estudio de escucha analógico nocturno, con maderas, ámbar y tocadiscos.
- **Alternativa histórica:** diseño retro con azul profundo y reproductor portátil de CDs descrito en `PRODUCT.md` y secciones del README.
- **Consecuencias:** la referencia visual actual difiere de documentos anteriores. Antes de nuevos cambios visuales, reconciliar esas fuentes para evitar aplicar criterios incompatibles.
- **Evidencia:** [diseño actual](../frontend/DESIGN.md), [documento de producto anterior](../frontend/PRODUCT.md), commit `da76d09`.
- **Pendiente:** confirmar y actualizar qué criterios anteriores siguen vigentes. Esta sesión no modifica esos criterios ni presupone una aprobación humana adicional.

**Ampliación de evidencia del 22-11:** el [brief del estudio](../frontend/.impeccable/surfaces/s-recommendations-recommendationspage-jsx-d73fcaa7.md) registra un rediseño total pedido por el usuario el 21-11 y la sustitución del mundo «Discman bajo el mar». El commit `da76d09` reemplaza `DiscmanModel.jsx` por `TurntableModel.jsx` y reorganiza estilos en `studio.css`. Las copias locales `backups/DESIGN-before-zine.md` y `backups/DESIGN-before-studio.md` conservan la transición de océano a revista musical y después a estudio; no prueban la publicación de cada alternativa.

El [archivo de opciones](../frontend/.impeccable/decision-studio.json) compara «La hoja de sesión», «La mesa de escucha» y otras direcciones. Registra el descarte de serigrafía, lowbrow, manual de montaje, jardín, Datamatics y fósforo por distancia con la calidez/madera o la tarea musical. Conserva principios de numeración, estados en objetos y rigor tabular. El diseño final adopta la hoja de sesión, pero el archivo de opciones no equivale por sí solo a un registro de clic o aprobación del usuario.

**Consecuencia vigente:** DESIGN y el brief describen la implementación del estudio; PRODUCT y parte de la navegación siguen describiendo la etapa anterior. La equivalencia HTML, el audio real, el foco, el respaldo y el movimiento reducido continúan como principios documentados. No se declaran cumplidos todos los criterios D01–D12 de la estética anterior.

## DEC-006 — Mantener trazabilidad de IA y decisiones en Markdown

- **Estado:** adoptada para esta entrega documental; revisión del usuario pendiente.
- **Fecha:** 2026-11-22.
- **Contexto:** el usuario solicita ambos registros dentro del repositorio.
- **Decisión:** mantener `docs/BITACORA_IA.md` por sesiones y `docs/DIARIO_DECISIONES.md` por decisiones, enlazados desde el README y versionables con Git.
- **Alternativas consideradas en esta sesión:** un único documento o registros externos al repositorio.
- **Motivo:** separar actividades de decisiones permite seguir la evolución de cada una sin duplicar el detalle técnico.
- **Consecuencias:** cada sesión relevante requiere una actualización manual. No se instala automatización ni se reconstruyen prompts desconocidos. Los antecedentes se identifican como retrospectivos.
- **Evidencia:** solicitud del usuario y entrada IA-001 de la [bitácora](BITACORA_IA.md).

## DEC-007 — Mantener un recomendador explicable por reglas

- **Estado:** base adoptada; alcance académico aún no certificado por completo.
- **Origen:** propuesta del 29-08-2026 (F01) y plan del 12-11 (F03).
- **Problema:** descubrir música adecuada sin revisar cada canción y adaptar los resultados a gustos individuales.
- **Decisión:** partir de seis moods y reglas explícitas. No entrenar un modelo propio ni presentar los scores como probabilidades calibradas. La asistencia de IA al desarrollo se documenta separadamente del algoritmo del producto.
- **Alternativas documentadas:** Spotify completo se reservó inicialmente como ampliación; modelos de audio externos se estudiaron después, sin incorporarlos como inferencia local (F06).
- **Motivo:** alcance académico viable y comportamiento que pueda explicarse. La política posterior separa admisión emocional y ranking, en lugar de conservar la simplificación inicial mood = género.
- **Consecuencias:** los umbrales requieren evaluación; errores de contexto, idioma o metáfora siguen siendo posibles. No hay cifra de precisión estadística acreditada.
- **Evidencia:** F01, F03, [investigación](INVESTIGACION_MOODS.md), `ae7c1c6`. Relación: DEC-002 y DEC-016.

## DEC-008 — Permitir descubrir música sin completar un perfil

- **Estado:** adoptada según documentación y rutas; fecha exacta de aprobación no registrada.
- **Contexto:** el plan inicial reservaba moods, recomendaciones y explorar a usuarios autenticados. El desarrollo posterior admite invitados y cuentas sin cuestionario.
- **Decisión:** mantener consultas musicales públicas y selección inicial conocida; usar la sesión para preferencias, votos y datos propios. El cuestionario de artistas/géneros es opcional.
- **Alternativa histórica:** exigir registro y preferencias antes de descubrir música.
- **Motivo reconstruido:** reducir pasos hasta escuchar y permitir probar el producto; no se presenta como una cita del usuario.
- **Consecuencias:** se necesitan recorridos distintos para invitado, cuenta vacía y cuenta personalizada, sin filtrar preferencias entre cuentas. Si falla la comprobación de una sesión en recomendaciones públicas, la documentación contempla selección de invitado; las operaciones privadas siguen requiriendo autenticación.
- **Evidencia:** README histórico, [auditoría](AUDITORIA_RESUELTA.md), `c965fd2`, pruebas en [music-batches.test.ts](../backend/test/music-batches.test.ts).

## DEC-009 — Separar catálogo, identidad, sonido, letras y reproducción

- **Estado:** adoptada; evolución desde Last.fm + iTunes.
- **Origen:** F01/F03; ampliaciones en `c965fd2`, `158cee2`, `86f0bb5` y `ae7c1c6`.
- **Decisión:** Last.fm aporta fuentes, tags y relaciones; Deezer identidad, ISRC, portadas y previews; iTunes sirve de respaldo; ReccoBeats aporta rasgos; LRCLIB contexto textual; Spotify gustos y reproducción opcional.
- **Alternativa histórica:** enriquecer todo únicamente con iTunes. La investigación también evaluó procesamiento local de audio y modelos pesados, sin adoptarlos.
- **Motivo:** las fuentes resuelven problemas diferentes. Tener una portada o una coincidencia de búsqueda no demuestra compatibilidad emocional; tener rasgos tampoco garantiza reproducción.
- **Consecuencias:** mayor complejidad de coincidencias, caché, cuotas y fallos parciales. Se conservan enlaces y datos válidos cuando falta preview; no se descargan ni almacenan archivos de audio.
- **Evidencia:** [music.providers.ts](../backend/src/modules/music/music.providers.ts), F06 y README histórico. Las condiciones comerciales actuales de los proveedores no se revalidaron en esta reconstrucción.

## DEC-010 — Aplicar defensas en servidor y conservar límites explícitos

- **Estado:** controles incorporados en varias etapas; auditoría completa pendiente.
- **Fechas:** `ccf3d2f` y `c8bcc02` (13-11), `cfcc60e` (14-11).
- **Problema:** abuso de login, sesiones no revocables, exposición de campos internos, peticiones ajenas y mensajes de error con información sensible.
- **Decisión:** hash scrypt versionado y cola acotada; límite de sesiones; bloqueo progresivo de acceso; DTOs estrictos; cookies HttpOnly; comprobación de origen y cabecera en mutaciones; Helmet, JSON limitado, mapper público y errores con requestId. Roles y propiedad se verifican en el backend.
- **Alternativa de contraste:** depender de rutas privadas en React o del rol enviado por el cliente. No consta como alternativa aprobada.
- **Consecuencias:** límites en memoria no se coordinan entre procesos; los índices de producción y rotación de secretos requieren procedimientos específicos. Un guard implementado no demuestra CRUD administrativo completo.
- **Validación histórica:** F05 contiene pruebas simuladas y pendientes; F10 registra pruebas HTTP y dependencias posteriores. No se declaró una auditoría de penetración exhaustiva.
- **Evidencia:** [auditoría](AUDITORIA_RESUELTA.md), [seguridad HTTP](../backend/src/common/http-security.ts), [pruebas de seguridad](../backend/test/security.test.ts). Complementa DEC-003.

## DEC-011 — Una reproducción compartida entre pantallas

- **Estado:** adoptada desde la base, ampliada con navegación y Spotify.
- **Contexto:** navegar, valorar o pedir otra tanda no debe crear audios superpuestos ni perder la cola actual.
- **Decisión:** centralizar reproducción en PlayerProvider, compartir controles y reflejar eventos reales del medio. Conservar cola, posición y volumen; restaurar en pausa después de recargar. Las nuevas preferencias afectan tandas futuras, sin reemplazar la que está sonando.
- **Alternativa de contraste:** una instancia de reproducción por tarjeta o página.
- **Motivo:** continuidad y un único estado coherente para miniatura, escena, progreso y controles.
- **Consecuencias:** controlar carreras al cambiar de canción y el traspaso preview/Spotify; distinguir selección, carga y reproducción efectiva. No se afirma que pulsar Play implique audio iniciado.
- **Evidencia:** F03, [PlayerProvider](../frontend/src/features/player/PlayerProvider.jsx), [navegación](MEJORAS_NAVEGACION.md), `013af5b`, `147dde4`.
- **Validación:** tests DOM y regresiones; las políticas de autoplay y reproducción real necesitan navegador/cuenta.

## DEC-012 — Controlar concurrencia y deduplicar por grabación

- **Estado:** adoptada y refinada en la revisión del motor.
- **Contexto:** la propuesta de consultar todo en paralelo podía consumir cuotas, repetir canciones o perder una lista por una sola petición fallida.
- **Decisión:** limitar salidas y concurrencia, agrupar solicitudes idénticas, reutilizar metadatos y conservar tandas preparadas. Resolver identidad mediante nombres normalizados, ID e ISRC; mantener versiones live/remix/acoustic diferenciadas. Los errores temporales no se convierten en resultados vacíos cacheados.
- **Alternativa documentada:** `Promise.all` sobre todas las búsquedas y caché sólo por navegador; F03 propone corregir ambas limitaciones.
- **Consecuencias:** más estados pendientes/reintento y necesidad de invalidar versiones de caché al cambiar coincidencias. El historial por cuenta/mood evita repeticiones sin depender de la versión de gustos; un catálogo agotado requiere tratamiento explícito.
- **Evidencia:** F03, F06, [music-cache.ts](../backend/src/modules/music/music-cache.ts), [track-matching.ts](../backend/src/modules/music/track-matching.ts), [recommendation-history.ts](../backend/src/modules/music/recommendation-history.ts).
- **Validación:** pruebas de duplicados, reinicio, reintentos y solicitudes simultáneas; no equivale a carga real de múltiples instancias.

## DEC-013 — Usar 3D como representación del estado del audio

- **Estado:** adoptada con modelos procedurales; exportación final de Spline no acreditada.
- **Origen:** criterios D01–D12 de F02/F03; implementación `86f0bb5`, evolución `da76d09`.
- **Decisión:** React Three Fiber/Three.js para la escena, carga diferida, espacio reservado y respaldo; acciones equivalentes mediante HTML. Audio y controles permanecen independientes del éxito de WebGL. El disco y el brazo representan reproducción efectiva.
- **Alternativa inicialmente prevista:** modelado/exportación Spline, sujeto a prueba técnica y disponibilidad del plan. Los archivos revisados no prueban que se haya entregado un GLB exportado.
- **Motivo:** identidad visual sin convertir la escena en requisito para escuchar o navegar.
- **Consecuencias:** presupuesto de descarga y trabajo gráfico adicional; pausar movimiento fuera de pantalla y respetar movimiento reducido. El cambio de Discman a tocadiscos sustituye el objeto, no la necesidad de controles equivalentes.
- **Evidencia:** [PlayerStage](../frontend/src/features/player/PlayerStage.jsx), [PlayerScene](../frontend/src/features/player/scene/PlayerScene.jsx), F03, F08 y F09.
- **Validación pendiente:** rendimiento y accesibilidad en dispositivos reales; las cifras de un build no acreditan FPS universales.

## DEC-014 — Navegación por teclado y foco predecible

- **Estado:** implementada y probada parcialmente; diseño de navegación evolucionado.
- **Fechas de referencia:** `94d192a`, `ae7c1c6` y `da76d09`.
- **Decisión:** enlaces/botones semánticos, nombres accesibles, foco visible, Tab nativo y flechas en grupos; conservar teclas propias de inputs y sliders. Escape cierra y devuelve el foco. Omitir movimiento innecesario en teclado y respetar `prefers-reduced-motion`.
- **Alternativa de contraste:** interacción sólo con ratón/3D o atajos que interceptan la edición de texto.
- **Consecuencias:** la navegación por objetos del estudio necesita el mismo acceso comprensible que los menús anteriores; cambiar la forma visual no elimina el contrato de teclado.
- **Validación histórica:** jsdom prueba foco/estados, pero no layout ni Tab real. Logs posteriores registran plano, devolución de foco, anchos y ausencia de solapamientos en escenarios concretos.
- **Evidencia:** [navegación](MEJORAS_NAVEGACION.md), [keyboard.test.jsx](../frontend/test/keyboard.test.jsx), F10. Pendientes: lectores de pantalla, zoom y dispositivos no cubiertos.

## DEC-015 — Spotify como integración opcional y reversible

- **Estado:** adoptada; la aceptación con cuenta real no queda certificada por pruebas simuladas.
- **Origen:** ampliación prevista en F01; implementación `86f0bb5` y extensión `ae7c1c6`.
- **Decisión:** OAuth con PKCE/state, token de renovación cifrado en servidor, gustos de app/Spotify/ambos y reproducción mediante SDK cuando está disponible; mantener previews como respaldo. Importar muestras acotadas, mostrar fuentes y permitir desvincular.
- **Alternativa histórica:** posponer toda reproducción completa; alternativa de contraste: hacer Spotify obligatorio para usar VibeTrack.
- **Consecuencias:** permisos, coincidencias y disponibilidad externa; renovar permisos para fuentes nuevas. Las actualizaciones concurrentes comparten operación y una reimportación reemplaza su contribución anterior. Distinguir fuente vacía de fuente fallida; desvincular espera operaciones activas y elimina la contribución local.
- **Privacidad:** no modificar biblioteca externa; conservar únicamente los datos que describe el perfil. El cifrado no elimina la necesidad de proteger la clave del entorno.
- **Evidencia:** [preferencias detalladas](PREFERENCIAS_DETALLADAS.md), [spotify.service.ts](../backend/src/modules/spotify/spotify.service.ts), [spotify.test.ts](../backend/test/spotify.test.ts).

## DEC-016 — Exigir evidencia emocional y respetar contradicciones

- **Estado:** adoptada en la política 3; umbrales de producto pendientes de evaluación amplia.
- **Periodo:** investigación del 16–17-11 y commit `ae7c1c6`.
- **Problema observado:** géneros y listas podían certificar emociones, un favorito rebajaba el filtro y letras mal emparejadas aportaban contexto incorrecto.
- **Decisión:** descartar contradicciones antes del ranking; aplicar el filtro a todas las candidatas, incluso curación/favoritos. Feliz, triste y romántico necesitan contexto de canción además de audio compatible cuando existe. Diferenciar ausencia confirmada de letras de un error temporal. Emparejar título y artista, conservar sólo perfil numérico y versionar la caché.
- **Alternativas históricas:** etiquetar por género, valencia/energía solamente o aceptar favoritos con ajuste inferior; F06 describe por qué se abandonaron.
- **Consecuencias:** mayor coste y posibles tandas parciales. Reducir esfuerzo en fuentes poco compatibles sin bajar el criterio de admisión. La letra no sustituye el arreglo y el léxico no comprende toda ironía.
- **Validación:** doce canciones seleccionadas y pruebas de contradicciones, metadatos, letras y favoritos. No se extrapola precisión poblacional.
- **Evidencia:** [mood-classifier.ts](../backend/src/modules/music/mood-classifier.ts), F06 y F11. Desarrolla DEC-002.

## DEC-017 — Separar encaje con el mood de preferencia personal

- **Estado:** adoptada; mantiene compatibilidad con votos antiguos.
- **Referencia:** `ae7c1c6`; F07 documenta la evolución.
- **Problema:** «no encaja en triste» no significa «no me gusta ese artista»; un clic aislado no debe convertirse en veto general.
- **Decisión:** votos nuevos de mood con intención explícita y ajustes globales de canción/artista/género. Aplicar especificidad canción > artista > género; dentro del mismo nivel, excluir prevalece. La exclusión por mood sigue vigente aunque guste globalmente la canción.
- **Alternativa histórica:** generalizar suavemente votos a artista/género; queda sólo para votos anteriores sin intención, que el usuario puede retirar.
- **Persistencia:** `music_feedback` por cuenta/mood y `taste_rules` por cuenta, con claves hash y cambios atómicos. No aceptar propietario arbitrario en el cuerpo; sólo valorar canciones mostradas a esa cuenta para ese mood. Límites de 2.000 votos por mood y 2.000 ajustes según documentación.
- **Consecuencias:** quitar cuestionario no borra gustos ni votos; cambios afectan tandas nuevas. Se necesita interfaz para consultar y deshacer decisiones.
- **Evidencia:** [aprendizaje](APRENDIZAJE_GUSTOS.md), [preferencias](PREFERENCIAS_DETALLADAS.md), [feedback.ts](../backend/src/modules/music/feedback.ts), [taste-rules.ts](../backend/src/modules/music/taste-rules.ts).

## DEC-018 — Ofrecer cinco niveles sin debilitar el filtro de mood

- **Estado:** adoptada; nivel 3 predeterminado para cuentas previas.
- **Referencia:** `ae7c1c6` y F07.
- **Decisión:** permitir grados explícitos de exploración: 1, sorpresa; 2, explorar; 3, equilibrado; 4, cerca de gustos; 5, sólo coincidencias directas. Con artistas, objetivos por siete: 0/2/5, 2/3/2, 4/2/1 y 6/1/0 (favoritas/cercanas/descubrimientos); el nivel 5 admite únicamente preferencias directas.
- **Alternativa histórica:** mezcla fija 4/2/1 para todas las cuentas personalizadas.
- **Motivo:** dar control sobre familiaridad y descubrimiento sin confundirlo con compatibilidad emocional.
- **Consecuencias:** los niveles 1–4 pueden redistribuir cupos cuando falta catálogo válido; el 5 puede devolver menos o ninguna canción. «Menos de esto» baja prioridad y no equivale a excluir. Sin artistas, la distribución usa géneros y descubrimientos según la guía.
- **Evidencia:** [preferencias detalladas](PREFERENCIAS_DETALLADAS.md), [recommendation-engine.ts](../backend/src/modules/music/recommendation-engine.ts), [preference-controls.test.ts](../backend/test/preference-controls.test.ts).
- **Validación:** tests controlados de niveles, límites y excepciones; aceptación real por usuario pendiente.

## DEC-019 — Servir web y API bajo un origen y limitar descargas

- **Estado:** adoptada; GitHub registra despliegues exitosos posteriores a la preparación.
- **Fechas:** `1f751ee` (16-11), `ae7c1c6`/`f893432` (17-11).
- **Decisión:** NestJS sirve frontend compilado y `/api` en un mismo dominio HTTPS; Docker por etapas y usuario no privilegiado; health check, rutas profundas, caché larga para assets versionados y revalidación del HTML. Presupuestos gzip: 110 KiB JS inicial, 12 KiB CSS y 300 KiB escena diferida.
- **Alternativa del plan:** frontend en Vercel y backend en Render, con proxy si las cookies entre dominios fallaban.
- **Motivo:** simplificar orígenes/cookies y controlar el coste inicial del 3D.
- **Consecuencias:** despliegue coordinado, configuración privada de Atlas/Spotify y validación de índices. El test de producción sin DB no verifica proveedores ni OAuth. Los presupuestos no incluyen todas las imágenes, fuentes y respuestas externas.
- **Evidencia:** [guía Render](DESPLIEGUE_RENDER.md), [check-bundle.cjs](../scripts/check-bundle.cjs), [Dockerfile](../Dockerfile), F12.
- **Estado histórico:** dos deployments fallidos y cuatro exitosos en la instantánea. El último corresponde a `147dde4`; esto supera «despliegue pendiente», pero no acredita aceptación funcional actual ni obliga a desplegar esta documentación.

## DEC-020 — Separar tipos de validación y registrar fallos

- **Estado:** práctica documentada en entregas; cobertura aún parcial.
- **Contexto:** builds correctos coexistieron con instalaciones bloqueadas, tests fallidos y comprobaciones externas pendientes.
- **Decisión observada:** registrar por separado sintaxis, compilación, pruebas unitarias/HTTP simuladas, producción local, consultas reales, visuales y aceptación humana. Conservar fallos y correcciones en vez de reemplazar el historial con «todo funciona».
- **Alternativa de contraste:** considerar build o un test simulado como prueba integral del producto.
- **Consecuencias:** más evidencia para revisar, pero evita afirmaciones incorrectas. No sumar suites de momentos distintos ni atribuir logs sin SHA a un commit exacto.
- **Caso documentado:** auditoría del 21-11, 148/149; corrección frontend, 30/30; log pre-push, 119 backend + 30 frontend; regresión Spotify posterior, 31 frontend. Son hitos diferentes.
- **Evidencia:** F04/F05/F06/F10 y tabla de pruebas de la bitácora.
- **Pendiente:** aceptación de Spotify/audio real, evaluación auditiva, carga y matriz académica. En esta entrega sólo se validan documentos, enlaces, JSON y secretos.

## DEC-021 — No confundir funcionalidades nuevas con cierre académico

- **Estado:** pendiente de cierre; criterio de trazabilidad de esta reconstrucción.
- **Origen:** F01–F03 y auditoría parcial F05.
- **Problema:** el desarrollo amplió recomendaciones, 3D, Spotify y feedback, pero esos avances no prueban por equivalencia todos los requisitos originales.
- **Decisión documental:** mantener separados «propuesto», «implementación localizada», «prueba registrada» y «aceptación completa». No renombrar votos como estrellas 1–5 ni asumir que un guard demuestra CRUD administrativo.
- **Alternativa descartada en esta reconstrucción:** marcar la lista académica como completa basándose en README, cantidad de rutas o un despliegue exitoso.
- **Consecuencias:** revisar explícitamente CRUD de tres entidades, propiedad/roles, favoritos con actualización, historial/estadísticas, perfil/borrado y evidencia de despliegue requerida por la materia. Un único servicio web/API puede satisfacer necesidades técnicas, pero no acredita aceptación del cambio de alojamiento por el docente.
- **Evidencia:** F02/F03 y matriz F1–F8 de [auditoría](AUDITORIA_RESUELTA.md).
- **Cierre requerido:** tabla requisito → endpoint/pantalla → prueba → resultado observado. Esta sesión no implementa las funciones pendientes ni cambia el alcance académico.

## DEC-022 — Priorizar Spotify al reanudar una cola restaurada

- **Estado:** adoptada en `147dde4` el 21-11-2026.
- **Problema concreto:** después de restaurar una cola, el elemento de audio ya tenía preview; pulsar Play podía seguir esa ruta aunque Spotify estuviera listo.
- **Decisión:** cuando está pausado y Spotify está disponible, resolver coincidencia, comprobar que no cambió la canción seleccionada y usar Spotify si existe URI; conservar preview cuando no hay coincidencia. Colocar controles cerca del escenario y volumen en la barra compacta.
- **Alternativa previa:** reproducir directamente el preview precargado. No se añade obligatoriedad de Spotify.
- **Consecuencias:** una consulta puede preceder a la reanudación; la comprobación de canción evita actuar sobre una selección obsoleta.
- **Validación histórica:** prueba con y sin coincidencia en [keyboard.test.jsx](../frontend/test/keyboard.test.jsx); log `spotify-restore-tests.txt`, 31/31. Push y deployment exitoso registrados en F12.
- **Límite:** la prueba simula Spotify; el deployment no demuestra escucha real con Premium.

## DEC-023 — Proteger las dos ramas y mantener explícita la integración pendiente

- **Estado:** protección aplicada y comprobada el 22-11-2026; PR abierto.
- **Autorización:** solicitud explícita del usuario de actualizar README y proteger ramas, registrada en IA-002.
- **Decisión aplicada:** bloquear force push y borrado en `base-funcional` y `mejora-algoritmo`, incluidos administradores. Permitir pushes normales. No exigir revisiones ni status checks en esta configuración.
- **Alternativas de configuración:** PR obligatorio, revisores y CI obligatoria no se activaron; se documentan como opciones futuras, no como decisiones ya aprobadas.
- **Organización actual:** `base-funcional` sigue predeterminada y representa la primera entrega con portada actualizada; `mejora-algoritmo` contiene desarrollo, documentación y commits desplegados.
- **Consecuencias:** no se puede reescribir o borrar accidentalmente estas ramas mediante operaciones ordinarias sujetas a protección, pero siguen admitiendo commits directos. No es una política de revisión obligatoria.
- **Fusión:** PR #1 desde desarrollo a base, `open`, `merged: false`; `git log --all --merges` vacío. No hay merge completado acreditado ni autorización implícita para realizarlo por documentar su estado.
- **Evidencia:** [PR #1](https://github.com/GaelFlores04/VibeTrack/pull/1), [instantánea](evidencias/git-github-2026-11-22.json), IA-002.

## Cambios de dirección y documentos que deben reconciliarse

| Antes | Evolución comprobada | Interpretación / acción pendiente |
| --- | --- | --- |
| 8–12 canciones previstas en F01/F03 | Tandas de siete en motor y producto | Actualizar especificación operativa; conservar propuesta como historia. |
| Sólo Last.fm + iTunes | Deezer, ReccoBeats, LRCLIB y Spotify opcional | DEC-009; no borrar las razones del cambio. |
| JWT previo de siete días | Tokens de 60 minutos con renovación limitada | DEC-003; F05 conserva el estado previo. |
| Spotify fuera del primer alcance | Integración incorporada | DEC-015; no convertirla en requisito para invitados. |
| Océano/Discman y revista intermedia | Estudio/tocadiscos | DEC-005; reconciliar PRODUCT y guía de navegación. |
| Spline condicionado a exportación | Modelos procedurales en React Three Fiber | DEC-013; no afirmar entrega de GLB sin evidencia. |
| Mezcla equilibrada fija y votos generalizados | Cinco niveles y separación mood/gusto | DEC-017/018; distinguir votos heredados de nuevos. |
| Vercel + Render propuestos | Web/API en Render bajo mismo origen | DEC-019; aceptación académica del alojamiento no documentada. |
| Deploy pendiente en documentos tempranos | Estados failure/success posteriores | Usar las fechas del historial; no afirmar disponibilidad actual sin probarla. |
| PR con hallazgos históricos | Cambios y pruebas posteriores | Revisar los tres hallazgos individualmente antes de cerrar o fusionar. |

## Criterios para futuras actualizaciones

1. Añadir una decisión cuando cambie alcance, contrato, persistencia, proveedor, interacción o política de publicación; los ajustes rutinarios pertenecen a la bitácora.
2. Citar la fuente de la motivación. Si se deduce del código, marcarla como reconstruida; si se conoce la aprobación, indicar dónde consta.
3. No sobrescribir una decisión superada: marcarla como sustituida y enlazar su reemplazo. Los IDs existentes permanecen estables.
4. Registrar la validación realizada sobre un SHA cuando sea posible, y separar resultados históricos de pruebas nuevas.
5. Al fusionar en el futuro, anotar PR, método de integración, SHA y fecha real. La apertura de un PR y el éxito de Render no cuentan como merge.

## Plantilla para nuevas decisiones

```markdown
## DEC-NNN — Título

- Estado: propuesta / adoptada / sustituida / pendiente de confirmar.
- Fecha de decisión y, si difiere, fecha de registro:
- Contexto y problema:
- Decisión:
- Alternativas consideradas:
- Motivo y criterios:
- Consecuencias y costes:
- Evidencia: archivos, commit, PR o instrucción explícita.
- Validación realizada / pendiente:
- Responsable o aprobación (si consta):
- Sustituye a / sustituida por:
```
