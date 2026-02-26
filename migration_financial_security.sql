-- LAYER 1: Period Lock Table and Trigger
CREATE TABLE IF NOT EXISTS public.financial_period_locks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    year INT NOT NULL,
    month INT NOT NULL,
    locked_by UUID REFERENCES auth.users(id),
    locked_at TIMESTAMPTZ DEFAULT NOW(),
    unlock_reason TEXT,
    unlocked_by UUID REFERENCES auth.users(id),
    unlocked_at TIMESTAMPTZ,
    CONSTRAINT period_unique UNIQUE(year, month)
);

CREATE OR REPLACE FUNCTION public.enforce_period_lock()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    target_date DATE;
    target_year INT;
    target_month INT;
    is_locked BOOLEAN;
BEGIN
    IF TG_OP = 'DELETE' THEN
        target_date := OLD.transaction_date;
    ELSE
        target_date := NEW.transaction_date;
    END IF;

    target_year := EXTRACT(YEAR FROM target_date)::INT;
    target_month := EXTRACT(MONTH FROM target_date)::INT;

    SELECT EXISTS (
        SELECT 1 FROM public.financial_period_locks
        WHERE year = target_year 
          AND month = target_month 
          AND unlocked_at IS NULL
    ) INTO is_locked;

    IF is_locked THEN
        RAISE EXCEPTION 'Period %/% is locked. Contact Church Administrator.', target_year, target_month;
    END IF;

    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_period_lock_trigger ON public.financial_records;
CREATE TRIGGER enforce_period_lock_trigger
    BEFORE INSERT OR UPDATE OR DELETE
    ON public.financial_records
    FOR EACH ROW
    EXECUTE FUNCTION public.enforce_period_lock();


-- LAYER 2: Append-Only Audit Log
CREATE TABLE IF NOT EXISTS public.financial_audit_log (
    id BIGSERIAL PRIMARY KEY,
    action TEXT NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE')),
    financial_record_id UUID NOT NULL,
    member_id UUID NOT NULL,
    performed_by UUID REFERENCES auth.users(id),
    before_data JSONB,
    after_data JSONB,
    changed_fields TEXT[],
    performed_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.financial_audit_log ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.app_is_church_admin() RETURNS boolean AS $$
BEGIN
  RETURN (
    EXISTS (
      SELECT 1
      FROM user_roles
      WHERE (user_roles.user_id = auth.uid()) 
      AND (user_roles.role = 'church_administrator'::text)
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.app_is_treasurer() RETURNS boolean AS $$
BEGIN
  RETURN (
    EXISTS (
      SELECT 1
      FROM user_roles
      WHERE (user_roles.user_id = auth.uid()) 
      AND (user_roles.role = 'treasurer'::text)
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE POLICY "audit_log_select" ON public.financial_audit_log
    FOR SELECT TO authenticated
    USING (app_is_church_admin() OR app_is_treasurer());

CREATE OR REPLACE FUNCTION public.log_financial_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    changed_keys TEXT[];
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO public.financial_audit_log (action, financial_record_id, member_id, performed_by, after_data)
        VALUES ('INSERT', NEW.id, NEW.member_id, auth.uid(), to_jsonb(NEW));
        RETURN NEW;
    ELSIF TG_OP = 'UPDATE' THEN
        -- Safely extract changed keys without relying on EXCEPT which can be tricky with composite types/nulls
        SELECT ARRAY(
            SELECT key FROM jsonb_each(to_jsonb(OLD)) o
            FULL OUTER JOIN jsonb_each(to_jsonb(NEW)) n USING(key)
            WHERE o.value IS DISTINCT FROM n.value
        ) INTO changed_keys;
        
        INSERT INTO public.financial_audit_log (action, financial_record_id, member_id, performed_by, before_data, after_data, changed_fields)
        VALUES ('UPDATE', NEW.id, NEW.member_id, auth.uid(), to_jsonb(OLD), to_jsonb(NEW), changed_keys);
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        INSERT INTO public.financial_audit_log (action, financial_record_id, member_id, performed_by, before_data)
        VALUES ('DELETE', OLD.id, OLD.member_id, auth.uid(), to_jsonb(OLD));
        RETURN OLD;
    END IF;
END;
$$;

DROP TRIGGER IF EXISTS log_financial_change_trigger ON public.financial_records;
CREATE TRIGGER log_financial_change_trigger
    AFTER INSERT OR UPDATE OR DELETE
    ON public.financial_records
    FOR EACH ROW
    EXECUTE FUNCTION public.log_financial_change();


-- LAYER 3: Soft Delete Column
ALTER TABLE public.financial_records
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES auth.users(id);

-- Additional helpers migrated to the top of the file
