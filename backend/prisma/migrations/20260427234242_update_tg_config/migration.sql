/*
  Warnings:

  - You are about to drop the column `inputFormat` on the `TGServerConfig` table. All the data in the column will be lost.
  - You are about to drop the column `outputFormat` on the `TGServerConfig` table. All the data in the column will be lost.
  - Added the required column `executionLogic` to the `TGServerConfig` table without a default value. This is not possible if the table is not empty.
  - Added the required column `serverName` to the `TGServerConfig` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `TGServerConfig` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_TGServerConfig" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "tgName" TEXT NOT NULL,
    "serverName" TEXT NOT NULL,
    "serverUrl" TEXT NOT NULL,
    "description" TEXT,
    "executionLogic" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_TGServerConfig" ("id", "serverUrl", "tgName") SELECT "id", "serverUrl", "tgName" FROM "TGServerConfig";
DROP TABLE "TGServerConfig";
ALTER TABLE "new_TGServerConfig" RENAME TO "TGServerConfig";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
