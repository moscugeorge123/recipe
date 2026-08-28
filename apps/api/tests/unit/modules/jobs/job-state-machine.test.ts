import { describe, expect, it } from 'vitest';

import { JobStateMachine } from '../../../../src/modules/jobs/domain/job-state-machine.js';

describe('JobStateMachine', () => {
  const machine = new JobStateMachine();

  it('allows valid forward transitions', () => {
    expect(() => {
      machine.assertTransition('QUEUED', 'ACQUIRING_CONTENT');
    }).not.toThrow();
    expect(() => {
      machine.assertTransition('ACQUIRING_CONTENT', 'CONTENT_ACQUIRED');
    }).not.toThrow();
    expect(() => {
      machine.assertTransition('CONTENT_ACQUIRED', 'PROCESSING_MEDIA');
    }).not.toThrow();
    expect(() => {
      machine.assertTransition('VALIDATING_RECIPE', 'COMPLETED');
    }).not.toThrow();
  });

  it('rejects invalid transitions', () => {
    expect(() => {
      machine.assertTransition('QUEUED', 'COMPLETED');
    }).toThrow();
    expect(() => {
      machine.assertTransition('COMPLETED', 'QUEUED');
    }).toThrow();
  });

  it('identifies cancellable statuses', () => {
    expect(machine.canCancel('QUEUED')).toBe(true);
    expect(machine.canCancel('ACQUIRING_CONTENT')).toBe(true);
    expect(machine.canCancel('TRANSCRIBING')).toBe(false);
    expect(machine.canCancel('COMPLETED')).toBe(false);
  });

  it('identifies terminal statuses', () => {
    expect(machine.isTerminal('COMPLETED')).toBe(true);
    expect(machine.isTerminal('FAILED')).toBe(true);
    expect(machine.isTerminal('CANCELLED')).toBe(true);
    expect(machine.isTerminal('PROCESSING_MEDIA')).toBe(false);
  });
});
