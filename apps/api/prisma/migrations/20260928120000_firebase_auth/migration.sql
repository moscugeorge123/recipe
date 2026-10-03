-- CreateEnum
CREATE TYPE "AppRole" AS ENUM ('USER', 'ADMIN');

-- CreateEnum
CREATE TYPE "RecipeVisibility" AS ENUM ('PRIVATE', 'UNLISTED', 'PUBLIC');

-- CreateEnum
CREATE TYPE "AuthAuditEvent" AS ENUM (
  'USER_REGISTERED',
  'USER_LOGIN',
  'USER_LOGOUT',
  'USER_EMAIL_VERIFIED',
  'USER_PHONE_VERIFIED',
  'PROVIDER_LINKED',
  'PROVIDER_UNLINKED',
  'PASSWORD_CHANGED',
  'EMAIL_CHANGED',
  'PHONE_CHANGED',
  'ACCOUNT_DELETED',
  'FAILED_LOGIN',
  'PASSWORD_RESET_REQUESTED'
);

-- AlterTable
ALTER TABLE "users"
  ADD COLUMN "firebaseUid" TEXT,
  ADD COLUMN "username" TEXT,
  ADD COLUMN "usernameNormalized" TEXT,
  ADD COLUMN "photoUrl" TEXT,
  ADD COLUMN "phoneNumber" TEXT,
  ADD COLUMN "emailVerified" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "phoneVerified" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "providers" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "onboardingCompleted" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "role" "AppRole" NOT NULL DEFAULT 'USER',
  ADD COLUMN "lastLoginAt" TIMESTAMP(3),
  ADD COLUMN "deletedAt" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "users_firebaseUid_key" ON "users"("firebaseUid");

-- CreateIndex
CREATE UNIQUE INDEX "users_usernameNormalized_key" ON "users"("usernameNormalized");

-- AlterTable
ALTER TABLE "user_recipes"
  ADD COLUMN "visibility" "RecipeVisibility" NOT NULL DEFAULT 'PRIVATE';

-- CreateTable
CREATE TABLE "usernames" (
    "usernameNormalized" TEXT NOT NULL,
    "firebaseUid" TEXT NOT NULL,
    "userId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "usernames_pkey" PRIMARY KEY ("usernameNormalized")
);

-- CreateTable
CREATE TABLE "auth_audits" (
    "id" UUID NOT NULL,
    "userId" UUID,
    "firebaseUid" TEXT,
    "event" "AuthAuditEvent" NOT NULL,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auth_audits_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "usernames_userId_key" ON "usernames"("userId");

-- CreateIndex
CREATE INDEX "usernames_firebaseUid_idx" ON "usernames"("firebaseUid");

-- CreateIndex
CREATE INDEX "auth_audits_firebaseUid_createdAt_idx" ON "auth_audits"("firebaseUid", "createdAt");

-- CreateIndex
CREATE INDEX "auth_audits_event_createdAt_idx" ON "auth_audits"("event", "createdAt");

-- AddForeignKey
ALTER TABLE "usernames" ADD CONSTRAINT "usernames_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auth_audits" ADD CONSTRAINT "auth_audits_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
