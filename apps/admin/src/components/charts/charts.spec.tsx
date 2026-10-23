import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AreaChart, BarChart, BarList, Donut } from './charts';
import { compactRupees, niceMax, percent, smoothPath, ticks, yFor } from './scale';

describe('chart maths', () => {
  it('C-01 niceMax rounds up to a friendly axis end and never below the data', () => {
    expect(niceMax(0)).toBe(1);
    expect(niceMax(-5)).toBe(1);
    expect(niceMax(Number.NaN)).toBe(1);
    expect(niceMax(7)).toBe(10);
    expect(niceMax(11)).toBe(20);
    expect(niceMax(23)).toBe(25);
    expect(niceMax(26)).toBe(50);
    expect(niceMax(980)).toBe(1000);
    for (const v of [1, 3, 9, 14, 99, 101, 4999, 123456])
      expect(niceMax(v)).toBeGreaterThanOrEqual(v);
  });

  it('C-02 ticks are evenly spaced from zero to the maximum', () => {
    expect(ticks(100)).toEqual([0, 25, 50, 75, 100]);
    expect(ticks(10, 2)).toEqual([0, 5, 10]);
  });

  it('C-03 yFor maps values onto pixel rows and clamps outliers', () => {
    expect(yFor(0, 100, 10, 110)).toBe(110);
    expect(yFor(100, 100, 10, 110)).toBe(10);
    expect(yFor(50, 100, 10, 110)).toBe(60);
    expect(yFor(500, 100, 10, 110)).toBe(10);
    expect(yFor(-5, 100, 10, 110)).toBe(110);
    expect(yFor(5, 0, 10, 110)).toBe(110);
  });

  it('C-04 the smooth line passes through every point and never dips below the lowest one', () => {
    expect(smoothPath([])).toBe('');
    expect(smoothPath([[5, 7]])).toBe('M5,7');
    const points: Array<[number, number]> = [
      [0, 100],
      [10, 100],
      [20, 20],
      [30, 100],
      [40, 100],
    ];
    const path = smoothPath(points);
    expect(path.startsWith('M0,100')).toBe(true);
    // Every control point stays within the vertical range of the data (a monotone curve does not overshoot).
    const numbers = [...path.matchAll(/(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/g)].map((m) =>
      Number(m[2]),
    );
    expect(Math.min(...numbers)).toBeGreaterThanOrEqual(20);
    expect(Math.max(...numbers)).toBeLessThanOrEqual(100);
    for (const [x, y] of points.slice(1)) expect(path).toContain(`${x},${y}`);
  });

  it('C-05 percent and compact rupees read naturally', () => {
    expect(percent(1, 4)).toBe('25%');
    expect(percent(0, 0)).toBe('0%');
    expect(compactRupees(0)).toBe('₹0');
    expect(compactRupees(85000)).toBe('₹850');
    expect(compactRupees(120000)).toBe('₹1.2k');
    expect(compactRupees(34_00_000)).toBe('₹34k');
    expect(compactRupees(3_400_000_0)).toBe('₹3.4L');
    expect(compactRupees(1_10_00_000_00)).toBe('₹1.1Cr');
  });
});

const data = [
  { label: '1 Jan', value: 0 },
  { label: '2 Jan', value: 120000 },
  { label: '3 Jan', value: 80000 },
];
const rupees = (v: number) => `₹${v / 100}`;

describe('charts', () => {
  it('C-06 every chart also exposes its numbers as a table', () => {
    render(<AreaChart title="Money per day" data={data} format={rupees} />);
    const table = screen.getByRole('table', { name: 'Money per day' });
    const rows = within(table).getAllByRole('row');
    expect(rows.map((r) => r.textContent)).toEqual(['1 Jan₹0', '2 Jan₹1200', '3 Jan₹800']);
    expect(screen.getByRole('img', { name: 'Money per day' })).toBeInTheDocument();
  });

  it('C-07 empty and single-point data draw without failing', () => {
    const { rerender } = render(<AreaChart title="Empty" data={[]} />);
    expect(screen.getByRole('img', { name: 'Empty' })).toBeInTheDocument();
    rerender(<AreaChart title="One" data={[{ label: 'x', value: 3 }]} />);
    expect(screen.getByRole('img', { name: 'One' })).toBeInTheDocument();
    rerender(<BarChart title="Bars empty" data={[]} />);
    expect(screen.getByRole('img', { name: 'Bars empty' })).toBeInTheDocument();
    rerender(<BarChart title="Bars zero" data={[{ label: 'a', value: 0 }]} />);
    expect(screen.getByRole('img', { name: 'Bars zero' })).toBeInTheDocument();
  });

  it('C-08 hovering a day shows its label and value; leaving hides it', () => {
    const { container } = render(
      <BarChart title="Bookings" data={data} format={(v) => `${v} sold`} />,
    );
    const hotspots = container.querySelectorAll('svg rect[fill="transparent"]');
    expect(hotspots.length).toBe(3);
    fireEvent.mouseEnter(hotspots[1]!);
    const svg = screen.getByRole('img', { name: 'Bookings' });
    expect(within(svg).getByText('120000 sold')).toBeInTheDocument();
    fireEvent.mouseLeave(hotspots[1]!);
    expect(within(svg).queryByText('120000 sold')).not.toBeInTheDocument();
  });

  it('C-09 the donut shows the total in the middle and each share in the legend', () => {
    render(
      <Donut
        title="Outcomes"
        centerLabel="bookings"
        slices={[
          { label: 'Completed', value: 3, color: 'red' },
          { label: 'Cancelled', value: 1, color: 'blue' },
          { label: 'No-show', value: 0, color: 'green' },
        ]}
      />,
    );
    const svg = screen.getByRole('img', { name: 'Outcomes' });
    expect(within(svg).getByText('4')).toBeInTheDocument();
    const legend = screen.getByRole('list', { name: 'Outcomes legend' });
    expect(within(legend).getByText('Completed').parentElement).toHaveTextContent('3 75%');
    expect(within(legend).getByText('Cancelled').parentElement).toHaveTextContent('1 25%');
    expect(within(legend).getByText('No-show').parentElement).toHaveTextContent('0 0%');
  });

  it('C-10 an empty donut says zero instead of drawing slices', () => {
    render(
      <Donut title="None" centerLabel="things" slices={[{ label: 'A', value: 0, color: 'red' }]} />,
    );
    expect(within(screen.getByRole('img', { name: 'None' })).getByText('0')).toBeInTheDocument();
  });

  it('C-11 the ranked bars are proportional to the largest, with a visible minimum, and nothing for zero', () => {
    const { container } = render(
      <BarList
        title="By drawer"
        format={(v) => `₹${v}`}
        rows={[
          { label: 'Big', value: 1000, hint: '10 bookings' },
          { label: 'Half', value: 500 },
          { label: 'Tiny', value: 1 },
          { label: 'None', value: 0 },
        ]}
      />,
    );
    expect(screen.getByText('10 bookings')).toBeInTheDocument();
    const widths = [...container.querySelectorAll<HTMLElement>('li div[style]')].map(
      (e) => e.style.width,
    );
    expect(widths).toEqual(['100%', '50%', '2%', '0%']);
  });
});
