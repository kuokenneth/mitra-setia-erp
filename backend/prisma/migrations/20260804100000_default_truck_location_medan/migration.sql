ALTER TABLE "Truck"
ALTER COLUMN "baseLocation" SET DEFAULT 'Medan',
ALTER COLUMN "currentLocation" SET DEFAULT 'Medan';

UPDATE "Truck"
SET "baseLocation" = COALESCE("baseLocation", 'Medan'),
    "currentLocation" = COALESCE("currentLocation", 'Medan'),
    "locationUpdatedAt" = COALESCE("locationUpdatedAt", CURRENT_TIMESTAMP)
WHERE "baseLocation" IS NULL OR "currentLocation" IS NULL;
