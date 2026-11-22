# Diario de decisiones — VibeTrack

Registro de decisiones técnicas, de producto y de proceso. Para el trabajo realizado con IA, consultar la [bitácora](BITACORA_IA.md).

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

## DEC-006 — Mantener trazabilidad de IA y decisiones en Markdown

- **Estado:** adoptada para esta entrega documental; revisión del usuario pendiente.
- **Fecha:** 2026-11-22.
- **Contexto:** el usuario solicita ambos registros dentro del repositorio.
- **Decisión:** mantener `docs/BITACORA_IA.md` por sesiones y `docs/DIARIO_DECISIONES.md` por decisiones, enlazados desde el README y versionables con Git.
- **Alternativas consideradas en esta sesión:** un único documento o registros externos al repositorio.
- **Motivo:** separar actividades de decisiones permite seguir la evolución de cada una sin duplicar el detalle técnico.
- **Consecuencias:** cada sesión relevante requiere una actualización manual. No se instala automatización ni se reconstruyen prompts desconocidos. Los antecedentes se identifican como retrospectivos.
- **Evidencia:** solicitud del usuario y entrada IA-001 de la [bitácora](BITACORA_IA.md).

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
