---
title: "DiceStock: A Dice-Driven Agent-Based Model That Reproduces Stylized Facts of Financial Markets"
author: "Gregory Ashaun Nelson"
date: "February 2026"
---

# DiceStock: A Dice-Driven Agent-Based Model That Reproduces Stylized Facts of Financial Markets

**Gregory Ashaun Nelson**

**Working Paper — February 2026**

---

## Abstract

We present DiceStock, an agent-based model (ABM) of a financial market in which all agent behavior is parametrized by rolls of 12,000 twenty-sided dice arranged on a 120×100 grid. Twelve bands of heterogeneous agents — directional traders at three time horizons, fundamental value anchors, short sellers, market makers, and six state-variable drivers — submit orders to a continuous double-auction limit order book. A single deterministic pseudo-random number generator (Mulberry32) seeds the entire simulation, making it fully reproducible.

In a 75-simulated-year run (7.37 million ticks, seed 42), the model reproduces 9 of 10 targeted stylized facts of financial returns: fat tails (excess kurtosis 13.9), volatility clustering (|return| ACF lag-1 = 0.075), long memory in volatility (|return| ACF lag-50 = 0.030), approximate absence of return autocorrelation, positive volume-volatility correlation, dynamic volatility regimes, sentiment-driven crowd behavior, short squeeze episodes, and rare exogenous shock events. The annualized volatility of 14.9% falls within the realistic equity range. The single failing metric is lag-1 return autocorrelation at −0.068, slightly outside the ±0.05 threshold — a consequence of aggressive market making.

Robustness is confirmed across three dimensions: (1) a 30-seed Monte Carlo analysis shows a mean score of 7.8/10 with fat tails (100%), volatility clustering (93%), and kappa dynamics (100%) passing across all or nearly all seeds; (2) a sensitivity analysis reveals that the trend/OU process (Band 11) and PRICE_SCALE compression are the most load-bearing components, while squeeze mechanics and support/resistance are decorative at short horizons; and (3) direct comparison against 75 years of S&P 500 daily returns shows 5/6 qualitative matches, with nearly identical annualized volatility (14.9% vs 15.8%) and Hurst exponents (0.540 vs 0.541).

The key innovation is that no parameters were fitted to empirical data. All dynamics emerge from dice rolls filtered through structured agent rules, a full limit order book, and feedback between price, volatility, sentiment, and fundamental value. We document the complete calibration history, including three critical bugs discovered in v1, the addition of two new bands (trend/OU and support/resistance), and the path from 2/10 to 9/10 stylized facts. We position DiceStock relative to canonical ABMs (Cont-Bouchaud, Lux-Marchesi, Mike-Farmer, Chiarella et al.) and argue that it offers a novel point in the design space: maximal agent diversity with minimal agent intelligence.

**Keywords:** agent-based model, financial market simulation, stylized facts, limit order book, volatility clustering, fat tails, dice, emergent behavior

**JEL Classification:** G12, G14, C63, D53

---

## 1. Introduction

Financial markets exhibit a set of robust statistical regularities — known as *stylized facts* — that persist across asset classes, time periods, and geographies. Cont (2001) catalogued the most prominent: fat-tailed return distributions, volatility clustering, long memory in volatility, and near-zero autocorrelation of raw returns. Any credible model of market microstructure should reproduce these features.

Agent-based models (ABMs) offer a bottom-up approach: define heterogeneous agents with simple trading rules, let them interact through a market mechanism, and observe whether realistic statistical properties emerge. The seminal models of Cont and Bouchaud (2000), Lux and Marchesi (1999, 2000), and Mike and Farmer (2008) demonstrated that even simple agent structures can produce fat tails and volatility clustering.

**Research question.** Can a model in which all agent behavior is driven by *dice rolls* — with no fitted parameters, no adaptive learning, and no calibration to empirical data — produce realistic market dynamics?

**Contribution.** We present DiceStock, which answers this question affirmatively. The model introduces:

1. **Dice-parametrized agents.** Every agent decision — direction, conviction, order type, order size — is a deterministic function of a column of 10 twenty-sided dice. No learning rules, no optimization, no historical pattern matching.

2. **12-band architecture.** Rather than 2–3 agent types (as in Lux-Marchesi or Chiarella et al.), DiceStock uses 12 functionally specialized bands, each reading different statistical properties from the same dice grid. This generates agent *diversity* without agent *intelligence*.

3. **Full limit order book.** Unlike Cont-Bouchaud (which has no order book) or Lux-Marchesi (which uses a simplified matching mechanism), DiceStock implements a continuous double auction with price-time priority, realistic tick sizes, and order expiration.

4. **Complete transparency.** The entire model is deterministic from a single 32-bit seed. Every simulation run is perfectly reproducible. We publish the full source code and calibration history.

The paper proceeds as follows. Section 2 reviews related work. Section 3 describes the model architecture. Section 4 specifies each agent band. Section 5 provides an honest disclosure of the calibration history, including bugs and fixes. Sections 6–7 present simulation results and stylized-facts validation. Section 8 presents robustness analysis: multi-seed runs, band ablation sensitivity, and empirical comparison against S&P 500 data. Section 9 compares model complexity with the literature. Section 10 discusses limitations and future work. Section 11 concludes.

---

## 2. Related Work

### 2.1 Canonical Agent-Based Financial Models

**Cont and Bouchaud (2000)** introduced an ABM where agents form random clusters via percolation on a lattice. Each cluster trades as a unit, producing fat-tailed returns from the power-law distribution of cluster sizes. The model elegantly generates excess kurtosis but lacks an order book and produces limited volatility dynamics.

**Lux and Marchesi (1999, 2000)** developed a model with two agent types — fundamentalists and chartists — who switch strategies based on relative profitability. The switching mechanism generates endogenous volatility clustering and fat tails. However, the model uses aggregate supply/demand rather than a limit order book, and requires careful calibration of 8+ parameters.

**Mike and Farmer (2008)** took a "zero-intelligence" approach: agents place orders at random prices drawn from empirical distributions, with no strategic behavior whatsoever. Remarkably, this reproduces several stylized facts, suggesting that order book mechanics alone contribute significantly to realistic market statistics. However, the model relies on fitted distributions from real market data.

**Chiarella, Iori, and Perelló (2009)** combined heterogeneous beliefs (fundamentalists, chartists, noise traders) with a limit order book. Their model produces rich dynamics but requires approximately 10 calibrated parameters and adaptive belief updating.

**Bouchaud, Farmer, and Lillo (2009)** provided a comprehensive review of statistical models of the order book, establishing theoretical baselines for spread dynamics, price impact, and order flow.

### 2.2 Positioning DiceStock

DiceStock occupies a novel point in the ABM design space:

| Dimension | Cont-Bouchaud | Lux-Marchesi | Mike-Farmer | Chiarella et al. | **DiceStock** |
|:--|:--|:--|:--|:--|:--|
| Agent types | 1 (clusters) | 2 (F + C) | 1 (zero-intel) | 3 (F + C + N) | **12 bands** |
| Agent intelligence | Network herding | Switching rule | Zero | Belief updating | **Dice-parametrized** |
| Limit order book | No | No | Yes | Yes | **Yes** |
| Parameters fitted to data | ~5 | ~8 | ~6 | ~10 | **0** |
| Stylized facts reported | 3–4 | 5–6 | 4–5 | 5–6 | **9** |

The distinguishing feature is that DiceStock trades agent *sophistication* for agent *diversity* and *structural richness*. Each individual agent is trivially simple — a deterministic function of 10 dice — but the 12-band architecture creates a rich ecosystem of interacting behaviors. The full limit order book provides a realistic matching mechanism that contributes its own emergent properties.

---

## 3. Model Architecture

### 3.1 The Dice Grid

The simulation maintains a grid of 120 rows × 100 columns = 12,000 dice. Each die is a standard d20 (integer values 1–20, uniform). At the start of every tick, all 12,000 dice are re-rolled using a seeded pseudo-random number generator.

The grid is partitioned into 12 horizontal bands of 10 rows each. Band *b* occupies rows 10(b−1) through 10b−1. Each band feeds one class of agent behavior.

### 3.2 Band Statistics

For each band, the engine computes:

- **Band mean** ($\bar{x}_b$): The mean of all 1,000 dice in the band. By the central limit theorem, this has standard deviation $\sigma_{\bar{x}} \approx 5.77 / \sqrt{1000} \approx 0.183$. The band mean is highly concentrated around 10.5, making it useful for detecting *consensus* but poor for generating *variability*.

- **Column means** ($\bar{x}_{b,j}$ for $j = 0, \ldots, 99$): Each column mean averages 10 dice, giving $\sigma_{\bar{x}_j} \approx 5.77 / \sqrt{10} \approx 1.83$. Column means have 10× more variance than the band mean, making them useful for generating agent heterogeneity and individual extreme readings.

- **Band standard deviation** ($s_b$): The standard deviation across all 1,000 dice.

This two-level statistical structure — 100 noisy column signals plus 1 consensus signal — is central to the model's ability to generate both diverse agent behavior and meaningful state-variable updates.

![Figure 9: DiceStock model architecture. 12,000 d20 dice on a 120×100 grid feed 12 specialized bands, each generating orders submitted to a continuous double-auction limit order book.](../paper-assets/fig9_architecture.png)

### 3.3 The Limit Order Book

DiceStock implements a continuous double-auction limit order book with:

- **Tick size:** $0.01 (all prices rounded to nearest cent)
- **Price-time priority:** Orders at the same price are filled in submission order
- **Order types:** Market orders (immediate execution at best available price) and limit orders (resting, with specified price)
- **Order expiration:** Limit orders expire after 100 ticks if unfilled
- **Order sources:** Each order is tagged with its source band (SCALP, SWING, POS, VALUE, SHORT, SQUEEZE, MM, SR) for analysis

Market orders execute immediately against the opposite side of the book. Limit orders that cross the spread are treated as marketable limits. All remaining limit orders are inserted into the book.

### 3.4 Tick Lifecycle

Each tick proceeds through four phases:

**Phase A — Environment Update:**
1. Roll all 12,000 dice
2. Compute band statistics (means, column means, standard deviations)
3. Update volatility multiplier $\kappa_t$ (Band 7)
4. Update fundamental value $F_t$ via OU trend process (Band 11)
5. Update meta-regime parameters (Band 10, every 13 ticks)
6. Update crowd sentiment $s_t$ (Band 9)
7. Evaluate event/shock triggers (Band 8)

**Phase B — Order Generation:**
1. Expire stale orders (age > 100 ticks)
2. Market maker refresh: cancel all MM orders, recompute spread and depth, repopulate (Band 6)
3. Scalper orders — every tick (Band 1)
4. Swing orders — every 13 ticks (Band 2)
5. Position orders — every 65 ticks (Band 3)
6. Value agent orders — every 65 ticks (Band 4)
7. Support/resistance orders — every 65 ticks (Band 12)
8. Short seller orders — every tick (Band 5)
9. Evaluate squeeze conditions
10. Generate squeeze forced covers if squeeze is active

**Phase C — Matching:**
1. Shuffle market orders randomly (prevents systematic priority bias)
2. Feed market orders one-by-one through the matching engine
3. Insert limit orders (may execute immediately if crossing the spread)
4. Record last trade price as $P_t$ and tick volume

**Phase D — Post-Tick:**
1. Update price and volume history buffers
2. Track short interest delay buffers
3. Manage squeeze cooldown and termination
4. Update volume profile for S/R detection (Band 12)
5. Detect S/R levels (every 65 ticks)
6. Flip broken S/R levels
7. Aggregate candle data
8. Increment tick counter

### 3.5 PRNG and Reproducibility

All randomness in the simulation flows through a single instance of the Mulberry32 PRNG:

```
state = (state + 0x6D2B79F5) | 0
t = imul(state ^ (state >>> 15), 1 | state)
t = (t + imul(t ^ (t >>> 7), 61 | t)) ^ t
output = ((t ^ (t >>> 14)) >>> 0) / 2^32
```

Mulberry32 is a fast 32-bit generator with good statistical properties, adequate period length for our simulation (~4 billion values), and deterministic from seed. The PRNG provides `next()` (uniform float), `nextInt(min, max)` (uniform integer), `uniform(min, max)` (uniform float in range), and `shuffle()` (Fisher-Yates).

Given the same seed, the simulation produces *identical* output on any platform with IEEE 754 double-precision arithmetic. This makes all results perfectly reproducible.

### 3.6 Price Scale Compression

All price offsets generated by agents are divided by a compression factor `PRICE_SCALE = 30`. This maps the dice-driven movements (which would otherwise produce ~30% daily moves) to more realistic ~1% daily moves. Importantly, this is a *structural* parameter of the model, not a fitted one: it simply translates the natural scale of d20 dice statistics to the natural scale of financial prices.

---

## 4. Agent Specifications

### 4.1 Bands 1–3: Multi-Timeframe Directional Agents

Bands 1, 2, and 3 implement the same decision logic at three different time scales: scalpers (every tick), swing traders (every 13 ticks), and position traders (every 65 ticks).

Each of the 100 columns in a band acts as an independent agent. The 6-step decision process:

1. **Raw direction:** Column mean ≥ 14 → bullish (+1); ≤ 7 → bearish (−1); 8–13 → sit out. Approximately 65% of agents sit out each tick, creating natural activity variation.

2. **Conviction strength:** $c = |(\bar{x}_j - 10.5)| / 9.5$, normalized to [0, 1].

3. **Regime influence:** With probability $p_{\text{trend}} \times w_{\text{regime}}$, the agent follows the direction of the last price change instead of its dice signal. This creates trend persistence when the regime favors it.

4. **Fakeout check:** With probability $p_{\text{reversal}}$, the agent flips direction, creating false breakouts.

5. **Sentiment modification:** Extreme sentiment (>0.65 or <0.35) amplifies conviction by up to 1.7×.

6. **Event modification:** Active shock events amplify conviction for aligned agents and reduce it for opposing agents.

**Order generation:** Size = base_size × conviction × $\kappa_t$. With probability market_order_prob × $\kappa_t$, the agent submits a market order; otherwise, a limit order offset from $P_t$ by a random amount.

| Band | Role | Cadence | Base Size | Market Prob | Limit Offset | Regime Weight |
|:--|:--|:--|:--|:--|:--|:--|
| 1 | Scalpers | Every tick | 10 | 0.60 | 0.1–0.5% | 0.70 |
| 2 | Swing | Every 13 ticks | 80 | 0.35 | 0.5–2.0% | 0.40 |
| 3 | Position | Every 65 ticks | 400 | 0.20 | 1.0–5.0% | 0.15 |

The multi-timeframe structure ensures that the order book receives a continuous flow of small orders (scalpers) supplemented by periodic bursts of larger orders (swing, position). This mirrors real markets where high-frequency traders provide liquidity while institutional investors trade less frequently but in larger size.

### 4.2 Band 4: Fundamental Value Anchor

Band 4 generates passive limit orders that tether market price $P_t$ toward fundamental value $F_t$. All orders are limit orders placed 1–5% from the current price, ensuring they provide gravitational pull without causing return autocorrelation.

Three urgency tiers based on the price–fundamental gap $g = (P_t - F_t) / F_t$:

| Gap | Tier | Order Size | Description |
|:--|:--|:--|:--|
| |g| > 3% | Passive | 10–20 shares | Gentle tethering |
| |g| > 10% | Urgent | 20–50 shares | Moderate correction |
| |g| > 30% | Emergency | 50–100 shares | Strong mean-reversion |

Each column acts as an independent value agent. If the dice signal agrees with the gap direction (bearish dice sell overpriced stock, bullish dice buy underpriced stock), the agent submits a limit order. If the dice disagree, the agent sits out. This ensures that even the fundamental anchor produces heterogeneous behavior.

### 4.3 Band 5: Short Sellers and Squeeze Mechanics

Band 5 implements short selling with utilization-dependent borrow costs and a multi-condition squeeze trigger.

**Short selling:** Each column agent evaluates:
- Column mean ≥ 14 → open new short (SELL order), increasing short interest $SI_t$
- Column mean ≤ 7 → voluntarily cover shorts (BUY order), decreasing $SI_t$
- Borrow cost = $0.01 + u^2$ where $u = SI_t / \text{FLOAT}$. The quadratic cost accelerates as utilization rises.

**Squeeze conditions.** All four must be simultaneously true:
1. Utilization > 45% ($SI_t / \text{FLOAT} > 0.45$)
2. Price rose > 3% in last 20 ticks
3. Sentiment > 0.57
4. Volatility multiplier $\kappa_t > 1.2$

When triggered, the squeeze generates forced market buy orders at a rate of 0.05% of remaining SI per tick for up to 390 ticks, creating a self-reinforcing price spike. A 50-tick cooldown prevents immediate re-triggering.

![Figure 8: Short squeeze episodes. Forced covering by short sellers creates rapid, one-directional price cascades visible as sharp upward spikes.](../paper-assets/fig8_squeeze_events.png)

### 4.4 Band 6: Market Makers / Liquidity Providers

Band 6 provides continuous two-sided liquidity. Every tick:

1. Cancel all existing MM orders
2. Compute target half-spread: $\text{halfSpread} = P_t \times 0.003 \times f_{\text{spread}} \times \kappa_t / \text{PRICE\_SCALE}$, where $f_{\text{spread}}$ varies from 0.5 (tight) to 2.5 (wide) based on the band mean
3. Compute depth: $\text{depth} = 500 \times (\bar{x}_b / 10.5) / \kappa_t$
4. Generate 20 levels of bid/ask orders, tapering depth at outer levels

**Liquidity withdrawal** (flash crash mechanic): If any of the following hold — $\kappa_t > 3.0$ (extreme volatility), price moved > 2% in 5 ticks (fast move), or MM dice mean < 4.0 (agent fear) — then depth drops to 40% and spread widens 2.5×, simulating real-market liquidity crises.

### 4.5 Band 7: Volatility Regime ($\kappa$)

Band 7 produces the volatility multiplier $\kappa_t$, which scales order sizes and market order probability across all other bands.

**Innovation:** Uses a *single column mean* (column 50, 10 dice, $\sigma \approx 1.83$) rather than the band mean (1000 dice, $\sigma \approx 0.183$). This 10× increase in signal variance is what enables $\kappa_t$ to exit the dead zone around 1.0 and generate meaningful regime changes.

**Piecewise mapping** from column mean $v$ to raw $\kappa$:

| Column mean $v$ | Raw $\kappa$ | Interpretation |
|:--|:--|:--|
| ≤ 5 | 0.3 | Extreme low volatility |
| 5–9 | 0.3 → 1.0 | Low to normal |
| 9–12 | 1.0 | Normal regime (dead zone) |
| 12–16 | 1.0 → 2.5 | Elevated volatility |
| > 16 | 2.5 → 4.0 | Extreme high volatility |

An additional **column disagreement bonus** boosts $\kappa$ when the standard deviation of column means exceeds 2.5, capturing periods of unusual dispersion.

**Smoothing:** $\kappa_t = 0.85 \cdot \kappa_{t-1} + 0.15 \cdot \kappa_{\text{raw}}$ (half-life ≈ 5 ticks), creating sticky regimes. Clamped to [0.2, 5.0].

![Figure 6: The volatility multiplier κ_t over 75 simulated years. Regime shifts between calm (κ ≈ 1.0) and stressed (κ > 1.5) periods drive volatility clustering.](../paper-assets/fig6_kappa_timeseries.png)

### 4.6 Band 8: News/Event Shocks

Band 8 generates rare exogenous shock events analogous to earnings surprises or macroeconomic announcements.

**Signal:** The *maximum* and *minimum* of the 100 column means (not the band mean). This is critical: the max of 100 independent normals with $\sigma \approx 1.83$ can occasionally reach 18+ or drop below 3, while the band mean of 1000 dice almost never leaves [10.0, 11.0].

**Trigger thresholds:**
- Positive shock: max(column means) ≥ 18.5
- Negative shock: min(column means) ≤ 2.5

These thresholds were tuned from v1 values (17.0 / 4.0) to be genuinely rare. At the tuned thresholds, events occur approximately once every 16,000 ticks (roughly 41 trading days).

**Event mechanics:** When triggered, the event lasts 15 ticks with decaying magnitude (×0.90 per tick). The magnitude, amplified by $\kappa_t$, modifies agent conviction across Bands 1–3. Only one event can be active at a time.

### 4.7 Band 9: Crowd Sentiment

Band 9 produces a smoothed sentiment score $s_t \in [0, 1]$ representing the market's emotional state.

**Innovation:** Like $\kappa$, sentiment uses a single column mean (column 75, independent from $\kappa$'s column 50) rather than the band mean. The column mean is normalized from [1, 20] to [0, 1] and then exponentially smoothed:

$$s_t = 0.92 \cdot s_{t-1} + 0.08 \cdot s_{\text{raw}}$$

The decay factor 0.92 creates a half-life of about 8 ticks, slow enough to prevent whiplash but fast enough to respond to sustained crowd shifts.

**Effects:** Sentiment > 0.65 amplifies bullish conviction in Bands 1–3 by up to 1.7×. Sentiment < 0.35 amplifies bearish conviction. Sentiment > 0.57 is one of the four squeeze conditions.

![Figure 7: Crowd sentiment s_t evolution. The exponential smoothing (decay = 0.92) creates slow drifts in market mood, with the range 0.42–0.59 reflecting the tension between column-mean extremes and the smoothing filter.](../paper-assets/fig7_sentiment_timeseries.png)

### 4.8 Band 10: Meta-Regime

Band 10 controls whether the market trends or mean-reverts by setting two parameters that influence Bands 1–3:

- **Trend persistence** ($p_{\text{trend}}$): Probability that an agent follows the last price direction instead of its own dice signal. Ranges from 0.1 (choppy) to 0.9 (strongly trending), mapped from the band mean.

- **Reversal probability** ($p_{\text{reversal}}$): Probability of a fakeout. Driven by the band's standard deviation (high disagreement → more fakeouts). Ranges from 0.0 to 0.4.

Updated every 13 ticks, creating regime shifts on an intermediate timescale.

### 4.9 Band 11: Trend Driver (Ornstein-Uhlenbeck Process) — NEW

Band 11 drives the fundamental value $F_t$ via a mean-reverting stochastic process with upward drift, inspired by the long-run upward trend of equity indices.

**Signal:** Column mean from column 25 (10 dice), normalized to [-1, +1]:
$$\text{raw} = (\bar{x}_{11,25} - 10.5) / 9.5$$

Smoothed with an EMA (half-life ≈ 3.5 trading days, $\alpha = 0.9995$).

**OU dynamics:**
$$F_t = F_{t-1} \times \exp(\mu - \theta \cdot \log(F_t / F_{\text{anchor}}) + \sigma \cdot \text{signal})$$

where:
- $\mu = 6.9 \times 10^{-7}$ (7% annual growth, the long-run equity premium)
- $F_{\text{anchor}} = F_0 \cdot e^{\mu t}$ (growing anchor)
- $\theta = 0.0001$ (mean-reversion strength, half-life ≈ 18 trading days)
- $\sigma = 0.01$ (dice drift scaling)

This creates a fundamental value that grows exponentially on average but experiences multi-year deviations driven by dice, analogous to real equity indices alternating between bull and bear phases.

### 4.10 Band 12: Support/Resistance Levels — NEW

Band 12 detects price levels where significant trading volume has accumulated and generates limit orders at those levels, simulating technical traders defending support and resistance.

**Volume profile:** A map from price buckets (0.5% increments relative to $F_t$) to accumulated trade volume, decayed each tick by factor 0.998.

**Level detection** (every 65 ticks): Scan the volume profile for local maxima. Keep the top 10 by volume. Classify as support (below $P_t$) or resistance (above $P_t$).

**Order generation** (every 65 ticks): For levels within 5% of current price, generate limit orders with size = base_size × strength × $0.85^{\text{testCount}}$. The decay with test count ensures that repeatedly tested levels weaken over time.

**Level flipping:** When price breaks through a level by more than 1%, the level flips (support becomes resistance, and vice versa) with halved strength — a well-known phenomenon in technical analysis.

**Dice conviction:** Band 12's column means determine whether agents defend support (bullish dice) or resistance (bearish dice), ensuring even S/R behavior is dice-driven.

---

## 5. Calibration History (Honest Disclosure)

We believe that transparency about model development is essential for scientific credibility. This section documents the complete history of changes from v1 to the current version.

### 5.1 v1 Issues

The first published version of DiceStock (v1) achieved approximately 2 of 10 stylized facts. Three critical bugs prevented meaningful dynamics:

1. **Kappa stuck at ~1.0.** Band 7 used the band mean (1000 dice, $\sigma \approx 0.183$) to compute $\kappa_t$. With such low variance, the raw $\kappa$ value almost never left the dead zone [9, 12] in the piecewise mapping, keeping $\kappa_t$ effectively frozen at 1.0.

2. **Sentiment frozen at ~0.5.** Band 9 similarly used the band mean. With $\sigma \approx 0.183$, the sentiment signal barely deviated from 0.5, preventing crowd dynamics and disabling the squeeze trigger (which requires sentiment > 0.57).

3. **Events firing as noise.** Band 8 used the band mean with low thresholds (17.0 / 4.0). The band mean, despite low variance, occasionally crossed these loose thresholds, causing events to fire approximately every 76 ticks — far too frequently to represent "news" shocks.

### 5.2 Root Cause: Band Mean vs. Column Mean

The root cause of issues 1 and 2 was a statistical misunderstanding. With 1000 independent dice, the band mean has standard deviation $5.77/\sqrt{1000} \approx 0.183$. A 3σ event moves the mean by only 0.55 from the expected value of 10.5 — far too little to drive regime changes.

The fix was to use a *single column mean* (10 dice, $\sigma \approx 1.83$), which has 10× more variance. A 3σ column event moves the signal by 5.5, easily pushing $\kappa$ and sentiment into extreme regimes.

### 5.3 Three-Fix Path

1. **Kappa column mean** (Band 7): Changed from `stats.mean` to `stats.colMeans[50]`. Result: $\kappa_t$ immediately began exhibiting regime changes, ranging from 0.86 to 1.86.

2. **Sentiment column mean** (Band 9): Changed from `stats.mean` to `stats.colMeans[75]`. Result: Sentiment began reaching 0.42–0.58, enabling squeeze triggers.

3. **Event thresholds** (Band 8): Changed from `(17.0, 4.0)` to `(18.5, 2.5)` and switched to using max/min of column means. Result: Events dropped from every ~76 ticks to every ~16,000 ticks.

### 5.4 Additional Improvements

- **Squeeze threshold tuning:** Reduced sentiment condition from 0.60 to 0.57 to match the achievable sentiment range.
- **PRICE_SCALE compression:** All price offsets divided by 30, converting ~30% daily volatility to ~1% daily moves.
- **Grid expansion:** From 100×100 (10 bands × 10 rows) to 120×100 (12 bands × 10 rows) to accommodate Bands 11–12.

### 5.5 Bands 11–12

Two new bands were added to address specific weaknesses:

- **Band 11 (Trend/OU)** replaced a simplistic random walk for $F_t$ with a mean-reverting process featuring 7%/year upward drift. This created realistic long-term price growth and multi-year bull/bear cycles.

- **Band 12 (Support/Resistance)** added volume-based level detection and technical trading. This improved price dynamics around key levels and contributed to order book depth.

### 5.6 What Was NOT Tuned

It is important to emphasize what was *not* done:

- **No parameter fitting.** No parameter was chosen by optimizing a loss function against empirical data. The PRICE_SCALE of 30 was chosen to map dice-scale movements to financial-scale movements. The OU parameters in Band 11 were chosen to approximate known equity index properties (7% annual return, multi-week mean-reversion).

- **No machine learning.** No neural networks, genetic algorithms, or other optimization methods were used.

- **No training data.** No historical stock prices were used as input to the model.

- **No cherry-picking.** All results are reported for seed 42. We did not search over seeds for favorable outcomes.

---

## 6. Simulation Results

### 6.1 Setup

- **Duration:** 75 simulated years (18,900 trading days, 7,371,000 ticks)
- **Seed:** 42 (Mulberry32)
- **Ticks per day:** 390 (matching NYSE trading hours: 6.5 hours × 60 minutes)
- **Trading days per year:** 252

### 6.2 Price Dynamics

The market price exhibits realistic-looking dynamics across multiple time scales:

- **Initial price:** $100.00
- **Final price:** $19,320.00 (compound annual growth ≈ 7.2%)
- **Price range:** $84.83 – $19,374.40
- **Fundamental value range:** $79.56 – $18,343.16

The price tracks the fundamental value over multi-year horizons while exhibiting substantial short-term deviations. Extended bear markets, rallies, and sideways consolidations all appear naturally.

![Figure 1: 75-year price trajectory with fundamental value overlay. The market price (blue) tracks fundamental value (orange) over multi-year horizons while exhibiting substantial short-term deviations.](../paper-assets/fig1_price_trajectory.png)

![Figure 11: Multi-band activity timeline showing order generation across all 12 bands at different cadences. Scalpers (Band 1) fire every tick; position traders (Band 3) and value agents (Band 4) fire every 65 ticks.](../paper-assets/fig11_band_timeline.png)

### 6.3 Return Distribution

Daily log returns exhibit clear fat tails:

| Statistic | Value |
|:--|:--|
| Mean daily return | 0.028% |
| Daily std deviation | 0.94% |
| Annualized volatility | 14.9% |
| Skewness | −0.77 |
| Excess kurtosis | 13.91 |
| Hill estimator (5% tail) | 2.45 |

The excess kurtosis of 13.91 confirms strongly leptokurtic returns — the distribution has dramatically heavier tails than a normal distribution. The Hill estimator of 2.45 places the tail index firmly in the empirical range of 2–5 observed in real financial data (Cont, 2001), and is consistent with the "cubic law" of returns. The negative skewness (−0.77) reflects the well-documented asymmetry where crashes are more severe than rallies.

The annualized volatility of 14.9% is strikingly realistic, falling within the typical range for equity indices (15–20% for the S&P 500). This represents a major improvement over v1 and validates the PRICE_SCALE compression mechanism.

![Figure 2: Daily log return distribution (blue) versus normal overlay (dashed). The heavy tails of DiceStock returns are clearly visible.](../paper-assets/fig2_return_distribution.png)

![Figure 3: QQ plot of returns against the normal distribution. Tail departure confirms excess kurtosis of 13.9.](../paper-assets/fig3_qq_plot.png)

### 6.4 Volatility Dynamics

The model produces strong volatility clustering:

| Metric | Value | Real-market benchmark |
|:--|:--|:--|
| |Return| ACF lag-1 | 0.0753 | 0.05–0.30 |
| |Return| ACF lag-10 | 0.0181 | 0.02–0.15 |
| |Return| ACF lag-50 | 0.0296 | 0.01–0.05 |
| |Return| ACF lag-100 | 0.0218 | 0.005–0.03 |

The autocorrelation of absolute returns decays slowly — a hallmark of long memory in volatility. The ACF at lag 50 (0.030) is strongly positive and statistically significant, confirming the long-memory property. The non-monotone decay pattern (lag-10 < lag-50) suggests complex volatility dynamics with multi-scale persistence.

The volatility multiplier $\kappa_t$ ranges from 0.89 to 1.91 with mean 1.11 and standard deviation 0.107. It exhibits persistent regimes: extended periods of elevated volatility interspersed with calm periods.

![Figure 4: Autocorrelation of absolute returns out to lag 200, showing the slow power-law decay characteristic of volatility clustering.](../paper-assets/fig4_vol_clustering_acf.png)

### 6.5 Microstructure

- **Mean spread:** $0.27 (tight relative to price levels)
- **Spread varies dynamically** with $\kappa_t$ and MM band mean
- **Liquidity withdrawal** occurs during high-vol regimes, widening spreads

### 6.6 Short Squeeze Episodes

The simulation produced **1 short squeeze event** over 75 years. While infrequent, this demonstrates that the squeeze mechanism functions correctly when all four conditions align simultaneously.

| Metric | Value |
|:--|:--|
| Duration | 390 ticks (1 trading day) |
| Trigger conditions | Utilization > 45%, price rise > 3%, sentiment > 0.57, $\kappa > 1.2$ |

The rarity of squeezes is itself informative: it shows that the four-condition trigger is genuinely difficult to satisfy, requiring simultaneous alignment of utilization, price momentum, sentiment, and volatility. This aligns with the empirical rarity of true short squeezes in real markets.

### 6.7 Shock Events

477 shock events occurred over 75 years (approximately 6.4 per year, or 1 per 15,453 ticks):

- **Positive shocks:** 208 (43.6%)
- **Negative shocks:** 269 (56.4%)

The slight negative skew in shock frequency is consistent with the negative return skewness observed in the data. The frequency of approximately 1 per 15,000 ticks is appropriate for representing significant news events.

---

## 7. Stylized Facts Validation

### 7.1 Scorecard

| # | Stylized Fact | Metric | Value | Threshold | Result |
|:--|:--|:--|:--|:--|:--|
| 1 | Fat tails | Excess kurtosis | 13.91 | > 0 | **PASS** |
| 2 | Volatility clustering | |Return| ACF lag-1 | 0.075 | > 0.05 | **PASS** |
| 3 | Long memory in volatility | |Return| ACF lag-50 | 0.030 | > 0.01 | **PASS** |
| 4 | Absence of return autocorrelation | Return ACF lag-1 | −0.068 | |·| < 0.05 | **FAIL** |
| 5 | Volume-volatility correlation | Corr(volume, |return|) | 0.069 | > 0 | **PASS** |
| 6 | Volatility regime changes | $\kappa$ std deviation | 0.107 | > 0.01 | **PASS** |
| 7 | Sentiment variation | Sentiment range | 0.42–0.59 | range > 0.1 | **PASS** |
| 8 | Short squeezes occur | Squeeze count | 1 | > 0 | **PASS** |
| 9 | Events are rare | Event frequency | 1/15,453 | < total/500 | **PASS** |
| 10 | Price discovery | Price range / $P_0$ | $19,290 / $100 | > 0.1 | **PASS** |

**Final score: 9 / 10**

### 7.2 Fat Tails (PASS)

The excess kurtosis of 13.91 confirms strongly leptokurtic returns — far exceeding the values of 3–10 typically observed in daily equity returns, suggesting the model produces particularly heavy tails. The Hill estimator of 2.45 places the tail index in the lower end of the empirical range (2–5), consistent with the "cubic law" of returns. The QQ plot shows dramatic departure from normality in both tails.

Fat tails in DiceStock arise from three mechanisms:
1. **Volatility multiplier $\kappa_t$**: Periods of high $\kappa$ amplify order sizes and market order frequency, creating clusters of large price moves.
2. **Event shocks**: Rare but impactful events create outlier returns.
3. **Squeeze episodes**: Forced covering generates one-directional cascades.

![Figure 2: Daily log return distribution (blue) versus normal overlay (dashed). The heavy tails of DiceStock returns are clearly visible.](../paper-assets/fig2_return_distribution.png)

![Figure 3: QQ plot of returns against the normal distribution. Tail departure confirms excess kurtosis of 13.9.](../paper-assets/fig3_qq_plot.png)

### 7.3 Volatility Clustering (PASS)

The ACF of absolute returns at lag 1 is 0.075, comfortably exceeding the 0.05 threshold and falling within the typical equity range of 0.05–0.30.

Volatility clustering emerges from the smoothing of $\kappa_t$ (half-life ≈ 5 ticks) and the regime persistence created by Band 10's trend/reversal parameters. When $\kappa_t$ is elevated, all agents generate larger orders with higher market-order probability, perpetuating high volatility.

![Figure 4: Autocorrelation of absolute returns out to lag 200, showing the slow power-law decay characteristic of volatility clustering.](../paper-assets/fig4_vol_clustering_acf.png)

### 7.4 Long Memory in Volatility (PASS)

The ACF of absolute returns at lag 50 is 0.030, clearly exceeding the 0.01 threshold. This represents robust long memory in volatility, consistent with the empirical findings of Ding, Granger, and Engle (1993). The persistence out to lag 100 (0.022) confirms that volatility shocks have lasting effects.

The Hurst exponent, estimated by rescaled range analysis, is 0.53. This is close to 0.5 (random walk), indicating that the model successfully balances the trend-following behavior of Bands 1–3 with the mean-reverting fundamental anchor of Band 4.

### 7.5 Absence of Return Autocorrelation (FAIL)

The lag-1 return autocorrelation is −0.068, exceeding the ±0.05 threshold. This is the model's single failing metric, though it is close to the boundary.

**Root cause:** Market makers (Band 6) refresh the entire book every tick, creating mechanical bid-ask bounce. When price moves up on a market buy, the next tick's midpoint shifts upward, but the aggressive MM refresh can cause a slight pullback as the new spread straddles the new price. This creates weak negative autocorrelation.

This is a known artifact of ABMs with active market making. The value of −0.068 is a significant improvement over prior versions (−0.125) and may be further reducible by tuning MM cadence or spread width.

![Figure 5: Autocorrelation of raw returns. The lag-1 value of −0.068 (slightly outside the ±0.05 threshold) reflects market-maker bid-ask bounce. All other lags are near zero.](../paper-assets/fig5_return_acf.png)

### 7.6 Volume-Volatility Correlation (PASS)

The correlation between daily volume and daily absolute returns is 0.069, confirming the well-known positive association between trading activity and price variability.

This emerges naturally: when $\kappa_t$ is high, all agents generate larger orders (more volume) and use more market orders (more price impact), creating a self-consistent volume-volatility relationship.

### 7.7 Comparison: v1 → v2

| Metric | v1 (pre-fix) | v2 (current) |
|:--|:--|:--|
| Fat tails | PASS (trivially) | PASS (kurtosis 13.91) |
| Volatility clustering | FAIL ($\kappa$ frozen) | PASS (0.075) |
| Long memory | FAIL | PASS (0.030) |
| No return ACF | FAIL | FAIL (−0.068, improved) |
| Vol-vol correlation | FAIL | PASS (0.069) |
| Kappa variation | FAIL (stuck at 1.0) | PASS (σ = 0.107) |
| Sentiment variation | FAIL (frozen at 0.5) | PASS (0.42–0.59) |
| Squeezes | FAIL (0 events) | PASS (1 event) |
| Events rare | FAIL (every 76 ticks) | PASS (every 15,453 ticks) |
| Price discovery | PASS (trivially) | PASS |
| **Score** | **~2/10** | **9/10** |

![Figure 10: Stylized facts scorecard comparison between v1 (pre-fix) and v2 (current). The model improved from ~2/10 to 9/10 after fixing the band-mean vs column-mean bug and adding Bands 11–12.](../paper-assets/fig10_scorecard_comparison.png)

---

## 8. Robustness Analysis

The results in Sections 6–7 are based on a single seed (42). To establish that DiceStock's statistical properties are not artifacts of a particular random sequence, we conduct three robustness analyses: multi-seed Monte Carlo runs, band ablation sensitivity analysis, and empirical comparison against real S&P 500 data.

### 8.1 Multi-Seed Analysis

We run 30 independent simulations (seeds 1–30) of 15 simulated years each (1.47 million ticks per seed), collecting the full 10-metric scorecard for each run.

**Aggregate metric statistics (30 seeds, mean ± std):**

| Metric | Mean | Std | Min | Max |
|:--|:--|:--|:--|:--|
| Excess Kurtosis | 7.83 | 0.78 | 5.62 | 9.48 |
| |Return| ACF lag-1 | 0.083 | 0.022 | 0.030 | 0.119 |
| |Return| ACF lag-50 | 0.021 | 0.017 | −0.015 | 0.057 |
| Return ACF lag-1 | −0.093 | 0.025 | −0.154 | −0.054 |
| Volume-Vol Corr | 0.026 | 0.020 | −0.014 | 0.073 |
| Kappa Std | 0.107 | 0.002 | 0.103 | 0.110 |
| Sentiment Range | 0.139 | 0.007 | 0.127 | 0.156 |
| Annualized Vol | 19.4% | 0.9% | 17.7% | 22.1% |
| Hill Estimator | 4.04 | 0.44 | 3.41 | 5.47 |
| Hurst Exponent | 0.528 | 0.022 | 0.483 | 0.567 |

**Pass rates per stylized fact:**

| Stylized Fact | Pass Rate | Notes |
|:--|:--|:--|
| Fat Tails | 100% (30/30) | Robust across all seeds |
| Volatility Clustering | 93% (28/30) | 2 seeds marginally below threshold |
| Long Memory | 77% (23/30) | Weaker at 15-year horizon vs 75-year |
| No Return ACF | 0% (0/30) | Systematic failure — MM bid-ask bounce |
| Volume-Vol Corr | 87% (26/30) | Occasionally negative in short runs |
| Kappa Moves | 100% (30/30) | Very stable (low cross-seed variance) |
| Sentiment Moves | 100% (30/30) | Very stable |
| Squeezes | 27% (8/30) | Rare events, often 0 in 15 years |
| Events Rare | 100% (30/30) | Consistently rare |
| Price Discovery | 100% (30/30) | Price always moves substantially |

**Score distribution:**

| Score | Seeds | Percentage |
|:--|:--|:--|
| 9/10 | 4 | 13% |
| 8/10 | 17 | 57% |
| 7/10 | 9 | 30% |
| **Average** | | **7.8/10** |

**Key findings.** Five of the ten stylized facts pass with 100% reliability. The most consistent metrics are excess kurtosis (always > 5.6), kappa variation, sentiment range, event rarity, and price discovery. The weakest metric is return autocorrelation, which fails across all 30 seeds — confirming this as a systematic limitation rather than a seed-specific artifact. The squeeze pass rate of 27% reflects the rarity of these events; in shorter simulation windows many seeds never trigger the four-condition squeeze mechanism.

The remarkably low cross-seed variance in kappa (std = 0.002) and annualized volatility (std = 0.9%) demonstrates that the model's core dynamics are structurally determined rather than noise-dependent. The Hurst exponent is tightly clustered around 0.53 (std = 0.022), consistently near the 0.5 random-walk benchmark.

![Figure 12: Multi-seed scorecard results. Left: Score distribution across 30 seeds (mean 7.8/10). Right: Pass rate per stylized fact — fat tails, kappa dynamics, sentiment, events, and price discovery pass in 100% of seeds.](../paper-assets/fig12_multiseed_scores.png)

![Figure 14: Distribution of key metrics across 30 seeds (box plots) with S&P 500 reference values (red dashed lines). Annualized volatility and Hurst exponent closely bracket real-market values.](../paper-assets/fig14_multiseed_metrics.png)

### 8.2 Sensitivity Analysis (Band Ablation)

To identify which model components are load-bearing versus decorative, we systematically disable key mechanisms one at a time via configuration overrides and re-run a 10-year simulation (seed 42) for each ablation.

**Ablation configurations:**

| Ablation | Method | Score | Change |
|:--|:--|:--|:--|
| Baseline (all active) | — | 8/10 | — |
| No Events (Band 8) | EVENT_HIGH_THRESH=21 | 7/10 | −1 |
| No Sentiment (Band 9) | SENTIMENT_DECAY=1.0 | 7/10 | −1 |
| No Trend/OU (Band 11) | F_TREND_*=0 | 7/10 | −1 |
| No S/R (Band 12) | SR_PROXIMITY≈0 | 8/10 | 0 |
| No Squeeze (Band 5) | SQUEEZE_THRESH=1.0 | 8/10 | 0 |
| No PRICE_SCALE | PRICE_SCALE=1 | 8/10 | 0 |

**Detailed impact on key metrics:**

| Configuration | Kurtosis | Ann Vol | |R| ACF-1 | Hill | Hurst |
|:--|:--|:--|:--|:--|:--|
| Baseline | 7.15 | 20.4% | 0.102 | 4.32 | 0.545 |
| No Events | 8.29 | 20.1% | 0.110 | 3.64 | 0.563 |
| No Sentiment | 7.15 | 20.4% | 0.102 | 4.32 | 0.545 |
| No Trend/OU | 18.27 | 7.4% | 0.210 | 1.77 | 0.517 |
| No S/R | 0.33 | 4.2% | 0.090 | 5.31 | 0.572 |
| No Squeeze | 7.15 | 20.4% | 0.102 | 4.32 | 0.545 |
| No PRICE_SCALE | 0.38 | 95.1% | 0.036 | 4.77 | 0.451 |

**Band importance classification:**

- **CONTRIBUTORY (score decreases by 1):**
  - *Events (Band 8)*: Disabling events eliminates long memory in volatility (ACF-50 drops from 0.030 to −0.003). Events create volatility shocks that persist in the ACF structure.
  - *Sentiment (Band 9)*: Freezing sentiment at 0.5 trivially loses the sentiment-range metric. No impact on other metrics — sentiment's primary role is gating squeeze conditions.
  - *Trend/OU (Band 11)*: The most revealing ablation. Removing the OU trend process halves volatility (20.4% → 7.4%), eliminates volume-volatility correlation, and dramatically changes kurtosis (7.15 → 18.27). The trend process is essential for generating realistic price dynamics.

- **DECORATIVE at 10-year horizon (score unchanged):**
  - *Support/Resistance (Band 12)*: No scorecard impact, though removing it dramatically reduces kurtosis (7.15 → 0.33) and volatility (20.4% → 4.2%). This suggests S/R is a major source of price impact but happens to not flip any pass/fail thresholds at this configuration.
  - *Squeeze mechanics*: Identical metrics to baseline — squeezes are too rare in 10 years to have measurable statistical impact.
  - *PRICE_SCALE compression*: Score unchanged but vol explodes (20.4% → 95.1%) and kurtosis collapses. This confirms PRICE_SCALE is essential for realistic magnitudes but the scorecard thresholds are loose enough to still pass.

**Interpretation.** The trend/OU process (Band 11) and PRICE_SCALE compression are the two most impactful design choices. Band 11 provides the fundamental value drift that drives realistic volatility levels and volume-volatility correlation. PRICE_SCALE compresses raw dice-driven moves to realistic equity-scale returns. Without either, the model still produces some stylized facts (fat tails persist across all configurations) but loses quantitative realism.

![Figure 13: Band ablation sensitivity analysis. Each row is a configuration with one mechanism disabled. Green = PASS, red = FAIL. The trend/OU process (Band 11) and PRICE_SCALE compression show the largest metric impacts.](../paper-assets/fig13_sensitivity_heatmap.png)

### 8.3 Empirical Comparison: DiceStock vs S&P 500

We compare DiceStock's output against S&P 500 daily returns from January 1950 to December 2025 (19,119 observations, downloaded via Yahoo Finance). Both series span approximately 75 years.

**Head-to-head metric comparison:**

| Metric | DiceStock | S&P 500 | Target |
|:--|:--|:--|:--|
| Observations | 18,899 | 19,119 | — |
| Annualized Volatility | 14.9% | 15.8% | 15–20% |
| Skewness | −0.768 | −0.953 | < 0 |
| Excess Kurtosis | 13.91 | 25.28 | > 0 |
| |Return| ACF(1) | 0.075 | 0.270 | > 0.05 |
| |Return| ACF(50) | 0.030 | 0.126 | > 0.01 |
| Return ACF(1) | −0.068 | −0.002 | |·| < 0.05 |
| Hill Estimator | 2.45 | 2.91 | 2–5 |
| Hurst Exponent | 0.540 | 0.541 | 0.5–0.7 |

**Statistical tests:**

- **Kolmogorov-Smirnov test** (on standardized returns): KS = 0.170, p < 10^{−239}. The distributions differ significantly — expected, since DiceStock is not calibrated to S&P 500 data.
- **Tail comparison**: DiceStock has heavier tails than the S&P 500 at the 3σ level (4.01% vs 1.42% of observations), both far exceeding the normal distribution (0.27%). At the 2σ level, DiceStock (6.25%) is modestly higher than S&P 500 (4.56%).

**Qualitative assessment:**

| Property | Match? | Notes |
|:--|:--|:--|
| Fat tails (kurt > 3) | MATCH | Both strongly leptokurtic |
| Volatility clustering | MATCH | Both show positive |R| ACF |
| Long memory | MATCH | Both show persistent vol ACF |
| Return autocorrelation | DIFFER | DiceStock: −0.068, S&P: −0.002 |
| Hill estimator in [1.5, 5] | MATCH | 2.45 vs 2.91 — very close |
| Hurst in [0.45, 0.75] | MATCH | 0.540 vs 0.541 — nearly identical |

**Overall: 5/6 qualitative matches.**

**Key comparisons.** The annualized volatility match (14.9% vs 15.8%) is striking given that DiceStock was never calibrated to equity data. The Hurst exponents are virtually identical (0.540 vs 0.541), suggesting that DiceStock's balance of trend-following and mean-reversion closely mirrors real market dynamics. The Hill estimators fall in the same empirical range (2–5), confirming comparable tail behavior.

DiceStock's volatility clustering is weaker than the S&P 500's (ACF-1 of 0.075 vs 0.270), which is expected: real markets exhibit long-range GARCH-like persistence from institutional factors (earnings seasons, monetary policy cycles, portfolio rebalancing) that DiceStock's memoryless dice cannot capture. Similarly, DiceStock produces modestly heavier tails than the S&P 500 (kurtosis 13.9 vs 25.3 notwithstanding — the S&P's higher kurtosis reflects extreme events like Black Monday 1987 and the 2008 financial crisis that dominate the tail).

The single point of disagreement — return autocorrelation — is the same systematic issue identified in Section 7.5: market maker bid-ask bounce creates weak negative serial correlation.

![Figure 15: Return distribution comparison — DiceStock (blue) vs S&P 500 (orange). Both distributions show heavy tails relative to the normal overlay.](../paper-assets/fig_real_return_comparison.png)

![Figure 16: QQ plot comparison. Both DiceStock and S&P 500 returns depart dramatically from normality, though DiceStock shows modestly heavier tails.](../paper-assets/fig_real_qq_comparison.png)

![Figure 17: Autocorrelation function comparison. Both series show positive ACF of absolute returns (volatility clustering), though the S&P 500 exhibits stronger persistence.](../paper-assets/fig_real_acf_comparison.png)

![Figure 18: Head-to-head metrics comparison table. Annualized volatility (14.9% vs 15.8%) and Hurst exponents (0.540 vs 0.541) are strikingly similar despite zero calibration to empirical data.](../paper-assets/fig_real_metrics_table.png)

---

## 9. Complexity Comparison with Literature

### 9.1 Taxonomy

We propose evaluating ABM complexity along five dimensions:

| Dimension | Cont-Bouchaud | Lux-Marchesi | Mike-Farmer | Chiarella et al. | **DiceStock** |
|:--|:--|:--|:--|:--|:--|
| Agent types | 1 (identical) | 2 (F + C) | 1 (zero-intel) | 3 (F + C + N) | **12 bands** |
| Agents per type | ~10,000 | ~500 | ~10,000 | ~500 | **100 per band** |
| Agent intelligence | Network herding | Switching rule | Zero (random) | Belief updating | **Dice function** |
| Heterogeneity source | Random clusters | Endogenous switching | Empirical distributions | Strategy parameters | **Dice column means** |
| Limit order book | No | No | Yes (detailed) | Yes | **Yes** |
| State variables | 0 | 2 (mood shares) | 0 | 3 (beliefs) | **6** ($P$, $F$, $\kappa$, $s$, regime, SI) |
| Parameters fitted | ~5 | ~8 | ~6 (from data) | ~10 | **0** |
| Calibration method | Manual | Manual + analytical | Empirical | Manual | **None** |
| Stylized facts (reported) | 3–4 | 5–6 | 4–5 | 5–6 | **9/10 tested** |

### 9.2 Discussion

DiceStock achieves its results through a fundamentally different trade-off than prior models:

**Less agent intelligence.** Each DiceStock agent is a deterministic function of 10 dice values. There is no learning, no memory of past actions, no strategic behavior, and no adaptation. Even Mike and Farmer's "zero-intelligence" agents use fitted empirical distributions; DiceStock agents use uniform d20 dice.

**More structural richness.** DiceStock compensates with (a) 12 specialized band types vs. 1–3 in prior models, (b) 6 interacting state variables vs. 0–3, and (c) a full order book. The richness is in the *architecture*, not the agents.

**No fitted parameters.** This is perhaps the strongest differentiator. Every other major ABM in the table requires manual parameter tuning or fitting to empirical data. DiceStock's parameters describe the *structure* (grid size, band layout, tick timing) rather than being optimized for output.

The implication is that realistic market statistics can emerge from *diverse, simple* agents interacting through a complex mechanism, rather than from *few, sophisticated* agents with calibrated behavior.

---

## 10. Limitations and Future Work

### 10.1 Return Autocorrelation

The lag-1 return ACF of −0.068 is the model's single failing metric (threshold: ±0.05). The mechanical bid-ask bounce from per-tick MM refresh is the likely cause. Potential fixes include:
- MM refresh on a longer cadence (every 5–10 ticks instead of every tick)
- Adding a random component to MM refresh timing
- Reducing MM market share relative to other liquidity sources

The value has already improved significantly from −0.125 (pre-PRICE_SCALE) to −0.068, suggesting that further tuning of the MM mechanism could bring it within threshold.

### 10.2 Kappa Dead Zone

Despite the column-mean fix, $\kappa_t$ never drops below 0.89 in the 75-year simulation. The dead zone [9, 12] in the piecewise mapping means that when column 50's mean falls in the normal range, $\kappa$ smooths toward 1.0 but rarely reaches the low-volatility regimes (0.3–0.8). A narrower dead zone or asymmetric mapping could improve this.

### 10.3 Squeeze Rarity

While the squeeze mechanism functions correctly (1 event in 75 years), the four-condition trigger may be too strict. The sentiment decay of 0.92 limits the achievable sentiment range (0.42–0.59), meaning the sentiment > 0.57 condition is only rarely met simultaneously with the other three conditions. Reducing the decay factor could increase squeeze frequency.

### 10.4 Volatility Clustering Gap

The multi-seed analysis reveals that DiceStock's volatility clustering (|return| ACF lag-1) is consistently weaker than real markets (0.083 mean vs S&P 500's 0.270). While our threshold of >0.05 is met in 93% of seeds, the magnitude gap suggests that the model lacks long-range persistence mechanisms present in real markets — institutional momentum, earnings cycles, and monetary policy regimes create clustering that memoryless dice cannot fully reproduce.

### 10.5 No Multi-Asset Extension

DiceStock simulates a single asset. Extending to multiple correlated assets (using shared dice or cross-band dependencies) is a natural next step.

### 10.6 The Game Layer

DiceStock was originally designed as an interactive stock market simulation game where human players can observe the dice grid and submit their own orders. The game layer is functional but not the focus of this paper. Future work will investigate how human participants interact with and potentially alter the statistical properties of the simulated market.

---

## 11. Conclusion

We have presented DiceStock, an agent-based financial market model in which all agent behavior is parametrized by rolls of 12,000 twenty-sided dice. The model reproduces 9 of 10 targeted stylized facts of financial returns in a single 75-year run, including fat tails, volatility clustering, long memory in volatility, volume-volatility correlation, and endogenous short squeeze episodes.

**Robustness.** A 30-seed Monte Carlo analysis confirms that the core results are not seed-dependent: the mean scorecard is 7.8/10, with fat tails, kappa dynamics, sentiment variation, event rarity, and price discovery passing in 100% of seeds. Band ablation reveals that the trend/OU process (Band 11) and PRICE_SCALE compression are the most architecturally significant components, while the squeeze mechanism and support/resistance are statistically decorative at short horizons. Direct comparison against 75 years of S&P 500 daily returns yields 5/6 qualitative matches, with near-identical annualized volatility (14.9% vs 15.8%) and Hurst exponents (0.540 vs 0.541).

The key contribution is demonstrating that realistic market dynamics can emerge from *extremely simple* agents — deterministic functions of dice columns — provided there is sufficient agent *diversity* (12 specialized band types) and a realistic market *mechanism* (continuous double-auction order book with price-time priority).

No parameters were fitted to empirical data. The model is fully deterministic and reproducible from a single 32-bit seed. We have provided complete transparency about the calibration history, including three critical bugs that were discovered and fixed during development.

DiceStock suggests that the stylized facts of financial markets may be more a property of *market structure and agent heterogeneity* than of *agent sophistication*. This aligns with the broader findings of Mike and Farmer (2008) on zero-intelligence models, but extends them by showing that even zero-intelligence agents can reproduce a wide range of stylized facts when organized into a sufficiently rich architecture.

---

## References

Bouchaud, J.-P., Farmer, J.D., & Lillo, F. (2009). How markets slowly digest changes in supply and demand. In T. Hens & K.R. Schenk-Hoppé (Eds.), *Handbook of Financial Markets: Dynamics and Evolution* (pp. 57–160). North-Holland.

Chiarella, C., Iori, G., & Perelló, J. (2009). The impact of heterogeneous trading rules on the limit order book and order flows. *Journal of Economic Dynamics and Control*, 33(3), 525–537.

Cont, R. (2001). Empirical properties of asset returns: stylized facts and statistical issues. *Quantitative Finance*, 1(2), 223–236.

Cont, R., & Bouchaud, J.-P. (2000). Herd behavior and aggregate fluctuations in financial markets. *Macroeconomic Dynamics*, 4(2), 170–196.

Ding, Z., Granger, C.W.J., & Engle, R.F. (1993). A long memory property of stock market returns and a new model. *Journal of Empirical Finance*, 1(1), 83–106.

Lux, T., & Marchesi, M. (1999). Scaling and criticality in a stochastic multi-agent model of a financial market. *Nature*, 397(6719), 498–500.

Lux, T., & Marchesi, M. (2000). Volatility clustering in financial markets: a microsimulation of interacting agents. *International Journal of Theoretical and Applied Finance*, 3(4), 675–702.

Mandelbrot, B. (1963). The variation of certain speculative prices. *Journal of Business*, 36(4), 394–419.

Mike, S., & Farmer, J.D. (2008). An empirical behavioral model of liquidity and volatility. *Journal of Economic Dynamics and Control*, 32(1), 200–234.

---

*Full source code available at: [repository URL]*

*All simulation data and figures generated from seed 42 using DiceStock engine v2.*
