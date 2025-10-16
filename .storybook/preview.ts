import '../src/styles/globals.css';
import type { Preview } from '@storybook/react';
import React from 'react';
import * as ReactDOM from 'react-dom';

if (typeof window !== 'undefined') {
  (window as unknown as { React?: typeof React }).React = React;
  (window as unknown as { ReactDOM?: typeof ReactDOM }).ReactDOM = ReactDOM;
}

const preview: Preview = {
  parameters: {
    actions: { argTypesRegex: '^on[A-Z].*' },
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/,
      },
    },
  },
};

export default preview;
