-- Allow authenticated users to update their own push subscriptions
-- Required for upsert (onConflict) to overwrite existing tokens on re-registration
CREATE POLICY "Users can update their own subscriptions"
  ON public.push_subscriptions
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
