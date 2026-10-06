import * as React from 'react';
import type { PaginationBarProps } from '@oods/components-react';
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationPrevious, PaginationNext, PaginationEllipsis } from '@/components/ui/pagination';

export const OodsPaginationBar = React.forwardRef<HTMLElement, PaginationBarProps>(function OodsPaginationBar(
  { page = 1, pageSize = 25, totalItems = 0, totalPages: supplied, pageSizeOptions = [10, 25, 50, 100],
    showPageSizeSelector = false, showGotoPage = false, showItemRange = true, onPageChange, onPageSizeChange, onChange, onUpdate,
    pageField, pageSizeField, totalItemsField, totalPagesField, pageSizeOptionsParameter, showPageSizeSelectorParameter,
    showGotoPageParameter, showItemRangeParameter, className, 'aria-label': label = 'Pagination', ...props }, ref,
) {
  void [pageField, pageSizeField, totalItemsField, totalPagesField, pageSizeOptionsParameter, showPageSizeSelectorParameter, showGotoPageParameter, showItemRangeParameter];
  const size = Number.isFinite(pageSize) && pageSize > 0 ? Math.floor(pageSize) : 25;
  const count = Math.max(0, Math.floor(supplied ?? Math.ceil(Math.max(0, totalItems) / size)));
  const current = count ? Math.max(1, Math.min(Math.floor(page), count)) : 1;
  const go = (next: number) => { const target = Math.max(1, Math.min(Math.floor(next), count)); if (count && Number.isFinite(target) && target !== current) { onPageChange?.(target); onChange?.(target); onUpdate?.(target); } };
  const numbers = count <= 7 ? Array.from({ length: count }, (_, i) => i + 1) : [...new Set([1, current - 1, current, current + 1, count])].filter(n => n >= 1 && n <= count).sort((a, b) => a - b);
  const pages: Array<number | string> = [];
  numbers.forEach((n, index) => { if (index && n - numbers[index - 1] > 1) pages.push(`gap-${n}`); pages.push(n); });
  const link = (target: number, disabled = false) => ({ href: '#', role: 'link' as const, 'aria-disabled': disabled || undefined, tabIndex: disabled ? -1 : 0, onClick: (event: React.MouseEvent<HTMLAnchorElement>) => { event.preventDefault(); if (!disabled) go(target); } });
  return <Pagination {...props} ref={ref} aria-label={label} data-oods-component={undefined} data-oods-adapter="PaginationBar" className={['flex-wrap items-center gap-3', className].filter(Boolean).join(' ')}>
    {showItemRange ? <><span>{`${totalItems} ${totalItems === 1 ? 'record' : 'records'}`}</span>{totalItems > 0 && count > 1 ? <span>{`Showing ${(current - 1) * size + 1}–${Math.min(current * size, totalItems)} of ${totalItems}`}</span> : null}</> : null}
    {count > 1 ? <><PaginationContent>
      <PaginationItem><PaginationPrevious {...link(current - 1, current <= 1)} aria-label="Previous page" /></PaginationItem>
      {pages.map(n => <PaginationItem key={n}>{typeof n === 'number' ? <PaginationLink {...link(n)} isActive={n === current} aria-label={`Page ${n}`}>{n}</PaginationLink> : <PaginationEllipsis />}</PaginationItem>)}
      <PaginationItem><PaginationNext {...link(current + 1, current >= count)} aria-label="Next page" /></PaginationItem>
    </PaginationContent><span>{`Page ${current} of ${count}`}</span></> : null}
    {showPageSizeSelector ? <label>Items per page<select aria-label="Items per page" value={size} onChange={event => onPageSizeChange?.(Number(event.currentTarget.value))}>{pageSizeOptions.map(option => <option key={option} value={option}>{option}</option>)}</select></label> : null}
    {showGotoPage ? <label>Go to page<input type="number" min={1} max={Math.max(1, count)} defaultValue={current} onKeyDown={event => { if (event.key === 'Enter') go(Number(event.currentTarget.value)); }} /></label> : null}
  </Pagination>;
});
