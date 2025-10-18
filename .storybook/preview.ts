import '../src/styles/globals.css';
import type { Decorator, Preview } from '@storybook/react';
import React, { useEffect } from 'react';
import * as ReactDOM from 'react-dom';

if (typeof window !== 'undefined') {
  (window as unknown as { React?: typeof React }).React = React;
  (window as unknown as { ReactDOM?: typeof ReactDOM }).ReactDOM = ReactDOM;
}

interface ThemeWrapperProps {
  theme: string;
  children: React.ReactNode;
}

const ThemeWrapper: React.FC<ThemeWrapperProps> = ({ theme, children }) => {
  useEffect(() => {
    if (typeof document === 'undefined') {
      return undefined;
    }

    const root = document.documentElement;
    const body = document.body;

    root.setAttribute('data-theme', theme);
    body.setAttribute('data-theme', theme);

    return () => {
      root.removeAttribute('data-theme');
      body.removeAttribute('data-theme');
    };
  }, [theme]);

  return React.createElement(React.Fragment, null, children);
};

const preview: Preview = {
  parameters: {
    actions: { argTypesRegex: '^on[A-Z].*' },
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/,
      },
    },
    chromatic: {
      modes: {
        light: { globals: { theme: 'light' } },
        dark: { globals: { theme: 'dark' } },
      },
    },
  },
  globalTypes: {
    theme: {
      name: 'Theme',
      description: 'Toggle light/dark design tokens',
      defaultValue: 'light',
      toolbar: {
        icon: 'mirror',
        items: [
          { value: 'light', title: 'Light' },
          { value: 'dark', title: 'Dark' },
        ],
        dynamicTitle: true,
      },
    },
  },
  decorators: [
    ((Story, context) => {
      const theme = (context.globals.theme as string | undefined) ?? 'light';

      return React.createElement(ThemeWrapper, { theme }, React.createElement(Story));
    }) as Decorator,
  ],
};

export default preview;
