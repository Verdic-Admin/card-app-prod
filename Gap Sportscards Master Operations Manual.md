**Gap Sportscards Master Operations Manual**  
Welcome to your complete administrative guide for the Gap Sportscards storefront. Your platform is designed as a zero-fee sports card storefront powered by the Player Index AI pricing engine, ensuring you maintain 100% ownership over your data, inventory, and direct-to-buyer transactions 1\.  
The operations of your store are fueled by Player Index API tokens, which are consumed when identifying cards, running scanner jobs, or querying the Oracle for pricing data. Your storefront comes with 50 complimentary tokens, and you can monitor or refill your balance at any time from your Billing dashboard 2\.  
Below is the comprehensive, step-by-step guide on how to manage every facet of your shop.

### 1\. The Bulk Ingestion Wizard (Adding Inventory)

The Bulk Ingestion Wizard is your primary tool for adding cards to your store quickly. It uses the AI Batch Importer to automatically identify and price your cards from photos, saving you from manual data entry 3\.

* **Photography is the Foundation:** Getting your photos right is the most critical step of the ingestion pipeline. If your raw scans or photos are clean and properly spaced, the rest of the AI automation works like magic 4\.  
* **Uploading:** You must provide both a front and back image for every card (or a paired sheet of fronts and backs) 5\. The AI uses the back of the card to correctly identify the set, year, and print run.  
* **Review and Publish:** Once the AI crops and identifies the cards, they land in your staging area. You can review the details, allow the Oracle to apply market pricing, and then publish the drafts to make them live in your storefront 6\.

### 2\. Managing Inventory & Bundles

Your main Inventory Ledger allows you to adjust prices, track cost bases, and manage the availability of your cards.

* **Global Pricing Discount:** To encourage direct sales, you can set a global "Oracle Discount" percentage. This automatically prices your cards a set percentage below the Player Index market value, immediately showing buyers how much they save by shopping directly with you 7\.  
* **Creating Lots (Bundling):** You can select multiple cards from your inventory and group them into a "Bundle & Save" lot. Give the lot a custom title and a combined price. The system will automatically sum the cost basis of all included cards, and buyers will see a special banner encouraging them to buy the whole bundle 8, 9\.

### 3\. Live Auction Studio

The Live Auction Studio lets you bypass traditional auction house fees by hosting real-time or timed auctions directly on your site. The live auction block updates every 3 seconds for a real-time bidding experience 10\.

* **Step 1: Pick Your Cards:** Search your available inventory, select the cards you want to auction, and set an optional starting reserve price and countdown timer 11\.  
* **Step 2: Verify You Own It:** To build buyer trust, snap a quick "Coin" photo. This is a picture of the physical card sitting next to a piece of paper with your name and today's date written on it. Attach this to the auction listing 11\.  
* **Step 3: Go Live:** Click 'Go Live'. Your cards are now up for auction. You can copy the custom link to share on your social media channels (like Facebook, Twitter, or Instagram) to drive traffic 11\.  
* **Step 4: Frictionless Bidding:** Buyers do not need to create complex accounts to bid. They simply enter a social media handle (like their Twitter or Instagram username) and their bid amount 12\.  
* **Step 5: Approvals:** When an auction timer expires, the highest bid goes into your Pending Approvals Queue. From there, you can review the winning bidder and approve the sale (which generates a checkout link) or reject it to send the card back to your standard inventory 13\.

### 4\. Trade & Order Inbox

Your store allows collectors to propose trades or negotiate cash offers 14\. The Trade & Order Inbox is your centralized CRM for managing these deals.

* **Reviewing Offers:** Buyers will send you trade requests (with photos of their offered cards attached) or cash offers. If you accept an offer, the system temporarily locks that specific item and price just for them, ensuring no one else can purchase it out from under them 15\.  
* **Expirations:** Trade proposals and cash offers expire automatically after 24 hours to keep your inventory fluid. If you reject an offer, it is deleted from the system entirely 15\.  
* **Cart Locks:** When a buyer adds items to their cart and proceeds to checkout, the system atomically locks those items for up to 7 days to give them time to submit payment 16\.  
* **Payment Verification:** Once a buyer pays you via your preferred zero-fee method (Venmo, CashApp, etc.), you will manually approve the payment in your inbox. This formally marks the item as "Sold" and moves it to your Past Sales page 17\.

### 5\. Coin Photo Requests CRM

Sometimes, high-end collectors want visual proof that you physically possess a card before they buy or trade for it 18\.

* Buyers can click a button on any listing to request a "Coin" photo.  
* These requests appear in your Coin Requests Action Center 19\.  
* You simply take a photo of the card with your handwritten name/date, upload it to the request, and the system automatically updates the listing and notifies the buyer that the card has been verified 20, 21\.

### 6\. Financial Tax Ledger

To help you manage your business, the Financial Tax Ledger automatically tracks all of your sales data.

* It calculates your Gross Revenue, Total Cost Basis, and Net Profit across all completed transactions 22\.  
* When it's time to do taxes or run accounting, you can click the "1-Click CSV Export" button to download a spreadsheet of every sold card, its sale price, and its original cost basis 22\.

### 7\. Global Settings, Shipping, & Brand Design

The settings panel is your command center for customizing the buyer experience.

* **Payment Methods:** Enter your Venmo, CashApp, PayPal, or Zelle usernames to accept zero-fee payments. If you leave a payment method blank, it will be hidden from buyers at checkout 7\.  
* **Shipping Rules:** You can configure a standard flat-rate shipping fee (e.g., $4.00) and a "Free Shipping" threshold (e.g., free shipping on orders over $25.00) 23\. Typically, standard orders ship in a secure Bubble Mailer With Tracking (BMWT), while smaller, cheaper cards under the threshold ship via Plain White Envelope (PWE) to keep costs down for your buyers 14\.  
* **Brand & Design:** The Theming Engine allows you to change the visual color palette of your store instantly 24\. You can also upload your own logos. It is highly recommended to use transparent PNG files for your logos; if your logo has a solid white background, it will look like a white box if you or a user switches the site to Dark Mode 24\.

