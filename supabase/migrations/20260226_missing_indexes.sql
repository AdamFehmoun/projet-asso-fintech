-- Migration : index manquants pour performances des requêtes fréquentes
-- Date : 2026-02-26

CREATE INDEX IF NOT EXISTS idx_transactions_org_date
  ON public.transactions(organization_id, date DESC);

CREATE INDEX IF NOT EXISTS idx_transactions_category_id
  ON public.transactions(category_id);

CREATE INDEX IF NOT EXISTS idx_members_user_id
  ON public.members(user_id);
