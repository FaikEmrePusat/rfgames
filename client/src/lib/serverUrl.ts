/** Dev: localhost API. Prod (unset VITE_SERVER_URL): same origin for single-service deploy. */
export const SERVER_URL =
  import.meta.env.VITE_SERVER_URL ??
  (import.meta.env.PROD ? window.location.origin : 'http://localhost:3001');
