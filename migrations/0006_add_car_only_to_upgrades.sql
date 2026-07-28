ALTER TABLE "upgrades" ADD COLUMN IF NOT EXISTS "car_only" BOOLEAN NOT NULL DEFAULT false;

INSERT INTO "upgrades" ("name", "category", "description", "price", "car_only", "published")
SELECT 'Silent Compressor System', 'air-systems', 'A quiet, compact compressor system designed for car and van tyre fitting. Not suitable for commercial heavy-duty use.', 0, true, true
WHERE NOT EXISTS (SELECT 1 FROM "upgrades" WHERE "name" = 'Silent Compressor System');

UPDATE "upgrades" SET "car_only" = true WHERE "name" = 'Silent Compressor System';
