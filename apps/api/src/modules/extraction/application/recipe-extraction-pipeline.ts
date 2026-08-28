import { JobNotFoundError } from '../../../shared/errors/extraction-errors.js';
import type { IExtractionJobRepository } from '../../jobs/repository/extraction-job.repository.js';
import type { IRecipeSourceRepository } from '../../recipes/repository/recipe-source.repository.js';
import type { PipelineContext, StageOrchestrator } from './stage-orchestrator.js';

export class RecipeExtractionPipeline {
  constructor(
    private readonly jobRepo: IExtractionJobRepository,
    private readonly sourceRepo: IRecipeSourceRepository,
    private readonly orchestrator: StageOrchestrator,
  ) {}

  async execute(jobId: string): Promise<void> {
    const job = await this.jobRepo.findById(jobId);
    if (!job) {
      throw new JobNotFoundError();
    }

    if (job.status === 'COMPLETED' || job.status === 'CANCELLED') {
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

    await this.orchestrator.runStages(ctx);
  }
}
