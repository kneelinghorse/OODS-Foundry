/**
 * Account Metadata Policy & Validation
 * 
 * Enforces safe metadata schemas and prevents PII leakage.
 * Only approved keys allowed; PII fields must live in Contact table.
 * 
 * @module domain/accounts/metadata-policy
 */

import type { 
  PersonMetadata, 
  OrganizationMetadata, 
  WorkspaceMetadata,
  Account 
} from './core.js';

/**
 * Validation result
 */
export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

/**
 * Validation error detail
 */
export interface ValidationError {
  field: string;
  code: 'unknown_key' | 'pii_detected' | 'type_mismatch' | 'value_out_of_range';
  message: string;
}

/**
 * PII patterns (forbidden in metadata)
 */
const PII_PATTERNS = {
  email: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/,
  phone: /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/,
  ssn: /\b\d{3}-\d{2}-\d{4}\b/,
  creditCard: /\b\d{4}[- ]?\d{4}[- ]?\d{4}[- ]?\d{4}\b/,
};

/**
 * Approved metadata keys per account type
 */
const APPROVED_PERSON_KEYS: (keyof PersonMetadata)[] = [
  'theme',
  'marketingOptIn',
  'productUpdates',
  'referralSource',
  'onboardingCompleted',
  'featureFlags',
];

const APPROVED_ORGANIZATION_KEYS: (keyof OrganizationMetadata)[] = [
  'website',
  'registrationNumber',
  'licenseType',
  'procurementNotes',
  'renewalReminderDays',
  'customBillingTerms',
];

const APPROVED_WORKSPACE_KEYS: (keyof WorkspaceMetadata)[] = [
  'defaultMemberRole',
  'icon',
  'colorTheme',
  'quotas',
  'integrations',
];

/**
 * Metadata policy validator
 */
export class MetadataPolicy {
  /**
   * Validate account metadata against approved schema
   */
  static validate(account: Account): ValidationResult {
    const errors: ValidationError[] = [];
    
    if (!account.metadata) {
      return { valid: true, errors: [] };
    }
    
    // Check for unknown keys
    const approvedKeys = this.getApprovedKeys(account.accountType);
    const metadataKeys = Object.keys(account.metadata);
    
    for (const key of metadataKeys) {
      if (!approvedKeys.includes(key)) {
        errors.push({
          field: `metadata.${key}`,
          code: 'unknown_key',
          message: `Metadata key "${key}" not approved for ${account.accountType} accounts. Move PII to Contact table.`,
        });
      }
    }
    
    // Check for PII leakage in values
    const piiErrors = this.detectPII(account.metadata as Record<string, unknown>);
    errors.push(...piiErrors);
    
    return {
      valid: errors.length === 0,
      errors,
    };
  }
  
  /**
   * Validate metadata key-value pair (for incremental updates)
   */
  static validateKeyValue(
    accountType: Account['accountType'],
    key: string,
    value: unknown
  ): ValidationResult {
    const errors: ValidationError[] = [];
    
    const approvedKeys = this.getApprovedKeys(accountType);
    
    if (!approvedKeys.includes(key)) {
      errors.push({
        field: key,
        code: 'unknown_key',
        message: `Key "${key}" not approved for ${accountType} accounts`,
      });
    }
    
    const piiErrors = this.detectPII({ [key]: value });
    errors.push(...piiErrors);
    
    return {
      valid: errors.length === 0,
      errors,
    };
  }
  
  /**
   * Get approved keys for account type
   */
  private static getApprovedKeys(accountType: Account['accountType']): string[] {
    switch (accountType) {
      case 'person':
        return APPROVED_PERSON_KEYS;
      case 'organization':
        return APPROVED_ORGANIZATION_KEYS;
      case 'workspace':
        return APPROVED_WORKSPACE_KEYS;
      default:
        return [];
    }
  }
  
  /**
   * Detect PII patterns in metadata values
   */
  private static detectPII(metadata: Record<string, unknown>): ValidationError[] {
    const errors: ValidationError[] = [];
    
    const scan = (obj: unknown, path: string = 'metadata'): void => {
      if (typeof obj === 'string') {
        // Check against PII patterns
        if (PII_PATTERNS.email.test(obj)) {
          errors.push({
            field: path,
            code: 'pii_detected',
            message: `Email address detected in metadata. Store in Contact table instead.`,
          });
        }
        if (PII_PATTERNS.phone.test(obj)) {
          errors.push({
            field: path,
            code: 'pii_detected',
            message: `Phone number detected in metadata. Store in Contact table instead.`,
          });
        }
        if (PII_PATTERNS.ssn.test(obj)) {
          errors.push({
            field: path,
            code: 'pii_detected',
            message: `SSN detected in metadata. NEVER store SSN; redact immediately.`,
          });
        }
        if (PII_PATTERNS.creditCard.test(obj)) {
          errors.push({
            field: path,
            code: 'pii_detected',
            message: `Credit card detected in metadata. NEVER store card numbers; use tokenized payment methods.`,
          });
        }
      } else if (Array.isArray(obj)) {
        obj.forEach((item, idx) => scan(item, `${path}[${idx}]`));
      } else if (obj !== null && typeof obj === 'object') {
        Object.entries(obj).forEach(([key, value]) => scan(value, `${path}.${key}`));
      }
    };
    
    scan(metadata);
    return errors;
  }
  
  /**
   * Strip unapproved keys from metadata (sanitization)
   */
  static sanitize<T extends Record<string, unknown>>(
    accountType: Account['accountType'],
    metadata: T
  ): Partial<T> {
    const approvedKeys = this.getApprovedKeys(accountType);
    const sanitized: Partial<T> = {};
    
    for (const key of Object.keys(metadata)) {
      if (approvedKeys.includes(key)) {
        sanitized[key as keyof T] = metadata[key] as T[keyof T];
      }
    }
    
    return sanitized;
  }
}

/**
 * Migration helper: extract PII from legacy metadata
 */
export interface ExtractedPII {
  /** Extracted email addresses */
  emails: string[];
  
  /** Extracted phone numbers */
  phones: string[];
  
  /** Sanitized metadata (PII removed) */
  sanitizedMetadata: Record<string, unknown>;
}

/**
 * Extract PII from legacy metadata for migration
 */
export function extractPIIFromMetadata(
  metadata: Record<string, unknown>
): ExtractedPII {
  const emails: string[] = [];
  const phones: string[] = [];
  const sanitized = { ...metadata };
  
  const extract = (obj: unknown, parentKey?: string): void => {
    if (typeof obj === 'string') {
      const emailMatch = obj.match(PII_PATTERNS.email);
      if (emailMatch) {
        emails.push(emailMatch[0]);
        if (parentKey) delete sanitized[parentKey];
      }
      
      const phoneMatch = obj.match(PII_PATTERNS.phone);
      if (phoneMatch) {
        phones.push(phoneMatch[0]);
        if (parentKey) delete sanitized[parentKey];
      }
    } else if (Array.isArray(obj)) {
      obj.forEach(item => extract(item));
    } else if (obj !== null && typeof obj === 'object') {
      Object.entries(obj).forEach(([key, value]) => extract(value, key));
    }
  };
  
  extract(metadata);
  
  return {
    emails: Array.from(new Set(emails)),
    phones: Array.from(new Set(phones)),
    sanitizedMetadata: sanitized,
  };
}

