/**
 * Metadata Policy Tests
 * 
 * Test metadata validation, PII detection, and sanitization.
 */

import { describe, it, expect } from 'vitest';
import { DateTime } from 'luxon';
import {
  type AccountPerson,
  type AccountOrganization,
  type AccountWorkspace,
  MetadataPolicy,
  extractPIIFromMetadata,
} from '../../src/domain/accounts/index.js';

describe('Metadata Policy', () => {
  const now = DateTime.utc();
  
  describe('Approved keys validation', () => {
    it('should accept valid person metadata', () => {
      const account: AccountPerson = {
        accountId: 'acc_1',
        accountType: 'person',
        displayName: 'Alice',
        contactId: 'contact_1',
        currency: 'USD',
        verified: true,
        metadata: {
          theme: 'dark',
          marketingOptIn: true,
          featureFlags: { beta: true },
        },
        business_time: now,
        system_time: now,
      };
      
      const result = MetadataPolicy.validate(account);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
    
    it('should accept valid organization metadata', () => {
      const account: AccountOrganization = {
        accountId: 'acc_2',
        accountType: 'organization',
        displayName: 'Acme Inc',
        legalName: 'Acme Incorporated',
        currency: 'USD',
        metadata: {
          website: 'https://acme.example',
          renewalReminderDays: 90,
        },
        business_time: now,
        system_time: now,
      };
      
      const result = MetadataPolicy.validate(account);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
    
    it('should accept valid workspace metadata', () => {
      const account: AccountWorkspace = {
        accountId: 'acc_3',
        accountType: 'workspace',
        displayName: 'Team',
        parentAccountId: 'acc_2',
        slug: 'team',
        visibility: 'team',
        ownerId: 'user_1',
        memberCount: 5,
        currency: 'USD',
        metadata: {
          icon: '🚀',
          quotas: { maxMembers: 20 },
        },
        business_time: now,
        system_time: now,
      };
      
      const result = MetadataPolicy.validate(account);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
    
    it('should accept missing metadata', () => {
      const account: AccountPerson = {
        accountId: 'acc_1',
        accountType: 'person',
        displayName: 'Bob',
        contactId: 'contact_2',
        currency: 'USD',
        verified: false,
        business_time: now,
        system_time: now,
      };
      
      const result = MetadataPolicy.validate(account);
      expect(result.valid).toBe(true);
    });
  });
  
  describe('Unknown key detection', () => {
    it('should reject unknown keys in person metadata', () => {
      const account: AccountPerson = {
        accountId: 'acc_1',
        accountType: 'person',
        displayName: 'Charlie',
        contactId: 'contact_3',
        currency: 'USD',
        verified: true,
        metadata: {
          theme: 'light',
          // @ts-expect-error - testing unknown key
          fullName: 'Charlie Brown', // PII! Should be in Contact
        },
        business_time: now,
        system_time: now,
      };
      
      const result = MetadataPolicy.validate(account);
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].code).toBe('unknown_key');
      expect(result.errors[0].field).toBe('metadata.fullName');
    });
    
    it('should reject unknown keys in organization metadata', () => {
      const account: AccountOrganization = {
        accountId: 'acc_2',
        accountType: 'organization',
        displayName: 'Corp',
        legalName: 'Corporation Ltd',
        currency: 'USD',
        metadata: {
          // @ts-expect-error - testing unknown key
          secretSauce: 'proprietary data', // Not approved
        },
        business_time: now,
        system_time: now,
      };
      
      const result = MetadataPolicy.validate(account);
      expect(result.valid).toBe(false);
      expect(result.errors[0].code).toBe('unknown_key');
    });
  });
  
  describe('PII detection', () => {
    it('should detect email addresses in metadata', () => {
      const account: AccountPerson = {
        accountId: 'acc_1',
        accountType: 'person',
        displayName: 'Diana',
        contactId: 'contact_4',
        currency: 'USD',
        verified: true,
        metadata: {
          // @ts-expect-error - testing PII leakage
          notes: 'Contact at diana@example.com for more info',
        },
        business_time: now,
        system_time: now,
      };
      
      const result = MetadataPolicy.validate(account);
      expect(result.valid).toBe(false);
      const piiError = result.errors.find(e => e.code === 'pii_detected');
      expect(piiError).toBeDefined();
      expect(piiError?.message).toContain('Email');
    });
    
    it('should detect phone numbers in metadata', () => {
      const account: AccountOrganization = {
        accountId: 'acc_2',
        accountType: 'organization',
        displayName: 'PhoneCorp',
        legalName: 'PhoneCorp Inc',
        currency: 'USD',
        metadata: {
          // @ts-expect-error - testing PII
          supportHotline: 'Call 555-123-4567',
        },
        business_time: now,
        system_time: now,
      };
      
      const result = MetadataPolicy.validate(account);
      expect(result.valid).toBe(false);
      const piiError = result.errors.find(e => e.code === 'pii_detected');
      expect(piiError).toBeDefined();
      expect(piiError?.message).toContain('Phone');
    });
    
    it('should detect SSN in metadata (critical)', () => {
      const account: AccountPerson = {
        accountId: 'acc_1',
        accountType: 'person',
        displayName: 'Eve',
        contactId: 'contact_5',
        currency: 'USD',
        verified: true,
        metadata: {
          // @ts-expect-error - testing SSN leakage
          taxInfo: 'SSN: 123-45-6789',
        },
        business_time: now,
        system_time: now,
      };
      
      const result = MetadataPolicy.validate(account);
      expect(result.valid).toBe(false);
      const ssnError = result.errors.find(e => e.message.includes('SSN'));
      expect(ssnError).toBeDefined();
      expect(ssnError?.message).toContain('NEVER store SSN');
    });
    
    it('should detect credit card numbers in metadata (critical)', () => {
      const account: AccountOrganization = {
        accountId: 'acc_2',
        accountType: 'organization',
        displayName: 'CardCorp',
        legalName: 'CardCorp Ltd',
        currency: 'USD',
        metadata: {
          // @ts-expect-error - testing card leakage
          paymentBackup: '4532 1234 5678 9010',
        },
        business_time: now,
        system_time: now,
      };
      
      const result = MetadataPolicy.validate(account);
      expect(result.valid).toBe(false);
      const cardError = result.errors.find(e => e.message.includes('Credit card'));
      expect(cardError).toBeDefined();
      expect(cardError?.message).toContain('tokenized payment');
    });
    
    it('should detect PII in nested metadata', () => {
      const account: AccountWorkspace = {
        accountId: 'acc_3',
        accountType: 'workspace',
        displayName: 'Team',
        parentAccountId: 'acc_2',
        slug: 'team',
        visibility: 'team',
        ownerId: 'user_1',
        memberCount: 3,
        currency: 'USD',
        metadata: {
          // @ts-expect-error - testing nested PII
          settings: {
            adminContact: 'admin@secret.com',
          },
        },
        business_time: now,
        system_time: now,
      };
      
      const result = MetadataPolicy.validate(account);
      expect(result.valid).toBe(false);
      const piiError = result.errors.find(e => e.code === 'pii_detected');
      expect(piiError).toBeDefined();
    });
  });
  
  describe('Key-value validation', () => {
    it('should validate single key-value pair', () => {
      const result = MetadataPolicy.validateKeyValue(
        'person',
        'theme',
        'dark'
      );
      
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
    
    it('should reject unknown key in key-value validation', () => {
      const result = MetadataPolicy.validateKeyValue(
        'person',
        'secretData',
        'value'
      );
      
      expect(result.valid).toBe(false);
      expect(result.errors[0].code).toBe('unknown_key');
    });
    
    it('should detect PII in key-value validation', () => {
      const result = MetadataPolicy.validateKeyValue(
        'organization',
        'website',
        'Contact: admin@example.com'
      );
      
      expect(result.valid).toBe(false);
      expect(result.errors[0].code).toBe('pii_detected');
    });
  });
  
  describe('Metadata sanitization', () => {
    it('should strip unknown keys from person metadata', () => {
      const metadata = {
        theme: 'dark',
        marketingOptIn: true,
        secretKey: 'should be removed',
        fullName: 'Should be in Contact table',
      };
      
      const sanitized = MetadataPolicy.sanitize('person', metadata);
      
      expect(sanitized.theme).toBe('dark');
      expect(sanitized.marketingOptIn).toBe(true);
      expect(sanitized).not.toHaveProperty('secretKey');
      expect(sanitized).not.toHaveProperty('fullName');
    });
    
    it('should strip unknown keys from organization metadata', () => {
      const metadata = {
        website: 'https://example.com',
        renewalReminderDays: 60,
        internalCode: 'ABC123',
      };
      
      const sanitized = MetadataPolicy.sanitize('organization', metadata);
      
      expect(sanitized.website).toBe('https://example.com');
      expect(sanitized.renewalReminderDays).toBe(60);
      expect(sanitized).not.toHaveProperty('internalCode');
    });
    
    it('should preserve all approved keys', () => {
      const metadata = {
        defaultMemberRole: 'viewer',
        icon: '⭐',
        colorTheme: 'blue',
        quotas: { maxMembers: 10 },
        integrations: { slack: true },
      };
      
      const sanitized = MetadataPolicy.sanitize('workspace', metadata);
      
      expect(Object.keys(sanitized)).toHaveLength(5);
      expect(sanitized.defaultMemberRole).toBe('viewer');
      expect(sanitized.quotas).toEqual({ maxMembers: 10 });
    });
  });
  
  describe('PII extraction for migration', () => {
    it('should extract email addresses from legacy metadata', () => {
      const legacy = {
        theme: 'light',
        contactEmail: 'user@example.com',
        supportEmail: 'support@example.com',
        notes: 'Reach out at sales@example.com',
      };
      
      const extracted = extractPIIFromMetadata(legacy);
      
      expect(extracted.emails).toContain('user@example.com');
      expect(extracted.emails).toContain('support@example.com');
      expect(extracted.emails).toContain('sales@example.com');
      expect(extracted.emails).toHaveLength(3);
      expect(extracted.sanitizedMetadata).not.toHaveProperty('contactEmail');
    });
    
    it('should extract phone numbers from legacy metadata', () => {
      const legacy = {
        phone: '555-123-4567',
        altPhone: '555-987-6543',
      };
      
      const extracted = extractPIIFromMetadata(legacy);
      
      expect(extracted.phones).toContain('555-123-4567');
      expect(extracted.phones).toContain('555-987-6543');
      expect(extracted.phones).toHaveLength(2);
    });
    
    it('should deduplicate extracted PII', () => {
      const legacy = {
        email1: 'duplicate@example.com',
        email2: 'duplicate@example.com',
        email3: 'unique@example.com',
      };
      
      const extracted = extractPIIFromMetadata(legacy);
      
      expect(extracted.emails).toHaveLength(2);
      expect(extracted.emails).toContain('duplicate@example.com');
      expect(extracted.emails).toContain('unique@example.com');
    });
    
    it('should preserve non-PII data', () => {
      const legacy = {
        theme: 'dark',
        email: 'user@example.com',
        featureFlags: { beta: true },
      };
      
      const extracted = extractPIIFromMetadata(legacy);
      
      expect(extracted.sanitizedMetadata.theme).toBe('dark');
      expect(extracted.sanitizedMetadata.featureFlags).toEqual({ beta: true });
      expect(extracted.sanitizedMetadata).not.toHaveProperty('email');
    });
  });
  
  describe('Multi-archetype metadata isolation', () => {
    it('should not allow person keys in organization metadata', () => {
      const account: AccountOrganization = {
        accountId: 'acc_org',
        accountType: 'organization',
        displayName: 'Org',
        legalName: 'Org Ltd',
        currency: 'USD',
        metadata: {
          // @ts-expect-error - person key in org metadata
          theme: 'dark', // This is a person key!
        },
        business_time: now,
        system_time: now,
      };
      
      const result = MetadataPolicy.validate(account);
      expect(result.valid).toBe(false);
      expect(result.errors[0].code).toBe('unknown_key');
    });
    
    it('should not allow workspace keys in person metadata', () => {
      const account: AccountPerson = {
        accountId: 'acc_person',
        accountType: 'person',
        displayName: 'User',
        contactId: 'contact_1',
        currency: 'USD',
        verified: true,
        metadata: {
          // @ts-expect-error - workspace key in person metadata
          defaultMemberRole: 'admin', // This is a workspace key!
        },
        business_time: now,
        system_time: now,
      };
      
      const result = MetadataPolicy.validate(account);
      expect(result.valid).toBe(false);
      expect(result.errors[0].code).toBe('unknown_key');
    });
  });
});

