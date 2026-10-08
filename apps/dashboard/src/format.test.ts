import { describe, expect, it } from 'vitest';

import { formatDuration, formatTokens, formatUsd, stageLabel } from './format';

describe('formatUsd', () => {
  it('renders zero with two fraction digits', () => {
    expect(formatUsd(0)).toBe('$0.00');
    expect(formatUsd(-0)).toBe('$0.00');
  });

  it('uses four fraction digits below one cent', () => {
    expect(formatUsd(0.0027)).toBe('$0.0027');
    expect(formatUsd(-0.0027)).toBe('-$0.0027');
  });

  it('uses two fraction digits at and above one cent', () => {
    expect(formatUsd(0.01)).toBe('$0.01');
    expect(formatUsd(0.013365)).toBe('$0.01');
    expect(formatUsd(1.5)).toBe('$1.50');
    expect(formatUsd(12)).toBe('$12.00');
  });
});

describe('formatDuration', () => {
  it('renders a dash when time is missing', () => {
    expect(formatDuration(null)).toBe('—');
    expect(formatDuration(undefined)).toBe('—');
  });

  it('renders sub-second values in milliseconds', () => {
    expect(formatDuration(840)).toBe('840 ms');
    expect(formatDuration(0)).toBe('0 ms');
  });

  it('renders seconds under ten with one decimal', () => {
    expect(formatDuration(1000)).toBe('1.0s');
    expect(formatDuration(1800)).toBe('1.8s');
  });

  it('renders longer seconds as a rounded whole number', () => {
    expect(formatDuration(18000)).toBe('18s');
    expect(formatDuration(10500)).toBe('11s');
  });

  it('renders minutes and seconds at a minute and beyond', () => {
    expect(formatDuration(60000)).toBe('1m 0s');
    expect(formatDuration(72000)).toBe('1m 12s');
  });
});

describe('stageLabel', () => {
  it('humanizes pipeline stage names', () => {
    expect(stageLabel('ACQUIRING_CONTENT')).toBe('Acquiring content');
    expect(stageLabel('RUNNING_OCR')).toBe('Running OCR');
  });
});

describe('formatTokens', () => {
  it('groups thousands', () => {
    expect(formatTokens(0)).toBe('0');
    expect(formatTokens(8100)).toBe('8,100');
    expect(formatTokens(39300)).toBe('39,300');
  });
});
