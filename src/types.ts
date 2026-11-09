/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type TransactionType = 'income' | 'expense';

export type IncomeCategory = 'customer_bill' | 'reseller_bill' | 'service_charge' | 'other_income';
export type ExpenseCategory = 
  | 'office_rent' 
  | 'transport' 
  | 'fuel' 
  | 'materials' 
  | 'utilities' 
  | 'promotion' 
  | 'bandwidth_bill' 
  | 'software_bill' 
  | 'emoney_charge' 
  | 'salary' 
  | 'mobile_bill' 
  | 'office_expense' 
  | 'entertainment' 
  | 'allowance' 
  | 'other_expense';

export type TransactionCategory = IncomeCategory | ExpenseCategory;

export interface Transaction {
  id: string;
  type: TransactionType;
  title: string;
  amount: number;
  category: TransactionCategory;
  date: string; // YYYY-MM-DD
  notes?: string;
  paymentMethod?: string;
  receivedBy?: string;
  receivedDate?: string;
  userId?: string;
  createdAt?: string;
  updatedAt?: string;
  clientId?: string;
  monthlyBill?: number;
  billingMonth?: string;
  collectorName?: string;
  receiverName?: string;
  status?: 'pending_supervisor' | 'pending_manager' | 'pending_accounts' | 'approved' | 'rejected';
  rejectionReason?: string;
  supervisorApprovedBy?: string;
  managerApprovedBy?: string;
  accountsApprovedBy?: string;
  supervisorApprovedAt?: string;
  managerApprovedAt?: string;
  accountsApprovedAt?: string;
  supervisorComment?: string;
  managerComment?: string;
  accountsComment?: string;
  supervisorDesignation?: string;
  managerDesignation?: string;
  accountsDesignation?: string;
  isDailyClosing?: boolean;
}

export const INCOME_CATEGORY_LABELS: Record<IncomeCategory, { label: string; color: string; icon: string }> = {
  customer_bill: { label: 'Customer Bill', color: 'bg-emerald-500', icon: 'UserCheck' },
  reseller_bill: { label: 'Reseller Bill', color: 'bg-teal-500', icon: 'Store' },
  service_charge: { label: 'Service Charge', color: 'bg-amber-500', icon: 'Zap' },
  other_income: { label: 'Other Income', color: 'bg-sky-500', icon: 'PlusCircle' },
};

export const EXPENSE_CATEGORY_LABELS: Record<ExpenseCategory, { label: string; color: string; icon: string }> = {
  office_rent: { label: 'Office Rent', color: 'bg-amber-600', icon: 'Home' },
  transport: { label: 'Transport', color: 'bg-indigo-500', icon: 'Car' },
  fuel: { label: 'Fuel', color: 'bg-orange-500', icon: 'Zap' },
  materials: { label: 'Materials', color: 'bg-stone-500', icon: 'Hammer' },
  utilities: { label: 'Utilities', color: 'bg-yellow-500', icon: 'Power' },
  promotion: { label: 'Promotion', color: 'bg-red-500', icon: 'Award' },
  bandwidth_bill: { label: 'Bandwidth Bill', color: 'bg-cyan-500', icon: 'Globe' },
  software_bill: { label: 'Software Bill', color: 'bg-teal-500', icon: 'Cpu' },
  emoney_charge: { label: 'E-Money Charge', color: 'bg-purple-500', icon: 'Wallet' },
  salary: { label: 'Salary', color: 'bg-emerald-600', icon: 'Briefcase' },
  mobile_bill: { label: 'Mobile Bill', color: 'bg-blue-600', icon: 'Phone' },
  office_expense: { label: 'Office Expense', color: 'bg-slate-600', icon: 'Settings' },
  entertainment: { label: 'Entertainment', color: 'bg-pink-500', icon: 'Sparkles' },
  allowance: { label: 'Allowance', color: 'bg-lime-600', icon: 'Coins' },
  other_expense: { label: 'Other Expense', color: 'bg-gray-550', icon: 'PlusCircle' },
};

export const ALL_CATEGORY_LABELS = {
  ...INCOME_CATEGORY_LABELS,
  ...EXPENSE_CATEGORY_LABELS,
};

export interface Reseller {
  id: string;
  userId: string;
  name: string;
  zone: string;
  bandwidth: string;
  monthlyBill: number;
  totalPaid: number;
  totalDue: number;
  unpaidMonths: number;
  phone: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface HomeUser {
  id: string;
  userId: string;
  name: string;
  address: string;
  phone: string;
  package: string;
  monthlyBill: number;
  status: 'active' | 'inactive';
  createdAt?: string;
  updatedAt?: string;
}

export interface TransportLog {
  fromLocation: string;
  toLocation: string;
  reason: string;
  amount: number;
}

export interface VoucherItem {
  sn: number;
  description: string;
  uom: string;
  quantity: number;
  amount: number;
}

export interface Voucher {
  id: string;
  userId: string;
  title: string;
  amount: number;
  category: string;
  date: string; // YYYY-MM-DD
  submittedBy: string;
  status: 'pending' | 'waiting_manager' | 'waiting_accounts' | 'approved' | 'rejected';
  notes?: string;
  rejectionReason?: string;
  attachmentName?: string;
  attachmentData?: string;
  transportLogs?: TransportLog[];
  items?: VoucherItem[];
  supervisorApprovedBy?: string;
  managerApprovedBy?: string;
  accountsApprovedBy?: string;
  supervisorApprovedAt?: string;
  managerApprovedAt?: string;
  accountsApprovedAt?: string;
  supervisorComment?: string;
  managerComment?: string;
  accountsComment?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface DailyClosing {
  id: string;
  userId: string;
  date: string; // YYYY-MM-DD
  openingCash: number;
  openingBkash: number;
  openingNagad: number;
  openingRocket: number;
  openingBank: number;
  openingSsl: number;
  
  closingCash: number;
  closingBkash: number;
  closingNagad: number;
  closingRocket: number;
  closingBank: number;
  closingSsl: number;
  
  totalCashIn: number;
  totalBkashIn: number;
  totalNagadIn: number;
  totalRocketIn: number;
  totalBankIn: number;
  totalSslIn: number;
  
  totalCashOut: number;
  totalBkashOut: number;
  totalNagadOut: number;
  totalRocketOut: number;
  totalBankOut: number;
  totalSslOut: number;
  
  notes?: string;
  status: 'open' | 'closed';
  closedBy?: string;
  createdAt?: any;
  updatedAt?: any;

  // Cash Drawer statement fields
  khaOfficeCash?: number;
  dhakaOfficeCash?: number;
  nayanCash?: number;
  accountCash?: number;

  transferKhaToNayan?: number;
  transferNayanToDhaka?: number;
  transferDhakaToNayan?: number;
  transferDhakaToKha?: number;
  isDrawerSubmitted?: boolean;
}

export type UserRole = 'admin' | 'supervisor' | 'manager' | 'accountant' | 'operator';

export interface AppUser {
  id: string; // Document ID (usually email, or generated uid if authenticated)
  email: string;
  displayName?: string;
  password?: string; // Optional custom user password
  isCustomUser?: boolean; // Optional flag indicating this user is Firestore-only
  role: UserRole;
  permissions: {
    canDeleteTransactions: boolean;
    canDeleteVouchers: boolean;
    canApproveSupervisor: boolean;
    canApproveManager: boolean;
    canApproveAccounts: boolean;
    canManageDailyClosing: boolean;
    canManageSubscribers: boolean;
    canAddSubscriberBills?: boolean;
  };
  menuAccess?: {
    showDashboard: boolean;
    showHistory: boolean;
    showHomeUser: boolean;
    showReseller: boolean;
    showVoucher: boolean;
    showDailyClosing: boolean;
  };
  createdBy: string;
  createdAt: string;
}

export type NotificationType = 'new_transaction' | 'bill_payment' | 'budget_alert';

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  message: string;
  read: boolean;
  createdAt: string;
}


