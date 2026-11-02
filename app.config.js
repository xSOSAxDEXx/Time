// Extends app.json. EXPO_BASE_URL lets the web build live under a sub-path,
// e.g. "/Time" for GitHub Pages (https://<user>.github.io/Time/). Leave it
// unset everywhere else (native builds and local web builds use "/").
module.exports = ({ config }) => ({
  ...config,
  experiments: {
    ...config.experiments,
    ...(process.env.EXPO_BASE_URL ? { baseUrl: process.env.EXPO_BASE_URL } : {}),
  },
});
