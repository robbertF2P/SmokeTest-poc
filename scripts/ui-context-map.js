'use strict';

const BOUNDED_CONTEXT_MAP_DOC = 'docs/Modularization/02-bounded-context-map.md';

const CONTEXTS = {
  PBS: { id: 1, name: 'Planning & Resource Management', label: 'PBS' },
  WORKFORCE: { id: 2, name: 'Workforce & Organization', label: 'Workforce' },
  TIMESHEETS: { id: 3, name: 'Timekeeping & Work Hours', label: 'Timesheets' },
  DEVICES: { id: 4, name: 'Devices & Shop Floor Clocking', label: 'Devices' },
  TICKETS: { id: 5, name: 'Workflow & Ticketing', label: 'Tickets' },
  SYNC: { id: 6, name: 'Synchronization & Import Pipeline', label: 'Sync' },
  SYSTEM: { id: 7, name: 'System Administration & Infrastructure', label: 'System' },
  REPORTING: { id: null, name: 'Reporting', label: 'Reporting' },
  SHELL: { id: null, name: 'Application Shell', label: 'Shell' },
  IDENTITY: { id: null, name: 'Identity', label: 'Identity' },
};

/** @typedef {{ id: number|null, name: string, label: string }} ContextRef */

/**
 * @typedef {Object} RouteMapping
 * @property {keyof typeof CONTEXTS} primary
 * @property {(keyof typeof CONTEXTS)[]} [secondary]
 * @property {string} [mvcArea]
 * @property {string} [notes]
 */

/** @type {Array<{ test: (pathname: string, hash: string) => boolean } & RouteMapping>} */
const ROUTE_RULES = [
  {
    test: (pathname) => /^\/Account\/Login\b/i.test(pathname),
    primary: 'IDENTITY',
    secondary: ['SYSTEM'],
    mvcArea: 'Root',
    notes: 'Authentication entry point',
  },
  {
    test: (pathname, hash) => pathname === '/' && !hash,
    primary: 'SHELL',
    mvcArea: 'Root',
    notes: 'Cross-context home launcher',
  },
  {
    test: (pathname) => /^\/Sync\b/i.test(pathname),
    primary: 'SYNC',
    mvcArea: 'Sync',
  },
  {
    test: (pathname) => /^\/System\b/i.test(pathname),
    primary: 'SYSTEM',
    mvcArea: 'System',
  },
  {
    test: (pathname) => /^\/Devices\b/i.test(pathname),
    primary: 'DEVICES',
    mvcArea: 'Devices',
  },
  {
    test: (pathname) => /^\/Ticket\b/i.test(pathname),
    primary: 'TICKETS',
    secondary: ['PBS', 'WORKFORCE'],
    mvcArea: 'Ticket',
  },
  {
    test: (pathname) => /^\/Hr\/ClockingTerminal\b/i.test(pathname),
    primary: 'DEVICES',
    secondary: ['WORKFORCE'],
    mvcArea: 'HR',
    notes: 'Clocking terminal and punch management',
  },
  {
    test: (pathname) => /^\/Hr\b/i.test(pathname),
    primary: 'WORKFORCE',
    secondary: ['TIMESHEETS', 'DEVICES'],
    mvcArea: 'HR',
  },
  {
    test: (pathname) => /^\/GeneralSettings\b/i.test(pathname),
    primary: 'WORKFORCE',
    secondary: ['SYSTEM'],
    mvcArea: 'Root',
    notes: 'Person/org administration via settings shell',
  },
  {
    test: (pathname) => /^\/Select\/Organisation\b/i.test(pathname),
    primary: 'WORKFORCE',
    secondary: ['SYSTEM'],
    mvcArea: 'Root',
    notes: 'Organisation scope selector',
  },
  {
    test: (pathname) => /^\/PBS\/Settings\b/i.test(pathname) || /^\/Pbs\/Settings\b/i.test(pathname),
    primary: 'SYSTEM',
    secondary: ['PBS'],
    mvcArea: 'Pbs',
  },
  {
    test: (pathname) => /^\/floorspace\b/i.test(pathname),
    primary: 'PBS',
    secondary: ['WORKFORCE'],
    mvcArea: 'FloorSpace',
  },
  {
    test: (pathname) => /^\/Pbs\b/i.test(pathname),
    primary: 'PBS',
    secondary: ['WORKFORCE'],
    mvcArea: 'Pbs',
  },
  {
    test: (pathname) => /^\/Do\/Planboard\b/i.test(pathname),
    primary: 'PBS',
    secondary: ['WORKFORCE'],
    mvcArea: 'Do',
  },
  {
    test: (pathname) => /^\/Do\/Floorboard\b/i.test(pathname),
    primary: 'PBS',
    secondary: ['DEVICES', 'TIMESHEETS'],
    mvcArea: 'Do',
    notes: 'Shop-floor integration surface',
  },
  {
    test: (pathname) => /^\/Do\/EmployeeTimesheet\b/i.test(pathname),
    primary: 'TIMESHEETS',
    secondary: ['PBS'],
    mvcArea: 'Do',
    notes: 'Manager hours-and-progress view',
  },
  {
    test: (pathname) => /^\/Do\/Weeklytimesheet\b/i.test(pathname),
    primary: 'TIMESHEETS',
    secondary: ['WORKFORCE'],
    mvcArea: 'Do',
  },
  {
    test: (pathname, hash) => /^\/Do\/Reporter\b/i.test(pathname) && /budget/i.test(hash),
    primary: 'PBS',
    mvcArea: 'Do',
  },
  {
    test: (pathname) => /^\/Do\/Reporter\b/i.test(pathname),
    primary: 'PBS',
    secondary: ['TIMESHEETS'],
    mvcArea: 'Do',
    notes: 'Activity/task reporting',
  },
  {
    test: (pathname) => /^\/Do\/CorrectionTimesheet\b/i.test(pathname),
    primary: 'TIMESHEETS',
    mvcArea: 'Do',
  },
  {
    test: (pathname) => /^\/Check\/ErpWeeklytimesheet\b/i.test(pathname),
    primary: 'TIMESHEETS',
    secondary: ['REPORTING'],
    mvcArea: 'Check',
    notes: 'ERP timesheet administration',
  },
  {
    test: (pathname) => /^\/Check\/ErpCorrectionTimesheet\b/i.test(pathname),
    primary: 'TIMESHEETS',
    secondary: ['REPORTING'],
    mvcArea: 'Check',
  },
  {
    test: (pathname) => /^\/Check\/KPI\b/i.test(pathname),
    primary: 'PBS',
    secondary: ['REPORTING'],
    mvcArea: 'Check',
  },
  {
    test: (pathname) => /^\/Check\/Reports\b/i.test(pathname),
    primary: 'REPORTING',
    mvcArea: 'Check',
  },
  {
    test: (pathname) => /^\/Check\b/i.test(pathname),
    primary: 'REPORTING',
    mvcArea: 'Check',
  },
  {
    test: (pathname) => /^\/Do\b/i.test(pathname),
    primary: 'PBS',
    secondary: ['TIMESHEETS'],
    mvcArea: 'Do',
  },
];

/** Contexts documented in the monolith but often permission-gated on home/menu. */
const CONTEXTS_NOT_TYPically_IN_NAV = [
  {
    context: CONTEXTS.SYNC,
    exampleRoutes: ['/Sync/', '/Sync/ImportExport'],
    mvcArea: 'Sync',
  },
  {
    context: CONTEXTS.SYSTEM,
    exampleRoutes: ['/System/'],
    mvcArea: 'System',
  },
  {
    context: CONTEXTS.DEVICES,
    exampleRoutes: ['/Devices/'],
    mvcArea: 'Devices',
  },
  {
    context: CONTEXTS.WORKFORCE,
    exampleRoutes: ['/HR/PersonBalance', '/HR/BalancePolicy'],
    mvcArea: 'HR',
    notes: 'Balance and schedule admin pages',
  },
  {
    context: CONTEXTS.PBS,
    exampleRoutes: ['/Pbs/Project', '/Pbs/Activity', '/Pbs/Person'],
    mvcArea: 'Pbs',
    notes: 'Master-data CRUD controllers',
  },
  {
    context: CONTEXTS.REPORTING,
    exampleRoutes: ['/Check/KPI', '/Check/ReportDesigner'],
    mvcArea: 'Check',
  },
];

/**
 * @param {string} url
 * @returns {{ pathname: string, hash: string, route: string }}
 */
function parseRoute(url) {
  const parsed = new URL(url);
  const pathname = parsed.pathname.replace(/\/+$/, '') || '/';
  const hash = parsed.hash || '';
  const route = `${pathname}${hash}`;

  return { pathname, hash, route };
}

/**
 * @param {string} url
 * @returns {RouteMapping}
 */
function mapUrlToContexts(url) {
  const { pathname, hash } = parseRoute(url);
  const rule = ROUTE_RULES.find((candidate) => candidate.test(pathname, hash));

  if (!rule) {
    return {
      primary: 'SHELL',
      secondary: [],
      mvcArea: 'Unknown',
      notes: 'No route rule matched',
    };
  }

  return {
    primary: rule.primary,
    secondary: rule.secondary || [],
    mvcArea: rule.mvcArea,
    notes: rule.notes,
  };
}

/**
 * @param {RouteMapping} mapping
 * @returns {{ primaryContext: ContextRef, secondaryContexts: ContextRef[], mvcArea?: string, notes?: string }}
 */
function toContextFields(mapping) {
  return {
    primaryContext: CONTEXTS[mapping.primary],
    secondaryContexts: (mapping.secondary || []).map((key) => CONTEXTS[key]),
    mvcArea: mapping.mvcArea,
    notes: mapping.notes,
  };
}

/**
 * @param {string} label
 * @returns {boolean}
 */
function isNoiseNavigationLabel(label) {
  return !label ||
    label === 'f2ps-tile-content' ||
    /^(Pr|Ac|Hp|Fb|Pm|Hr|Ts|Ta|Ti)$/i.test(label);
}

/**
 * @param {string} label
 * @returns {string}
 */
function normalizeNavigationLabel(label) {
  const trimmed = label.trim().replace(/\s+/g, ' ');

  if (/^\/\S+$/.test(trimmed)) {
    return trimmed
      .replace(/^\//, '')
      .split('/')
      .filter(Boolean)
      .join(' ');
  }

  const abbrevMatch = trimmed.match(/^([A-Z][a-z])\s+(.+)$/);
  if (abbrevMatch) {
    return abbrevMatch[2].trim();
  }

  return trimmed;
}

/**
 * @param {Array<{ label?: string, abbreviation?: string, route?: string, href?: string, url?: string, source: string, status?: string }>} entries
 * @param {{ targetUrl: string, generatedAt?: string, loginMode?: string, serviceUsername?: string }} meta
 */
function buildUiContextMapArtifact(entries, meta) {
  const generatedAt = meta.generatedAt || new Date().toISOString();
  const target = new URL(meta.targetUrl);
  const seen = new Map();

  for (const entry of entries) {
    if (entry.status === 'not-found') {
      continue;
    }

    const label = normalizeNavigationLabel(entry.label || '');
    if (isNoiseNavigationLabel(label)) {
      continue;
    }

    const url = entry.url || entry.href || '';
    if (!url) {
      continue;
    }

    const { route } = parseRoute(url);
    const dedupeKey = label.toLowerCase();

    if (seen.has(dedupeKey)) {
      const existing = seen.get(dedupeKey);
      if (!existing.sources.includes(entry.source)) {
        existing.sources.push(entry.source);
      }

      const preferCandidate = (
        (entry.source === 'home-tile' && !existing.sources.includes('home-tile')) ||
        (url.includes('#') && !existing.url.includes('#')) ||
        (entry.abbreviation && !existing.abbreviation)
      );

      if (preferCandidate) {
        existing.url = url;
        existing.route = route;
        existing.abbreviation = entry.abbreviation || existing.abbreviation;
        Object.assign(existing, toContextFields(mapUrlToContexts(url)));
      }

      continue;
    }

    const mapping = mapUrlToContexts(url);

    seen.set(dedupeKey, {
      label,
      abbreviation: entry.abbreviation || null,
      route,
      url,
      sources: [entry.source],
      ...toContextFields(mapping),
    });
  }

  const pages = Array.from(seen.values()).sort((left, right) => {
    const sourceOrder = (page) => (page.sources.includes('home-tile') ? 0 : 1);
    const bySource = sourceOrder(left) - sourceOrder(right);
    if (bySource !== 0) {
      return bySource;
    }

    return left.label.localeCompare(right.label);
  });

  return {
    schemaVersion: 1,
    generatedAt,
    targetUrl: meta.targetUrl,
    host: target.host,
    loginMode: meta.loginMode || null,
    serviceUsername: meta.serviceUsername || null,
    boundedContextMapDoc: BOUNDED_CONTEXT_MAP_DOC,
    summary: {
      pageCount: pages.length,
      homeTileCount: pages.filter((page) => page.sources.includes('home-tile')).length,
      menuOnlyCount: pages.filter((page) => page.sources.includes('menu') && !page.sources.includes('home-tile')).length,
    },
    pages,
    contextsNotInNavigation: CONTEXTS_NOT_TYPically_IN_NAV,
  };
}

module.exports = {
  BOUNDED_CONTEXT_MAP_DOC,
  CONTEXTS,
  ROUTE_RULES,
  parseRoute,
  mapUrlToContexts,
  toContextFields,
  isNoiseNavigationLabel,
  normalizeNavigationLabel,
  buildUiContextMapArtifact,
};
