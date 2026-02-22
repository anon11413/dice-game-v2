# DiceStock Engine — Complete Implementation Specification v1.0

## Purpose

This document is the **sole authoritative reference** a coder needs to implement the DiceStock engine from scratch. Every equation is final. Every threshold is specified. No design decisions remain open.

The engine simulates a single stock whose price emerges from a 100×100 grid of 20-sided dice rolled each tick. Dice never move price directly. Instead, dice configure **agents, liquidity, sentiment, volatility, short interest, events, and regime** — which together generate orders fed into a limit order book. The last trade price is the stock price.

---

## Table of Contents

1. Global Constants & State Variables
2. The Dice Grid — Band Layout
3. Tick Lifecycle (Execution Order)
4. Band 7: Volatility Regime
5. Band 4: Fundamental Value Anchor
6. Bands 1–3: Multi-Timeframe Directional Agents
7. Band 6: Liquidity Providers (Market Makers)
8. Band 5: Short Sellers & Short Squeeze Mechanics
9. Band 8: News / Event Shocks
10. Band 9: Crowd Sentiment (FOMO / Fear)
11. Band 10: Meta-Regime (Trend vs Chop)
12. The Limit Order Book & Matching Engine
13. Post-Tick State Updates
14. Data Logging & Player-Visible Information
15. Tuning Guidelines & Sanity Checks
16. Glossary

---

## 1. Global Constants & State Variables

### 1.1 Constants (tunable before simulation start, fixed during run)

| Symbol | Name | Default | Description |
|---|---|---|---|
| `GRID_ROWS` | Grid rows | 100 | Always 100 |
| `GRID_COLS` | Grid cols | 100 | Always 100 |
| `DIE_MIN` | Die minimum | 1 | Inclusive |
| `DIE_MAX` | Die maximum | 20 | Inclusive |
| `P_INIT` | Initial price | 100.00 | Starting stock price |
| `F_INIT` | Initial fundamental | 100.00 | Starting fundamental value |
| `FLOAT` | Total share float | 10,000,000 | Total shares available |
| `SI_INIT` | Initial short interest | 500,000 | Shares sold short at start |
| `TICK_RATE` | Ticks per sim-day | 390 | Mimics ~1 tick per minute in a trading day |
| `BOOK_DEPTH_INIT` | Initial book depth per side | 50 levels | Seed the book at start |
| `TICK_SIZE` | Minimum price increment | 0.01 | Penny tick |
| `MAX_ORDER_LIFETIME` | Ticks before unfilled limits expire | 100 | Prevents stale order buildup |
| `F_DRIFT_RATE` | Fundamental drift per tick | 0.002 | Max absolute drift in F per tick |
| `SQUEEZE_UTIL_THRESH` | Utilization threshold for squeeze eligibility | 0.45 | ShortInterest / FLOAT |
| `SQUEEZE_PRICE_THRESH` | Price rise % over window to trigger squeeze | 0.03 | 3% rise over SQUEEZE_WINDOW |
| `SQUEEZE_WINDOW` | Lookback ticks for squeeze price check | 20 | |
| `SQUEEZE_COVER_RATE` | Fraction of SI forced to cover per tick during squeeze | 0.08 | |
| `SQUEEZE_COOLDOWN` | Minimum ticks between squeeze triggers | 50 | |
| `EVENT_HIGH_THRESH` | Band 8 mean threshold for positive shock | 17.0 | |
| `EVENT_LOW_THRESH` | Band 8 mean threshold for negative shock | 4.0 | |
| `EVENT_DURATION` | Ticks an event shock persists | 15 | |
| `SENTIMENT_DECAY` | Exponential decay rate for sentiment smoothing | 0.92 | |

### 1.2 Mutable State (updated every tick)

| Symbol | Type | Description |
|---|---|---|
| `dice[100][100]` | int matrix | Current tick's dice values (1–20) |
| `P_t` | float | Current stock price (last trade) |
| `F_t` | float | Latent fundamental value |
| `SI_t` | int | Current short interest (shares) |
| `kappa_t` | float | Current volatility multiplier |
| `sentiment_t` | float | Smoothed sentiment score (0–1 scale) |
| `regime_t` | object | `{trend_persistence: float, reversal_prob: float}` |
| `squeeze_active` | bool | Whether a squeeze is currently in progress |
| `squeeze_cooldown_remaining` | int | Ticks until next squeeze can trigger |
| `event_active` | object/null | `{direction: +1/-1, ticks_remaining: int, magnitude: float}` or null |
| `order_book` | object | `{bids: SortedList, asks: SortedList}` |
| `price_history[]` | float array | Rolling buffer of last 1000 P_t values |
| `volume_history[]` | int array | Rolling buffer of last 1000 tick volumes |
| `tick_count` | int | Global tick counter |

---

## 2. The Dice Grid — Band Layout

The 100×100 grid is divided into **10 horizontal bands**, each 10 rows × 100 columns.

| Band | Rows | Role | Acts Every |
|---|---|---|---|
| Band 1 | 0–9 | Intraday Scalpers | Every tick |
| Band 2 | 10–19 | Swing Traders (daily) | Every 13 ticks |
| Band 3 | 20–29 | Position Traders (weekly) | Every 65 ticks |
| Band 4 | 30–39 | Fundamental / Value Agents | Every 65 ticks |
| Band 5 | 40–49 | Short Sellers & Borrow | Every tick |
| Band 6 | 50–59 | Market Makers / Liquidity | Every tick |
| Band 7 | 60–69 | Volatility Regime | Every tick |
| Band 8 | 70–79 | News / Event Shocks | Every tick (but events are rare) |
| Band 9 | 80–89 | Crowd Sentiment | Every tick |
| Band 10 | 90–99 | Meta-Regime (trend/chop) | Every 13 ticks |

Each band contains **1,000 dice** (10 rows × 100 columns). Within directional bands (1–3, 5), each **column** (j = 0..99) represents one micro-agent, and that agent's 10 dice (rows within the band) determine its behavior on active ticks.

### 2.1 Band Statistics Helper

For any band b, define:

```
band_mean(b) = mean of all 1000 dice in band b
band_std(b)  = standard deviation of all 1000 dice in band b
col_mean(b, j) = mean of the 10 dice in column j of band b
```

The expected mean of a uniform d20 is **10.5** and expected std is approximately **5.77**.

---

## 3. Tick Lifecycle (Execution Order)

Every tick follows this exact sequence:

```
1.  Roll all 10,000 dice (uniform random integers [1, 20]).
2.  Compute band statistics for all 10 bands.
3.  PHASE A — Environment Update:
    a. Update volatility multiplier kappa_t          (Band 7)
    b. Update fundamental value F_t                  (Band 4, if active tick)
    c. Update meta-regime regime_t                   (Band 10, if active tick)
    d. Update smoothed sentiment sentiment_t         (Band 9)
    e. Evaluate event triggers                       (Band 8)
    f. Evaluate squeeze conditions                   (Band 5 + global state)
4.  PHASE B — Order Generation:
    a. Expire stale orders from the book (age > MAX_ORDER_LIFETIME).
    b. Generate market-maker orders                  (Band 6)
    c. Generate scalper orders                       (Band 1)
    d. Generate swing orders                         (Band 2, if active tick)
    e. Generate position orders                      (Band 3, if active tick)
    f. Generate value agent orders                   (Band 4, if active tick)
    g. Generate short-seller orders                  (Band 5)
    h. Generate squeeze cover orders (if squeeze_active)
5.  PHASE C — Matching:
    a. Shuffle all new market orders randomly.
    b. Feed market orders one-by-one into the matching engine.
    c. Insert new limit orders into the book.
    d. Record last trade price as P_t.
6.  PHASE D — Post-Tick:
    a. Update price_history, volume_history.
    b. Decrement squeeze_cooldown_remaining.
    c. Decrement event ticks_remaining.
    d. Increment tick_count.
    e. Log full tick data.
```

---

## 4. Band 7: Volatility Regime

### 4.1 Computing kappa_t

```
v = band_mean(7)               // range [1, 20], expected 10.5
v_std = band_std(7)            // secondary signal

// Primary mapping (piecewise linear):
if v <= 5:
    kappa_raw = 0.3
elif v <= 8:
    kappa_raw = 0.3 + (v - 5) * (0.7 / 3)        // ramps 0.3 → 1.0
elif v <= 13:
    kappa_raw = 1.0                                 // normal regime
elif v <= 17:
    kappa_raw = 1.0 + (v - 13) * (1.5 / 4)        // ramps 1.0 → 2.5
else:
    kappa_raw = 2.5 + (v - 17) * (1.5 / 3)        // ramps 2.5 → 4.0

// Intra-band disagreement bonus: if dice are very spread out, add instability
if v_std > 7.0:
    kappa_raw *= 1.0 + (v_std - 7.0) * 0.15

// Smooth to avoid instant regime flips:
kappa_t = 0.7 * kappa_t_prev + 0.3 * kappa_raw

// Clamp:
kappa_t = clamp(kappa_t, 0.2, 5.0)
```

### 4.2 What kappa_t affects

kappa_t is used downstream by nearly every other band as a scaling factor on order sizes, spread widths, and aggression probabilities. It is the single most important cross-band coupling.

---

## 5. Band 4: Fundamental Value Anchor

### 5.1 Updating F_t (every 65 ticks)

```
f = band_mean(4)               // range [1, 20]

// Direction:
if f > 12:
    drift_direction = +1
elif f < 9:
    drift_direction = -1
else:
    drift_direction = 0

// Magnitude scales with how extreme the dice are:
drift_magnitude = F_DRIFT_RATE * abs(f - 10.5) / 9.5   // normalized 0–1
drift_magnitude *= F_t                                    // percentage-based

F_t = F_t + drift_direction * drift_magnitude
F_t = max(F_t, 0.01)                                     // floor to prevent negative
```

### 5.2 Value Agent Orders (every 65 ticks)

For each column j in Band 4 (100 agents):

```
agent_bias = col_mean(4, j)       // 1–20
gap = P_t - F_t                   // positive means overvalued
gap_pct = gap / F_t

// Agent acts only if gap is meaningful:
if abs(gap_pct) < 0.02:
    // No order from this agent
    continue

if gap_pct > 0 and agent_bias < 10:
    // Price above fundamental AND agent dice lean bearish → SELL limit
    size = floor(20 + (10 - agent_bias) * 8 * kappa_t)
    limit_price = P_t + uniform(0.01, 0.05 * kappa_t * P_t)
    emit LIMIT_SELL(price=limit_price, size=size)

elif gap_pct < 0 and agent_bias > 11:
    // Price below fundamental AND agent dice lean bullish → BUY limit
    size = floor(20 + (agent_bias - 11) * 8 * kappa_t)
    limit_price = P_t - uniform(0.01, 0.05 * kappa_t * P_t)
    emit LIMIT_BUY(price=limit_price, size=size)
```

This creates a soft gravitational pull toward F_t without instant mean reversion: the pull is slow, contested, and only engages when the gap is large enough and the dice cooperate.

---

## 6. Bands 1–3: Multi-Timeframe Directional Agents

All three bands use the **same agent logic**, just with different activation frequencies and parameter scales.

### 6.1 Band Parameters

| Param | Band 1 (Scalp) | Band 2 (Swing) | Band 3 (Position) |
|---|---|---|---|
| Active every N ticks | 1 | 13 | 65 |
| Base order size | 10 | 80 | 400 |
| Market order probability | 0.6 | 0.35 | 0.2 |
| Limit offset range (fraction of P_t) | 0.001–0.005 | 0.005–0.02 | 0.01–0.05 |
| Regime influence weight | 0.7 | 0.4 | 0.15 |

### 6.2 Per-Agent Logic (for each column j in the band)

```
cm = col_mean(band, j)           // agent's dice mean, range [1, 20]
bm = band_mean(band)             // band consensus

// Step 1: Raw directional signal from agent's own dice
if cm >= 14:
    raw_dir = +1                  // bullish
elif cm <= 7:
    raw_dir = -1                  // bearish
else:
    raw_dir = 0                   // neutral → no order

if raw_dir == 0:
    continue                      // this agent sits out

// Step 2: Conviction strength (how extreme are the dice)
conviction = abs(cm - 10.5) / 9.5    // 0–1 normalized

// Step 3: Regime influence — trend persistence biases toward continuing last direction
last_direction = sign(P_t - price_history[tick_count - 1]) if tick_count > 0 else 0
regime_weight = BAND_REGIME_WEIGHT[band]

if uniform(0, 1) < regime_t.trend_persistence * regime_weight:
    // Override direction to continue trend
    if last_direction != 0:
        raw_dir = last_direction

// Step 4: Sentiment modification
// High sentiment amplifies buying, low sentiment amplifies selling
if raw_dir == +1 and sentiment_t > 0.65:
    conviction *= 1.0 + (sentiment_t - 0.65) * 2.0    // up to ~1.7x
elif raw_dir == -1 and sentiment_t < 0.35:
    conviction *= 1.0 + (0.35 - sentiment_t) * 2.0

// Step 5: Event modification
if event_active is not null:
    if event_active.direction == raw_dir:
        conviction *= 1.0 + event_active.magnitude
    else:
        conviction *= max(0.2, 1.0 - event_active.magnitude * 0.5)

// Step 6: Generate order
size = floor(BASE_SIZE[band] * conviction * kappa_t)
size = max(size, 1)

if uniform(0, 1) < MARKET_ORDER_PROB[band] * kappa_t:
    // Market order (immediate execution attempt)
    emit MARKET_BUY(size) if raw_dir == +1 else MARKET_SELL(size)
else:
    // Limit order (resting)
    offset = uniform(LIMIT_OFFSET_MIN[band], LIMIT_OFFSET_MAX[band]) * P_t * kappa_t
    if raw_dir == +1:
        emit LIMIT_BUY(price = P_t - offset, size = size)
    else:
        emit LIMIT_SELL(price = P_t + offset, size = size)
```

### 6.3 Why This Produces Rich Behavior

Because Band 1 fires every tick with high market-order probability, it creates the noisy intraday fluctuations. Band 2 periodically drops larger directional clusters that create intraday trends and daily candle bodies. Band 3 very infrequently drops big orders that create weekly swing highs and lows. When multiple bands align (all bullish at once), you get powerful multi-day rallies. When they conflict, you get choppy consolidation.

---

## 7. Band 6: Liquidity Providers (Market Makers)

### 7.1 Computing MM Parameters

```
mm_mean = band_mean(6)
mm_std = band_std(6)

// Target half-spread (distance from mid to best bid/ask):
// Low mm_mean → wide spread (scared MMs), high → tight
base_spread_pct = 0.003                                // 0.3% of price
spread_factor = 2.5 - (mm_mean / 20.0) * 2.0          // ranges ~0.5 (tight) to ~2.5 (wide)
spread_factor *= kappa_t                                // vol widens spreads
half_spread = P_t * base_spread_pct * spread_factor
half_spread = max(half_spread, TICK_SIZE)

// Depth (shares at each level):
base_depth = 500
depth_factor = mm_mean / 10.5                          // >1 if confident, <1 if scared
depth = floor(base_depth * depth_factor / kappa_t)     // high vol → thinner book
depth = max(depth, 10)

// Number of levels to populate on each side:
num_levels = 20
```

### 7.2 Generating MM Orders

Every tick, the MM band **cancels all its previous resting orders** and replaces them:

```
for level_i in range(num_levels):
    level_offset = half_spread + level_i * TICK_SIZE * spread_factor * 2

    // Depth tapers at outer levels:
    level_depth = floor(depth * (1.0 - level_i * 0.03))
    level_depth = max(level_depth, 5)

    bid_price = round_to_tick(P_t - level_offset)
    ask_price = round_to_tick(P_t + level_offset)

    emit LIMIT_BUY(price=bid_price, size=level_depth, source="MM")
    emit LIMIT_SELL(price=ask_price, size=level_depth, source="MM")
```

### 7.3 Liquidity Withdrawal (Flash Crash Mechanic)

If **any** of these conditions are true, MMs pull back drastically:

```
// Condition A: Extreme volatility
vol_panic = kappa_t > 3.0

// Condition B: Price moved more than 2% in last 5 ticks
if tick_count >= 5:
    recent_move = abs(P_t - price_history[tick_count - 5]) / price_history[tick_count - 5]
    fast_move = recent_move > 0.02
else:
    fast_move = false

// Condition C: MM dice are extremely low (MMs individually scared)
mm_fear = mm_mean < 4.0

if vol_panic or fast_move or mm_fear:
    // Reduce depth to 20% of normal, widen spread by 3x
    depth = floor(depth * 0.2)
    half_spread *= 3.0
    num_levels = 5                // only populate close levels
```

This is how flash crashes and "air pockets" emerge: when multiple bad signals converge, the book empties and even small market orders cause massive slippage.

---

## 8. Band 5: Short Sellers & Short Squeeze Mechanics

### 8.1 Short Interest Tracking

```
utilization = SI_t / FLOAT          // 0 to potentially > 1.0 (naked/hard-to-borrow)
borrow_cost = 0.01 + utilization^2  // accelerating cost as utilization rises
```

### 8.2 Short Seller Agent Orders (every tick)

For each column j in Band 5:

```
cm = col_mean(5, j)

// High dice → agent wants to short more
// Low dice → agent wants to cover (buy back)
if cm >= 14 and utilization < 1.2:
    // Open new short position → SELL
    aggression = (cm - 13) / 7.0                   // 0–1
    size = floor(30 * aggression * kappa_t)
    
    // Borrow cost discourages at high utilization:
    if uniform(0, 1) > borrow_cost:
        if uniform(0, 1) < 0.4:
            emit MARKET_SELL(size)
        else:
            emit LIMIT_SELL(price = P_t + uniform(0, 0.003) * P_t, size = size)
        SI_t += size

elif cm <= 7:
    // Voluntarily cover shorts → BUY
    cover_urgency = (8 - cm) / 7.0
    size = floor(20 * cover_urgency * kappa_t)
    size = min(size, SI_t)                         // can't cover more than exists
    
    if uniform(0, 1) < 0.5 * kappa_t:
        emit MARKET_BUY(size)
    else:
        emit LIMIT_BUY(price = P_t - uniform(0, 0.002) * P_t, size = size)
    SI_t -= size
    SI_t = max(SI_t, 0)
```

### 8.3 Squeeze Detection & Execution

Evaluated every tick after Band 5 agent orders:

```
// Can only trigger if cooldown has expired:
if squeeze_cooldown_remaining > 0:
    squeeze_eligible = false
else:
    squeeze_eligible = true

// Check squeeze conditions (ALL must be true):
if squeeze_eligible and not squeeze_active:
    cond_util      = utilization > SQUEEZE_UTIL_THRESH
    
    if tick_count >= SQUEEZE_WINDOW:
        price_rise = (P_t - price_history[tick_count - SQUEEZE_WINDOW]) / price_history[tick_count - SQUEEZE_WINDOW]
    else:
        price_rise = 0
    cond_price     = price_rise > SQUEEZE_PRICE_THRESH
    
    cond_sentiment = sentiment_t > 0.6
    cond_vol       = kappa_t > 1.2

    if cond_util and cond_price and cond_sentiment and cond_vol:
        squeeze_active = true
        squeeze_cooldown_remaining = SQUEEZE_COOLDOWN

// Execute squeeze forced covering:
if squeeze_active:
    forced_cover = floor(SI_t * SQUEEZE_COVER_RATE)
    forced_cover = max(forced_cover, 1)
    
    // Forced covers are MARKET BUYS (urgent, accepting slippage):
    emit MARKET_BUY(size = forced_cover, source = "SQUEEZE")
    SI_t -= forced_cover
    SI_t = max(SI_t, 0)

    // Squeeze ends when SI drops below 20% of FLOAT or after 40 ticks:
    if utilization < 0.20:
        squeeze_active = false
    // Also track squeeze duration and cap at 40 ticks (add a counter)
```

### 8.4 Why This Produces Squeezes Naturally

Short interest builds gradually as Band 5 dice run high over many ticks. Once utilization is high, any catalyst (event shock, sentiment spike, price rally from Bands 1–3 aligning bullish) can trip the squeeze trigger. The forced covering creates market buys that push price up, which can cause even more covering by voluntary covers (agents with low dice in Band 5), creating the feedback loop. Meanwhile, liquidity providers may pull back (Band 6 reacting to fast moves), causing even larger price jumps per forced cover unit. The squeeze eventually exhausts itself as short interest drops.

---

## 9. Band 8: News / Event Shocks

### 9.1 Event Evaluation (every tick)

```
e_mean = band_mean(8)

if event_active is null:
    // Check for new event:
    if e_mean >= EVENT_HIGH_THRESH:
        // Positive shock
        magnitude = (e_mean - EVENT_HIGH_THRESH) / (20 - EVENT_HIGH_THRESH)  // 0–1
        event_active = {
            direction: +1,
            ticks_remaining: EVENT_DURATION,
            magnitude: magnitude * kappa_t    // vol amplifies shocks
        }
    elif e_mean <= EVENT_LOW_THRESH:
        // Negative shock
        magnitude = (EVENT_LOW_THRESH - e_mean) / (EVENT_LOW_THRESH - 1)
        event_active = {
            direction: -1,
            ticks_remaining: EVENT_DURATION,
            magnitude: magnitude * kappa_t
        }
else:
    // Existing event decays:
    event_active.ticks_remaining -= 1
    event_active.magnitude *= 0.90            // decay magnitude each tick

    if event_active.ticks_remaining <= 0:
        event_active = null
```

### 9.2 How Events Affect Other Bands

Events don't generate orders themselves. Instead, `event_active` modifies behavior in Bands 1–3 (see Section 6.2, Step 5), Band 6 (heightened volatility response), and contributes to squeeze eligibility. This means the same dice roll in Band 8 cascades through the entire system differently depending on what else is happening — high short interest + positive shock = potential squeeze; low short interest + positive shock = just a pop that fades.

---

## 10. Band 9: Crowd Sentiment (FOMO / Fear)

### 10.1 Sentiment Computation

```
s_raw = band_mean(9)
s_normalized = (s_raw - 1) / 19.0              // map [1, 20] → [0, 1]

// Exponential smoothing to prevent instant sentiment flips:
sentiment_t = SENTIMENT_DECAY * sentiment_t_prev + (1 - SENTIMENT_DECAY) * s_normalized

// Clamp:
sentiment_t = clamp(sentiment_t, 0.0, 1.0)
```

### 10.2 Sentiment Effects Summary

| sentiment_t Range | Label | Effect |
|---|---|---|
| 0.00 – 0.20 | Extreme Fear | Sellers much more aggressive, buyers hesitant, limit buys pulled far from price |
| 0.20 – 0.40 | Fear | Modest sell bias in Bands 1–3, shorts more confident in Band 5 |
| 0.40 – 0.60 | Neutral | No modification to base behavior |
| 0.60 – 0.80 | Greed | Modest buy bias, shorts less confident, squeeze eligibility boosted |
| 0.80 – 1.00 | Extreme FOMO | Buyers chase aggressively (market orders increase), profit-taking delayed, squeeze trigger more sensitive |

These effects are implemented inside the per-agent logic of Bands 1–3 (Section 6.2, Step 4) and Band 5 (Section 8.2, voluntary covering bias).

---

## 11. Band 10: Meta-Regime (Trend vs Chop)

### 11.1 Regime Update (every 13 ticks)

```
r_mean = band_mean(10)
r_std = band_std(10)

// Trend persistence: probability that an agent continues the prior tick's direction
// High r_mean → trending market; low → mean-reverting/choppy
if r_mean >= 14:
    trend_persistence = 0.5 + (r_mean - 14) / 6 * 0.4      // 0.5 → 0.9
elif r_mean <= 7:
    trend_persistence = 0.1 + (r_mean - 1) / 6 * 0.2       // 0.1 → 0.3
else:
    trend_persistence = 0.3 + (r_mean - 7) / 7 * 0.2       // 0.3 → 0.5

// Reversal probability: chance of a sudden direction flip (fakeout/whipsaw)
// High r_std (disagreement among regime dice) → more fakeouts
reversal_prob = clamp((r_std - 4.0) / 6.0, 0.0, 0.4)

regime_t = {
    trend_persistence: trend_persistence,
    reversal_prob: reversal_prob
}
```

### 11.2 How Regime Is Used

In agent logic (Bands 1–3, Section 6.2, Step 3):

```
// After computing raw_dir, apply regime:
if uniform(0, 1) < regime_t.trend_persistence * regime_weight:
    raw_dir = last_direction       // continue trend

// Fakeout check:
if uniform(0, 1) < regime_t.reversal_prob:
    raw_dir = -raw_dir             // sudden reversal
```

High trend persistence + low reversal probability = smooth trends (mimics institutional accumulation or distribution). Low persistence + high reversal = choppy range-bound action (mimics a tug-of-war). This is what produces the realistic alternation between trending and ranging phases.

---

## 12. The Limit Order Book & Matching Engine

### 12.1 Order Book Structure

```
Order = {
    id: unique_int,
    side: "BUY" | "SELL",
    type: "MARKET" | "LIMIT",
    price: float (null for market orders),
    size: int,
    age: int (ticks since placed),
    source: string ("SCALP" | "SWING" | "POS" | "VALUE" | "MM" | "SHORT" | "SQUEEZE")
}

Book = {
    bids: SortedList of (price DESC, time ASC) → [Order, ...],
    asks: SortedList of (price ASC, time ASC) → [Order, ...]
}
```

### 12.2 Order Insertion

Limit orders are inserted into the appropriate side at their price level. If a limit buy's price >= best ask, or a limit sell's price <= best bid, it crosses and is treated as immediately marketable (execute it in the matching step).

### 12.3 Matching Algorithm (Price-Time Priority)

```
function match(order, book):
    trades = []
    remaining = order.size

    if order.side == "BUY":
        while remaining > 0 and book.asks is not empty:
            best_ask = book.asks[0]
            if order.type == "LIMIT" and order.price < best_ask.price:
                break                  // limit buy can't pay more than its price
            
            fill_qty = min(remaining, best_ask.size)
            fill_price = best_ask.price
            
            trades.append({price: fill_price, size: fill_qty})
            remaining -= fill_qty
            best_ask.size -= fill_qty
            
            if best_ask.size <= 0:
                book.asks.remove(best_ask)

    // Mirror logic for SELL side

    // If limit order has remaining size, rest it in the book:
    if order.type == "LIMIT" and remaining > 0:
        order.size = remaining
        book.insert(order)

    return trades
```

### 12.4 Last Trade Price

```
if len(trades_this_tick) > 0:
    P_t = trades_this_tick[-1].price     // last execution price
    tick_volume = sum(t.size for t in trades_this_tick)
else:
    P_t = P_t_prev                        // unchanged
    tick_volume = 0
```

### 12.5 Order Expiry

At the start of each tick (Phase B, step a):

```
for order in book.all_orders():
    order.age += 1
    if order.age > MAX_ORDER_LIFETIME and order.source != "MM":
        book.remove(order)
// MM orders are refreshed each tick anyway, so they self-expire.
```

---

## 13. Post-Tick State Updates

```
// Append to rolling histories:
price_history.append(P_t)
volume_history.append(tick_volume)

// Trim to last 1000:
if len(price_history) > 1000:
    price_history.pop(0)

// Decrement cooldowns:
if squeeze_cooldown_remaining > 0:
    squeeze_cooldown_remaining -= 1

// Check squeeze termination:
if squeeze_active:
    squeeze_tick_counter += 1
    if squeeze_tick_counter > 40 or SI_t / FLOAT < 0.20:
        squeeze_active = false
        squeeze_tick_counter = 0

// Increment global tick:
tick_count += 1
```

---

## 14. Data Logging & Player-Visible Information

### 14.1 Full Tick Log (stored for replay & analysis)

Every tick, persist:

```
TickLog = {
    tick: int,
    dice: int[100][100],           // full grid snapshot
    P_t: float,
    F_t: float,                     // HIDDEN from player (latent)
    volume: int,
    SI_t: int,
    utilization: float,
    kappa_t: float,
    sentiment_t: float,
    regime_t: object,
    squeeze_active: bool,
    event_active: object | null,
    best_bid: float,
    best_ask: float,
    book_depth_bid_5: int,         // total shares in top 5 bid levels
    book_depth_ask_5: int,
    band_means: float[10],
    band_stds: float[10]
}
```

### 14.2 Player-Visible Data (what they can trade on)

| Data | Visible? | Notes |
|---|---|---|
| Price (P_t) | Yes | Real-time |
| Volume per tick | Yes | Real-time |
| Full dice grid history | Yes | **This is the game's core data** — players analyze dice patterns |
| Band means & stds | Yes | Derivable from dice, but show for convenience |
| Best bid/ask + book depth | Yes | Level 2 data |
| Short interest (SI_t) | Yes | Delayed by 5 ticks (mimics real reporting lag) |
| Utilization | Yes | Delayed by 5 ticks |
| kappa_t | No | Players must infer volatility regime from price action + Band 7 dice |
| sentiment_t (smoothed) | No | Players must infer from Band 9 dice + price behavior |
| F_t | No | **Never shown** — this is the hidden fundamental; skilled players infer it from Band 4 patterns |
| regime_t | No | Players must infer from Band 10 dice + whether trends persist or chop |
| squeeze_active | No | Players observe the price/SI effects and must diagnose it themselves |
| event_active | Partial | Players see Band 8 dice spike but don't see the internal magnitude/duration |

### 14.3 Derived Metrics for Player Dashboard

Compute and display (from visible data):

```
- OHLCV candles at 1-tick, 13-tick ("hourly"), 65-tick ("daily"), 325-tick ("weekly") timeframes
- Simple moving averages (20, 50, 200 period on each timeframe)
- RSI (14-period)
- VWAP (volume-weighted average price, reset each 390-tick "day")
- Bollinger Bands (20-period, 2 std dev)
- Price change % over various windows
- Historical volatility (20-period realized vol)
- Short interest % of float (delayed)
- Bid/ask spread history
- Volume profile (price levels with most volume)
```

---

## 15. Tuning Guidelines & Sanity Checks

### 15.1 Target Behavior Metrics

After running 100,000+ ticks, the simulation should approximately exhibit:

| Metric | Target Range | Diagnostic |
|---|---|---|
| Daily (390-tick) return std dev | 1–4% | If too low, increase Band 1–3 base sizes or raise kappa baseline. If too high, reduce. |
| Autocorrelation of 1-tick returns | -0.05 to +0.15 | Slightly positive = trending micro-structure. If strongly negative, regime_t trend_persistence is too low. |
| Fat tails (kurtosis of tick returns) | > 4.0 | Should naturally emerge from vol clustering + liquidity withdrawal. If not, make Band 6 withdrawal more aggressive. |
| Squeeze frequency | ~1 per 5,000–20,000 ticks | If too frequent, raise SQUEEZE_UTIL_THRESH or SQUEEZE_PRICE_THRESH. If never, lower them. |
| Event shock frequency | ~1 per 500–2,000 ticks | Governed by probability of Band 8 mean exceeding thresholds. With 1000 d20 dice, mean > 17 is astronomically rare for a single tick. **Consider using a rolling 5-tick average of Band 8 mean for event detection to make events possible.** |
| Mean reversion horizon | 200–1000 ticks | Price should wander but F_t should create soft gravity on long scales. |
| Bid-ask spread | 0.1–1.0% of price typically | Governed by Band 6 + kappa. |

### 15.2 Critical Tuning Note on Band 8 (Event Rarity)

With 1,000 dice each uniform [1,20], the band mean has expected value 10.5 and standard deviation ≈ 0.183 (= 5.77 / sqrt(1000)). A mean of 17.0 is ~35 standard deviations above the mean — effectively impossible.

**Solution: Use a different aggregation for Band 8.** Instead of the mean of all 1,000 dice, use:

```
// Pick the MAXIMUM of the 100 column-means in Band 8:
event_signal_high = max(col_mean(8, j) for j in range(100))
event_signal_low  = min(col_mean(8, j) for j in range(100))

// Each column mean has std ≈ 5.77 / sqrt(10) ≈ 1.82
// Max of 100 such values can plausibly reach ~16–17
// Min can plausibly reach ~4–5

if event_signal_high >= EVENT_HIGH_THRESH:     // 17.0
    trigger positive event with magnitude based on how far above threshold
if event_signal_low <= EVENT_LOW_THRESH:       // 4.0
    trigger negative event
```

This makes events rare but possible — roughly once every few hundred to few thousand ticks, matching real market behavior.

### 15.3 Initialization / Seeding the Book

At tick 0, before the main loop:

```
// Seed the order book with MM orders centered on P_INIT:
for level_i in range(BOOK_DEPTH_INIT):
    price_offset = (level_i + 1) * TICK_SIZE * 5
    emit LIMIT_BUY(price = P_INIT - price_offset, size = 200)
    emit LIMIT_SELL(price = P_INIT + price_offset, size = 200)
```

---

## 16. Glossary

| Term | Definition |
|---|---|
| **Tick** | One simulation step. All 10,000 dice are rolled, orders are generated and matched, and price updates. |
| **Band** | A horizontal slice of the 100×100 grid (10 rows × 100 columns = 1,000 dice) assigned to a specific market role. |
| **kappa_t (κ)** | Volatility multiplier derived from Band 7. Scales order sizes, spread widths, and aggression across all bands. |
| **F_t** | Latent fundamental value. A slow-moving anchor that value agents (Band 4) trade toward. Hidden from players. |
| **SI_t** | Short interest. Total shares currently sold short. |
| **Utilization** | SI_t / FLOAT. Fraction of total float that is short. |
| **Squeeze** | Feedback loop where rising price forces short sellers to buy (cover), which pushes price higher, forcing more covering. |
| **sentiment_t** | Smoothed crowd mood from Band 9. Ranges 0 (extreme fear) to 1 (extreme FOMO). |
| **regime_t** | Meta-structure from Band 10. Controls whether the market trends or chops. |
| **Market Order** | An order to buy/sell immediately at the best available price. Causes immediate price impact. |
| **Limit Order** | An order resting in the book at a specific price, waiting to be matched. Provides liquidity. |
| **Air Pocket** | A gap in the order book where no resting orders exist, causing price to jump when a market order hits it. |
| **Flash Crash** | A sudden, sharp price drop caused by liquidity withdrawal (Band 6) combined with aggressive selling. |

---

## Appendix A: Complete Tick Pseudocode

```python
def run_tick(state):
    # 1. Roll dice
    state.dice = random_int_matrix(100, 100, low=1, high=20)
    
    # 2. Compute all band stats
    band_stats = {}
    for b in range(10):
        rows = state.dice[b*10 : (b+1)*10]      # 10×100 subgrid
        band_stats[b] = {
            'mean': mean(rows),
            'std': std(rows),
            'col_means': [mean(rows[:, j]) for j in range(100)]
        }
    
    # 3A. Environment updates
    update_kappa(state, band_stats[7])
    if state.tick_count % 65 == 0:
        update_fundamental(state, band_stats[4])
    if state.tick_count % 13 == 0:
        update_regime(state, band_stats[10 - 1])   # Band 10 = index 9
    update_sentiment(state, band_stats[9 - 1])      # Band 9 = index 8
    evaluate_events(state, band_stats[8 - 1])        # Band 8 = index 7
    
    # 3B. Order generation
    new_orders = []
    expire_stale_orders(state.order_book)
    
    new_orders += generate_mm_orders(state, band_stats[6 - 1])
    new_orders += generate_scalper_orders(state, band_stats[1 - 1])
    
    if state.tick_count % 13 == 0:
        new_orders += generate_swing_orders(state, band_stats[2 - 1])
    if state.tick_count % 65 == 0:
        new_orders += generate_position_orders(state, band_stats[3 - 1])
        new_orders += generate_value_orders(state, band_stats[4 - 1])
    
    new_orders += generate_short_orders(state, band_stats[5 - 1])
    evaluate_squeeze(state)
    if state.squeeze_active:
        new_orders += generate_squeeze_covers(state)
    
    # 3C. Matching
    market_orders = [o for o in new_orders if o.type == "MARKET"]
    limit_orders = [o for o in new_orders if o.type == "LIMIT"]
    
    shuffle(market_orders)
    trades = []
    for order in market_orders:
        trades += match(order, state.order_book)
    for order in limit_orders:
        trades += match(order, state.order_book)  # may cross immediately
    
    # 3D. Post-tick
    if trades:
        state.P_t = trades[-1].price
        state.tick_volume = sum(t.size for t in trades)
    else:
        state.tick_volume = 0
    
    state.price_history.append(state.P_t)
    state.volume_history.append(state.tick_volume)
    trim_histories(state, max_len=1000)
    update_cooldowns(state)
    state.tick_count += 1
    log_tick(state, trades)
```

---

## Appendix B: Band Index Quick Reference

```
Band 1  → dice rows [0:10]   → index 0  → Scalpers
Band 2  → dice rows [10:20]  → index 1  → Swing
Band 3  → dice rows [20:30]  → index 2  → Position
Band 4  → dice rows [30:40]  → index 3  → Value
Band 5  → dice rows [40:50]  → index 4  → Shorts
Band 6  → dice rows [50:60]  → index 5  → Market Makers
Band 7  → dice rows [60:70]  → index 6  → Volatility
Band 8  → dice rows [70:80]  → index 7  → Events
Band 9  → dice rows [80:90]  → index 8  → Sentiment
Band 10 → dice rows [90:100] → index 9  → Regime
```

---

*End of specification. All equations and thresholds are final. Implement as written, then tune constants in Section 1.1 based on the sanity checks in Section 15.1.*
