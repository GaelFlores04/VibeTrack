export const pageLoaders = {
  '/': () => import('../features/home/HomePage'),
  '/moods': () => import('../features/moods/MoodsPage'),
  '/explorar': () => import('../features/explore/ExplorePage'),
  '/recomendaciones': () => import('../features/recommendations/RecommendationsPage'),
  '/estado': () => import('../features/status/StatusPage'),
  '/login': () => import('../features/auth/AuthPage'),
  '/registro': () => import('../features/auth/AuthPage'),
  '/preferencias': () => import('../features/auth/PreferencesPage'),
  '/cuenta': () => import('../features/auth/AccountPage'),
};

export function preloadPage(path) {
  const route = path.startsWith('/recomendaciones/') ? '/recomendaciones' : path;
  // La navegación real conserva su manejo de errores si falla la precarga.
  void pageLoaders[route]?.().catch(() => {});
}
