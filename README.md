# VibeTrack

Aplicación web para descubrir música según tu estado de ánimo, con recomendaciones personalizadas y un reproductor inspirado en un estudio analógico.

## Ramas del proyecto

- **mejora-algoritmo:** desarrollo actual; contiene las funciones descritas en este README.
- **base-funcional:** primera entrega del proyecto, conservada como referencia histórica.

## Funciones

- Seis moods: feliz, relajado, motivado, triste, romántico y cansado.
- Tandas de hasta siete canciones compatibles con el mood, con motivos de recomendación y preferencias por géneros y artistas.
- Búsqueda musical, portadas y previews de Deezer, con iTunes como respaldo.
- Registro, inicio de sesión, preferencias y valoraciones para personalizar las recomendaciones.
- Minirreproductor persistente, cola, volumen, navegación entre tandas y controles de teclado.
- Integración opcional con Spotify para importar señales de gusto y reproducir canciones completas cuando la cuenta y los permisos lo permiten.
- Escena 3D, controles HTML accesibles y soporte de movimiento reducido.

El motor combina etiquetas de Last.fm, rasgos de audio de ReccoBeats y señales de letras de LRCLIB. Sus puntuaciones son heurísticas. Si no encuentra siete coincidencias, informa la disponibilidad sin rellenar la tanda con canciones de compatibilidad dudosa.

## Tecnologías

| Capa | Tecnologías |
| --- | --- |
| Interfaz | React 19, Vite, React Router y CSS |
| Escena 3D | Three.js y React Three Fiber |
| API | NestJS y TypeScript |
| Persistencia | MongoDB / MongoDB Atlas |
| Organización | Workspaces npm para frontend y backend |
| Despliegue | Docker y configuración para Render |

## Ejecutar localmente

Requiere Node.js **22.12 o posterior** y npm. Desde la raíz del repositorio, en PowerShell:

```powershell
git switch mejora-algoritmo
npm ci
if (!(Test-Path backend/.env)) { Copy-Item backend/.env.example backend/.env }
```

Configura las variables del backend antes de arrancar:

| Variable | Uso |
| --- | --- |
| MONGODB_URI | Persistencia de cuentas, sesiones y preferencias |
| LASTFM_API_KEY | Fuentes de recomendaciones y metadatos |
| JWT_SECRET | Secreto de al menos 32 caracteres aleatorios |
| PORT | Puerto de la API; 3000 por defecto |
| FRONTEND_ORIGIN | Origen autorizado del frontend |
| SPOTIFY_CLIENT_ID | Integración opcional con Spotify |
| SPOTIFY_CLIENT_SECRET | Secreto de la app de Spotify |
| SPOTIFY_REDIRECT_URI | Callback registrado en Spotify |

Consulta `backend/.env.example` para las demás opciones. No subas credenciales ni archivos `.env` a Git.

```powershell
npm run dev
```

Abre http://127.0.0.1:5173. Vite envía las solicitudes de `/api` al backend. Usa siempre el mismo host para conservar la sesión del navegador.

## Comprobaciones

```powershell
npm run check:secrets
npm run build
npm test
npm run check:production
npm run check:services
```

El build incluye presupuestos de descarga. La comprobación de producción necesita la aplicación compilada; la de servicios requiere el entorno y los proveedores configurados. Estos comandos son instrucciones de validación, no una afirmación de que se hayan ejecutado en esta actualización documental.

## Sesiones y datos

La autenticación usa cookies HttpOnly y sesiones revocables. Los JWT tienen una duración de 60 minutos y pueden renovarse dentro del límite de siete días de la sesión. Las mutaciones validan el origen y la cabecera `X-VibeTrack`.

Las preferencias pertenecen a la cuenta autenticada. El perfil aprendido conserva agregados de gusto; el historial de recomendaciones tiene su propia persistencia temporal. La caché musical almacena metadatos, no archivos de audio.

## Diseño y despliegue

La referencia visual actual es un estudio analógico nocturno con maderas, tonos ámbar y tocadiscos: [guía de diseño](frontend/DESIGN.md).

La aplicación se distribuye como sitio web accesible por enlace. La configuración de Render sirve frontend y API bajo un mismo origen HTTPS. Consulta la [guía de despliegue](docs/DESPLIEGUE_RENDER.md) para configurar el entorno y comprobar la publicación.

## Documentación y trazabilidad

- [Bitácora de IA](docs/BITACORA_IA.md): intervenciones, comprobaciones y pendientes por sesión.
- [Diario de decisiones](docs/DIARIO_DECISIONES.md): decisiones, contexto, consecuencias y evidencia.
- [Investigación de moods](docs/INVESTIGACION_MOODS.md).
- [Aprendizaje de gustos](docs/APRENDIZAJE_GUSTOS.md).
- [Preferencias detalladas](docs/PREFERENCIAS_DETALLADAS.md).
- [Mejoras de navegación](docs/MEJORAS_NAVEGACION.md).
- [Auditoría y pendientes históricos](docs/AUDITORIA_RESUELTA.md).

Los registros históricos pueden describir fases anteriores. No equivalen a una certificación del estado actual ni de los servicios externos.
