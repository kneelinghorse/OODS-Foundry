/**
 * Account Archetypes Storybook Stories
 * 
 * Demonstrates polymorphic account types and safe metadata usage.
 */

import React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { DateTime } from 'luxon';
import {
  type AccountPerson,
  type AccountOrganization,
  type AccountWorkspace,
  type Contact,
  type AccountMembership,
  MetadataPolicy,
  isPersonAccount,
  isOrganizationAccount,
  isWorkspaceAccount,
} from '../../src/domain/accounts/index.js';

/**
 * Account card component for visualization
 */
const AccountCard: React.FC<{ account: AccountPerson | AccountOrganization | AccountWorkspace }> = ({ account }) => {
  const validation = MetadataPolicy.validate(account);
  
  return (
    <div style={{
      border: '1px solid #ddd',
      borderRadius: '8px',
      padding: '16px',
      marginBottom: '16px',
      backgroundColor: validation.valid ? '#f0f9ff' : '#fef2f2',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
        <div>
          <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>
            {account.accountType.toUpperCase()}
          </div>
          <h3 style={{ margin: '0 0 8px 0' }}>{account.displayName}</h3>
          <div style={{ fontSize: '14px', color: '#666', marginBottom: '8px' }}>
            ID: <code>{account.accountId}</code>
          </div>
        </div>
        <div style={{
          padding: '4px 8px',
          borderRadius: '4px',
          fontSize: '12px',
          fontWeight: 'bold',
          backgroundColor: validation.valid ? '#10b981' : '#ef4444',
          color: 'white',
        }}>
          {validation.valid ? '✓ Valid' : '✗ Invalid'}
        </div>
      </div>
      
      {isPersonAccount(account) && (
        <div style={{ marginTop: '12px' }}>
          <div><strong>Contact ID:</strong> {account.contactId}</div>
          <div><strong>Verified:</strong> {account.verified ? 'Yes' : 'No'}</div>
          {account.locale && <div><strong>Locale:</strong> {account.locale}</div>}
        </div>
      )}
      
      {isOrganizationAccount(account) && (
        <div style={{ marginTop: '12px' }}>
          <div><strong>Legal Name:</strong> {account.legalName}</div>
          {account.taxId && <div><strong>Tax ID:</strong> {account.taxId}</div>}
          {account.industry && <div><strong>Industry:</strong> {account.industry}</div>}
        </div>
      )}
      
      {isWorkspaceAccount(account) && (
        <div style={{ marginTop: '12px' }}>
          <div><strong>Parent:</strong> {account.parentAccountId}</div>
          <div><strong>Slug:</strong> {account.slug}</div>
          <div><strong>Members:</strong> {account.memberCount}</div>
          <div><strong>Visibility:</strong> {account.visibility}</div>
        </div>
      )}
      
      {account.metadata && (
        <details style={{ marginTop: '12px' }}>
          <summary style={{ cursor: 'pointer', fontWeight: 'bold' }}>Metadata</summary>
          <pre style={{
            backgroundColor: '#f5f5f5',
            padding: '8px',
            borderRadius: '4px',
            fontSize: '12px',
            overflow: 'auto',
          }}>
            {JSON.stringify(account.metadata, null, 2)}
          </pre>
        </details>
      )}
      
      {!validation.valid && (
        <div style={{ marginTop: '12px', padding: '8px', backgroundColor: '#fee', borderRadius: '4px' }}>
          <strong>Validation Errors:</strong>
          <ul style={{ margin: '4px 0', paddingLeft: '20px' }}>
            {validation.errors.map((err, idx) => (
              <li key={idx} style={{ fontSize: '12px', color: '#c00' }}>
                {err.field}: {err.message}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

const meta: Meta = {
  title: 'Domains/Accounts/Archetypes',
  parameters: {
    layout: 'padded',
  },
};

export default meta;

const now = DateTime.utc();

/**
 * Person Account (B2C)
 */
export const PersonAccount: StoryObj = {
  name: 'Detail – Person account view',
  render: () => {
    const account: AccountPerson = {
      accountId: 'acc_person_abc123',
      accountType: 'person',
      displayName: 'Alice Johnson',
      contactId: 'contact_xyz789',
      verified: true,
      locale: 'en-US',
      timezone: 'America/New_York',
      currency: 'USD',
      metadata: {
        theme: 'dark',
        marketingOptIn: false,
        productUpdates: true,
        onboardingCompleted: true,
        featureFlags: {
          beta_editor: true,
          ai_assistant: false,
        },
      },
      business_time: now,
      system_time: now,
    };
    
    return <AccountCard account={account} />;
  },
};

/**
 * Organization Account (B2B)
 */
export const OrganizationAccount: StoryObj = {
  name: 'List – Organization account directory',
  render: () => {
    const account: AccountOrganization = {
      accountId: 'acc_org_def456',
      accountType: 'organization',
      displayName: 'Acme Corporation',
      legalName: 'Acme Corporation Ltd.',
      taxId: 'US12-3456789',
      industry: 'Technology',
      employeeCountRange: '51-200',
      currency: 'USD',
      healthScore: 85,
      riskSegment: 'growth',
      billingContactId: 'contact_billing_123',
      accountOwnerId: 'user_csm_999',
      metadata: {
        website: 'https://acme.example',
        registrationNumber: 'REG-2024-0001',
        procurementNotes: 'Requires VP approval for contracts >$50k',
        renewalReminderDays: 90,
        customBillingTerms: 'Net 60',
      },
      business_time: now,
      system_time: now,
    };
    
    return <AccountCard account={account} />;
  },
};

/**
 * Workspace Account (Team)
 */
export const WorkspaceAccount: StoryObj = {
  name: 'Form – Workspace onboarding configuration',
  render: () => {
    const account: AccountWorkspace = {
      accountId: 'acc_workspace_ghi789',
      accountType: 'workspace',
      displayName: 'Engineering Team',
      parentAccountId: 'acc_org_def456',
      slug: 'engineering',
      visibility: 'team',
      ownerId: 'user_lead_111',
      memberCount: 15,
      currency: 'USD',
      metadata: {
        defaultMemberRole: 'contributor',
        icon: '⚙️',
        colorTheme: 'blue',
        quotas: {
          maxMembers: 50,
          maxProjects: 100,
          maxStorage: 100_000_000_000,
        },
        integrations: {
          slack: true,
          github: true,
          jira: false,
        },
      },
      business_time: now,
      system_time: now,
    };
    
    return <AccountCard account={account} />;
  },
};

/**
 * Invalid Metadata (PII Detected)
 */
export const InvalidMetadataWithPII: StoryObj = {
  render: () => {
    const account: AccountPerson = {
      accountId: 'acc_person_bad',
      accountType: 'person',
      displayName: 'Bob Smith',
      contactId: 'contact_bad_123',
      verified: false,
      currency: 'USD',
      metadata: {
        theme: 'light',
        // @ts-expect-error - intentional PII for demo
        email: 'bob@example.com', // ❌ PII!
        // @ts-expect-error - intentional PII for demo
        phone: '555-123-4567', // ❌ PII!
      },
      business_time: now,
      system_time: now,
    };
    
    return (
      <div>
        <div style={{
          padding: '12px',
          backgroundColor: '#fef2f2',
          border: '1px solid #fca5a5',
          borderRadius: '4px',
          marginBottom: '16px',
        }}>
          <strong>⚠️ Example of Invalid Metadata</strong>
          <p style={{ margin: '8px 0 0 0', fontSize: '14px' }}>
            This account contains PII in metadata fields. The validation will fail.
          </p>
        </div>
        <AccountCard account={account} />
      </div>
    );
  },
};

/**
 * All Archetypes Together
 */
export const AllArchetypes: StoryObj = {
  render: () => {
    const person: AccountPerson = {
      accountId: 'acc_person_001',
      accountType: 'person',
      displayName: 'Charlie Davis',
      contactId: 'contact_001',
      verified: true,
      currency: 'EUR',
      metadata: {
        theme: 'auto',
        marketingOptIn: true,
      },
      business_time: now,
      system_time: now,
    };
    
    const org: AccountOrganization = {
      accountId: 'acc_org_002',
      accountType: 'organization',
      displayName: 'TechCorp International',
      legalName: 'TechCorp International Inc.',
      industry: 'Software',
      currency: 'USD',
      metadata: {
        website: 'https://techcorp.example',
        renewalReminderDays: 60,
      },
      business_time: now,
      system_time: now,
    };
    
    const workspace: AccountWorkspace = {
      accountId: 'acc_workspace_003',
      accountType: 'workspace',
      displayName: 'Design Team',
      parentAccountId: 'acc_org_002',
      slug: 'design',
      visibility: 'organization',
      ownerId: 'user_designer_222',
      memberCount: 8,
      currency: 'USD',
      metadata: {
        icon: '🎨',
        quotas: { maxMembers: 20 },
      },
      business_time: now,
      system_time: now,
    };
    
    return (
      <div>
        <h2 style={{ marginBottom: '16px' }}>Account Archetypes Comparison</h2>
        <AccountCard account={person} />
        <AccountCard account={org} />
        <AccountCard account={workspace} />
      </div>
    );
  },
};

/**
 * Contact Record (PII Segregation)
 */
export const ContactRecord: StoryObj = {
  render: () => {
    const contact: Contact = {
      contactId: 'contact_xyz789',
      accountId: 'acc_person_abc123',
      fullName: 'Alice Johnson',
      email: 'alice.johnson@example.com',
      phone: '+1-555-0123',
      address: {
        street: '123 Main Street',
        city: 'Springfield',
        state: 'IL',
        postalCode: '62701',
        country: 'US',
      },
      title: 'Software Engineer',
      contactType: 'primary',
      retentionPolicyId: 'policy_gdpr_2y',
      business_time: now,
      system_time: now,
    };
    
    return (
      <div style={{
        border: '1px solid #ddd',
        borderRadius: '8px',
        padding: '16px',
        backgroundColor: '#fffbeb',
      }}>
        <div style={{ marginBottom: '12px' }}>
          <span style={{
            padding: '4px 8px',
            backgroundColor: '#f59e0b',
            color: 'white',
            borderRadius: '4px',
            fontSize: '12px',
            fontWeight: 'bold',
          }}>
            🔒 PII - Segregated Storage
          </span>
        </div>
        <h3>Contact Record</h3>
        <div style={{ marginTop: '12px' }}>
          <div><strong>Contact ID:</strong> {contact.contactId}</div>
          <div><strong>Full Name:</strong> {contact.fullName}</div>
          <div><strong>Email:</strong> {contact.email}</div>
          <div><strong>Phone:</strong> {contact.phone}</div>
          <div><strong>Address:</strong> {contact.address?.street}, {contact.address?.city}, {contact.address?.state}</div>
          <div><strong>Type:</strong> {contact.contactType}</div>
          <div><strong>Retention Policy:</strong> <code>{contact.retentionPolicyId}</code></div>
        </div>
        <div style={{
          marginTop: '12px',
          padding: '8px',
          backgroundColor: '#fef3c7',
          borderRadius: '4px',
          fontSize: '12px',
        }}>
          <strong>ℹ️ Note:</strong> All PII (name, email, phone, address) is stored in the Contact table
          with retention policies and erasure support. NEVER store PII in account metadata.
        </div>
      </div>
    );
  },
};

/**
 * Account Membership (User ↔ Account)
 */
export const AccountMembershipExample: StoryObj = {
  name: 'Timeline – Membership history audit',
  render: () => {
    const membership: AccountMembership = {
      membershipId: 'membership_abc123',
      userId: 'user_def456',
      accountId: 'acc_org_ghi789',
      accountType: 'organization',
      roleId: 'role_contributor',
      state: 'active',
      joinedAt: now.minus({ months: 3 }),
      invitedBy: 'user_admin_999',
      business_time: now.minus({ months: 3 }),
      system_time: now.minus({ months: 3 }),
    };
    
    return (
      <div style={{
        border: '1px solid #ddd',
        borderRadius: '8px',
        padding: '16px',
        backgroundColor: '#f0fdf4',
      }}>
        <h3>Account Membership</h3>
        <div style={{ marginTop: '12px' }}>
          <div><strong>Membership ID:</strong> {membership.membershipId}</div>
          <div><strong>User ID:</strong> {membership.userId}</div>
          <div><strong>Account ID:</strong> {membership.accountId}</div>
          <div><strong>Account Type:</strong> {membership.accountType}</div>
          <div><strong>Role:</strong> {membership.roleId}</div>
          <div><strong>State:</strong> <span style={{
            padding: '2px 6px',
            backgroundColor: '#10b981',
            color: 'white',
            borderRadius: '4px',
            fontSize: '12px',
          }}>{membership.state}</span></div>
          <div><strong>Joined:</strong> {membership.joinedAt.toLocaleString()}</div>
        </div>
        <div style={{
          marginTop: '12px',
          padding: '8px',
          backgroundColor: '#dcfce7',
          borderRadius: '4px',
          fontSize: '12px',
        }}>
          <strong>ℹ️ Note:</strong> AccountMembership maps Users (identity) to Accounts (billing)
          via RBAC roles. This separates authentication from billing entities.
        </div>
      </div>
    );
  },
};
