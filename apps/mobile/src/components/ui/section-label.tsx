import { Text } from '@/components/ui/text';

type SectionLabelProps = {
  children: string;
  className?: string;
};

export function SectionLabel({ children, className }: SectionLabelProps) {
  return (
    <Text variant="section" className={className}>
      {children}
    </Text>
  );
}
