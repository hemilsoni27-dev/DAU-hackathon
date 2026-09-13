# Smart Buy & Smart Sell Recommendation Engine

## Overview

GridTrade provides decision support to prosumers and consumers through **Smart Sell** and **Smart Buy** recommendations.

---

## 1. Smart Sell Safety & Logic

`generateSmartSellRecommendations(userId)` considers:
1. **Actual vs Predicted Surplus**: Compares current meter readings with 24-hour generation forecasts.
2. **Market Demand & Price**: Evaluates active market demand and indicative market clearing price.
3. **Grid Decision Enforcement (MANDATORY RULE)**:
   - If the grid decision is `RESTRICTED`, recommendation score is set to `0.0` with the clear reason: *"Grid decision is RESTRICTED: Trading temporarily halted."*
   - If actual & predicted surplus is `0.0 kWh`, recommendation score is `0.0`.
4. **Structured Explanations**: Generates human-readable bullet points explaining surplus availability, grid health, and local demand.

---

## 2. Smart Buy Logic

`generateSmartBuyRecommendations(userId)` considers:
1. **Listing Matching**: Scans open renewable listings ordered by lowest price.
2. **Savings Calculation**: Calculates estimated savings compared to standard grid utility tariffs (₹6.50/kWh baseline).
3. **Grid Policy Compliance**: Enforces regional feeder grid rules.
