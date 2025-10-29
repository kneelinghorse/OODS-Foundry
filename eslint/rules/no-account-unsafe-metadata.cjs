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
        'Metadata assignment must be preceded by MetadataPolicy.validate() call on the same account instance.',
      recordAnyType:
        'Account metadata typed as Record<string, any> or Record<string, unknown> without validation is unsafe.',
    },
    schema: [],
  },

  create(context) {
    let hasMetadataPolicyImport = false;
    const scopeStack = [];

    const currentScope = () => scopeStack[scopeStack.length - 1];

    const pushScope = () => {
      scopeStack.push({
        validated: new Set(),
      });
    };

    const popScope = () => {
      scopeStack.pop();
    };

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

    const getRootIdentifierName = (node) => {
      if (!node) return null;

      if (node.type === 'Identifier') {
        return node.name;
      }

      if (node.type === 'MemberExpression') {
        return getRootIdentifierName(node.object);
      }

      return null;
    };

    const markValidated = (identifierName) => {
      if (!identifierName) {
        return;
      }
      const scope = currentScope();
      if (scope) {
        scope.validated.add(identifierName);
      }
    };

    const hasValidated = (identifierName) => {
      if (!identifierName) {
        return false;
      }
      for (let index = scopeStack.length - 1; index >= 0; index -= 1) {
        if (scopeStack[index].validated.has(identifierName)) {
          return true;
        }
      }
      return false;
    };

    return {
      Program() {
        pushScope();
      },
      'Program:exit'() {
        popScope();
      },
      FunctionDeclaration() {
        pushScope();
      },
      'FunctionDeclaration:exit'() {
        popScope();
      },
      FunctionExpression() {
        pushScope();
      },
      'FunctionExpression:exit'() {
        popScope();
      },
      ArrowFunctionExpression() {
        pushScope();
      },
      'ArrowFunctionExpression:exit'() {
        popScope();
      },

      // Check for MetadataPolicy import
      ImportDeclaration(node) {
        if (
          node.source.value &&
          (node.source.value.includes('domain/accounts') ||
            node.source.value.includes('metadata-policy'))
        ) {
          const specifiers = node.specifiers || [];
          if (specifiers.some((specifier) => specifier.imported && specifier.imported.name === 'MetadataPolicy')) {
            hasMetadataPolicyImport = true;
          }
        }
      },

      // Check for MetadataPolicy.validate() call
      CallExpression(node) {
        if (
          node.callee.type === 'MemberExpression' &&
          node.callee.object &&
          node.callee.object.type === 'Identifier' &&
          node.callee.object.name === 'MetadataPolicy' &&
          (node.callee.property.name === 'validate' || node.callee.property.name === 'validateKeyValue')
        ) {
          const firstArg = node.arguments && node.arguments[0];
          const identifierName = getRootIdentifierName(firstArg);
          if (identifierName) {
            markValidated(identifierName);
          }
        }
      },

      // Check for direct metadata property assignment
      AssignmentExpression(node) {
        if (
          node.left.type === 'MemberExpression' &&
          !node.left.computed &&
          node.left.property.type === 'Identifier' &&
          node.left.property.name === 'metadata' &&
          isAccountTarget(node.left.object)
        ) {
          const identifierName = getRootIdentifierName(node.left.object);
          if (!hasMetadataPolicyImport) {
            context.report({
              node,
              messageId: 'unsafeMetadataWrite',
            });
          } else if (!hasValidated(identifierName)) {
            context.report({
              node,
              messageId: 'missingValidation',
            });
          }
        }

        if (
          node.left.type === 'MemberExpression' &&
          node.left.computed &&
          node.left.property.type === 'Literal' &&
          node.left.property.value === 'metadata' &&
          isAccountTarget(node.left.object)
        ) {
          if (!hasMetadataPolicyImport) {
            context.report({
              node,
              messageId: 'unsafeMetadataWrite',
            });
          } else {
            const identifierName = getRootIdentifierName(node.left.object);
            if (!hasValidated(identifierName)) {
              context.report({
                node,
                messageId: 'missingValidation',
              });
            }
          }
        }
      },

      // Check for unsafe metadata type in object literal
      Property(node) {
        if (node.key && node.key.type === 'Identifier' && node.key.name === 'metadata' && node.value.type === 'TSAsExpression') {
          const typeAnnotation = node.value.typeAnnotation;
          if (
            typeAnnotation &&
            typeAnnotation.type === 'TSTypeReference' &&
            typeAnnotation.typeName &&
            typeAnnotation.typeName.type === 'Identifier' &&
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
