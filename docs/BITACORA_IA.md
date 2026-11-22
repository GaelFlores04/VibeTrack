# Bitácora de IA — VibeTrack

Registro del uso de inteligencia artificial como apoyo al desarrollo. Complementa el [diario de decisiones](DIARIO_DECISIONES.md): aquí se documenta el trabajo de cada sesión; allí, las decisiones y sus consecuencias.

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
