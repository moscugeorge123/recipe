const PICTOGRAPHIC = /\p{Extended_Pictographic}/u;

/** One emoji grapheme, including ZWJ / VS16 / skin-tone sequences. */
const ONE_EMOJI_SEQUENCE =
  /^(?:\p{Extended_Pictographic}(?:\uFE0F|\uFE0E)?(?:\u{1F3FB}|\u{1F3FC}|\u{1F3FD}|\u{1F3FE}|\u{1F3FF})?(?:\u200D\p{Extended_Pictographic}(?:\uFE0F|\uFE0E)?(?:\u{1F3FB}|\u{1F3FC}|\u{1F3FD}|\u{1F3FE}|\u{1F3FF})?)*)$/u;

type GraphemeSegmenter = {
  segment: (input: string) => Iterable<{ segment: string }>;
};

type SegmenterConstructor = new (
  locales?: string | string[],
  options?: { granularity?: 'grapheme' | 'word' | 'sentence' },
) => GraphemeSegmenter;

function getSegmenterConstructor(): SegmenterConstructor | undefined {
  const ctor = (
    Intl as typeof Intl & { Segmenter?: SegmenterConstructor }
  ).Segmenter;
  return typeof ctor === 'function' ? ctor : undefined;
}

/** True when `value` is exactly one emoji (Hermes-safe; no Intl.Segmenter required). */
export function isOneEmoji(value: string): boolean {
  if (!value || !PICTOGRAPHIC.test(value)) {
    return false;
  }

  const Segmenter = getSegmenterConstructor();
  if (Segmenter) {
    return (
      [...new Segmenter(undefined, { granularity: 'grapheme' }).segment(value)]
        .length === 1
    );
  }

  return ONE_EMOJI_SEQUENCE.test(value);
}
