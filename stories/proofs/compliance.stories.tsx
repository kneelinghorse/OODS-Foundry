/**
 * Compliance Core Proof Stories
 * 
 * Interactive demonstrations of RBAC permission checks
 * and audit logging in Storybook.
 */

import React, { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { DateTime } from 'luxon';
import { RBACService } from '../../src/services/compliance/rbac-service';
import { AuditLogService } from '../../src/services/compliance/audit-service';
import TimeService from '../../src/services/time';
import { BASELINE_PERMISSIONS } from '../../src/domain/compliance/rbac';
import type { Role, Permission, RolePermission, AuditLogEntry } from '../../src/domain/compliance/rbac';

const meta: Meta = {
  title: 'Explorer/Proofs/Compliance Core',
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component: 'Interactive demonstrations of RBAC permission checks and audit logging.',
      },
    },
  },
};

export default meta;

const DEMO_USERS = [
  { id: 'user_viewer', role: 'role_viewer', label: 'Viewer' },
  { id: 'user_contributor', role: 'role_contributor', label: 'Contributor' },
  { id: 'user_approver', role: 'role_approver', label: 'Approver' },
] as const;

const DEMO_ACTIONS = [
  { id: 'read', label: 'Read Subscription' },
  { id: 'write', label: 'Edit Subscription' },
  { id: 'pause', label: 'Pause Subscription' },
  { id: 'approve', label: 'Approve Token Change' },
] as const;

/**
 * Interactive Permission Check Demo
 */
export const PermissionCheckDemo: StoryObj = {
  render: () => {
    const [rbacService] = useState(() => {
      const service = new RBACService();
      seedBaseline(service);
      seedDemoAssignments(service);
      return service;
    });

    const [auditService] = useState(() => new AuditLogService());
    const [selectedUser, setSelectedUser] = useState('user_viewer');
    const [selectedAction, setSelectedAction] = useState('read');
    const [result, setResult] = useState<any>(null);

    const checkPermission = () => {
      const resourceRef = selectedAction === 'approve' 
        ? 'token:color-primary' 
        : 'subscription:sub_123';
      
      const permResult = rbacService.checkPermission(
        selectedUser,
        resourceRef,
        selectedAction
      );

      // Record audit event
      auditService.record({
        actorId: selectedUser,
        actorType: 'user',
        action: `${resourceRef.split(':')[0]}.${selectedAction}`,
        resourceRef,
        payload: { check: true, timestamp: TimeService.nowSystem().toISO() },
        severity: permResult.allowed ? 'INFO' : 'CRITICAL',
      });

      setResult(permResult);
    };

    return (
      <div style={{ fontFamily: 'system-ui', maxWidth: '600px' }}>
        <h2>Permission Check Demo</h2>
        
        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', marginBottom: '0.5rem' }}>
            Select User:
          </label>
          <select 
            value={selectedUser} 
            onChange={e => setSelectedUser(e.target.value)}
            style={{ width: '100%', padding: '0.5rem' }}
          >
            {DEMO_USERS.map(u => (
              <option key={u.id} value={u.id}>{u.label}</option>
            ))}
          </select>
        </div>

        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', marginBottom: '0.5rem' }}>
            Select Action:
          </label>
          <select 
            value={selectedAction} 
            onChange={e => setSelectedAction(e.target.value)}
            style={{ width: '100%', padding: '0.5rem' }}
          >
            {DEMO_ACTIONS.map(a => (
              <option key={a.id} value={a.id}>{a.label}</option>
            ))}
          </select>
        </div>

        <button 
          onClick={checkPermission}
          style={{
            padding: '0.75rem 1.5rem',
            background: '#0066cc',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
          }}
        >
          Check Permission
        </button>

        {result && (
          <div 
            style={{
              marginTop: '1.5rem',
              padding: '1rem',
              borderRadius: '4px',
              background: result.allowed ? '#e8f5e9' : '#ffebee',
              border: `2px solid ${result.allowed ? '#4caf50' : '#f44336'}`,
            }}
          >
            <h3 style={{ margin: '0 0 0.5rem 0' }}>
              {result.allowed ? '✓ Permission Granted' : '✗ Permission Denied'}
            </h3>
            {result.allowed && result.grantedByRoles && (
              <p style={{ margin: 0 }}>
                Granted by roles: {result.grantedByRoles.join(', ')}
              </p>
            )}
            {!result.allowed && result.reason && (
              <p style={{ margin: 0 }}>
                Reason: {result.reason}
              </p>
            )}
          </div>
        )}

        <div style={{ marginTop: '2rem', padding: '1rem', background: '#f5f5f5', borderRadius: '4px' }}>
          <h4 style={{ margin: '0 0 0.5rem 0' }}>Audit Log</h4>
          <p style={{ margin: 0, fontSize: '0.875rem' }}>
            Total events: {auditService.count()}
          </p>
          <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.875rem' }}>
            Chain integrity: {auditService.verifyIntegrity().valid ? '✓ Valid' : '✗ Invalid'}
          </p>
        </div>
      </div>
    );
  },
};

/**
 * Audit Log Viewer
 */
export const AuditLogViewer: StoryObj = {
  render: () => {
    const [auditService] = useState(() => {
      const service = new AuditLogService();
      
      // Seed some demo events
      const events = [
        { actorId: 'user_1', action: 'subscription.create', ref: 'subscription:sub_1', severity: 'INFO' as const },
        { actorId: 'user_1', action: 'subscription.pause', ref: 'subscription:sub_1', severity: 'WARNING' as const },
        { actorId: 'user_2', action: 'token.approve', ref: 'token:color-primary', severity: 'CRITICAL' as const },
        { actorId: 'agent_1', action: 'overlay.publish', ref: 'overlay:theme-v2', severity: 'CRITICAL' as const },
      ];

      events.forEach(e => {
        service.record({
          actorId: e.actorId,
          actorType: e.actorId.startsWith('agent') ? 'agent' : 'user',
          action: e.action,
          resourceRef: e.ref,
          payload: { timestamp: TimeService.nowSystem().toISO() },
          severity: e.severity,
        });
      });

      return service;
    });

    const logs = auditService.export();
    const stats = auditService.getStatistics();

    return (
      <div style={{ fontFamily: 'system-ui' }}>
        <h2>Audit Log Viewer</h2>

        <div style={{ marginBottom: '2rem', padding: '1rem', background: '#f5f5f5', borderRadius: '4px' }}>
          <h3>Statistics</h3>
          <p>Total events: {stats.totalEvents}</p>
          <p>By severity:</p>
          <ul>
            {Object.entries(stats.bySeverity).map(([severity, count]) => (
              <li key={severity}>{severity}: {count}</li>
            ))}
          </ul>
        </div>

        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#e0e0e0', textAlign: 'left' }}>
              <th style={{ padding: '0.5rem' }}>Sequence</th>
              <th style={{ padding: '0.5rem' }}>Timestamp</th>
              <th style={{ padding: '0.5rem' }}>Actor</th>
              <th style={{ padding: '0.5rem' }}>Action</th>
              <th style={{ padding: '0.5rem' }}>Resource</th>
              <th style={{ padding: '0.5rem' }}>Severity</th>
            </tr>
          </thead>
          <tbody>
            {logs.map(log => (
              <tr key={log.id} style={{ borderBottom: '1px solid #e0e0e0' }}>
                <td style={{ padding: '0.5rem' }}>{log.sequenceNumber}</td>
                <td style={{ padding: '0.5rem', fontSize: '0.75rem' }}>
                  {DateTime.fromISO(log.timestamp).toLocaleString(DateTime.DATETIME_MED_WITH_SECONDS)}
                </td>
                <td style={{ padding: '0.5rem' }}>{log.actorId}</td>
                <td style={{ padding: '0.5rem' }}>{log.action}</td>
                <td style={{ padding: '0.5rem', fontSize: '0.875rem' }}>{log.resourceRef}</td>
                <td style={{ padding: '0.5rem' }}>
                  <span style={{
                    padding: '0.25rem 0.5rem',
                    borderRadius: '4px',
                    fontSize: '0.75rem',
                    background: 
                      log.severity === 'CRITICAL' ? '#ffebee' :
                      log.severity === 'WARNING' ? '#fff3e0' :
                      '#e8f5e9',
                    color:
                      log.severity === 'CRITICAL' ? '#c62828' :
                      log.severity === 'WARNING' ? '#ef6c00' :
                      '#2e7d32',
                  }}>
                    {log.severity}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div style={{ marginTop: '1rem', padding: '0.75rem', background: '#e8f5e9', borderRadius: '4px' }}>
          ✓ Chain integrity: {auditService.verifyIntegrity().valid ? 'Valid' : 'Invalid'}
        </div>
      </div>
    );
  },
};

/**
 * Seed baseline roles and permissions
 */
function seedBaseline(service: RBACService): void {
  const now = DateTime.utc();
  const nowDate = now.toJSDate();

  const roles: Role[] = [
    {
      id: 'role_viewer',
      name: 'viewer',
      description: 'Read-only',
      metadata: {},
      createdAt: nowDate,
      updatedAt: nowDate,
    },
    {
      id: 'role_contributor',
      name: 'contributor',
      description: 'Edit resources',
      metadata: {},
      parentRoleId: 'role_viewer',
      createdAt: nowDate,
      updatedAt: nowDate,
    },
    {
      id: 'role_approver',
      name: 'approver',
      description: 'Approve changes',
      metadata: {},
      parentRoleId: 'role_contributor',
      createdAt: nowDate,
      updatedAt: nowDate,
    },
  ];

  roles.forEach(r => service.seedRole(r));

  const permissions: Permission[] = BASELINE_PERMISSIONS.map((bp, idx) => {
    const timestamp = now.plus({ seconds: idx }).toJSDate();
    return {
      ...bp,
      id: `perm_${idx}`,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
  });

  permissions.forEach(p => service.seedPermission(p));

  const mappings: Array<{ roleId: string; permIds: number[] }> = [
    { roleId: 'role_viewer', permIds: [0, 4, 7] },
    { roleId: 'role_contributor', permIds: [1, 2, 5, 8] },
    { roleId: 'role_approver', permIds: [3, 6, 9] },
  ];

  mappings.forEach(mapping => {
    mapping.permIds.forEach(permIdx => {
      const created = now.plus({ seconds: permIdx }).toJSDate();
      service.seedRolePermission({
        id: `rp_${mapping.roleId}_${permIdx}`,
        roleId: mapping.roleId,
        permissionId: permissions[permIdx].id,
        createdAt: created,
      });
    });
  });
}

function seedDemoAssignments(service: RBACService): void {
  for (const { id, role } of DEMO_USERS) {
    try {
      service.grantRole(id, role, 'system');
    } catch (error) {
      if (error instanceof Error && error.message.includes('already granted')) {
        continue;
      }
      throw error;
    }
  }
}
