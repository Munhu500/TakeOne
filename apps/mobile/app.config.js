// Extends app.json. The static preview (Hostinger) serves the web build from /app, so only that build sets a base URL.
module.exports = ({ config }) => ({
  ...config,
  experiments: { ...(config.experiments ?? {}), ...(process.env.EXPO_PUBLIC_STATIC_PREVIEW === 'true' ? { baseUrl: '/app' } : {}) },
});
