---
name: VibeTrack
description: Un estudio de escucha analógico de noche. Cada tanda es una sesión de grabación que suena en un tocadiscos bajo el foco.
colors:
  walnut-0: "#120b07"
  walnut-1: "#1c120c"
  walnut-2: "#2a1a10"
  mahogany: "#3b2416"
  teak: "#8a5a32"
  amber: "#f4a259"
  amber-strong: "#ffc283"
  label: "#e9dcc4"
  label-shade: "#d6c5a6"
  label-ink: "#2a1a10"
  oxblood: "#7a1f1f"
  tube-red: "#b8261a"
  ink: "#f1e4cf"
  ink-soft: "#cbb79c"
  ink-faint: "#a8917a"
  line: "rgba(233, 220, 196, .13)"
  line-strong: "rgba(233, 220, 196, .3)"
  warn: "#ffa17a"
  danger: "#ff8f7a"
typography:
  sign:
    fontFamily: "'Big Shoulders Display Variable', 'Arial Narrow', sans-serif"
    fontWeight: 800
    lineHeight: 1
  headline:
    fontFamily: "'Big Shoulders Display Variable', 'Arial Narrow', sans-serif"
    fontSize: "clamp(2.8rem, 7vw, 5.4rem)"
    fontWeight: 800
  title:
    fontFamily: "'Big Shoulders Display Variable', 'Arial Narrow', sans-serif"
    fontSize: "clamp(1.35rem, 2.4vw, 1.7rem)"
    fontWeight: 700
    letterSpacing: "0.04em"
  body:
    fontFamily: "'Atkinson Hyperlegible Next Variable', system-ui, sans-serif"
    fontSize: "1rem"
    lineHeight: 1.5
  typed:
    fontFamily: "'Courier Prime', 'Courier New', monospace"
    fontFeature: "'tnum' 1"
  marker:
    fontFamily: "'Permanent Marker', cursive"
rounded:
  key: "7px"
  field: "6px"
  panel: "10px"
  pill: "999px"
spacing:
  gutter: "clamp(16px, 4vw, 56px)"
components:
  key:
    backgroundColor: "#2e1d12"
    textColor: "{colors.ink}"
    rounded: "{rounded.key}"
    height: "44px"
  key-primary:
    backgroundColor: "{colors.amber}"
    textColor: "#2a1206"
  field:
    backgroundColor: "{colors.walnut-0}"
    rounded: "{rounded.field}"
    height: "44px"
---

# Design System: VibeTrack

## Overview

**Creative North Star: "La hoja de sesión"**

VibeTrack es un estudio de grabación analógico de noche. Las paredes son tablas de nogal casi negro, iluminadas por dos apliques de tungsteno. Cada tanda es una **sesión de grabación**: sus 7 canciones se anotan en una hoja mecanografiada sujeta a un portapapeles y suenan, una a una, en un tocadiscos de madera bajo el foco. No hay barra de navegación: se recorre por **objetos del estudio**, y cada uno es una sala.

| Objeto | Sala | Ruta |
|---|---|---|
| El cuarto | Inicio | `/` |
| El estante (cajas de vinilos) | Moods | `/moods` |
| La sesión (tocadiscos + hoja) | Tanda de un mood | `/recomendaciones/:mood` |
| La cabina (ventana + micrófono) | Explorar | `/explorar` |
| La consola | Preferencias | `/preferencias` |
| El perchero (auriculares) | Cuenta, entrada, Spotify | `/cuenta`, `/login`, `/registro` |
| El cuadro eléctrico | Estado de los servicios | `/estado` |

El estado real del audio gobierna el mundo:
- **La lámpara EN EL AIRE** se enciende, con un parpadeo de tubo, solo cuando el audio confirma reproducción.
- **El brazo del tocadiscos** se posa sobre el disco solo mientras suena.
- **Los pilotos** del cuadro eléctrico y de la consola reflejan datos reales.

## Colors

Una paleta de madera y luz. **Un solo acento de acción y estado: el ámbar del tungsteno** (`amber`).

- **Nogal** (`walnut-0` a `walnut-2`): suelo, paredes y campos hundidos. La pared lleva una veta procedural (SVG `feTurbulence`) de baja opacidad; la calidez la ponen los apliques.
- **Caoba y teca** (`mahogany`, `teak`): muebles, zócalos, rieles y baldas.
- **Ámbar** (`amber`, `amber-strong`): tecla principal, selección, foco, progreso, pilotos encendidos y pozos de luz.
- **Papel de etiqueta** (`label`, `label-shade`, `label-ink`): solo en la **hoja de sesión** y en las **etiquetas de las cajas** del estante.
- **Burdeos y tubo** (`oxblood`, `tube-red`): exclusivos de la lámpara EN EL AIRE y del piloto del micrófono. Apagada: cristal burdeos con letra `#a9584a`, que se lee como apagada. Encendida: rojo con resplandor.
- **Colores de mood**: solo como **pegatina de color** en cada caja y junto al nombre del mood en la sesión.

### Reglas
- **Un ámbar.** No se introduce un segundo color de acción.
- **Nada de metal simulado.** Sin latón biselado con degradados: los rótulos se pintan sobre la madera (letra marfil) y las placas son franjas de madera oscura hundida.
- **Papel con propósito.** Solo existe donde un estudio tiene papel: la hoja de sesión y las etiquetas.

## Typography

- **Rótulos** (Big Shoulders Display, 800, mayúsculas): nombre del estudio, títulos de sala, nombres de mood, letreros (EN EL AIRE, Micrófono) y salas del plano.
- **Lectura** (Atkinson Hyperlegible Next): todo el texto de uso, incluidas las notas de las cajas.
- **Mecanografiada** (Courier Prime, cifras tabulares): solo lo que el estudio escribiría a máquina, como la hoja de sesión, tiempos, el contador de toma y la placa del zócalo.
- **Rotulador** (Permanent Marker): solo etiquetas de cajas, prensados de prueba (sin preview) y fundas de cartón kraft.

## Layout

- **El cuarto (inicio):** el estante (dos baldas de tres cajas), el tocadiscos ilustrado bajo la lámpara (muestra lo que suena y enlaza a la sesión) y tres puertas compactas con su forma: cabina en arco, consola en cuña y perchero con riel. A 1440×900 todo cabe en la primera pantalla.
- **La sesión:**
  - **Cabecera:** nombre del mood con su pegatina y navegación de tomas («Toma anterior», contador «Toma N», «Otra toma · 7 nuevas»).
  - **Escenario 3D:** a la izquierda.
  - **Hoja de sesión:** a la derecha.
  - **Controles del zócalo:** debajo del escenario. En escritorio no flotan, para no tapar la placa; en móvil sí.
- **Salas secundarias**, construidas alrededor de su objeto:
  - **Cabina:** el tocadiscos tras el cristal, la mesa del micrófono con su piloto (se enciende al escribir) y los resultados como discos en un cajón.
  - **Perchero:** las fichas cuelgan del riel con dos cordones, junto a los auriculares.
  - **Consola:** reposabrazos acolchado y puente de vúmetros que enciende tantos pilotos como el nivel elegido.
  - **Cuadro eléctrico:** un interruptor y un piloto por servicio.
- **Móvil (≤620 px):** el plano se abre a pantalla completa. El monitor ocupa una fila de ~76 px y despliega progreso y extras al abrir la cola. La placa del escenario baja bajo el tocadiscos. Sin desborde horizontal a 390 px.

## Components

- **Tecla** (`button`): rectángulo de 7 px con relieve de consola; se hunde (`translateY(1px) scale(.97)`, 140 ms) al pulsar. La principal es ámbar iluminada.
- **Retorno «Volver al …»**: letrero con el destino real del recorrido; contrae «a el» en «al».
- **Plano del estudio**: salas como recintos que comparten muros, con «Estás aquí»; se abre desde su botón (origen arriba a la derecha, 180 ms) y se cierra con Escape, al pulsar fuera o al cambiar de sala.
- **Caja de vinilos**: frente de madera con etiqueta a rotulador y pegatina de color. Al apuntar o enfocar, el vinilo asoma por arriba (220 ms); las baldas se recorren con flechas.
- **Vinilo en miniatura**: surcos y la portada como etiqueta central. Sin preview, prensado de prueba con etiqueta marfil y título a rotulador.
- **Hoja de sesión**: papel con clip metálico. Cada pista lleva número, vinilo, título, artista, motivo corto, duración y estado (en cola, en el plato, sonando, escuchada o sin preview).
- **Escena 3D** (React Three Fiber, procedural):
  - **Tocadiscos de nogal:** plato de aluminio, brazo con contrapeso y piloto ámbar.
  - **Caja de fundas a escala 0,7:** las portadas reales; al pasar el ratón, la funda se levanta.
  - **Vinilo:** sale de su funda en arco y se acuesta en el plato; gira a 33⅓ rpm solo al sonar.
  - **Funda de lo que suena:** apoyada detrás, a la derecha.
  - **Respaldo sin WebGL:** el mismo tocadiscos dibujado en CSS.
- **Monitor**: minirreproductor de madera en las demás salas; su vinilo no gira.

## Motion

Un solo momento firmado: el vinilo viaja de la funda al plato y el brazo se posa. El resto es respuesta: teclas que se hunden, cajas que dejan asomar el disco, el parpadeo de tubo de la lámpara al encenderse, el interruptor que sube. Todo en `ease-out` fuerte por debajo de 300 ms, salvo el brazo, que tarda 600 ms en `ease-in-out` porque es un movimiento físico. Con `prefers-reduced-motion` no hay giros ni parpadeos.

## Do's and Don'ts

### Do:
- **Do** usar el ámbar como único acento de acción y estado.
- **Do** mostrar cada estado en su objeto (lámpara, brazo, piloto, interruptor).
- **Do** construir cada sala alrededor de su objeto del estudio.
- **Do** mantener controles de al menos 44 px y el foco ámbar visible.

### Don't:
- **Don't** volver a una barra de navegación ni a cuadrículas de tarjetas iguales.
- **Don't** simular latón o metal con degradados y biseles.
- **Don't** usar papel fuera de la hoja de sesión y de las etiquetas.
- **Don't** usar la fuente mecanografiada fuera de la hoja y las cifras.
- **Don't** teñir la interfaz con los colores de mood fuera de sus pegatinas.
