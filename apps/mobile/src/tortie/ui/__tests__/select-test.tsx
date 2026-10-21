import { fireEvent, render, screen } from '@testing-library/react-native';

import { Select } from '@/tortie/ui/select';

const OPTIONS = [
  { value: 'a', label: 'Alpha' },
  { value: 'b', label: 'Beta' },
  { value: 'c', label: 'Gamma' },
] as const;

describe('Select', () => {
  test('opens, selects, closes and marks the selected option', async () => {
    const onChange = jest.fn();
    await render(
      <Select
        icon="language"
        label="Pick"
        value="b"
        options={OPTIONS}
        onChange={onChange}
      />,
    );
    expect(screen.queryByText('Alpha')).toBeNull();
    expect(screen.getByText('Beta')).toBeTruthy();

    await fireEvent.press(screen.getByRole('combobox'));
    expect(screen.getAllByRole('radio')).toHaveLength(3);
    expect(screen.getByRole('radio', { name: 'Beta' })).toBeSelected();
    expect(screen.getByRole('radio', { name: 'Alpha' })).not.toBeSelected();

    await fireEvent.press(screen.getByRole('radio', { name: 'Gamma' }));
    expect(onChange).toHaveBeenCalledWith('c');
    expect(screen.queryAllByRole('radio')).toHaveLength(0);
  });
});
