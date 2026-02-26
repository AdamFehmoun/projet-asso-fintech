-- =============================================================================
-- MIGRATION SÉCURITÉ : Correction des RLS policies critiques
-- Date : 2026-02-26
-- Failles corrigées : C1, C2, M1
-- =============================================================================

-- -----------------------------------------------------------------------------
-- C1 : transaction_audit_logs — Activer RLS + policies basées sur l'org
-- Avant : aucun ENABLE ROW LEVEL SECURITY → GRANT ALL TO anon = lecture/écriture
-- publique de toutes les traces d'audit de toutes les orgs
-- -----------------------------------------------------------------------------

ALTER TABLE "public"."transaction_audit_logs" ENABLE ROW LEVEL SECURITY;

-- SELECT : membre actif de l'org liée à la transaction concernée
CREATE POLICY "transaction_audit_logs__select__is_member"
  ON "public"."transaction_audit_logs"
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.transactions t
      WHERE t.id = transaction_id
        AND public.has_org_role(t.organization_id, 'membre')
    )
  );

-- INSERT : trésorier ou supérieur de l'org liée à la transaction
-- (les server actions valident déjà le rôle, cette policy est le filet de sécurité DB)
CREATE POLICY "transaction_audit_logs__insert__is_tresorier"
  ON "public"."transaction_audit_logs"
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.transactions t
      WHERE t.id = transaction_id
        AND public.has_org_role(t.organization_id, 'tresorier')
    )
  );

-- DELETE : owner uniquement (suppression d'une trace d'audit = action sensible)
CREATE POLICY "transaction_audit_logs__delete__is_owner"
  ON "public"."transaction_audit_logs"
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1
      FROM public.transactions t
      WHERE t.id = transaction_id
        AND public.has_org_role(t.organization_id, 'owner')
    )
  );

-- Révoquer l'accès anon (défense en profondeur : RLS seul ne suffit pas)
REVOKE ALL ON TABLE "public"."transaction_audit_logs" FROM "anon";
GRANT SELECT, INSERT ON TABLE "public"."transaction_audit_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."transaction_audit_logs" TO "service_role";


-- -----------------------------------------------------------------------------
-- C2 : audit_logs — Remplacer USING (true) par des policies restrictives
-- Avant : SELECT USING (true) = tout utilisateur (y compris anon) pouvait lire
-- TOUS les logs de toutes les orgs ; INSERT WITH CHECK (true) = écriture libre
--
-- Note architecturale : audit_logs n'a pas de colonne organization_id.
-- La table est alimentée par un trigger SECURITY DEFINER (handle_audit_log)
-- qui s'exécute en tant que postgres et bypass RLS — les policies INSERT
-- n'affectent donc pas les triggers, uniquement les appels directs.
-- Pour SELECT : les admins/owners voient les logs de leurs propres actions.
-- Un accès élargi par org nécessiterait un JOIN dynamique sur table_name/record_id
-- (non implémenté ici pour éviter la complexité — la vraie traçabilité org
-- est assurée par transaction_audit_logs qui a organization_id via transactions).
-- -----------------------------------------------------------------------------

-- Supprimer les policies trop permissives
DROP POLICY IF EXISTS "Audit logs are read-only" ON "public"."audit_logs";
DROP POLICY IF EXISTS "System can insert logs"   ON "public"."audit_logs";

-- SELECT : chaque utilisateur voit uniquement ses propres actions
CREATE POLICY "audit_logs__select__own_actions"
  ON "public"."audit_logs"
  FOR SELECT
  USING (performed_by = auth.uid());

-- INSERT : bloqué pour les appels directs (le trigger SECURITY DEFINER bypass RLS)
-- Sans cette policy, WITH CHECK (true) permettait à n'importe qui d'injecter
-- des faux logs dans la table d'audit.
CREATE POLICY "audit_logs__insert__blocked"
  ON "public"."audit_logs"
  FOR INSERT
  WITH CHECK (false);

-- Révoquer l'accès anon
REVOKE ALL ON TABLE "public"."audit_logs" FROM "anon";
GRANT SELECT ON TABLE "public"."audit_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."audit_logs" TO "service_role";


-- -----------------------------------------------------------------------------
-- M1 : monthly_closures — Activer RLS (table existante sans RLS)
-- La table a bien une colonne organization_id → on peut utiliser has_org_role
-- directement comme pour les autres tables métier.
-- -----------------------------------------------------------------------------

ALTER TABLE "public"."monthly_closures" ENABLE ROW LEVEL SECURITY;

-- SELECT : tout membre actif de l'org
CREATE POLICY "monthly_closures__select__is_member"
  ON "public"."monthly_closures"
  FOR SELECT
  USING (public.has_org_role(organization_id, 'membre'));

-- INSERT / UPDATE : trésorier ou supérieur uniquement
CREATE POLICY "monthly_closures__insert__is_tresorier"
  ON "public"."monthly_closures"
  FOR INSERT
  WITH CHECK (public.has_org_role(organization_id, 'tresorier'));

CREATE POLICY "monthly_closures__update__is_tresorier"
  ON "public"."monthly_closures"
  FOR UPDATE
  USING (public.has_org_role(organization_id, 'tresorier'))
  WITH CHECK (public.has_org_role(organization_id, 'tresorier'));

-- DELETE : owner uniquement (clôture bancaire = donnée financière immuable)
CREATE POLICY "monthly_closures__delete__is_owner"
  ON "public"."monthly_closures"
  FOR DELETE
  USING (public.has_org_role(organization_id, 'owner'));

-- Révoquer l'accès anon si des GRANT par défaut s'y appliquent
REVOKE ALL ON TABLE "public"."monthly_closures" FROM "anon";
GRANT SELECT, INSERT, UPDATE ON TABLE "public"."monthly_closures" TO "authenticated";
GRANT ALL ON TABLE "public"."monthly_closures" TO "service_role";
