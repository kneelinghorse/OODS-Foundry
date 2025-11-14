import React from 'react';
import * as ReactDOM from 'react-dom';

(globalThis as unknown as { React?: typeof React }).React = React;
(globalThis as unknown as { ReactDOM?: typeof ReactDOM }).ReactDOM = ReactDOM;

// Panel preference is centralized in preview parameters (options.panelPosition = 'right').
