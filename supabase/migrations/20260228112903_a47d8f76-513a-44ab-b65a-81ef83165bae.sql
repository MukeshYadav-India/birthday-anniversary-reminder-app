
-- Drop overly permissive policies (service role bypasses RLS anyway)
DROP POLICY "Service role can read all subscriptions" ON public.push_subscriptions;
DROP POLICY "Service role can read all events" ON public.events;
