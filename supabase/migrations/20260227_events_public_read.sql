-- Permet la lecture publique (anon) des événements
-- Utilisé par la page publique /[org_slug]/events
CREATE POLICY "events__select__public"
  ON public.events
  FOR SELECT
  USING (true);
