import type { FC } from 'react';
import type { Meta } from '@storybook/react';
import { RenderObject } from '../../../components/RenderObject';
import type { RenderObjectProps } from '../../../components/RenderObject';
import { UserObject } from '../../../objects/user/object';
import type { UserRecord } from '../../../objects/user/types';
import activeUser from '../../../fixtures/user/active.json';

type ViewContext = RenderObjectProps<UserRecord>['context'];

export type ViewStoryProps = RenderObjectProps<UserRecord>;

const userRecord = activeUser as UserRecord;

export const ViewProfileComponent = RenderObject as FC<ViewStoryProps>;

export function buildViewArgs(context: ViewContext, classSuffix?: string): ViewStoryProps {
  const contextClass = classSuffix ?? context;
  return {
    object: UserObject,
    context,
    data: userRecord,
    className: `explorer-view context-${contextClass}`,
  };
}

export const viewStoryParameters: Meta<ViewStoryProps>['parameters'] = {
  layout: 'fullscreen',
  a11y: {
    config: {
      rules: [
        {
          id: 'color-contrast',
          enabled: true,
        },
        {
          id: 'landmark-one-main',
          enabled: true,
        },
      ],
    },
  },
};
