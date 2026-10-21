# ARVI POS - Frontend User Interface

Modern, responsive Cafe Point of Sale (POS) and Multi-Franchise Management web application built with React 18, TypeScript, Vite, and Tailwind CSS.

Designed for touchscreens, desktop terminals, and mobile devices, providing real-time operations comparable to Petpooja and Toast.

---

## Key Features

### 1. Multi-Tenant SaaS & Franchise Administration
- **Super Admin SaaS Portal**:
  - Interactive onboarding workflow for registering new cafe brands.
  - Subscription plan selection (`STARTER`, `PRO`, `ENTERPRISE`) and maximum outlet limits.
  - Automated initial Cafe Admin provisioning.
  - SaaS platform analytics overview (active brands, total outlets, system users, aggregated GMV).
- **Multi-Outlet Franchise Hub**:
  - Quick outlet switcher for multi-branch cafe owners.
  - New branch creation with custom address, phone, GSTIN, and printer routing toggles.
  - Comparative franchise sales metrics (revenue per branch, average order value, order volume).

### 2. Front of House & POS Terminal
- **Fast POS Billing Terminal**:
  - Grid-based visual menu with category filtering and real-time search.
  - Dynamic cart management: quantity adjustment, custom line-item notes, discounts, and payment methods (Cash, UPI, Card).
  - One-click KOT firing and automated thermal receipt generation.
- **Dining Table Management**:
  - Visual restaurant floor layout with real-time occupancy indicators (Vacant, Occupied, Billed).
  - Quick table bill assignment and party transfer.
- **Kitchen Display System (KDS)**:
  - Live kitchen orders with color-coded preparation stages (New, Cooking, Ready, Served).
  - Filter orders by Kitchen vs Juice/Bar preparation stations.
- **Bills & Order History**:
  - Comprehensive invoice archive with search, date filters, receipt re-printing, and order cancellation.

### 3. Back of House & Operations
- **User Profile & Password Management**:
  - Top navigation user profile modal with editable contact details (Name, Phone, Email, Address).
  - Secure self-service password reset modal with current password confirmation and strength validation.
- **Brand Identity & Logo Customization**:
  - Live cafe brand configuration card in Settings.
  - Image upload with instant data URL preview, direct URL input, and automatic top navbar / receipt branding sync.
  - GSTIN, official contact information, and business address configuration.
- **Multi-Franchise General Manager & Outlet Branch Managers**:
  - **General Manager (`GENERAL_MANAGER`)**: Second in command after Admin; exercises cross-outlet governance, oversees branch managers, combined inventory stock, cross-branch expenses, and switches between outlets via the top navbar switcher.
  - **Single-Outlet Manager (`MANAGER`)**: Assigned specifically to an outlet and restricted strictly to managing staff, stock, and expenses for that location.
- **Granular RBAC Staff Creation & Delegation**:
  - Fine-grained permission checkboxes when creating or editing staff:
    - `canBill` (POS billing and checkout)
    - `canTakeOrders` (Captain mode & table ordering)
    - `canManageInventory` (Stock audits and inward supply invoices)
    - `canManageExpenses` (Expense vouchers and petty cash tracking)
    - `canViewReports` (Revenue and P&L analytics)
  - Admin/GM remote staff password reset functionality.
- **Menu & Catalog Editor**:
  - Category and product management, pricing adjustments, veg/non-veg flags, and stock availability toggles.
- **Inventory & Supply Management**:
  - Real-time stock levels, low-inventory alert thresholds, and replenishment tracking.
- **Shift Registers & Cash Management**:
  - Shift opening float declaration, mid-day cash adjustments, and end-of-day register closure reconciliation.
- **Expense Tracker**:
  - Branch-level operational expense recording and expense category breakdowns.
- **Settings & Hardware**:
  - LAN thermal printer configuration (Bill, Kitchen KOT, and Juice KOT endpoints).
- **Contactless Customer QR Menu**:
  - Lightweight, responsive public menu interface optimized for customer mobile browsers.

---

## Tech Stack

- **Framework**: React 18 (SPA)
- **Language**: TypeScript 5.x
- **Build Tool**: Vite 5.x
- **Styling**: Tailwind CSS & Lucide Icons
- **Web Server & Reverse Proxy**: Hardened Nginx on Alpine Linux
- **Real-Time Updates**: Server-Sent Events (SSE)

---

## Project Structure

```
arvi-pos-ui/
├── src/
│   ├── api/             # Axios/fetch API client with token interceptors
│   ├── components/      # Modular view components (POSBilling, KDS, SuperAdmin, Outlets, etc.)
│   ├── context/         # AuthContext (JWT, active tenant, active outlet state)
│   ├── types/           # TypeScript definitions for POS entities
│   ├── App.tsx          # Main application layout and view router
│   ├── main.tsx         # React root entry point
│   └── index.css        # Tailwind CSS directives
├── public/              # Static assets, icons, manifest.json, sound effects
├── nginx.conf           # Hardened Nginx configuration with SPA fallback & API proxying
├── Dockerfile           # Multi-stage Docker build (Node 20 builder -> Nginx Alpine runtime)
├── package.json         # NPM scripts and dependencies
├── vite.config.ts       # Vite bundler configuration
└── tailwind.config.js   # Tailwind design tokens
```

---

## Getting Started

### Local Development

```bash
# Install dependencies
npm install

# Start local Vite development server
npm run dev
```

The dev server will run on `http://localhost:5173` with API requests proxied to the backend.

### Production Build

```bash
# Type check and build production bundle
npm run build
```

The production output will be generated in `dist/`.

### Docker Build & Run

```bash
# Build production Docker image
docker build -t arjunvk/arvi-ui:v1.0.0 .

# Run container
docker run -d \
  -p 3000:80 \
  --name arvi-frontend \
  arjunvk/arvi-ui:v1.0.0
```

Access the UI at `http://localhost:3000`.
