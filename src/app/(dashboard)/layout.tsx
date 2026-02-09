export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen">
      <aside className="w-64 bg-slate-100 p-4">Sidebar (Menu)</aside>
      <main className="flex-1 p-8">{children}</main>
    </div>
  );
}
