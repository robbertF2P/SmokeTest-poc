'use strict';

const assert = require('node:assert/strict');
const {
  mapUrlToContexts,
  buildUiContextMapArtifact,
  normalizeNavigationLabel,
} = require('./ui-context-map');

const cases = [
  {
    url: 'https://example.com/Pbs/Planning/#/Project/2',
    primary: 'PBS',
  },
  {
    url: 'https://example.com/Hr/ClockingTerminal#/PunchManagement',
    primary: 'DEVICES',
  },
  {
    url: 'https://example.com/Do/EmployeeTimesheet#/tasks/allocated',
    primary: 'TIMESHEETS',
  },
  {
    url: 'https://example.com/Ticket/Index#/',
    primary: 'TICKETS',
  },
  {
    url: 'https://example.com/Check/Reports',
    primary: 'REPORTING',
  },
  {
    url: 'https://example.com/Sync/ImportExport',
    primary: 'SYNC',
  },
];

for (const testCase of cases) {
  const mapping = mapUrlToContexts(testCase.url);
  assert.equal(mapping.primary, testCase.primary, testCase.url);
}

const artifact = buildUiContextMapArtifact([
  {
    label: 'Pr Projects',
    abbreviation: 'Pr',
    url: 'https://example.com/Pbs/Planning/#/Project/2',
    source: 'home-tile',
    status: 'opened',
  },
  {
    label: 'f2ps-tile-content',
    url: 'https://example.com/Pbs/Planning/#/Project/2',
    source: 'home-tile',
    status: 'opened',
  },
  {
    label: 'Budgets',
    href: '/Do/Reporter#/budget',
    url: 'https://example.com/Do/Reporter#/budget',
    source: 'menu',
    status: 'discovered',
  },
], {
  targetUrl: 'https://example.com/Account/Login',
  generatedAt: '2026-06-24T00:00:00.000Z',
});

assert.equal(normalizeNavigationLabel('Pr Projects'), 'Projects');
assert.equal(artifact.summary.pageCount, 2);
assert.equal(artifact.pages[0].label, 'Projects');
assert.equal(artifact.pages[0].primaryContext.label, 'PBS');
assert.equal(artifact.pages[1].label, 'Budgets');

console.log('ui-context-map.js: all assertions passed');
