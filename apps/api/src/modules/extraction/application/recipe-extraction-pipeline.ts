import { JobNotFoundError } from '../../../shared/errors/extraction-errors.js';
import { silentLogger, type AppLogger } from '../../../infrastructure/logging/logger.js';
import { logStep } from '../../../infrastructure/logging/log-step.js';
import type { IExtractionJobRepository } from '../../jobs/repository/extraction-job.repository.js';
import type { IRecipeSourceRepository } from '../../recipes/repository/recipe-source.repository.js';
import type { PipelineContext, StageOrchestrator } from './stage-orchestrator.js';

export class RecipeExtractionPipeline {
  constructor(
    private readonly jobRepo: IExtractionJobRepository,
    private readonly sourceRepo: IRecipeSourceRepository,
    private readonly orchestrator: StageOrchestrator,
    private readonly log: AppLogger = silentLogger(),
    private readonly onImportComplete?: (recipeId: string) => Promise<void>,
  ) {}

  async execute(jobId: string): Promise<void> {
    const job = await this.jobRepo.findById(jobId);
    if (!job) {
      throw new JobNotFoundError();
    }

    if (job.status === 'COMPLETED' || job.status === 'CANCELLED') {
      this.log.info(
        { step: 'pipeline.execute', jobId, status: job.status },
        'pipeline.execute skipped',
      );
      return;
    }

    const source = await this.sourceRepo.findById(job.recipeSourceId);
    if (!source) {
      throw new JobNotFoundError({ message: 'Recipe source not found for job' });
    }

    const ctx: PipelineContext = {
      jobId,
      sourceUrl: source.originalUrl,
      outputLanguage: job.outputLanguage,
    };

    await logStep(
      this.log.child({ jobId }),
      'pipeline.execute',
      { sourceUrl: source.originalUrl, outputLanguage: job.outputLanguage, status: job.status },
      () => this.orchestrator.runStages(ctx),
    );

    const completed = await this.jobRepo.findById(jobId);
    if (completed?.status === 'COMPLETED' && completed.recipeId && this.onImportComplete) {
      try {
        await this.onImportComplete(completed.recipeId);
      } catch (error: unknown) {
        this.log.warn(
          { step: 'nutrition.enqueue', jobId, recipeId: completed.recipeId, err: error },
          'nutrition.enqueue failed',
        );
      }
    }
  }
}
