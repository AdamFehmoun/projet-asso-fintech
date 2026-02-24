import { createClient } from "@/lib/supabase-server";
import { redirect } from "next/navigation";
import OnboardingClient from "./onboarding-client";

export default async function OnboardingPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Récupérer les memberships actifs existants
  const { data: memberships } = await supabase
    .from("members")
    .select(`
      role,
      organizations ( id, name, slug )
    `)
    .eq("user_id", user.id)
    .eq("status", "active")
    .order("created_at", { ascending: true });

  const activeMemberships = memberships ?? [];

  return <OnboardingClient activeMemberships={activeMemberships} />;
}