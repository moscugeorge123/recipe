-- Firebase authentication: every data path is scoped to the signed-in user.

-- Extraction jobs remember who requested them. NULL for jobs created before accounts existed.
ALTER TABLE "extraction_jobs" ADD COLUMN "requestedByUserId" UUID;

-- CreateIndex
CREATE INDEX "extraction_jobs_requestedByUserId_idx" ON "extraction_jobs"("requestedByUserId");

-- AddForeignKey
ALTER TABLE "extraction_jobs" ADD CONSTRAINT "extraction_jobs_requestedByUserId_fkey" FOREIGN KEY ("requestedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Cook sessions must always be created for an explicit user; the implicit default-profile fallback goes away.
ALTER TABLE "cook_sessions" ALTER COLUMN "userId" DROP DEFAULT;
