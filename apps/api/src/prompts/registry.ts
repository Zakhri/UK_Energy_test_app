import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export type PromptTemplate = 'system' | 'recommendations.user' | 'compare.user' | 'trends.user';

export interface PromptRegistry {
  readonly version: string;
  readonly hash: string;
  readonly render: (template: PromptTemplate, variables: Record<string, unknown>) => string;
  readonly templates: Readonly<Record<PromptTemplate, string>>;
}

const here = dirname(fileURLToPath(import.meta.url));

function loadTemplates(version: string): Record<PromptTemplate, string> {
  const directory = resolve(here, version);
  return {
    system: readFileSync(resolve(directory, 'system.md'), 'utf8'),
    'recommendations.user': readFileSync(resolve(directory, 'recommendations.user.md'), 'utf8'),
    'compare.user': readFileSync(resolve(directory, 'compare.user.md'), 'utf8'),
    'trends.user': readFileSync(resolve(directory, 'trends.user.md'), 'utf8'),
  };
}

function computeHash(templates: Record<PromptTemplate, string>): string {
  const hasher = createHash('sha256');
  for (const [name, content] of Object.entries(templates).sort()) {
    hasher.update(`${name}\n${content}\n`);
  }
  return hasher.digest('hex').slice(0, 16);
}

function renderTemplate(template: string, variables: Record<string, unknown>): string {
  return template.replace(/\{\{([\w.]+)\}\}/g, (_match, key: string) => {
    const value = resolvePath(variables, key);
    if (value === undefined || value === null) return '';
    if (typeof value === 'string') return value;
    return JSON.stringify(value);
  });
}

function resolvePath(source: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce<unknown>((current, segment) => {
    if (current == null || typeof current !== 'object') return undefined;
    return (current as Record<string, unknown>)[segment];
  }, source);
}

const cache = new Map<string, PromptRegistry>();

export function getPromptRegistry(version = process.env.PROMPT_VERSION ?? 'v1'): PromptRegistry {
  const cached = cache.get(version);
  if (cached) return cached;

  const templates = loadTemplates(version);
  const hash = computeHash(templates);
  const registry: PromptRegistry = {
    version,
    hash,
    templates,
    render: (name, variables) => renderTemplate(templates[name], variables),
  };
  cache.set(version, registry);
  return registry;
}

/** Test-only: drop the cached registry. */
export function __resetPromptRegistry(): void {
  cache.clear();
}
