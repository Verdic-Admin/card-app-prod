# The Player Index: Algorithmic Valuation & Forecasting Model

## 1. Executive Summary

The sports card market currently relies on inefficient, lagging pricing models
based on single-asset historical sales (e.g., eBay comps). "The Player Index"
abandons this methodology. We treat the athlete as the underlying equity and the
individual trading cards as derivative contracts.

By calculating a unified "Player Base Index" (the stock price), adjusting it
daily via leading fundamental and sentiment indicators, and cascading that value
down through a "Hub and Spoke" multiplier matrix, we can programmatically
identify arbitrage opportunities before the broader retail market reacts.

---

## 2. The Player Base Index (PBI): The "Stock Price"

Instead of tracking 1,000 different cards for Juan Soto, we first establish Juan
Soto's overarching market capitalization or "Stock Price."

The Player Base Index (PBI) is calculated by taking a volume-weighted rolling
average of a player's highly liquid "Anchor Assets" (typically their flagship
Base Rookie Card and Base Chrome Rookie).

$$PBI_t = \sum_{i=1}^{n} (w_i \times P_{i,t})$$

- $PBI_t$: The Player Base Index at day $t$.
- $P_{i,t}$: The current market clearing price of Anchor Asset $i$.
- $w_i$: The liquidity weighting of Asset $i$ (assets with higher daily trade
  volume carry higher weight).

This gives us a single, clean integer (e.g., Juan Soto PBI = 45.20).

---

## 3. The Alpha Engine: Daily Predictive Forecasting

The retail market is reactive. Our model is predictive. We adjust the
overarching PBI daily based on two distinct streams of Alpha ($\alpha$),
establishing a forward-looking target price.

### 3.1 Fundamental Alpha ($\alpha_f$) - Sabermetrics

We ingest daily MLB API data, prioritizing leading Sabermetrics (metrics that
predict future success rather than reflecting past luck). For hitters, we track
changes in expected Weighted On-Base Average (xwOBA) and Weighted Runs Created
Plus (wRC+). For pitchers, we track Pitching+ and expected Fielder Independent
Pitching (xFIP).

If a player's trailing 14-day fundamental metrics deviate significantly from
their historical baseline, we calculate a fundamental multiplier:

$$\alpha_f = \frac{Sabermetric_{trailing\_14d} - Sabermetric_{baseline}}{Sabermetric_{baseline}} \times \beta_{fundamental}$$

_(Where $\beta$ is our proprietary sensitivity coefficient dictating how much
fundamental shifts should impact price)._

### 3.2 Sentiment Alpha ($\alpha_s$) - NLP & News

We ingest daily news feeds and execute Natural Language Processing (NLP)
sentiment analysis to capture qualitative catalysts (call-up rumors, injury
reports, trade speculation). This generates a daily hype score ranging from -1.0
to 1.0.

$$\alpha_s = \text{NLP\_Hype\_Score} \times \beta_{sentiment}$$

### 3.3 The Target PBI

We combine the current PBI with our daily Alpha indicators to generate the
algorithmic forecast:

$$PBI_{target} = PBI_t \times (1 + \alpha_f + \alpha_s)$$

If the $PBI_{target}$ is significantly higher than the $PBI_t$, the player's
underlying "stock" is undervalued.

---

## 4. The Hub & Spoke Matrix: Asset-Level Pricing

Once we have the overarching $PBI_{target}$, we must translate that macro "stock
price" down to the micro level: the specific piece of cardboard.

We do this via the Hub & Spoke Multiplier Matrix. Every card is priced as a
mathematical derivative of the PBI.

### 4.1 The Set Coefficient ($C_{set}$)

Different brands carry different prestige. A Topps Chrome card commands a higher
baseline than a Topps Holiday card. We assign a macroeconomic coefficient to the
set itself.

### 4.2 The Spoke Multiplier ($M_{parallel}$)

This solves the illiquidity of rare cards (like /99 or 1/1s). We analyze the
entire macroeconomic market to find the average premium of a specific parallel
over a base card, regardless of the player.

$$M_{parallel} = \frac{1}{n} \sum_{k=1}^{n} \frac{P_{spoke,k}}{P_{hub,k}}$$

_(e.g., If X-Fractors consistently trade for 2.5x the price of Base Refractors
across the top 100 players, $M_{parallel} = 2.5$)._

### 4.3 Calculating the Algorithmic Fair Value (AFV)

To price any individual card in your inventory, the engine executes the final
waterfall equation:

$$AFV_{card} = PBI_{target} \times C_{set} \times M_{parallel}$$

---

## 5. The Arbitrage Trigger (Execution)

The final step is cross-referencing our Algorithmic Fair Value ($AFV_{card}$)
against the current lagging retail market price (eBay Comps / Live Inventory
Price).

$$\Delta = \frac{AFV_{card} - Market\_Price}{Market\_Price}$$

- **If $\Delta > 15\%$ (Strong Buy):** The player's leading indicators are
  surging, but the specific parallel hasn't been re-priced by retail sellers
  yet. Acquire inventory.
- **If $\Delta < -15\%$ (Strong Sell):** The player's hype has outpaced their
  underlying Sabermetrics. Liquidate inventory into retail demand.
