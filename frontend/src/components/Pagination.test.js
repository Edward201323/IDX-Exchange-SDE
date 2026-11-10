import { render, screen, fireEvent } from '@testing-library/react';
import Pagination, { pageNumbers } from './Pagination';

test.each([0, 1])('hidden for %i pages', totalPages => {
  render(<Pagination currentPage={1} totalPages={totalPages} onPageChange={jest.fn()} />);
  expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
});
test('first page disables previous and supports next and page clicks', () => {
  const change = jest.fn();
  render(<Pagination currentPage={1} totalPages={5} onPageChange={change} />);
  expect(screen.getByRole('button', { name: 'Previous' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Page 1' })).toHaveAttribute('aria-current', 'page');
  fireEvent.click(screen.getByRole('button', { name: 'Page 1' }));
  expect(change).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Next' }));
  expect(change).toHaveBeenLastCalledWith(2);
  fireEvent.click(screen.getByRole('button', { name: 'Page 4' }));
  expect(change).toHaveBeenLastCalledWith(4);
  expect(screen.queryByText('…')).not.toBeInTheDocument();
});
test('last page disables next and supports previous', () => {
  const change = jest.fn();
  render(<Pagination currentPage={24} totalPages={24} onPageChange={change} />);
  expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: 'Previous' }));
  expect(change).toHaveBeenCalledWith(23);
  expect(screen.getAllByRole('button', { name: 'Page 24' })).toHaveLength(1);
});
test('middle window has both ellipses', () => {
  render(<Pagination currentPage={12} totalPages={24} onPageChange={jest.fn()} />);
  expect(screen.getAllByText('…')).toHaveLength(2);
  expect(pageNumbers(12, 24)).toEqual([1, 'start-gap', 11, 12, 13, 'end-gap', 24]);
});
test('page windows never duplicate endpoints or hide a single missing page', () => {
  for (let total = 2; total <= 100; total += 1) {
    for (let current = 1; current <= total; current += 1) {
      const pages = pageNumbers(current, total);
      const numbers = pages.filter(page => typeof page === 'number');
      expect(new Set(numbers).size).toBe(numbers.length);
      expect(numbers[0]).toBe(1);
      expect(numbers[numbers.length - 1]).toBe(total);
      expect(numbers).toContain(current);
      expect(numbers).toEqual([...numbers].sort((a, b) => a - b));
      pages.forEach((page, index) => {
        if (typeof page === 'string') expect(pages[index + 1] - pages[index - 1]).toBeGreaterThan(2);
      });
    }
  }
});
