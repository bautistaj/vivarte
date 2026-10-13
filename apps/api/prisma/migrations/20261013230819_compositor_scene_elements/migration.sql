/*
  Warnings:

  - You are about to drop the column `videoKey` on the `Artwork` table. All the data in the column will be lost.

*/
-- CreateTable
CREATE TABLE "SceneElement" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "artworkId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "fileKey" TEXT NOT NULL,
    "label" TEXT NOT NULL DEFAULT '',
    "posX" REAL NOT NULL DEFAULT 0,
    "posY" REAL NOT NULL DEFAULT 0,
    "posZ" REAL NOT NULL DEFAULT 0,
    "rotX" REAL NOT NULL DEFAULT 0,
    "rotY" REAL NOT NULL DEFAULT 0,
    "rotZ" REAL NOT NULL DEFAULT 0,
    "scaleX" REAL NOT NULL DEFAULT 1,
    "scaleY" REAL NOT NULL DEFAULT 1,
    "scaleZ" REAL NOT NULL DEFAULT 1,
    "width" REAL NOT NULL DEFAULT 1,
    "height" REAL NOT NULL DEFAULT 1,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SceneElement_artworkId_fkey" FOREIGN KEY ("artworkId") REFERENCES "Artwork" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Artwork" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "imageKey" TEXT NOT NULL,
    "mindKey" TEXT NOT NULL,
    "imageWidth" INTEGER NOT NULL,
    "imageHeight" INTEGER NOT NULL,
    "scanCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Artwork_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Artwork" ("createdAt", "id", "imageHeight", "imageKey", "imageWidth", "mindKey", "scanCount", "slug", "title", "updatedAt", "userId") SELECT "createdAt", "id", "imageHeight", "imageKey", "imageWidth", "mindKey", "scanCount", "slug", "title", "updatedAt", "userId" FROM "Artwork";
DROP TABLE "Artwork";
ALTER TABLE "new_Artwork" RENAME TO "Artwork";
CREATE UNIQUE INDEX "Artwork_slug_key" ON "Artwork"("slug");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
