import * as Haptics from 'expo-haptics';

export async function hapticLight(): Promise<void> {
  try {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  } catch {
    // Web / unsupported
  }
}

/** Selection haptic (long-press into cookbook multi-select). */
export async function hapticSelection(): Promise<void> {
  try {
    await Haptics.selectionAsync();
  } catch {
    // Web / unsupported
  }
}

export async function hapticMedium(): Promise<void> {
  try {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  } catch {
    // Web / unsupported
  }
}

export async function hapticSuccess(): Promise<void> {
  try {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  } catch {
    // Web / unsupported
  }
}

export async function hapticWarning(): Promise<void> {
  try {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
  } catch {
    // Web / unsupported
  }
}
