const path = require("path");

module.exports = {
  // Keep the downloaded browser inside the deployed backend artifact. Render's
  // home cache is not guaranteed to be the same between build and runtime.
  cacheDirectory: path.join(__dirname, ".cache", "puppeteer"),
};
