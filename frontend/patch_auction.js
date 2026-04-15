const fs = require('fs');

let c = fs.readFileSync('src/app/admin/auction-studio/page.tsx', 'utf8');

let target = `<InstructionTrigger 
                 title="Auction & Coining Guide"
                 steps={[
                    { title: "Stage 1: Pre-Show", content: "Before going live on stream, ensure all auction listings are verified. Any card currently taking bids on the primary market will show up here as 'Pending Block'." },
                    { title: "Stage 2: Coin Requests", content: "In the hobby, 'coining' a card means proving you physically own it by taking a photo of the card next to a piece of paper with your name and today's date on it. Buyers who want to verify your inventory will submit requests that appear in your Coin Requests CRM." },
                    { title: "Stage 3: Fulfillment", content: "When you receive a Coin Request, snap a photo of the card with your physical 'coin' (name and date). Upload that photo directly into the CRM to instantly securely notify the buyer and proceed with the transaction." }
                 ]}
              />`;

let replacement = `<InstructionTrigger 
                 title="Live Auction Setup Guide"
                 steps={[
                    { title: "Step 1: Configure Stream", content: "First, navigate to your 'Store Operations' settings and past your YouTube or Twitch Live URL. This synchronizes the Edge platform so buyers can view your stream directly alongside the bidding UI." },
                    { title: "Step 2: Staging the Block", content: "Identify which items from your inventory you plan to auction today. Switch their status to 'Pending Block'. This queues them up locally in this studio without immediately sending out push notifications." },
                    { title: "Step 3: Going Live", content: "Once on stream, you can 'Push' an item from your Pending Block to 'Active'. This instantly displays the specific card to all connected viewers and begins accepting real-time bids routed directly to your ledger." }
                 ]}
              />`;

if (c.includes(target)) {
    c = c.replace(target, replacement);
    fs.writeFileSync('src/app/admin/auction-studio/page.tsx', c);
    console.log('Auction patched');
} else {
    console.log('Auction text not found, could not replace.');
}
