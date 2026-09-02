UPDATE "Trip" AS t
SET
  "pickupLat" = l."latitude",
  "pickupLng" = l."longitude",
  "pickupRadiusM" = l."radiusM"
FROM "Order" AS o
JOIN "OperationalLocation" AS l ON l."id" = o."pickupLocationId"
WHERE t."orderId" = o."id"
  AND (t."pickupLat" IS NULL OR t."pickupLng" IS NULL);
