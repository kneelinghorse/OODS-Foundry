import type { UiElement, UiSchema } from '../schemas/generated.js';
import { analyzeBindings } from '../codegen/binding-utils.js';
import { nativeSubmitHandler } from '../codegen/action-protocol.js';
import { wiredCollectionAction } from '../codegen/collection-emitter.js';
import { cancelActionLabel, compositionObject, orderScreenActions, screenActionAnchor, screenActionIntent } from '../codegen/screen-shell.js';

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
      && !wiredCollectionAction(source, item.event) && !(item.event === 'onSubmit' && nodes([source]).some(child => child.component === 'Button' && child.props?.type === 'submit'))));
    if (actions.length) {
      const bar: UiElement = { id: `${node.id}-actions`, component: 'Stack', layout: { type: 'inline' }, props: { role: 'group', 'aria-label': 'Screen actions', className: 'oods-action-bar' }, children: actions.map(action => ({ id: `${node.id}-${action.event}`, component: 'Button', props: { content: action.event === 'onCancel' ? cancelActionLabel(objectName) : LABELS[action.event] ?? action.event, 'data-intent': screenActionIntent(action.event), 'data-oods-action': action.handlerName } })) };
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

/** No eval, external requests or storage writes. Values stay in native controls; domain actions disclose their boundary. */
export const HTML_INTERACTIONS = `<script data-oods-runtime="document">(()=>{
const root=document.currentScript.previousElementSibling;if(!root)return;
const notice=root.querySelector('[data-oods-action-notice]');
const announce=(name)=>{if(notice)notice.textContent=name+' needs your application’s data or navigation handler. No record was changed.';};
root.addEventListener('click',(event)=>{const action=event.target.closest('[data-oods-action]');if(action){event.preventDefault();announce(action.dataset.oodsAction);}});
root.addEventListener('change',(event)=>{const action=event.target.closest('[data-oods-change-action]');if(action)announce(action.dataset.oodsChangeAction);});
root.addEventListener('submit',(event)=>{event.preventDefault();announce('Submit');});
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
 const refresh=()=>{
  const search=(input?.value||'').toLowerCase();
  const status=filter?.value||'';const field=camel(filter?.dataset.oodsFilterField||'status');
  const sorted=items.filter(item=>(!search||JSON.stringify(item.record).toLowerCase().includes(search))&&(!status||String(item.record[field]??'')===status));
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
