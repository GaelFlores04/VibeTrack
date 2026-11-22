# Navegación y descubrimiento

La actualización conserva la identidad de océano, la tipografía y el motivo del CD. Amplía Inicio, Moods y Explorar; el audio y la sesión continúan en sus proveedores existentes.

## Recorrido

- Inicio ofrece un carrusel manual de moods y permite volver a la cola actual.
- Moods permite elegir entre todas las cards y una vista de slides.
- Explorar conserva la búsqueda en la URL, sincroniza el campo al volver con Atrás/Adelante y ofrece puntos de partida cuando está vacío.
- La navegación principal incluye Inicio, Moods, Explorar y Cuenta. Estado permanece accesible desde el pie.
- Las recomendaciones incluyen un regreso visible a Moods y conservan el reproductor y sus controles HTML.

## Organización de React

`src/main.jsx` monta los proveedores y los estilos. `src/app/App.jsx` define las rutas; `SiteNavigation.jsx` reúne la navegación de escritorio y móvil. La portada vive en `features/home/HomePage.jsx`.

`MoodCarousel` y `MoodDisc` comparten la presentación de moods. `TrackList` coordina la reproducción y `TrackCard` presenta una canción. La posibilidad de reproducir procede de `player.playable`, tanto para previews como para Spotify.

`navigation.css` contiene la estructura y navegación. `discovery.css` agrupa portada, carrusel, moods y búsqueda. `base.css` conserva los fundamentos y los controles existentes del reproductor.

## Movimiento y accesibilidad

- Slides con scroll nativo y ajuste de posición. Sin avance automático; controles anterior/siguiente e indicadores con nombres accesibles.
- Los slides que no se muestran son inertes. Al salir de un slide enfocado, el foco pasa al indicador correspondiente.
- Las flechas de los extremos mantienen el foco y exponen `aria-disabled`; su acción se comprueba antes de desplazar.
- La posición elegida se conserva al redimensionar el carrusel.
- Entrada lateral de página de 240 ms con Web Animations API: opacidad y desplazamiento de 12 px, curva `cubic-bezier(0.23, 1, 0.32, 1)`. Se cancela al interrumpirla y se inicia después de resolver la carga diferida de la página.
- Con movimiento reducido, la entrada sólo cambia opacidad durante 120 ms y los slides cambian de forma inmediata. La navegación por teclado omite la entrada y las transiciones de los indicadores.
- El disco responde al hover sólo con puntero fino. El estado real del audio sigue gobernando el giro del reproductor.
- La barra móvil contempla el área segura del dispositivo.

## Reproductor en Explorar

Explorar comparte `PlayerStage` con las recomendaciones. Muestra la cola y la canción activas, aunque cambie el término buscado, con reproducción, anterior/siguiente, progreso y volumen. La pila visual se limita a siete discos; los resultados completos siguen disponibles en la lista. Con Spotify conectado, las coincidencias se preparan sin iniciar reproducción.

En escritorio, el reproductor acompaña a los resultados en una columna lateral. En móvil se coloca antes de la lista. `IntersectionObserver` detecta sus controles: mientras están visibles, se oculta la barra compacta; cuando salen de pantalla, la barra vuelve para mantener el acceso al audio.

Los accesos del reproductor y de las cards usan `ActionLink`: enlaces semánticos presentados como controles con fondo, borde e icono, sin subrayado. La navegación principal precarga el módulo de su destino al apuntar, enfocar o tocar el enlace.

## Navegación sin ratón

- Tab y Mayús + Tab mantienen el orden nativo y permiten salir de cada grupo.
- Las flechas recorren menús, controles, canciones y artistas elegidos. Los grids calculan la dirección a partir de las posiciones renderizadas, sin fijar un número de columnas.
- En el carrusel, izquierda/derecha cambia de mood y mueve el foco al indicador visible. Inicio y Fin llevan a los extremos.
- En menús y listas, Inicio y Fin enfocan el primer o último control disponible.
- Texto, combobox, radios y deslizadores conservan sus teclas nativas; las casillas de géneros se recorren sin marcarse automáticamente.
- Las sugerencias usan arriba/abajo y Enter; Escape las cierra manteniendo el foco en el campo.
- Abrir la cola desde el teclado enfoca su primera canción disponible. Escape cierra la cola y devuelve el foco al botón que la abrió.
- Quitar un artista mediante teclado devuelve el foco al artista contiguo o al buscador.
- El primer acceso conserva el recorrido desde el enlace para saltar al contenido. Al cambiar de ruta, el foco pasa al contenido nuevo.
- La guía de teclado se encuentra en el pie de todas las páginas. Los controles visibles conservan anillo de foco y margen de desplazamiento para las barras del reproductor.

Las pruebas DOM usan `jsdom` como dependencia de desarrollo. Verifican movimiento del foco, exclusión de controles ocultos/deshabilitados, conservación de teclas nativas, cambios del carrusel, sugerencias y apertura/cierre de la cola. Las coordenadas del grid se proporcionan en los casos de prueba porque jsdom no calcula layout. Estas pruebas no certifican Tab nativo, lectores de pantalla ni geometría real en navegador.

## Referencias y comprobaciones

Se consultaron las guías Impeccable y Emil Kowalski, el diseño del proyecto y los ejemplos de React/Vite y componentes semánticos de `C:/Aplicaciones web/react/practica1`. No se añadieron bibliotecas de animación ni de UI en producción. Se reutilizó `tsx`, ya utilizado en el backend, para las pruebas del frontend.

Las pruebas de frontend comprueban el HTML renderizado: slides inertes, controles con nombres y estados accesibles, catálogo vacío, acciones de reproducción, pista de Spotify sin preview y recuperación de errores. No sustituyen una prueba interactiva en navegador.

La inspección visual actual quedó bloqueada: la herramienta de navegador no estaba disponible y el acceso a Chrome se detuvo al no poder verificar su URL. Las capturas ya guardadas son anteriores a esta actualización. Quedan pendientes la revisión visual a 360, 768 y 1440 px, zoom al 200 %, foco en navegador, gestos y percepción de fluidez. La revisión independiente aprobó las correcciones a nivel de código, sin certificar esas comprobaciones visuales.
