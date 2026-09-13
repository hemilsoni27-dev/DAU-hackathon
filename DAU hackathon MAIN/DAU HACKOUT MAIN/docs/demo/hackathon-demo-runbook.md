# GridTrade — 3 to 5 Minute Hackathon Demo Runbook

> **Target Audience:** Hackathon Judges, DISCOM Stakeholders, Technical Reviewers  
> **Duration:** 3 minutes 45 seconds (Target window: 3–5 min)  
> **Demo Operator Role:** Switch roles live using the Floating Demo Control Panel.  
> **Canonical Product Spec:** [docs/product/grid-aware-trading.md](file:///c:/Users/T14s/OneDrive/Desktop/outlier/GridTrade-Foundation_BY_REPLIT/GridTrade-Foundation/docs/product/grid-aware-trading.md)

---

## Pre-Demo Checklist & Setup

1. **Verify Services Are Running:**
   - API Server: `http://localhost:5000/api/healthz` (Status 200 `healthy`)
   - AI FastAPI Service: `http://localhost:8000/healthz` (Status 200 `ok`)
   - Web App: `http://localhost:5173/` or `http://localhost:80/`
2. **Reset Demo State:**
   - Click **"Reset Seed Data"** in the floating Demo Control Panel (or run `pnpm demo:reset`).
   - Ensures standard seed metrics (5 Users, `KA_BLR_01` region, 32% baseline congestion).

---

## 3.5-Minute Step-by-Step Demo Script

| Step | Time | Action | Visual Anchor / Highlight | Key Talking Point |
|---|---|---|---|---|
| **1. Solar Generation** | 0:00 - 0:25 | Open GridTrade as **Prosumer** (`demo:prosumer`). View Solar System panel. | Solar Generation Card: `14.2 kWh`, Solar Panel capacity `10 kW`. | "Prosumer Priya's solar rooftop is generating surplus clean energy right now." |
| **2. Consumption & Surplus** | 0:25 - 0:45 | Point out Household Consumption vs. Generation. | Consumption: `4.5 kWh` → Marketable Surplus: `9.7 kWh`. | "After powering her home, GridTrade automatically calculates her marketable surplus of 9.7 kWh." |
| **3. Energy Listing** | 0:45 - 1:05 | Click **"Create Energy Listing"**. List `9.7 kWh` @ `₹6.20/kWh`. | Active Listings Table shows listing `LIST-001` in `ACTIVE` state. | "Priya lists her excess energy on GridTrade’s P2P digital coordination layer." |
| **4. Consumer Demand & Match**| 1:05 - 1:30 | Switch role to **Consumer** (`demo:consumer`). Click **"Smart Match"**. | Match score `94%`, Distance `1.2 km`, Wheeling fee `₹0.35/kWh`. | "Consumer Rahul requests 5 kWh. GridTrade’s matching engine scores proximity, green ratio, and price." |
| **5. Dynamic Pricing & Grid** | 1:30 - 1:50 | Highlight current price recommendation and Grid status. | Dynamic Price: `₹6.05/kWh`. Grid Status: `APPROVED` (Green badge). | "Dynamic pricing accounts for local supply/demand while verifying the underlying physical grid capability." |
| **6. Trade Confirmation & SHA-256** | 1:50 - 2:20 | Click **"Confirm P2P Trade"**. View Settlement & Ledger modal. | Trade Status: `CONFIRMED` → `COMPLETED`. Payment: `PAID`. Block `#42` Hash: `0x7f8a...` | "Trade settles instantly. GridTrade locks the transaction payload into an immutable SHA-256 tamper-evident hash chain." |
| **7. Ledger Verification** | 2:20 - 2:40 | Navigate to **SHA-256 Audit Ledger** page. Click **"Verify Chain"**. | Green notification: `Ledger Integrity Verified — 0 tampered blocks`. | "Anyone — regulators or DISCOMs — can independently audit trade records without third-party centralized trust." |
| **8. Grid Congestion & AI Control** | 2:40 - 3:15 | Open Demo Panel. Select Scenario: **"Severe Grid Congestion"**. Attempt trade. | Grid Status: `RESTRICTED` (Red badge). Trade confirmation disabled. Alert in DISCOM room. | "When local feeder congestion reaches 92%, GridTrade automatically RESTRICTS trading to preserve grid stability." |
| **9. DISCOM & Regulator View** | 3:15 - 3:45 | Switch role to **Utility DISCOM** & **Regulator**. View Anomaly & Control Room. | Feeders KA_BLR_01 status, AI Anomaly Score `0.87` (High), Audit Trail log. | "DISCOMs gain real-time visibility into microgrid flows, while regulators verify tariff compliance and audit logs." |

---

## Presenter Pitch: Grid-Aware Trading Narrative

During Step 5 and Step 8, deliver this concise spoken narrative:

> *"At first glance, a match looks like a perfect trade — the buyer needs energy and the prosumer has surplus."*
>
> *"But GridTrade asks one crucial extra question before approving the transaction: **can the local physical grid support this trade right now?**"*
>
> *"When feeder congestion rises, the answer changes. Instead of blindly executing a trade that could overload a local transformer, GridTrade automatically **adjusts** the quantity or **restricts** the trade entirely."*
>
> *"This is the fundamental difference between a marketplace that only sees buyers and sellers, and GridTrade — a marketplace that understands the physical grid around them."*

---

## Key Demo Failure Safeguards

- **AI Service Offline Fallback:** If FastAPI AI service goes down, backend gracefully falls back to deterministic rule-based predictions (`modelVersion: fallback-v1.0`). Demo will NOT break.
- **Database Connection Interruption:** Fallback mock state ensures control room metrics continue displaying clean data during localized network hiccups.
- **Controlled Demo Reset:** Single-click demo state reset restores baseline data in under 500ms.
