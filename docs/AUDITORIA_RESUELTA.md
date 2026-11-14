# Auditoría de VibeTrack — entrega local parcial

**Estado: NO RESUELTA EN SU TOTALIDAD.** El nombre de este archivo sigue el protocolo;
no certifica la corrección del fallo de recomendaciones ni el cierre de las fases A–G.

## Alcance y evidencia

Se leyó el protocolo de Texto pegado.txt y se revisaron README, PLAN_PROYECTO y AVANCE_FUNCIONAL.
Se guardó el avance previo en el commit local `c965fd2`, antes de cambiar la lógica.
No se efectuó push ni despliegue. No se abrió, imprimió ni modificó backend/.env.

La línea base quedó recuperada con build correcto y 37/37 pruebas después de restaurar las
dependencias desde la caché local. El npm ci normal NO pudo completarse: error interno de npm,
seguido por EPERM al crear enlaces de workspaces. La restauración auxiliar sin enlaces no cambia
package-lock.json ni las versiones del proyecto.

La descarga de helmet, compression, @nestjs/jwt y @nestjs/swagger falló con
ENOTFOUND registry.npmjs.org. Se avanzaron los puntos independientes de seguridad de la fase A;
las fases siguientes no se dan por completadas ni se sustituyen por implementaciones improvisadas.

## Matriz de hallazgos

| Hallazgo | Solución / pendiente | Archivos | Evidencia | Estado |
| --- | --- | --- | --- | --- |
| A1 Archivos sensibles y comprimidos | Ignorar env, dependencias, builds, logs, coverage, zip/rar; LF; detector previo a tests | .gitignore, .gitattributes, scripts/check-secrets.cjs, package.json | check:secrets y diff --check correctos | resuelto |
| A1 Credenciales expuestas | Procedimiento manual de rotación documentado; no se tocaron secretos | README.md | No se verificó rotación | no verificado |
| A2 Hardening HTTP | Sin X-Powered-By, cuerpo JSON 10 kb y error genérico; faltan helmet, compression, CSP/HSTS y verificación de CDN | backend/src/main.ts, common/api-exception.filter.ts | Build; prueba de error JSON; cabeceras/parser completo pendiente | parcial |
| A3 JWT | Sigue implementación anterior de siete días; faltan @nestjs/jwt y renovación corta | auth/token.service.ts | Pruebas previas de firma/claims pasan; migración no hecha | parcial |
| A3 Sesiones | Límite cinco, logout-all autenticado | auth/auth.module.ts | HTTP en memoria: límite, revocación y 401 | resuelto |
| A3 Login y contraseñas | Bloqueo progresivo por correo, hash falso, política no trivial, cola 2+8, scrypt versionado compatible | auth/auth.module.ts, auth/password.service.ts | auth.test.ts y security.test.ts; migración al login pendiente de prueba específica | parcial |
| A3 Throttlers nombrados | Siguen límites anteriores de API; falta separación por endpoint/cuenta para recomendaciones | app.module.ts | No implementado en este bloque | parcial |
| A3 Roles | Enum user/admin, RolesGuard y decorador; script de promoción | auth/auth.module.ts, auth/roles.guard.ts, scripts/make-admin.cjs | 401/403/admin en guard; script no ejecutado contra DB | parcial |
| A3 Índices | autoIndex desactivado en producción y script explícito de creación | database/database.module.ts, scripts/sync-indexes.cjs | Compilación; ejecución Atlas pendiente | parcial |
| A3 Cookie vieja y DB caída | Recomendaciones pasan a invitado al fallar sesión con ServiceUnavailableException | music/music.module.ts | Compilación; prueba dedicada pendiente | parcial |
| A4 Errores | requestId, formato uniforme, redacción de URLs/tokens, 5xx genérico y Retry-After en 429 | common/api-exception.filter.ts, main.ts | security.test.ts | parcial |
| A4 Campos internos | Mapper de salida de lista positiva sin mutar candidatos | music/track.dto.ts, music/music.module.ts | security.test.ts | resuelto |
| B1 Entorno, proxy y readiness | Pendientes | — | No verificado | no verificado |
| B2 Cookies y rewrites | Pendientes; se conserva Strict existente | — | No verificado | no verificado |
| B3 Documentación de despliegue | Diferida; trabajo local, sin publicar | — | No verificado | no verificado |
| C1 Presupuesto de llamadas | Pendiente; el coste de consulta con preferencias sigue siendo un riesgo | music/music.service.ts | No verificado con catálogos reales | no verificado |
| C2 Cola iTunes, cooldown y circuit breaker | Pendiente | music/music.providers.ts | No verificado | no verificado |
| C3 LRU, bytes, SWR y métricas | Pendiente | music/music-cache.ts | No verificado | no verificado |
| C4 Sesiones de recomendación y pool | Pendiente | music/music.service.ts | No verificado | no verificado |
| C5 Endpoint de previews | Pendiente | music, useRecommendations | No verificado | no verificado |
| C6 Rendimiento frontend | Pendiente | frontend/src | Bundle principal actual: 86.44 kB gzip | no verificado |
| D1 Identidad estable | Pendiente; el id aún puede cambiar durante enriquecimiento | music.types, TrackList, PlayerProvider | No verificado | no verificado |
| D2 Redirección de auth | Pendiente | AuthPage.jsx | No verificado | no verificado |
| D3/D3b Reproductor y fallos de cola | Pendiente | PlayerProvider.jsx | No verificado | no verificado |
| D4 Accesibilidad | Pendiente | frontend/src | No verificado | no verificado |
| D5 ErrorBoundary | Pendiente | ErrorBoundary.jsx | No verificado | no verificado |
| D6 Rutas perfil/favoritos/admin | Pendiente | main.jsx | No verificado | no verificado |
| D7 Fallo real de recomendaciones | Sigue abierto; no se reprodujo contra las APIs reales | music y recomendaciones | Fixtures no certifican el caso real del usuario | no verificado |
| E1–E3 División de módulos, texto/géneros y formato | Pendiente; se extrajo solamente PasswordService por necesidad de A3 | auth/password.service.ts | Build | parcial |
| E4 Lint/Prettier | Pendiente; no existe script lint | package.json | npm run lint falla por script ausente | no verificado |
| E5 CI | Pendiente | — | No verificado | no verificado |
| E6 Swagger | Bloqueado por instalación; integración pendiente | — | ENOTFOUND | no verificado |
| F1 Mood persistente y CRUD admin | Pendiente | — | No verificado | no verificado |
| F2 Track persistente | Pendiente | — | No verificado | no verificado |
| F3 Favorite y propiedad | Pendiente | — | No verificado | no verificado |
| F4 Rating y propiedad | Pendiente | — | No verificado | no verificado |
| F5 MoodHistory y estadísticas | Pendiente | — | No verificado | no verificado |
| F6 Perfil y borrado en cascada | Pendiente | — | No verificado | no verificado |
| F7 Personalización con feedback | Pendiente | — | No verificado | no verificado |
| F8 UI favoritos, ratings y admin | Pendiente | — | No verificado | no verificado |
| G1/G3 Pruebas backend/integración | 37 previas conservadas, cinco nuevas, ampliación HTTP de sesiones | backend/test | 42/42 pasan con proveedores/DB simulados | parcial |
| G2 Tests frontend | Pendientes de dependencias e implementación | — | No verificado | no verificado |
| G4 Recorrido manual | Sigue a cargo del dueño; no se abrió navegador | README.md | No verificado | no verificado |
| G5 Puerta final | Build/tests/detector pasan; npm ci, lint y audit no pasan | — | Ver resultados abajo | parcial |

## Resultados reales

- `npm run build`: correcto frontend/backend. Chunk principal 86.44 kB gzip, sin aumento.
- `npm test`: 42 aprobadas; incluye las 37 anteriores. Las respuestas externas y DB son simuladas.
- `npm run check:secrets`: correcto, sin coincidencias; no abre .env ni muestra valores detectados.
- `git diff --check`: correcto.
- `npm ci`: falló; dependencias originales recuperadas desde caché sin enlaces de workspaces.
- `npm run lint`: falló, script ausente; fase E4 pendiente.
- `npm audit --omit=dev`: no verificado; falló el acceso al endpoint de npm por DNS.
- Atlas, Last.fm, iTunes, navegador, cookies públicas, CSP/CDN: **no verificado**.

## Decisiones y próximos pasos del dueño

1. Recuperar instalación de paquetes desde una terminal local con acceso a npm; comandos en README.
2. Rotar credenciales únicamente si hubo exposición. No se ha comprobado ni efectuado una rotación.
3. Las URLs Render/Vercel y el despliegue quedan diferidos por indicación de trabajar localmente.
4. Confirmar posteriormente límites según pruebas reales de carga; el bloqueo por cuenta está en memoria
   y no se comparte entre procesos. Las sesiones continúan persistidas y revocables.
5. Para el fallo musical, registrar mood, artistas/géneros elegidos, si se pulsa Otras 7 o se vuelve a entrar,
   y mensaje recibido. No incluir cookies, claves ni datos de cuenta. Reproducir el caso antes de declarar solución.

No se presenta esta entrega parcial como el cumplimiento del protocolo completo.
