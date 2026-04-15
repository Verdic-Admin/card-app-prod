const fs = require('fs');

function patchFile(filepath, targetMatch, importStatement, replacement) {
    if (!fs.existsSync(filepath)) return;
    let content = fs.readFileSync(filepath, 'utf8');
    
    if (!content.includes('InstructionTrigger')) {
        // Find last import statement to append our new import
        const lastImportIndex = content.lastIndexOf('import ');
        let importEndIndex = content.indexOf('\n', lastImportIndex);
        if (lastImportIndex === -1) importEndIndex = 0;
        
        content = content.slice(0, importEndIndex + 1) + importStatement + '\n' + content.slice(importEndIndex + 1);
    }
    
    if (content.includes(targetMatch)) {
         content = content.replace(targetMatch, replacement);
         fs.writeFileSync(filepath, content);
         console.log('Patched', filepath);
    } else {
         console.log('Match not found in', filepath);
    }
}

// 1. Auction Studio
patchFile(
   'src/app/admin/auction-studio/page.tsx', 
   `Live Auction Studio
          </h1>`, 
   `import { InstructionTrigger } from '@/components/admin/DraggableGuide'`, 
   `Live Auction Studio
              <InstructionTrigger 
                 title="Auction & Coining Guide"
                 steps={[
                    { title: "Stage 1: Pre-Show", content: "Before going live on stream, ensure all auction listings are verified. Any card currently taking bids on the primary market will show up here as 'Pending Block'." },
                    { title: "Stage 2: Active Coining", content: "During the live stream, users will send real-time 'Coin Requests' directly to your phone dashboard here. The dashboard automatically monitors the requests in seconds. Tap the winner on your screen to immediately lock the transaction and reserve the card to their cart without typing a single thing." },
                    { title: "Stage 3: Auto-Routing", content: "Once a 'Coin Request' is granted to a winning viewer, the Edge pipeline automatically halts the auction, assigns the current bid value to the winner's Vercel ledger, and removes the item from horizontal public view. You only need to ship when they perform their checkout." }
                 ]}
              />
          </h1>`
);

// 2. Inventory Table
patchFile(
   'src/components/admin/InventoryTable.tsx',
   `placeholder="Search inventory... (e.g. Ohtani Chrome)"`,
   `import { InstructionTrigger } from '@/components/admin/DraggableGuide'`,
   `placeholder="Search inventory... (e.g. Ohtani Chrome)"
         />
         <InstructionTrigger 
            title="Inventory CRM Instructions"
            steps={[
               { title: "Pricing Engine Rules", content: "The background Oracle constantly recalculates values based on incoming eBay metadata. Adjust your Global Target Percentage in settings to naturally adapt your entire inventory at once." },
               { title: "Mass Categorization", content: "If you need to rapidly label players for upcoming searches, bulk select them using the left-hand checkboxes and assign standardized taxonomies directly from the API." },
               { title: "Manual Status", content: "Changing a status to 'Archived' immediately pulls it from public view but retains the pricing trajectory." }
            ]}
         />`
);

// 3. Trade Leads
patchFile(
   'src/components/admin/TradeLeadsCRM.tsx',
   `Trade & Order Inbox
           </h2>`,
   `import { InstructionTrigger } from '@/components/admin/DraggableGuide'`,
   `Trade & Order Inbox
              <InstructionTrigger 
                 title="Trade & Order Inbox Rules"
                 steps={[
                    { title: "Pending Offers", content: "Buyers submit counter-offer trajectories across your storefront. Acceptances strictly lock the new price temporarily for *their* specific email address to avoid marketplace collisions." },
                    { title: "Manual Verification", content: "Rejecting an offer permanently deletes the attempt. Make sure your email webhook notifications are live so you don't miss 24-hour expiry timers on inbound hits." }
                 ]}
              />
           </h2>`
);

// 4. Admin Settings
patchFile(
   'src/app/admin/settings/page.tsx',
   `Configure critical platform rules, payment methods, and operational logic.</p>`,
   `import { InstructionTrigger } from '@/components/admin/DraggableGuide'`,
   `Configure critical platform rules, payment methods, and operational logic.</p>
               <div className="mt-2 text-left">
                  <InstructionTrigger 
                    title="Store Operations Policy"
                    steps={[
                       { title: "Discount Percentage", content: "This parameter controls your direct-to-buyer edge over eBay. A value of 80% means all cards are automatically listed at 80% of current Oracle comps." },
                       { title: "Payment Routing", content: "Leaving payment links blank dynamically hides those options from the checkout funnel. We recommend activating Venmo and CashApp strictly, as PayPal incurs commercial merchant fees manually." }
                    ]}
                  />
               </div>`
);

// 5. Admin Design
patchFile(
   'src/app/admin/design/page.tsx',
   `Configure visuals, themes, layouts, and public descriptions.</p>`,
   `import { InstructionTrigger } from '@/components/admin/DraggableGuide'`,
   `Configure visuals, themes, layouts, and public descriptions.</p>
               <div className="mt-2 text-left">
                  <InstructionTrigger 
                     title="Theming Engine Rules"
                     steps={[
                        { title: "CSS Variable Architecture", content: "The Edge storefront uses highly optimized CSS variables. Toggling active themes executes live swapping without requiring a hard server rebuild." },
                        { title: "Image Visibility", content: "Make sure all uploaded logos are transparent PNGs or WebP formats, as hard-coded white backgrounds clash aggressively with Dark Mode." }
                     ]}
                  />
               </div>`
);

console.log('Patch complete');
