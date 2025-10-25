/**
 * Account Archetypes Tests
 * 
 * Test polymorphic account types, type guards, and archetype distinctions.
 */

import { describe, it, expect } from 'vitest';
import { DateTime } from 'luxon';
import {
  type AccountPerson,
  type AccountOrganization,
  type AccountWorkspace,
  type Contact,
  type AccountMembership,
  isPersonAccount,
  isOrganizationAccount,
  isWorkspaceAccount,
} from '../../src/domain/accounts/index.js';

describe('Account Archetypes', () => {
  const now = DateTime.utc();
  
  describe('AccountPerson (B2C)', () => {
    it('should create a valid person account', () => {
      const account: AccountPerson = {
        accountId: 'acc_person_123',
        accountType: 'person',
        displayName: 'John Doe',
        contactId: 'contact_456',
        currency: 'USD',
        verified: true,
        locale: 'en-US',
        timezone: 'America/New_York',
        business_time: now,
        system_time: now,
      };
      
      expect(account.accountType).toBe('person');
      expect(account.contactId).toBe('contact_456');
      expect(isPersonAccount(account)).toBe(true);
      expect(isOrganizationAccount(account)).toBe(false);
      expect(isWorkspaceAccount(account)).toBe(false);
    });
    
    it('should support safe metadata (preferences)', () => {
      const account: AccountPerson = {
        accountId: 'acc_person_123',
        accountType: 'person',
        displayName: 'Jane Smith',
        contactId: 'contact_789',
        currency: 'EUR',
        verified: false,
        metadata: {
          theme: 'dark',
          marketingOptIn: true,
          productUpdates: false,
          onboardingCompleted: true,
          featureFlags: {
            beta_feature_a: true,
            beta_feature_b: false,
          },
        },
        business_time: now,
        system_time: now,
      };
      
      expect(account.metadata?.theme).toBe('dark');
      expect(account.metadata?.marketingOptIn).toBe(true);
      expect(account.metadata?.featureFlags?.beta_feature_a).toBe(true);
    });
  });
  
  describe('AccountOrganization (B2B)', () => {
    it('should create a valid organization account', () => {
      const account: AccountOrganization = {
        accountId: 'acc_org_456',
        accountType: 'organization',
        displayName: 'Acme Corporation',
        legalName: 'Acme Corporation Ltd.',
        taxId: 'US12-3456789',
        industry: 'Technology',
        employeeCountRange: '51-200',
        currency: 'USD',
        billingContactId: 'contact_billing_123',
        accountOwnerId: 'user_csm_999',
        business_time: now,
        system_time: now,
      };
      
      expect(account.accountType).toBe('organization');
      expect(account.legalName).toBe('Acme Corporation Ltd.');
      expect(isOrganizationAccount(account)).toBe(true);
      expect(isPersonAccount(account)).toBe(false);
    });
    
    it('should support business profile metadata', () => {
      const account: AccountOrganization = {
        accountId: 'acc_org_789',
        accountType: 'organization',
        displayName: 'TechCorp',
        legalName: 'TechCorp Inc.',
        currency: 'USD',
        metadata: {
          website: 'https://techcorp.example',
          registrationNumber: 'REG-2024-0001',
          procurementNotes: 'Requires VP approval for contracts >$50k',
          renewalReminderDays: 90,
          customBillingTerms: 'Net 60',
        },
        business_time: now,
        system_time: now,
      };
      
      expect(account.metadata?.website).toBe('https://techcorp.example');
      expect(account.metadata?.renewalReminderDays).toBe(90);
    });
  });
  
  describe('AccountWorkspace (Team/Project)', () => {
    it('should create a valid workspace account', () => {
      const account: AccountWorkspace = {
        accountId: 'acc_workspace_999',
        accountType: 'workspace',
        displayName: 'Engineering Team',
        parentAccountId: 'acc_org_456',
        slug: 'engineering',
        visibility: 'team',
        ownerId: 'user_lead_111',
        memberCount: 12,
        currency: 'USD',
        business_time: now,
        system_time: now,
      };
      
      expect(account.accountType).toBe('workspace');
      expect(account.parentAccountId).toBe('acc_org_456');
      expect(account.slug).toBe('engineering');
      expect(isWorkspaceAccount(account)).toBe(true);
    });
    
    it('should support workspace settings metadata', () => {
      const account: AccountWorkspace = {
        accountId: 'acc_workspace_888',
        accountType: 'workspace',
        displayName: 'Design Team',
        parentAccountId: 'acc_org_456',
        slug: 'design',
        visibility: 'organization',
        ownerId: 'user_designer_222',
        memberCount: 5,
        currency: 'USD',
        metadata: {
          defaultMemberRole: 'contributor',
          icon: '🎨',
          colorTheme: 'purple',
          quotas: {
            maxMembers: 20,
            maxProjects: 50,
            maxStorage: 100_000_000_000, // 100GB in bytes
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
      
      expect(account.metadata?.icon).toBe('🎨');
      expect(account.metadata?.quotas?.maxMembers).toBe(20);
      expect(account.metadata?.integrations?.slack).toBe(true);
    });
  });
  
  describe('Contact (PII segregation)', () => {
    it('should store PII in dedicated Contact table', () => {
      const contact: Contact = {
        contactId: 'contact_123',
        accountId: 'acc_person_123',
        fullName: 'John Doe',
        email: 'john.doe@example.com',
        phone: '+1-555-0100',
        address: {
          street: '123 Main St',
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
      
      expect(contact.fullName).toBe('John Doe');
      expect(contact.email).toBe('john.doe@example.com');
      expect(contact.phone).toBe('+1-555-0100');
      expect(contact.retentionPolicyId).toBe('policy_gdpr_2y');
    });
    
    it('should support erasure workflow', () => {
      const contact: Contact = {
        contactId: 'contact_erasure_999',
        accountId: 'acc_person_999',
        fullName: '[ERASED]',
        email: 'erased_999@privacy.local',
        contactType: 'primary',
        retentionPolicyId: 'policy_gdpr_2y',
        erasureRequestedAt: now.minus({ days: 7 }),
        erasedAt: now.minus({ days: 1 }),
        business_time: now.minus({ years: 2 }),
        system_time: now.minus({ years: 2 }),
      };
      
      expect(contact.erasureRequestedAt).toBeDefined();
      expect(contact.erasedAt).toBeDefined();
      expect(contact.fullName).toBe('[ERASED]');
    });
  });
  
  describe('AccountMembership (User ↔ Account mapping)', () => {
    it('should map user to organization account', () => {
      const membership: AccountMembership = {
        membershipId: 'membership_123',
        userId: 'user_456',
        accountId: 'acc_org_789',
        accountType: 'organization',
        roleId: 'role_contributor',
        state: 'active',
        joinedAt: now.minus({ months: 3 }),
        invitedBy: 'user_admin_111',
        business_time: now.minus({ months: 3 }),
        system_time: now.minus({ months: 3 }),
      };
      
      expect(membership.userId).toBe('user_456');
      expect(membership.accountId).toBe('acc_org_789');
      expect(membership.accountType).toBe('organization');
      expect(membership.roleId).toBe('role_contributor');
      expect(membership.state).toBe('active');
    });
    
    it('should support membership lifecycle states', () => {
      const states: AccountMembership['state'][] = [
        'invited',
        'active',
        'suspended',
        'revoked',
      ];
      
      states.forEach(state => {
        const membership: AccountMembership = {
          membershipId: `membership_${state}`,
          userId: 'user_123',
          accountId: 'acc_org_456',
          accountType: 'organization',
          roleId: 'role_viewer',
          state,
          joinedAt: now,
          business_time: now,
          system_time: now,
        };
        
        expect(membership.state).toBe(state);
      });
    });
  });
  
  describe('Type Guards', () => {
    it('should correctly identify account types', () => {
      const personAccount: AccountPerson = {
        accountId: 'acc_1',
        accountType: 'person',
        displayName: 'Alice',
        contactId: 'contact_1',
        currency: 'USD',
        verified: true,
        business_time: now,
        system_time: now,
      };
      
      const orgAccount: AccountOrganization = {
        accountId: 'acc_2',
        accountType: 'organization',
        displayName: 'Org Inc',
        legalName: 'Org Incorporated',
        currency: 'USD',
        business_time: now,
        system_time: now,
      };
      
      const workspaceAccount: AccountWorkspace = {
        accountId: 'acc_3',
        accountType: 'workspace',
        displayName: 'Team Workspace',
        parentAccountId: 'acc_2',
        slug: 'team',
        visibility: 'team',
        ownerId: 'user_1',
        memberCount: 5,
        currency: 'USD',
        business_time: now,
        system_time: now,
      };
      
      expect(isPersonAccount(personAccount)).toBe(true);
      expect(isPersonAccount(orgAccount)).toBe(false);
      expect(isPersonAccount(workspaceAccount)).toBe(false);
      
      expect(isOrganizationAccount(orgAccount)).toBe(true);
      expect(isOrganizationAccount(personAccount)).toBe(false);
      expect(isOrganizationAccount(workspaceAccount)).toBe(false);
      
      expect(isWorkspaceAccount(workspaceAccount)).toBe(true);
      expect(isWorkspaceAccount(personAccount)).toBe(false);
      expect(isWorkspaceAccount(orgAccount)).toBe(false);
    });
  });
  
  describe('Identity vs Account vs Contact separation', () => {
    it('should distinguish User (identity), Account (billing), Contact (PII)', () => {
      // User = authentication identity (separate module, not in this test)
      const userId = 'user_auth_123';
      
      // Account = billing/subscription container
      const account: AccountPerson = {
        accountId: 'acc_billing_456',
        accountType: 'person',
        displayName: 'Customer Display Name',
        contactId: 'contact_pii_789',
        currency: 'USD',
        verified: true,
        business_time: now,
        system_time: now,
      };
      
      // Contact = PII with retention policy
      const contact: Contact = {
        contactId: 'contact_pii_789',
        accountId: 'acc_billing_456',
        fullName: 'John Personal Doe',
        email: 'john.personal@example.com',
        contactType: 'primary',
        retentionPolicyId: 'policy_gdpr',
        business_time: now,
        system_time: now,
      };
      
      // Membership = User ↔ Account mapping
      const membership: AccountMembership = {
        membershipId: 'membership_link_999',
        userId,
        accountId: account.accountId,
        accountType: 'person',
        roleId: 'role_owner',
        state: 'active',
        joinedAt: now,
        business_time: now,
        system_time: now,
      };
      
      // Assert separation
      expect(account.accountId).not.toBe(userId);
      expect(account.contactId).toBe(contact.contactId);
      expect(membership.userId).toBe(userId);
      expect(membership.accountId).toBe(account.accountId);
      expect(contact.accountId).toBe(account.accountId);
    });
  });
});

