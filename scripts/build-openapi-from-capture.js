#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { schemaForSample, parseBody } = require('./utils');

const CAPTURE_DIR = path.join(__dirname, '..', 'artifacts', 'api-discovery');
const OPENAPI_PATH = path.join(__dirname, '..', 'swagger', 'openapi.json');
const baseUrl = process.env.TARGET_URL
  ? new URL(process.env.TARGET_URL).origin
  : 'https://2025-14-patch.floor2plan.com';

function shouldIncludeCapture(entry) {
  if (isExcludedPath(entry.path, entry.contentType)) {
    return false;
  }
  const contentType = (entry.contentType || '').toLowerCase();
  return contentType.includes('json') || typeof entry.responseBody === 'object';
}

function isExcludedPath(endpointPath, contentType = '') {
  if (!endpointPath || endpointPath.startsWith('//')) {
    return true;
  }
  if (/\/account\/login/i.test(endpointPath)) {
    return true;
  }
  if (/\/v2\/track/i.test(endpointPath)) {
    return true;
  }
  if (/\/file\/(clientlogo|clientbackground|thumbnail)/i.test(endpointPath) || endpointPath === '/File') {
    return true;
  }
  if ((contentType || '').startsWith('image/')) {
    return true;
  }
  return false;
}

function toOpenApiPath(endpointPath) {
  const [pathname, query] = endpointPath.split('?');
  const normalized = pathname.replace(/\/\d+(?=\/|$)/g, '/{id}');
  return query ? `${normalized}?${query}` : normalized;
}

function loadStaticDiscovery() {
  const staticPath = path.join(CAPTURE_DIR, 'discovered-endpoints.json');
  if (!fs.existsSync(staticPath)) {
    return [];
  }

  return JSON.parse(fs.readFileSync(staticPath, 'utf8')).flatMap((endpoint) =>
    endpoint.operations.map((operation) => ({
      method: operation.method,
      path: endpoint.path,
      status: operation.status,
      contentType: operation.contentType,
      requestBody: '',
      responseBody: operation.sample,
    })),
  );
}

function loadCaptures() {
  if (!fs.existsSync(CAPTURE_DIR)) {
    return loadStaticDiscovery();
  }

  const captured = fs.readdirSync(CAPTURE_DIR)
    .filter((name) => name.endsWith('-captured-requests.json'))
    .flatMap((name) => JSON.parse(fs.readFileSync(path.join(CAPTURE_DIR, name), 'utf8')));

  return [...captured, ...loadStaticDiscovery()];
}

function buildOpenApi(captures) {
  const paths = {};

  for (const entry of captures) {
    if (!shouldIncludeCapture(entry)) {
      continue;
    }

    const method = entry.method.toLowerCase();
    const openApiPath = toOpenApiPath(entry.path);
    paths[openApiPath] = paths[openApiPath] || {};

    if (paths[openApiPath][method]) {
      continue;
    }

    const tag = entry.path.split('/').filter(Boolean)[0] || 'root';
    const requestBody = entry.requestBody && entry.requestBody !== ''
      ? {
          content: {
            'application/json': {
              schema: schemaForSample(parseBody(entry.requestBody)),
              example: parseBody(entry.requestBody),
            },
          },
        }
      : undefined;

    paths[openApiPath][method] = {
      summary: `${entry.method} ${entry.path}`,
      tags: [tag],
      requestBody,
      responses: {
        [String(entry.status)]: {
          description: entry.contentType || 'Captured JSON response',
          content: {
            'application/json': {
              schema: schemaForSample(entry.responseBody),
              example: entry.responseBody,
            },
          },
        },
      },
    };
  }

  return {
    openapi: '3.0.3',
    info: {
      title: 'Floor2Plan API',
      description: 'OpenAPI document generated from Floor2Plan smoke-test API capture. HTML template routes and static assets are excluded.',
      version: '2025.14',
    },
    servers: [{ url: baseUrl }],
    tags: [...new Set(Object.values(paths).flatMap((ops) => Object.values(ops).map((op) => op.tags[0])))].map((name) => ({ name })),
    paths,
  };
}

function main() {
  const captures = loadCaptures();
  if (captures.length === 0) {
    console.error('No capture files found. Run npm run capture:api first.');
    process.exit(1);
  }

  fs.mkdirSync(path.dirname(OPENAPI_PATH), { recursive: true });
  const openapi = buildOpenApi(captures);
  fs.writeFileSync(OPENAPI_PATH, JSON.stringify(openapi, null, 2));
  console.log(`Wrote ${Object.keys(openapi.paths).length} paths from ${captures.length} captured requests to ${OPENAPI_PATH}`);
}

main();
