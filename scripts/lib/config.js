import { readFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

const DEFAULT_CONFIG = Object.freeze({
  ignoredSkills: [],
  verbose: false,
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
  if (!existsSync(configPath)) return {};
  try {
    return JSON.parse(readFileSync(configPath, 'utf-8'));
  } catch {
    return {};
  }
}

export function loadConfig(flags = {}) {
  const fileConfig = readConfigFile();

  const merged = {
    ...DEFAULT_CONFIG,
    ignoredSkills: fileConfig.ignoredSkills ?? [...DEFAULT_CONFIG.ignoredSkills],
  };

  if (flags.verbose !== undefined) merged.verbose = Boolean(flags.verbose);
  if (flags.json !== undefined) merged.json = Boolean(flags.json);
  if (flags.scanPath !== undefined) merged.scanPath = String(flags.scanPath);

  return Object.freeze(merged);
}
