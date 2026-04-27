import { ReactNode } from "react";
import { AdminApiCreditsStrip } from "@/components/admin/AdminApiCreditsStrip";
import { ToastProvider } from "@/components/admin/ToastProvider";
import { AutoUpdateBanner } from "@/components/admin/AutoUpdateBanner";
import pool from "@/utils/db";

export const dynamic = 'force-dynamic';

async function getAutoUpdatesEnabled(): Promise<boolean> {
  try {
    const result = await pool.query(
      'SELECT auto_updates_enabled FROM store_settings WHERE id = 1'
    );
    return result.rows[0]?.auto_updates_enabled ?? false;
  } catch {
    return false; // fail open — don't block admin if DB is slow
  }
}

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const autoUpdatesEnabled = await getAutoUpdatesEnabled();
  const adminPassword = process.env.ADMIN_PASSWORD;

  return (
     <div className="flex flex-col min-h-screen">
        {/* Setup Required banner — shown until store owner enables Railway Image Auto Updates */}
        {!autoUpdatesEnabled && (
          <AutoUpdateBanner adminPassword={adminPassword} />
        )}

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

