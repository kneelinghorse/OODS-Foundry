/**
 * Semantic & Context-Aware Tailwind Configuration
 * Integrates 4-layer token architecture with protocol system
 * 
 * Layer 1: Semantic Foundation Tokens
 * Layer 2: Domain-Specific Semantic Tokens  
 * Layer 3: Component Compositions (utility classes)
 * Layer 4: Context-Aware Variants (list/detail/form/timeline)
 */

const plugin = require('tailwindcss/plugin');

module.exports = {
  content: [
    './src/**/*.{js,jsx,ts,tsx}',
    './components/**/*.{js,jsx,ts,tsx}',
  ],
  
  theme: {
    extend: {
      colors: {
        // ========================================
        // LAYER 1: Semantic Foundation Tokens
        // These are protocol-validated base tokens
        // URN: urn:proto:config:design-tokens@1.2.0#foundation
        // ========================================
        
        // Status & Feedback
        'semantic-success': '#10b981',
        'semantic-warning': '#f59e0b',
        'semantic-error': '#ef4444',
        'semantic-neutral': '#6b7280',
        'semantic-info': '#3b82f6',
        
        // Brand
        'semantic-primary': '#3b82f6',
        'semantic-secondary': '#8b5cf6',
        'semantic-accent': '#ec4899',
        
        // UI Structure
        'semantic-background': '#ffffff',
        'semantic-surface': '#f9fafb',
        'semantic-border': '#e5e7eb',
        'semantic-text': '#111827',
        'semantic-text-muted': '#6b7280',
        
        // ========================================
        // LAYER 2: Domain-Specific Semantic Tokens
        // Business logic codified in the design system
        // URN: urn:proto:config:design-tokens@1.2.0#domain
        // ========================================
        
        // Subscription Domain
        'subscription-status-future': 'var(--colors-semantic-info)',
        'subscription-status-trialing': 'var(--colors-semantic-accent)',
        'subscription-status-active': 'var(--colors-semantic-success)',
        'subscription-status-paused': 'var(--colors-semantic-neutral)',
        'subscription-status-pending-cancellation': 'var(--colors-semantic-info)',
        'subscription-status-delinquent': 'var(--colors-semantic-error)',
        'subscription-status-terminated': 'var(--colors-semantic-neutral)',
        
        // User Domain
        'user-role-admin': '#8b5cf6',
        'user-role-member': '#3b82f6',
        'user-role-guest': '#6b7280',
        'user-auth-verified': 'var(--colors-semantic-success)',
        'user-auth-unverified': 'var(--colors-semantic-warning)',
        'user-auth-locked': 'var(--colors-semantic-error)',
        
        // Payment Domain
        'payment-status-succeeded': 'var(--colors-semantic-success)',
        'payment-status-pending': 'var(--colors-semantic-warning)',
        'payment-status-failed': 'var(--colors-semantic-error)',
        'payment-status-refunded': 'var(--colors-semantic-neutral)',
        
        // Invoice Domain
        'invoice-status-draft': 'var(--colors-semantic-neutral)',
        'invoice-status-posted': 'var(--colors-semantic-info)',
        'invoice-status-paid': 'var(--colors-semantic-success)',
        'invoice-status-past-due': 'var(--colors-semantic-error)',
        'invoice-status-void': 'var(--colors-semantic-neutral)',
      },
      
      spacing: {
        // Context-aware spacing tokens
        'context-compact': '0.5rem',    // 8px - for list context
        'context-default': '1rem',      // 16px - for detail context
        'context-comfortable': '1.5rem', // 24px - for form context
      },
      
      fontSize: {
        // Context-aware typography
        'context-xs': '0.75rem',   // 12px - list context
        'context-sm': '0.875rem',  // 14px - default
        'context-base': '1rem',    // 16px - detail/form context
        'context-lg': '1.125rem',  // 18px - timeline context
      },
    },
  },
  
  plugins: [
    // ========================================
    // LAYER 4: Context-Aware Variants
    // Custom Tailwind variants for view contexts
    // ========================================
    plugin(function({ addVariant }) {
      // Core view contexts
      addVariant('list', '&[data-context="list"]');
      addVariant('detail', '&[data-context="detail"]');
      addVariant('form', '&[data-context="form"]');
      addVariant('timeline', '&[data-context="timeline"]');
      
      // Nested context combinations
      addVariant('list-item', '&[data-context="list"] &[data-item="true"]');
      addVariant('detail-section', '&[data-context="detail"] &[data-section="true"]');
      
      // State + Context variants
      addVariant('list-hover', '&[data-context="list"]:hover');
      addVariant('detail-hover', '&[data-context="detail"]:hover');
      addVariant('form-focus', '&[data-context="form"]:focus');
      
      // Responsive contexts (e.g., mobile always uses list context)
      addVariant('mobile-list', '@media (max-width: 640px)');
    }),
    
    // ========================================
    // Protocol-Aware Component Classes
    // Generated from component protocol manifests
    // ========================================
    plugin(function({ addComponents }) {
      addComponents({
        // StatusBadge component tokens (Layer 3)
        '.badge-base': {
          display: 'inline-flex',
          alignItems: 'center',
          borderRadius: '9999px',
          fontWeight: '500',
          transition: 'all 0.2s ease-in-out',
        },
        
        '.badge-default': {
          padding: '0.25rem 0.625rem', // py-1 px-2.5
          fontSize: '0.875rem',         // text-sm
          lineHeight: '1.25rem',
        },
        
        // Context-specific badge variants
        '.badge-list': {
          '@media (min-width: 640px)': {
            padding: '0.125rem 0.5rem', // list:py-0.5 list:px-2
            fontSize: '0.75rem',         // list:text-xs
          }
        },
        
        '.badge-detail': {
          padding: '0.25rem 0.625rem',  // detail:py-1 detail:px-2.5
          fontSize: '0.875rem',          // detail:text-sm
        },
        
        '.badge-timeline': {
          padding: '0.375rem 0.75rem',   // timeline:py-1.5 timeline:px-3
          fontSize: '0.875rem',           // timeline:text-sm
        },
        
        // Button component tokens (Layer 3)
        '.btn-base': {
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: '0.375rem',
          fontWeight: '600',
          transition: 'all 0.2s ease-in-out',
          '&:focus': {
            outline: 'none',
            ringWidth: '2px',
            ringOffset: '2px',
          },
          '&:disabled': {
            opacity: '0.5',
            cursor: 'not-allowed',
          }
        },
        
        '.btn-primary': {
          backgroundColor: 'var(--colors-semantic-primary)',
          color: '#ffffff',
          '&:hover:not(:disabled)': {
            backgroundColor: '#2563eb',
          },
        },
        
        '.btn-secondary': {
          backgroundColor: 'var(--colors-semantic-secondary)',
          color: '#ffffff',
          '&:hover:not(:disabled)': {
            backgroundColor: '#7c3aed',
          },
        },
      });
    }),
    
    // ========================================
    // Semantic Token Utilities
    // Helper utilities for working with semantic tokens
    // ========================================
    plugin(function({ matchUtilities, theme }) {
      // Dynamic semantic status colors
      matchUtilities(
        {
          'status': (value) => ({
            backgroundColor: `${value}20`, // 20% opacity
            color: value,
            borderColor: `${value}40`,
          }),
        },
        {
          values: {
            'future': theme('colors.subscription-status-future'),
            'trialing': theme('colors.subscription-status-trialing'),
            'active': theme('colors.subscription-status-active'),
            'paused': theme('colors.subscription-status-paused'),
            'pending-cancellation': theme('colors.subscription-status-pending-cancellation'),
            'delinquent': theme('colors.subscription-status-delinquent'),
            'terminated': theme('colors.subscription-status-terminated'),
          },
        }
      );
      
      // User role colors
      matchUtilities(
        {
          'user-role': (value) => ({
            backgroundColor: `${value}10`,
            color: value,
          }),
        },
        {
          values: {
            'admin': theme('colors.user-role-admin'),
            'member': theme('colors.user-role-member'),
            'guest': theme('colors.user-role-guest'),
          },
        }
      );
    }),
  ],
};

/**
 * USAGE EXAMPLES
 * 
 * 1. Semantic Foundation Tokens:
 *    <div className="bg-semantic-success text-white">Success message</div>
 * 
 * 2. Domain-Specific Tokens:
 *    <div className="bg-subscription-status-active/20 text-subscription-status-active">
 *      Active subscription
 *    </div>
 * 
 * 3. Context-Aware Variants:
 *    <div 
 *      data-context="list"
 *      className="px-2.5 py-1 text-sm list:px-2 list:py-0.5 list:text-xs"
 *    >
 *      Adapts to list context
 *    </div>
 * 
 * 4. Semantic Status Utility:
 *    <span className="status-active">Active</span>
 *    <span className="status-past-due">Past Due</span>
 * 
 * 5. Component Classes:
 *    <div className="badge-base badge-default">Badge</div>
 *    <button className="btn-base btn-primary">Click me</button>
 */
