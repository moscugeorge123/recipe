-- CreateTable
CREATE TABLE "provider_usage" (
    "id" UUID NOT NULL,
    "jobId" UUID NOT NULL,
    "provider" TEXT NOT NULL,
    "operation" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "units" INTEGER NOT NULL DEFAULT 1,
    "estimatedCostUsd" DECIMAL(10,6) NOT NULL DEFAULT 0,
    "durationMs" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "provider_usage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "provider_usage_jobId_idx" ON "provider_usage"("jobId");

-- AddForeignKey
ALTER TABLE "provider_usage" ADD CONSTRAINT "provider_usage_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "extraction_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
