--
-- PostgreSQL database dump
--

\restrict EZufCzucQfDn6vae1M3ZMZARGYIoUlR5XpMM4S0tUtRf11QByePmHdoCXdJpT15

-- Dumped from database version 17.6
-- Dumped by pg_dump version 17.8 (Ubuntu 17.8-1.pgdg22.04+1)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: pg_database_owner
--

CREATE SCHEMA public;


ALTER SCHEMA public OWNER TO pg_database_owner;

--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: pg_database_owner
--

COMMENT ON SCHEMA public IS 'standard public schema';


--
-- Name: app_role; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.app_role AS ENUM (
    'admin',
    'tresorier',
    'membre'
);


ALTER TYPE public.app_role OWNER TO postgres;

--
-- Name: classification_method; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.classification_method AS ENUM (
    'manual',
    'ai_vector',
    'ai_llm',
    'hard_rule'
);


ALTER TYPE public.classification_method OWNER TO postgres;

--
-- Name: member_status; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.member_status AS ENUM (
    'pending',
    'active',
    'rejected'
);


ALTER TYPE public.member_status OWNER TO postgres;

--
-- Name: transaction_type; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.transaction_type AS ENUM (
    'income',
    'expense'
);


ALTER TYPE public.transaction_type OWNER TO postgres;

--
-- Name: get_hierarchical_budget(text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.get_hierarchical_budget(org_slug_param text) RETURNS TABLE(id uuid, name text, color text, parent_id uuid, rank integer, direct_total bigint, recursive_total bigint)
    LANGUAGE plpgsql SECURITY DEFINER
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


ALTER FUNCTION public.get_hierarchical_budget(org_slug_param text) OWNER TO postgres;

--
-- Name: handle_audit_log(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.handle_audit_log() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
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


ALTER FUNCTION public.handle_audit_log() OWNER TO postgres;

--
-- Name: handle_new_user(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.handle_new_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
begin
  insert into public.profiles (id, full_name, email)
  values (new.id, new.raw_user_meta_data->>'full_name', new.email);
  return new;
end;
$$;


ALTER FUNCTION public.handle_new_user() OWNER TO postgres;

--
-- Name: match_categories(public.vector, double precision, integer, uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.match_categories(query_embedding public.vector, match_threshold double precision, match_count integer, org_id uuid) RETURNS TABLE(id uuid, name text, similarity double precision)
    LANGUAGE plpgsql
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


ALTER FUNCTION public.match_categories(query_embedding public.vector, match_threshold double precision, match_count integer, org_id uuid) OWNER TO postgres;

--
-- Name: match_category(public.vector, double precision, integer, uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.match_category(query_embedding public.vector, match_threshold double precision, match_count integer, org_id uuid) RETURNS TABLE(id uuid, name text, similarity double precision)
    LANGUAGE plpgsql
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


ALTER FUNCTION public.match_category(query_embedding public.vector, match_threshold double precision, match_count integer, org_id uuid) OWNER TO postgres;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: audit_logs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.audit_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    table_name text NOT NULL,
    record_id uuid NOT NULL,
    operation text NOT NULL,
    changed_at timestamp with time zone DEFAULT now() NOT NULL,
    performed_by uuid,
    old_data jsonb,
    new_data jsonb
);


ALTER TABLE public.audit_logs OWNER TO postgres;

--
-- Name: budget_categories; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.budget_categories (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    organization_id uuid NOT NULL,
    parent_id uuid,
    name text NOT NULL,
    color text DEFAULT '#94a3b8'::text,
    rank integer DEFAULT 0,
    embedding public.vector(1536)
);


ALTER TABLE public.budget_categories OWNER TO postgres;

--
-- Name: budget_rules; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.budget_rules (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid,
    pattern text NOT NULL,
    category_id uuid,
    created_at timestamp with time zone DEFAULT now(),
    created_by uuid
);


ALTER TABLE public.budget_rules OWNER TO postgres;

--
-- Name: events; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    organization_id uuid NOT NULL,
    title text NOT NULL,
    description text,
    price integer NOT NULL,
    date timestamp with time zone NOT NULL
);


ALTER TABLE public.events OWNER TO postgres;

--
-- Name: members; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.members (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    organization_id uuid NOT NULL,
    role public.app_role DEFAULT 'membre'::public.app_role,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    status public.member_status DEFAULT 'pending'::public.member_status NOT NULL
);


ALTER TABLE public.members OWNER TO postgres;

--
-- Name: organizations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.organizations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    slug text NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    stripe_account_id text
);


ALTER TABLE public.organizations OWNER TO postgres;

--
-- Name: profiles; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.profiles (
    id uuid NOT NULL,
    full_name text,
    email text,
    avatar_url text,
    updated_at timestamp with time zone
);


ALTER TABLE public.profiles OWNER TO postgres;

--
-- Name: transaction_audit_logs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.transaction_audit_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    transaction_id uuid,
    changed_at timestamp with time zone DEFAULT now(),
    changed_by uuid,
    old_category_id uuid,
    new_category_id uuid,
    old_status text,
    new_status text,
    notes text
);


ALTER TABLE public.transaction_audit_logs OWNER TO postgres;

--
-- Name: transactions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.transactions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    profile_id uuid,
    amount integer NOT NULL,
    type public.transaction_type NOT NULL,
    category text,
    description text,
    date timestamp with time zone DEFAULT now() NOT NULL,
    proof_url text,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    status text DEFAULT 'pending'::text,
    receipt_url text,
    category_id uuid,
    classification_status text DEFAULT 'pending'::text,
    classification_method public.classification_method,
    confidence_score double precision,
    metadata jsonb DEFAULT '{}'::jsonb,
    CONSTRAINT transactions_classification_status_check CHECK ((classification_status = ANY (ARRAY['pending'::text, 'ai_suggested'::text, 'validated'::text, 'flagged'::text])))
);


ALTER TABLE public.transactions OWNER TO postgres;

--
-- Name: audit_logs audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_pkey PRIMARY KEY (id);


--
-- Name: budget_categories budget_categories_organization_id_name_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.budget_categories
    ADD CONSTRAINT budget_categories_organization_id_name_key UNIQUE (organization_id, name);


--
-- Name: budget_categories budget_categories_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.budget_categories
    ADD CONSTRAINT budget_categories_pkey PRIMARY KEY (id);


--
-- Name: budget_rules budget_rules_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.budget_rules
    ADD CONSTRAINT budget_rules_pkey PRIMARY KEY (id);


--
-- Name: events events_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.events
    ADD CONSTRAINT events_pkey PRIMARY KEY (id);


--
-- Name: members members_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.members
    ADD CONSTRAINT members_pkey PRIMARY KEY (id);


--
-- Name: members members_user_id_organization_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.members
    ADD CONSTRAINT members_user_id_organization_id_key UNIQUE (user_id, organization_id);


--
-- Name: organizations organizations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.organizations
    ADD CONSTRAINT organizations_pkey PRIMARY KEY (id);


--
-- Name: organizations organizations_slug_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.organizations
    ADD CONSTRAINT organizations_slug_key UNIQUE (slug);


--
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);


--
-- Name: transaction_audit_logs transaction_audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.transaction_audit_logs
    ADD CONSTRAINT transaction_audit_logs_pkey PRIMARY KEY (id);


--
-- Name: transactions transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.transactions
    ADD CONSTRAINT transactions_pkey PRIMARY KEY (id);


--
-- Name: budget_categories_embedding_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX budget_categories_embedding_idx ON public.budget_categories USING ivfflat (embedding public.vector_cosine_ops) WITH (lists='100');


--
-- Name: idx_audit_transaction_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_audit_transaction_id ON public.transaction_audit_logs USING btree (transaction_id);


--
-- Name: idx_budget_categories_org; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_budget_categories_org ON public.budget_categories USING btree (organization_id);


--
-- Name: idx_budget_categories_parent; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_budget_categories_parent ON public.budget_categories USING btree (parent_id);


--
-- Name: idx_rules_org_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_rules_org_id ON public.budget_rules USING btree (organization_id);


--
-- Name: transactions on_transaction_change; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER on_transaction_change AFTER INSERT OR DELETE OR UPDATE ON public.transactions FOR EACH ROW EXECUTE FUNCTION public.handle_audit_log();


--
-- Name: audit_logs audit_logs_performed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_performed_by_fkey FOREIGN KEY (performed_by) REFERENCES auth.users(id);


--
-- Name: budget_categories budget_categories_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.budget_categories
    ADD CONSTRAINT budget_categories_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: budget_categories budget_categories_parent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.budget_categories
    ADD CONSTRAINT budget_categories_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.budget_categories(id) ON DELETE SET NULL;


--
-- Name: budget_rules budget_rules_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.budget_rules
    ADD CONSTRAINT budget_rules_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.budget_categories(id) ON DELETE CASCADE;


--
-- Name: budget_rules budget_rules_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.budget_rules
    ADD CONSTRAINT budget_rules_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);


--
-- Name: budget_rules budget_rules_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.budget_rules
    ADD CONSTRAINT budget_rules_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: events events_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.events
    ADD CONSTRAINT events_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: members members_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.members
    ADD CONSTRAINT members_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: members members_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.members
    ADD CONSTRAINT members_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: profiles profiles_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: transaction_audit_logs transaction_audit_logs_changed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.transaction_audit_logs
    ADD CONSTRAINT transaction_audit_logs_changed_by_fkey FOREIGN KEY (changed_by) REFERENCES auth.users(id);


--
-- Name: transaction_audit_logs transaction_audit_logs_new_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.transaction_audit_logs
    ADD CONSTRAINT transaction_audit_logs_new_category_id_fkey FOREIGN KEY (new_category_id) REFERENCES public.budget_categories(id);


--
-- Name: transaction_audit_logs transaction_audit_logs_old_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.transaction_audit_logs
    ADD CONSTRAINT transaction_audit_logs_old_category_id_fkey FOREIGN KEY (old_category_id) REFERENCES public.budget_categories(id);


--
-- Name: transaction_audit_logs transaction_audit_logs_transaction_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.transaction_audit_logs
    ADD CONSTRAINT transaction_audit_logs_transaction_id_fkey FOREIGN KEY (transaction_id) REFERENCES public.transactions(id) ON DELETE CASCADE;


--
-- Name: transactions transactions_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.transactions
    ADD CONSTRAINT transactions_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.budget_categories(id) ON DELETE SET NULL;


--
-- Name: transactions transactions_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.transactions
    ADD CONSTRAINT transactions_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: transactions transactions_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.transactions
    ADD CONSTRAINT transactions_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles(id);


--
-- Name: organizations Admins can create orgs; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins can create orgs" ON public.organizations FOR INSERT WITH CHECK ((auth.uid() IS NOT NULL));


--
-- Name: members Admins can join orgs; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins can join orgs" ON public.members FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: members Admins can update members of their org; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins can update members of their org" ON public.members FOR UPDATE USING ((auth.uid() IN ( SELECT m2.user_id
   FROM public.members m2
  WHERE ((m2.organization_id = members.organization_id) AND (m2.role = 'admin'::public.app_role)))));


--
-- Name: audit_logs Audit logs are read-only; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Audit logs are read-only" ON public.audit_logs FOR SELECT USING (true);


--
-- Name: events Auth users can modify events; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Auth users can modify events" ON public.events USING ((auth.role() = 'authenticated'::text));


--
-- Name: organizations Enable update for users; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Enable update for users" ON public.organizations FOR UPDATE USING ((auth.role() = 'authenticated'::text));


--
-- Name: budget_categories Lecture pour les membres de l'orga; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Lecture pour les membres de l'orga" ON public.budget_categories FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.members
  WHERE ((members.organization_id = budget_categories.organization_id) AND (members.user_id = auth.uid())))));


--
-- Name: members Members viewable by members; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Members viewable by members" ON public.members FOR SELECT USING (true);


--
-- Name: transactions Membres peuvent ajouter transactions; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Membres peuvent ajouter transactions" ON public.transactions FOR INSERT WITH CHECK ((organization_id IN ( SELECT members.organization_id
   FROM public.members
  WHERE (members.user_id = auth.uid()))));


--
-- Name: transactions Membres voient transactions de leur asso; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Membres voient transactions de leur asso" ON public.transactions FOR SELECT USING ((organization_id IN ( SELECT members.organization_id
   FROM public.members
  WHERE (members.user_id = auth.uid()))));


--
-- Name: organizations Orgs are viewable by members; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Orgs are viewable by members" ON public.organizations FOR SELECT USING (true);


--
-- Name: events Public can view events; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Public can view events" ON public.events FOR SELECT USING (true);


--
-- Name: profiles Public profiles are viewable by everyone; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Public profiles are viewable by everyone" ON public.profiles FOR SELECT USING (true);


--
-- Name: audit_logs System can insert logs; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "System can insert logs" ON public.audit_logs FOR INSERT WITH CHECK (true);


--
-- Name: members Users can request to join; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can request to join" ON public.members FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: profiles Users can update own profile; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING ((auth.uid() = id));


--
-- Name: audit_logs; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

--
-- Name: budget_categories; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.budget_categories ENABLE ROW LEVEL SECURITY;

--
-- Name: events; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

--
-- Name: members; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.members ENABLE ROW LEVEL SECURITY;

--
-- Name: organizations; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

--
-- Name: profiles; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: transactions; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

--
-- Name: budget_categories Écriture pour les membres; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Écriture pour les membres" ON public.budget_categories USING ((EXISTS ( SELECT 1
   FROM public.members
  WHERE ((members.organization_id = budget_categories.organization_id) AND (members.user_id = auth.uid())))));


--
-- Name: SCHEMA public; Type: ACL; Schema: -; Owner: pg_database_owner
--

GRANT USAGE ON SCHEMA public TO postgres;
GRANT USAGE ON SCHEMA public TO anon;
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO service_role;


--
-- Name: FUNCTION get_hierarchical_budget(org_slug_param text); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.get_hierarchical_budget(org_slug_param text) TO anon;
GRANT ALL ON FUNCTION public.get_hierarchical_budget(org_slug_param text) TO authenticated;
GRANT ALL ON FUNCTION public.get_hierarchical_budget(org_slug_param text) TO service_role;


--
-- Name: FUNCTION handle_audit_log(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.handle_audit_log() TO anon;
GRANT ALL ON FUNCTION public.handle_audit_log() TO authenticated;
GRANT ALL ON FUNCTION public.handle_audit_log() TO service_role;


--
-- Name: FUNCTION handle_new_user(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.handle_new_user() TO anon;
GRANT ALL ON FUNCTION public.handle_new_user() TO authenticated;
GRANT ALL ON FUNCTION public.handle_new_user() TO service_role;


--
-- Name: FUNCTION match_categories(query_embedding public.vector, match_threshold double precision, match_count integer, org_id uuid); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.match_categories(query_embedding public.vector, match_threshold double precision, match_count integer, org_id uuid) TO anon;
GRANT ALL ON FUNCTION public.match_categories(query_embedding public.vector, match_threshold double precision, match_count integer, org_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.match_categories(query_embedding public.vector, match_threshold double precision, match_count integer, org_id uuid) TO service_role;


--
-- Name: FUNCTION match_category(query_embedding public.vector, match_threshold double precision, match_count integer, org_id uuid); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.match_category(query_embedding public.vector, match_threshold double precision, match_count integer, org_id uuid) TO anon;
GRANT ALL ON FUNCTION public.match_category(query_embedding public.vector, match_threshold double precision, match_count integer, org_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.match_category(query_embedding public.vector, match_threshold double precision, match_count integer, org_id uuid) TO service_role;


--
-- Name: TABLE audit_logs; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.audit_logs TO anon;
GRANT ALL ON TABLE public.audit_logs TO authenticated;
GRANT ALL ON TABLE public.audit_logs TO service_role;


--
-- Name: TABLE budget_categories; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.budget_categories TO anon;
GRANT ALL ON TABLE public.budget_categories TO authenticated;
GRANT ALL ON TABLE public.budget_categories TO service_role;


--
-- Name: TABLE budget_rules; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.budget_rules TO anon;
GRANT ALL ON TABLE public.budget_rules TO authenticated;
GRANT ALL ON TABLE public.budget_rules TO service_role;


--
-- Name: TABLE events; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.events TO anon;
GRANT ALL ON TABLE public.events TO authenticated;
GRANT ALL ON TABLE public.events TO service_role;


--
-- Name: TABLE members; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.members TO anon;
GRANT ALL ON TABLE public.members TO authenticated;
GRANT ALL ON TABLE public.members TO service_role;


--
-- Name: TABLE organizations; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.organizations TO anon;
GRANT ALL ON TABLE public.organizations TO authenticated;
GRANT ALL ON TABLE public.organizations TO service_role;


--
-- Name: TABLE profiles; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.profiles TO anon;
GRANT ALL ON TABLE public.profiles TO authenticated;
GRANT ALL ON TABLE public.profiles TO service_role;


--
-- Name: TABLE transaction_audit_logs; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.transaction_audit_logs TO anon;
GRANT ALL ON TABLE public.transaction_audit_logs TO authenticated;
GRANT ALL ON TABLE public.transaction_audit_logs TO service_role;


--
-- Name: TABLE transactions; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.transactions TO anon;
GRANT ALL ON TABLE public.transactions TO authenticated;
GRANT ALL ON TABLE public.transactions TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: supabase_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: public; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: public; Owner: supabase_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: supabase_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO service_role;


--
-- PostgreSQL database dump complete
--

\unrestrict EZufCzucQfDn6vae1M3ZMZARGYIoUlR5XpMM4S0tUtRf11QByePmHdoCXdJpT15

