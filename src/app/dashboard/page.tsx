import { AuthProvider } from '@/components';
import { Sidebar, Footer } from '@/components';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthProvider>
      <div className="flex min-h-screen">
        <Sidebar />
        <main className="flex-1 lg:mr-72">
          <div className="container mx-auto px-4 py-6 md:px-6 lg:px-8">
            {children}
          </div>
          <Footer />
        </main>
      </div>
    </AuthProvider>
  );
}
