-- Migration to support AI request logging and rate limiting
CREATE TABLE IF NOT EXISTS public.ai_request_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id),
    feature TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for rate limiting lookup
CREATE INDEX IF NOT EXISTS idx_ai_usage_user_time ON public.ai_request_logs (user_id, created_at);

-- Enable RLS
ALTER TABLE public.ai_request_logs ENABLE ROW LEVEL SECURITY;

-- Only authenticated users can see their own logs (not strictly necessary but good practice)
CREATE POLICY "Users can only see their own AI logs" ON public.ai_request_logs
    FOR SELECT USING (auth.uid() = user_id);
