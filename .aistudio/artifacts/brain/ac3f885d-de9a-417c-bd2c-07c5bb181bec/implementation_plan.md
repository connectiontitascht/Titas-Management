# Implementation Plan: 3-Layer Approval Workflow & Ledger Redesign for Home User Bills

## Goal
Implement a 3-layer approval system (Supervisor -> Manager -> Accounts) for Home User bill additions and redesign the Approval Ledger to match the exact visual styling from `image_5d113622.png`.

## Changes Completed

### 1. Data Model & Permissions
- Extended `Transaction` interface in `src/types.ts`:
  - `status`: `'pending' | 'pending_supervisor' | 'pending_manager' | 'pending_accounts' | 'approved' | 'rejected'`.
  - Added approval metadata (`supervisorApprovedBy`, `supervisorApprovedAt`, `managerApprovedBy`, `managerApprovedAt`, `accountsApprovedBy`, `accountsApprovedAt`, `rejectionReason`).
- Updated Firestore security rules in `firestore.rules` to support new statuses and approval timestamps.
- Fixed subscriber permission checks and auto client-code generation to avoid access denied errors.

### 2. Approval Ledger Visual Redesign (Matched to `image_5d113622.png`)
- **Header**:
  - Soft icon box with `ListFilter`.
  - Title: `Home User Bills and Approval Tracker` and subtitle `All subscriber bill slips and current status`.
  - `Delete All Entries (Reset to 0)` soft rose pill button.
  - Tab pills: `All`, `Pending`, `Approved`, `Rejected`.
- **Toolbar**:
  - Search bar with client ID, name, collector filtering.
  - Date range filters (Start & End) + Payment method selector + PDF Download button.
- **Table Columns & Styling**:
  - `▶` Expand button: Blue square toggle with rotating arrow.
  - `VOUCHER ID`: Bold monospace client / bill ID.
  - `VOUCHER CREATOR`: Subscriber name.
  - `APPROVER NAME`: Current stage approver or `-`.
  - `PAYMENT METHOD`: Badge with logo (e.g. `💵 Cash`, `📱 bKash`).
  - `CATEGORY`: Pill badge (`Customer Bill`).
  - `TYPE`: Bold emerald text (`Income`).
  - `AMOUNT`: Bangla Taka symbol (`৳`) with bold formatted number.
  - `STATUS`: Pill badges for `Wait Supervisor`, `Wait Manager`, `Wait Accounts`, `Approved`, `Cancelled`.
  - `ACTIONS`:
    - Pending: Green step approval button (`Supervisor Approve`, `Manager Approve`, `Accounts Approve`), red `Cancel`, edit pencil, slip download, delete trash, and dark navy `[~ ⏱ Track]` button.
    - Approved/Cancelled: `Review Again`, slip download, delete trash, and dark navy `[~ ⏱ Track]` button.
- **Accordion Row**:
  - Expanding on click of the blue `▶` button to show audit details, collector, receiver, notes, rejection reasons, and quick download.
- **Real-time Live Tracking Portal Modal (`[~ ⏱ Track]` button)**:
  - Full-screen dark sleek modal matching Vouchers Tracking Portal.
  - Left panel: Subscriber bill details, amounts, collector, receiver, comments, and cancellation reason.
  - Right panel: 4-step real-time visual audit timeline with live animated status pulses, approver names, timestamps, latency age calculation, and download slip.
