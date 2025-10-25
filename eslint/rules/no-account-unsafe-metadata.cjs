/**
 * ESLint Rule: no-account-unsafe-metadata
 * 
 * Prevents arbitrary metadata writes to Account objects.
 * Enforces use of MetadataPolicy.validate() before setting metadata.
 * 
 * @module eslint/rules/no-account-unsafe-metadata
 */

module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Prevent unsafe metadata writes to Account objects',
      category: 'Security',
      recommended: true,
    },
    messages: {
      unsafeMetadataWrite: 
        'Direct metadata writes are forbidden. Use MetadataPolicy.validate() to ensure safe metadata.',
      missingValidation: 
        'Metadata assignment must be preceded by MetadataPolicy.validate() call.',
      recordAnyType: 
        'Account metadata typed as Record<string, any> or Record<string, unknown> without validation is unsafe.',
    },
    schema: [],
  },

  create(context) {
    let hasMetadataPolicyImport = false;
    let hasValidationCall = false;

    /**
     * Determine if the target expression looks like an Account instance.
     * Heuristic: identifier or property name includes "account".
     */
    const isAccountTarget = (node) => {
      if (!node) return false;

      if (node.type === 'Identifier') {
        return /account/i.test(node.name);
      }

      if (node.type === 'MemberExpression') {
        if (!node.computed && node.property && node.property.type === 'Identifier') {
          if (/account/i.test(node.property.name)) {
            return true;
          }
        }
        return isAccountTarget(node.object);
      }

      if (node.type === 'ThisExpression') {
        return false;
      }

      return false;
    };

    return {
      // Check for MetadataPolicy import
      ImportDeclaration(node) {
        if (
          node.source.value &&
          (node.source.value.includes('domain/accounts') ||
            node.source.value.includes('metadata-policy'))
        ) {
          const specifiers = node.specifiers || [];
          if (specifiers.some(s => s.imported && s.imported.name === 'MetadataPolicy')) {
            hasMetadataPolicyImport = true;
          }
        }
      },

      // Check for MetadataPolicy.validate() call
      CallExpression(node) {
        if (
          node.callee.type === 'MemberExpression' &&
          node.callee.object.name === 'MetadataPolicy' &&
          (node.callee.property.name === 'validate' ||
            node.callee.property.name === 'validateKeyValue')
        ) {
          hasValidationCall = true;
        }
      },

      // Check for direct metadata property assignment
      AssignmentExpression(node) {
        // account.metadata = { ... }
        if (
          node.left.type === 'MemberExpression' &&
          node.left.property.name === 'metadata' &&
          isAccountTarget(node.left.object)
        ) {
          if (!hasMetadataPolicyImport) {
            context.report({
              node,
              messageId: 'unsafeMetadataWrite',
            });
          } else if (!hasValidationCall) {
            context.report({
              node,
              messageId: 'missingValidation',
            });
          }
        }

        // account['metadata'] = { ... }
        if (
          node.left.type === 'MemberExpression' &&
          node.left.property.type === 'Literal' &&
          node.left.property.value === 'metadata' &&
          isAccountTarget(node.left.object)
        ) {
          if (!hasMetadataPolicyImport) {
            context.report({
              node,
              messageId: 'unsafeMetadataWrite',
            });
          }
        }
      },

      // Check for unsafe metadata type in object literal
      Property(node) {
        if (
          node.key.name === 'metadata' &&
          node.value.type === 'TSAsExpression'
        ) {
          const typeAnnotation = node.value.typeAnnotation;
          if (
            typeAnnotation &&
            typeAnnotation.type === 'TSTypeReference' &&
            typeAnnotation.typeName.name === 'Record'
          ) {
            context.report({
              node,
              messageId: 'recordAnyType',
            });
          }
        }
      },
    };
  },
};
