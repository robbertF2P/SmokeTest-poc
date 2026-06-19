const { defineConfig } = require('cypress');

const defaultTargetUrl = 'https://2025-14-patch.floor2plan.com/Account/Login';

const replaceBrowserArg = (args, name, value) => {
  const prefix = `${name}=`;
  const index = args.findIndex((arg) => arg.startsWith(prefix));

  if (index >= 0) {
    args[index] = `${prefix}${value}`;
  } else {
    args.push(`${prefix}${value}`);
  }
};

module.exports = defineConfig({
  e2e: {
    specPattern: 'cypress/e2e/**/*.cy.js',
    supportFile: false,
    defaultCommandTimeout: 10000,
    pageLoadTimeout: Number(process.env.CYPRESS_PAGE_LOAD_TIMEOUT || 60000),
    retries: {
      runMode: 1,
      openMode: 0,
    },
    setupNodeEvents(on) {
      on('before:browser:launch', (browser, launchOptions) => {
        const edgeUserDataDir = process.env.CYPRESS_EDGE_USER_DATA_DIR;
        const edgeProfileDirectory = process.env.CYPRESS_EDGE_PROFILE_DIRECTORY;

        if (browser.family === 'chromium' && browser.name === 'edge' && edgeUserDataDir) {
          replaceBrowserArg(launchOptions.args, '--user-data-dir', edgeUserDataDir);
        }

        if (browser.family === 'chromium' && browser.name === 'edge' && edgeProfileDirectory) {
          replaceBrowserArg(launchOptions.args, '--profile-directory', edgeProfileDirectory);
        }

        return launchOptions;
      });
    },
  },
  env: {
    targetUrls: process.env.TARGET_URLS || process.env.TARGET_URL || defaultTargetUrl,
    homeTileSelector: process.env.SMOKE_HOME_TILE_SELECTOR || '',
    minHomeTiles: Number(process.env.SMOKE_MIN_HOME_TILES || 2),
    visualSettleMs: Number(process.env.SMOKE_VISUAL_SETTLE_MS || 0),
    tileClickLimit: Number(process.env.SMOKE_TILE_CLICK_LIMIT || 20),
    menuClickLimit: Number(process.env.SMOKE_MENU_CLICK_LIMIT || 40),
    menuButtonSelector: process.env.SMOKE_MENU_BUTTON_SELECTOR || '',
    menuItemSelector: process.env.SMOKE_MENU_ITEM_SELECTOR || '',
    failOnConsoleError: process.env.SMOKE_FAIL_ON_CONSOLE_ERROR !== 'false',
    loginMode: process.env.SMOKE_LOGIN_MODE || 'service',
    serviceUsername: process.env.SMOKE_SERVICE_USERNAME || '',
    servicePassword: process.env.SMOKE_SERVICE_PASSWORD || '',
    serviceUsernameSelector: process.env.SMOKE_SERVICE_USERNAME_SELECTOR || '#userName',
    servicePasswordSelector: process.env.SMOKE_SERVICE_PASSWORD_SELECTOR || '#password',
    serviceSubmitSelector: process.env.SMOKE_SERVICE_SUBMIT_SELECTOR || 'form.login button[type="submit"], button[type="submit"]',
  },
  screenshotsFolder: 'artifacts/screenshots',
  videosFolder: 'artifacts/videos',
  video: true,
  viewportWidth: Number(process.env.CYPRESS_VIEWPORT_WIDTH || 1280),
  viewportHeight: Number(process.env.CYPRESS_VIEWPORT_HEIGHT || 720),
});
