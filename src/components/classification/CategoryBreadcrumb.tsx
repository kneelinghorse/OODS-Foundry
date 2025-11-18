import * as React from 'react';
import type { CategoryNode } from '@/schemas/classification/category-node.js';

export interface CategoryBreadcrumbProps {
  readonly nodes: readonly CategoryNode[];
  readonly className?: string;
  readonly separator?: React.ReactNode;
  readonly onNavigate?: (node: CategoryNode) => void;
  readonly 'aria-label'?: string;
}

const DEFAULT_SEPARATOR = (
  <span className="category-breadcrumb__separator" aria-hidden="true">
    &rsaquo;
  </span>
);

export function CategoryBreadcrumb({
  nodes,
  className,
  separator = DEFAULT_SEPARATOR,
  onNavigate,
  'aria-label': ariaLabel = 'Category breadcrumb',
}: CategoryBreadcrumbProps): React.ReactElement | null {
  if (!nodes || nodes.length === 0) {
    return null;
  }

  return (
    <nav className={['category-breadcrumb', className].filter(Boolean).join(' ')} aria-label={ariaLabel}>
      <ol className="category-breadcrumb__list">
        {nodes.map((node, index) => {
          const isLast = index === nodes.length - 1;
          const key = `${node.id}-${index}`;
          return (
            <li key={key} className="category-breadcrumb__item">
              {onNavigate && !isLast ? (
                <button
                  type="button"
                  className="category-breadcrumb__link"
                  onClick={() => onNavigate(node)}
                >
                  {node.name}
                </button>
              ) : (
                <span
                  className={['category-breadcrumb__label', isLast ? 'is-current' : '']
                    .filter(Boolean)
                    .join(' ')}
                  aria-current={isLast ? 'location' : undefined}
                >
                  {node.name}
                </span>
              )}
              {!isLast ? separator : null}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
