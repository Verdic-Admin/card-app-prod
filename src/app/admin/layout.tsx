import { ReactNode } from "react";
import Link from "next/link";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  let isUpdateAvailable = false;
  
  try {
     const currentSha = process.env.RAILWAY_GIT_COMMIT_SHA;
     // Only perform the update check if we are actually running inside the Railway container (SHA exists)
     if (currentSha) {
         // Revalidate once an hour to prevent hitting the 60 requests/hr GitHub rate limit
         const res = await fetch('https://api.github.com/repos/Verdic-Admin/card-app-prod/commits/main', { next: { revalidate: 3600 }});
         if (res.ok) {
             const data = await res.json();
             const latestSha = data.sha;
             // If the live repository branch is ahead of the container's build SHA, flag an update
             if (latestSha && latestSha !== currentSha) {
                 isUpdateAvailable = true;
             }
         }
     }
  } catch (err) {
     // Gracefully ignore any network layer exceptions connecting to GitHub API
     console.error("Failed to check for upstream template updates:", err);
  }

  return (
     <div className="flex flex-col min-h-screen">
        {isUpdateAvailable && (
           <div className="bg-amber-500 text-amber-950 px-4 py-3 shadow-md flex flex-col sm:flex-row items-center justify-between gap-4 sticky top-0 z-[100]">
              <div className="flex items-center gap-3 font-bold">
                 <svg className="w-6 h-6 flex-shrink-0 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                 </svg>
                 <span>System Update Available!</span>
              </div>
              <p className="text-sm font-medium hidden md:block">
                 Your store is running an older template version. Sync your codebase to get the latest features and security patches.
              </p>
              <a 
                 href="https://railway.app/dashboard" 
                 target="_blank" 
                 rel="noopener noreferrer" 
                 className="bg-amber-950 text-amber-400 font-black px-5 py-2 rounded-full text-xs uppercase tracking-wider hover:bg-black transition whitespace-nowrap"
              >
                 Update Dashboard
              </a>
           </div>
        )}
        
        {/* Render the specific admin subpage */}
        <div className="flex-grow">
           {children}
        </div>
     </div>
  );
}
