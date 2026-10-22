import { kicker, T } from '@/tortie/ui/text';

/**
 * Heading over a run of ingredients or steps that make one part of the dish
 * ("For the sponge", "Make the cream"). `first` drops the top gap above the first run.
 */
export function SectionHead({
  children,
  first = false,
}: {
  children: string;
  first?: boolean;
}) {
  return (
    <T
      accessibilityRole="header"
      style={[kicker(), { marginTop: first ? 6 : 24, marginBottom: 2 }]}
    >
      {children}
    </T>
  );
}
