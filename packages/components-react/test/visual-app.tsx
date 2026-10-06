import '@oods/component-styles/css';
import './visual.css';
import { useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { sharedScenarios } from '@oods/component-contracts';
import { renderSharedScenario } from './scenario-fixtures.js';
const params = new URLSearchParams(window.location.search);
const brand = params.get('brand') === 'B' ? 'B' : 'A';
const theme = ['dark', 'hc'].includes(params.get('theme') ?? '') ? params.get('theme')! : 'light';
document.documentElement.dataset.brand = brand;
document.documentElement.dataset.theme = theme;
document.documentElement.style.colorScheme = theme === 'light' ? 'light' : 'dark';
function VisualShowcase() {
  useEffect(() => { requestAnimationFrame(() => requestAnimationFrame(() => { document.body.dataset.visualReady = 'true'; })); }, []);
  return <main className="visual-shell"><h1>React governed components · {brand}/{theme}</h1><div className="visual-grid">
    {sharedScenarios.map(scenario => <section className="visual-section" data-scenario={scenario.oodsComponentId} key={scenario.id}>
      <h2>{scenario.oodsComponentId}</h2>{renderSharedScenario(scenario)}
    </section>)}
  </div></main>;
}
createRoot(document.getElementById('app')!).render(<VisualShowcase />);
