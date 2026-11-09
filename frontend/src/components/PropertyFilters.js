import { useState } from 'react';
import { cleanFilters } from '../api/client';

const emptyFilters = { city: '', zipcode: '', minPrice: '', maxPrice: '', beds: '', baths: '' };

export default function PropertyFilters({ onSearch, onClear }) {
  const [filters, setFilters] = useState(emptyFilters);
  const [error, setError] = useState('');
  function change(event) {
    setFilters(current => ({ ...current, [event.target.name]: event.target.value }));
    setError('');
  }
  function submit(event) {
    event.preventDefault();
    if (filters.minPrice && filters.maxPrice && Number(filters.minPrice) > Number(filters.maxPrice)) {
      setError('Minimum price must not exceed maximum price.');
      return;
    }
    setError('');
    onSearch(cleanFilters(filters));
  }
  function clear() {
    setFilters({ ...emptyFilters });
    setError('');
    onClear();
  }
  return (
    <form className="filter-panel" onSubmit={submit} aria-label="Property filters">
      <div className="filter-heading"><h2>Find your fit</h2><span>Make room for what matters.</span></div>
      <div className="filter-fields">
        <label>City<input name="city" value={filters.city} onChange={change} placeholder="e.g. Irvine" maxLength={50} /></label>
        <label>ZIP code<input name="zipcode" value={filters.zipcode} onChange={change} placeholder="e.g. 92618" pattern="[0-9]{5}(-[0-9]{4})?" title="Enter a five-digit ZIP or ZIP+4" /></label>
        <label>Minimum price<input name="minPrice" type="number" min="0" max="2147483647" step="0.01" value={filters.minPrice} onChange={change} placeholder="No minimum" /></label>
        <label>Maximum price<input name="maxPrice" type="number" min="0" max="2147483647" step="0.01" value={filters.maxPrice} onChange={change} placeholder="No maximum" /></label>
        <label>Beds<select name="beds" value={filters.beds} onChange={change}><option value="">Any beds</option>{[0, 1, 2, 3, 4, 5, 6].map(n => <option key={n} value={n}>{n}+</option>)}</select></label>
        <label>Baths<select name="baths" value={filters.baths} onChange={change}><option value="">Any baths</option>{[1, 1.5, 2, 2.5, 3, 4, 5].map(n => <option key={n} value={n}>{n}+</option>)}</select></label>
      </div>
      <div className="filter-actions"><button type="submit" className="primary-button">Search properties <span aria-hidden="true">↗</span></button><button type="button" className="text-button" onClick={clear}>Clear filters</button></div>
      {error && <p className="form-error" role="alert">{error}</p>}
    </form>
  );
}
