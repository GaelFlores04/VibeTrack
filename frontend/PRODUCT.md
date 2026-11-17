# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users
Personas que ponen música mientras estudian, entrenan, manejan o descansan y quieren canciones acordes a cómo se sienten sin armar una playlist. Llegan con un estado de ánimo concreto y poco tiempo para elegir. Audiencia secundaria: el jurado y los compañeros de la presentación final del proyecto integral, que evalúan la app en una demo.

## Product Purpose
VibeTrack recomienda tandas de 7 canciones por estado de ánimo (feliz, relajado, motivado, triste, romántico, cansado), con previews de 30 s, y aprende de los gustos de cada cuenta. Éxito: elegir un mood y estar escuchando algo adecuado en segundos; que cada visita traiga canciones distintas y que los descubrimientos se sientan cercanos a lo que el usuario escucha.

## Positioning
El mood se decide por cómo suena cada canción (valence, energy, danceability y tempo percibido vía ReccoBeats) además de las etiquetas de Last.fm. Las preferencias orientan sin encerrar: cada tanda mezcla favoritos, artistas cercanos (incluidos artistas a dos pasos) y descubrimientos de popularidad intermedia, con una sorpresa ocasional. Cada canción explica por qué está ahí.

## Operating Context
- Proyecto integral académico (React + NestJS + MongoDB Atlas) con presentación final; deben cumplirse los requisitos de `contexto/criterios.txt`.
- Sesiones de escucha largas en segundo plano: minirreproductor persistente, teclas multimedia, cola y continuación automática entre tandas.
- Rutas actuales: `/`, `/moods`, `/recomendaciones/:mood?tanda=N`, `/explorar`, `/login`, `/registro`, `/preferencias`, `/cuenta`, `/estado`.

## Capabilities and Constraints
- Recomendaciones de 7 por tanda; historial por cuenta y mood; perfil de gusto aprendido de previews escuchadas (sólo agregados).
- Previews de Deezer (iTunes de respaldo); no hay reproducción de canciones completas en el MVP.
- Portadas de Deezer e iTunes, servidas con CORS abierto (aptas como texturas WebGL).
- Escena 3D: React Three Fiber con modelos exportados desde Spline (GLB). Decisión del usuario del 15-11-2026. Por confirmar: que el plan de Spline del usuario permita exportar GLB.
- Stack existente: React 19 + Vite, React Router, Context API, CSS propio; NestJS; MongoDB Atlas.
- Pendiente: favoritos y calificaciones (D06) aún no existen en la API.

## Brand Commitments
- Nombre: VibeTrack.
- Diseño aprobado por el usuario: retro 2000s discreto, "música y océano" (criterios D01–D12 en `docs/PLAN_PROYECTO.md`, apartado 14). Vinculante: azul profundo con degradados suaves y acentos celestes, líneas finas, tipografía inclinada sólo en marca y títulos; reproductor portátil ovalado plateado con tapa azul translúcida y LCD frontal; playlist como pila de CDs con la portada de cada canción; disco que gira sólo durante reproducción efectiva. Sin cromo dominante ni relieves exagerados.
- La imagen del mockup aprobado no está disponible localmente; D01–D12 son la referencia escrita.

## Evidence on Hand
- Datos reales: recomendaciones, portadas, previews y motivos de recomendación desde la API propia.
- No hay testimonios, métricas de uso, logotipo final ni modelos 3D todavía; no inventarlos.

## Product Principles
1. La música primero: ninguna escena o animación retrasa poder escuchar.
2. Todo lo que hace el 3D también se puede hacer desde HTML accesible (D09).
3. El estado real del audio manda: la interfaz sólo afirma lo que el elemento de audio confirma (D05).
4. Explicar en vez de esconder: cada recomendación dice por qué está.
5. Memorable en el reproductor, sobrio y rápido en lo demás.

## Accessibility & Inclusion
Teclado y tacto completos, foco visible, nombres accesibles; `prefers-reduced-motion` sin giro continuo y con cambios de disco inmediatos; sin scroll horizontal a 360 px; navegable con zoom al 200 % (D08, D09, D11).
