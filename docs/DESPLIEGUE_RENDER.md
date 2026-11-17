# Publicar VibeTrack en Render Free

VibeTrack se publica como una aplicación web: quien la visita abre una URL HTTPS en su navegador, sin descargar ni instalar una app. Se necesitan navegadores modernos. El audio requiere una acción del usuario y Spotify completo depende del navegador, Premium y los permisos de la app de Spotify.

## Arquitectura preparada

Un servicio de Render ejecuta NestJS y sirve también el frontend compilado. React y `/api` comparten dominio, de modo que las cookies de sesión y las llamadas del frontend no requieren separar alojamientos. MongoDB Atlas guarda los datos persistentes.

El `Dockerfile` compila en una etapa y prepara otra con las dependencias de producción del backend. La imagen final ejecuta Node como usuario sin privilegios; no copia archivos `.env`, fuentes del proyecto, tests ni dependencias de compilación.

`render.yaml` declara un servicio **Free** desde la rama `mejora-algoritmo`, con salud en `/api/health` y despliegues automáticos desactivados. No crea bases de datos de pago ni dominios contratados.

## Pasos en Render

1. Crea una cuenta en [Render](https://dashboard.render.com/) o inicia sesión. Conecta GitHub y autoriza el repositorio `GaelFlores04/VibeTrack`.
2. Crea un **Blueprint**, selecciona ese repositorio y la rama **mejora-algoritmo**, donde se encuentra `render.yaml`. Revisa que el único servicio sea `vibetrack` y el plan sea **Free** antes de crearlo.
3. Introduce las variables solicitadas: `MONGODB_URI` de la base elegida y `LASTFM_API_KEY`. Render generará `JWT_SECRET`. Los valores se guardan en Render, no en Git ni en el frontend.
4. Autoriza en MongoDB Atlas los rangos IP de salida que Render muestra en **Connect → Outbound** para ese servicio. Si el primer despliegue falla por conexión a MongoDB, corrige esa lista y vuelve a desplegar.
5. La web usará su URL `https://...onrender.com`. Render proporciona `RENDER_EXTERNAL_URL`, que la aplicación reconoce como origen permitido. Si usas otro alojamiento o un dominio propio, define `FRONTEND_ORIGIN` con el origen HTTPS exacto, sin ruta.
6. Comprueba que `/api/health` muestre `database: connected` y Last.fm configurado. Abre Inicio, Explorar y una ruta de recomendaciones; recarga directamente esa ruta. Comprueba registro/login y reproducción desde un teléfono y una computadora.

Render Free no ofrece consola remota. Los índices de MongoDB deben existir antes de usar cuentas en producción. Si faltan, el propietario puede ejecutar desde su equipo el script del proyecto, después de revisar que `backend/.env` apunta a la base elegida:

```powershell
node --env-file=backend/.env backend/scripts/sync-indexes.cjs
```

Ese comando crea índices sin borrar los ajenos. No se ejecutó contra Atlas durante esta preparación.

## Spotify opcional

La web funciona con previews sin conectar Spotify. Para activar Spotify configura en Render `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET` y `SPOTIFY_REDIRECT_URI` con `https://TU-URL.onrender.com/api/spotify/callback`. Registra exactamente ese mismo redirect en el panel de Spotify. Si utilizas `SPOTIFY_TOKEN_KEY`, conserva su valor estable entre despliegues.

Un secreto de cifrado diferente al del entorno anterior obliga a reconectar los accesos de Spotify existentes. Las restricciones del modo desarrollo de Spotify siguen aplicando a los usuarios autorizados en su panel.

## Optimizaciones y comprobaciones

- HTTP comprimido y caché de un año para archivos con nombre versionado. El HTML se revalida para evitar que una visita cargue referencias antiguas después de un despliegue.
- Rutas de React accesibles al recargar; las rutas `/api` y los archivos inexistentes no se sustituyen por HTML.
- Políticas CSP separadas para la web y la API; cookies seguras de producción y origen HTTPS validado.
- El proxy se declara explícitamente mediante `TRUST_PROXY_HOPS`; el valor del Blueprint corresponde al servicio detrás del proxy de Render. En otros alojamientos se debe ajustar a su topología.
- La escena 3D se descarga aparte. Deja de girar cuando sale de pantalla o la pestaña se oculta, sin pausar la música. La caché de texturas pasa de 40 a 16 entradas. Existe respaldo sin WebGL.
- Límites de compilación: JavaScript inicial ≤110 KiB gzip, CSS ≤12 KiB y escena diferida ≤300 KiB. El build falla si se exceden.

```powershell
npm ci
npm run build
npm test
npm run check:production
```

`check:production` arranca y cierra un proceso aislado en un puerto local libre. No usa MongoDB, credenciales reales ni proveedores externos. Comprueba el arranque compilado, rutas, archivos estáticos y API. Docker Desktop debe estar iniciado para verificar además la imagen con `docker build -t vibetrack .`.

## Límites del plan gratuito

Render Free suspende el servicio tras 15 minutos sin tráfico; despertar puede tardar alrededor de un minuto. Tiene cuotas de horas, tráfico y compilación. No añadas un método de pago si prefieres que los excesos suspendan el servicio en vez de generar cargos; revisa también los límites de gasto del workspace. No se presenta como alojamiento de producción con disponibilidad garantizada.

Los archivos locales de Render son efímeros; por eso los datos se guardan en Atlas. No se han validado todavía la URL pública, credenciales de producción, audio/Spotify real ni dispositivos físicos. Los tres fallos del algoritmo documentados en el PR siguen pendientes: esta preparación no los corrige.

Referencias oficiales consultadas: [Render Free](https://render.com/docs/free), [Docker](https://render.com/docs/docker), [Blueprints](https://render.com/docs/blueprint-spec), [variables automáticas](https://render.com/docs/environment-variables), [rangos de salida](https://render.com/docs/outbound-ip-addresses), [Atlas Free](https://www.mongodb.com/docs/atlas/tutorial/deploy-free-tier-cluster/) y [redirects de Spotify](https://developer.spotify.com/documentation/web-api/concepts/redirect_uri).
