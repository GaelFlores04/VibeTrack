# VibeTrack

Aplicación para descubrir música según tu estado de ánimo. React + Vite, NestJS + TypeScript y MongoDB Atlas. La fase actual se centra en las funciones; el diseño retro y el 3D siguen pendientes.

## Funciones disponibles

- Búsqueda de canciones y artistas en iTunes, con portadas y previews cuando están disponibles.
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

Colecciones `users` y `sessions`, relacionadas mediante `sessions.userId`. Email único normalizado, contraseñas con scrypt asíncrono y salt aleatorio por usuario. JWT HS256 con emisor, audiencia, expiración de siete días y firma verificados usando crypto de Node. El token se guarda en cookie; MongoDB almacena su hash para permitir revocación. Un índice TTL limpia sesiones vencidas; también se verifica su fecha en cada consulta.

Las preferencias se guardan en el usuario autenticado. Los DTOs rechazan campos adicionales y no aceptan un ID ajeno para modificar preferencias. Las consultas públicas funcionan sin cuenta. Sin MongoDB las operaciones de cuenta devuelven un error de servicio.

## Recomendaciones y rendimiento

Cada tanda completa contiene **7 recomendaciones**; el audio no bloquea su presentación. Se mantiene una reserva de candidatas por sesión de descubrimiento; se consultan más fuentes hasta reunir siete coincidencias de mood y preferencias. Las canciones ya entregadas no se repiten en esa sesión. Las tandas preparadas se reutilizan y las peticiones simultáneas de la misma página se agrupan.

Si no se encuentran siete coincidencias de mood y preferencias, la respuesta indica `retry` o `exhausted`. La interfaz conserva la tanda completa anterior si existe; en la primera carga muestra las coincidencias disponibles y un mensaje específico. No se inventa disponibilidad, no se rellena con canciones ajenas a los gustos y no se sustituye una tanda de siete por otra de dos. La disponibilidad de siete canciones nuevas no puede garantizarse indefinidamente para cualquier combinación de artistas y mood. Una vez seleccionadas, los previews se buscan en segundo plano; el frontend consulta su progreso sin reemplazar la selección. Un fallo de iTunes deja las tarjetas y enlaces disponibles.

- **Invitados/sin cuestionario:** selección editorial conocida y listas del mood, ponderando afinidad y popularidad.
- **Con preferencias:** sólo pasan temas de artistas elegidos, artistas relacionados por Last.fm o géneros seleccionados. Se elimina el relleno editorial genérico. La afinidad personal aporta 70 % del ranking, el mood 28 % y la popularidad 2 %.
- Las etiquetas de origen específicas del mood aportan evidencia; un género o artista por sí solo no prueba el estado de ánimo. Para candidatas personales sin evidencia se comprueban `track.getInfo` y, si hace falta, `track.getTopTags`. Se descartan señales contrarias conocidas.
- Se espacia a los artistas y se favorece continuidad de género e intensidad estimada. No hay análisis de BPM, tonalidad ni letras.
- iTunes se consulta **por catálogo de artista**, hasta 200 canciones con sus metadatos por llamada. Se conserva la coincidencia de título/artista/versiones y se admiten diferencias de créditos de banda sonora. Hay un máximo de dos búsquedas exactas de respaldo por preparación.
- Las canciones se muestran aunque su preview esté pendiente o no exista. Sólo se habilita reproducir cuando hay un URL devuelto por el proveedor; el reproductor conserva su manejo de errores de CDN.

La caché compartida almacena exclusivamente metadatos públicos, en memoria y en la colección `music_cache` de MongoDB con índice TTL. Catálogos y etiquetas: seis horas; fuentes: una hora; búsquedas: diez minutos; sugerencias: treinta minutos. No se almacenan archivos de audio. Si la caché de MongoDB falla se usa la memoria y se sigue consultando al proveedor.

El límite de iTunes permanece en dieciocho consultas por minuto y proceso. El autocompletado usa Last.fm, por lo que escribir no consume esa cuota. La interfaz consulta desde la primera letra tras 220 ms sin teclear, cancela respuestas obsoletas y reutiliza sugerencias recientes.

La personalización se calcula por sesión y sus claves incluyen cuenta, preferencias, mood e identificador de descubrimiento. Cambiar de cuenta o de gustos reinicia la selección. El ranking de moods sigue siendo una aproximación basada en etiquetas sociales, pendiente de evaluación escuchando canciones reales.

### APIs evaluadas

- **iTunes Search:** sigue documentada por Apple, con previews y aproximadamente veinte consultas/minuto. La solución implementada reduce llamadas usando catálogos y caché: https://performance-partners.apple.com/search-api
- **Spotify:** el campo `preview_url` está obsoleto y admite null; no resuelve de forma fiable la cobertura de previews: https://developer.spotify.com/documentation/web-api/reference/get-track
- **Deezer:** su equipo ha comunicado restricciones para nuevos accesos de particulares. No se añadió como dependencia sin un acceso oficial confirmado: https://en.deezercommunity.com/features-feedback-44/api-auth-impossible-80857

## API

| Método | Ruta | Uso |
| --- | --- | --- |
| GET | /api/health | Estado de proceso y conexión/configuración |
| GET | /api/moods | Seis moods con descripción |
| GET | /api/music/search?q=Daft%20Punk | Búsqueda pública |
| GET | /api/music/recommendations/feliz?session=UUID&page=1 | Tanda de 7; objeto con tracks, status, page, nextPage, mode y previewsPending |
| GET | /api/music/artists?q=d | Sugerencias de artistas desde una letra |
| GET | /api/music/suggestions?q=d | Sugerencias de canciones y artistas desde una letra |
| POST | /api/auth/register | `{ name, email, password }`; crea cuenta y sesión |
| POST | /api/auth/login | `{ email, password }`; inicia sesión |
| GET | /api/auth/me | Cuenta actual; sin sesión válida, respuesta vacía |
| POST | /api/auth/logout | Revoca sesión y elimina cookie |
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
