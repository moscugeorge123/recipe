import * as ImagePicker from 'expo-image-picker';

export type PickResult =
  | { status: 'ok'; uri: string }
  | { status: 'cancelled' }
  | { status: 'denied'; canAskAgain: boolean };

const OPTIONS: ImagePicker.ImagePickerOptions = {
  mediaTypes: ['images'],
  allowsEditing: true,
  aspect: [1, 1],
  // No image manipulator is installed, so quality is the only size lever.
  quality: 0.4,
};

/** Asks for the permission lazily, then opens the camera or the photo library with a square crop. */
export async function pickAvatar(
  source: 'camera' | 'library',
): Promise<PickResult> {
  if (source === 'camera') {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      return { status: 'denied', canAskAgain: perm.canAskAgain };
    }
  }
  const res =
    source === 'camera'
      ? await ImagePicker.launchCameraAsync(OPTIONS)
      : await ImagePicker.launchImageLibraryAsync(OPTIONS);
  const uri = res.canceled ? null : res.assets[0]?.uri;
  return uri ? { status: 'ok', uri } : { status: 'cancelled' };
}
