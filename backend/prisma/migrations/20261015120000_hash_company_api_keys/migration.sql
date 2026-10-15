-- Les clés API ne sont plus stockées en clair : SHA-256 (hex) + indice d'affichage.
-- Les clés existantes restent valides : leur hash est calculé ici (SHA2 MySQL = sha256 hex minuscule).

ALTER TABLE `CompanyApiKey`
    ADD COLUMN `keyHash` VARCHAR(64) NULL,
    ADD COLUMN `keyHint` VARCHAR(32) NULL;

UPDATE `CompanyApiKey`
SET `keyHash` = SHA2(`key`, 256),
    `keyHint` = CONCAT(LEFT(`key`, 8), '...', RIGHT(`key`, 4));

ALTER TABLE `CompanyApiKey`
    MODIFY `keyHash` VARCHAR(64) NOT NULL,
    MODIFY `keyHint` VARCHAR(32) NOT NULL;

CREATE UNIQUE INDEX `CompanyApiKey_keyHash_key` ON `CompanyApiKey`(`keyHash`);

DROP INDEX `CompanyApiKey_key_key` ON `CompanyApiKey`;

ALTER TABLE `CompanyApiKey` DROP COLUMN `key`;
