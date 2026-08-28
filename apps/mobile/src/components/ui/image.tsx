import { Image, type ImageProps } from 'expo-image';
import { cssInterop } from 'nativewind';

cssInterop(Image, { className: 'style' });

type AppImageProps = ImageProps & {
  className?: string;
};

export function AppImage(props: AppImageProps) {
  return <Image {...props} />;
}
