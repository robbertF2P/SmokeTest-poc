const splitTargetUrls = () => Cypress.env('targetUrls')
  .split(',')
  .map((url) => url.trim())
  .filter(Boolean);

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
].join(',');

const menuItemSelectors = [
  'a.dropdown-menu-item[href]',
  '[data-test-id*="module-dropdown"]',
  'header a[href]',
  'nav a[href]',
].join(',');

const homeTileSelector = () => Cypress.env('homeTileSelector') || tileSelectors;
const loginMode = () => (Cypress.env('loginMode') || 'service').toString().toLowerCase();

const numberEnv = (name, defaultValue) => {
  const value = Cypress.env(name);
  if (value === undefined || value === null || value === '') {
    return defaultValue;
  }
  return Number(value);
};

const isHtmlResponse = (headers, body) => {
  const contentType = (headers['content-type'] || headers['Content-Type'] || '').toLowerCase();
  if (contentType.includes('text/html')) {
    return true;
  }
  const text = typeof body === 'string' ? body.trim() : '';
  return text.startsWith('<!') || text.startsWith('<html');
};

const isStaticAsset = (url) => /\.(js|css|png|svg|woff2?|ico|map|jpeg|jpg|gif)(\?|$)/i.test(url)
  || /\/(static|assets|dist)\//i.test(url);

const isTemplateEndpoint = (url) => /viewtemplate|\/views\/|\/templates\//i.test(url);

const isExcludedApi = (url, contentType = '') => {
  if (/\/account\/login/i.test(url)) {
    return true;
  }
  if (/\/v2\/track/i.test(url) || url.startsWith('//')) {
    return true;
  }
  if (/\/file\/(clientlogo|clientbackground|thumbnail)/i.test(url)) {
    return true;
  }
  if ((contentType || '').startsWith('image/')) {
    return true;
  }
  return false;
};

const truncate = (value, max = 4000) => {
  if (value === undefined || value === null) {
    return value;
  }
  const text = typeof value === 'string' ? value : JSON.stringify(value);
  return text.length > max ? `${text.slice(0, max)}…` : text;
};

const parseBody = (body) => {
  if (!body || typeof body !== 'string') {
    return body;
  }
  const trimmed = body.trim();
  if (!trimmed) {
    return '';
  }
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      return JSON.parse(trimmed);
    } catch {
      return trimmed;
    }
  }
  return trimmed;
};

const loginThroughServiceForm = (targetUrl) => {
  const username = Cypress.env('serviceUsername');
  const password = Cypress.env('servicePassword');

  expect(username, 'SMOKE_SERVICE_USERNAME').to.be.a('string').and.not.equal('');
  expect(password, 'SMOKE_SERVICE_PASSWORD').to.be.a('string').and.not.equal('');

  cy.visit(targetUrl);
  cy.get(Cypress.env('serviceUsernameSelector'), { timeout: 30000 }).clear().type(username);
  cy.get(Cypress.env('servicePasswordSelector'), { timeout: 30000 }).clear().type(password, { log: false });
  cy.get(Cypress.env('serviceSubmitSelector'), { timeout: 30000 }).filter(':visible').first().click({ force: true });
  cy.location('pathname', { timeout: 30000 }).should('not.include', '/Account/Login');
  cy.location('hostname').should('eq', new URL(targetUrl).hostname);
};

splitTargetUrls().forEach((targetUrl) => {
  const appOrigin = new URL(targetUrl).origin;
  const homeUrl = `${appOrigin}/`;

  describe(`Floor2Plan API capture: ${targetUrl}`, () => {
    const capturedRequests = [];

    beforeEach(() => {
      capturedRequests.length = 0;

      cy.intercept({ url: '**', middleware: true }, (req) => {
        req.continue((res) => {
          const absoluteUrl = new URL(req.url);
          const path = `${absoluteUrl.pathname}${absoluteUrl.search}`;

          if (isStaticAsset(path) || isTemplateEndpoint(path) || isExcludedApi(path, res.headers['content-type'])) {
            return;
          }

          let responseBody = res.body;
          if (typeof responseBody !== 'string' && responseBody !== undefined) {
            try {
              responseBody = JSON.stringify(responseBody);
            } catch {
              responseBody = String(responseBody);
            }
          }

          if (isHtmlResponse(res.headers, responseBody)) {
            return;
          }

          capturedRequests.push({
            method: req.method,
            path,
            status: res.statusCode,
            contentType: res.headers['content-type'] || res.headers['Content-Type'] || '',
            requestBody: truncate(req.body),
            responseBody: truncate(parseBody(responseBody)),
          });
        });
      });
    });

    after(() => {
      const artifact = `artifacts/api-discovery/${new URL(targetUrl).hostname}-captured-requests.json`;
      cy.writeFile(artifact, capturedRequests, { log: true });
    });

    it('captures JSON API traffic during smoke navigation', () => {
      if (loginMode() !== 'service') {
        throw new Error('API capture requires SMOKE_LOGIN_MODE=service');
      }

      loginThroughServiceForm(targetUrl);

      const tileLimit = numberEnv('tileClickLimit', 6);
      const menuLimit = numberEnv('menuClickLimit', 10);

      cy.get(homeTileSelector(), { timeout: 30000 }).filter(':visible').then(($tiles) => {
        const count = Math.min($tiles.length, tileLimit);
        for (let index = 0; index < count; index += 1) {
          cy.visit(homeUrl);
          cy.get(homeTileSelector()).filter(':visible').eq(index).click({ force: true });
          cy.get('body', { timeout: 30000 }).should('be.visible');
          cy.wait(1500);
        }
      });

      cy.visit(homeUrl);
      cy.get(menuButtonSelectors, { timeout: 30000 }).filter(':visible').first().click({ force: true });
      cy.get(menuItemSelectors, { timeout: 30000 }).filter(':visible').then(($items) => {
        const seen = new Set();
        const items = [];

        $items.each((_, element) => {
          const href = element.getAttribute('href') || '';
          const label = (element.textContent || '').trim();
          if (!href || href.startsWith('#') || /logout|delete/i.test(`${label} ${href}`)) {
            return;
          }
          const key = `${href}|${label}`;
          if (seen.has(key) || items.length >= menuLimit) {
            return;
          }
          seen.add(key);
          items.push({ href, label });
        });

        items.forEach((item) => {
          cy.visit(homeUrl);
          cy.get(menuButtonSelectors).filter(':visible').first().click({ force: true });
          cy.contains(menuItemSelectors, item.label).filter(':visible').first().click({ force: true });
          cy.get('body', { timeout: 30000 }).should('be.visible');
          cy.wait(1500);
        });
      });
    });
  });
});
