import { describe, expect, it } from 'vitest';
import contract from './aria-contract.json';

type ContractVariant = {
  name: string;
  query?: string;
};

type ContractStory = {
  id: string;
  title: string;
  tags: string[];
  variants?: ContractVariant[];
};

type ContractShape = {
  description: string;
  owner: string;
  failOnImpact: string[];
  axe: {
    runOnly?: {
      type: string;
      values: string[];
    };
    rules?: Record<string, { enabled: boolean }>;
  };
  stories: ContractStory[];
};

const typedContract = contract as ContractShape;

describe('Accessibility contract configuration', () => {
  it('declares a contract owner and description', () => {
    expect(typedContract.description).toMatch(/contract/i);
    expect(typedContract.owner).toMatch(/Design System/i);
  });

  it('enforces fail-on impacts for serious issues', () => {
    const impacts = new Set(typedContract.failOnImpact);
    expect(impacts.has('serious')).toBe(true);
    expect(impacts.has('critical')).toBe(true);
  });

  it('targets WCAG 2.1 AA rules via axe runOnly tags', () => {
    const runOnly = typedContract.axe?.runOnly;
    expect(runOnly?.type).toBe('tag');
    expect(runOnly?.values).toEqual(expect.arrayContaining(['wcag2a', 'wcag21aa']));
  });

  it('provides a curated set of stories with tagged variants', () => {
    expect(Array.isArray(typedContract.stories)).toBe(true);
    expect(typedContract.stories.length).toBeGreaterThanOrEqual(6);

    for (const story of typedContract.stories) {
      expect(story.id).toMatch(/^[a-z0-9-]+--[a-z0-9-]+$/);
      expect(story.title.length).toBeGreaterThan(0);
      expect(story.tags.length).toBeGreaterThanOrEqual(2);

      const variants = story.variants ?? [];
      expect(variants.length).toBeGreaterThan(0);
      for (const variant of variants) {
        expect(variant.name.length).toBeGreaterThan(0);
        if (variant.query) {
          expect(variant.query.startsWith('&')).toBe(false);
          expect(variant.query.startsWith('?')).toBe(false);
          expect(variant.query).toMatch(/globals=theme:(light|dark)/);
        }
      }
    }
  });
});
