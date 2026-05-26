import { describe, expect, it } from 'vitest';

import { __resetPromptRegistry, getPromptRegistry } from '../../src/prompts/registry.js';

describe('PromptRegistry', () => {
  it('loads v1 templates and produces a stable hash', () => {
    __resetPromptRegistry();
    const registry = getPromptRegistry('v1');
    expect(registry.version).toBe('v1');
    expect(registry.hash).toMatch(/^[0-9a-f]{16}$/);
    expect(registry.templates.system).toContain('UK Energy Advisor');
    expect(registry.templates['recommendations.user']).toContain('{{goal}}');
  });

  it('caches the registry so repeat lookups produce identical hash', () => {
    const a = getPromptRegistry('v1');
    const b = getPromptRegistry('v1');
    expect(a.hash).toBe(b.hash);
  });

  it('renders mustache-style variables including nested paths', () => {
    const registry = getPromptRegistry('v1');
    const rendered = registry.render('compare.user', {
      goal: 'ev-charge',
      region: 'GB-LON',
      weights: { carbon: 0.6, cost: 0.3, speed: 0.1 },
      scenariosJson: '[{"id":"a"}]',
      contextJson: '{"carbon":{}}',
    });
    expect(rendered).toContain('Goal: ev-charge');
    expect(rendered).toContain('Region: GB-LON');
    expect(rendered).toContain('carbon=0.6');
  });

  it('substitutes empty string for missing variables (no leaking braces)', () => {
    const registry = getPromptRegistry('v1');
    const rendered = registry.render('recommendations.user', {
      goal: 'general',
      region: 'GB-LON',
      kwhRequired: 1,
      preferences: '',
      contextJson: '{}',
    });
    expect(rendered).not.toContain('{{');
  });
});
