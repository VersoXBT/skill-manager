import { readFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

const DEFAULT_CONFIG = Object.freeze({
  ignoredSkills: [],
  severityOverrides: {},
  thresholds: Object.freeze({
    tokenWarning: 8000,
    tokenCritical: 20000,
    duplicateLevenshtein: 0.3,
    duplicateJaccard: 0.6,
    duplicateHeading: 0.5,
    freshnessStaleMonths: 6,
  }),
  verbose: false,
  deepAnalysis: false,
});

export function getConfigPath() {
  return join(homedir(), '.claude', 'skill-manager', 'config.json');
}

export function getDataDir() {
  const dir = join(homedir(), '.claude', 'skill-manager');
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  return dir;
}

function readConfigFile() {
  const configPath = getConfigPath();
  if (!existsSync(configPath)) {
    return {};
  }
  try {
    const raw = readFileSync(configPath, 'utf-8');
    return JSON.parse(raw);
  } catch {
    process.stderr.write(`Warning: malformed config at ${configPath}, using defaults\n`);
    return {};
  }
}

function validateConfig(raw) {
  const valid = {};
  if (Array.isArray(raw.ignoredSkills)) {
    valid.ignoredSkills = [...raw.ignoredSkills];
  }
  if (raw.severityOverrides && typeof raw.severityOverrides === 'object' && !Array.isArray(raw.severityOverrides)) {
    valid.severityOverrides = { ...raw.severityOverrides };
  }
  if (raw.thresholds && typeof raw.thresholds === 'object' && !Array.isArray(raw.thresholds)) {
    const t = {};
    for (const key of Object.keys(DEFAULT_CONFIG.thresholds)) {
      if (typeof raw.thresholds[key] === 'number') {
        t[key] = raw.thresholds[key];
      }
    }
    if (Object.keys(t).length > 0) {
      valid.thresholds = t;
    }
  }
  if (typeof raw.verbose === 'boolean') valid.verbose = raw.verbose;
  if (typeof raw.deepAnalysis === 'boolean') valid.deepAnalysis = raw.deepAnalysis;
  return valid;
}

export function loadConfig(flags = {}) {
  const fileConfig = validateConfig(readConfigFile());

  const merged = {
    ...DEFAULT_CONFIG,
    ...fileConfig,
    thresholds: Object.freeze({
      ...DEFAULT_CONFIG.thresholds,
      ...(fileConfig.thresholds ?? {}),
    }),
    severityOverrides: {
      ...DEFAULT_CONFIG.severityOverrides,
      ...(fileConfig.severityOverrides ?? {}),
    },
    ignoredSkills: fileConfig.ignoredSkills ?? [...DEFAULT_CONFIG.ignoredSkills],
  };

  if (flags.verbose !== undefined) merged.verbose = Boolean(flags.verbose);
  if (flags.deep !== undefined) merged.deepAnalysis = Boolean(flags.deep);
  if (flags.json !== undefined) merged.json = Boolean(flags.json);
  if (flags.scanPath !== undefined) merged.scanPath = String(flags.scanPath);

  return Object.freeze({
    ...merged,
    thresholds: Object.freeze(merged.thresholds),
  });
}
