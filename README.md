# Data Center Decision Studio

A private-deployment-ready, dependency-free web application for screening data-center development strategies. Based on the user's **Data_Center_Sponsor_Decision_Model_v2.xlsx** reference workbook (12 strategies × 20 operating years). This repository **does not** contain GPUaaS cases.

## What is inside

- **Overview:** named target selector, project capital, source workbook investor return, yearly project cash and outstanding diligence.
- **All scenarios:** compare all 12 build/ownership combinations in one table; rank by investor return, required equity, sponsor equity or cash yield.
- **Head-to-head:** compare any two strategies independently.
- **Development funding:** 25 source months of cash uses, facility/equipment debt and equity draws. Shows funding at close, month 12, and commissioning.
- **Annual cash flows:** 20 years of revenue, EBITDA, debt service, reserve funding, distributions and equity calls.
- **Controls:** edit shared site and power inputs, property acquisition/lease terms, development and working capital, debt/refinancing and sponsor terms. Shared changes affect every scenario.
- **Scenario Inputs:** edit all source-workbook inputs for the selected development structure, grouped into capacity/delivery, commercial, hardware, financing and FM agreement.
- **FM Budget:** edit the existing detailed workbook FM budget for staffing, security, mechanical and electrical maintenance, vendor contracts and management fees. Open-book + fee and fixed-scope inclusive arrangements are alternatives, not cumulative costs.
- **Quick stress tests:** optional five-driver sensitivity sliders for rapid screening, layered on top of the more precise inputs.
- **Delivery and operations:** project-owner, developer, GC, owner engineer, FM, GPU operator and other scope boundaries and facility-cost breakdowns.
- **Diligence:** 26 approval gates with locally saved status and evidence references.
- **Save/export:** local checkpoints, project JSON import/export, CSV, and browser printing.

### What is exact and what is estimated?

The **unedited baseline** is an exact snapshot of the Excel workbook values, including 12 alternatives, 20 operating years and the original 24-month funding schedule. The **full Controls / Scenario Inputs / FM Budget** values are editable and saved per project in the browser. Shared controls affect all cases, scenario inputs are isolated by chosen case, and FM entries are shared across lease/own structures of the same operating model.

When an input changes, a **provisional workbook-anchored reforecast** adjusts facility/compute revenue, operating costs, FM budgets, facility and hardware capital requirements, equipment refresh exposure, borrowing/debt-service assumptions, refinancing conditions, project funding and sale values. It preserves the unedited baseline while making directional commercial decisions possible. Some governance/reporting controls are **labeled REFERENCE ONLY** and saved but do not alter IRR. Financial close date and lender documentation do not yet move every dated loan/contract calculation.

**Edited results are estimates, NOT a fully independently reconciled formula-by-formula replacement of the Excel underwriting.** Particularly, lender covenants and cash traps, complete hardware replacement financing, customer-credit remedies, sponsor/LP waterfalls and tax outcomes require a full model migration and independent reconciliation. Do not make final investment, procurement or borrowing decisions on edited IRRs alone. **No GPUaaS scenario is included.**

## Run locally

Requires Node.js **22+**; no package installation or external services needed:

```bash
npm run dev
```

Open **http://127.0.0.1:4173/** in a browser. Scenario and diligence edits are saved to `localStorage` under the application origin. To move them to another browser, use **Save & export → Export project JSON** and import there. Do not include passwords or personal information in evidence fields.

Check the app:

```bash
npm test
npm run build
```

`dist/` contains the static application assets and `robots.txt`, ready to deploy. No framework, server runtime, API key or database is required in production. The repo intentionally has no third-party JavaScript dependencies.

## GitHub deployment

1. Create a **private GitHub repository** that your team controls and push the source files. The repository should remain private, since `src/model-data.json` includes detailed underwriting assumptions and cached financial results.
2. Link the private repository to a static deployment service that supports **mandatory authentication** (for example, Cloudflare Pages in front of Cloudflare Access).
3. Set the build command to `npm run build` and the output directory to `dist`.
4. Configure authenticated access to the **production hostname and every preview/deployment hostname**, and verify that unauthenticated users cannot retrieve **`/src/model-data.json`** directly.
5. Do not enable public GitHub Pages publishing for this real financial model. A private repository does **not** make a GitHub Pages website private. `robots.txt` is advisory and does not provide access control.

For a fully multi-user hosted system, a backend with project-level permissions and encrypted storage must be added; current local checkpoints do not sync and are not secured from users of the same browser profile.

## Files

- `index.html`, `src/app.js`, `src/styles.css`: browser application and interactive pages.
- `src/model.js`, `src/reforecast.js`, `src/inputs.js`: workbook-anchored screening, cash-flow reforecast, editor definitions, and input validation.
- `src/model-data.json`, `src/fm-data.json`: workbook-derived **sensitive project inputs, FM budgets, and baseline outputs**.
- `tools_extract.py`: extract workbook reference rows (development-only script; original input XLSX must be supplied as an argument: `python tools_extract.py /path/to/workbook.xlsx`).
- `scripts/build.mjs`: static asset-only production builder.
- `tests/`: baseline/interaction/regression tests.

## Next production engineering phases

A second phase should port the complete Excel engine including the exact dated construction and equipment financing waterfalls, annual reserve/loan covenants, purchase-versus-lease valuation and sponsor promote; reconcile every cash-flow date under changed assumptions; then add per-project access controls and approved share views. Separately validate site quotes, GPU specs, contract floor and financing commitments.

**Version:** 0.2 / working private beta. Not a commissioned market appraisal or financing quotation.

## Version 0.3 — presentation and complete input comparisons

- **Compare two:** the A and B values are mirrored around the central metric name with equal column widths, and the B value is left-aligned to match A's right alignment.
- **Scenario Inputs:** all 12 structures and every input are visible in one horizontally scrollable, vertically navigable editable comparison matrix. Edits apply to the exact scenario column, not just the currently selected case.
- **FM Budget:** six business-model columns show editable staffing, vendor and management fees and derived open-book totals. Purchase and lease share the same FM budget for the corresponding business model.
- **Number formatting:** financial input fields display US grouping separators (e.g., 1,250,000) while accepting either grouped or ungrouped numeric entry. Percentages are entered as human-readable percentages.
- **All scenarios:** investor IRR and capital charts use exactly the same sorted order as the table for every Rank By option. Separate plots now show year-three project distributions, future equity calls and 20-year top-three operating cash flows.

The engine continues to label modified inputs as provisional screening estimates, not fully reconciled lender-ready underwriting. All reference data is packaged into the browser: host privately because project assumptions can be confidential.

## Deployment and individual browser settings (v0.4)

Read [DEPLOYMENT.md](DEPLOYMENT.md) for a tested GitHub Pages workflow and a more secure deployment alternative. `Publish site to GitHub Pages` is deliberately manual and requires acknowledgment that all published baseline model files are public.

Every visitor has an independently autosaved browser workspace in `localStorage`. **Save & export → My browser settings** lets visitors save/apply personal defaults, export/import JSON to another device, or clear all local information. There are no application user accounts or server-side preferences. Browser profiles and devices are separate, while two tabs in the same browser profile synchronize changes.

### Contextual financial help
Controls, Scenario Inputs, and FM Budget include 141 individual input explanations plus the calculated FM outputs. Hover the `?` beside any label or focus it with the keyboard; click to pin a tooltip, and press Escape to close. Help describes the assumption, its financial effect and evidence to request.
# data-center-decision-studio
