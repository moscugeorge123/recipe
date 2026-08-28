import type { PipelineStage } from '@prisma/client';

/** Default stage weights totalling 100. Configurable via env in the container. */
export const DEFAULT_STAGE_WEIGHTS: Readonly<Record<PipelineStage, number>> = {
  ACQUIRING_CONTENT: 10,
  PROCESSING_MEDIA: 15,
  TRANSCRIBING: 20,
  ANALYZING_FRAMES: 20,
  RUNNING_OCR: 0,
  EXTRACTING_RECIPE: 20,
  NORMALIZING_RECIPE: 5,
  VALIDATING_RECIPE: 10,
};

export class ProgressCalculator {
  private readonly cumulative: Map<PipelineStage, number>;
  private readonly stageOrder: PipelineStage[];

  constructor(
    stageOrder: readonly PipelineStage[],
    weights: Readonly<Record<PipelineStage, number>> = DEFAULT_STAGE_WEIGHTS,
  ) {
    this.stageOrder = [...stageOrder];
    this.cumulative = new Map();

    let total = 0;
    for (const stage of this.stageOrder) {
      total += weights[stage];
      this.cumulative.set(stage, total);
    }
  }

  /** Progress after a stage completes (0–100). */
  afterStageCompleted(stage: PipelineStage): number {
    return this.cumulative.get(stage) ?? 0;
  }

  /** Progress while a stage is running — midpoint between previous and current weight. */
  whileStageRunning(stage: PipelineStage): number {
    const index = this.stageOrder.indexOf(stage);
    const previousStage = index > 0 ? this.stageOrder[index - 1] : undefined;
    const previous = previousStage ? (this.cumulative.get(previousStage) ?? 0) : 0;
    const current = this.cumulative.get(stage) ?? previous;
    return Math.round((previous + current) / 2);
  }
}
