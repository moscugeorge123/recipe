import { File } from 'expo-file-system';

/** Largest photo the API accepts (10 MB); checked here so a huge file fails before uploading. */
export const MAX_PHOTO_BYTES = 10 * 1024 * 1024;

export class PhotoFileError extends Error {
  constructor(
    readonly code: 'PHOTO_UNREADABLE' | 'PAYLOAD_TOO_LARGE',
    message: string,
  ) {
    super(message);
    this.name = 'PhotoFileError';
  }
}

/** Base64 contents of a camera or library photo. */
export async function readPhotoAsBase64(uri: string): Promise<string> {
  let file: File;
  try {
    file = new File(uri);
    if (file.exists && file.size > MAX_PHOTO_BYTES) {
      throw new PhotoFileError('PAYLOAD_TOO_LARGE', 'Photo is too large');
    }
    return await file.base64();
  } catch (error) {
    if (error instanceof PhotoFileError) throw error;
    throw new PhotoFileError('PHOTO_UNREADABLE', 'Could not read the photo');
  }
}
