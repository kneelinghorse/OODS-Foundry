import type { ComponentType } from 'react';
import type { ContextKind } from '../../src/contexts/index.js';
import type { DashboardExample, UserDashboardRecord } from './user-adoption.js';
import { createUserDashboardExample, UserDashboardPreview } from './user-adoption.js';
import type { SubscriptionDashboardRecord } from './subscription-mrr.js';
import {
  createSubscriptionDashboardExample,
  SubscriptionDashboardPreview,
} from './subscription-mrr.js';
import type { ProductDashboardRecord } from './product-analytics.js';
import { createProductDashboardExample, ProductDashboardPreview } from './product-analytics.js';

export interface DashboardExampleDefinition<Data> {
  readonly id: string;
  readonly title: string;
  readonly summary: string;
  readonly repoPath: string;
  readonly storyId: string;
  readonly contexts: readonly ContextKind[];
  readonly create: () => DashboardExample<Data>;
  readonly Preview: ComponentType;
}

export type AnyDashboardExampleDefinition = DashboardExampleDefinition<unknown>;

export const DASHBOARD_EXAMPLES = [
  {
    id: 'user-adoption',
    title: 'User adoption dashboard',
    summary: 'Activation coverage grid, retention trend, and sentiment insights.',
    repoPath: 'examples/dashboards/user-adoption.tsx',
    storyId: 'proofs-dashboard-contexts--user-dashboard',
    contexts: ['dashboard', 'detail', 'timeline'],
    create: createUserDashboardExample,
    Preview: UserDashboardPreview,
  } satisfies DashboardExampleDefinition<UserDashboardRecord>,
  {
    id: 'subscription-mrr',
    title: 'Subscription MRR dashboard',
    summary: 'ARR hero metrics, churn outlook, and plan mix tracking.',
    repoPath: 'examples/dashboards/subscription-mrr.tsx',
    storyId: 'proofs-dashboard-contexts--subscription-dashboard',
    contexts: ['dashboard'],
    create: createSubscriptionDashboardExample,
    Preview: SubscriptionDashboardPreview,
  } satisfies DashboardExampleDefinition<SubscriptionDashboardRecord>,
  {
    id: 'product-analytics',
    title: 'Product analytics dashboard',
    summary: 'Usage heatmaps, satisfaction scatter, and release readiness.',
    repoPath: 'examples/dashboards/product-analytics.tsx',
    storyId: 'proofs-dashboard-contexts--product-dashboard',
    contexts: ['dashboard'],
    create: createProductDashboardExample,
    Preview: ProductDashboardPreview,
  } satisfies DashboardExampleDefinition<ProductDashboardRecord>,
] as const;

export function listDashboardExamples(): readonly AnyDashboardExampleDefinition[] {
  return DASHBOARD_EXAMPLES as readonly AnyDashboardExampleDefinition[];
}

export function findDashboardExample(id: string): AnyDashboardExampleDefinition | undefined {
  return DASHBOARD_EXAMPLES.find((entry) => entry.id === id) as AnyDashboardExampleDefinition | undefined;
}
