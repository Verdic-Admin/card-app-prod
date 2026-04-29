# Card Shop — Master Operations Manual

Welcome to your complete administrative guide for the Card Shop storefront. Your platform is designed as a zero-fee sports card storefront powered by the Player Index AI pricing engine, ensuring you maintain 100% ownership over your data, inventory, and direct-to-buyer transactions.

The operations of your store are fueled by **Player Index API tokens**, which are consumed when identifying cards, running scanner jobs, or querying the Oracle for pricing data. Your storefront comes with **50 complimentary tokens** at launch, and you can monitor or refill your balance at any time from the **Billing** dashboard.

---

## Table of Contents

1. [Adding Inventory — Free & Premium Tracks](#1-adding-inventory--free--premium-tracks)
2. [AI Batch Importer (Premium Track — Deep Dive)](#2-ai-batch-importer-premium-track--deep-dive)
3. [Managing Inventory & Bundles](#3-managing-inventory--bundles)
4. [Live Auction Studio](#4-live-auction-studio)
5. [Trade & Order Inbox](#5-trade--order-inbox)
6. [Coin Photo Requests CRM](#6-coin-photo-requests-crm)
7. [Financial Tax Ledger](#7-financial-tax-ledger)
8. [Billing & API Tokens](#8-billing--api-tokens)
9. [Global Settings, Shipping & Brand Design](#9-global-settings-shipping--brand-design)

---

## 1\. Adding Inventory — Free & Premium Tracks

Your **Add Inventory** page (`/admin/add-inventory`) is the entry point for getting cards into your store. It offers two isolated tracks so you are never forced to spend tokens accidentally.

### Free Track — Manual Entry (No Tokens)

The Free Track is the default when you open the Add Inventory page. It is designed for listing cards one at a time with full manual control.

* **Upload Front & Back:** Drop or select a front image and a back image for a single card. Both are required before staging.
* **Stage the Card:** Click **Stage Card**. The images are uploaded and a draft row is created in your staging area with no AI calls made.
* **Fill in Details:** Open the staged draft in the inventory grid and manually enter the Player Name, Set, Card Number, Parallel, and any other attributes.
* **Set Your Price:** Enter a price and publish when ready. The Free Track costs zero tokens and has no rate limits.

> **Best use:** Small batches, high-value singles where you want full control, or when you are running low on tokens.

### Premium Track — AI Batch Importer (Uses Tokens)

The Premium Track is the AI-powered pipeline that can identify and price dozens of cards in minutes from a single photo shoot. Switch to it by clicking the **Premium Track** tab on the Add Inventory page.

> See **Section 2** for the full step-by-step breakdown of the Premium Track pipeline.

---

## 2\. AI Batch Importer (Premium Track — Deep Dive)

The AI Batch Importer uses a multi-stage pipeline: **Upload → Crop → Identify → Price → Publish**. Each stage is represented by its own tab inside the wizard.

### Step 1 — Photography (The "Matrix" Method)

Photography is the single most important factor in AI accuracy. Poor photos create poor results.

* **Background:** Place your cards on a solid, high-contrast mat. A **green or blue mat** is strongly recommended — the AI's OpenCV edge detection is tuned for chroma-key colors and will separate cards from the background far more cleanly than gray or white surfaces.
* **Lighting:** Use even, diffused lighting to minimize foil glare. Harsh direct light causes reflections that obscure card text and logos.
* **Spacing:** Leave visible gaps between cards so their edges do not touch. The cropper uses edge detection to locate each card boundary.
* **Grid Arrangement:** After photographing the fronts, flip your entire stack over **in the same grid arrangement** and photograph the backs. The AI pairs each front with the back in the same grid position.

### Step 2 — Upload & Stage

* Select the **Mat color** radio (Green, Blue, or None) to match your scanning background.
* Drag-and-drop or click to select **exactly 2 images** — the front matrix sheet first, then the back matrix sheet.
* The pair is uploaded automatically on file selection and a staging row is created.

### Step 3 — Crop (Staging Tab)

Cards that have been uploaded but not yet cropped appear in the **Staging** tab.

* Click **Crop All** to send the matrix pairs to the vision scanner. The scanner detects card edges using OpenCV and slices the sheet into individual, perfectly paired card rows.
* Cropped cards move to the **Cropped** tab. Failed crops can be re-tried individually.

### Step 4 — Identify (Cropped Tab)

Cards that have been cropped but not yet identified appear in the **Cropped** tab.

* Click **Identify All** to run the batch identification pass. The AI reads the card front and back text to extract: **Player Name, Card Set, Card Number, Insert Name, Parallel Type, and Print Run**.
* **Token cost:** 1 token per batch of up to 9 cards. A sheet of 27 cards costs 3 tokens.
* Results are confidence-scored. Cards above 85% confidence are tagged **High Confidence** and pass automatically. Cards below 85% are flagged **Manual Correction** — review and fix these before pricing.
* Identified cards move to the **Identified** tab.

### Step 5 — Price (Identified Tab)

Cards in the **Identified** tab have a Player Name but no price yet.

* Click **Price All** to query the Player Index Oracle. The Oracle calculates real-time market values from recent sales comps and applies your store's configured **Global Discount Percentage** automatically.
* **Token cost:** 1 token per batch of up to 9 cards.
* Cards with confirmed prices appear in the **Priced** tab.

### Step 6 — Review & Publish (Priced Tab)

* Double-check any fields the AI may have misread — card number, parallel name, or set name are the most common correction points.
* Use the **TaxonomySearch** lookup to snap a card to the exact Player Index taxonomy entry if the AI's match is slightly off.
* Select all cards you are happy with and click **Publish**. They move immediately to your live inventory. Any unselected drafts can be discarded or left for later.

---

## 3\. Managing Inventory & Bundles

Your main **Inventory Ledger** (`/admin`) is the live database of every card in your store.

* **Adjusting Prices:** Click any price field inline to edit it. Changes save automatically on blur.
* **Cost Basis Tracking:** Always enter the exact amount you paid for a raw card in the **Cost Basis** field. This drives your Net Profit calculation in the Tax Ledger. Without it, your profit reporting will be inaccurate.
* **Global Oracle Discount:** In Store Settings, you can set a **Player Index Undercut Percentage**. For example, setting 5% automatically prices all AI-priced cards 5% below the current Player Index fair value, showing buyers a clear "you save X%" badge. This replaces the eBay tax narrative.
* **Availability Toggle:** Mark cards as available or unavailable without deleting them. Unavailable cards remain in your ledger for cost basis and tax tracking but do not appear in the storefront.

### Creating Lots (Bundles)

* Select multiple cards from your inventory using the checkboxes.
* Click **Bundle & Save** and give the lot a custom title and a combined asking price.
* The system automatically sums the cost basis of all included cards, keeping your profit math clean.
* Buyers see a special bundle banner encouraging them to buy the whole lot together.

---

## 4\. Live Auction Studio

Navigate to **Auction Staging** from the Admin Dashboard to reach the Live Auction Studio (`/admin/auction-studio`). It lets you bypass traditional auction house fees by hosting real-time or timed auctions directly on your storefront. The live bidding feed updates every **3 seconds** for a real-time experience.

### Step 1 — Stage Your Cards

* Search your available inventory and select the cards you want to auction.
* Optionally set a **Reserve Price** — if bidding does not reach this number, the card will not sell and returns to your standard inventory.
* Optionally set an **End Time** for a traditional countdown auction (like eBay). Leave the End Time blank if you are running a **live stream** (Whatnot, YouTube, etc.) and want to control the "Sold" hammer manually.

### Step 2 — Add a Coin Photo (Verification)

To build bidder trust, snap a quick **Coin** photo. This is a picture of the physical card sitting next to a piece of paper with your **name/social handle and today's date** written on it. Upload this as the Coin Image for the listing.

This proves to high-value bidders that you physically possess the card at the time of auction.

### Step 3 — Go Live

Click **Go Live**. Your cards are now live on the public `/auction` page. Copy the item link or generate a QR code (enable in Store Settings) to share on your social channels — **Facebook, Twitter/X, Instagram, Discord, or Threads** — to drive bidder traffic.

### Step 4 — Frictionless Bidding

Buyers do **not** need to create an account to bid. They simply enter a social media handle (e.g., their Twitter/X or Instagram username) and their bid amount. This removes checkout friction and maximizes participation.

### Step 5 — Approvals Queue

When an auction timer expires or you manually close a live auction, the highest bid enters your **Pending Approvals Queue** on the Admin Dashboard.

* **Approve:** Generates a checkout link for the winning bidder. The item is locked for them.
* **Reject:** Sends the card back to your standard available inventory with no penalty.

---

## 5\. Trade & Order Inbox

Your store allows collectors to propose trades or negotiate direct cash offers. The **Trade & Order Inbox** is your centralized CRM for managing all of these deals.

### Reviewing Offers

* Buyers send trade requests — including photos of their offered cards — or cash offers directly through your storefront.
* If you accept an offer, the system temporarily locks that specific item and price for that buyer, ensuring no one else can purchase it out from under them during negotiation.

### Offer Lifecycle

* **Pending:** A new offer waiting for your review. You can accept, counter, or decline.
* **Pending Payment:** You have accepted. The buyer has been notified and a checkout link has been shared with them.
* **Sold:** You have manually confirmed payment receipt. The item is marked sold and archived.

### Expirations

Trade proposals and cash offers **do not auto-expire**. If a proposal goes stale, you can manually decline it from the inbox, which removes it from the system and returns the item to your available inventory.

### Cart Locks

When a buyer adds items to their cart and proceeds through checkout, the system **atomically locks** those items for up to **7 days** to give them time to submit payment via their chosen zero-fee method. If payment is not confirmed within that window, the lock expires and the items become available again.

### Payment Verification

Once a buyer pays you via your preferred zero-fee method (Venmo, CashApp, PayPal, Zelle, etc.), you will manually confirm the payment in your inbox. This formally marks the item as **Sold** and moves it to your Past Sales history.

> **P2P Scaling Note:** P2P payment links are ideal for casual-to-moderate volume. As your store scales to consistent daily orders, consider setting up dedicated **Venmo Business** or **Cash App for Business** accounts. You'll incur a small commercial fee (~1.9%), but your funds will never be frozen for violating personal-account acceptable-use policies.

---

## 6\. Coin Photo Requests CRM

High-end collectors often want visual proof that you physically possess a card before committing to a purchase or trade.

* Any buyer can click the **Request Coin Photo** button on any card listing page.
* The request appears in your **Coin Requests Action Center** on the Admin Dashboard.
* To fulfill a request: photograph the card next to a piece of paper with your handwritten name and today's date, then upload the image to the request.
* The system automatically updates the listing with the verification photo and notifies the buyer — all within your platform, with no external coordination needed.

> **Turnaround Standard:** The platform sets buyer expectations at a 24-hour fulfillment window. Fulfilling quickly builds the seller reputation that drives repeat buyers.

---

## 7\. Financial Tax Ledger

The **Financial Tax Ledger** is visible directly on your Admin Dashboard and automatically tracks all completed sales data.

* **Gross Revenue:** The total of all `listed_price` values across sold items.
* **Total Cost Basis:** The sum of your acquisition costs for all sold cards.
* **Estimated Shipping Fees:** Calculated at a flat rate per distinct transaction to give you a realistic profit figure.
* **Net Profit:** `Gross Revenue − Cost Basis − Estimated Shipping`.

### 1-Click CSV Export

Click the **1-Click CSV Export** button in the top-right corner of the ledger panel. It immediately downloads a `.csv` file named `tax_ledger_YYYY-MM-DD.csv` containing every sold card with the following columns:

| Column | Description |
|---|---|
| `Card_ID` | Unique database ID for the item |
| `Player` | Player name |
| `Set` | Card set name |
| `Listed_Price` | The price the card sold for |
| `Cost_Basis` | Your acquisition cost |
| `Sold_Date` | Timestamp of the sale |

This file can be handed directly to your accountant for capital gains calculations and inventory flow reporting during tax season.

---

## 8\. Billing & API Tokens

Navigate to **Billing** (`/admin/billing`) to view your current token balance and subscription plan.

### How Tokens Work

* **1 token = up to 9 cards** identified via the AI Batch Importer in a single API call.
* **1 token = up to 9 cards** priced via the Oracle batch pricing call.
* Single-card manual re-price or re-identify operations also consume 1 token each.
* The Free Track (manual entry) consumes **zero tokens**.

### Token Balance Warning

When your balance drops below **100 tokens**, a low-balance warning banner appears on the Billing page. At **0 tokens**, AI identification, Oracle pricing, and scanner jobs will stop working until you refill.

### Subscription Tiers

| Tier | Monthly Price | Tokens / Month | Card Capacity |
|---|---|---|---|
| **Starter** | Free (included) | 50 | ~150 cards |
| **Standard** | $9 / mo | 1,000 | ~3,000 cards |
| **Pro** | $29 / mo | 5,000 | ~15,000 cards |
| **Enterprise** | $99 / mo | 25,000 | ~75,000 cards |

Tokens are non-expiring — unused tokens from a refill roll forward.

### Refilling Tokens

Click **Open Player Index Billing** on the Billing page to go directly to `playerindexdata.com/developers/dashboard/billing`. Sign in with the **same account you used to claim your API key**. You can purchase one-time token packs or upgrade your monthly subscription from there.

For questions or manual top-ups, email **support@playerindexdata.com**.

---

## 9\. Global Settings, Shipping & Brand Design

### Store Settings (`/admin/settings`)

The settings page is your operational control panel.

**Checkout & Payments**

* **Cart Minimum Spend:** Set a minimum cart total (e.g., $20.00) to prevent unprofitable small transactions. Buyers cannot check out until their cart meets this threshold.
* **Payment Methods:** Enter your permanent profile links for each supported zero-fee method. Leave any field blank to hide that option entirely from buyers at checkout.
  * **Venmo** — full profile URL, e.g., `https://venmo.com/u/YourShop`
  * **PayPal** — PayPal.me link, e.g., `https://paypal.me/YourShop`
  * **Cash App** — Cashtag URL, e.g., `https://cash.app/$YourCashtag`
  * **Zelle** — your registered phone number or email address (no URL)
* **Instruction Copy:** An optional custom message shown to buyers at checkout (e.g., "Please include your order number in the payment note").

**Platform Features**

* **Player Index Undercut Percentage:** How far below the Oracle's fair value you want to auto-price cards (e.g., `5` = 5% below market). Set to `0` to match market exactly.
* **Accept Trade Offers:** Toggle this off entirely to pause all incoming trade proposals — useful when you are on vacation or taking a break from negotiations.

**Live Auction**

* **Show QR Code in Auction Studio:** Displays a scannable QR code during your auction stream that sends viewers directly to your live `/bid` page.

### Brand & Design (`/admin/design`)

**Identity**

* **Site Name:** Displayed in the Navbar, page titles, and social share cards.
* **Author / Subtitle:** An optional line shown below the site name (e.g., "by John Doe"). Leave blank to hide.
* **Store Theme:** Instantly changes the entire storefront color palette. Available themes: **Dark, Light (Clean), Midnight Indigo, Field Green, Ruby Red, Amber Sunrise**.

**Announcement Banner**

* Enter any text to display a high-visibility banner at the top of every store page (e.g., "Huge holiday sale — free shipping over $50!").
* Optionally add a link so the banner text becomes clickable.
* Leave blank to hide the banner entirely.

**Social Links**

Enter full URLs for any social profiles you want displayed in your store footer. Leaving a field blank automatically hides that platform's icon. Supported: **Instagram, Twitter/X, Facebook, Discord, Threads**.

**Logo Guidelines**

* Upload your logo in the Brand & Design panel.
* **Always use transparent PNG or WEBP files.** A logo with a solid white background will appear as a harsh white box when buyers switch to Dark Mode or any dark theme.
* If your only source file has a white background, use a free tool like `remove.bg` to create a transparent version before uploading.

### Shipping Rules

Shipping fees are calculated automatically at checkout based on the settings you configure:

* **Flat Shipping Fee:** The default fee charged on orders below the free-shipping threshold (e.g., `$4.00`).
* **Free Shipping Threshold:** Any order subtotal at or above this amount qualifies for free shipping (e.g., `$25.00`).

**Standard shipping conventions for sports cards:**

* Orders **below** the threshold → **Plain White Envelope (PWE)** — low cost, no tracking.
* Orders **at or above** the threshold → **Bubble Mailer With Tracking (BMWT)** — fully tracked via USPS, with the tracking number uploaded to the buyer's payment record.

---

*For platform updates, support, or billing questions, contact **support@playerindexdata.com**.*
