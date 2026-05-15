#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import {apps, rootDir} from './app-catalog.mjs';

const requiredStringFields = ['id', 'badge', 'title', 'purpose', 'studentLine', 'aiSource', 'fallback', 'startUrl'];
const requiredArrayFields = ['steps', 'hardware', 'proof', 'screenshots'];
const screenshotDir = path.join(rootDir, 'assets', 'screenshots');
const failures = [];

for (const app of apps) {
  const roles = app.studentRoles ?? [];
  if (roles.length !== 3) {
    failures.push(`${app.id}: expected exactly 3 studentRoles, got ${roles.length}`);
  }
  for (const [index, role] of roles.entries()) {
    if (typeof role !== 'string' || !role.trim()) {
      failures.push(`${app.id}: studentRoles[${index}] must be a non-empty string`);
    }
  }

  const routes = app.demoRoutes ?? [];
  if (routes.length !== 3) {
    failures.push(`${app.id}: expected 3 demoRoutes, got ${routes.length}`);
  }

  for (const route of routes) {
    for (const field of requiredStringFields) {
      if (!route[field] || typeof route[field] !== 'string') {
        failures.push(`${app.id}/${route.id ?? 'unknown'}: missing string field ${field}`);
      }
    }
    for (const field of requiredArrayFields) {
      if (!Array.isArray(route[field]) || route[field].length === 0) {
        failures.push(`${app.id}/${route.id ?? 'unknown'}: missing array field ${field}`);
      }
    }
    if ((route.steps ?? []).length < 4) {
      failures.push(`${app.id}/${route.id}: route needs at least 4 steps`);
    }
    if ((route.screenshots ?? []).length < 3) {
      failures.push(`${app.id}/${route.id}: route needs at least 3 screenshots`);
    }
    for (const screenshot of route.screenshots ?? []) {
      const screenshotPath = path.join(screenshotDir, screenshot);
      if (!fs.existsSync(screenshotPath)) {
        failures.push(`${app.id}/${route.id}: missing screenshot ${screenshot}`);
      }
    }
  }
}

if (failures.length) {
  console.error('Demo route check failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('Demo route check passed.');
