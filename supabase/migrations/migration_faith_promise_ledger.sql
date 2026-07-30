-- PART A — Database Functions

CREATE OR REPLACE FUNCTION public.count_sundays(start_date DATE, end_date DATE)
RETURNS INT LANGUAGE plpgsql AS $$
DECLARE
    sunday_count INT := 0;
    curr_date DATE := start_date;
BEGIN
    WHILE curr_date <= end_date LOOP
        IF EXTRACT(ISODOW FROM curr_date) = 7 THEN
            sunday_count := sunday_count + 1;
        END IF;
        curr_date := curr_date + 1;
    END LOOP;
    RETURN sunday_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.count_sundays_in_year(p_year INT)
RETURNS INT LANGUAGE plpgsql AS $$
BEGIN
    RETURN public.count_sundays(
        MAKE_DATE(p_year, 1, 1),
        MAKE_DATE(p_year, 12, 31)
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.sundays_elapsed_in_year(p_year INT)
RETURNS INT LANGUAGE plpgsql AS $$
DECLARE
    end_date DATE;
BEGIN
    IF EXTRACT(YEAR FROM CURRENT_DATE) > p_year THEN
        end_date := MAKE_DATE(p_year, 12, 31);
    ELSIF EXTRACT(YEAR FROM CURRENT_DATE) < p_year THEN
        RETURN 0;
    ELSE
        end_date := CURRENT_DATE;
    END IF;
    
    RETURN public.count_sundays(MAKE_DATE(p_year, 1, 1), end_date);
END;
$$;

CREATE OR REPLACE FUNCTION public.sundays_remaining_in_year(p_year INT)
RETURNS INT LANGUAGE plpgsql AS $$
DECLARE
    start_date DATE;
BEGIN
    IF EXTRACT(YEAR FROM CURRENT_DATE) > p_year THEN
        RETURN 0;
    ELSIF EXTRACT(YEAR FROM CURRENT_DATE) < p_year THEN
        start_date := MAKE_DATE(p_year, 1, 1);
    ELSE
        start_date := CURRENT_DATE + 1;
    END IF;
    
    RETURN public.count_sundays(start_date, MAKE_DATE(p_year, 12, 31));
END;
$$;


-- PART B — Update faith_promise_commitments

ALTER TABLE public.faith_promise_commitments
ADD COLUMN IF NOT EXISTS started_giving_date DATE,
ADD COLUMN IF NOT EXISTS weeks_committed INT,
ADD COLUMN IF NOT EXISTS status TEXT,
ADD COLUMN IF NOT EXISTS fulfillment_date DATE,
ADD COLUMN IF NOT EXISTS notes TEXT,
ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id);

UPDATE public.faith_promise_commitments
SET weeks_committed = public.count_sundays_in_year(year)
WHERE weeks_committed IS NULL;


-- PART C — Create faith_promise_ledger VIEW

DROP VIEW IF EXISTS public.faith_promise_ledger;

CREATE VIEW public.faith_promise_ledger AS
WITH fp_totals AS (
    SELECT 
        member_id, 
        EXTRACT(YEAR FROM transaction_date)::INT AS record_year,
        SUM(amount) AS total_paid
    FROM public.financial_records
    WHERE transaction_type = 'faith_promise'
      AND deleted_at IS NULL
    GROUP BY member_id, EXTRACT(YEAR FROM transaction_date)
)
SELECT 
    fpc.id,
    fpc.member_id,
    m.first_name,
    m.surname,
    m.member_number,
    fpc.year,
    fpc.promised_amount AS committed_amount,
    fpc.started_giving_date,
    fpc.weeks_committed,
    fpc.status AS manual_status,
    fpc.fulfillment_date,
    fpc.notes,
    COALESCE(t.total_paid, 0) AS total_paid,
    (fpc.promised_amount / NULLIF(fpc.weeks_committed, 0)) AS weekly_target,
    (fpc.promised_amount - COALESCE(t.total_paid, 0)) AS remaining_balance,
    ((fpc.promised_amount / NULLIF(fpc.weeks_committed, 0)) * public.sundays_elapsed_in_year(fpc.year)) AS expected_paid_by_now,
    (COALESCE(t.total_paid, 0) - ((fpc.promised_amount / NULLIF(fpc.weeks_committed, 0)) * public.sundays_elapsed_in_year(fpc.year))) AS variance,
    (COALESCE(t.total_paid, 0) / NULLIF(fpc.promised_amount, 0) * 100) AS fulfillment_pct,
    ((fpc.promised_amount - COALESCE(t.total_paid, 0)) / CASE WHEN public.sundays_remaining_in_year(fpc.year) = 0 THEN 1 ELSE public.sundays_remaining_in_year(fpc.year) END) AS catchup_weekly,
    CASE 
        WHEN fpc.status IS NOT NULL THEN fpc.status
        WHEN COALESCE(t.total_paid, 0) >= fpc.promised_amount THEN 'FULFILLED'
        WHEN EXTRACT(YEAR FROM CURRENT_DATE) > fpc.year AND COALESCE(t.total_paid, 0) < fpc.promised_amount THEN 'INCOMPLETE'
        WHEN (COALESCE(t.total_paid, 0) - ((fpc.promised_amount / NULLIF(fpc.weeks_committed, 0)) * public.sundays_elapsed_in_year(fpc.year))) >= 0 THEN 'ON TRACK'
        ELSE 'BEHIND' 
    END AS status
FROM public.faith_promise_commitments fpc
JOIN public.members m ON fpc.member_id = m.id
LEFT JOIN fp_totals t ON fpc.member_id = t.member_id AND fpc.year = t.record_year;

-- Set up proper permissions on the view so only specific roles can query it.
GRANT SELECT ON public.faith_promise_ledger TO authenticated;

-- PART D — Performance Index

CREATE INDEX IF NOT EXISTS idx_fin_records_fp 
ON public.financial_records(member_id, transaction_type, transaction_date) 
WHERE transaction_type = 'faith_promise';
