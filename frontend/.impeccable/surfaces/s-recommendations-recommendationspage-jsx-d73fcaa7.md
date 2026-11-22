---
version: 1
slug: "s-recommendations-recommendationspage-jsx-d73fcaa7"
primary_target: "src/features/recommendations/RecommendationsPage.jsx"
related_targets: ["src/app/App.jsx","src/main.jsx","src/features/moods/MoodsPage.jsx","src/features/home/HomePage.jsx"]
---

# El estudio de VibeTrack (toda la app)

Modo: Experience. Rediseño total pedido por el usuario el 21-11-2026; sustituye al mundo "Discman bajo el mar". Alcance: toda la app (inicio, moods, tanda, explorar, cuenta, preferencias, login, estado). Visitantes: quien pone música por mood y el jurado de la demo. Tarea: elegir mood, escuchar la tanda de 7, cambiar de toma, valorar, ajustar gustos. Restricciones: la música suena tan rápido como antes; nada de barras de navegación convencionales; navegación por objetos del estudio (estante = moods, consola = preferencias, cabina = explorar, perchero de auriculares = cuenta/Spotify); que no parezca disfraz y que no pese en móvil. Se conserva el reproductor y el disco 3D, ahora tocadiscos y vinilos. Todo lo del 3D sigue teniendo equivalente HTML.

## Direction contract

THESIS: Cada tanda es una sesión de grabación: las 7 canciones se anotan en la hoja de pistas y suenan una a una en el tocadiscos bajo el foco. Rechaza la app de música con barra lateral, cuadrícula de portadas y barra inferior.

OWN-WORLD: Estudio analógico de noche. Nogal casi negro (#1c120c) como suelo, caoba y teca en muebles, luz de tungsteno ámbar (#f4a259) como único acento de acción y estado, etiquetas de papel rotuladas (#e9dcc4) solo sobre cajas y la hoja, rojo burdeos de la luz EN EL AIRE (#7a1f1f→encendido). Vinilos negros con etiqueta central. Cifras tabulares en la hoja.

STORY: El visitante entra al estudio, saca una caja de mood del estante, ve la hoja de sesión llenarse con 7 pistas y su motivo, oye la primera en el tocadiscos con la luz EN EL AIRE encendida, valora y pide la siguiente toma.

FIRST VIEWPORT: Inicio = el cuarto entero: estante de nogal con 6 cajas de mood a la izquierda, tocadiscos al centro bajo el foco, consola, cabina y perchero como puertas. Tanda = tocadiscos 3D al centro, hoja de sesión (7 pistas numeradas, estado por pista, Toma N) a la derecha, letrero EN EL AIRE arriba; acción principal: el botón de reproducir del tocadiscos.

FORM: Candidata 6 de 7 de la lista propia (la hoja de sesión y el archivo del estudio), seed:b043a48d5ca268ec. Subidas: secuencia estricta con estado por paso (manual de montaje); estados impresos en el objeto (terminal de fósforo); tanda como toma numerada (serigrafía); columnas tabulares (datamatics). Firma de interacción: sacar la caja del estante → el vinilo baja al plato, el brazo se posa y la luz EN EL AIRE se enciende solo cuando el audio confirma reproducción. Gramática de movimiento: deslizamientos con ease-out cortos, nada que retrase el audio.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
