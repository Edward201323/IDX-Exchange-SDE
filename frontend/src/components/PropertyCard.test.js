import { render, screen, fireEvent } from '@testing-library/react';
import PropertyCard from './PropertyCard';

const property = { L_Address: '123 Garden Lane', L_City: 'Irvine', L_State: 'CA', L_Zip: '92618', L_SystemPrice: 850000, L_Keyword2: 3, LM_Dec_3: 2.5, LM_Int2_3: 1800, L_Photos: '["https://example.com/home.jpg"]' };
test('renders photo and actual RETS fields', () => {
  render(<PropertyCard property={property} />);
  expect(screen.getByRole('img')).toHaveAttribute('src', 'https://example.com/home.jpg');
  ['$850,000', '123 Garden Lane', 'Irvine, CA, 92618', '3', '2.5', '1,800'].forEach(text => expect(screen.getByText(text)).toBeInTheDocument());
});
test.each([null, '', '{broken', '[]', '{}', '[null]', '["javascript:alert(1)"]'])('handles invalid photo data %p', L_Photos => {
  render(<PropertyCard property={{ ...property, L_Photos }} />);
  expect(screen.getByText('Photo unavailable')).toBeInTheDocument();
  expect(screen.queryByRole('img')).not.toBeInTheDocument();
});
test('falls back when a real photo fails to load', () => {
  render(<PropertyCard property={property} />);
  fireEvent.error(screen.getByRole('img'));
  expect(screen.getByText('Photo unavailable')).toBeInTheDocument();
});
test('handles absent numeric fields and zero prices', () => {
  render(<PropertyCard property={{ L_SystemPrice: 0 }} />);
  expect(screen.getByText('Price upon request')).toBeInTheDocument();
  expect(screen.getAllByText('—')).toHaveLength(3);
});
