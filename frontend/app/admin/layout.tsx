import { AdminSidebar } from "@/components/admin/admin-sidebar";
import { AdminGuard } from "@/components/admin/admin-guard";
import { UserSync } from "@/components/user-sync";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AdminGuard>
      <UserSync />
      <div className="flex min-h-screen bg-background">
        {/* Fixed left sidebar */}
        <AdminSidebar />

        {/* Main content — offset by sidebar width on md+ */}
        <div className="flex-1 flex flex-col min-w-0 md:ml-60 bg-background">
          {children}
        </div>
      </div>
    </AdminGuard>
  );
}
