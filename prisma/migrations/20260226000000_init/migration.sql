-- CreateEnum
CREATE TYPE "SourceType" AS ENUM ('news', 'youtube', 'bluesky', 'government');

-- CreateEnum
CREATE TYPE "Importance" AS ENUM ('high', 'medium', 'low');

-- CreateEnum
CREATE TYPE "DigestFrequency" AS ENUM ('daily', 'weekly');

-- CreateEnum
CREATE TYPE "ImportanceFilter" AS ENUM ('high_only', 'high_and_medium', 'all');

-- CreateEnum
CREATE TYPE "ClipBucket" AS ENUM ('news_clip', 'public_meeting');

-- CreateEnum
CREATE TYPE "PostStatus" AS ENUM ('draft', 'posted', 'failed');

-- CreateTable
CREATE TABLE "Location" (
    "id" TEXT NOT NULL,
    "city" TEXT,
    "county" TEXT,
    "state" CHAR(2) NOT NULL,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "firstSeen" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "clipCount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Location_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Clip" (
    "id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT,
    "content" TEXT,
    "sourceType" "SourceType" NOT NULL,
    "sourceName" TEXT NOT NULL,
    "publishedAt" TIMESTAMP(3),
    "discoveredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "locationId" TEXT,
    "importance" "Importance" NOT NULL DEFAULT 'medium',
    "topics" TEXT[],
    "rawData" JSONB,
    "bucket" "ClipBucket" NOT NULL DEFAULT 'news_clip',
    "durationSecs" INTEGER,
    "transcript" TEXT,
    "thumbnailPath" TEXT,
    "relevanceScore" INTEGER,
    "companies" TEXT[],
    "govEntities" TEXT[],
    "videoId" TEXT,

    CONSTRAINT "Clip_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "linkedinAccessToken" TEXT,
    "linkedinTokenExpiry" TIMESTAMP(3),

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DigestPreference" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "frequency" "DigestFrequency" NOT NULL DEFAULT 'daily',
    "topics" TEXT[],
    "states" TEXT[],
    "importance" "ImportanceFilter" NOT NULL DEFAULT 'high_and_medium',

    CONSTRAINT "DigestPreference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Star" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "clipId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Star_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LinkedInPost" (
    "id" TEXT NOT NULL,
    "clipId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "draftText" TEXT NOT NULL,
    "finalText" TEXT,
    "linkedInId" TEXT,
    "status" "PostStatus" NOT NULL DEFAULT 'draft',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "postedAt" TIMESTAMP(3),

    CONSTRAINT "LinkedInPost_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Location_city_county_state_key" ON "Location"("city", "county", "state");

-- CreateIndex
CREATE INDEX "Location_state_idx" ON "Location"("state");

-- CreateIndex
CREATE UNIQUE INDEX "Clip_url_key" ON "Clip"("url");

-- CreateIndex
CREATE UNIQUE INDEX "Clip_videoId_key" ON "Clip"("videoId");

-- CreateIndex
CREATE INDEX "Clip_importance_idx" ON "Clip"("importance");

-- CreateIndex
CREATE INDEX "Clip_discoveredAt_idx" ON "Clip"("discoveredAt");

-- CreateIndex
CREATE INDEX "Clip_locationId_idx" ON "Clip"("locationId");

-- CreateIndex
CREATE INDEX "Clip_bucket_idx" ON "Clip"("bucket");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "DigestPreference_userId_key" ON "DigestPreference"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Star_userId_clipId_key" ON "Star"("userId", "clipId");

-- AddForeignKey
ALTER TABLE "Clip" ADD CONSTRAINT "Clip_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DigestPreference" ADD CONSTRAINT "DigestPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Star" ADD CONSTRAINT "Star_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Star" ADD CONSTRAINT "Star_clipId_fkey" FOREIGN KEY ("clipId") REFERENCES "Clip"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LinkedInPost" ADD CONSTRAINT "LinkedInPost_clipId_fkey" FOREIGN KEY ("clipId") REFERENCES "Clip"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LinkedInPost" ADD CONSTRAINT "LinkedInPost_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
