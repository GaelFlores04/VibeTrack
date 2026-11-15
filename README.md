# VibeTrack

Aplicación para descubrir música según tu estado de ánimo. React + Vite, NestJS + TypeScript y MongoDB Atlas. La fase actual se centra en las funciones; el diseño retro y el 3D siguen pendientes.

## Funciones disponibles

- Búsqueda de canciones y artistas en Deezer (iTunes como respaldo), con portadas y previews.
- Seis moods con perfiles distintos, varias etiquetas de Last.fm y selección editorial inicial de canciones conocidas.
- Registro, login, consulta de cuenta y logout con revocación de sesión.
- Cuestionario opcional de géneros y artistas; búsqueda con sugerencias y selección como etiquetas removibles, conservando preferencias existentes.
- Recomendaciones para invitados/cuentas sin cuestionario y selección personalizada para cuentas con preferencias.
- Cola de previews con anterior/siguiente y avance al terminar cada muestra.

## Ejecutar

Requiere Node.js 22.12 o posterior. Desde PowerShell:

```powershell
cd C:\Vibetrack\vibeTrackPJ
npm install
if (!(Test-Path backend/.env)) { Copy-Item backend/.env.example backend/.env }
```

Completar `backend/.env` con `MONGODB_URI`, `LASTFM_API_KEY` y `JWT_SECRET`. El secreto JWT debe tener al menos 32 caracteres aleatorios. Para generar uno sin exponer las otras credenciales:

```powershell
node -e "console.log(require('node:crypto').randomBytes(48).toString('hex'))"
```

La instalación local ya tiene un secreto generado. Conservarlo para mantener las sesiones entre reinicios. No subir `.env` a Git.

```powershell
npm run dev
```

Abrir http://127.0.0.1:5173. Vite envía `/api` al backend mediante proxy. Usar siempre el mismo host (`localhost` o `127.0.0.1`) para conservar la cookie del navegador.

## Entorno

| Variable | Uso |
| --- | --- |
| PORT | Puerto API, 3000 por defecto |
| FRONTEND_ORIGIN | Origen de frontend autorizado; localhost:5173 por defecto |
| MONGODB_URI | Conexión a MongoDB; requerida para cuentas y sesiones |
| LASTFM_API_KEY | Consultas de recomendaciones y metadatos |
| JWT_SECRET | Clave aleatoria de al menos 32 caracteres |
| NODE_ENV | `production` activa cookies Secure y restringe el origen configurado |

Producción necesita HTTPS y un proxy que mantenga frontend y API en el mismo sitio. La configuración local usa cookie HttpOnly, SameSite=Strict y ruta `/api`; no guarda tokens en localStorage. Las mutaciones exigen `X-VibeTrack: 1` y verifican Origin cuando está presente. CORS permite únicamente el origen configurado, más los hosts locales durante desarrollo.

## Cuentas y persistencia

Colecciones `users` y `sessions`, relacionadas mediante `sessions.userId`. Email único normalizado, contraseñas con scrypt asíncrono versionado y salt aleatorio por usuario (N=32768, r=8, p=1). Se ejecutan hasta dos derivaciones a la vez y se admiten ocho en espera; al saturarse se responde 429. Los hashes anteriores se verifican con N=65536 y se migran tras un login correcto. JWT HS256 con emisor, audiencia, expiración de siete días y firma verificados usando crypto de Node. El token se guarda en cookie; MongoDB almacena su hash para permitir revocación. Un índice TTL limpia sesiones vencidas; también se verifica su fecha en cada consulta.

Las preferencias se guardan en el usuario autenticado. Los DTOs rechazan campos adicionales y no aceptan un ID ajeno para modificar preferencias. Las consultas públicas funcionan sin cuenta. Sin MongoDB las operaciones de cuenta devuelven un error de servicio.

## Recomendaciones y rendimiento

Cada tanda completa contiene **7 recomendaciones**; el audio no bloquea su presentación. Se mantiene una reserva de candidatas por sesión de descubrimiento; se consultan más fuentes hasta reunir siete coincidencias de mood y preferencias. Las tandas preparadas se reutilizan y las peticiones simultáneas de la misma página se agrupan.

### Proveedores

| Proveedor | Uso | Clave |
| --- | --- | --- |
| **Last.fm** | Candidatas (tags del mood, géneros, top de artistas), artistas similares, género del artista, etiquetas de respaldo y autocompletado | `LASTFM_API_KEY` |
| **Deezer** | Búsqueda, previews de 30 s, portada e ISRC de cada candidata | No (endpoints públicos) |
| **ReccoBeats** | Rasgos de audio por ISRC (valence, energy, danceability, acousticness) para clasificar el mood | No; `RECCOBEATS_ENABLED=false` lo desactiva |
| **iTunes Search** | Respaldo de búsqueda y previews si Deezer falla o no encuentra la canción | No |

Las URLs de preview de Deezer van firmadas y caducan en ~15 minutos, así que las tarjetas apuntan a `/api/music/preview/:id`, que redirige a una URL recién emitida (caché de 5 minutos, sólo en memoria y sólo hacia `*.dzcdn.net`).

### Cómo se decide el mood

- Cada mood define rangos de audio: feliz (valence ≥ 0.6, energy ≥ 0.45, danceability ≥ 0.45), triste (valence ≤ 0.38, energy ≤ 0.5, danceability ≤ 0.68: lo tenso o bailable no es tristeza), cansado (energy ≤ 0.32), relajado, motivado y romántico.
- **Tempo (BPM) como señal suave.** Se usa el tempo *percibido*: los detectores suelen dar el doble del pulso en canciones lentas (Fix You marca 138 y se siente a 69), así que con energía baja se divide entre dos. Rangos: feliz 100–170, triste 50–100, cansado 45–95, relajado 55–120, romántico 55–115, motivado 80–195. Fuera del rango la afinidad baja hasta un 40 %, pero el tempo nunca descarta una canción por sí solo. También suaviza el orden: se evitan saltos bruscos de pulso entre canciones consecutivas.
- **Sin etiquetas de ánimo**, una canción entra si su audio encaja con claridad (así "Fix You" cuenta como triste aunque Last.fm no la etiquete).
- **Con etiquetas**, se promedian etiqueta y audio: una canción etiquetada "happy" que suena triste se descarta.
- Una etiqueta contraria explícita (p. ej. `sad` para feliz) sigue excluyendo. Sin rasgos de audio (ReccoBeats caído o sin datos) se usan sólo las etiquetas de Last.fm, como antes.
- Al clasificar una candidata se obtiene su coincidencia en Deezer; esa misma coincidencia aporta el preview, sin una segunda búsqueda.

### Personalización

- **Invitados/sin cuestionario:** selección editorial conocida y listas del mood, ponderando afinidad y popularidad.
- **Con preferencias, que orientan pero no encierran.** Cada tanda de 7 se arma por cupos: **3 de tus artistas**, **2 cercanas** (artistas similares, tus géneros o el estilo de tus artistas) y **2 descubrimientos** fuera de tus gustos que encajen claramente con el mood (afinidad ≥ 0.8), con preferencia por géneros vecinos (rock → indie/folk/metal, hip-hop → R&B/electrónica…). Sin artistas elegidos: 5 de tus géneros y 2 descubrimientos. Si un grupo no alcanza, completan primero tus artistas y los cercanos; los descubrimientos llegan a 3 como máximo salvo que no haya nada más. Cada canción indica su motivo ("De uno de tus artistas", "Artista similar a…", "Para descubrir: folk, cerca de lo que escuchas").
- Con géneros elegidos y audio disponible, la mitad de cada ronda de verificación revisa temas del propio género (una consulta a Deezer basta para saber si suenan al mood).
- **Descubrimientos con criterio.** Salen de dos fuentes: las listas del mood y **artistas a dos pasos** de los tuyos (similares de tus similares; p. ej. The Strokes → Little Joy o CRX). Se puntúan por afinidad con tu gusto (35 %), encaje con el mood (30 %) y **popularidad intermedia** (25 %): se prefieren temas entre ~30 mil y ~800 mil oyentes en Last.fm, y un mega-éxito (más de ~2 M) apenas suma. Los temas de tus géneros también ponderan esa novedad a medias; los de tus artistas favoritos, no.
- **Sorpresa ocasional.** En ~1 de cada 3 tandas uno de los descubrimientos es deliberadamente distinto a tu gusto, pero encaja de sobra con el mood (afinidad ≥ 0.85) y no es un mega-éxito.
- **Perfil de gusto (`taste_profiles`).** Por cuenta, en MongoDB (memoria si no hay base), con TTL de 180 días. Combina las etiquetas de tus artistas, tus géneros y lo que aprende de las previews que escuchas (`POST /api/music/plays`): peso por artista, peso por etiqueta y el promedio de sonido (valence, energy, danceability, acousticness, tempo). Las señales antiguas pierden peso poco a poco. **Sólo guarda agregados**, nunca qué escuchaste ni cuándo.
- El historial de canciones mostradas se guarda por cuenta y mood durante 7 días (`recommendation_history`, con TTL). Cambiar de gustos no reinicia el historial; si ya se mostró todo lo compatible, el ciclo vuelve a empezar.

Si no se encuentran siete coincidencias, la respuesta indica `retry` o `exhausted`. La interfaz conserva la tanda completa anterior si existe; en la primera carga muestra las coincidencias disponibles y un mensaje específico. No se rellena con canciones ajenas a los gustos ni se sustituye una tanda de siete por otra de dos. Algunas combinaciones (p. ej. un pianista clásico con el mood motivado) no tienen siete canciones reales.

### Caché y límites

La caché compartida almacena exclusivamente metadatos públicos, en memoria y en la colección `music_cache` de MongoDB con índice TTL. Rasgos de audio: tres días; coincidencias de Deezer: un día; catálogos y etiquetas: seis horas; fuentes: una hora; búsquedas: diez minutos. No se almacenan archivos de audio.

Deezer se limita a 40 consultas cada 5 s por proceso (su cuota pública es 50); ReccoBeats agrupa hasta 40 ISRC por llamada; iTunes conserva dieciocho consultas por minuto. Last.fm informa `totalPages` muy por debajo de lo real en los tags, por eso los tags se paginan hasta recibir una página corta (máximo 30); el top de un artista se recorre hasta 4 páginas.

### APIs evaluadas

- **Spotify:** desde 2024 las apps nuevas no tienen acceso a *audio-features*, *recommendations* ni previews; no sirve para este caso.
- **Deezer:** restringió la creación de nuevas apps OAuth, pero los endpoints públicos de búsqueda y pistas que se usan aquí no requieren app ni clave.
- **ReccoBeats:** servicio gratuito y pequeño; por eso es opcional y su caída sólo devuelve la clasificación a las etiquetas.

## API

| Método | Ruta | Uso |
| --- | --- | --- |
| GET | /api/health | Estado de proceso y conexión/configuración |
| GET | /api/moods | Seis moods con descripción |
| GET | /api/music/search?q=Daft%20Punk | Búsqueda pública |
| GET | /api/music/preview/3106505 | Redirige a la URL vigente del preview de Deezer |
| POST | /api/music/plays | `{ id: "deezer:3106505" }`; requiere sesión. Afina el perfil de gusto (sólo agregados) |
| GET | /api/music/recommendations/feliz?session=UUID&page=1 | Tanda de 7; objeto con tracks, status, page, nextPage, mode y previewsPending |
| GET | /api/music/artists?q=d | Sugerencias de artistas desde una letra |
| GET | /api/music/suggestions?q=d | Sugerencias de canciones y artistas desde una letra |
| POST | /api/auth/register | `{ name, email, password }`; crea cuenta y sesión |
| POST | /api/auth/login | `{ email, password }`; inicia sesión |
| GET | /api/auth/me | Cuenta actual; sin sesión válida, respuesta vacía |
| POST | /api/auth/logout | Revoca sesión y elimina cookie |
| POST | /api/auth/logout-all | Requiere sesión; revoca todas las sesiones de la cuenta |
| PUT | /api/auth/preferences | `{ genres: [], artists: [] }`; requiere sesión |
| DELETE | /api/auth/preferences | Borra respuestas y vuelve a selección inicial |

Hasta seis géneros admitidos y cinco artistas. Contraseña: diez a 128 caracteres. Registro y login limitados a cinco peticiones por minuto e IP, además del límite general de API.

## Validación

```powershell
npm run build
npm test
npm run check:services
```

Las pruebas automatizadas cubren contraseñas, JWT, rutas de cuenta, validación, CSRF, aislamiento de preferencias, revocación, selección por mood, popularidad, personalización, cachés y previews. Las rutas se prueban dentro del proceso con repositorio aislado y los proveedores con respuestas simuladas. No se modifican cuentas reales ni datos de Atlas durante las pruebas.

Revisión de navegador a cargo del usuario, con servicios reales:

1. Elegir un mood como invitado y escuchar la secuencia de previews.
2. Crear cuenta y omitir el cuestionario: debe conservar el modo de canciones conocidas.
3. Guardar géneros/artistas; volver al mismo mood y comprobar la selección y sus motivos.
4. Recargar para comprobar la sesión y las preferencias persistidas en MongoDB.
5. Cerrar sesión y entrar con otra cuenta: sus preferencias deben ser independientes.
6. Eliminar preferencias y comprobar la vuelta al modo inicial.
7. Pedir al menos tres tandas consecutivas: deben mantenerse siete canciones y no repetirse dentro de esa selección.
8. Escribir desde una letra en Explorar y en artistas; seleccionar con ratón o flechas/Enter, quitar etiquetas y guardar.
9. Escuchar los seis moods y registrar ejemplos que no encajen. Revisar que la página conserve la tanda durante carga o error.

## Siguiente fase

Favoritos, calificaciones, historial, estadísticas, CRUD restante, permisos por rol, diseño retro y despliegue.

Repositorio: https://github.com/GaelFlores04/VibeTrack.git

## Si una credencial se expuso

El dueño debe rotar la contraseña del usuario de Atlas, regenerar la clave de Last.fm
 y generar un nuevo JWT_SECRET. Actualizar su entorno manualmente; nunca guardar valores reales en Git.

```sh
node -e "console.log(require('node:crypto').randomBytes(48).toString('hex'))"
```

Ejecutar `npm run check:secrets` antes de cada commit. El detector no abre archivos `.env`;
no reemplaza la rotación de credenciales ni una revisión del historial de Git.

## Auditoría local en curso

La auditoría completa está **inconclusa**. Consultar `docs/AUDITORIA_RESUELTA.md` para el estado de cada fase.
No se han publicado cambios ni efectuado push. El fallo real de recomendaciones con preferencias sigue abierto.

- Máximo cinco sesiones conservadas por cuenta; `logout-all` cierra todas.
- Login: después de cinco fallos por correo normalizado se bloquea temporalmente esa clave
  durante 30 segundos; los bloqueos posteriores aumentan hasta 15 minutos. Estado acotado por proceso.
- La política de contraseñas rechaza ejemplos triviales y el correo completo dentro de la contraseña.
- El registro no admite roles; el esquema admite `user` y `admin`. RolesGuard distingue 401/403.
  La interfaz y los endpoints administrativos de moods siguen pendientes de la fase F.
- API: cuerpo JSON máximo 10 kb; JSON inválido con mensaje genérico; errores con `requestId`.
  Las respuestas musicales se construyen con una lista de campos públicos; no exponen el estado del ranking.
- Producción: `autoIndex=false`. Después de compilar, el dueño puede ejecutar
  `node backend/scripts/sync-indexes.cjs` con MONGODB_URI configurada en su entorno.
  Crea índices sin borrar índices ajenos. No se ha ejecutado contra Atlas.
- Para promover una cuenta existente: `node backend/scripts/make-admin.cjs correo@example.com`.
  Requiere MONGODB_URI en el entorno; no abre `.env` ni imprime credenciales. No se ha ejecutado.
- JWT sigue siendo la implementación previa de siete días; la migración a @nestjs/jwt y renovación
  corta está pendiente por bloqueo de instalación. No se considera resuelta la auditoría de autenticación.

### Retomar la instalación bloqueada

En una terminal local con acceso a npm, desde la raíz del proyecto:

```powershell
npm ci
npm install -w backend helmet compression @nestjs/jwt @nestjs/swagger
npm install -D -w backend @types/compression
npm run build
npm test
```

Estos comandos instalan dependencias; todavía falta conectar helmet, compresión, JWT y Swagger en el código.
El fallo observado aquí fue ENOTFOUND para registry.npmjs.org. La instalación npm ci también encontró
EPERM al crear enlaces de workspaces. Las dependencias anteriores se restauraron desde caché en una
instalación auxiliar sin enlaces y se verificaron build y tests; eso no equivale a un npm ci normal exitoso.
