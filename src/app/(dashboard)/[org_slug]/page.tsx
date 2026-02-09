export default async function DashboardPage({
  params,
}: {
  params: Promise<{ org_slug: string }>;
}) {
  const { org_slug } = await params;
  return <div className="text-2xl font-bold">Dashboard de : {org_slug}</div>;
}
