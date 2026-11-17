---
version: 1
slug: "s-recommendations-recommendationspage-jsx-d73fcaa7"
primary_target: "src/features/recommendations/RecommendationsPage.jsx"
related_targets: ["src/main.jsx","src/features/moods/MoodsPage.jsx"]
---

# Reproductor por mood (y mundo de la app)

Modo: Operate con momento memorable (el reproductor 3D). Visitantes: quien pone música por mood en el día a día y el jurado de la demo final. Tarea: elegir mood, escuchar la tanda de 7, cambiar de canción o de tanda. Prueba: canciones reales con su motivo de recomendación y portada real.

Restricciones: D01–D12 de docs/PLAN_PROYECTO.md; escena React Three Fiber con modelos procedurales hasta que lleguen los GLB de Spline; HTML accesible equivalente (D09); favoritos y calificación no existen aún en la API: no se muestran controles falsos.

Añadido del usuario (15-11-2026): canción sin preview = CD-R virgen con el nombre escrito a rotulador.

## Direction contract

THESIS: La tanda es un objeto físico: una pila de CDs reales que entran a un reproductor portátil. Rechaza la lista de tarjetas con botón play del género.

OWN-WORLD: Azul océano profundo con degradados suaves, ondas de línea fina celeste, plata satinada del reproductor, tapa azul translúcida, LCD hielo con tipografía mono, marca y títulos en itálica condensada; CD-R plateado escrito con rotulador negro.

STORY: El visitante ve su mood, ve el disco que suena girar dentro del lector, entiende por qué está cada canción y cambia de disco tocando la pila o la lista.

FIRST VIEWPORT: Encabezado; mood en itálica grande con navegación de tandas; escena 3D ancha con la pila a la izquierda y el reproductor al centro; LCD bajo el reproductor; lista "Sigue en la tanda" a la derecha; barra de controles abajo. Acción principal: reproducir/pausar en la barra.

FORM: pinned, seed: none (pinned) — "Estilo retro 2000s discreto: azul profundo, degradados suaves, acentos celestes, líneas finas y tipografía inclinada en marca/títulos" · "Reproductor portátil ovalado plateado con tapa azul translúcida, LCD frontal y botones discretos" · "Escritorio: mood, pila a la izquierda, lector al centro/derecha, barra de reproducción y próximos temas" (contexto/criterios.txt, D01, D02, D07). Firma de interacción: el CD elegido sale de la pila, la tapa se abre, entra y gira sólo mientras el audio suena.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
