// app.json holds the config; this only adds the Firebase file (FCM, Android push) when present.
// Local: ./google-services.json (git-ignored). EAS builds: file env var GOOGLE_SERVICES_JSON.
const fs = require('fs');

module.exports = ({ config }) => {
  const file = process.env.GOOGLE_SERVICES_JSON ?? './google-services.json';
  return fs.existsSync(file)
    ? { ...config, android: { ...config.android, googleServicesFile: file } }
    : config;
};
