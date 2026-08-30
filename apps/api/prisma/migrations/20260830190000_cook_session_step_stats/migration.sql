-- AlterTable
ALTER TABLE "cook_sessions" ADD COLUMN "currentStepEnteredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateTable
CREATE TABLE "cook_session_step_stats" (
    "id" UUID NOT NULL,
    "sessionId" UUID NOT NULL,
    "stepIndex" INTEGER NOT NULL,
    "visitCount" INTEGER NOT NULL DEFAULT 0,
    "durationMs" INTEGER NOT NULL DEFAULT 0,
    "firstEnteredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastEnteredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cook_session_step_stats_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "cook_session_step_stats_sessionId_stepIndex_key" ON "cook_session_step_stats"("sessionId", "stepIndex");

-- CreateIndex
CREATE INDEX "cook_session_step_stats_sessionId_idx" ON "cook_session_step_stats"("sessionId");

-- AddForeignKey
ALTER TABLE "cook_session_step_stats" ADD CONSTRAINT "cook_session_step_stats_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "cook_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Seed a first-visit row for sessions created before step stats existed.
INSERT INTO "cook_session_step_stats" ("id", "sessionId", "stepIndex", "visitCount", "durationMs", "firstEnteredAt", "lastEnteredAt")
SELECT gen_random_uuid(), "id", "currentStepIndex", 1, 0, "startedAt", "updatedAt"
FROM "cook_sessions";
