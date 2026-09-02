import { View, type ViewProps } from 'react-native';

type CardProps = ViewProps & {
  className?: string;
};

export function Card({ className, ...props }: CardProps) {
  return (
    <View
      className={`rounded-lg border border-crust bg-bg p-6 ${className ?? ''}`}
      {...props}
    />
  );
}
