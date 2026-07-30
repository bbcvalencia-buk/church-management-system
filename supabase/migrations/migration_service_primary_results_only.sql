-- Enforce visitors/souls metrics only for primary services:
-- sunday_morning, sunday_afternoon, wednesday_prayer.

BEGIN;

UPDATE public.services
SET
  visitors_present = 0,
  visitors_saved = 0,
  souls_saved = 0
WHERE service_type NOT IN ('sunday_morning', 'sunday_afternoon', 'wednesday_prayer')
  AND (
    coalesce(visitors_present, 0) <> 0
    OR coalesce(visitors_saved, 0) <> 0
    OR coalesce(souls_saved, 0) <> 0
  );

ALTER TABLE public.services
DROP CONSTRAINT IF EXISTS services_primary_results_only_chk;

ALTER TABLE public.services
ADD CONSTRAINT services_primary_results_only_chk
CHECK (
  service_type IN ('sunday_morning', 'sunday_afternoon', 'wednesday_prayer')
  OR (
    coalesce(visitors_present, 0) = 0
    AND coalesce(visitors_saved, 0) = 0
    AND coalesce(souls_saved, 0) = 0
  )
);

COMMIT;
