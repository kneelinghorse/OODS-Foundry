import { describe, expect, it } from 'vitest';
import {
  ORCA_ROLES_EXPLICITLY_HANDLED,
  ORCA_ROLES_S40_NEW,
  ORCA_ROLE_FALLBACK_INTENT,
  isKnownOrcaRole,
  resolveRoleToIntent,
} from './orca-role-mapper.js';

describe('orca-role-mapper', () => {
  describe('observed roles from linear.app (S38/S39)', () => {
    const cases: Array<[string, string]> = [
      ['button', 'action-button'],
      ['card', 'data-display'],
      ['list', 'data-list'],
      ['navigation', 'navigation-panel'],
      ['input', 'form-input'],
      ['section', 'data-display'],
      ['aside', 'metadata-display'],
      ['dialog', 'data-display'],
      ['form', 'form-input'],
      ['header', 'page-header'],
      ['main', 'data-display'],
      ['article', 'data-display'],
      ['footer', 'metadata-display'],
      ['unknown', 'data-display'],
    ];

    it.each(cases)('maps role "%s" to intent "%s" without fallback', (role, intent) => {
      const result = resolveRoleToIntent(role);
      expect(result.intent).toBe(intent);
      expect(result.fallback).toBe(false);
      expect(result.role).toBe(role);
      expect(result.reason).toMatch(/ORCA/);
    });
  });

  describe('observed post-S40 vocabulary (linear.app 5e3a5dbf / stripe.com 09145d03)', () => {
    const cases: Array<[string, string]> = [
      ['text', 'data-display'],
      ['data-display', 'data-display'],
      ['form-control', 'form-input'],
      ['badge', 'status-indicator'],
      ['link', 'action-button'],
      ['action', 'action-button'],
    ];

    it.each(cases)('maps post-S40 role "%s" to intent "%s" without fallback', (role, intent) => {
      const result = resolveRoleToIntent(role);
      expect(result.intent).toBe(intent);
      expect(result.fallback).toBe(false);
      expect(result.role).toBe(role);
    });
  });

  describe('Stage1 S40 Strategy 1d new role values', () => {
    it('handles `page` explicitly (no silent drop)', () => {
      const result = resolveRoleToIntent('page');
      expect(result.intent).toBe('data-display');
      expect(result.fallback).toBe(false);
      expect(result.role).toBe('page');
      expect(result.reason).toContain('top-level route container');
    });

    it('handles `svg-primitive` explicitly (no silent drop)', () => {
      const result = resolveRoleToIntent('svg-primitive');
      expect(result.intent).toBe('data-display');
      expect(result.fallback).toBe(false);
      expect(result.role).toBe('svg-primitive');
      expect(result.reason).toContain('decorative glyph');
    });

    it('handles extended `media` explicitly (no silent drop)', () => {
      const result = resolveRoleToIntent('media');
      expect(result.intent).toBe('data-display');
      expect(result.fallback).toBe(false);
      expect(result.role).toBe('media');
      expect(result.reason).toContain('image/video');
    });

    it('exposes the S40 additions list for downstream contract tests', () => {
      expect(ORCA_ROLES_S40_NEW).toEqual(['page', 'svg-primitive', 'media']);
      for (const role of ORCA_ROLES_S40_NEW) {
        expect(isKnownOrcaRole(role)).toBe(true);
      }
    });
  });

  describe('fallback behavior', () => {
    it('returns fallback intent when role is null', () => {
      const result = resolveRoleToIntent(null);
      expect(result.intent).toBe(ORCA_ROLE_FALLBACK_INTENT);
      expect(result.fallback).toBe(true);
      expect(result.role).toBeNull();
    });

    it('returns fallback intent when role is undefined', () => {
      const result = resolveRoleToIntent(undefined);
      expect(result.intent).toBe(ORCA_ROLE_FALLBACK_INTENT);
      expect(result.fallback).toBe(true);
      expect(result.role).toBeNull();
    });

    it('returns fallback intent for empty / whitespace-only role', () => {
      for (const raw of ['', '   ', '\t', '\n']) {
        const result = resolveRoleToIntent(raw);
        expect(result.intent).toBe(ORCA_ROLE_FALLBACK_INTENT);
        expect(result.fallback).toBe(true);
        expect(result.role).toBeNull();
      }
    });

    it('returns fallback intent and surfaces the raw role when unknown', () => {
      const result = resolveRoleToIntent('widget-of-holding');
      expect(result.intent).toBe(ORCA_ROLE_FALLBACK_INTENT);
      expect(result.fallback).toBe(true);
      expect(result.role).toBe('widget-of-holding');
      expect(result.reason).toContain('widget-of-holding');
    });

    it('normalizes role via trim + lowercase before lookup', () => {
      const result = resolveRoleToIntent('  Button  ');
      expect(result.intent).toBe('action-button');
      expect(result.fallback).toBe(false);
      expect(result.role).toBe('button');
    });
  });

  describe('isKnownOrcaRole', () => {
    it('returns true for every explicitly handled role', () => {
      for (const role of ORCA_ROLES_EXPLICITLY_HANDLED) {
        expect(isKnownOrcaRole(role)).toBe(true);
      }
    });

    it('returns false for unknown or missing roles', () => {
      expect(isKnownOrcaRole(null)).toBe(false);
      expect(isKnownOrcaRole(undefined)).toBe(false);
      expect(isKnownOrcaRole('')).toBe(false);
      expect(isKnownOrcaRole('not-a-role')).toBe(false);
    });

    it('is case/whitespace-insensitive', () => {
      expect(isKnownOrcaRole(' CARD ')).toBe(true);
      expect(isKnownOrcaRole('Svg-Primitive')).toBe(true);
    });
  });

  describe('contract surface', () => {
    it('covers every S40-new role in the handler table', () => {
      for (const role of ORCA_ROLES_S40_NEW) {
        expect(ORCA_ROLES_EXPLICITLY_HANDLED).toContain(role);
      }
    });

    it('returns an intent string for every explicitly handled role', () => {
      for (const role of ORCA_ROLES_EXPLICITLY_HANDLED) {
        const result = resolveRoleToIntent(role);
        expect(result.fallback).toBe(false);
        expect(result.intent.length).toBeGreaterThan(0);
      }
    });

    it('never returns null intent and never throws', () => {
      const exotic = [null, undefined, '', '???', 'role with spaces', '🔥'];
      for (const input of exotic) {
        const result = resolveRoleToIntent(input as string | null | undefined);
        expect(typeof result.intent).toBe('string');
        expect(result.intent.length).toBeGreaterThan(0);
      }
    });
  });
});
