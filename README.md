# Titas Accounting Software

A secure, offline-ready local data inventory and accounting management software tailored for Internet Service Providers (ISPs) to manage subscriber billing, reseller accounts, expense tracking, and cash drawer reconciliation.

## Features

- **Home User Management:** Efficient billing tracking with a robust 3-layer approval workflow (Supervisor -> Manager -> Accounts).
- **Role-Based Access Control (RBAC):** Granular permissions for Admins, Supervisors, Managers, Accountants, and Operators.
- **Financial Tracking:**
  - **Vouchers:** Manage office expenses with detailed approval trails.
  - **Daily Closing:** Manage cash drawers across different locations and payment methods.
  - **Reseller Management:** Track reseller zones, bandwidth, billing, and payments.
- **Reporting:** Graphical insights, payment method breakdowns, and PDF receipts.
- **Data Security:** Secure, real-time data synchronization using Firebase Firestore and Authentication.

## Technologies Used

- **Frontend:** React, TypeScript, Vite, Tailwind CSS, Lucide Icons.
- **Backend/Database:** Firebase Firestore, Firebase Authentication, Express.js (for server-side runtime).
- **Utilities:** jsPDF, XLSX (for reporting and data management).

## Getting Started

### Prerequisites

- Node.js (v18 or higher recommended)
- npm or yarn

### Installation

1. Clone the repository and install dependencies:
   ```bash
   npm install
   ```

2. Configure environment variables (refer to `.env.example`).

### Running Locally

To start the development server:

```bash
npm run dev
```

The application will be accessible at `http://localhost:3000`.

### Building and Deployment

To build the application for production:

```bash
npm run build
```

To run the production build (using the Node.js Express server):

```bash
npm run start
```

## License

© 2026 Titas Accounting Software. All rights reserved.
