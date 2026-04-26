import { ReactNode } from "react";
import { AdminApiCreditsStrip } from "@/components/admin/AdminApiCreditsStrip";
import { ToastProvider } from "@/components/admin/ToastProvider";

export const dynamic = 'force-dynamic';

export default async function AdminLayout({ children }: { children: ReactNode }) {
  return (
     <div className="flex flex-col min-h-screen">
        <AdminApiCreditsStrip />

        {/* Render the specific admin subpage */}
        <div className="flex-grow">
           <ToastProvider>
             {children}
           </ToastProvider>
        </div>
     </div>
  );
}
