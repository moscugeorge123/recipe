import { fireEvent, render, screen } from '@testing-library/react-native';

import { useNav } from '@/tortie/nav-store';
import { ProfileButton, profileInitials } from '@/tortie/ui/profile-button';

describe('profileInitials', () => {
  it('takes up to two initials', () => {
    expect(profileInitials('Ana Maria Pop')).toBe('AM');
    expect(profileInitials('ana')).toBe('A');
    expect(profileInitials('')).toBe('?');
    expect(profileInitials(null)).toBe('?');
  });
});

describe('ProfileButton', () => {
  it('opens Profile when pressed, expanded and compact', async () => {
    const openProfile = jest.fn();
    useNav.setState({ openProfile });
    const { rerender } = await render(<ProfileButton compact={false} />);
    await fireEvent.press(screen.getByLabelText('Profile'));
    expect(openProfile).toHaveBeenCalledTimes(1);
    await rerender(<ProfileButton compact />);
    await fireEvent.press(screen.getByLabelText('Profile'));
    expect(openProfile).toHaveBeenCalledTimes(2);
  });
});
