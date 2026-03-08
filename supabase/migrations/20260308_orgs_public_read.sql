CREATE POLICY "orgs__select__public"
  ON public.organizations
  FOR SELECT
  USING (true);
