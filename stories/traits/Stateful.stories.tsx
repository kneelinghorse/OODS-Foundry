/**
 * Stateful Trait — State Machine Demo
 *
 * This story demonstrates the Stateful trait which provides:
 * Lifecycle state management with defined transitions.
 *
 * KEY DISTINCTION:
 * - Statusable: "How does it LOOK?" (status → tone → visual)
 * - Stateful: "What can it DO next?" (state → valid transitions)
 *
 * Navigation order follows learning progression:
 * 1. Overview - What is this? How does it differ from Statusable?
 * 2. State Diagram - Visual proof (state nodes + transition arrows)
 * 3. State Gallery - Visual treatment of each state
 * 4. How It Works - The transition flow
 */

import React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { Badge } from '../../src/components/base/Badge.js';
import { STATEFUL_STATES } from '../../traits/lifecycle/Stateful.trait.js';

/* ─────────────────────────────────────────────────────────────────────────────
 * Style constants (consistent with other trait stories)
 * ───────────────────────────────────────────────────────────────────────────── */

const STYLES = {
  page: {
    padding: '2rem',
    maxWidth: '1000px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
  },
  heading: {
    marginTop: 0,
    marginBottom: '0.5rem',
  },
  subheading: {
    color: '#666',
    marginTop: 0,
    marginBottom: '2rem',
    fontWeight: 400 as const,
  },
  section: {
    marginBottom: '3rem',
  },
  groupLabel: {
    fontSize: '0.75rem',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.1em',
    color: '#888',
    marginBottom: '0.75rem',
    fontWeight: 600 as const,
  },
  card: {
    padding: '1.5rem',
    borderRadius: '0.75rem',
    border: '1px solid #e0e0e0',
    background: '#fafafa',
  },
  codeBlock: {
    padding: '1rem',
    borderRadius: '0.5rem',
    background: '#1e1e1e',
    color: '#d4d4d4',
    fontFamily: 'ui-monospace, monospace',
    fontSize: '0.875rem',
    lineHeight: 1.6,
    overflow: 'auto' as const,
  },
} as const;

/* ─────────────────────────────────────────────────────────────────────────────
 * State configuration for demo
 * ───────────────────────────────────────────────────────────────────────────── */

type StateConfig = {
  name: string;
  label: string;
  description: string;
  tone: 'info' | 'success' | 'warning' | 'neutral';
  category: 'initial' | 'active' | 'terminal';
};

const STATE_CONFIG: Record<string, StateConfig> = {
  draft: {
    name: 'draft',
    label: 'Draft',
    description: 'Initial state - entity is being prepared',
    tone: 'info',
    category: 'initial',
  },
  active: {
    name: 'active',
    label: 'Active',
    description: 'Entity is live and operational',
    tone: 'success',
    category: 'active',
  },
  paused: {
    name: 'paused',
    label: 'Paused',
    description: 'Temporarily suspended, can be resumed',
    tone: 'warning',
    category: 'active',
  },
  archived: {
    name: 'archived',
    label: 'Archived',
    description: 'Terminal state - entity is no longer active',
    tone: 'neutral',
    category: 'terminal',
  },
};

type Transition = {
  from: string;
  to: string;
  action: string;
  description: string;
};

const VALID_TRANSITIONS: Transition[] = [
  { from: 'draft', to: 'active', action: 'activate', description: 'Publish or launch the entity' },
  { from: 'active', to: 'paused', action: 'pause', description: 'Temporarily suspend activity' },
  { from: 'paused', to: 'active', action: 'resume', description: 'Restore to active state' },
  { from: 'active', to: 'archived', action: 'archive', description: 'Permanently deactivate' },
  { from: 'paused', to: 'archived', action: 'archive', description: 'Archive from paused state' },
];

/* ─────────────────────────────────────────────────────────────────────────────
 * 1. OVERVIEW — What is Stateful? How does it differ from Statusable?
 * ───────────────────────────────────────────────────────────────────────────── */

function OverviewStory(): JSX.Element {
  return (
    <div style={STYLES.page}>
      <h1 style={STYLES.heading}>Stateful</h1>
      <h2 style={STYLES.subheading}>
        Lifecycle state machine with defined transitions
      </h2>

      <section style={STYLES.section}>
        <p style={{ fontSize: '1.125rem', lineHeight: 1.7, marginBottom: '2rem' }}>
          Stateful provides a <strong>state machine</strong> that controls what an object can do next.
          Unlike Statusable (which is about display), Stateful governs behavior: which transitions are
          valid from the current state.
        </p>

        {/* Statusable vs Stateful comparison */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '2rem' }}>
          <div style={{ ...STYLES.card, borderColor: '#c4b5fd', background: '#f5f3ff' }}>
            <h3 style={{ marginTop: 0, color: '#6d28d9', fontSize: '0.875rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Statusable
            </h3>
            <p style={{ marginBottom: '1rem', fontStyle: 'italic', color: '#555' }}>
              "How does it look?"
            </p>
            <ul style={{ margin: 0, paddingLeft: '1.25rem', lineHeight: 1.8, color: '#555' }}>
              <li>status → tone → visual appearance</li>
              <li>Read-only mapping</li>
              <li>Display concern</li>
              <li>Registry-based lookup</li>
            </ul>
          </div>

          <div style={{ ...STYLES.card, borderColor: '#86efac', background: '#f0fdf4' }}>
            <h3 style={{ marginTop: 0, color: '#16a34a', fontSize: '0.875rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Stateful
            </h3>
            <p style={{ marginBottom: '1rem', fontStyle: 'italic', color: '#555' }}>
              "What can it do next?"
            </p>
            <ul style={{ margin: 0, paddingLeft: '1.25rem', lineHeight: 1.8, color: '#555' }}>
              <li>state → valid transitions</li>
              <li>Mutates via transition actions</li>
              <li>Behavior concern</li>
              <li>State machine pattern</li>
            </ul>
          </div>
        </div>

        <div style={{
          padding: '1rem 1.5rem',
          background: '#fffbeb',
          border: '1px solid #fcd34d',
          borderRadius: '0.5rem',
          color: '#92400e',
        }}>
          <strong>Together:</strong> An object often has BOTH traits. Stateful defines valid states and transitions;
          Statusable maps those states to visual tones.
        </div>
      </section>

      <section style={STYLES.section}>
        <h3 style={{ marginBottom: '1rem' }}>Key Concepts</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
          <div style={{ ...STYLES.card, background: '#fff' }}>
            <strong style={{ display: 'block', marginBottom: '0.5rem', color: '#059669' }}>States</strong>
            <span style={{ color: '#666' }}>Defined positions in the lifecycle (draft, active, paused, archived)</span>
          </div>
          <div style={{ ...STYLES.card, background: '#fff' }}>
            <strong style={{ display: 'block', marginBottom: '0.5rem', color: '#059669' }}>Transitions</strong>
            <span style={{ color: '#666' }}>Named actions that move between states (activate, pause, resume)</span>
          </div>
          <div style={{ ...STYLES.card, background: '#fff' }}>
            <strong style={{ display: 'block', marginBottom: '0.5rem', color: '#059669' }}>Initial State</strong>
            <span style={{ color: '#666' }}>Starting point when an entity is created (usually "draft")</span>
          </div>
          <div style={{ ...STYLES.card, background: '#fff' }}>
            <strong style={{ display: 'block', marginBottom: '0.5rem', color: '#059669' }}>State History</strong>
            <span style={{ color: '#666' }}>Chronological log of all transitions</span>
          </div>
        </div>
      </section>

      <section style={STYLES.section}>
        <h3 style={{ marginBottom: '1rem' }}>The Core Question</h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
          <code style={{ padding: '0.5rem 0.75rem', background: '#f3f4f6', borderRadius: '0.25rem' }}>
            object.status === "draft"
          </code>
          <span style={{ color: '#888', fontSize: '1.5rem' }}>→</span>
          <code style={{ padding: '0.5rem 0.75rem', background: '#f3f4f6', borderRadius: '0.25rem' }}>
            canTransition("activate")?
          </code>
          <span style={{ color: '#888', fontSize: '1.5rem' }}>→</span>
          <span style={{
            padding: '0.5rem 1rem',
            borderRadius: '0.25rem',
            background: '#dcfce7',
            color: '#166534',
            fontWeight: 600,
          }}>
            ✓ Yes
          </span>
        </div>
      </section>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
 * 2. STATE DIAGRAM — Visual representation of states and transitions
 * ───────────────────────────────────────────────────────────────────────────── */

function StateDiagramStory(): JSX.Element {
  const nodeStyle = (state: string) => {
    const config = STATE_CONFIG[state];
    const colors = {
      info: { bg: '#dbeafe', border: '#3b82f6', text: '#1e40af' },
      success: { bg: '#dcfce7', border: '#22c55e', text: '#166534' },
      warning: { bg: '#fef3c7', border: '#f59e0b', text: '#92400e' },
      neutral: { bg: '#f3f4f6', border: '#9ca3af', text: '#374151' },
    };
    const c = colors[config.tone];
    return {
      padding: '1rem 1.5rem',
      borderRadius: '0.5rem',
      border: `2px solid ${c.border}`,
      background: c.bg,
      color: c.text,
      fontWeight: 600 as const,
      textAlign: 'center' as const,
      minWidth: '100px',
    };
  };

  const arrowStyle = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#6b7280',
    fontSize: '0.75rem',
    fontWeight: 500 as const,
  };

  return (
    <div style={STYLES.page}>
      <h1 style={STYLES.heading}>State Diagram</h1>
      <h2 style={STYLES.subheading}>
        Visual map of valid state transitions
      </h2>

      <section style={STYLES.section}>
        {/* Main diagram */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '0.5rem',
          padding: '2rem',
          background: '#fafafa',
          borderRadius: '1rem',
          border: '1px solid #e0e0e0',
        }}>
          {/* DRAFT node */}
          <div style={nodeStyle('draft')}>
            DRAFT
          </div>
          <div style={arrowStyle}>
            <span style={{ transform: 'rotate(90deg)', fontSize: '1.25rem' }}>→</span>
            <span style={{ marginLeft: '0.5rem' }}>activate</span>
          </div>

          {/* ACTIVE ↔ PAUSED row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
            <div style={nodeStyle('active')}>
              ACTIVE
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem' }}>
              <div style={arrowStyle}>
                <span>pause →</span>
              </div>
              <div style={arrowStyle}>
                <span>← resume</span>
              </div>
            </div>
            <div style={nodeStyle('paused')}>
              PAUSED
            </div>
          </div>

          {/* Archive arrows */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: '6rem', width: '100%' }}>
            <div style={arrowStyle}>
              <span style={{ transform: 'rotate(90deg)', fontSize: '1.25rem' }}>→</span>
              <span style={{ marginLeft: '0.25rem' }}>archive</span>
            </div>
            <div style={arrowStyle}>
              <span style={{ marginRight: '0.25rem' }}>archive</span>
              <span style={{ transform: 'rotate(90deg)', fontSize: '1.25rem' }}>→</span>
            </div>
          </div>

          {/* ARCHIVED node */}
          <div style={nodeStyle('archived')}>
            ARCHIVED
          </div>
        </div>
      </section>

      {/* Transitions table */}
      <section style={STYLES.section}>
        <div style={STYLES.groupLabel}>Valid Transitions</div>
        <table style={{
          width: '100%',
          borderCollapse: 'collapse',
          fontSize: '0.875rem',
        }}>
          <thead>
            <tr style={{ background: '#f9fafb' }}>
              <th style={{ padding: '0.75rem 1rem', textAlign: 'left', borderBottom: '2px solid #e0e0e0', fontWeight: 600 }}>From</th>
              <th style={{ padding: '0.75rem 1rem', textAlign: 'left', borderBottom: '2px solid #e0e0e0', fontWeight: 600 }}>Action</th>
              <th style={{ padding: '0.75rem 1rem', textAlign: 'left', borderBottom: '2px solid #e0e0e0', fontWeight: 600 }}>To</th>
              <th style={{ padding: '0.75rem 1rem', textAlign: 'left', borderBottom: '2px solid #e0e0e0', fontWeight: 600 }}>Description</th>
            </tr>
          </thead>
          <tbody>
            {VALID_TRANSITIONS.map((t, i) => (
              <tr key={i} style={{ background: i % 2 === 0 ? '#fff' : '#f9fafb' }}>
                <td style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #e0e0e0' }}>
                  <code style={{ padding: '0.25rem 0.5rem', background: '#f3f4f6', borderRadius: '0.25rem' }}>
                    {t.from}
                  </code>
                </td>
                <td style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #e0e0e0', fontWeight: 500, color: '#059669' }}>
                  {t.action}()
                </td>
                <td style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #e0e0e0' }}>
                  <code style={{ padding: '0.25rem 0.5rem', background: '#f3f4f6', borderRadius: '0.25rem' }}>
                    {t.to}
                  </code>
                </td>
                <td style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #e0e0e0', color: '#666' }}>
                  {t.description}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* Invalid transitions */}
      <section style={STYLES.section}>
        <div style={STYLES.groupLabel}>Invalid Transitions</div>
        <div style={{
          padding: '1rem',
          background: '#fef2f2',
          border: '1px solid #fca5a5',
          borderRadius: '0.5rem',
        }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#991b1b' }}>
              <span style={{ fontWeight: 600 }}>✗</span>
              <code>archived</code> → anything
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#991b1b' }}>
              <span style={{ fontWeight: 600 }}>✗</span>
              <code>draft</code> → <code>paused</code>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#991b1b' }}>
              <span style={{ fontWeight: 600 }}>✗</span>
              <code>draft</code> → <code>archived</code>
            </div>
          </div>
          <p style={{ margin: '0.75rem 0 0', fontSize: '0.875rem', color: '#991b1b' }}>
            These transitions are blocked by the state machine. Attempting them will throw an error or be silently ignored.
          </p>
        </div>
      </section>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
 * 3. STATE GALLERY — Visual treatment of each state
 * ───────────────────────────────────────────────────────────────────────────── */

function StateGalleryStory(): JSX.Element {
  const categories = [
    { name: 'Initial State', states: ['draft'], description: 'Where entities start their lifecycle' },
    { name: 'Active States', states: ['active', 'paused'], description: 'Operational states with transition options' },
    { name: 'Terminal State', states: ['archived'], description: 'End of lifecycle, no further transitions' },
  ];

  return (
    <div style={STYLES.page}>
      <h1 style={STYLES.heading}>State Gallery</h1>
      <h2 style={STYLES.subheading}>
        Visual treatment of each lifecycle state
      </h2>

      {/* States by category */}
      <section style={STYLES.section}>
        {categories.map((cat) => (
          <div key={cat.name} style={{ marginBottom: '2rem' }}>
            <div style={STYLES.groupLabel}>{cat.name}</div>
            <p style={{ color: '#666', marginBottom: '1rem', fontSize: '0.875rem' }}>{cat.description}</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem' }}>
              {cat.states.map((stateName) => {
                const config = STATE_CONFIG[stateName];
                return (
                  <div key={stateName} style={{
                    ...STYLES.card,
                    background: '#fff',
                    minWidth: '200px',
                    flex: '1 1 200px',
                  }}>
                    <div style={{ marginBottom: '0.75rem' }}>
                      <Badge
                        status={stateName}
                        domain="lifecycle"
                        tone={config.tone}
                        showIcon
                      />
                    </div>
                    <div style={{ fontSize: '0.875rem', color: '#666', marginBottom: '0.5rem' }}>
                      {config.description}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#9ca3af' }}>
                      Tone: <code>{config.tone}</code>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </section>

      {/* State History Timeline Example */}
      <section style={STYLES.section}>
        <div style={STYLES.groupLabel}>State History Example</div>
        <p style={{ color: '#666', marginBottom: '1rem', fontSize: '0.875rem' }}>
          The <code>state_history</code> field tracks all transitions:
        </p>
        <div style={{
          ...STYLES.card,
          background: '#fff',
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {[
              { state: 'draft', timestamp: '2025-01-15T09:00:00Z', actor: 'system' },
              { state: 'active', timestamp: '2025-01-20T14:30:00Z', actor: 'user@example.com' },
              { state: 'paused', timestamp: '2025-02-05T10:15:00Z', actor: 'admin@example.com' },
              { state: 'active', timestamp: '2025-02-10T08:00:00Z', actor: 'admin@example.com' },
            ].map((entry, i, arr) => {
              const config = STATE_CONFIG[entry.state];
              const isLast = i === arr.length - 1;
              return (
                <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <div style={{
                      width: '12px',
                      height: '12px',
                      borderRadius: '50%',
                      background: config.tone === 'success' ? '#22c55e' :
                                 config.tone === 'info' ? '#3b82f6' :
                                 config.tone === 'warning' ? '#f59e0b' : '#9ca3af',
                    }} />
                    {!isLast && (
                      <div style={{ width: '2px', height: '32px', background: '#e0e0e0' }} />
                    )}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <Badge
                        status={entry.state}
                        domain="lifecycle"
                        tone={config.tone}
                      />
                      <span style={{ fontSize: '0.75rem', color: '#9ca3af' }}>
                        {new Date(entry.timestamp).toLocaleDateString()}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#666', marginTop: '0.25rem' }}>
                      by {entry.actor}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
 * 4. HOW IT WORKS — Transition flow walkthrough
 * ───────────────────────────────────────────────────────────────────────────── */

function HowItWorksStory(): JSX.Element {
  return (
    <div style={STYLES.page}>
      <h1 style={STYLES.heading}>How It Works</h1>
      <h2 style={STYLES.subheading}>
        Follow one state transition through the system
      </h2>

      {/* Scene 1: Current State */}
      <section style={{ ...STYLES.section, ...STYLES.card }}>
        <div style={STYLES.groupLabel}>Scene 1: Current State</div>
        <p style={{ margin: '0 0 1rem', fontSize: '1.0625rem', lineHeight: 1.7 }}>
          You have a Project object that's currently in <strong>draft</strong> state.
          It's been configured and is ready to go live.
        </p>
        <pre style={STYLES.codeBlock}>
{`project = {
  id: "proj_abc123",
  name: "Q1 Marketing Campaign",
  status: "draft",  // ← Current state
  state_history: [
    { state: "draft", timestamp: "2025-01-15T09:00:00Z", actor: "system" }
  ]
}`}
        </pre>
      </section>

      {/* Scene 2: Transition Request */}
      <section style={{ ...STYLES.section, ...STYLES.card }}>
        <div style={STYLES.groupLabel}>Scene 2: Transition Request</div>
        <p style={{ margin: '0 0 1rem', fontSize: '1.0625rem', lineHeight: 1.7 }}>
          A user requests to activate the project. This calls the transition action:
        </p>
        <pre style={STYLES.codeBlock}>
{`// User clicks "Activate" button
project.transition('activate');

// Or using the trait method:
statefulTrait.transition(project, 'activate', {
  actor: 'user@example.com'
});`}
        </pre>
      </section>

      {/* Scene 3: Validation */}
      <section style={{ ...STYLES.section, ...STYLES.card }}>
        <div style={STYLES.groupLabel}>Scene 3: Validation</div>
        <p style={{ margin: '0 0 1rem', fontSize: '1.0625rem', lineHeight: 1.7 }}>
          The state machine checks if "activate" is valid from the current state:
        </p>
        <div style={{
          display: 'flex',
          alignItems: 'stretch',
          gap: '1rem',
          flexWrap: 'wrap',
          marginBottom: '1rem'
        }}>
          <div style={{ flex: '1 1 150px', padding: '1rem', background: '#dbeafe', borderRadius: '0.5rem', border: '1px solid #3b82f6' }}>
            <div style={{ fontSize: '0.75rem', color: '#1e40af', marginBottom: '0.25rem' }}>Current</div>
            <code style={{ fontWeight: 600, color: '#1e40af' }}>draft</code>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', color: '#888', fontSize: '1.5rem' }}>+</div>
          <div style={{ flex: '1 1 150px', padding: '1rem', background: '#fff', borderRadius: '0.5rem', border: '1px solid #e0e0e0' }}>
            <div style={{ fontSize: '0.75rem', color: '#888', marginBottom: '0.25rem' }}>Action</div>
            <code style={{ fontWeight: 600 }}>activate</code>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', color: '#888', fontSize: '1.5rem' }}>→</div>
          <div style={{ flex: '1 1 150px', padding: '1rem', background: '#dcfce7', borderRadius: '0.5rem', border: '1px solid #22c55e' }}>
            <div style={{ fontSize: '0.75rem', color: '#166534', marginBottom: '0.25rem' }}>Valid?</div>
            <code style={{ fontWeight: 600, color: '#166534' }}>✓ Yes</code>
          </div>
        </div>
        <pre style={STYLES.codeBlock}>
{`// Internal validation:
const validTransitions = {
  draft: ['activate'],           // draft → active only
  active: ['pause', 'archive'],  // active → paused or archived
  paused: ['resume', 'archive'], // paused → active or archived
  archived: [],                  // terminal - no transitions
};

const allowed = validTransitions['draft'].includes('activate');
// → true`}
        </pre>
      </section>

      {/* Scene 4: State Update + History */}
      <section style={{ ...STYLES.section, ...STYLES.card }}>
        <div style={STYLES.groupLabel}>Scene 4: State Update + History Append</div>
        <p style={{ margin: '0 0 1rem', fontSize: '1.0625rem', lineHeight: 1.7 }}>
          The state is updated and the transition is logged to history:
        </p>
        <pre style={STYLES.codeBlock}>
{`project = {
  id: "proj_abc123",
  name: "Q1 Marketing Campaign",
  status: "active",  // ← Updated!
  state_history: [
    { state: "draft", timestamp: "2025-01-15T09:00:00Z", actor: "system" },
    { state: "active", timestamp: "2025-01-20T14:30:00Z", actor: "user@example.com" }
    //                                                     ↑ New entry appended
  ]
}`}
        </pre>
        <div style={{
          marginTop: '1rem',
          display: 'flex',
          alignItems: 'center',
          gap: '1rem',
          padding: '1rem',
          background: '#f0fdf4',
          borderRadius: '0.5rem',
          border: '1px solid #86efac',
        }}>
          <span style={{ fontSize: '1.5rem' }}>✓</span>
          <div>
            <div style={{ fontWeight: 600, color: '#166534' }}>Transition Complete</div>
            <div style={{ fontSize: '0.875rem', color: '#166534' }}>
              Project is now <code>active</code>. New valid actions: pause, archive
            </div>
          </div>
        </div>
      </section>

      {/* Why This Matters */}
      <section style={STYLES.section}>
        <div style={STYLES.groupLabel}>Why This Matters</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
          <div style={{ ...STYLES.card, background: '#fff' }}>
            <strong style={{ display: 'block', marginBottom: '0.5rem' }}>Predictability</strong>
            <span style={{ color: '#666' }}>Only valid transitions are allowed</span>
          </div>
          <div style={{ ...STYLES.card, background: '#fff' }}>
            <strong style={{ display: 'block', marginBottom: '0.5rem' }}>Auditability</strong>
            <span style={{ color: '#666' }}>Complete history of state changes</span>
          </div>
          <div style={{ ...STYLES.card, background: '#fff' }}>
            <strong style={{ display: 'block', marginBottom: '0.5rem' }}>Consistency</strong>
            <span style={{ color: '#666' }}>Same rules everywhere in the app</span>
          </div>
          <div style={{ ...STYLES.card, background: '#fff' }}>
            <strong style={{ display: 'block', marginBottom: '0.5rem' }}>Testability</strong>
            <span style={{ color: '#666' }}>Unit test the state machine directly</span>
          </div>
        </div>
      </section>

      {/* Usage Code */}
      <section style={STYLES.section}>
        <div style={STYLES.groupLabel}>Usage in Code</div>
        <pre style={STYLES.codeBlock}>
{`import { STATEFUL_STATES } from '@/traits/lifecycle/Stateful.trait';

// Available states
console.log(STATEFUL_STATES);
// → ['draft', 'active', 'paused', 'archived']

// Check if transition is valid
function canTransition(currentState: string, action: string): boolean {
  const transitions: Record<string, string[]> = {
    draft: ['activate'],
    active: ['pause', 'archive'],
    paused: ['resume', 'archive'],
    archived: [],
  };
  return transitions[currentState]?.includes(action) ?? false;
}

// Perform transition
function performTransition(entity: any, action: string, actor: string) {
  if (!canTransition(entity.status, action)) {
    throw new Error(\`Invalid transition: \${action} from \${entity.status}\`);
  }

  const newState = getTargetState(entity.status, action);
  entity.status = newState;
  entity.state_history.push({
    state: newState,
    timestamp: new Date().toISOString(),
    actor,
  });
}`}
        </pre>
      </section>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
 * Storybook Configuration
 * ───────────────────────────────────────────────────────────────────────────── */

type Story = StoryObj<Record<string, never>>;

const meta: Meta = {
  title: 'Traits/Lifecycle/Stateful',
  parameters: {
    layout: 'fullscreen',
  },
};

export default meta;

// 1. Overview — First in nav
export const Overview: Story = {
  name: '1. Overview',
  render: () => <OverviewStory />,
  parameters: {
    chromatic: { disableSnapshot: false },
  },
};

// 2. State Diagram — Visual proof
export const StateDiagram: Story = {
  name: '2. State Diagram',
  render: () => <StateDiagramStory />,
  parameters: {
    chromatic: { disableSnapshot: false },
  },
};

// 3. State Gallery — Visual treatment
export const StateGallery: Story = {
  name: '3. State Gallery',
  render: () => <StateGalleryStory />,
  parameters: {
    chromatic: { disableSnapshot: false },
  },
};

// 4. How It Works — Transition flow
export const HowItWorks: Story = {
  name: '4. How It Works',
  render: () => <HowItWorksStory />,
  parameters: {
    chromatic: { disableSnapshot: true },
  },
};
