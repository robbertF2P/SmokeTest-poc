#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { URL } = require('url');
const { schemaForSample } = require('./utils');

const DEFAULT_TARGET = 'https://2025-14-patch.floor2plan.com/Account/Login'; // Keep in sync with cypress.config.js defaultTargetUrl
const OUTPUT_DIR = path.join(__dirname, '..', 'artifacts', 'api-discovery');

const targetUrl = process.env.TARGET_URL || process.env.TARGET_URLS?.split(',')[0]?.trim() || DEFAULT_TARGET;
const baseUrl = new URL(targetUrl).origin;
const username = process.env.SMOKE_SERVICE_USERNAME;
const password = process.env.SMOKE_SERVICE_PASSWORD;

if (!username || !password) {
  console.error('Error: SMOKE_SERVICE_USERNAME and SMOKE_SERVICE_PASSWORD must be set.');
  process.exit(1);
}

const HTML_EXCLUDE_PATTERNS = [
  /viewtemplate/i,
  /\/views\//i,
  /\/templates\//i,
  /\/static\//i,
  /\/assets\//i,
  /\/dist\/.*\.css/i,
  /\.(js|css|png|svg|woff2?|ico|map)(\?|$)/i,
  /\/account\/login/i,
  /\/account\/logout/i,
  /\/select\/organisation/i,
  /\/changeculture/i,
  /\/file\/clientlogo/i,
];

const PATH_PATTERNS = [
  /["'`](\/(?:api|do|pbs|hr|plan|check|sync|ticket|file|general|select|newsfeed|floorspace|system-administration|optionlist|event|structure|allocation|personmanagement)[^"'`\s]{1,120})["'`]/gi,
  /(?:url|transport\.read|transport\.create|transport\.update|transport\.destroy)\s*:\s*["'`](\/[^"'`\s]{2,120})["'`]/gi,
  /\$http\.(?:get|post|put|patch|delete)\(\s*["'`](\/[^"'`\s]{2,120})["'`]/gi,
  /fetch\(\s*["'`](\/[^"'`\s]{2,120})["'`]/gi,
  /(?:^|[^A-Za-z0-9_/])(Do|Pbs|Hr|HR|Plan|Check|Sync|Ticket|File|General|api|OptionList|Event|Structure|Allocation|PersonManagement|NewsFeed)\/[A-Za-z0-9_/]+/g,
];

function normalizeCandidate(raw) {
  let value = raw.trim();
  if (!value.startsWith('/')) {
    value = `/${value}`;
  }

  value = value
    .replace(/\$\{[^}]+\}/g, '{param}')
    .replace(/\{[a-zA-Z0-9_]+\}/g, '{param}')
    .replace(/\?.*$/, '')
    .replace(/#.*$/, '')
    .replace(/\/+/g, '/');

  if (value.length < 2 || value.length > 160) {
    return null;
  }

  if (HTML_EXCLUDE_PATTERNS.some((pattern) => pattern.test(value))) {
    return null;
  }

  return value;
}

function extractPathsFromText(text) {
  const paths = new Set();

  for (const pattern of PATH_PATTERNS) {
    pattern.lastIndex = 0;
    let match = pattern.exec(text);
    while (match) {
      const candidate = normalizeCandidate(match[1] || match[0]);
      if (candidate) {
        paths.add(candidate);
      }
      match = pattern.exec(text);
    }
  }

  return paths;
}

function extractLinks(html) {
  const links = new Set();
  const hrefPattern = /href="([^"]+)"/gi;
  let match = hrefPattern.exec(html);
  while (match) {
    try {
      const url = new URL(match[1], baseUrl);
      if (url.origin === baseUrl && !url.hash.startsWith('#/')) {
        links.add(`${url.pathname}${url.search}`);
      }
    } catch {
      // ignore invalid URLs
    }
    match = hrefPattern.exec(html);
  }
  return links;
}

function extractBundleUrls(html) {
  const bundles = new Set();
  const scriptPattern = /src="([^"]+\.js[^"]*)"/gi;
  let match = scriptPattern.exec(html);
  while (match) {
    try {
      const url = new URL(match[1], baseUrl);
      if (url.origin === baseUrl) {
        bundles.add(url.pathname);
      }
    } catch {
      // ignore invalid URLs
    }
    match = scriptPattern.exec(html);
  }
  return bundles;
}

function parseSetCookie(headers) {
  const cookies = new Map();
  const raw = headers.getSetCookie?.() || [];

  for (const entry of raw) {
    const [pair] = entry.split(';');
    const [name, ...rest] = pair.split('=');
    cookies.set(name.trim(), rest.join('=').trim());
  }

  return cookies;
}

function cookieHeader(cookies) {
  return [...cookies.entries()].map(([name, value]) => `${name}=${value}`).join('; ');
}

async function fetchText(url, cookies, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      cookie: cookieHeader(cookies),
      ...(options.headers || {}),
    },
    redirect: options.redirect || 'follow',
  });

  for (const [name, value] of parseSetCookie(response.headers)) {
    cookies.set(name, value);
  }

  const text = await response.text();
  return { response, text };
}

async function login(cookies) {
  const loginUrl = targetUrl.includes('/Account/Login')
    ? targetUrl
    : `${baseUrl}/Account/Login`;

  const { text: loginHtml } = await fetchText(loginUrl, cookies);
  const tokenMatch = loginHtml.match(/name="__RequestVerificationToken"[^>]*value="([^"]+)"/i);
  if (!tokenMatch) {
    throw new Error('Could not find anti-forgery token on login page');
  }

  const body = new URLSearchParams({
    userName: username,
    password,
    __RequestVerificationToken: tokenMatch[1],
  });

  const { response } = await fetchText(loginUrl, cookies, {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
    },
    body,
    redirect: 'manual',
  });

  const location = response.headers.get('location');
  if (response.status === 302 && location && !location.includes('/Account/Login')) {
    await fetchText(new URL(location, baseUrl).toString(), cookies);
    return;
  }

  if (!response.url.includes('/Account/Login')) {
    return;
  }

  throw new Error(`Login failed; status ${response.status}, location ${location || 'none'}`);
}

function inferMethods(endpointPath) {
  const lower = endpointPath.toLowerCase();
  if (lower.includes('/delete') || lower.endsWith('/destroy')) {
    return ['DELETE'];
  }
  if (lower.includes('/upload') || lower.includes('/create') || lower.includes('/add') || lower.includes('/approve') || lower.includes('/decline') || lower.includes('/reschedule') || lower.includes('/persist') || lower.includes('/import')) {
    return ['POST'];
  }
  if (lower.includes('/update') || lower.includes('/save') || lower.includes('/set')) {
    return ['PUT', 'POST'];
  }
  if (lower.startsWith('/api/')) {
    return ['GET', 'POST'];
  }
  return ['GET', 'POST'];
}

function toOpenApiPath(endpointPath) {
  return endpointPath.replace(/\{param\}/g, '{id}');
}

async function probeEndpoint(endpointPath, cookies) {
  const methods = inferMethods(endpointPath);
  const results = [];

  for (const method of methods) {
    const url = `${baseUrl}${endpointPath}`;
    try {
      const response = await fetch(url, {
        method,
        headers: {
          cookie: cookieHeader(cookies),
          accept: 'application/json, text/plain, */*',
        },
        redirect: 'manual',
      });

      const contentType = response.headers.get('content-type') || '';
      const status = response.status;
      const bodyText = await response.text();
      const isHtml = contentType.includes('text/html') || bodyText.trimStart().startsWith('<!');
      const isJson = contentType.includes('json') || (bodyText.trim().startsWith('{') || bodyText.trim().startsWith('['));

      if (isHtml) {
        results.push({ method, status, kind: 'html', contentType });
        continue;
      }

      let sample;
      if (isJson && bodyText.trim()) {
        try {
          sample = JSON.parse(bodyText);
        } catch {
          sample = undefined;
        }
      }

      results.push({
        method,
        status,
        kind: isJson ? 'json' : 'other',
        contentType,
        sample: sample !== undefined ? sample : bodyText.slice(0, 240),
      });
    } catch (error) {
      results.push({ method, kind: 'error', error: error.message });
    }
  }

  const jsonMethods = results.filter((entry) => entry.kind === 'json');
  if (jsonMethods.length === 0) {
    return null;
  }

  return {
    path: endpointPath,
    operations: jsonMethods,
  };
}

function buildOpenApi(discovered) {
  const paths = {};

  for (const endpoint of discovered) {
    const openApiPath = toOpenApiPath(endpoint.path);
    paths[openApiPath] = paths[openApiPath] || {};

    for (const operation of endpoint.operations) {
      const method = operation.method.toLowerCase();
      if (paths[openApiPath][method]) {
        continue;
      }

      paths[openApiPath][method] = {
        summary: `${operation.method} ${endpoint.path}`,
        tags: [endpoint.path.split('/').filter(Boolean)[0] || 'root'],
        responses: {
          [String(operation.status)]: {
            description: operation.contentType || 'JSON response',
            content: operation.sample !== undefined
              ? {
                  'application/json': {
                    schema: schemaForSample(operation.sample),
                    example: operation.sample,
                  },
                }
              : undefined,
          },
        },
      };
    }
  }

  return {
    openapi: '3.0.3',
    info: {
      title: 'Floor2Plan API',
      description: 'Discovered JSON API endpoints from the Floor2Plan smoke-test target. HTML template routes and static assets are excluded.',
      version: '2025.14',
    },
    servers: [{ url: baseUrl }],
    tags: [...new Set(Object.values(paths).flatMap((item) => Object.values(item).map((op) => op.tags[0])))].map((name) => ({ name })),
    paths,
  };
}

async function main() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const cookies = new Map();
  const discoveredPaths = new Set();
  const visitedPages = new Set();
  const bundlePaths = new Set();

  console.log(`Logging in to ${baseUrl} as ${username}`);
  await login(cookies);

  const seedPages = ['/', '/Do/Reporter', '/Do/Floorboard', '/Do/Planboard', '/Pbs/Planning', '/Sync/Index', '/GeneralSettings', '/Newsfeed', '/Plan/Holiday', '/Ticket/Index', '/Check/Reports', '/Do/EmployeeTimesheet', '/Do/Weeklytimesheet', '/Hr/ClockingTerminal', '/floorspace', '/system-administration'];
  const queue = [...seedPages];

  while (queue.length > 0 && visitedPages.size < 40) {
    const pagePath = queue.shift();
    if (visitedPages.has(pagePath)) {
      continue;
    }
    visitedPages.add(pagePath);

    const { text: html, response } = await fetchText(`${baseUrl}${pagePath}`, cookies);
    if (!response.ok && response.status >= 400) {
      continue;
    }

    for (const link of extractLinks(html)) {
      if (!visitedPages.has(link) && !HTML_EXCLUDE_PATTERNS.some((pattern) => pattern.test(link))) {
        queue.push(link);
      }
    }

    for (const bundle of extractBundleUrls(html)) {
      bundlePaths.add(bundle);
    }

    for (const endpoint of extractPathsFromText(html)) {
      discoveredPaths.add(endpoint);
    }
  }

  console.log(`Downloading ${bundlePaths.size} JavaScript bundles`);
  for (const bundlePath of bundlePaths) {
    const { text } = await fetchText(`${baseUrl}${bundlePath}`, cookies);
    for (const endpoint of extractPathsFromText(text)) {
      discoveredPaths.add(endpoint);
    }
  }

  const candidatePaths = [...discoveredPaths].sort();
  fs.writeFileSync(path.join(OUTPUT_DIR, 'candidate-paths.json'), JSON.stringify(candidatePaths, null, 2));

  console.log(`Probing ${candidatePaths.length} candidate endpoints`);
  const discovered = [];
  const skipped = [];

  for (const endpointPath of candidatePaths) {
    const result = await probeEndpoint(endpointPath, cookies);
    if (result) {
      discovered.push(result);
    } else {
      skipped.push(endpointPath);
    }
  }

  fs.writeFileSync(path.join(OUTPUT_DIR, 'discovered-endpoints.json'), JSON.stringify(discovered, null, 2));
  fs.writeFileSync(path.join(OUTPUT_DIR, 'skipped-paths.json'), JSON.stringify(skipped, null, 2));

  console.log(`Wrote ${discovered.length} JSON endpoints to ${path.join(OUTPUT_DIR, 'discovered-endpoints.json')}`);
  console.log(`Skipped ${skipped.length} HTML or non-JSON paths`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
