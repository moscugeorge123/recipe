import { JobNotFoundError } from '../../../shared/errors/extraction-errors.js';
import { silentLogger, type AppLogger } from '../../../infrastructure/logging/logger.js';
import { logStep } from '../../../infrastructure/logging/log-step.js';
import { tracePhotoImport } from '../../../infrastructure/logging/photo-import-trace.js';
import { isPhotoSourceUrl } from '../../content/providers/photo/photo-source.js';
import type { IExtractionJobRepository } from '../../jobs/repository/extraction-job.repository.js';
import type { IRecipeSourceRepository } from '../../recipes/repository/recipe-source.repository.js';
import type { PipelineContext, StageOrchestrator } from './stage-orchestrator.js';

export class RecipeExtractionPipeline {
  constructor(
    private readonly jobRepo: IExtractionJobRepository,
    private readonly sourceRepo: IRecipeSourceRepository,
    private readonly orchestrator: StageOrchestrator,
    private readonly log: AppLogger = silentLogger(),
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

    const photo = isPhotoSourceUrl(source.originalUrl);
    if (photo) {
      tracePhotoImport({
        jobId,
        step: 'pipeline.execute',
        phase: 'started',
        data: {
          sourceUrl: source.originalUrl,
          sourceType: source.sourceType,
          outputLanguage: job.outputLanguage,
          status: job.status,
          options: job.options ?? null,
        },
      });
    }

    try {
      await logStep(
        this.log.child({ jobId }),
        'pipeline.execute',
        { sourceUrl: source.originalUrl, outputLanguage: job.outputLanguage, status: job.status },
        () => this.orchestrator.runStages(ctx),
      );
      if (photo) {
        tracePhotoImport({
          jobId,
          step: 'pipeline.execute',
          phase: 'completed',
          data: { recipeId: ctx.recipeId ?? null, sourceUrl: source.originalUrl },
        });
      }
    } catch (error: unknown) {
      if (photo) {
        tracePhotoImport({
          jobId,
          step: 'pipeline.execute',
          phase: 'failed',
          data: { sourceUrl: source.originalUrl },
          error,
        });
      }
      throw error;
    }
  }
}
