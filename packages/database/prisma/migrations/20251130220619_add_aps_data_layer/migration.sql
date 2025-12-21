-- CreateTable
CREATE TABLE "ApsHub" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "region" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ApsProject" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "hubId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "rootFolderId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ApsProject_hubId_fkey" FOREIGN KEY ("hubId") REFERENCES "ApsHub" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ApsFolder" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "parentId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ApsFolder_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "ApsProject" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ApsFolder_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "ApsFolder" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ApsItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "folderId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "currentVersionId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ApsItem_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "ApsFolder" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ApsItem_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "ApsProject" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ApsVersion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "itemId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "urn" TEXT NOT NULL,
    "mimeType" TEXT,
    "storageSize" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ApsVersion_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "ApsItem" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
