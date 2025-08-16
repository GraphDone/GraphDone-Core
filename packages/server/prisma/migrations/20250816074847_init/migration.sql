-- CreateEnum
CREATE TYPE "NodeType" AS ENUM ('OUTCOME', 'TASK', 'MILESTONE', 'IDEA');

-- CreateEnum
CREATE TYPE "NodeStatus" AS ENUM ('PROPOSED', 'ACTIVE', 'IN_PROGRESS', 'BLOCKED', 'COMPLETED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "EdgeType" AS ENUM ('DEPENDENCY', 'BLOCKS', 'RELATES_TO', 'CONTAINS');

-- CreateEnum
CREATE TYPE "ContributorType" AS ENUM ('HUMAN', 'AI_AGENT');

-- CreateTable
CREATE TABLE "nodes" (
    "id" TEXT NOT NULL,
    "type" "NodeType" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "positionX" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "positionY" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "positionZ" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "radius" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "theta" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "phi" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "priorityExec" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "priorityIndiv" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "priorityComm" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "priorityComp" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" "NodeStatus" NOT NULL DEFAULT 'PROPOSED',
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "nodes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "edges" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "type" "EdgeType" NOT NULL,
    "weight" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "edges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "node_dependencies" (
    "id" TEXT NOT NULL,
    "nodeId" TEXT NOT NULL,
    "dependencyId" TEXT NOT NULL,

    CONSTRAINT "node_dependencies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contributors" (
    "id" TEXT NOT NULL,
    "type" "ContributorType" NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "avatarUrl" TEXT,
    "capabilities" JSONB,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contributors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "node_contributors" (
    "id" TEXT NOT NULL,
    "nodeId" TEXT NOT NULL,
    "contributorId" TEXT NOT NULL,
    "role" TEXT DEFAULT 'contributor',
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "node_contributors_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "edges_sourceId_targetId_type_key" ON "edges"("sourceId", "targetId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "node_dependencies_nodeId_dependencyId_key" ON "node_dependencies"("nodeId", "dependencyId");

-- CreateIndex
CREATE UNIQUE INDEX "contributors_email_key" ON "contributors"("email");

-- CreateIndex
CREATE UNIQUE INDEX "node_contributors_nodeId_contributorId_key" ON "node_contributors"("nodeId", "contributorId");

-- AddForeignKey
ALTER TABLE "edges" ADD CONSTRAINT "edges_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "nodes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "edges" ADD CONSTRAINT "edges_targetId_fkey" FOREIGN KEY ("targetId") REFERENCES "nodes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "node_dependencies" ADD CONSTRAINT "node_dependencies_nodeId_fkey" FOREIGN KEY ("nodeId") REFERENCES "nodes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "node_dependencies" ADD CONSTRAINT "node_dependencies_dependencyId_fkey" FOREIGN KEY ("dependencyId") REFERENCES "nodes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "node_contributors" ADD CONSTRAINT "node_contributors_nodeId_fkey" FOREIGN KEY ("nodeId") REFERENCES "nodes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "node_contributors" ADD CONSTRAINT "node_contributors_contributorId_fkey" FOREIGN KEY ("contributorId") REFERENCES "contributors"("id") ON DELETE CASCADE ON UPDATE CASCADE;
