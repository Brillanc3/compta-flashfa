-- La clé d'ingest (Company.apiKey) n'est plus stockée en clair : SHA-256 (hex) + indice d'affichage.
-- Les clés existantes restent valides : leur hash est calculé ici (SHA2 MySQL = sha256 hex minuscule).

ALTER TABLE `Company`
    ADD COLUMN `apiKeyHash` VARCHAR(64) NULL,
    ADD COLUMN `apiKeyHint` VARCHAR(32) NULL;

UPDATE `Company`
SET `apiKeyHash` = SHA2(`apiKey`, 256),
    `apiKeyHint` = CONCAT(LEFT(`apiKey`, 8), '...', RIGHT(`apiKey`, 4))
WHERE `apiKey` IS NOT NULL;

CREATE UNIQUE INDEX `Company_apiKeyHash_key` ON `Company`(`apiKeyHash`);

DROP INDEX `Company_apiKey_key` ON `Company`;

ALTER TABLE `Company` DROP COLUMN `apiKey`;
