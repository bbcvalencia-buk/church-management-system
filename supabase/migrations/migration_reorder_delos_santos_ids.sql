-- Reorder member id_number so Delos Santos family occupies 1-4
-- with Pastor Leo fixed at #1.
--
-- IMPORTANT:
-- 1) This script will detect Pastor Leo by is_pastor=TRUE first, then by name.
-- 2) Because of existing CHECK constraints, the pastor's wife (if present)
--    must remain #2. If she's not a Delos Santos member, this script will stop.

BEGIN;
LOCK TABLE members IN EXCLUSIVE MODE;

DO $$
DECLARE
    v_pastor_id UUID;
    -- Set this if you want deterministic pastor targeting.
    -- Pastor Leo from your data:
    --   bc7887ad-5318-4c5c-88a0-5607e25306a9
    v_pastor_id_override UUID := 'bc7887ad-5318-4c5c-88a0-5607e25306a9';
    v_pastor_count INTEGER := 0;
    v_wife_id UUID;
    v_family_ids UUID[];
    v_family2 UUID;
    v_family3 UUID;
    v_family4 UUID;
BEGIN
    -- 0) Deterministic override (recommended)
    IF v_pastor_id_override IS NOT NULL THEN
        SELECT id
        INTO v_pastor_id
        FROM members
        WHERE id = v_pastor_id_override
        LIMIT 1;

        IF v_pastor_id IS NULL THEN
            RAISE EXCEPTION 'Pastor override UUID % not found in members.', v_pastor_id_override;
        END IF;
    END IF;

    -- 1) Primary lookup: use explicit pastor flag
    IF v_pastor_id IS NULL THEN
        SELECT COUNT(*)
        INTO v_pastor_count
        FROM members
        WHERE is_pastor = TRUE;

        IF v_pastor_count = 1 THEN
            SELECT id
            INTO v_pastor_id
            FROM members
            WHERE is_pastor = TRUE
            LIMIT 1;
        ELSIF v_pastor_count > 1 THEN
            RAISE EXCEPTION 'Multiple members are marked is_pastor=TRUE. Keep only one pastor before running this script.';
        ELSE
            -- 2) Fallback lookup by name/surname patterns
            SELECT m.id
            INTO v_pastor_id
            FROM members m
            WHERE lower(coalesce(m.first_name, '')) LIKE '%leo%'
              AND lower(regexp_replace(trim(coalesce(m.surname, '')), '\\s+', ' ', 'g')) IN ('delos santos', 'de los santos')
            ORDER BY m.created_at ASC
            LIMIT 1;
        END IF;
    END IF;

    IF v_pastor_id IS NULL THEN
        RAISE EXCEPTION 'Pastor record not found. Set exactly one member as is_pastor=TRUE, then rerun.';
    END IF;

    -- Ensure selected pastor is fixed to #1
    UPDATE members
    SET id_number = id_number + 100000
    WHERE id_number = 1
      AND id <> v_pastor_id
      AND is_pastor = FALSE
      AND is_pastors_wife = FALSE;

    UPDATE members
    SET id_number = 1
    WHERE id = v_pastor_id;

    -- Mark selected member as pastor after #1 assignment (to satisfy CHECK constraint)
    UPDATE members
    SET is_pastor = TRUE
    WHERE id = v_pastor_id;

    SELECT id INTO v_wife_id
    FROM members
    WHERE is_pastors_wife = TRUE
    LIMIT 1;

    -- Pick the next 3 Delos Santos members for slots 2-4.
    -- Prioritize pastor''s wife (if she is Delos Santos) so she lands on #2.
    SELECT array_agg(m.id ORDER BY m.is_pastors_wife DESC, m.id_number ASC, m.created_at ASC, m.id)
    INTO v_family_ids
    FROM members m
    WHERE lower(regexp_replace(trim(m.surname), '\\s+', ' ', 'g')) IN ('delos santos', 'de los santos')
      AND m.id <> v_pastor_id;

    IF coalesce(array_length(v_family_ids, 1), 0) < 3 THEN
        RAISE EXCEPTION 'Need at least 3 additional Delos Santos members (excluding Pastor Leo) to fill slots 2-4.';
    END IF;

    v_family2 := v_family_ids[1];
    v_family3 := v_family_ids[2];
    v_family4 := v_family_ids[3];

    -- If pastor's wife exists, she must be the #2 target to satisfy id constraint.
    IF v_wife_id IS NOT NULL AND v_wife_id <> v_family2 THEN
        RAISE EXCEPTION 'Pastor''s wife exists and must remain id_number=2. Include her in Delos Santos slot #2 first.';
    END IF;

    -- Move non-fixed, non-target members out of the way to avoid unique collisions.
    UPDATE members
    SET id_number = id_number + 100000
    WHERE id NOT IN (v_pastor_id, v_family2, v_family3, v_family4)
      AND is_pastor = FALSE
      AND is_pastors_wife = FALSE;

    -- Assign family slots
    UPDATE members SET id_number = 2 WHERE id = v_family2;
    UPDATE members SET id_number = 3 WHERE id = v_family3;
    UPDATE members SET id_number = 4 WHERE id = v_family4;

    -- Resequence all remaining non-fixed members from 5 onward
    WITH reseq AS (
        SELECT id, ROW_NUMBER() OVER (ORDER BY id_number, created_at, id) AS rn
        FROM members
        WHERE id NOT IN (v_pastor_id, v_family2, v_family3, v_family4)
          AND is_pastor = FALSE
          AND is_pastors_wife = FALSE
    )
    UPDATE members m
    SET id_number = 4 + r.rn
    FROM reseq r
    WHERE m.id = r.id;

    -- Reset serial/identity sequence to current max
    PERFORM setval(
        pg_get_serial_sequence('members', 'id_number'),
        (SELECT MAX(id_number) FROM members),
        true
    );
END $$;

COMMIT;

-- Quick verification
SELECT id_number, first_name, surname, is_pastor, is_pastors_wife
FROM members
ORDER BY id_number
LIMIT 20;
