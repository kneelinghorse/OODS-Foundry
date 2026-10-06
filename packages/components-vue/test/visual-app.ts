import '@oods/component-styles/css';
import './visual.css';
import { createApp, defineComponent, h, onMounted } from 'vue';
import { sharedScenarios } from '@oods/component-contracts';
import { renderSharedScenario } from './scenario-fixtures.js';
const params = new URLSearchParams(window.location.search);
const brand = params.get('brand') === 'B' ? 'B' : 'A';
const theme = ['dark', 'hc'].includes(params.get('theme') ?? '') ? params.get('theme')! : 'light';
document.documentElement.dataset.brand = brand;
document.documentElement.dataset.theme = theme;
document.documentElement.style.colorScheme = theme === 'light' ? 'light' : 'dark';
createApp(defineComponent({
  setup() {
    onMounted(() => { requestAnimationFrame(() => requestAnimationFrame(() => { document.body.dataset.visualReady = 'true'; })); });
    return () => h('main', { class: 'visual-shell' }, [h('h1', {}, `Vue governed components · ${brand}/${theme}`),
      h('div', { class: 'visual-grid' }, sharedScenarios.map(scenario => h('section', { class: 'visual-section', 'data-scenario': scenario.oodsComponentId, key: scenario.id }, [
        h('h2', {}, scenario.oodsComponentId), renderSharedScenario(scenario),
      ]))),
    ]);
  },
})).mount('#app');
