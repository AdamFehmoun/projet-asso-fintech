


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE TYPE "public"."app_role" AS ENUM (
    'admin',
    'tresorier',
    'membre',
    'owner'
);


ALTER TYPE "public"."app_role" OWNER TO "postgres";


CREATE TYPE "public"."classification_method" AS ENUM (
    'manual',
    'ai_vector',
    'ai_llm',
    'hard_rule'
);


ALTER TYPE "public"."classification_method" OWNER TO "postgres";


CREATE TYPE "public"."member_status" AS ENUM (
    'pending',
    'active',
    'rejected'
);


ALTER TYPE "public"."member_status" OWNER TO "postgres";


CREATE TYPE "public"."transaction_type" AS ENUM (
    'income',
    'expense'
);


ALTER TYPE "public"."transaction_type" OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."organizations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "slug" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "stripe_account_id" "text",
    "rna_number" "text",
    "fiscal_start" "date" DEFAULT '2024-09-01'::"date" NOT NULL,
    "settings" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."organizations" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_organization_with_owner"("p_name" "text", "p_slug" "text") RETURNS "public"."organizations"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
    v_org public.organizations;
BEGIN
    INSERT INTO public.organizations (name, slug)
    VALUES (p_name, p_slug)
    RETURNING * INTO v_org;

    INSERT INTO public.members (user_id, organization_id, role, status)
    VALUES (auth.uid(), v_org.id, 'owner', 'active');

    RETURN v_org;
END;
$$;


ALTER FUNCTION "public"."create_organization_with_owner"("p_name" "text", "p_slug" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_hierarchical_budget"("org_slug_param" "text") RETURNS TABLE("id" "uuid", "name" "text", "color" "text", "parent_id" "uuid", "rank" integer, "direct_total" bigint, "recursive_total" bigint)
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_org_id uuid;
BEGIN
  -- 1. Trouver l'ID
  SELECT o.id INTO v_org_id FROM public.organizations o WHERE o.slug = org_slug_param;

  IF v_org_id IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH RECURSIVE 
  initial_tree AS (
    SELECT 
      c.id, c.name, c.color, c.parent_id, c.rank,
      COALESCE((SELECT SUM(amount) FROM public.transactions WHERE category_id = c.id AND type = 'expense'), 0)::bigint AS direct_amt
    FROM public.budget_categories c
    WHERE c.organization_id = v_org_id
  ),
  descendants AS (
    SELECT root.id AS root_id, root.id AS child_id, root.direct_amt
    FROM initial_tree root
    UNION ALL
    SELECT d.root_id, t.id, t.direct_amt
    FROM descendants d
    JOIN initial_tree t ON t.parent_id = d.child_id
  )
  SELECT 
    t.id, t.name, t.color, t.parent_id, t.rank,
    t.direct_amt,
    SUM(d.direct_amt)::bigint as recursive_total
  FROM initial_tree t
  JOIN descendants d ON t.id = d.root_id
  GROUP BY t.id, t.name, t.color, t.parent_id, t.rank, t.direct_amt
  ORDER BY t.rank ASC;
END;
$$;


ALTER FUNCTION "public"."get_hierarchical_budget"("org_slug_param" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_audit_log"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
declare
  v_old_data jsonb;
  v_new_data jsonb;
  v_record_id uuid;
begin
  -- Déterminer les données selon l'opération
  if (TG_OP = 'UPDATE') then
    v_old_data := row_to_json(OLD)::jsonb;
    v_new_data := row_to_json(NEW)::jsonb;
    v_record_id := NEW.id;
  elsif (TG_OP = 'DELETE') then
    v_old_data := row_to_json(OLD)::jsonb;
    v_new_data := null;
    v_record_id := OLD.id;
  elsif (TG_OP = 'INSERT') then
    v_old_data := null;
    v_new_data := row_to_json(NEW)::jsonb;
    v_record_id := NEW.id;
  end if;

  -- Insertion dans les logs
  -- auth.uid() est une fonction magique de Supabase qui récupère l'ID du user connecté
  insert into public.audit_logs (table_name, record_id, operation, performed_by, old_data, new_data)
  values (TG_TABLE_NAME::text, v_record_id, TG_OP, auth.uid(), v_old_data, v_new_data);

  return null; -- Résultat ignoré pour un trigger AFTER
end;
$$;


ALTER FUNCTION "public"."handle_audit_log"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
begin
  insert into public.profiles (id, full_name, email)
  values (new.id, new.raw_user_meta_data->>'full_name', new.email);
  return new;
end;
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."has_org_role"("p_organization_id" "uuid", "p_min_role" "text") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
    SELECT EXISTS (
        SELECT 1
        FROM   public.members m
        WHERE  m.user_id         = auth.uid()
          AND  m.organization_id = p_organization_id
          AND  m.status::text    = 'active'
          AND  CASE m.role::text
                 WHEN 'owner'     THEN 4
                 WHEN 'admin'     THEN 3
                 WHEN 'tresorier' THEN 2
                 WHEN 'membre'    THEN 1
                 ELSE 0
               END
               >=
               CASE p_min_role
                 WHEN 'owner'     THEN 4
                 WHEN 'admin'     THEN 3
                 WHEN 'tresorier' THEN 2
                 WHEN 'membre'    THEN 1
                 ELSE 0
               END
    )
$$;


ALTER FUNCTION "public"."has_org_role"("p_organization_id" "uuid", "p_min_role" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."match_categories"("query_embedding" "public"."vector", "match_threshold" double precision, "match_count" integer, "org_id" "uuid") RETURNS TABLE("id" "uuid", "name" "text", "similarity" double precision)
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  RETURN QUERY
  SELECT
    bc.id,
    bc.name,
    1 - (bc.embedding <=> query_embedding) AS similarity
  FROM budget_categories bc
  WHERE bc.organization_id = org_id
    AND bc.embedding IS NOT NULL
    AND 1 - (bc.embedding <=> query_embedding) > match_threshold
  ORDER BY bc.embedding <=> query_embedding -- Distance Cosinus
  LIMIT match_count;
END;
$$;


ALTER FUNCTION "public"."match_categories"("query_embedding" "public"."vector", "match_threshold" double precision, "match_count" integer, "org_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."match_category"("query_embedding" "public"."vector", "match_threshold" double precision, "match_count" integer, "org_id" "uuid") RETURNS TABLE("id" "uuid", "name" "text", "similarity" double precision)
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  RETURN QUERY
  SELECT
    bc.id,
    bc.name,
    1 - (bc.embedding <=> query_embedding) AS similarity -- Calcul de similarité cosinus
  FROM public.budget_categories bc
  WHERE bc.organization_id = org_id
    AND bc.embedding IS NOT NULL
    AND 1 - (bc.embedding <=> query_embedding) > match_threshold
  ORDER BY bc.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;


ALTER FUNCTION "public"."match_category"("query_embedding" "public"."vector", "match_threshold" double precision, "match_count" integer, "org_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_updated_at"() OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."audit_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "table_name" "text" NOT NULL,
    "record_id" "uuid" NOT NULL,
    "operation" "text" NOT NULL,
    "changed_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "performed_by" "uuid",
    "old_data" "jsonb",
    "new_data" "jsonb"
);


ALTER TABLE "public"."audit_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."budget_categories" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "organization_id" "uuid" NOT NULL,
    "parent_id" "uuid",
    "name" "text" NOT NULL,
    "color" "text" DEFAULT '#94a3b8'::"text",
    "rank" integer DEFAULT 0,
    "embedding" "public"."vector"(1536)
);


ALTER TABLE "public"."budget_categories" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."budget_rules" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid",
    "pattern" "text" NOT NULL,
    "category_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "created_by" "uuid"
);


ALTER TABLE "public"."budget_rules" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "price" integer NOT NULL,
    "date" timestamp with time zone NOT NULL
);


ALTER TABLE "public"."events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."members" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "role" "public"."app_role" DEFAULT 'membre'::"public"."app_role",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "status" "public"."member_status" DEFAULT 'pending'::"public"."member_status" NOT NULL,
    "invited_by" "uuid"
);


ALTER TABLE "public"."members" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "full_name" "text",
    "email" "text",
    "avatar_url" "text",
    "updated_at" timestamp with time zone
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."transaction_audit_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "transaction_id" "uuid",
    "changed_at" timestamp with time zone DEFAULT "now"(),
    "changed_by" "uuid",
    "old_category_id" "uuid",
    "new_category_id" "uuid",
    "old_status" "text",
    "new_status" "text",
    "notes" "text"
);


ALTER TABLE "public"."transaction_audit_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."transactions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "profile_id" "uuid",
    "amount" integer NOT NULL,
    "type" "public"."transaction_type" NOT NULL,
    "category" "text",
    "description" "text",
    "date" timestamp with time zone DEFAULT "now"() NOT NULL,
    "proof_url" "text",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "status" "text" DEFAULT 'pending'::"text",
    "receipt_url" "text",
    "category_id" "uuid",
    "classification_status" "text" DEFAULT 'pending'::"text",
    "classification_method" "public"."classification_method",
    "confidence_score" double precision,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "stripe_event_id" "text",
    CONSTRAINT "transactions_classification_status_check" CHECK (("classification_status" = ANY (ARRAY['pending'::"text", 'ai_suggested'::"text", 'validated'::"text", 'flagged'::"text"])))
);


ALTER TABLE "public"."transactions" OWNER TO "postgres";


ALTER TABLE ONLY "public"."audit_logs"
    ADD CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."budget_categories"
    ADD CONSTRAINT "budget_categories_organization_id_name_key" UNIQUE ("organization_id", "name");



ALTER TABLE ONLY "public"."budget_categories"
    ADD CONSTRAINT "budget_categories_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."budget_rules"
    ADD CONSTRAINT "budget_rules_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."events"
    ADD CONSTRAINT "events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."members"
    ADD CONSTRAINT "members_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."members"
    ADD CONSTRAINT "members_user_id_organization_id_key" UNIQUE ("user_id", "organization_id");



ALTER TABLE ONLY "public"."organizations"
    ADD CONSTRAINT "organizations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."organizations"
    ADD CONSTRAINT "organizations_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."transaction_audit_logs"
    ADD CONSTRAINT "transaction_audit_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."transactions"
    ADD CONSTRAINT "transactions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."transactions"
    ADD CONSTRAINT "transactions_stripe_event_id_key" UNIQUE ("stripe_event_id");



CREATE INDEX "budget_categories_embedding_idx" ON "public"."budget_categories" USING "ivfflat" ("embedding" "public"."vector_cosine_ops") WITH ("lists"='100');



CREATE INDEX "idx_audit_transaction_id" ON "public"."transaction_audit_logs" USING "btree" ("transaction_id");



CREATE INDEX "idx_budget_categories_org" ON "public"."budget_categories" USING "btree" ("organization_id");



CREATE INDEX "idx_budget_categories_parent" ON "public"."budget_categories" USING "btree" ("parent_id");



CREATE INDEX "idx_rules_org_id" ON "public"."budget_rules" USING "btree" ("organization_id");



CREATE OR REPLACE TRIGGER "on_transaction_change" AFTER INSERT OR DELETE OR UPDATE ON "public"."transactions" FOR EACH ROW EXECUTE FUNCTION "public"."handle_audit_log"();



CREATE OR REPLACE TRIGGER "trg_organizations_updated_at" BEFORE UPDATE ON "public"."organizations" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



ALTER TABLE ONLY "public"."audit_logs"
    ADD CONSTRAINT "audit_logs_performed_by_fkey" FOREIGN KEY ("performed_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."budget_categories"
    ADD CONSTRAINT "budget_categories_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."budget_categories"
    ADD CONSTRAINT "budget_categories_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "public"."budget_categories"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."budget_rules"
    ADD CONSTRAINT "budget_rules_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."budget_categories"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."budget_rules"
    ADD CONSTRAINT "budget_rules_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."budget_rules"
    ADD CONSTRAINT "budget_rules_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."events"
    ADD CONSTRAINT "events_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id");



ALTER TABLE ONLY "public"."members"
    ADD CONSTRAINT "members_invited_by_fkey" FOREIGN KEY ("invited_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."members"
    ADD CONSTRAINT "members_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."members"
    ADD CONSTRAINT "members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."transaction_audit_logs"
    ADD CONSTRAINT "transaction_audit_logs_changed_by_fkey" FOREIGN KEY ("changed_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."transaction_audit_logs"
    ADD CONSTRAINT "transaction_audit_logs_new_category_id_fkey" FOREIGN KEY ("new_category_id") REFERENCES "public"."budget_categories"("id");



ALTER TABLE ONLY "public"."transaction_audit_logs"
    ADD CONSTRAINT "transaction_audit_logs_old_category_id_fkey" FOREIGN KEY ("old_category_id") REFERENCES "public"."budget_categories"("id");



ALTER TABLE ONLY "public"."transaction_audit_logs"
    ADD CONSTRAINT "transaction_audit_logs_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "public"."transactions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."transactions"
    ADD CONSTRAINT "transactions_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."budget_categories"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."transactions"
    ADD CONSTRAINT "transactions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."transactions"
    ADD CONSTRAINT "transactions_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id");



CREATE POLICY "Audit logs are read-only" ON "public"."audit_logs" FOR SELECT USING (true);



CREATE POLICY "System can insert logs" ON "public"."audit_logs" FOR INSERT WITH CHECK (true);



ALTER TABLE "public"."audit_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."budget_categories" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "budget_categories__select__is_member" ON "public"."budget_categories" FOR SELECT USING ("public"."has_org_role"("organization_id", 'membre'::"text"));



CREATE POLICY "budget_categories__write__is_admin" ON "public"."budget_categories" USING ("public"."has_org_role"("organization_id", 'admin'::"text")) WITH CHECK ("public"."has_org_role"("organization_id", 'admin'::"text"));



ALTER TABLE "public"."budget_rules" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "budget_rules__select__is_member" ON "public"."budget_rules" FOR SELECT USING ("public"."has_org_role"("organization_id", 'membre'::"text"));



CREATE POLICY "budget_rules__write__is_admin" ON "public"."budget_rules" USING ("public"."has_org_role"("organization_id", 'admin'::"text")) WITH CHECK ("public"."has_org_role"("organization_id", 'admin'::"text"));



ALTER TABLE "public"."events" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "events__select__is_member" ON "public"."events" FOR SELECT USING ("public"."has_org_role"("organization_id", 'membre'::"text"));



CREATE POLICY "events__write__is_admin" ON "public"."events" USING ("public"."has_org_role"("organization_id", 'admin'::"text")) WITH CHECK ("public"."has_org_role"("organization_id", 'admin'::"text"));



ALTER TABLE "public"."members" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "members__delete__is_owner_or_self" ON "public"."members" FOR DELETE USING (("public"."has_org_role"("organization_id", 'owner'::"text") OR ("user_id" = "auth"."uid"())));



CREATE POLICY "members__insert__is_admin" ON "public"."members" FOR INSERT WITH CHECK (("public"."has_org_role"("organization_id", 'admin'::"text") AND ((("role")::"text" = ANY (ARRAY['membre'::"text", 'tresorier'::"text", 'admin'::"text"])) OR "public"."has_org_role"("organization_id", 'owner'::"text"))));



CREATE POLICY "members__insert__self_join" ON "public"."members" FOR INSERT WITH CHECK ((("user_id" = "auth"."uid"()) AND (("role")::"text" = 'membre'::"text") AND (("status")::"text" = 'pending'::"text")));



CREATE POLICY "members__select__is_member" ON "public"."members" FOR SELECT USING ("public"."has_org_role"("organization_id", 'membre'::"text"));



CREATE POLICY "members__update__is_owner_or_self" ON "public"."members" FOR UPDATE USING (("public"."has_org_role"("organization_id", 'owner'::"text") OR ("user_id" = "auth"."uid"()))) WITH CHECK ("public"."has_org_role"("organization_id", 'owner'::"text"));



ALTER TABLE "public"."organizations" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "orgs__insert__authenticated" ON "public"."organizations" FOR INSERT WITH CHECK (("auth"."uid"() IS NOT NULL));



CREATE POLICY "orgs__select__is_member" ON "public"."organizations" FOR SELECT USING ("public"."has_org_role"("id", 'membre'::"text"));



CREATE POLICY "orgs__update__is_owner" ON "public"."organizations" FOR UPDATE USING ("public"."has_org_role"("id", 'owner'::"text")) WITH CHECK ("public"."has_org_role"("id", 'owner'::"text"));



ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "profiles__select__co_member" ON "public"."profiles" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM ("public"."members" "m1"
     JOIN "public"."members" "m2" ON (("m1"."organization_id" = "m2"."organization_id")))
  WHERE (("m1"."user_id" = "profiles"."id") AND ("m2"."user_id" = "auth"."uid"()) AND (("m2"."status")::"text" = 'active'::"text")))));



CREATE POLICY "profiles__select__self" ON "public"."profiles" FOR SELECT USING (("id" = "auth"."uid"()));



CREATE POLICY "profiles__update__self" ON "public"."profiles" FOR UPDATE USING (("id" = "auth"."uid"())) WITH CHECK (("id" = "auth"."uid"()));



ALTER TABLE "public"."transactions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "transactions__delete__is_owner" ON "public"."transactions" FOR DELETE USING ("public"."has_org_role"("organization_id", 'owner'::"text"));



CREATE POLICY "transactions__insert__is_admin" ON "public"."transactions" FOR INSERT WITH CHECK ("public"."has_org_role"("organization_id", 'admin'::"text"));



CREATE POLICY "transactions__select__is_member" ON "public"."transactions" FOR SELECT USING ("public"."has_org_role"("organization_id", 'membre'::"text"));



CREATE POLICY "transactions__update__is_admin" ON "public"."transactions" FOR UPDATE USING ("public"."has_org_role"("organization_id", 'admin'::"text")) WITH CHECK ("public"."has_org_role"("organization_id", 'admin'::"text"));



GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT ALL ON TABLE "public"."organizations" TO "anon";
GRANT ALL ON TABLE "public"."organizations" TO "authenticated";
GRANT ALL ON TABLE "public"."organizations" TO "service_role";



GRANT ALL ON FUNCTION "public"."create_organization_with_owner"("p_name" "text", "p_slug" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."create_organization_with_owner"("p_name" "text", "p_slug" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_organization_with_owner"("p_name" "text", "p_slug" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_hierarchical_budget"("org_slug_param" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_hierarchical_budget"("org_slug_param" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_hierarchical_budget"("org_slug_param" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_audit_log"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_audit_log"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_audit_log"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."has_org_role"("p_organization_id" "uuid", "p_min_role" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."has_org_role"("p_organization_id" "uuid", "p_min_role" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."has_org_role"("p_organization_id" "uuid", "p_min_role" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."match_categories"("query_embedding" "public"."vector", "match_threshold" double precision, "match_count" integer, "org_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."match_categories"("query_embedding" "public"."vector", "match_threshold" double precision, "match_count" integer, "org_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."match_categories"("query_embedding" "public"."vector", "match_threshold" double precision, "match_count" integer, "org_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."match_category"("query_embedding" "public"."vector", "match_threshold" double precision, "match_count" integer, "org_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."match_category"("query_embedding" "public"."vector", "match_threshold" double precision, "match_count" integer, "org_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."match_category"("query_embedding" "public"."vector", "match_threshold" double precision, "match_count" integer, "org_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "service_role";



GRANT ALL ON TABLE "public"."audit_logs" TO "anon";
GRANT ALL ON TABLE "public"."audit_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."audit_logs" TO "service_role";



GRANT ALL ON TABLE "public"."budget_categories" TO "anon";
GRANT ALL ON TABLE "public"."budget_categories" TO "authenticated";
GRANT ALL ON TABLE "public"."budget_categories" TO "service_role";



GRANT ALL ON TABLE "public"."budget_rules" TO "anon";
GRANT ALL ON TABLE "public"."budget_rules" TO "authenticated";
GRANT ALL ON TABLE "public"."budget_rules" TO "service_role";



GRANT ALL ON TABLE "public"."events" TO "anon";
GRANT ALL ON TABLE "public"."events" TO "authenticated";
GRANT ALL ON TABLE "public"."events" TO "service_role";



GRANT ALL ON TABLE "public"."members" TO "anon";
GRANT ALL ON TABLE "public"."members" TO "authenticated";
GRANT ALL ON TABLE "public"."members" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON TABLE "public"."transaction_audit_logs" TO "anon";
GRANT ALL ON TABLE "public"."transaction_audit_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."transaction_audit_logs" TO "service_role";



GRANT ALL ON TABLE "public"."transactions" TO "anon";
GRANT ALL ON TABLE "public"."transactions" TO "authenticated";
GRANT ALL ON TABLE "public"."transactions" TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";







