const splitTargetUrls = () => Cypress.env('targetUrls')
  .split(',')
  .map((url) => url.trim())
  .filter(Boolean);

const {
  buildUiContextMapArtifact,
} = require('../../scripts/ui-context-map');

const tileSelectors = [
  '.f2ps-tile',
  '[class*="tile"]',
  '[class*="Tile"]',
  '[data-testid*="tile"]',
  '[data-testid*="Tile"]',
].join(',');

const menuButtonSelectors = [
  '#module-dropdown-button',
  '.f2ps-icon-layout-module',
  '[class*="layout-module"]',
  '.navbar-toggler',
  '[class*="navigation-menu"]',
  '[aria-label*="navigation"]',
  '[aria-label*="menu"]',
  '[aria-label*="Menu"]',
  '[title*="menu"]',
  '[title*="Menu"]',
  '[data-testid*="menu"]',
  '[data-testid*="Menu"]',
  '.navbar-toggle',
  '.hamburger',
  '.menu-toggle',
  'button[class*="menu"]',
  'button[class*="Menu"]',
].join(',');

const menuItemSelectors = [
  'a.dropdown-menu-item[href]',
  '[data-test-id*="module-dropdown"]',
  'header a[href]',
  'nav a[href]',
  '[role="menu"] a[href]',
  '[role="menuitem"] a[href]',
  '[role="navigation"] a[href]',
  '.navbar a[href]',
  '.sidebar a[href]',
  '.drawer a[href]',
  '.dropdown-menu a[href]',
  '.menu a[href]',
  '.k-menu a[href]',
  '.k-panelbar a[href]',
  '.k-link[href]',
  'aside a[href]',
  '[class*="nav"] a[href]',
  '[class*="Nav"] a[href]',
  '[class*="menu"] a[href]',
  '[class*="Menu"] a[href]',
  '[class*="option"] a[href]',
  '[class*="Option"] a[href]',
].join(',');

const homeTileSelector = () => Cypress.env('homeTileSelector') || tileSelectors;
const logicalHomeTileSelector = () => Cypress.env('logicalHomeTileSelector') || '.f2ps-tile:has(.f2ps-tile-title)';
const menuButtonSelector = () => Cypress.env('menuButtonSelector') || menuButtonSelectors;
const menuItemSelector = () => Cypress.env('menuItemSelector') || menuItemSelectors;
const loginMode = () => (Cypress.env('loginMode') || 'service').toString().toLowerCase();

const visibleElements = ($root, selector) => Cypress.$($root)
  .find(selector)
  .filter(':visible')
  .toArray();

const labelFor = (element) => {
  const $element = Cypress.$(element);
  const text = $element.text().trim().replace(/\s+/g, ' ');
  const label = element.getAttribute('aria-label') || element.getAttribute('title') || text;

  return (label || element.getAttribute('href') || element.id || element.className || element.tagName)
    .toString()
    .trim()
    .replace(/\s+/g, ' ')
    .slice(0, 120);
};

const safeName = (value) => value
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/(^-|-$)/g, '')
  .slice(0, 80) || 'page';

const consoleArtifactName = (targetUrl, testTitle) =>
  `artifacts/console/${safeName(targetUrl)}-${safeName(testTitle)}.json`;

const navigationArtifactName = (targetUrl, testTitle) =>
  `artifacts/navigation/${safeName(targetUrl)}-${safeName(testTitle)}.json`;

const uiContextMapArtifactName = (targetUrl) =>
  `artifacts/ui-context-map/${safeName(new URL(targetUrl).host)}.json`;

const slotNumbers = (count) => Array.from({ length: count }, (_, index) => index);

const numberEnv = (name, defaultValue) => {
  const value = Cypress.env(name);

  if (value === undefined || value === null || value === '') {
    return defaultValue;
  }

  return Number(value);
};

const nonNegativeIntegerEnv = (name, defaultValue) => {
  const value = numberEnv(name, defaultValue);

  if (!Number.isFinite(value)) {
    return defaultValue;
  }

  return Math.max(0, Math.floor(value));
};

const hrefFor = (element) => {
  const link = element.closest('a[href]') || element.querySelector?.('a[href]');
  return link?.getAttribute('href') || '';
};

const isSafeNavigationCandidate = (element, appOrigin) => {
  const label = labelFor(element);
  const href = hrefFor(element);

  if (/log\s*out|sign\s*out|delete|remove|archive/i.test(`${label} ${href}`)) {
    return false;
  }

  if (!href || href.startsWith('#') || /^(javascript|mailto|tel):/i.test(href)) {
    return false;
  }

  return new URL(href, appOrigin).origin === appOrigin;
};

const formatConsoleArg = (arg) => {
  if (arg instanceof Error || arg?.stack) {
    return arg.stack || arg.message;
  }

  if (typeof arg === 'string') {
    return arg;
  }

  try {
    return JSON.stringify(arg);
  } catch {
    return String(arg);
  }
};

const recordConsoleEntry = (consoleEntries, entry) => {
  consoleEntries.push({
    timestamp: new Date().toISOString(),
    ...entry,
  });
};

const captureConsole = (win, consoleEntries) => {
  ['warn', 'error'].forEach((level) => {
    const original = win.console[level];

    win.console[level] = (...args) => {
      recordConsoleEntry(consoleEntries, {
        level,
        source: `console.${level}`,
        url: win.location.href,
        message: args.map(formatConsoleArg).join(' '),
      });

      if (typeof original === 'function') {
        original.apply(win.console, args);
      }
    };
  });

  win.addEventListener('error', (event) => {
    recordConsoleEntry(consoleEntries, {
      level: 'error',
      source: 'window error',
      url: win.location.href,
      message: `${event.message || 'window error'} ${event.filename || ''}:${event.lineno || ''}`.trim(),
    });
  });

  win.addEventListener('unhandledrejection', (event) => {
    recordConsoleEntry(consoleEntries, {
      level: 'error',
      source: 'unhandled rejection',
      url: win.location.href,
      message: `Unhandled rejection: ${formatConsoleArg(event.reason)}`,
    });
  });
};

// Module-level reference required for Cypress.on('uncaught:exception'), which is registered
// at module scope and cannot close over per-test state. Updated in beforeEach/afterEach.
const uncaughtContext = { entries: null };

Cypress.on('uncaught:exception', (error) => {
  if (!uncaughtContext.entries) {
    return undefined;
  }

  recordConsoleEntry(uncaughtContext.entries, {
    level: 'error',
    source: 'uncaught exception',
    url: 'uncaught exception',
    message: `${error.name}: ${error.message}`,
  });

  return false;
});

const ERROR_PAGE_PATTERNS = [
  'An error occurred',
  'Object reference not set',
  'HTTP Error 500',
  'Application Error',
  '500 Internal Server Error',
];

const assertPageLoaded = (name) => {
  cy.location('href', { timeout: 30000 }).then((href) => {
    cy.log(`${name}: ${href}`);
  });
  cy.get('body', { timeout: 30000 })
    .should('be.visible')
    .and(($body) => {
      const text = $body.text().trim();

      expect(text, `${name} body text`).to.not.equal('');
      ERROR_PAGE_PATTERNS.forEach((pattern) => {
        expect(text, `${name} error page`).to.not.include(pattern);
      });
    });
};

const assertHomeTiles = () => {
  const minHomeTiles = numberEnv('minHomeTiles', 2);

  cy.get(homeTileSelector(), { timeout: 30000 })
    .filter(':visible')
    .should('have.length.at.least', minHomeTiles);
};

const assertLoggedInHome = (targetUrl) => {
  cy.location('pathname', { timeout: 30000 }).should('not.include', '/Account/Login');
  cy.location('hostname').should('eq', new URL(targetUrl).hostname);
  assertHomeTiles();
};

const loginThroughLogo = () => {
  cy.log('Click lower-right Floorganise logo');
  cy.get('#azure-login img[alt="Floorganise logo"]')
    .should('be.visible')
    .click({ force: true });

  cy.location('pathname', { timeout: 30000 }).should('not.include', '/Account/Login');
};

const loginThroughServiceForm = () => {
  const username = Cypress.env('serviceUsername');
  const password = Cypress.env('servicePassword');

  expect(username, 'SMOKE_SERVICE_USERNAME').to.be.a('string').and.not.equal('');
  expect(password, 'SMOKE_SERVICE_PASSWORD').to.be.a('string').and.not.equal('');

  cy.log('Log in with service credentials');
  cy.get(Cypress.env('serviceUsernameSelector'), { timeout: 30000 })
    .should('be.visible')
    .clear()
    .type(username);
  cy.get(Cypress.env('servicePasswordSelector'), { timeout: 30000 })
    .should('be.visible')
    .clear()
    .type(password, { log: false });
  cy.get(Cypress.env('serviceSubmitSelector'), { timeout: 30000 })
    .filter(':visible')
    .first()
    .click({ force: true });

  cy.location('pathname', { timeout: 30000 }).should('not.include', '/Account/Login');
};

const loginToHome = (targetUrl) => {
  // Cache the authenticated session across all tests in this spec run.
  cy.session(
    ['smoke-login', targetUrl, loginMode()],
    () => {
      cy.visit(targetUrl);
      cy.location('href', { timeout: 30000 }).should('include', '/Account/Login');
      cy.get('body').should('be.visible').and('not.be.empty');

      const mode = loginMode();
      if (mode === 'logo') {
        loginThroughLogo();
      } else if (mode === 'service') {
        loginThroughServiceForm();
      } else {
        throw new Error(`Unsupported SMOKE_LOGIN_MODE: ${Cypress.env('loginMode')}`);
      }
    },
    {
      validate() {
        cy.location('pathname').should('not.include', '/Account/Login');
      },
    },
  );

  cy.visit(new URL(targetUrl).origin + '/');
  assertLoggedInHome(targetUrl);
};

const visitHome = (homeUrl) => {
  cy.visit(homeUrl);
  assertHomeTiles();
};

const clickVisibleByIndex = (selector, index, name) => {
  cy.get(selector, { timeout: 30000 })
    .filter(':visible')
    .eq(index)
    .then(($element) => {
      cy.log(`Open ${name}: ${labelFor($element[0])}`);
      cy.wrap($element)
        .scrollIntoView()
        .click({ force: true });
    });
};

const collectTiles = (limit) => cy.get('body').then(($body) => visibleElements($body, homeTileSelector())
  .slice(0, limit)
  .map((element, index) => ({
    index,
    label: labelFor(element),
  })));

const collectLogicalHomeTiles = () => cy.get('body').then(($body) => visibleElements($body, logicalHomeTileSelector())
  .map((element, index) => {
    const $tile = Cypress.$(element);
    const abbreviation = $tile.find('.f2ps-tile-abbreviation').first().text().trim();
    const label = $tile.find('.f2ps-tile-title').first().text().trim() || labelFor(element);

    return {
      index,
      abbreviation,
      label,
    };
  }));

const openUpperLeftMenu = () => {
  cy.get('body').then(($body) => {
    const candidates = visibleElements($body, menuButtonSelector())
      .filter((element) => {
        const rect = element.getBoundingClientRect();
        return rect.left < Cypress.config('viewportWidth') / 2 &&
          rect.top < Cypress.config('viewportHeight') / 2;
      })
      .sort((left, right) => {
        const leftRect = left.getBoundingClientRect();
        const rightRect = right.getBoundingClientRect();
        return (leftRect.left + leftRect.top) - (rightRect.left + rightRect.top);
      });

    expect(
      candidates.length,
      `upper-left menu button matching ${menuButtonSelector()}`,
    ).to.be.greaterThan(0);

    cy.wrap(candidates[0])
      .scrollIntoView()
      .click({ force: true });
  });
};

const collectMenuItems = (limit, appOrigin) => cy.get('body').then(($body) => {
  const seen = new Set();

  return visibleElements($body, menuItemSelector())
    .filter((element) => isSafeNavigationCandidate(element, appOrigin))
    .map((element) => ({
      href: hrefFor(element),
      label: labelFor(element),
    }))
    .filter((item) => {
      const key = `${item.href}|${item.label}`;
      if (seen.has(key)) {
        return false;
      }

      seen.add(key);
      return true;
    })
    .slice(0, limit);
});

const clickMenuItem = (item, appOrigin) => {
  cy.get('body').then(($body) => {
    const match = visibleElements($body, menuItemSelector())
      .filter((element) => isSafeNavigationCandidate(element, appOrigin))
      .find((element) => hrefFor(element) === item.href && labelFor(element) === item.label);

    expect(match, `menu item ${item.label}`).to.exist;

    cy.log(`Open menu item: ${item.label}`);
    match.removeAttribute('target');

    cy.wrap(match)
      .scrollIntoView()
      .click({ force: true });
  });
};

const emitUiContextMapArtifact = (targetUrl, homeUrl, appOrigin, menuLimit) => {
  const entries = [];

  return collectLogicalHomeTiles().then((tiles) => {
    let chain = cy.wrap(null, { log: false });

    tiles.forEach((tile) => {
      chain = chain.then(() => {
        visitHome(homeUrl);
        clickVisibleByIndex(logicalHomeTileSelector(), tile.index, tile.label);
        assertPageLoaded(`home tile ${tile.label}`);

        return cy.location('href').then((href) => {
          entries.push({
            label: tile.label,
            abbreviation: tile.abbreviation,
            url: href,
            source: 'home-tile',
            status: 'opened',
          });
        });
      });
    });

    return chain.then(() => {
      visitHome(homeUrl);
      openUpperLeftMenu();

      return collectMenuItems(menuLimit, appOrigin).then((items) => {
        items.forEach((item) => {
          entries.push({
            label: item.label,
            href: item.href,
            url: new URL(item.href, appOrigin).href,
            source: 'menu',
            status: 'discovered',
          });
        });

        const artifact = buildUiContextMapArtifact(entries, {
          targetUrl,
          loginMode: loginMode(),
          serviceUsername: Cypress.env('serviceUsername') || null,
        });

        return cy.writeFile(uiContextMapArtifactName(targetUrl), artifact, { log: true });
      });
    });
  });
};

splitTargetUrls().forEach((targetUrl) => {
  describe(`Floor2Plan smoke test: ${targetUrl}`, () => {
    let consoleEntries;
    let navigationEntries;
    const tileSlotLimit = nonNegativeIntegerEnv('tileClickLimit', 20);
    const menuSlotLimit = nonNegativeIntegerEnv('menuClickLimit', 40);

    beforeEach(() => {
      consoleEntries = [];
      navigationEntries = [];
      uncaughtContext.entries = consoleEntries;

      cy.on('window:before:load', (win) => {
        captureConsole(win, consoleEntries);
      });
    });

    afterEach(() => {
      const consoleArtifact = consoleArtifactName(targetUrl, Cypress.currentTest.title);
      const navigationArtifact = navigationArtifactName(targetUrl, Cypress.currentTest.title);
      const consoleSettleMs = numberEnv('consoleSettleMs', 2000);

      cy.wait(consoleSettleMs);
      cy.writeFile(navigationArtifact, navigationEntries, { log: true });
      cy.writeFile(consoleArtifact, consoleEntries, { log: true })
        .then(() => {
        uncaughtContext.entries = null;

          const consoleErrors = consoleEntries.filter((entry) => entry.level === 'error');

          if (Cypress.env('failOnConsoleError') && consoleErrors.length > 0) {
            const details = consoleErrors
              .map(({ source, url, message }) => `[${source || 'error'}] ${url}\n${message}`)
              .join('\n\n');

            throw new Error(
              `${consoleErrors.length} browser error(s) were recorded. See ${consoleArtifact}.\n\n${details}`,
            );
          }
        });
    });

    it('logs in with service credentials and renders home tiles', () => {
      cy.on('fail', (error) => {
        if (error.message.includes('remote page to load')) {
          throw new Error(
            'The Floorganise logo started Azure AD navigation, but this runner does not have an authenticated Microsoft SSO session for the target application. Use SMOKE_LOGIN_MODE=service with SMOKE_SERVICE_USERNAME and SMOKE_SERVICE_PASSWORD for service login.',
          );
        }

        throw error;
      });

      loginToHome(targetUrl);
      cy.screenshot('home-tiles-rendered');
    });

    slotNumbers(tileSlotLimit).forEach((index) => {
      it(`opens home tile page ${index + 1}`, () => {
        loginToHome(targetUrl);

        cy.location('href').then((homeUrl) => {
          collectTiles(tileSlotLimit).then((tiles) => {
            const tile = tiles[index];

            if (!tile) {
              navigationEntries.push({
                type: 'tile',
                index: index + 1,
                status: 'not-found',
              });
              cy.log(`No visible home tile found at slot ${index + 1}`);
              return;
            }

            visitHome(homeUrl);
            clickVisibleByIndex(homeTileSelector(), tile.index, `tile ${tile.index + 1}`);
            assertPageLoaded(`tile ${tile.index + 1}`);
            cy.location('href').then((href) => {
              navigationEntries.push({
                type: 'tile',
                index: index + 1,
                label: tile.label,
                url: href,
                status: 'opened',
              });
            });
          });
        });
      });
    });

    if (menuSlotLimit > 0) {
      it(`opens discovered upper-left menu pages up to ${menuSlotLimit}`, () => {
        loginToHome(targetUrl);

        cy.location('href').then((homeUrl) => {
          const appOrigin = new URL(homeUrl).origin;

          openUpperLeftMenu();
          collectMenuItems(menuSlotLimit, appOrigin).then((items) => {
            expect(
              items.length,
              `upper-left menu pages matching ${menuItemSelector()}`,
            ).to.be.greaterThan(0);

            items.forEach((item, index) => {
              visitHome(homeUrl);
              openUpperLeftMenu();
              clickMenuItem(item, appOrigin);
              assertPageLoaded(`menu item ${item.label}`);
              cy.location('href').then((href) => {
                navigationEntries.push({
                  type: 'menu',
                  index: index + 1,
                  label: item.label,
                  href: item.href,
                  url: href,
                  status: 'opened',
                });
              });
            });
          });
        });

        const visualSettleMs = numberEnv('visualSettleMs', 0);
        if (visualSettleMs > 0) {
          cy.wait(visualSettleMs);
        }
      });
    }

    it('emits ui-to-context map artifact', () => {
      loginToHome(targetUrl);

      cy.location('href').then((homeUrl) => {
        const appOrigin = new URL(homeUrl).origin;
        emitUiContextMapArtifact(targetUrl, homeUrl, appOrigin, menuSlotLimit);
      });
    });
  });
});
