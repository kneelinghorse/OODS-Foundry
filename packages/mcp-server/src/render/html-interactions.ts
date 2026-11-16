import type { UiElement, UiSchema } from '../schemas/generated.js';
import { analyzeBindings } from '../codegen/binding-utils.js';
import { nativeSubmitHandler } from '../codegen/action-protocol.js';
import { wiredCollectionAction } from '../codegen/collection-emitter.js';
import { cancelActionLabel, compositionObject, declaredScreenAction, orderScreenActions, screenActionAnchor, screenActionGate, screenActionIntent, screenActionLabel } from '../codegen/screen-shell.js';

const LABELS: Record<string, string> = { onViewTimeline: 'View timeline', onChange: 'Change', onDelete: 'Delete', onEdit: 'Edit', onFilter: 'Filter', onPageChange: 'Change page', onRowClick: 'Open row', onSort: 'Sort', onSubmit: 'Submit' };

/** Domain actions are declared integration points; native editing is local to this document. */
export function withHtmlActions(schema: UiSchema, objectName = compositionObject(schema)): UiSchema {
  const analysis = analyzeBindings(schema.screens);
  const nodes = (items: readonly UiElement[]): UiElement[] => items.flatMap(node => [node, ...nodes(node.children ?? [])]);
  const walk = (source: UiElement): UiElement => {
    const node = { ...source, props: { ...source.props }, children: source.children?.map(walk) };
    const submit = nativeSubmitHandler(source, analysis);
    if (submit) node.props['data-oods-action'] = submit;
    for (const binding of analysis.occurrences.filter(item => item.nodeId === source.id && item.kind === 'domain' && item.scope === 'component')) {
      node.props[['onClick', 'onActivate', 'onSubmit'].includes(binding.event) ? 'data-oods-action' : 'data-oods-change-action'] = binding.handlerName;
    }
    const actions = orderScreenActions(analysis.occurrences.filter(item => item.nodeId === source.id && item.kind === 'domain' && item.scope === 'screen'
      && !wiredCollectionAction(source, item.event) && !(item.event === 'onSubmit' && nodes([source]).some(child => child.component === 'Button' && child.props?.type === 'submit'))
      && !(declaredScreenAction(item.event, objectName) && screenActionGate(item.event, schema.objectSchema, false, objectName)?.never)), objectName);
    if (actions.length) {
      // s249-m03: a declared action (a grant's Revoke) says its verb, and is drawn only for a record whose state it moves
      // from, as in React and Vue: the binder leaves out a button whose `data-oods-statuses` exclude the shown record's.
      const gateOf = (event: string) => declaredScreenAction(event, objectName) ? screenActionGate(event, schema.objectSchema, false, objectName)?.statuses : undefined;
      const bar: UiElement = { id: `${node.id}-actions`, component: 'Stack', layout: { type: 'inline' }, props: { role: 'group', 'aria-label': 'Screen actions', className: 'oods-action-bar' }, children: actions.map(action => ({ id: `${node.id}-${action.event}`, component: 'Button', props: {
        content: action.event === 'onCancel' ? cancelActionLabel(objectName) : declaredScreenAction(action.event, objectName) ? screenActionLabel(action.event, objectName, false, LABELS) : LABELS[action.event] ?? action.event,
        'data-intent': screenActionIntent(action.event, objectName), 'data-oods-action': action.handlerName,
        ...(gateOf(action.event) ? { 'data-oods-statuses': gateOf(action.event)!.join(' ') } : {}) } })) };
      const anchor = nodes(node.children ?? []).find(child => screenActionAnchor(child) === 'summary') ?? nodes(node.children ?? []).find(child => screenActionAnchor(child) === 'title');
      const insert = (parent: UiElement): boolean => {
        const index = parent.children?.findIndex(child => child === anchor) ?? -1;
        if (index >= 0) { parent.children!.splice(index + 1, 0, bar); return true; }
        return parent.children?.some(insert) ?? false;
      };
      if (!anchor || !insert(node)) node.children = [...(node.children ?? []), bar];
    }
    return node;
  };
  return { ...schema, screens: schema.screens.map(walk) as UiSchema['screens'] };
}

/**
 * No eval, external requests or storage writes. Values stay in native controls; domain actions disclose their boundary.
 * s249-m04 (Interface 14): the notice a click shows names the button or control in a person's words, its label as it
 * reads ("Revoke grant needs your application to act. Nothing was changed."), never a handler's name.
 * s249-m04 (Interface 12): a list's search applies the one search rule @oods/component-contracts recordMatchesSearch
 * states (any text or number at any depth of the row's record, its history included; never a key name), in the same
 * steps, as `matches`.
 */
export const HTML_INTERACTIONS = `<script data-oods-runtime="document">(()=>{
const root=document.currentScript.previousElementSibling;if(!root)return;
const notice=root.querySelector('[data-oods-action-notice]');
const words=(element)=>((element&&(element.getAttribute('aria-label')||(element.labels&&element.labels[0]&&element.labels[0].textContent)||(element.matches('button,a,[role="button"]')?element.textContent:'')))||'').replace(/\\s+/g,' ').trim()||'This';
const announce=(element)=>{if(notice)notice.textContent=words(element)+' needs your application to act. Nothing was changed.';};
root.addEventListener('click',(event)=>{const action=event.target.closest('[data-oods-action]');if(action){event.preventDefault();announce(action);}});
root.addEventListener('change',(event)=>{const action=event.target.closest('[data-oods-change-action]');if(action)announce(action.matches('input,select,textarea')?action:action.querySelector('input,select,textarea')||action);});
root.addEventListener('submit',(event)=>{event.preventDefault();announce(event.submitter||event.target.querySelector('button[type="submit"]'));});
const camel=(field)=>field.replace(/_([a-z])/g,(_,letter)=>letter.toUpperCase());
for(const collection of root.querySelectorAll('[data-oods-collection="rows"]')){
 const view=collection.closest('[data-oods-view-screen]')||root;
 const list=collection.querySelector(':scope > .oods-collection')||collection;
 const items=[...list.querySelectorAll(':scope > [data-oods-row]')].map(element=>({element,record:JSON.parse(element.dataset.oodsRow)}));
 const input=view.querySelector('[data-oods-control="search"] input');
 const filter=view.querySelector('select[data-oods-control="filter"]');
 const sort=view.querySelector('select[data-oods-control="sort"]');
 const pageBar=view.querySelector('[data-oods-control="page"]');
 const empty=collection.querySelector(':scope > [data-oods-empty]');
 let page=1;const pageSize=10;
 const matches=(value,needle,depth)=>typeof value==='string'||typeof value==='number'?String(value).toLowerCase().includes(needle):depth<8&&value!==null&&typeof value==='object'&&(Array.isArray(value)?value:Object.values(value)).some(item=>matches(item,needle,depth+1));
 const refresh=()=>{
  const search=(input?.value||'').trim().toLowerCase();
  const status=filter?.value||'';const field=camel(filter?.dataset.oodsFilterField||'status');
  const sorted=items.filter(item=>(!search||matches(item.record,search,0))&&(!status||String(item.record[field]??'')===status));
  const sortField=camel(sort?.dataset.oodsSortField||'');const descending=sort?.value==='desc';
  if(sortField)sorted.sort((a,b)=>{const left=a.record[sortField],right=b.record[sortField];return (typeof left==='number'&&typeof right==='number'?left-right:String(left??'').localeCompare(String(right??'')))*(descending?-1:1);});
  page=Math.max(1,Math.min(page,Math.ceil(sorted.length/pageSize)));
  items.forEach(item=>item.element.hidden=true);
  sorted.forEach((item,index)=>{list.append(item.element);item.element.hidden=index<(page-1)*pageSize||index>=page*pageSize;});
  if(list!==collection)list.hidden=sorted.length===0;
  if(empty)empty.hidden=sorted.length>0;
  if(pageBar&&!collection.closest('[role="tabpanel"][hidden]')){
   pageBar.replaceChildren();
   const count=document.createElement('span');count.dataset.paginationCount='true';count.textContent=sorted.length+' '+(sorted.length===1?'record':'records');pageBar.append(count);
   if(sorted.length>pageSize){const range=document.createElement('span');range.dataset.paginationRange='true';range.textContent='Showing '+((page-1)*pageSize+1)+'–'+Math.min(page*pageSize,sorted.length)+' of '+sorted.length;pageBar.append(range);}
   if(sorted.length>pageSize)for(const [label,change,disabled] of [['Previous page',-1,page===1],['Next page',1,page*pageSize>=sorted.length]]){const button=document.createElement('button');button.type='button';button.textContent=label;button.disabled=disabled;button.className='oods-button';button.addEventListener('click',()=>{page+=change;refresh();});pageBar.append(button);}
  }
 };
 for(const control of [input,filter,sort])control?.addEventListener(control===input?'input':'change',()=>{page=1;refresh();});
 view.querySelector('[data-search-clear]')?.addEventListener('click',()=>{if(input)input.value='';page=1;refresh();});
 view.querySelectorAll('[role="tab"]').forEach(tab=>{for(const event of ['click','keydown'])tab.addEventListener(event,()=>queueMicrotask(()=>{page=1;refresh();}));});
 refresh();
}
const screen=root.querySelector('[data-oods-sample-screen]'),state=root.querySelector('[data-oods-sample-state]');
const select=()=>root.querySelectorAll('[data-oods-view-state]').forEach(view=>{view.hidden=(screen&&view.dataset.oodsViewScreen!==screen.value)||(state&&view.dataset.oodsViewState!==state.value);});
screen?.addEventListener('change',select);state?.addEventListener('change',select);select();
})();</script>`;
