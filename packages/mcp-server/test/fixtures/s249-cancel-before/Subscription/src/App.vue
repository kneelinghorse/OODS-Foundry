<script setup lang="ts">
import { computed, onMounted, onUnmounted, shallowRef } from 'vue';
import { CancellationForm } from '@oods/components-vue';
import { formatRecordLabel } from '@oods/component-contracts';
import List from './screens/List.vue';
import Detail from './screens/Detail.vue';
import Form from './screens/Form.vue';
import Timeline from './screens/Timeline.vue';
import { createWorkflow, screenProps, collectionEvents, routes, supplementalFields, cancellable, deferredCancellation, objectLabel, cancellationFormProps, type Screen } from './application';
import type { StoreOptions } from './store';
import './app.css';
const options = defineProps<StoreOptions>();
const app = createWorkflow(options);
const state = shallowRef(app.snapshot());
const screens: Screen[] = ['list', 'detail', 'form', 'timeline'];
const unsubscribe = app.subscribe((next) => { state.value = next; });
onMounted(() => { void app.navigate('list'); });
onUnmounted(() => { unsubscribe(); app.dispose(); });
const props = computed(() => ({ ...screenProps(state.value.draft), rows: state.value.records.map(screenProps), events: collectionEvents(state.value.draft), collectionQuery: state.value, actions: app.actions, uiState: state.value.uiState }));
const view = computed(() => ({ list: List, detail: Detail, form: Form, timeline: Timeline })[state.value.screen]);
const values = computed(() => state.value.draft as Record<string, unknown>);
</script>
<template>
  <main class="workflow-app" data-oods-workflow="Subscription" :data-screen="state.screen" :data-selected-id="state.id" :data-route="routes[state.screen]" :data-ui-state="state.uiState">
    <header class="workflow-heading"><div><p class="workflow-eyebrow">SUBSCRIPTION WORKSPACE</p><h1>{{ state.screen === 'list' ? 'Subscriptions' : formatRecordLabel(state.draft["plan_name"]) }}</h1></div><span class="workflow-mode">Local workspace</span></header>
    <nav aria-label="Workflow screens"><button v-for="screen in screens" :key="screen" type="button" :aria-current="state.screen === screen ? 'page' : undefined" @click="app.navigate(screen)">{{ screen === 'form' ? 'Edit' : screen[0].toUpperCase() + screen.slice(1) }}</button></nav>
    <p v-if="state.error" role="alert">{{ state.error }}</p><button v-if="state.uiState === 'error'" type="button" @click="app.retry()">Try again</button>
    <section aria-label="Subscription screen" class="workflow-content" @input.capture="app.edit" @change="app.edit" @click.capture="app.choose" @keydown.capture="app.choose">
      <template v-if="state.uiState === 'success' && state.screen === 'form'"><div v-for="field in supplementalFields" :key="field.name" class="workflow-field"><label :for="field.name">{{ field.label }}</label><input :id="field.name" :name="field.name" :aria-describedby="field.name + '-help'" :value="values[field.name]" /><small :id="field.name + '-help'" class="oods-field-help">{{ field.help }}</small></div></template>
      <section v-if="state.uiState === 'success' && state.screen === 'detail' && cancellable && state.cancelOpen" class="workflow-cancel" :aria-label="'Cancel ' + objectLabel">
        <CancellationForm v-bind="cancellationFormProps" :reason="String(values.cancellation_reason ?? '')" :reason-code="String(values.cancellation_reason_code ?? '')" />
        <label v-if="deferredCancellation" class="workflow-checkbox"><input name="cancel_at_period_end" type="checkbox" :checked="Boolean(values.cancel_at_period_end)" />Cancel at period end</label>
        <button type="button" @click="app.confirmCancellation()">Confirm cancellation</button><button type="button" @click="app.dismissCancellation()">Keep {{ objectLabel }}</button>
      </section>
      <form v-if="state.screen === 'form'" @submit.prevent="app.actions.handleSubmit"><Form :key="state.revision + ':' + state.uiState" v-bind="props" /></form><component v-else :is="view" :key="state.screen === 'list' ? 'list' : state.revision + ':' + state.uiState" v-bind="props" />
      <button v-if="state.uiState === 'success' && state.screen === 'detail' && values.is_archived" @click="app.restore()">Restore record</button>
    </section><p class="workflow-notice" role="status">{{ state.notice }}</p>
  </main>
</template>
