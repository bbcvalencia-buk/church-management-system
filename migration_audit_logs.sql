BEGIN;

-- 1. Create audit_logs table
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_id UUID REFERENCES public.members(id) ON DELETE SET NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    action TEXT NOT NULL,
    description TEXT NOT NULL,
    changes JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. RLS Policies
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS audit_logs_select_policy ON public.audit_logs;
CREATE POLICY audit_logs_select_policy ON public.audit_logs
FOR SELECT USING (public.app_has_any_role(ARRAY['super_admin', 'church_administrator']));

DROP POLICY IF EXISTS audit_logs_insert_policy ON public.audit_logs;
CREATE POLICY audit_logs_insert_policy ON public.audit_logs
FOR INSERT WITH CHECK (true); 

-- 3. Trigger Function
CREATE OR REPLACE FUNCTION public.log_audit_event()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_actor_id UUID;
    v_actor_name TEXT;
    v_action TEXT;
    v_entity_type TEXT;
    v_entity_id TEXT;
    v_desc TEXT;
    v_roles TEXT;
BEGIN
    -- Get current user ID
    BEGIN
        v_actor_id := public.app_current_member_id();
    EXCEPTION WHEN OTHERS THEN
        v_actor_id := NULL;
    END;

    IF v_actor_id IS NOT NULL THEN
        SELECT first_name || ' ' || surname INTO v_actor_name FROM public.members WHERE id = v_actor_id;
        
        -- Try to get primary role
        SELECT role INTO v_roles FROM public.user_roles WHERE member_id = v_actor_id LIMIT 1;
        
        IF v_roles IS NOT NULL THEN
            -- format role nicely
            v_actor_name := INITCAP(REPLACE(v_roles, '_', ' ')) || ' ' || v_actor_name;
        END IF;
    ELSE
        v_actor_name := 'System';
    END IF;

    v_action := TG_OP;
    v_entity_type := TG_TABLE_NAME;
    
    IF v_action = 'DELETE' THEN
        v_entity_id := COALESCE(OLD.id::TEXT, 'Unknown');
    ELSE
        v_entity_id := COALESCE(NEW.id::TEXT, 'Unknown');
    END IF;

    -- Human readable defaults
    v_desc := COALESCE(v_actor_name, 'System') || ' ' || lower(v_action) || 'd record ' || v_entity_id || ' in ' || v_entity_type;

    IF v_entity_type = 'services' THEN
        v_desc := COALESCE(v_actor_name, 'System') || ' ' || lower(v_action) || 'd Service (' || v_entity_id || ')';
    ELSIF v_entity_type = 'financial_records' THEN
        v_desc := COALESCE(v_actor_name, 'System') || ' ' || lower(v_action) || 'd Financial Record (' || COALESCE(NEW.transaction_type, OLD.transaction_type) || ')';
    ELSIF v_entity_type = 'members' THEN
        v_desc := COALESCE(v_actor_name, 'System') || ' ' || lower(v_action) || 'd Member Profile (' || v_entity_id || ')';
    ELSIF v_entity_type = 'church_events' THEN
        v_desc := COALESCE(v_actor_name, 'System') || ' ' || lower(v_action) || 'd Church Event (' || v_entity_id || ')';
    ELSIF v_entity_type = 'activities' THEN
        v_desc := COALESCE(v_actor_name, 'System') || ' ' || lower(v_action) || 'd Activity (' || v_entity_id || ')';
    ELSIF v_entity_type = 'goodnews_classes' THEN
        v_desc := COALESCE(v_actor_name, 'System') || ' ' || lower(v_action) || 'd Goodnews Class (' || v_entity_id || ')';
    END IF;

    INSERT INTO public.audit_logs (actor_id, entity_type, entity_id, action, description, changes)
    VALUES (
        v_actor_id,
        v_entity_type,
        v_entity_id,
        v_action,
        v_desc,
        CASE
            WHEN v_action = 'INSERT' THEN row_to_json(NEW)::jsonb
            WHEN v_action = 'UPDATE' THEN jsonb_build_object('old', row_to_json(OLD), 'new', row_to_json(NEW))
            WHEN v_action = 'DELETE' THEN row_to_json(OLD)::jsonb
        END
    );
    
    IF v_action = 'DELETE' THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
END;
$$;

-- 4. Apply Triggers
DO $$
DECLARE
    t TEXT;
BEGIN
    FOR t IN 
        SELECT unnest(ARRAY['services', 'financial_records', 'members', 'church_events', 'goodnews_classes', 'sunday_school_sessions', 'activities'])
    LOOP
        EXECUTE format('DROP TRIGGER IF EXISTS trigger_audit_log ON public.%I', t);
        EXECUTE format('CREATE TRIGGER trigger_audit_log AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.log_audit_event()', t);
    END LOOP;
END;
$$;

COMMIT;
