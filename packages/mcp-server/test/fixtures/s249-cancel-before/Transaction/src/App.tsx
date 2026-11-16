import React from 'react';
import { CancellationForm } from '@oods/components-react';
import { formatRecordLabel } from '@oods/component-contracts';
import { GeneratedUI as List } from './screens/List';
import { GeneratedUI as Detail } from './screens/Detail';
import { GeneratedUI as Form } from './screens/Form';
import { GeneratedUI as Timeline } from './screens/Timeline';
import { createWorkflow, screenProps, collectionEvents, routes, supplementalFields, cancellable, deferredCancellation, objectLabel, cancellationFormProps, type Screen } from './application';
import type { StoreOptions } from './store';
import './app.css';
export default function App(options: StoreOptions) {
  const [app] = React.useState(() => createWorkflow(options));
  const [state, setState] = React.useState(app.snapshot);
  React.useEffect(() => { const unsubscribe = app.subscribe(setState); void app.navigate('list'); return () => { unsubscribe(); app.dispose(); }; }, [app]);
  const props = { ...screenProps(state.draft), rows: state.records.map(screenProps), events: collectionEvents(state.draft), collectionQuery: state, actions: app.actions, uiState: state.uiState };
  return <main className="workflow-app" data-oods-workflow="Transaction" data-screen={state.screen} data-selected-id={state.id} data-route={routes[state.screen]} data-ui-state={state.uiState}>
    <header className="workflow-heading"><div><p className="workflow-eyebrow">TRANSACTION WORKSPACE</p><h1>{state.screen === 'list' ? 'Transactions' : String(formatRecordLabel((String(state.draft["payment_reference"] ?? '').trim() ? state.draft["payment_reference"] : state.draft["transaction_id"])))}</h1></div><span className="workflow-mode">Local workspace</span></header>
    <nav aria-label="Workflow screens">{(['list', 'detail', 'form', 'timeline'] as Screen[]).map((screen) => <button type="button" key={screen} aria-current={state.screen === screen ? 'page' : undefined} onClick={() => { void app.navigate(screen); }}>{screen === 'form' ? 'Edit' : screen[0].toUpperCase() + screen.slice(1)}</button>)}</nav>
    {state.error && <p role="alert">{state.error}</p>}
    {state.uiState === 'error' && <button type="button" onClick={() => { void app.retry(); }}>Try again</button>}
    <section aria-label="Transaction screen" className="workflow-content" onChangeCapture={(event) => app.edit(event.nativeEvent)} onClickCapture={(event) => app.choose(event.nativeEvent)} onKeyDownCapture={(event) => app.choose(event.nativeEvent)}>
      {state.uiState === 'success' && state.screen === 'form' && supplementalFields.map((field) => <div className="workflow-field" key={field.name}><label htmlFor={field.name}>{field.label}</label><input id={field.name} name={field.name} aria-describedby={field.name + "-help"} defaultValue={String((state.draft as Record<string, unknown>)[field.name])} /><small id={field.name + "-help"} className="oods-field-help">{field.help}</small></div>)}
      {state.uiState === 'success' && state.screen === 'detail' && cancellable && state.cancelOpen && <section className="workflow-cancel" aria-label={'Cancel ' + objectLabel}>
        <CancellationForm {...cancellationFormProps} reason={String((state.draft as Record<string, unknown>).cancellation_reason ?? '')} reasonCode={String((state.draft as Record<string, unknown>).cancellation_reason_code ?? '')} />
        {deferredCancellation && <label className="workflow-checkbox"><input name="cancel_at_period_end" type="checkbox" defaultChecked={Boolean((state.draft as Record<string, unknown>).cancel_at_period_end)} />Cancel at period end</label>}
        <button type="button" onClick={() => { void app.confirmCancellation(); }}>Confirm cancellation</button><button type="button" onClick={() => app.dismissCancellation()}>Keep {objectLabel}</button>
      </section>}
      {state.screen === 'list' && <List {...props} key={'list'} />}
      {state.screen === 'detail' && <Detail {...props} key={state.revision + ':' + state.uiState} />}
      {state.screen === 'form' && <form onSubmit={(event) => { event.preventDefault(); app.actions.handleSubmit(); }}><Form {...props} key={state.revision + ':' + state.uiState} /></form>}
      {state.screen === 'timeline' && <Timeline {...props} key={state.revision + ':' + state.uiState} />}
      {state.uiState === 'success' && state.screen === 'detail' && Boolean((state.draft as Record<string, unknown>).is_archived) && <button onClick={() => { void app.restore(); }}>Restore record</button>}
    </section>
    <p className="workflow-notice" role="status">{state.notice}</p>
  </main>;
}
