export type ContextId = 'list' | 'detail' | 'form' | 'timeline';

export type RegionId =
  | 'header'
  | 'badges'
  | 'meta'
  | 'body'
  | 'sidebar'
  | 'footer'
  | 'actions'
  | 'statusBanner'
  | 'timeline'
  | 'attachments'
  | 'comments';

export interface RegionTokenSpec {
  spacing: string[];
  typography: string[];
  surface: string[];
  focus: string[];
  status: string[];
}

export type ContextMatrix = Record<ContextId, Record<RegionId, RegionTokenSpec>>;

const buildSpec = (spec: Partial<RegionTokenSpec>): RegionTokenSpec => ({
  spacing: [...(spec.spacing ?? [])],
  typography: [...(spec.typography ?? [])],
  surface: [...(spec.surface ?? [])],
  focus: [...(spec.focus ?? [])],
  status: [...(spec.status ?? [])],
});

export const CONTEXT_MATRIX: ContextMatrix = {
  list: {
    header: buildSpec({
      spacing: ['spacing.inset.compact'],
      typography: ['text.scale.heading-lg', 'text.line-height.tight'],
      surface: ['surface.default'],
    }),
    badges: buildSpec({
      spacing: ['spacing.inline.xs'],
      typography: ['text.scale.caption'],
      surface: ['surface.badge.*'],
      status: ['status.*.surface'],
    }),
    meta: buildSpec({
      spacing: ['spacing.inline.xs'],
      typography: ['text.scale.caption'],
      surface: ['surface.transparent'],
    }),
    body: buildSpec({
      spacing: ['spacing.inset.compact'],
      typography: ['text.scale.body-sm'],
      surface: ['surface.default'],
    }),
    sidebar: buildSpec({
      spacing: ['spacing.inset.compact'],
      typography: ['text.scale.body-sm'],
      surface: ['surface.subtle'],
    }),
    footer: buildSpec({
      spacing: ['spacing.inset.compact'],
      typography: ['text.scale.body-sm'],
      surface: ['surface.default'],
    }),
    actions: buildSpec({
      spacing: ['spacing.inset.compact'],
      typography: ['text.scale.label-md'],
      surface: ['surface.transparent'],
    }),
    statusBanner: buildSpec({
      spacing: ['spacing.inset.default'],
      typography: ['text.scale.body-sm'],
      surface: ['status.*.surface'],
      status: ['status.*.text'],
    }),
    timeline: buildSpec({}),
    attachments: buildSpec({
      spacing: ['spacing.inset.compact'],
      typography: ['text.scale.body-sm'],
      surface: ['surface.subtle'],
    }),
    comments: buildSpec({
      spacing: ['spacing.inset.compact'],
      typography: ['text.scale.body-sm'],
      surface: ['surface.subtle'],
    }),
  },
  detail: {
    header: buildSpec({
      spacing: ['spacing.inset.default'],
      typography: ['text.scale.heading-xl'],
      surface: ['surface.default'],
    }),
    badges: buildSpec({
      spacing: ['spacing.inline.sm'],
      typography: ['text.scale.body-sm'],
      surface: ['surface.badge.*'],
      status: ['status.*.surface'],
    }),
    meta: buildSpec({
      spacing: ['spacing.stack.default'],
      typography: ['text.scale.body-sm'],
      surface: ['surface.transparent'],
    }),
    body: buildSpec({
      spacing: ['spacing.inset.default'],
      typography: ['text.scale.body-md', 'text.line-height.loose'],
      surface: ['surface.default'],
    }),
    sidebar: buildSpec({
      spacing: ['spacing.inset.default'],
      typography: ['text.scale.body-sm'],
      surface: ['surface.subtle'],
    }),
    footer: buildSpec({
      spacing: ['spacing.inset.default'],
      typography: ['text.scale.body-sm'],
      surface: ['surface.default'],
    }),
    actions: buildSpec({
      spacing: ['spacing.inset.default'],
      typography: ['text.scale.label-md'],
      surface: ['surface.transparent'],
    }),
    statusBanner: buildSpec({
      spacing: ['spacing.inset.default'],
      typography: ['text.scale.body-sm'],
      surface: ['status.*.surface'],
      status: ['status.*.text'],
    }),
    timeline: buildSpec({}),
    attachments: buildSpec({
      spacing: ['spacing.inset.compact'],
      typography: ['text.scale.body-sm'],
      surface: ['surface.subtle'],
    }),
    comments: buildSpec({
      spacing: ['spacing.inset.compact'],
      typography: ['text.scale.body-sm'],
      surface: ['surface.subtle'],
    }),
  },
  form: {
    header: buildSpec({
      spacing: ['spacing.inset.default'],
      typography: ['text.scale.heading-lg'],
      surface: ['surface.default'],
    }),
    badges: buildSpec({}),
    meta: buildSpec({}),
    body: buildSpec({
      spacing: ['spacing.inset.default', 'spacing.stack.default'],
      typography: ['text.scale.label-md', 'text.scale.body-md', 'text.line-height.relaxed'],
      surface: ['surface.default'],
    }),
    sidebar: buildSpec({
      spacing: ['spacing.inset.default'],
      typography: ['text.scale.body-sm'],
      surface: ['surface.subtle'],
    }),
    footer: buildSpec({
      spacing: ['spacing.inset.default'],
      typography: ['text.scale.body-sm'],
      surface: ['surface.default'],
    }),
    actions: buildSpec({
      spacing: ['spacing.inset.default'],
      typography: ['text.scale.label-md'],
      surface: ['surface.transparent'],
    }),
    statusBanner: buildSpec({
      spacing: ['spacing.inset.default'],
      typography: ['text.scale.body-sm'],
      surface: ['status.*.surface'],
      status: ['status.*.text'],
    }),
    timeline: buildSpec({}),
    attachments: buildSpec({
      spacing: ['spacing.inset.compact'],
      typography: ['text.scale.body-sm'],
      surface: ['surface.subtle'],
    }),
    comments: buildSpec({}),
  },
  timeline: {
    header: buildSpec({
      spacing: ['spacing.inset.compact'],
      typography: ['text.scale.heading-lg'],
      surface: ['surface.default'],
    }),
    badges: buildSpec({
      spacing: ['spacing.inline.xs'],
      typography: ['text.scale.caption'],
      surface: ['surface.badge.*'],
      status: ['status.*.surface'],
    }),
    meta: buildSpec({
      spacing: ['spacing.inline.xs'],
      typography: ['text.scale.caption'],
      surface: ['surface.transparent'],
    }),
    body: buildSpec({
      spacing: ['spacing.inset.compact'],
      typography: ['text.scale.body-sm', 'text.scale.caption', 'text.line-height.standard'],
      surface: ['surface.default'],
    }),
    sidebar: buildSpec({
      spacing: ['spacing.inset.compact'],
      typography: ['text.scale.body-sm'],
      surface: ['surface.subtle'],
    }),
    footer: buildSpec({
      spacing: ['spacing.inset.compact'],
      typography: ['text.scale.body-sm'],
      surface: ['surface.default'],
    }),
    actions: buildSpec({
      spacing: ['spacing.inset.compact'],
      typography: ['text.scale.label-md'],
      surface: ['surface.transparent'],
    }),
    statusBanner: buildSpec({
      spacing: ['spacing.inset.default'],
      typography: ['text.scale.body-sm'],
      surface: ['status.*.surface'],
      status: ['status.*.text'],
    }),
    timeline: buildSpec({
      spacing: ['spacing.stack.compact'],
      surface: ['surface.transparent'],
    }),
    attachments: buildSpec({}),
    comments: buildSpec({}),
  },
};
