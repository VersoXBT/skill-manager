/**
 * Skill discovery module. Scans all known installation locations
 * and returns an array of SkillInfo objects. Zero npm dependencies.
 */
import {
  readdirSync, readFileSync, statSync, lstatSync,
  readlinkSync, realpathSync, existsSync,
} from 'node:fs';
import { join, resolve, basename, dirname } from 'node:path';
import { homedir } from 'node:os';
import { parseFrontmatter } from './frontmatter.js';

const HOME = homedir();
const SKILL_FILE = 'SKILL.md';

/** Load installed plugins registry. Returns Map<pluginKey, metadata>. */
export function loadInstalledPlugins(overridePath) {
  try {
    const p = overridePath ?? join(HOME, '.claude', 'plugins', 'installed_plugins.json');
    const data = JSON.parse(readFileSync(p, 'utf8'));
    const map = new Map();
    for (const [key, entry] of Object.entries(data.plugins ?? data)) {
      if (typeof entry === 'object' && entry !== null) {
        map.set(key, {
          version: entry.version ?? null,
          gitCommitSha: entry.gitCommitSha ?? null,
          lastUpdated: entry.lastUpdated ?? null,
          installPath: entry.installPath ?? null,
        });
      }
    }
    return map;
  } catch { return new Map(); }
}

/** Load standalone skill lock. Returns Map<skillName, metadata>. */
export function loadSkillLock(overridePath) {
  try {
    const p = overridePath ?? join(HOME, '.agents', '.skill-lock.json');
    const data = JSON.parse(readFileSync(p, 'utf8'));
    const map = new Map();
    for (const [name, entry] of Object.entries(data.skills ?? data)) {
      if (typeof entry === 'object' && entry !== null) {
        map.set(name, {
          source: entry.source ?? null,
          sourceUrl: entry.sourceUrl ?? null,
          skillFolderHash: entry.skillFolderHash ?? null,
          updatedAt: entry.updatedAt ?? null,
        });
      }
    }
    return map;
  } catch { return new Map(); }
}

/** Load known marketplaces. Returns Map<name, {source, repo}>. */
export function loadKnownMarketplaces(overridePath) {
  try {
    const p = overridePath ?? join(HOME, '.claude', 'plugins', 'known_marketplaces.json');
    const data = JSON.parse(readFileSync(p, 'utf8'));
    const map = new Map();
    for (const [name, entry] of Object.entries(data.marketplaces ?? data)) {
      if (typeof entry === 'object' && entry !== null) {
        map.set(name, {
          source: entry.source ?? null,
          repo: entry.repo ?? null,
        });
      }
    }
    return map;
  } catch { return new Map(); }
}

/** Default scan locations in priority order. */
function defaultScanLocations(cwd) {
  return [
    { path: join(HOME, '.claude', 'skills'), source: 'user-manual' },
    { path: join(HOME, '.agents', 'skills'), source: 'standalone' },
    { path: join(cwd, '.claude', 'skills'), source: 'project' },
  ];
}

/** Safely read a directory, returning [] on any error. */
function safeReaddir(dir) {
  try { return readdirSync(dir); } catch { return []; }
}

/** Safely resolve real path, returning null on error. */
function safeRealpath(p) {
  try { return realpathSync(p); } catch { return null; }
}

/** Check whether a path is a symlink. */
function isSymlinkAt(p) {
  try { return lstatSync(p).isSymbolicLink(); } catch { return false; }
}

/** Read symlink target, returning null on error. */
function safeReadlink(p) {
  try { return readlinkSync(p); } catch { return null; }
}

/** Build a SkillInfo from a SKILL.md path. Returns null on failure. */
function buildSkillInfo(skillMdPath, source, sourcePlugin, pluginMeta = {}) {
  try {
    const content = readFileSync(skillMdPath, 'utf8');
    const { frontmatter, body } = parseFrontmatter(content);
    const mtime = statSync(skillMdPath).mtime;
    const dirPath = dirname(skillMdPath);
    const charCount = content.length;
    const symlink = isSymlinkAt(dirPath);
    return {
      name: frontmatter.name || basename(dirPath),
      path: skillMdPath,
      dirPath,
      source,
      sourcePlugin,
      frontmatter,
      body,
      charCount,
      estimatedTokens: Math.ceil(charCount / 4),
      mtime,
      isSymlink: symlink,
      symlinkTarget: symlink ? safeReadlink(dirPath) : null,
      pluginVersion: pluginMeta.pluginVersion ?? null,
      marketplace: pluginMeta.marketplace ?? null,
      repositoryUrl: pluginMeta.repositoryUrl ?? null,
      installedCommitSha: pluginMeta.installedCommitSha ?? null,
      sourceUrl: pluginMeta.sourceUrl ?? null,
      skillFolderHash: pluginMeta.skillFolderHash ?? null,
      updatedAt: pluginMeta.updatedAt ?? null,
    };
  } catch {
    return null;
  }
}

/**
 * Try to register a skill SKILL.md into the seen map.
 * Handles dedup by real path, ignored-name filtering.
 */
function collectSkill(skillMd, source, sourcePlugin, seen, ignored, pluginMeta = {}) {
  if (!existsSync(skillMd)) return;
  const realPath = safeRealpath(skillMd);
  if (!realPath || seen.has(realPath)) return;
  const info = buildSkillInfo(skillMd, source, sourcePlugin, pluginMeta);
  if (!info || ignored.has(info.name)) return;
  seen.set(realPath, info);
}

/** Scan a flat skills directory for <entry>/SKILL.md. */
function scanFlatDir(basePath, source, seen, ignored) {
  for (const entry of safeReaddir(basePath)) {
    collectSkill(join(basePath, entry, SKILL_FILE), source, null, seen, ignored);
  }
}

/** Scan a flat skills directory with skill-lock enrichment. */
function scanFlatDirWithLock(basePath, source, seen, ignored, skillLock) {
  for (const entry of safeReaddir(basePath)) {
    const skillMd = join(basePath, entry, SKILL_FILE);
    const lockEntry = skillLock.get(entry);
    const meta = lockEntry ? {
      sourceUrl: lockEntry.sourceUrl,
      skillFolderHash: lockEntry.skillFolderHash,
      updatedAt: lockEntry.updatedAt,
    } : {};
    collectSkill(skillMd, source, null, seen, ignored, meta);
  }
}

/** Derive plugin metadata from nearest .claude-plugin/plugin.json, or fallback. */
function derivePluginMeta(skillDir, fallbackName) {
  try {
    let current = skillDir;
    for (let depth = 0; depth < 6; depth++) {
      const pj = join(current, '.claude-plugin', 'plugin.json');
      if (existsSync(pj)) {
        const raw = JSON.parse(readFileSync(pj, 'utf8'));
        return {
          name: raw.name ?? fallbackName,
          repositoryUrl: raw.repository ?? raw.homepage ?? null,
        };
      }
      const parent = dirname(current);
      if (parent === current) break;
      current = parent;
    }
  } catch { /* fall through */ }
  return { name: fallbackName, repositoryUrl: null };
}

/**
 * Scan plugin cache: cache/<marketplace>/<plugin>/<version>/skills/<skill>/SKILL.md
 */
function scanPluginCache(seen, ignored, installedPlugins) {
  const base = join(HOME, '.claude', 'plugins', 'cache');
  for (const marketplace of safeReaddir(base)) {
    for (const plugin of safeReaddir(join(base, marketplace))) {
      for (const version of safeReaddir(join(base, marketplace, plugin))) {
        // Skip orphaned (old) plugin versions
        if (existsSync(join(base, marketplace, plugin, version, '.orphaned_at'))) continue;
        const skillsDir = join(base, marketplace, plugin, version, 'skills');
        for (const skill of safeReaddir(skillsDir)) {
          const md = join(skillsDir, skill, SKILL_FILE);
          const derived = derivePluginMeta(join(skillsDir, skill), plugin);
          const pluginKey = `${plugin}@${marketplace}`;
          const installed = installedPlugins.get(pluginKey);
          const pluginMeta = {
            pluginVersion: installed?.version ?? null,
            marketplace,
            installedCommitSha: installed?.gitCommitSha ?? null,
            updatedAt: installed?.lastUpdated ?? null,
            repositoryUrl: derived.repositoryUrl,
          };
          collectSkill(md, 'plugin-cache', derived.name, seen, ignored, pluginMeta);
        }
      }
    }
  }
}

/**
 * Scan plugin marketplaces:
 * marketplaces/<marketplace>/plugins/<plugin>/skills/<skill>/SKILL.md
 */
function scanPluginMarketplace(seen, ignored, installedPlugins) {
  const base = join(HOME, '.claude', 'plugins', 'marketplaces');
  for (const marketplace of safeReaddir(base)) {
    const pluginsDir = join(base, marketplace, 'plugins');
    for (const plugin of safeReaddir(pluginsDir)) {
      const skillsDir = join(pluginsDir, plugin, 'skills');
      for (const skill of safeReaddir(skillsDir)) {
        const md = join(skillsDir, skill, SKILL_FILE);
        const derived = derivePluginMeta(join(skillsDir, skill), plugin);
        const pluginKey = `${plugin}@${marketplace}`;
        const installed = installedPlugins.get(pluginKey);
        const pluginMeta = {
          pluginVersion: installed?.version ?? null,
          marketplace,
          installedCommitSha: installed?.gitCommitSha ?? null,
          updatedAt: installed?.lastUpdated ?? null,
          repositoryUrl: derived.repositoryUrl,
        };
        collectSkill(md, 'plugin-marketplace', derived.name, seen, ignored, pluginMeta);
      }
    }
  }
}

/**
 * Discover all skills across installation locations.
 * @param {object} [config]
 * @param {string[]} [config.scanPaths] - if provided, scan ONLY these paths
 * @param {string[]} [config.ignoredSkills] - skill names to skip
 * @returns {object[]} array of SkillInfo objects, sorted alphabetically by name
 */
export function discoverSkills(config = {}) {
  const seen = new Map();
  const ignored = new Set(config.ignoredSkills ?? []);

  if (config.scanPaths) {
    for (const scanPath of config.scanPaths) {
      scanFlatDir(resolve(scanPath), 'user-manual', seen, ignored);
    }
  } else {
    const cwd = process.cwd();
    const installedPlugins = loadInstalledPlugins();
    const skillLock = loadSkillLock();
    for (const { path: loc, source } of defaultScanLocations(cwd)) {
      if (source === 'standalone') {
        scanFlatDirWithLock(loc, source, seen, ignored, skillLock);
      } else {
        scanFlatDir(loc, source, seen, ignored);
      }
    }
    scanPluginCache(seen, ignored, installedPlugins);
    scanPluginMarketplace(seen, ignored, installedPlugins);
  }

  const results = [...seen.values()];
  results.sort((a, b) => a.name.localeCompare(b.name));
  return results;
}
