-- Additive only: existing editorial tables and rows remain unchanged.
CREATE TABLE "BoletinBancario" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "eventoId" TEXT NOT NULL,
  "contenido" TEXT NOT NULL,
  "persona" TEXT NOT NULL,
  "updatedAt" DATETIME NOT NULL
);
CREATE UNIQUE INDEX "BoletinBancario_eventoId_key" ON "BoletinBancario"("eventoId");
CREATE TABLE "RevisionBancaria" (
  "huella" TEXT NOT NULL,
  "boletinVersion" DATETIME,
  "contenidoAprobado" TEXT,
  "contenidoHash" TEXT,
  "fuentesRevisadas" BOOLEAN NOT NULL DEFAULT false,
  "id" TEXT NOT NULL PRIMARY KEY,
  "eventoId" TEXT NOT NULL,
  "estado" TEXT NOT NULL,
  "persona" TEXT NOT NULL,
  "motivo" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "RevisionBancaria_eventoId_idx" ON "RevisionBancaria"("eventoId");
