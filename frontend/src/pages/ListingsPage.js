import { useEffect, useRef, useState } from 'react';
import { fetchProperties } from '../api/client';
import PropertyFilters from '../components/PropertyFilters';
import PropertyCard from '../components/PropertyCard';

export default function ListingsPage() {
  const [search, setSearch] = useState({ filters: {} });
  const [state, setState] = useState({ status: 'loading', results: [], total: 0 });
  const requestId = useRef(0);
  const controller = useRef(null);

  function searchFor(filters) {
    // Invalidate immediately: an old request can settle before effect cleanup runs.
    requestId.current += 1;
    controller.current?.abort();
    setState({ status: 'loading', results: [], total: 0 });
    setSearch({ filters });
  }

  useEffect(() => {
    const id = ++requestId.current;
    const abort = new AbortController();
    controller.current = abort;
    fetchProperties({ ...search.filters, limit: 20, offset: 0 }, { signal: abort.signal })
      .then(data => {
        if (!abort.signal.aborted && id === requestId.current) {
          setState({ status: 'success', results: data.results, total: data.total });
        }
      })
      .catch(error => {
        if (!abort.signal.aborted && id === requestId.current) {
          setState({ status: 'error', results: [], total: 0, error: error.message });
        }
      });
    return () => abort.abort();
  }, [search]);

  return (
    <>
      <a className="skip-link" href="#listings">Skip to listings</a>
      <header className="site-header"><a className="brand" href="/" aria-label="IDX Exchange home"><span className="brand-mark" aria-hidden="true">⌂</span>IDX<span>Exchange</span></a><span className="header-label">A place to begin.</span></header>
      <main>
        <section className="intro"><p className="eyebrow">THE NEXT CHAPTER STARTS HERE</p><h1>Find a place.<br /><em>Make it yours.</em></h1><p>Explore homes, narrow your search, and find room<br className="desktop-break" /> for whatever comes next.</p></section>
        <PropertyFilters onSearch={searchFor} onClear={() => searchFor({})} />
        <section id="listings" className="listings" aria-labelledby="listings-title" aria-busy={state.status === 'loading'}>
          <div className="results-heading"><h2 id="listings-title">{Object.keys(search.filters).length ? 'Your search results' : 'Explore properties'}</h2><p role="status">{state.status === 'success' ? `Showing ${state.results.length.toLocaleString('en-US')} of ${state.total.toLocaleString('en-US')} properties` : state.status === 'loading' ? 'Loading properties…' : 'Search unavailable'}</p></div>
          {state.status === 'loading' && <div className="loading-state"><span className="spinner" aria-hidden="true" /><p>Finding your next possibility…</p></div>}
          {state.status === 'error' && <div className="empty-state" role="alert"><h3>We couldn’t load the listings.</h3><p>{state.error}</p><button className="primary-button" onClick={() => searchFor(search.filters)}>Try again</button></div>}
          {state.status === 'success' && (state.results.length ? <div className="property-grid">{state.results.map(property => <PropertyCard key={property.L_ListingID} property={property} />)}</div> : <div className="empty-state"><h3>No properties found.</h3><p>Try a different city or a wider price range.</p></div>)}
        </section>
      </main>
      <footer><span className="footer-brand">IDX Exchange</span><span>A fresh perspective on finding home.</span></footer>
    </>
  );
}
