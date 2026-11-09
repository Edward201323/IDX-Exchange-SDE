import { render, screen, fireEvent } from '@testing-library/react';
import PropertyFilters from './PropertyFilters';

function setup() {
  const onSearch = jest.fn();
  const onClear = jest.fn();
  render(<PropertyFilters onSearch={onSearch} onClear={onClear} />);
  return { onSearch, onClear };
}
test('renders all six labeled inputs', () => {
  setup();
  ['City', 'ZIP code', 'Minimum price', 'Maximum price', 'Beds', 'Baths'].forEach(label => expect(screen.getByLabelText(label)).toBeInTheDocument());
});
test('submits combined filters without empty values', () => {
  const { onSearch } = setup();
  fireEvent.change(screen.getByLabelText('City'), { target: { value: ' Irvine ' } });
  fireEvent.change(screen.getByLabelText('Beds'), { target: { value: '3' } });
  fireEvent.change(screen.getByLabelText('Minimum price'), { target: { value: '0' } });
  fireEvent.click(screen.getByRole('button', { name: /Search properties/ }));
  expect(onSearch).toHaveBeenCalledWith({ city: 'Irvine', beds: '3', minPrice: '0' });
});
test('clear resets every input and the next search uses new values', () => {
  const { onSearch, onClear } = setup();
  fireEvent.change(screen.getByLabelText('City'), { target: { value: 'Irvine' } });
  fireEvent.change(screen.getByLabelText('Beds'), { target: { value: '3' } });
  fireEvent.click(screen.getByRole('button', { name: /Search properties/ }));
  fireEvent.click(screen.getByRole('button', { name: /Clear filters/ }));
  expect(onClear).toHaveBeenCalledTimes(1);
  expect(screen.getByLabelText('City')).toHaveValue('');
  expect(screen.getByLabelText('Beds')).toHaveValue('');
  fireEvent.change(screen.getByLabelText('City'), { target: { value: 'Tustin' } });
  fireEvent.click(screen.getByRole('button', { name: /Search properties/ }));
  expect(onSearch).toHaveBeenLastCalledWith({ city: 'Tustin' });
});
test('rejects an inverted price range', () => {
  const { onSearch } = setup();
  fireEvent.change(screen.getByLabelText('Minimum price'), { target: { value: '500000' } });
  fireEvent.change(screen.getByLabelText('Maximum price'), { target: { value: '100000' } });
  fireEvent.click(screen.getByRole('button', { name: /Search properties/ }));
  expect(screen.getByRole('alert')).toHaveTextContent('Minimum price must not exceed');
  expect(onSearch).not.toHaveBeenCalled();
});
