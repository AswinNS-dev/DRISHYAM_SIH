import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import GeographicScopeBar from '../components/network/GeographicScopeBar';

vi.mock('../services/api', () => ({
  getStates: vi.fn().mockResolvedValue([
    { id: 'st-1', state_name: 'Karnataka', state_code: 'KA' },
    { id: 'st-2', state_name: 'Maharashtra', state_code: 'MH' },
  ]),
  getDistricts: vi.fn().mockResolvedValue([
    { id: 'dist-1', district_name: 'Dharwad', district_code: 'DHD' },
    { id: 'dist-2', district_name: 'Belagavi', district_code: 'BGV' },
  ]),
  getPoliceStations: vi.fn().mockResolvedValue([
    { id: 'ps-1', station_name: 'Hubli City Police Station', station_code: 'HBL-01' },
    { id: 'ps-2', station_name: 'Dharwad Town Station', station_code: 'DHD-01' },
  ]),
}));

describe('GeographicScopeBar Component', () => {
  const defaultProps = {
    selectedState: 'Karnataka',
    onStateChange: vi.fn(),
    selectedDistrict: 'Dharwad',
    onDistrictChange: vi.fn(),
    selectedCity: 'Hubli City Police Station',
    onCityChange: vi.fn(),
    scope: 'city' as const,
    onScopeChange: vi.fn(),
    onExpandScope: vi.fn(),
    searchQuery: '',
    onSearchChange: vi.fn(),
    searchGlobal: false,
    onToggleSearchGlobal: vi.fn(),
    nodeCount: 113,
    edgeCount: 143,
    loading: false,
  };

  it('renders breadcrumb indicating the active geographic jurisdiction', async () => {
    render(<GeographicScopeBar {...defaultProps} />);
    expect(screen.getByText(/Showing network for:/i)).toBeInTheDocument();
    expect(screen.getByText(/Hubli City Police Station, Dharwad District, Karnataka/i)).toBeInTheDocument();
  });

  it('renders node and edge count badges', () => {
    render(<GeographicScopeBar {...defaultProps} />);
    expect(screen.getByText('113')).toBeInTheDocument();
    expect(screen.getByText('143')).toBeInTheDocument();
  });

  it('renders quick scope expansion buttons and triggers handlers', () => {
    render(<GeographicScopeBar {...defaultProps} />);
    const expandDistrictBtn = screen.getByRole('button', { name: /Expand to District/i });
    expect(expandDistrictBtn).toBeInTheDocument();
    fireEvent.click(expandDistrictBtn);
    expect(defaultProps.onExpandScope).toHaveBeenCalledWith('district');

    const expandStateBtn = screen.getByRole('button', { name: /Expand to State/i });
    expect(expandStateBtn).toBeInTheDocument();
    fireEvent.click(expandStateBtn);
    expect(defaultProps.onExpandScope).toHaveBeenCalledWith('state');
  });

  it('handles search input change and global search toggle', () => {
    render(<GeographicScopeBar {...defaultProps} />);
    const searchInput = screen.getByPlaceholderText(/Search within Hubli City Police Station/i);
    fireEvent.change(searchInput, { target: { value: 'Kumar' } });
    expect(defaultProps.onSearchChange).toHaveBeenCalledWith('Kumar');

    const toggleGlobalBtn = screen.getByRole('button', { name: /Scope Only/i });
    fireEvent.click(toggleGlobalBtn);
    expect(defaultProps.onToggleSearchGlobal).toHaveBeenCalled();
  });
});
