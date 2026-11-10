export function pageNumbers(currentPage, totalPages) {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
  // Keep endpoints and a small window; fill single-page gaps instead of ellipses.
  const start = Math.max(2, Math.min(currentPage - 1, totalPages - 4));
  const end = Math.min(totalPages - 1, Math.max(currentPage + 1, 5));
  const pages = [1];
  if (start > 2) pages.push(start === 3 ? 2 : 'start-gap');
  for (let page = start; page <= end; page += 1) pages.push(page);
  if (end < totalPages - 1) pages.push(end === totalPages - 2 ? totalPages - 1 : 'end-gap');
  pages.push(totalPages);
  return pages;
}

export default function Pagination({ currentPage, totalPages, onPageChange }) {
  if (totalPages <= 1) return null;
  return <nav className="pagination" aria-label="Property pages">
    <button disabled={currentPage === 1} onClick={() => onPageChange(currentPage - 1)}>Previous</button>
    {pageNumbers(currentPage, totalPages).map(page => typeof page === 'number'
      ? <button key={page} aria-label={`Page ${page}`} aria-current={page === currentPage ? 'page' : undefined} onClick={() => { if (page !== currentPage) onPageChange(page); }}>{page}</button>
      : <span key={page} aria-hidden="true">…</span>)}
    <button disabled={currentPage === totalPages} onClick={() => onPageChange(currentPage + 1)}>Next</button>
  </nav>;
}
