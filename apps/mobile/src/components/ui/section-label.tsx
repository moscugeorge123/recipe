import { Text } from '@/components/ui/text';
import { fonts } from '@/theme/tokens';

type SectionLabelProps = {
  children: string;
  className?: string;
};

export function SectionLabel({ children, className }: SectionLabelProps) {
  return (
    <Text
      variant="section"
      className={className}
      style={{ fontFamily: fonts.manrope700 }}
    >
      {children}
    </Text>
  );
}
