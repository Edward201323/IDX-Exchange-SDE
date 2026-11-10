import { render, screen, fireEvent } from '@testing-library/react';
import PropertyImageCarousel from './PropertyImageCarousel';
import PropertyCard from './PropertyCard';

const photos = '["https://example.com/one.jpg","https://example.com/two.jpg","https://example.com/three.jpg"]';
test('cycles both ways, updates counter, and prevents parent navigation', () => {
  const navigate = jest.fn();
  render(<div onClick={navigate}><PropertyImageCarousel photos={photos} address="Garden Lane" /></div>);
  expect(screen.getByText('1 / 3')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Previous photo' }));
  expect(screen.getByRole('img')).toHaveAttribute('src', 'https://example.com/three.jpg');
  expect(screen.getByText('3 / 3')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Next photo' }));
  expect(screen.getByText('1 / 3')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Next photo' }));
  expect(screen.getByText('2 / 3')).toBeInTheDocument();
  expect(navigate).not.toHaveBeenCalled();
});
test('filters invalid entries and hides arrows for one usable photo', () => {
  render(<PropertyImageCarousel photos='[null, 3, "javascript:alert(1)", "broken", "https://example.com/one.jpg"]' address="Home" />);
  expect(screen.getByText('1 / 1')).toBeInTheDocument();
  expect(screen.queryByRole('button')).not.toBeInTheDocument();
});
test('broken image has a fallback while other photos remain usable', () => {
  render(<PropertyImageCarousel photos={photos} address="Home" />);
  fireEvent.error(screen.getByRole('img'));
  expect(screen.getByText('Photo unavailable')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Next photo' }));
  expect(screen.getByRole('img')).toHaveAttribute('src', 'https://example.com/two.jpg');
  fireEvent.click(screen.getByRole('button', { name: 'Previous photo' }));
  expect(screen.getByText('Photo unavailable')).toBeInTheDocument();
});
test('card resets the photo selection when its listing or photo data changes', () => {
  const { rerender } = render(<PropertyCard property={{ L_ListingID: '1', L_Photos: photos }} />);
  fireEvent.click(screen.getByRole('button', { name: 'Previous photo' }));
  rerender(<PropertyCard property={{ L_ListingID: '2', L_Photos: '["https://example.com/new.jpg"]' }} />);
  expect(screen.getByText('1 / 1')).toBeInTheDocument();
  expect(screen.getByRole('img')).toHaveAttribute('src', 'https://example.com/new.jpg');
});
