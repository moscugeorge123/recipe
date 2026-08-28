-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "SourceType" AS ENUM ('INSTAGRAM', 'YOUTUBE', 'FACEBOOK', 'TIKTOK', 'GENERIC_WEB');

-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('QUEUED', 'ACQUIRING_CONTENT', 'CONTENT_ACQUIRED', 'PROCESSING_MEDIA', 'TRANSCRIBING', 'ANALYZING_FRAMES', 'RUNNING_OCR', 'EXTRACTING_RECIPE', 'NORMALIZING_RECIPE', 'VALIDATING_RECIPE', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PipelineStage" AS ENUM ('ACQUIRING_CONTENT', 'PROCESSING_MEDIA', 'TRANSCRIBING', 'ANALYZING_FRAMES', 'RUNNING_OCR', 'EXTRACTING_RECIPE', 'NORMALIZING_RECIPE', 'VALIDATING_RECIPE');

-- CreateEnum
CREATE TYPE "StageStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "AssetType" AS ENUM ('VIDEO', 'AUDIO', 'IMAGE', 'THUMBNAIL', 'FRAME');

-- CreateEnum
CREATE TYPE "EvidenceType" AS ENUM ('CAPTION', 'DESCRIPTION', 'TRANSCRIPT', 'OCR', 'VISION', 'METADATA');

-- CreateEnum
CREATE TYPE "EvidenceSource" AS ENUM ('CAPTION', 'TRANSCRIPT', 'OCR', 'VISION', 'METADATA', 'LLM');

-- CreateTable
CREATE TABLE "recipe_sources" (
    "id" UUID NOT NULL,
    "sourceType" "SourceType" NOT NULL,
    "originalUrl" TEXT NOT NULL,
    "normalizedUrl" TEXT NOT NULL,
    "urlHash" TEXT NOT NULL,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recipe_sources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "extraction_jobs" (
    "id" UUID NOT NULL,
    "recipeSourceId" UUID NOT NULL,
    "recipeId" UUID,
    "status" "JobStatus" NOT NULL DEFAULT 'QUEUED',
    "progress" INTEGER NOT NULL DEFAULT 0,
    "currentStage" TEXT,
    "sourceLanguage" TEXT,
    "outputLanguage" TEXT NOT NULL DEFAULT 'en',
    "options" JSONB NOT NULL DEFAULT '{}',
    "error" JSONB,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "extraction_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "extraction_stages" (
    "id" UUID NOT NULL,
    "jobId" UUID NOT NULL,
    "stage" "PipelineStage" NOT NULL,
    "status" "StageStatus" NOT NULL DEFAULT 'PENDING',
    "progress" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "durationMs" INTEGER,
    "error" JSONB,
    "attempt" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "extraction_stages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recipes" (
    "id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "servings" INTEGER,
    "prepTimeMinutes" INTEGER,
    "cookTimeMinutes" INTEGER,
    "totalTimeMinutes" INTEGER,
    "sourceLanguage" TEXT,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "warnings" JSONB NOT NULL DEFAULT '[]',
    "promptVersion" TEXT,
    "rawExtraction" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "recipeSourceId" UUID NOT NULL,

    CONSTRAINT "recipes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recipe_ingredients" (
    "id" UUID NOT NULL,
    "recipeId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "canonicalName" TEXT,
    "quantity" DECIMAL(10,3),
    "unit" TEXT,
    "preparation" TEXT,
    "optional" BOOLEAN NOT NULL DEFAULT false,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "provenance" JSONB NOT NULL DEFAULT '{}',
    "warnings" JSONB NOT NULL DEFAULT '[]',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "recipe_ingredients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recipe_steps" (
    "id" UUID NOT NULL,
    "recipeId" UUID NOT NULL,
    "stepOrder" INTEGER NOT NULL,
    "instruction" TEXT NOT NULL,
    "durationMinutes" INTEGER,
    "temperature" TEXT,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "provenance" JSONB NOT NULL DEFAULT '{}',
    "warnings" JSONB NOT NULL DEFAULT '[]',

    CONSTRAINT "recipe_steps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "media_assets" (
    "id" UUID NOT NULL,
    "jobId" UUID NOT NULL,
    "assetType" "AssetType" NOT NULL,
    "storageKey" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" BIGINT NOT NULL DEFAULT 0,
    "durationSeconds" INTEGER,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "media_assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transcripts" (
    "id" UUID NOT NULL,
    "mediaAssetId" UUID NOT NULL,
    "language" TEXT NOT NULL,
    "fullText" TEXT NOT NULL,
    "provider" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "transcripts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transcript_segments" (
    "id" UUID NOT NULL,
    "transcriptId" UUID NOT NULL,
    "startSeconds" DOUBLE PRECISION NOT NULL,
    "endSeconds" DOUBLE PRECISION NOT NULL,
    "text" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0,

    CONSTRAINT "transcript_segments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ocr_results" (
    "id" UUID NOT NULL,
    "mediaAssetId" UUID NOT NULL,
    "text" TEXT NOT NULL,
    "timestampSeconds" DOUBLE PRECISION,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "boundingBoxes" JSONB NOT NULL DEFAULT '[]',
    "provider" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "ocr_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vision_analyses" (
    "id" UUID NOT NULL,
    "mediaAssetId" UUID NOT NULL,
    "observations" JSONB NOT NULL DEFAULT '[]',
    "timestampSeconds" DOUBLE PRECISION,
    "provider" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "vision_analyses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "extraction_evidence" (
    "id" UUID NOT NULL,
    "jobId" UUID NOT NULL,
    "evidenceType" "EvidenceType" NOT NULL,
    "value" TEXT NOT NULL,
    "source" "EvidenceSource" NOT NULL,
    "timestampSeconds" DOUBLE PRECISION,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "recipeId" UUID,

    CONSTRAINT "extraction_evidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_usage" (
    "id" UUID NOT NULL,
    "jobId" UUID NOT NULL,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "operation" TEXT NOT NULL,
    "inputTokens" INTEGER NOT NULL DEFAULT 0,
    "outputTokens" INTEGER NOT NULL DEFAULT 0,
    "estimatedCostUsd" DECIMAL(10,6) NOT NULL DEFAULT 0,
    "durationMs" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_usage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "recipe_sources_urlHash_key" ON "recipe_sources"("urlHash");

-- CreateIndex
CREATE INDEX "recipe_sources_sourceType_createdAt_idx" ON "recipe_sources"("sourceType", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "extraction_jobs_recipeId_key" ON "extraction_jobs"("recipeId");

-- CreateIndex
CREATE INDEX "extraction_jobs_status_idx" ON "extraction_jobs"("status");

-- CreateIndex
CREATE INDEX "extraction_jobs_createdAt_idx" ON "extraction_jobs"("createdAt");

-- CreateIndex
CREATE INDEX "extraction_stages_jobId_idx" ON "extraction_stages"("jobId");

-- CreateIndex
CREATE UNIQUE INDEX "recipes_recipeSourceId_key" ON "recipes"("recipeSourceId");

-- CreateIndex
CREATE INDEX "recipes_createdAt_idx" ON "recipes"("createdAt");

-- CreateIndex
CREATE INDEX "recipe_ingredients_canonicalName_idx" ON "recipe_ingredients"("canonicalName");

-- CreateIndex
CREATE INDEX "media_assets_jobId_idx" ON "media_assets"("jobId");

-- CreateIndex
CREATE UNIQUE INDEX "transcripts_mediaAssetId_key" ON "transcripts"("mediaAssetId");

-- CreateIndex
CREATE INDEX "extraction_evidence_jobId_idx" ON "extraction_evidence"("jobId");

-- CreateIndex
CREATE INDEX "ai_usage_jobId_idx" ON "ai_usage"("jobId");

-- AddForeignKey
ALTER TABLE "extraction_jobs" ADD CONSTRAINT "extraction_jobs_recipeSourceId_fkey" FOREIGN KEY ("recipeSourceId") REFERENCES "recipe_sources"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "extraction_jobs" ADD CONSTRAINT "extraction_jobs_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "recipes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "extraction_stages" ADD CONSTRAINT "extraction_stages_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "extraction_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recipes" ADD CONSTRAINT "recipes_recipeSourceId_fkey" FOREIGN KEY ("recipeSourceId") REFERENCES "recipe_sources"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recipe_ingredients" ADD CONSTRAINT "recipe_ingredients_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "recipes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recipe_steps" ADD CONSTRAINT "recipe_steps_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "recipes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "extraction_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transcripts" ADD CONSTRAINT "transcripts_mediaAssetId_fkey" FOREIGN KEY ("mediaAssetId") REFERENCES "media_assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transcript_segments" ADD CONSTRAINT "transcript_segments_transcriptId_fkey" FOREIGN KEY ("transcriptId") REFERENCES "transcripts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ocr_results" ADD CONSTRAINT "ocr_results_mediaAssetId_fkey" FOREIGN KEY ("mediaAssetId") REFERENCES "media_assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vision_analyses" ADD CONSTRAINT "vision_analyses_mediaAssetId_fkey" FOREIGN KEY ("mediaAssetId") REFERENCES "media_assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "extraction_evidence" ADD CONSTRAINT "extraction_evidence_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "extraction_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "extraction_evidence" ADD CONSTRAINT "extraction_evidence_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "recipes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_usage" ADD CONSTRAINT "ai_usage_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "extraction_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

