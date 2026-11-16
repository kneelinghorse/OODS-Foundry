/**
 * s249-m03 (Interface 10): the declared order every renderer and generated store reads. The status select offers the
 * current state and its allowed moves, and the refusals say in plain words why a move is not taken.
 */
import { describe, expect, it } from 'vitest';
import { declaredActionRefusal, declaredMoveRefusal, finalStateRefusal, isFinalState, statusOptionsInOrder } from '../src/state-order.js';

// Grant's declared order (objects/core/Grant.object.yaml).
const GRANT = {
  requested: ['active', 'declined', 'withdrawn', 'expired'],
  active: ['paused', 'revoked', 'expired', 'replaced'],
  paused: ['active', 'revoked', 'expired', 'replaced'],
  revoked: [], expired: [], replaced: [], declined: [], withdrawn: [],
};
const STATES = ['requested', 'active', 'paused', 'revoked', 'expired', 'replaced', 'declined', 'withdrawn'];
const OPTIONS = STATES.map(value => ({ value, label: value.charAt(0).toUpperCase() + value.slice(1) }));
const grant = { object: 'grant' };

describe('statusOptionsInOrder', () => {
  it('offers the current state and the moves the order allows, in the order given', () => {
    expect(statusOptionsInOrder(OPTIONS, 'active', GRANT).map(option => option.value)).toEqual(['active', 'paused', 'revoked', 'expired', 'replaced']);
    expect(statusOptionsInOrder(OPTIONS, 'requested', GRANT).map(option => option.value)).toEqual(['requested', 'active', 'expired', 'declined', 'withdrawn']);
    expect(statusOptionsInOrder(OPTIONS, 'paused', GRANT).map(option => option.value)).toEqual(['active', 'paused', 'revoked', 'expired', 'replaced']);
  });

  it('offers a final record only its own state', () => {
    for (const state of ['revoked', 'expired', 'replaced', 'declined', 'withdrawn']) {
      expect(statusOptionsInOrder(OPTIONS, state, GRANT).map(option => option.value)).toEqual([state]);
    }
  });

  it('reads plain states and records keyed by id as well as by value', () => {
    expect(statusOptionsInOrder(STATES, 'revoked', GRANT)).toEqual(['revoked']);
    expect(statusOptionsInOrder([{ id: 'paused' }, { id: 'requested' }], 'active', GRANT)).toEqual([{ id: 'paused' }]);
  });

  it('keeps every option for a state the order does not name, and for no state at all', () => {
    expect(statusOptionsInOrder(OPTIONS, 'archived', GRANT)).toEqual(OPTIONS);
    expect(statusOptionsInOrder(OPTIONS, undefined, GRANT)).toEqual(OPTIONS);
    expect(statusOptionsInOrder(OPTIONS, '', GRANT)).toEqual(OPTIONS);
  });
});

describe('the refusals', () => {
  // s249-m05 (the fresh read): the refusals name the status as a label, so every state reads ("needs input", "used").
  it('refuses a move out of a final state, saying that status is final', () => {
    expect(declaredMoveRefusal(GRANT, 'revoked', 'active', grant)).toBe('This grant\'s status is Revoked, and that status is final.');
    expect(declaredMoveRefusal(GRANT, 'expired', 'requested', grant)).toBe('This grant\'s status is Expired, and that status is final.');
    expect(finalStateRefusal('taken_back', { object: 'approval' })).toBe('This approval\'s status is Taken back, and that status is final.');
    expect(finalStateRefusal('handed_over', { object: 'task', labels: { handed_over: 'Handed over' } })).toBe('This task\'s status is Handed over, and that status is final.');
  });

  it('refuses a move the order does not allow, naming the moves it does', () => {
    expect(declaredMoveRefusal(GRANT, 'active', 'requested', grant)).toBe('This grant\'s status is Active; from there it moves only to Paused, Revoked, Expired or Replaced.');
    expect(declaredMoveRefusal(GRANT, 'requested', 'paused', grant)).toBe('This grant\'s status is Requested; from there it moves only to Active, Declined, Withdrawn or Expired.');
    expect(declaredMoveRefusal({ not_started: ['working'] }, 'not_started', 'finished', { object: 'task', labels: { not_started: 'Not started', working: 'Working' } }))
      .toBe('This task\'s status is Not started; from there it moves only to Working.');
  });

  it('allows every move the order lists, a record that stays where it is, and a state the order does not name', () => {
    for (const [from, targets] of Object.entries(GRANT)) for (const to of targets) expect(declaredMoveRefusal(GRANT, from, to, grant), `${from} to ${to}`).toBeUndefined();
    for (const state of STATES) expect(declaredMoveRefusal(GRANT, state, state, grant)).toBeUndefined();
    expect(declaredMoveRefusal(GRANT, 'archived', 'active', grant)).toBeUndefined();
  });

  it('says what a declared action is for when a record is in a state it does not move from', () => {
    const revoke = { verb: 'Revoke', from: ['active', 'paused'] };
    const resume = { verb: 'Resume', from: ['paused'] };
    expect(declaredActionRefusal(resume, 'active', GRANT, grant)).toBe('This grant\'s status is Active; Resume is for a grant whose status is Paused.');
    expect(declaredActionRefusal(revoke, 'requested', GRANT, grant)).toBe('This grant\'s status is Requested; Revoke is for a grant whose status is Active or Paused.');
    expect(declaredActionRefusal(revoke, 'revoked', GRANT, grant)).toBe('This grant\'s status is Revoked, and that status is final.');
    expect(declaredActionRefusal(revoke, 'active', GRANT, grant)).toBeUndefined();
    expect(declaredActionRefusal(resume, 'paused', GRANT, grant)).toBeUndefined();
  });

  it('knows a final state', () => {
    expect(isFinalState(GRANT, 'revoked')).toBe(true);
    expect(isFinalState(GRANT, 'paused')).toBe(false);
    expect(isFinalState(GRANT, 'archived')).toBe(false);
  });
});
