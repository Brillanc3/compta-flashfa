-- Optimise les requêtes "derniers éléments par entreprise" (ORDER BY createdAt DESC LIMIT n)
-- Évite le filesort sur Log (~1.2M lignes) et Bill (~70k lignes) dans la page admin entreprise.
CREATE INDEX `Log_companyId_createdAt_idx` ON `Log`(`companyId`, `createdAt` DESC);
CREATE INDEX `Bill_companyId_createdAt_idx` ON `Bill`(`companyId`, `createdAt` DESC);
