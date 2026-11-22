# VibeTrack

> **Estás viendo la primera entrega histórica (`base-funcional`).**
> El desarrollo actual está en [`mejora-algoritmo`](https://github.com/GaelFlores04/VibeTrack/tree/mejora-algoritmo): recomendaciones personalizadas, cuentas, integración opcional con Spotify y diseño de estudio analógico.
>
> Consulta el [README actualizado](https://github.com/GaelFlores04/VibeTrack/blob/mejora-algoritmo/README.md), la [bitácora de IA](https://github.com/GaelFlores04/VibeTrack/blob/mejora-algoritmo/docs/BITACORA_IA.md) y el [diario de decisiones](https://github.com/GaelFlores04/VibeTrack/blob/mejora-algoritmo/docs/DIARIO_DECISIONES.md).
>
> El contenido siguiente describe únicamente esta primera entrega. Sus resultados de verificación son históricos.

Aplicación web para descubrir música según tu estado de ánimo. React + Vite, NestJS + TypeScript y conexión preparada para MongoDB.

## Primera entrega

Código implementado: navegación, seis moods, búsqueda en iTunes, resultados y reproductor compartido. El diseño retro y el 3D se trabajarán después de las funciones.

**Verificación:** compilación de frontend/backend y 8 pruebas automatizadas aprobadas. El usuario confirmó consultas de Last.fm para los seis moods y conexión/ping de MongoDB Atlas. La revisión completa de navegador y el despliegue siguen pendientes.

## Ejecutar

Requisito: Node.js 22.12 o posterior; se recomienda Node 24.

Desde PowerShell en C:\Vibetrack\vibeTrackPJ:

```powershell
npm install
Copy-Item backend/.env.example backend/.env
# Completar MONGODB_URI y LASTFM_API_KEY antes de arrancar con ambos servicios.
npm run dev
```

Abrir http://localhost:5173. API: http://127.0.0.1:3000/api/health. Vite envía /api al backend mediante proxy.

```powershell
npm run build
npm test
npm run check:services
```

La búsqueda de iTunes no requiere clave. Incluye timeout, errores claros, deduplicación, caché de metadatos de diez minutos, agrupación de consultas simultáneas y máximo de 18 salidas por minuto por proceso. No se descarga ni almacena audio; la disponibilidad regional y de previews depende del proveedor.

## Entorno del backend

| Variable | Uso |
| --- | --- |
| PORT | Puerto API, 3000 por defecto |
| FRONTEND_ORIGIN | Origen permitido, http://localhost:5173 |
| MONGODB_URI | URI local o Atlas; vacía permite probar búsqueda sin persistencia |
| LASTFM_API_KEY | Clave para candidatos por mood; vacía produce 503 explícito |

Configurar las variables en backend/.env, sin subirlo a Git. Si se configura MongoDB, el arranque exige una conexión válida. Usuarios y favoritos todavía no están implementados.

## API disponible

| Método | Ruta | Comportamiento |
| --- | --- | --- |
| GET | /api/health | Estado del proceso, MongoDB y presencia de clave Last.fm; no comprueba disponibilidad externa |
| GET | /api/moods | Seis moods definidos en código |
| GET | /api/music/search?q=Daft%20Punk | Hasta 12 resultados de iTunes, región México |
| GET | /api/music/recommendations/feliz?page=1 | Candidatos por tag de Last.fm cuando se configure la clave |

Los candidatos por mood aún no tienen enriquecimiento iTunes ni personalización. Los seis tags fueron comprobados con una clave real. No se registra historial.

## Siguientes entregas

1. Completar el recorrido de aceptación de la base funcional.
2. Registro/login JWT con cookie HttpOnly, CSRF y permisos.
3. CRUD de perfiles, moods, canciones, favoritos, ratings e historial.
4. Coincidencias título/artista, enriquecimiento y recomendaciones personalizadas.
5. Diseño retro aprobado, escena 3D y controles avanzados de cola.
6. Verificación completa y despliegue.



Repositorio: https://github.com/GaelFlores04/VibeTrack.git.
