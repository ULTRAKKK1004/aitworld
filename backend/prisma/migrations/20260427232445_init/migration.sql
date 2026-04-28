-- CreateTable
CREATE TABLE "User" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "department" TEXT NOT NULL,
    "techGroup" TEXT NOT NULL,
    "detailTask" TEXT NOT NULL,
    "isAdmin" BOOLEAN NOT NULL DEFAULT false,
    "joinDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "recentLogin" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "recentActivity" TEXT
);

-- CreateTable
CREATE TABLE "LeaveSchedule" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" INTEGER NOT NULL,
    "startDate" DATETIME NOT NULL,
    "endDate" DATETIME NOT NULL,
    "reason" TEXT,
    CONSTRAINT "LeaveSchedule_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Project" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "startDate" DATETIME NOT NULL,
    "endDate" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'IN_PROGRESS'
);

-- CreateTable
CREATE TABLE "ProjectSchedule" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "projectId" INTEGER NOT NULL,
    "milestone" TEXT NOT NULL,
    "deadline" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    CONSTRAINT "ProjectSchedule_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TGServerConfig" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "tgName" TEXT NOT NULL,
    "serverUrl" TEXT NOT NULL,
    "inputFormat" TEXT NOT NULL,
    "outputFormat" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "AgentConfig" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "agentName" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "systemPrompt" TEXT NOT NULL,
    "provider" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "AgentLog" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "agentName" TEXT NOT NULL,
    "level" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "TGServerConfig_tgName_key" ON "TGServerConfig"("tgName");

-- CreateIndex
CREATE UNIQUE INDEX "AgentConfig_agentName_key" ON "AgentConfig"("agentName");
