"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";

// Type explicite pour la jointure Supabase members → organizations
type MembershipWithOrg = {
  organization_id: string;
  role: string;
  status: string;
  organizations: { slug: string } | { slug: string }[] | null;
};

function getSlug(organizations: MembershipWithOrg["organizations"]): string | null {
  if (!organizations) return null;
  const org = Array.isArray(organizations) ? organizations[0] : organizations;
  return org?.slug ?? null;
}

export async function login(formData: FormData) {
  const supabase = await createClient();

  const email    = formData.get("email")    as string;
  const password = formData.get("password") as string;

  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) redirect("/login?error=true");

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: memberships } = await supabase
    .from("members")
    .select(`
      organization_id,
      role,
      status,
      organizations ( slug )
    `)
    .eq("user_id", user.id)
    .eq("status", "active")
    .order("created_at", { ascending: true })
    .returns<MembershipWithOrg[]>();

  const slug = memberships?.[0] ? getSlug(memberships[0].organizations) : null;

  if (slug) {
    revalidatePath(`/${slug}/budget`, "layout");
    redirect(`/${slug}/budget`);
  }

  revalidatePath("/onboarding", "layout");
  redirect("/onboarding");
}

export async function signup(formData: FormData) {
  const supabase = await createClient();

  const { error } = await supabase.auth.signUp({
    email:    formData.get("email")    as string,
    password: formData.get("password") as string,
  });

  if (error) redirect("/error");

  revalidatePath("/", "layout");
  redirect("/onboarding");
}