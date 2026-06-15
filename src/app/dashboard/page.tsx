'use client';
import { AuthProvider, Sidebar, Footer } from '@/components';
// ... بقیه imports

export default function DashboardPage() {
  return (
    <AuthProvider>
      <div className="flex min-h-screen">
        <Sidebar />
        <main className="flex-1 lg:mr-72">
          <div className="container mx-auto px-4 py-6">
            {/* محتوای صفحه */}
          </div>
          <Footer />
        </main>
      </div>
    </AuthProvider>
  );
}
