---
name: VibeTrack
description: Tandas de 7 canciones por mood, servidas como una pila de CDs que entra a un reproductor portátil.
colors:
  sky: "#8fdcff"
  sky-strong: "#c6eeff"
  deep: "#04122a"
  ocean: "#0a2550"
  tide: "#12407e"
  ink: "#eaf2ff"
  ink-soft: "#a9c2e0"
  ink-faint: "#7f9dc2"
  panel: "rgba(10, 40, 90, .45)"
  panel-strong: "rgba(8, 30, 66, .9)"
  line: "rgba(143, 220, 255, .18)"
  line-strong: "rgba(143, 220, 255, .4)"
  warn: "#ffb48a"
  danger: "#ff9a9a"
  silver-satin: "#c3ccd6"
  silver-pale: "#dfe6ee"
  lid-blue: "#2f8dff"
  lcd-ice: "#cdeef7"
  lcd-ice-deep: "#a9dcea"
  lcd-ink: "#0b2a3a"
  marker-ink: "#05070a"
  mood-feliz: "#ffb547"
  mood-relajado: "#5fd6c4"
  mood-motivado: "#ff7a5c"
  mood-triste: "#6f86d9"
  mood-romantico: "#ff8db8"
  mood-cansado: "#a99be0"
typography:
  display:
    fontFamily: "'Saira Variable', 'Arial Narrow', sans-serif"
    fontSize: "clamp(3rem, 8vw, 6rem)"
    fontWeight: 800
    lineHeight: 1
    letterSpacing: "-0.005em"
    fontVariation: "'wdth' 87.5"
  headline:
    fontFamily: "'Saira Variable', 'Arial Narrow', sans-serif"
    fontSize: "clamp(2.4rem, 6vw, 4rem)"
    fontWeight: 800
    lineHeight: 1
    letterSpacing: "-0.005em"
    fontVariation: "'wdth' 87.5"
  title:
    fontFamily: "'Saira Variable', 'Arial Narrow', sans-serif"
    fontSize: "clamp(1.25rem, 2.2vw, 1.45rem)"
    fontWeight: 700
    lineHeight: 1
    fontVariation: "'wdth' 87.5"
  brand:
    fontFamily: "'Saira Variable', 'Arial Narrow', sans-serif"
    fontSize: "1.85rem"
    fontWeight: 800
    lineHeight: 1
    letterSpacing: "0.01em"
    fontVariation: "'wdth' 87.5"
  body:
    fontFamily: "'Atkinson Hyperlegible Next Variable', system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.5
  body-strong:
    fontFamily: "'Atkinson Hyperlegible Next Variable', system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 700
    lineHeight: 1.5
  meta:
    fontFamily: "'Atkinson Hyperlegible Next Variable', system-ui, sans-serif"
    fontSize: "0.86rem"
    fontWeight: 400
    lineHeight: 1.45
  lcd:
    fontFamily: "'Share Tech Mono', ui-monospace, monospace"
    fontSize: "1.05rem"
    fontWeight: 400
    lineHeight: 1.25
    fontFeature: "'tnum' 1"
  marker:
    fontFamily: "'Permanent Marker', cursive"
    fontWeight: 400
    lineHeight: 1
rounded:
  focus: "6px"
  lcd: "10px"
  field: "12px"
  md: "14px"
  lg: "22px"
  pill: "999px"
spacing:
  xs: "0.4rem"
  sm: "0.6rem"
  md: "1rem"
  lg: "1.5rem"
  xl: "2rem"
  gutter: "clamp(16px, 4vw, 56px)"
components:
  button:
    backgroundColor: "rgba(120, 180, 255, .08)"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    padding: "0.55rem 1.1rem"
    height: "44px"
  button-hover:
    backgroundColor: "rgba(143, 220, 255, .16)"
  button-primary:
    backgroundColor: "{colors.sky}"
    textColor: "{colors.deep}"
    typography: "{typography.body-strong}"
    rounded: "{rounded.pill}"
    padding: "0.55rem 1.1rem"
    height: "44px"
  button-primary-hover:
    backgroundColor: "{colors.sky-strong}"
  button-icon:
    rounded: "{rounded.pill}"
    width: "44px"
    height: "44px"
  button-play:
    rounded: "{rounded.pill}"
    width: "58px"
    height: "58px"
  input:
    backgroundColor: "rgba(4, 18, 42, .6)"
    textColor: "{colors.ink}"
    rounded: "{rounded.field}"
    padding: "0.6rem 0.85rem"
    height: "44px"
  track-row:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "0.45rem 0.7rem"
    height: "60px"
  track-row-selected:
    backgroundColor: "rgba(143, 220, 255, .14)"
  panel-card:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "0.9rem 1rem"
  mood-card:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    padding: "1.1rem 1rem 1.25rem"
  transport:
    backgroundColor: "{colors.panel-strong}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    padding: "0.8rem 1.2rem"
  lcd:
    backgroundColor: "{colors.lcd-ice}"
    textColor: "{colors.lcd-ink}"
    typography: "{typography.lcd}"
    rounded: "{rounded.lcd}"
    padding: "0.45rem 0.9rem"
  nav-link:
    textColor: "{colors.ink-soft}"
    typography: "{typography.body}"
  nav-link-active:
    textColor: "{colors.ink}"
---

# Design System: VibeTrack

## Overview

**Creative North Star: "El Discman bajo el mar"**

VibeTrack es un retro 2000s discreto, "música y océano" (criterios D01–D12 del usuario). La página es agua profunda: un azul casi negro con un halo de luz arriba a la derecha y tres ondas de línea fina celeste que corren por el fondo. Sobre esa agua flota un solo objeto memorable, el reproductor portátil ovalado de plata satinada con tapa azul translúcida y pantalla LCD de hielo, y a su lado la tanda como una pila física de CDs con la portada real de cada canción. Todo lo demás es sobrio: paneles azules semitransparentes con borde de un pixel, texto claro, un único acento celeste.

La densidad es de reproductor, no de catálogo: una tanda de 7, una lista lateral, una barra de transporte. La memoria visual se gasta en el reproductor; el resto de las páginas (moods, explorar, cuenta) heredan el agua, los paneles y la tipografía sin escenografía propia, salvo el disco como motivo recurrente (miniaturas en filas, discos de color en la elección de mood).

El estado real del audio gobierna la animación: el disco gira sólo mientras el elemento de audio confirma reproducción, y una canción sin preview no se disfraza: es un CD-R plateado con su título escrito a rotulador negro.

**Key Characteristics:**
- Fondo de agua profunda (`deep`) con halo radial (`tide` → `ocean`) y ondas SVG de línea fina celeste al pie.
- Un solo acento, celeste (`sky`), para acción primaria, estado seleccionado, foco y progreso.
- Marca y títulos en Saira itálica condensada (ancho 87.5, peso 800); cuerpo en Atkinson Hyperlegible Next.
- El disco es el motivo: portada sobre CD con brillo iridiscente, anillo transparente y orificio central.
- LCD de hielo con Share Tech Mono para lecturas reales (título en curso, tiempos, número de tanda).
- Plata satinada sin cromo dominante; relieves contenidos.

## Colors

Una paleta de océano nocturno con un acento celeste frío, plata de aparato y un azul translúcido de tapa; los colores cálidos sólo aparecen como estado de aviso o como identidad de cada mood.

### Primary
- **Celeste Sonar** (`sky`): el único acento de la interfaz. Botón primario relleno, borde y fondo del elemento seleccionado, subrayado de navegación activa, anillo de foco, relleno recorrido de los deslizadores, motivo de recomendación ("por qué está") y la lectura de la pila. También es el trazo de las ondas del fondo.
- **Celeste Espuma** (`sky-strong`): hover del primario, hover de enlaces y lecturas mono secundarias (tiempos de la barra, número de tanda).

### Secondary
- **Azul Tapa** (`lid-blue`): sólo material 3D, la tapa translúcida del reproductor (opacidad .26, clearcoat suave). El respaldo sin WebGL la reproduce con un radial de `rgba(200,236,255,.5)` a `rgba(20,90,190,.36)` y aro interior claro.

### Tertiary
- **Paleta de moods** (`mood-feliz`, `mood-relajado`, `mood-motivado`, `mood-triste`, `mood-romantico`, `mood-cansado`): cada mood es un disco de tres anillos concéntricos (centro claro, anillo medio con el token, borde más profundo). Viven sólo en los discos de la página de moods; nunca tiñen texto, botones ni paneles.

### Neutral
- **Fondo Abisal** (`deep`): fondo de página, texto sobre el celeste relleno, orificio central de los discos.
- **Océano** (`ocean`) y **Marea** (`tide`): el halo radial del cuerpo (como rgba sobre `deep`); no son colores de superficie sueltos.
- **Tinta Clara** (`ink`): texto principal y pulgar de los deslizadores.
- **Tinta Suave** (`ink-soft`): metadatos, artista, descripciones, nav en reposo, etiquetas.
- **Tinta Tenue** (`ink-faint`): pie, placeholders, notas de estado.
- **Panel** (`panel`) y **Panel Denso** (`panel-strong`): superficies de tarjetas y formularios; el denso para el minirreproductor fijo.
- **Línea** (`line`) y **Línea Marcada** (`line-strong`): bordes de un pixel celeste translúcido; `line` para paneles y divisores, `line-strong` para controles e interacción.
- **Plata Satinada** (`silver-satin`) y **Plata Pálida** (`silver-pale`): cuerpo y aros metálicos del reproductor 3D (metalness .82–.9, roughness .2–.28) y la superficie del CD-R.
- **Hielo LCD** (`lcd-ice` → `lcd-ice-deep`, degradado vertical) con **Tinta LCD** (`lcd-ink`): la pantalla frontal.
- **Tinta de Rotulador** (`marker-ink`): sólo la escritura a mano del CD-R.
- **Aviso** (`warn`) y **Peligro** (`danger`): "sin preview", errores de reproducción y alertas de formulario.

### Named Rules
**The One Sonar Rule.** Celeste es el único acento interactivo. Selección, foco, progreso y acción primaria lo comparten; no se introduce un segundo color de acción.

**The Moods Stay On Their Discs Rule.** Los seis colores de mood sólo pintan sus discos. La interfaz alrededor de un mood sigue siendo océano y celeste.

**The No Chrome Rule.** La plata es satinada y contenida (difusa, con brillo suave). Nada de cromo espejado dominante ni biseles exagerados.

## Typography

**Display Font:** Saira Variable, itálica, ancho 87.5 (con Arial Narrow)
**Body Font:** Atkinson Hyperlegible Next Variable (con system-ui)
**Label/Mono Font:** Share Tech Mono (con ui-monospace)
**Handwriting:** Permanent Marker, exclusivo del CD-R

**Character:** Una itálica condensada y pesada con aire de carátula de los 2000 para nombrar cosas (marca, mood, secciones), contra una sans de alta legibilidad para todo lo que se lee. La mono de LCD sólo dice lo que el aparato diría.

### Hierarchy
- **Display** (800 itálica, clamp(3rem, 8vw, 6rem), 1): titular de portada, máx. 12ch.
- **Headline** (800 itálica, clamp(2.4rem, 6vw, 4rem), 1): el h1 de cada página; en recomendaciones, el nombre del mood.
- **Title** (700 itálica, clamp(1.25rem, 2.2vw, 1.45rem), 1): h2 de sección ("Sigue en la tanda", cola).
- **Brand** (800 itálica, 1.85rem, 1): logotipo tipográfico "Vibe**Track**" con "Track" en celeste, y el nombre de cada mood en su tarjeta.
- **Body** (400, 1rem, 1.5): texto corrido, máx. 70ch. Lede a 1.08rem en `ink-soft` (1.2rem en portada).
- **Body strong** (700): título de canción en filas y barra, botón primario.
- **Meta** (400, .82–.92rem): artista, descripción de mood, motivo de recomendación, duración.
- **LCD** (Share Tech Mono, 1.05rem / .9rem, tabular): pantalla del reproductor, tiempos de progreso, "Tanda N", conteo de la pila.
- **Marker** (Permanent Marker, tamaño ajustado al disco, -6° a -4°): título y artista sobre el CD-R.

### Named Rules
**The Slant Is For Names Rule.** La itálica condensada nombra (marca, mood, encabezados h1/h2). Nunca en cuerpo, botones, metadatos ni etiquetas.

**The LCD Tells The Truth Rule.** La mono de LCD se usa sólo para lecturas de estado del aparato: tiempos, número de tanda, conteos, título en curso. No es una tipografía de etiquetas ni de encabezados.

**The Marker Is Only For Blanks Rule.** Permanent Marker existe únicamente sobre un CD-R (canción sin preview confirmada). Fuera del disco no aparece.

## Layout

Columna central de hasta 1440px con margen lateral fluido (`gutter`, clamp(16px, 4vw, 56px)); encabezado, contenido y pie comparten ese ancho. La página ocupa al menos la ventana para que el reproductor quede abajo en páginas cortas.

Recomendaciones (el reproductor): grid de dos columnas, escena flexible + lista de 280–340px, con la barra de transporte a todo el ancho debajo (áreas "stage list / transport transport", separación 1.5rem × 2rem). La escena reserva su alto final (clamp(320px, 38vw, 480px); 270px bajo 560px) para que nada salte al cargar. A menos de 980px pasa a una columna: escena, transporte, lista.

Moods: grid auto-fit de tarjetas de mínimo 170px, separación clamp(12px, 1.6vw, 20px); bajo 560px, dos columnas fijas de 10px de separación con discos de 96px.

Móvil (≤720px): la navegación superior se reemplaza por una barra inferior fija de 64px con cuatro destinos icono + texto; la barra de transporte y el minirreproductor se anclan justo encima (72px / 64px). El volumen sale de la parte fija (es el del aparato). Sin scroll horizontal a 360px.

Ritmo de espacio en rem: .4 / .6 / 1 / 1.5 / 2rem; los controles nunca bajan de 44px de alto (40px para botones secundarios del transporte en móvil).

Breakpoints observados: 980px (layout del reproductor), 760px (minirreproductor), 720px (navegación inferior y transporte compacto), 560px (escena y moods compactos), 480px (filas de lista).

## Elevation & Depth

Híbrido: las superficies de interfaz son planas y se separan por translucidez tonal (`panel` sobre el agua) y bordes de un pixel celeste. Las sombras se reservan para lo que flota sobre la página (barra de transporte, minirreproductor, menús de sugerencias) y para los objetos físicos (discos, reproductor, LCD), cuya profundidad es material: metal satinado, tapa translúcida y una sombra de contacto suave bajo el aparato. El fondo aporta profundidad atmosférica con el halo radial y las ondas.

### Shadow Vocabulary
- **Dock** (`box-shadow: 0 -6px 24px rgba(0, 8, 24, .45)`): barra de transporte y minirreproductor fijos; sombra hacia arriba.
- **Overlay** (`box-shadow: 0 14px 30px rgba(0, 8, 24, .55)`): panel de sugerencias del autocompletado.
- **Disc** (`box-shadow: inset 0 0 0 1px rgba(255,255,255,.45), 0 2px 6px rgba(0,8,24,.4)`): miniaturas de CD.
- **Mood disc** (`box-shadow: inset 0 0 0 1px rgba(255,255,255,.4), 0 10px 22px rgba(0,8,24,.45)`): discos de mood.
- **LCD bezel** (`box-shadow: inset 0 0 0 2px #7f8c9c, inset 0 2px 6px rgba(0,40,60,.3), 0 8px 18px rgba(0,8,24,.35)`): marco hundido de la pantalla.

### Named Rules
**The Flat Panels Rule.** Paneles, tarjetas y filas no llevan sombra; se separan con `panel` y `line`. La sombra es para lo que flota o lo que es un objeto.

## Shapes

Redondez generosa y blanda, nunca angulosa. Botones y chips son píldoras (`pill`); tarjetas de lista y filas usan `md` (14px); paneles mayores, tarjetas de mood y barras flotantes usan `lg` (22px); campos `field` (12px); LCD `lcd` (10px). Los bordes son siempre de 1px en celeste translúcido. La silueta recurrente es el círculo: discos, orificio central, botón de play redondo, pulgar de deslizador, y el óvalo del reproductor (50% / 52%). Los iconos son de trazo único dibujados para la app: 24×24, trazo 2px, extremos redondeados.

## Components

### Buttons
Píldoras tranquilas que se hunden al pulsar.
- **Shape:** píldora (`pill`), alto mínimo 44px.
- **Default:** fondo celeste muy tenue, borde `line-strong`, texto `ink`.
- **Primary:** relleno `sky`, texto `deep` en negrita; hover a `sky-strong`. Uno por vista: "Otras 7 canciones", play.
- **Hover / Focus / Active:** hover aclara el fondo y lleva el borde a `sky`; foco con anillo de 2px `sky` a 3px de distancia; pulsado escala a .97 en 160ms con `ease-out`.
- **Icon:** cuadrado de 44px redondo con icono de trazo; el play del transporte mide 58px (52px en móvil).
- **Button link:** mismo lenguaje para enlaces de acción (48px de alto) en portada.

### Chips
- **Style:** etiquetas de artista en píldora, fondo celeste .1, borde `line-strong`, botón de quitar de 40px sin borde.

### Cards / Containers
- **Corner Style:** `md` en filas de canciones, `lg` en formularios y tarjetas de mood.
- **Background:** `panel`; el actual pasa a borde `sky` y fondo celeste .1.
- **Shadow Strategy:** ninguna (ver The Flat Panels Rule).
- **Border:** 1px `line`.
- **Internal Padding:** .9rem 1rem en filas; clamp(18px, 3vw, 28px) en formularios.

### Inputs / Fields
- **Style:** fondo abisal .6, borde `line-strong`, radio `field`, 44px; placeholder `ink-faint`, cursor celeste.
- **Focus:** anillo global `sky` de 2px.
- **Sliders:** pista de 6px celeste .2 con relleno `sky` hasta lo recorrido (`--fill`), pulgar `ink` de 16px con halo celeste; crece a 1.15 al arrastrar.
- **Error:** texto `danger` en `role=alert`.

### Navigation
- **Escritorio:** marca a la izquierda; enlaces en `ink-soft`, hover `ink`, activo `ink` con subrayado inferior de 2px `sky`. Encabezado separado por una línea `line`.
- **Móvil:** barra inferior fija de 64px, fondo abisal .96, cuatro columnas icono sobre texto (.78rem); el activo pinta texto `ink` e icono `sky`.

### Track Row (lista de la tanda)
Fila-botón de 60px con miniatura de CD de 44px, título en negrita y metadatos en una línea con elipsis, duración LCD o "sin preview" en `warn` al final. Transparente en reposo; hover con borde `line-strong`; seleccionada con borde celeste .6 y fondo celeste .14. Es el equivalente HTML completo de tocar la pila en 3D.

### Transport Bar
Barra flotante fija abajo, radio `lg`, degradado vertical de `rgba(20,60,120,.92)` a `rgba(8,30,66,.96)`, borde celeste .28, sombra Dock. Cuatro zonas: ahora suena (disco + título, artista, motivo en `sky`), botones anterior / play / siguiente, progreso con tiempos LCD, y volumen + enlace externo. Bajo 980px se reordena en dos columnas; en móvil queda compacta encima de la navegación inferior y oculta motivo y volumen.

### Mini Player
Misma familia que el transporte en `panel-strong` con borde `line-strong`, presente en todas las páginas; cola desplegable con la canción actual resaltada en celeste .14.

### Disc (miniatura y textura)
El motivo del sistema. Círculo con la portada recortada, brillo iridiscente cónico (celeste y rosa muy tenues), anillo central transparente y orificio `deep`. Variante **CD-R** para canciones sin preview confirmado: plata con surcos concéntricos y el título corto escrito con Permanent Marker en `marker-ink`, inclinado y subrayado a mano, que nunca invade el anillo central; el texto sólo aparece desde 56px. Mientras la portada carga, el disco es plata lisa: no se afirma "sin preview" antes de saberlo.

### Portable Player (escena 3D)
Reproductor ovalado de plata satinada (`silver-satin`, metalness .82) con aros `silver-pale`, tapa `lid-blue` translúcida a .26, y la pila de CDs a la izquierda. Firma de interacción: el CD elegido sale de la pila, la tapa se abre, entra, y gira (4.2 rad/s) sólo mientras el audio suena. Movimientos amortiguados exponencialmente (tasas 6.5–10). Con `prefers-reduced-motion` no hay giro continuo y los cambios son inmediatos. Sin WebGL, un respaldo CSS dibuja el mismo aparato. Hoy los modelos son procedurales, a la espera de los GLB de Spline.

### LCD
Pantalla de texto HTML real (no pintada en el 3D) anclada bajo el reproductor: degradado `lcd-ice` → `lcd-ice-deep`, tinta `lcd-ink`, marco hundido, dos líneas en mono tabular (número · título en curso; estado y tiempo).

### Mood Card
Tarjeta `lg` sobre `panel` con un disco de color del mood de hasta 140px, el nombre en itálica de marca y la descripción en `ink-soft` sin recorte. Hover: borde `sky` y el disco sube 6px girando 18° (280ms, sólo con puntero fino); pulsado .98.

## Do's and Don'ts

### Do:
- **Do** mantener el fondo como agua: `deep` con el halo radial y las ondas de línea fina celeste; las superficies se apilan con `panel` y bordes de 1px `line`.
- **Do** usar `sky` como único acento para primario, selección, foco y progreso.
- **Do** escribir marca, mood y encabezados en Saira itálica condensada (wdth 87.5, 800/700) y todo lo demás en Atkinson Hyperlegible Next.
- **Do** mostrar cada canción como disco con su portada real; sin preview confirmado, como CD-R a rotulador.
- **Do** hacer girar el disco sólo cuando el audio confirma reproducción y detenerlo con `prefers-reduced-motion`.
- **Do** dar a todo lo que hace el 3D un equivalente HTML accesible (lista de la tanda, LCD de texto real).
- **Do** mantener controles de al menos 44px y anillo de foco `sky` de 2px.

### Don't:
- **Don't** usar cromo espejado dominante ni relieves exagerados en el reproductor o la interfaz.
- **Don't** convertir la tanda en una lista de tarjetas con botón play; la tanda es una pila de discos.
- **Don't** poner la itálica de marca en cuerpo, botones o metadatos.
- **Don't** usar Share Tech Mono como etiqueta decorativa sobre secciones; sólo para lecturas del aparato.
- **Don't** usar Permanent Marker fuera de un CD-R.
- **Don't** teñir la interfaz con los colores de mood fuera de sus discos.
- **Don't** mostrar controles de favoritos o calificación mientras la API no los ofrezca.
- **Don't** dar sombra a paneles y filas en reposo.
