/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  TrendingUp, 
  TrendingDown, 
  CalendarDays,
  Settings,
  Scale,
  LayoutDashboard,
  Receipt,
  BarChart3,
  User,
  Menu,
  X,
  LogOut,
  Users,
  FileText,
  ChevronDown,
  Calculator,
  AlertCircle
} from 'lucide-react';
import { 
  collection, 
  doc, 
  setDoc, 
  updateDoc,
  deleteDoc, 
  query, 
  where, 
  onSnapshot, 
  getDocs,
  serverTimestamp 
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from './firebase';
import { AuthScreen } from './components/AuthScreen';
import { Transaction, AppUser } from './types';
import { BudgetSummary } from './components/BudgetSummary';
import { TransactionForm } from './components/TransactionForm';
import { TransactionList } from './components/TransactionList';
import { GraphicalReports } from './components/GraphicalReports';
import { PaymentMethodBreakdown } from './components/PaymentMethodBreakdown';
import { HomeUserSection } from './components/HomeUserSection';
import { ResellerSection } from './components/ResellerSection';
import { VoucherSection } from './components/VoucherSection';
import { DailyClosingSection } from './components/DailyClosingSection';
import { SystemUsersSection } from './components/SystemUsersSection';
import { NotificationBell } from './components/NotificationBell';

// Default initial mock transactions in English to make the app gorgeous on first load
const INITIAL_TRANSACTIONS: Transaction[] = [
  {
    id: 't-1',
    type: 'income',
    title: 'New Connection & Service Charge',
    amount: 32000,
    category: 'service_charge',
    date: '2026-06-01',
    notes: 'New connection fee and router setup charge',
  },
  {
    id: 't-2',
    type: 'expense',
    title: 'Office Rent Payment',
    amount: 12005,
    category: 'office_rent',
    date: '2026-06-02',
    notes: 'June office rent',
  },
  {
    id: 't-3',
    type: 'expense',
    title: 'Office Tea & Snacks',
    amount: 3450,
    category: 'office_expense',
    date: '2026-06-03',
    notes: 'Office afternoon tea snacks and guest entertainment',
  },
  {
    id: 't-4',
    type: 'income',
    title: 'Customer Monthly Bill Collection',
    amount: 15500,
    category: 'customer_bill',
    date: '2026-06-04',
    notes: 'Dhamrai zone retail user bill collection',
  },
  {
    id: 't-5',
    type: 'expense',
    title: 'Electricity & Wifi Bill',
    amount: 2125,
    category: 'utilities',
    date: '2026-06-04',
    notes: 'Paid via online payment gateway',
  },
  {
    id: 't-6',
    type: 'expense',
    title: 'Office Mobile Bill Paid',
    amount: 720,
    category: 'mobile_bill',
    date: '2026-06-05',
    notes: 'Officers mobile allowance bill',
  }
];

export default function App() {
  const [user, setUser] = useState<any>(() => {
    try {
      const stored = localStorage.getItem('titas_custom_user');
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (e) {
      console.error('Error loading custom user session:', e);
    }
    return null;
  });
  const [authLoading, setAuthLoading] = useState(true);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [resellers, setResellers] = useState<any[]>([]);
  const [activeSection, setActiveSection] = useState<'dashboard' | 'history' | 'home_user' | 'reseller' | 'voucher' | 'daily_closing' | 'system_users'>('dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [desktopSidebarOpen, setDesktopSidebarOpen] = useState(true);
  const [currentUserProfile, setCurrentUserProfile] = useState<AppUser | null>(null);
  const [systemMenuOpen, setSystemMenuOpen] = useState(false);

  // Auth loading state view
  useEffect(() => {
    setAuthLoading(false);
  }, []);
  useEffect(() => {
    if (!user) {
      setCurrentUserProfile(null);
      return;
    }

    const docRef = doc(db, 'app_users', user.uid);
    const unsubscribe = onSnapshot(docRef, async (docSnap) => {
      if (docSnap.exists()) {
        const profile = docSnap.data() as AppUser;
        // Ensure menuAccess exists
        if (!profile.menuAccess) {
          profile.menuAccess = {
            showDashboard: true,
            showHistory: true,
            showHomeUser: true,
            showReseller: true,
            showVoucher: true,
            showDailyClosing: true,
          };
        }

        const isSystemOwner = profile.email?.toLowerCase() === 'connection.titascht@gmail.com';
        if (isSystemOwner || profile.role === 'admin') {
          profile.role = 'admin';
          profile.permissions = {
            ...(profile.permissions || {}),
            canDeleteTransactions: true,
            canDeleteVouchers: true,
            canApproveSupervisor: true,
            canApproveManager: true,
            canApproveAccounts: true,
            canManageDailyClosing: true,
            canManageSubscribers: true,
            canAddSubscriberBills: true,
          };
        } else {
          // Default canAddSubscriberBills to true if not explicitly set to false
          if (!profile.permissions) {
            profile.permissions = {
              canDeleteTransactions: false,
              canDeleteVouchers: false,
              canApproveSupervisor: profile.role === 'supervisor',
              canApproveManager: profile.role === 'manager',
              canApproveAccounts: profile.role === 'accountant',
              canManageDailyClosing: profile.role === 'accountant',
              canManageSubscribers: true,
              canAddSubscriberBills: true,
            };
          } else {
            if (profile.permissions.canAddSubscriberBills === undefined) {
              profile.permissions.canAddSubscriberBills = true;
            }
            if (profile.role === 'supervisor' && profile.permissions.canApproveSupervisor === undefined) {
              profile.permissions.canApproveSupervisor = true;
            }
            if (profile.role === 'manager' && profile.permissions.canApproveManager === undefined) {
              profile.permissions.canApproveManager = true;
            }
            if (profile.role === 'accountant' && profile.permissions.canApproveAccounts === undefined) {
              profile.permissions.canApproveAccounts = true;
            }
          }
        }

        console.log("Logged in user profile:", profile);
        setCurrentUserProfile(profile);
      } else {
        // If this is a custom user, only skip if not the system owner
        const isSystemOwner = user.email?.toLowerCase() === 'connection.titascht@gmail.com';
        if (user.isCustom && !isSystemOwner) {
          return;
        }

        // Automatically seed admin profile for first-time or backward compatibility
        const adminProfile: AppUser = {
          id: user.uid,
          email: user.email || 'admin@titas.com',
          role: 'admin',
          permissions: {
            canDeleteTransactions: true,
            canDeleteVouchers: true,
            canApproveSupervisor: true,
            canApproveManager: true,
            canApproveAccounts: true,
            canManageDailyClosing: true,
            canManageSubscribers: true,
            canAddSubscriberBills: true,
          },
          createdBy: 'system',
          createdAt: new Date().toISOString()
        };

        try {
          await setDoc(docRef, adminProfile);
          setCurrentUserProfile(adminProfile);
        } catch (err) {
          console.error('Failed to seed admin profile:', err);
          // Fallback in-memory
          setCurrentUserProfile(adminProfile);
        }
      }
    }, (error) => {
      console.error('Failed to listen to user profile:', error);
    });

    return () => unsubscribe();
  }, [user]);

  // Redirect to first permitted section if activeSection is hidden
  useEffect(() => {
    if (!currentUserProfile || !currentUserProfile.menuAccess) return;
    
    const access = currentUserProfile.menuAccess;
    const isSectionPermitted = {
      dashboard: access.showDashboard,
      history: access.showHistory,
      home_user: access.showHomeUser,
      reseller: access.showReseller,
      voucher: access.showVoucher,
      daily_closing: access.showDailyClosing,
      system_users: currentUserProfile.role === 'admin'
    };

    if (activeSection !== 'system_users' && !isSectionPermitted[activeSection as keyof typeof isSectionPermitted]) {
      // Find the first permitted section
      const permittedOrder: Array<'dashboard' | 'history' | 'home_user' | 'reseller' | 'voucher' | 'daily_closing'> = [
        'dashboard', 'history', 'home_user', 'reseller', 'voucher', 'daily_closing'
      ];
      const fallback = permittedOrder.find(sec => isSectionPermitted[sec]);
      if (fallback) {
        setActiveSection(fallback);
      }
    }
  }, [currentUserProfile, activeSection]);

  // Seeding initial mock data dynamically
  const seedInitialData = async (uid: string) => {
    try {
      // Create documents sequentially or concurrently
      for (const tx of INITIAL_TRANSACTIONS) {
        const newId = `tx-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const docRef = doc(db, 'transactions', newId);
        await setDoc(docRef, {
          id: newId,
          type: tx.type,
          title: tx.title,
          amount: tx.amount,
          category: tx.category,
          date: tx.date,
          notes: tx.notes || '',
          userId: uid,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
    } catch (err) {
      console.error('Failed to seed initial transactions:', err);
    }
  };

  // Listen to User's Transactions in Firestore
  useEffect(() => {
    if (!user || !currentUserProfile) {
      setTransactions([]);
      return;
    }

    let transactionsQuery;
    if (['admin', 'accountant'].includes(currentUserProfile.role)) {
      transactionsQuery = query(collection(db, 'transactions'));
    } else {
      transactionsQuery = query(
        collection(db, 'transactions'),
        where('userId', '==', user.uid)
      );
    }

    const unsubscribeSnapshot = onSnapshot(
      transactionsQuery,
      async (snapshot) => {
        const list: Transaction[] = [];
        snapshot.forEach((docSnapshot) => {
          const data = docSnapshot.data();
          list.push({
            id: docSnapshot.id,
            type: data.type,
            title: data.title,
            amount: data.amount,
            category: data.category,
            date: data.date,
            notes: data.notes || '',
            paymentMethod: data.paymentMethod || '',
            receivedBy: data.receivedBy || '',
            receivedDate: data.receivedDate || '',
            userId: data.userId,
            createdAt: data.createdAt?.toDate?.()?.toISOString() || '',
            updatedAt: data.updatedAt?.toDate?.()?.toISOString() || '',
            clientId: data.clientId || '',
            monthlyBill: Number(data.monthlyBill) || 0,
            billingMonth: data.billingMonth || '',
            collectorName: data.collectorName || '',
            receiverName: data.receiverName || '',
            status: data.status || 'approved',
            isDailyClosing: data.isDailyClosing || false,
          });
        });

        // Sort descending by calendar date
        list.sort((a, b) => b.date.localeCompare(a.date));
        setTransactions(list);
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, 'transactions');
      }
    );

    return () => unsubscribeSnapshot();
  }, [user, currentUserProfile]);

  // Listen to Resellers in Firestore
  useEffect(() => {
    if (!user || !currentUserProfile) {
      setResellers([]);
      return;
    }

    let resellersQuery;
    if (['admin', 'accountant'].includes(currentUserProfile.role)) {
      resellersQuery = query(collection(db, 'resellers'));
    } else {
      resellersQuery = query(
        collection(db, 'resellers'),
        where('userId', '==', user.uid)
      );
    }

    const unsubscribe = onSnapshot(
      resellersQuery,
      (snapshot) => {
        const list: any[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          list.push({
            id: docSnap.id,
            ...data
          });
        });
        setResellers(list);
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, 'resellers');
      }
    );

    return () => unsubscribe();
  }, [user]);

  // One-time automatic database cleanup requested by the user
  useEffect(() => {
    if (!user) return;

    const runAutomaticCleanup = async () => {
      const isCleaned = localStorage.getItem('complete_db_reset_july_10_v2');
      if (isCleaned) return;

      console.log("Running complete database reset: deleting all transactions, vouchers, and resetting reseller balances...");
      try {
        // 1. Delete all transactions belonging to the user
        const transactionsQuery = query(
          collection(db, 'transactions'),
          where('userId', '==', user.uid)
        );
        const transactionsSnapshot = await getDocs(transactionsQuery);
        let deletedTxCount = 0;
        for (const docSnap of transactionsSnapshot.docs) {
          await deleteDoc(doc(db, 'transactions', docSnap.id));
          deletedTxCount++;
        }

        // 2. Delete all vouchers belonging to the user
        const vouchersQuery = query(
          collection(db, 'vouchers'),
          where('userId', '==', user.uid)
        );
        const vouchersSnapshot = await getDocs(vouchersQuery);
        let deletedVoucherCount = 0;
        for (const docSnap of vouchersSnapshot.docs) {
          await deleteDoc(doc(db, 'vouchers', docSnap.id));
          deletedVoucherCount++;
        }

        // 3. Query and reset penal/billing amounts (totalPaid, totalDue, and unpaidMonths) for all resellers belonging to this user
        const resellersQuery = query(
          collection(db, 'resellers'),
          where('userId', '==', user.uid)
        );
        const resellersSnapshot = await getDocs(resellersQuery);
        let updatedResellers = 0;
        for (const docSnap of resellersSnapshot.docs) {
          const docRef = doc(db, 'resellers', docSnap.id);
          await updateDoc(docRef, {
            totalPaid: 0,
            totalDue: 0,
            unpaidMonths: 0,
            updatedAt: serverTimestamp()
          });
          updatedResellers++;
        }

        // 4. Mark cleanup as completed in localStorage to prevent repeat executions
        localStorage.setItem('complete_db_reset_july_10_v2', 'true');
        
        console.log(`Reset success: ${deletedTxCount} transactions deleted, ${deletedVoucherCount} vouchers deleted, ${updatedResellers} resellers zeroed out.`);
      } catch (err) {
        console.error("Complete database reset failed:", err);
      }
    };

    runAutomaticCleanup();
  }, [user]);

  // Handle adding transaction in Firebase
  const handleAddTransaction = async (newTx: Omit<Transaction, 'id'>) => {
    if (!user) return;
    const newId = `tx-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const docRef = doc(db, 'transactions', newId);
    try {
      await setDoc(docRef, {
        id: newId,
        type: newTx.type,
        title: newTx.title,
        amount: newTx.amount,
        category: newTx.category,
        date: newTx.date,
        notes: newTx.notes || '',
        paymentMethod: newTx.paymentMethod || '',
        receivedBy: newTx.receivedBy || '',
        receivedDate: newTx.receivedDate || '',
        userId: user.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        clientId: newTx.clientId || '',
        monthlyBill: newTx.monthlyBill || 0,
        billingMonth: newTx.billingMonth || '',
        collectorName: newTx.collectorName || '',
        receiverName: newTx.receiverName || '',
        status: newTx.status || 'approved',
      });
      // Trigger notification
      const notificationRef = doc(collection(db, 'notifications'));
      await setDoc(notificationRef, {
        id: notificationRef.id,
        userId: user.uid,
        type: 'new_transaction',
        message: `New ${newTx.type} added: ${newTx.title}`,
        read: false,
        createdAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `transactions/${newId}`);
    }
  };

  // Handle deleting transaction in Firebase
  const handleDeleteTransaction = async (id: string) => {
    if (!user) return;
    if (window.confirm('Are you sure you want to delete this transaction?')) {
      const docRef = doc(db, 'transactions', id);
      try {
        await deleteDoc(docRef);
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, `transactions/${id}`);
      }
    }
  };

  // Handle deleting all transactions
  const handleDeleteAllTransactions = async () => {
    if (!user) return;
    if (transactions.length === 0) {
      alert('No transaction entries found.');
      return;
    }
    if (!window.confirm('Are you sure you want to delete all transactions? This cannot be undone!')) return;
    if (!window.confirm('Confirm for the last time: You are about to delete all transaction records and reset the calculations. Are you sure?')) return;
    
    try {
      for (const tx of transactions) {
        const docRef = doc(db, 'transactions', tx.id);
        await deleteDoc(docRef);
      }
      alert('All transactions have been deleted successfully and the database has been reset.');
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'transactions/all');
    }
  };

  // Handle Safe Sign Out
  const safeSignOut = async () => {
    try {
      localStorage.removeItem('titas_custom_user');
      setUser(null);
    } catch (err) {
      console.error('Sign out error:', err);
    }
  };

  // Auth loading state view
  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#F1F5F9] flex flex-col items-center justify-center font-sans space-y-4">
        <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-xs font-bold text-slate-600">Loading Titas Accounting Dashboard...</p>
      </div>
    );
  }

  // If user is not authenticated, show Auth Screen
  if (!user) {
    return (
      <div className="p-4 bg-red-100">
        <AuthScreen onCustomLogin={(customUser: any) => {
          localStorage.setItem('titas_custom_user', JSON.stringify(customUser));
          setUser(customUser);
        }} />
      </div>
    );
  }

  // Filter out pending and rejected home user bills, and exclude daily closing transactions from general financial math
  const approvedOrStandardTransactions = transactions.filter(t => {
    // 1. Filter out daily closing statements from main transactional lists and metrics
    const isDailyClosingStatement = t.isDailyClosing === true || 
      (t.notes && (t.notes.includes('Daily Closing entry statement:') || t.notes.includes('Daily Closing expense statement:')));
    if (isDailyClosingStatement) {
      return false;
    }

    // 2. Filter out rejected home user bills
    const isHomeUserBill = t.category === 'customer_bill' || !!t.clientId || t.title.includes('Home User') || t.title.includes('হোম ইউজার') || (t.notes && (t.notes.includes('Manual Bill') || t.notes.includes('ম্যানুয়াল বিল জমা')));
    if (isHomeUserBill) {
      return t.status !== 'rejected'; // Show all except explicitly rejected ones
    }
    return true; // standard transactions are shown immediately
  });

  return (
    <div className="flex h-screen bg-[#F1F5F9] font-sans text-slate-900 overflow-hidden relative">
      {/* Sidebar background graphics */}
      <div className="absolute top-0 left-[240px] w-[500px] h-[500px] blur-glow-emerald rounded-full pointer-events-none -z-10"></div>
      <div className="absolute top-[30%] right-[5%] w-[500px] h-[500px] blur-glow-rose rounded-full pointer-events-none -z-10"></div>

      {/* left Sidebar for desktop/laptop with smooth slide and collapse transition */}
      <aside 
        className={`bg-[#0F172A] text-white flex-col justify-between select-none border-r border-slate-800/20 shrink-0 hidden md:flex sticky top-0 h-screen transition-all duration-300 ease-in-out ${
          desktopSidebarOpen ? 'w-64 p-6' : 'w-0 p-0 overflow-hidden border-r-0'
        }`}
      >
        <div className="flex flex-col h-full justify-between">
          <div>
            <div className="flex items-center gap-3 mb-10 whitespace-nowrap">
              <div className="w-10 h-10 bg-indigo-600 rounded-lg flex items-center justify-center font-bold text-xl text-white shadow-md shrink-0">
                TA
              </div>
              <div className="transition-opacity duration-200">
                <h1 className="text-lg font-bold tracking-tight">Titas Accounting</h1>
                <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Income-Expense Tracker</p>
              </div>
            </div>

            <nav className="space-y-1.5">
              {(currentUserProfile?.menuAccess?.showDashboard ?? true) && (
                <button
                  onClick={() => setActiveSection('dashboard')}
                  className={`w-full p-3 rounded-lg flex items-center gap-3 text-sm font-semibold transition-all cursor-pointer whitespace-nowrap ${
                    activeSection === 'dashboard'
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'
                  }`}
                >
                  <LayoutDashboard className="w-4.5 h-4.5 text-indigo-400 shrink-0" />
                  <span>Dashboard Summary</span>
                </button>
              )}

              {(currentUserProfile?.menuAccess?.showHistory ?? true) && (
                <button
                  onClick={() => setActiveSection('history')}
                  className={`w-full p-3 rounded-lg flex items-center gap-3 text-sm font-semibold transition-all cursor-pointer whitespace-nowrap ${
                    activeSection === 'history'
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'
                  }`}
                >
                  <Receipt className="w-4.5 h-4.5 text-rose-400 shrink-0" />
                  <span>Transaction List</span>
                </button>
              )}

              {(currentUserProfile?.menuAccess?.showHomeUser ?? true) && (
                <button
                  onClick={() => setActiveSection('home_user')}
                  className={`w-full p-3 rounded-lg flex items-center gap-3 text-sm font-semibold transition-all cursor-pointer whitespace-nowrap ${
                    activeSection === 'home_user'
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'
                  }`}
                >
                  <Users className="w-4.5 h-4.5 text-yellow-400 shrink-0" />
                  <span>Home User</span>
                </button>
              )}

              {(currentUserProfile?.menuAccess?.showReseller ?? true) && (
                <button
                  onClick={() => setActiveSection('reseller')}
                  className={`w-full p-3 rounded-lg flex items-center gap-3 text-sm font-semibold transition-all cursor-pointer whitespace-nowrap ${
                    activeSection === 'reseller'
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'
                  }`}
                >
                  <Users className="w-4.5 h-4.5 text-cyan-400 shrink-0" />
                  <span>Reseller</span>
                </button>
              )}

              {(currentUserProfile?.menuAccess?.showVoucher ?? true) && (
                <button
                  onClick={() => setActiveSection('voucher')}
                  className={`w-full p-3 rounded-lg flex items-center gap-3 text-sm font-semibold transition-all cursor-pointer whitespace-nowrap ${
                    activeSection === 'voucher'
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'
                  }`}
                >
                  <FileText className="w-4.5 h-4.5 text-rose-400 shrink-0" />
                  <span>Voucher</span>
                </button>
              )}

              {(currentUserProfile?.menuAccess?.showDailyClosing ?? true) && (
                <button
                  onClick={() => setActiveSection('daily_closing')}
                  className={`w-full p-3 rounded-lg flex items-center gap-3 text-sm font-semibold transition-all cursor-pointer whitespace-nowrap ${
                    activeSection === 'daily_closing'
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'
                  }`}
                >
                  <Calculator className="w-4.5 h-4.5 text-emerald-400 shrink-0" />
                  <span>Daily Closing</span>
                </button>
              )}

              {/* System Dropdown (Admin Only) */}
              {(!currentUserProfile || currentUserProfile.role === 'admin') && (
                <div className="space-y-1 pt-1.5 border-t border-slate-800/40">
                  <button
                    onClick={() => setSystemMenuOpen(!systemMenuOpen)}
                    className="w-full p-3 rounded-lg flex items-center justify-between text-sm font-semibold text-slate-400 hover:bg-slate-800 hover:text-slate-100 transition-all cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      <Settings className="w-4.5 h-4.5 text-indigo-400 shrink-0" />
                      <span>System</span>
                    </div>
                    <ChevronDown className={`w-3.5 h-3.5 text-slate-500 transition-transform duration-200 ${systemMenuOpen ? 'rotate-180' : ''}`} />
                  </button>
                  
                  {systemMenuOpen && (
                    <div className="pl-6 space-y-1">
                      <button
                        onClick={() => setActiveSection('system_users')}
                        className={`w-full p-2.5 rounded-lg flex items-center gap-2.5 text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                          activeSection === 'system_users'
                            ? 'bg-indigo-600 text-white shadow-sm'
                            : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-100'
                        }`}
                      >
                        <Users className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                        <span>App User</span>
                      </button>
                    </div>
                  )}
                </div>
              )}
            </nav>
          </div>

          {/* Profiler user tag at bottom */}
          <div className="mt-auto pt-4 border-t border-slate-800 flex flex-col gap-3 whitespace-nowrap">
            <div className="flex flex-col gap-1">
              <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Logged In:</span>
              <span className="text-xs text-slate-300 font-mono truncate">{user.email || ''}</span>
            </div>
            <button
              onClick={safeSignOut}
              className="w-full text-slate-400 hover:text-white hover:bg-slate-800 p-2.5 rounded-lg flex items-center justify-center gap-2 text-xs font-semibold transition cursor-pointer border border-slate-800 mt-2"
            >
              <LogOut className="w-3.5 h-3.5 text-rose-400 shrink-0" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Main Container Right column */}
      <main className="flex-1 flex flex-col h-screen overflow-y-auto overflow-x-hidden">
        {/* Dynamic header row matching high density aesthetic */}
        <header className="h-16 bg-white/95 backdrop-blur-sm border-b border-slate-200 px-6 flex items-center justify-between sticky top-0 z-30 select-none">
          <div className="flex items-center gap-4">
            {/* Hamburger/Slidebar toggle for desktop & mobile */}
            <button 
              onClick={() => {
                if (window.innerWidth < 768) {
                  setMobileMenuOpen(true);
                } else {
                  setDesktopSidebarOpen(!desktopSidebarOpen);
                }
              }}
              className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-600 cursor-pointer flex items-center justify-center transition-colors"
              title="Toggle Sidebar"
            >
              <Menu className="w-5 h-5" />
            </button>

            {/* Brand Logo & Name (visible on desktop/laptop when sidebar is collapsed) */}
            {!desktopSidebarOpen && (
              <div className="hidden md:flex items-center gap-2.5 mr-4 animate-fade-in">
                <div className="w-9 h-9 bg-indigo-600 rounded-lg flex items-center justify-center font-bold text-base text-white shadow-md">
                  TA
                </div>
                <div>
                  <h1 className="text-sm font-bold text-slate-800 tracking-tight leading-tight">Titas Accounting</h1>
                  <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider leading-none">Income-Expense Tracker</p>
                </div>
              </div>
            )}

            {/* Menu Options Dropdown for Laptop/Desktop View */}
            <div className="hidden md:block relative">
              <button
                onClick={() => setDropdownOpen(!dropdownOpen)}
                className="flex items-center gap-2.5 px-3.5 py-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 transition cursor-pointer select-none"
              >
                {activeSection === 'dashboard' && (
                  <>
                    <LayoutDashboard className="w-4 h-4 text-indigo-500 animate-pulse" />
                    <span>Dashboard Summary</span>
                  </>
                )}
                {activeSection === 'history' && (
                  <>
                    <Receipt className="w-4 h-4 text-rose-500" />
                    <span>Transaction List</span>
                  </>
                )}
                {activeSection === 'home_user' && (
                  <>
                    <Users className="w-4 h-4 text-yellow-500" />
                    <span>Home User</span>
                  </>
                )}
                {activeSection === 'reseller' && (
                  <>
                    <Users className="w-4 h-4 text-cyan-500" />
                    <span>Reseller</span>
                  </>
                )}
                {activeSection === 'voucher' && (
                  <>
                    <FileText className="w-4 h-4 text-rose-500" />
                    <span>Voucher</span>
                  </>
                )}
                {activeSection === 'daily_closing' && (
                  <>
                    <Calculator className="w-4 h-4 text-emerald-500" />
                    <span>Daily Closing</span>
                  </>
                )}
                {activeSection === 'system_users' && (
                  <>
                    <Settings className="w-4 h-4 text-indigo-500" />
                    <span>App User Control</span>
                  </>
                )}
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 ml-1" />
              </button>

              {/* Dropdown Options list */}
              {dropdownOpen && (
                <>
                  <div className="fixed inset-0 z-30" onClick={() => setDropdownOpen(false)}></div>
                  <div className="absolute left-0 mt-2 w-56 bg-white border border-slate-200 rounded-2xl shadow-xl py-1.5 z-40 animate-fade-in animate-scale-up">
                    {(currentUserProfile?.menuAccess?.showDashboard ?? true) && (
                      <button
                        onClick={() => { setActiveSection('dashboard'); setDropdownOpen(false); }}
                        className={`w-full px-4 py-2.5 text-left text-xs font-bold flex items-center gap-3 hover:bg-slate-50 transition cursor-pointer ${
                          activeSection === 'dashboard' ? 'text-indigo-600 bg-indigo-50/50' : 'text-slate-600'
                        }`}
                      >
                        <LayoutDashboard className="w-4 h-4 text-indigo-500" />
                        <span>Dashboard Summary</span>
                      </button>
                    )}
                    {(currentUserProfile?.menuAccess?.showHistory ?? true) && (
                      <button
                        onClick={() => { setActiveSection('history'); setDropdownOpen(false); }}
                        className={`w-full px-4 py-2.5 text-left text-xs font-bold flex items-center gap-3 hover:bg-slate-50 transition cursor-pointer ${
                          activeSection === 'history' ? 'text-indigo-600 bg-indigo-50/50' : 'text-slate-600'
                        }`}
                      >
                        <Receipt className="w-4 h-4 text-rose-500" />
                        <span>Transaction List</span>
                      </button>
                    )}
                    {(currentUserProfile?.menuAccess?.showHomeUser ?? true) && (
                      <button
                        onClick={() => { setActiveSection('home_user'); setDropdownOpen(false); }}
                        className={`w-full px-4 py-2.5 text-left text-xs font-bold flex items-center gap-3 hover:bg-slate-50 transition cursor-pointer ${
                          activeSection === 'home_user' ? 'text-indigo-600 bg-indigo-50/50' : 'text-slate-600'
                        }`}
                      >
                        <Users className="w-4 h-4 text-yellow-500" />
                        <span>Home User</span>
                      </button>
                    )}
                    {(currentUserProfile?.menuAccess?.showReseller ?? true) && (
                      <button
                        onClick={() => { setActiveSection('reseller'); setDropdownOpen(false); }}
                        className={`w-full px-4 py-2.5 text-left text-xs font-bold flex items-center gap-3 hover:bg-slate-50 transition cursor-pointer ${
                          activeSection === 'reseller' ? 'text-indigo-600 bg-indigo-50/50' : 'text-slate-600'
                        }`}
                      >
                        <Users className="w-4 h-4 text-cyan-500" />
                        <span>Reseller</span>
                      </button>
                    )}
                    {(currentUserProfile?.menuAccess?.showVoucher ?? true) && (
                      <button
                        onClick={() => { setActiveSection('voucher'); setDropdownOpen(false); }}
                        className={`w-full px-4 py-2.5 text-left text-xs font-bold flex items-center gap-3 hover:bg-slate-50 transition cursor-pointer ${
                          activeSection === 'voucher' ? 'text-indigo-600 bg-indigo-50/50' : 'text-slate-600'
                        }`}
                      >
                        <FileText className="w-4 h-4 text-rose-500" />
                        <span>Voucher</span>
                      </button>
                    )}
                    {(currentUserProfile?.menuAccess?.showDailyClosing ?? true) && (
                      <button
                        onClick={() => { setActiveSection('daily_closing'); setDropdownOpen(false); }}
                        className={`w-full px-4 py-2.5 text-left text-xs font-bold flex items-center gap-3 hover:bg-slate-50 transition cursor-pointer ${
                          activeSection === 'daily_closing' ? 'text-indigo-600 bg-indigo-50/50' : 'text-slate-600'
                        }`}
                      >
                        <Calculator className="w-4 h-4 text-emerald-500" />
                        <span>Daily Closing</span>
                      </button>
                    )}
                    {(!currentUserProfile || currentUserProfile.role === 'admin') && (
                      <button
                        onClick={() => { setActiveSection('system_users'); setDropdownOpen(false); }}
                        className={`w-full px-4 py-2.5 text-left text-xs font-bold flex items-center gap-3 hover:bg-slate-50 transition cursor-pointer ${
                          activeSection === 'system_users' ? 'text-indigo-600 bg-indigo-50/50' : 'text-slate-600'
                        }`}
                      >
                        <Users className="w-4 h-4 text-indigo-500" />
                        <span>App User</span>
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* Mobile View Title */}
            <h2 className="text-base font-bold text-slate-800 md:hidden">
              {activeSection === 'dashboard' && 'Dashboard Summary'}
              {activeSection === 'history' && 'Transaction List'}
              {activeSection === 'home_user' && 'Home User'}
              {activeSection === 'reseller' && 'Reseller'}
              {activeSection === 'voucher' && 'Voucher'}
              {activeSection === 'daily_closing' && 'Daily Closing'}
              {activeSection === 'system_users' && 'App User Control'}
            </h2>

            <span className="text-xs bg-slate-100 text-slate-500 px-2 py-1 rounded font-semibold hidden lg:inline-block">
              {new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <NotificationBell />
            {/* Desktop User profile details & Sign Out */}
            <div className="hidden md:flex items-center gap-3 pr-1">
              <div className="flex flex-col text-right">
                <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider leading-none">Logged In</span>
                <span className="text-xs text-slate-600 font-mono font-medium max-w-[150px] truncate">{user.email || ''}</span>
              </div>
              <button
                onClick={safeSignOut}
                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition cursor-pointer border border-slate-200 flex items-center justify-center"
                title="Sign Out"
              >
                <LogOut className="w-3.5 h-3.5 text-rose-400" />
              </button>
            </div>
          </div>
        </header>

        {/* Mobile Sidebar overlay */}
        {mobileMenuOpen && (
          <div 
            className="md:hidden fixed inset-0 bg-slate-900/60 z-50 flex" 
            onClick={() => setMobileMenuOpen(false)}
          >
            <div 
              className="w-64 bg-[#0F172A] text-white p-6 flex flex-col justify-between h-full" 
              onClick={(e) => e.stopPropagation()}
            >
              <div>
                <div className="flex items-center justify-between mb-8">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center font-bold text-white">TA</div>
                    <span className="font-bold">Titas Accounting</span>
                  </div>
                  <button onClick={() => setMobileMenuOpen(false)} className="text-slate-400 hover:text-white">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <nav className="space-y-2">
                  {(currentUserProfile?.menuAccess?.showDashboard ?? true) && (
                    <button
                      onClick={() => { setActiveSection('dashboard'); setMobileMenuOpen(false); }}
                      className={`w-full p-3 rounded-lg flex items-center gap-3 text-sm font-semibold transition-all ${
                        activeSection === 'dashboard' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:bg-slate-800'
                      }`}
                    >
                      <LayoutDashboard className="w-4 h-4" />
                      <span>Dashboard Summary</span>
                    </button>
                  )}
                  {(currentUserProfile?.menuAccess?.showHistory ?? true) && (
                    <button
                      onClick={() => { setActiveSection('history'); setMobileMenuOpen(false); }}
                      className={`w-full p-3 rounded-lg flex items-center gap-3 text-sm font-semibold transition-all ${
                        activeSection === 'history' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:bg-slate-800'
                      }`}
                    >
                      <Receipt className="w-4 h-4" />
                      <span>Transaction List</span>
                    </button>
                  )}
                  {(currentUserProfile?.menuAccess?.showHomeUser ?? true) && (
                    <button
                      onClick={() => { setActiveSection('home_user'); setMobileMenuOpen(false); }}
                      className={`w-full p-3 rounded-lg flex items-center gap-3 text-sm font-semibold transition-all ${
                        activeSection === 'home_user' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:bg-slate-800'
                      }`}
                    >
                      <Users className="w-4 h-4 text-yellow-400" />
                      <span>Home User</span>
                    </button>
                  )}
                  {(currentUserProfile?.menuAccess?.showReseller ?? true) && (
                    <button
                      onClick={() => { setActiveSection('reseller'); setMobileMenuOpen(false); }}
                      className={`w-full p-3 rounded-lg flex items-center gap-3 text-sm font-semibold transition-all ${
                        activeSection === 'reseller' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:bg-slate-800'
                      }`}
                    >
                      <Users className="w-4 h-4 text-cyan-400" />
                      <span>Reseller</span>
                    </button>
                  )}
                  {(currentUserProfile?.menuAccess?.showVoucher ?? true) && (
                    <button
                      onClick={() => { setActiveSection('voucher'); setMobileMenuOpen(false); }}
                      className={`w-full p-3 rounded-lg flex items-center gap-3 text-sm font-semibold transition-all ${
                        activeSection === 'voucher' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:bg-slate-800'
                      }`}
                    >
                      <FileText className="w-4 h-4 text-rose-400" />
                      <span>Voucher</span>
                    </button>
                  )}
                  {(currentUserProfile?.menuAccess?.showDailyClosing ?? true) && (
                    <button
                      onClick={() => { setActiveSection('daily_closing'); setMobileMenuOpen(false); }}
                      className={`w-full p-3 rounded-lg flex items-center gap-3 text-sm font-semibold transition-all ${
                        activeSection === 'daily_closing' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:bg-slate-800'
                      }`}
                    >
                      <Calculator className="w-4 h-4 text-emerald-400" />
                      <span>Daily Closing</span>
                    </button>
                  )}

                  {/* System Dropdown (Admin Only) */}
                  {(!currentUserProfile || currentUserProfile.role === 'admin') && (
                    <div className="space-y-1 pt-1 border-t border-slate-800/40">
                      <button
                        onClick={() => setSystemMenuOpen(!systemMenuOpen)}
                        className="w-full p-3 rounded-lg flex items-center justify-between text-sm font-semibold text-slate-400 hover:bg-slate-800 hover:text-slate-100 transition-all cursor-pointer"
                      >
                        <div className="flex items-center gap-3">
                          <Settings className="w-4 h-4 text-indigo-400 shrink-0" />
                          <span>System</span>
                        </div>
                        <ChevronDown className={`w-3.5 h-3.5 text-slate-500 transition-transform duration-200 ${systemMenuOpen ? 'rotate-180' : ''}`} />
                      </button>
                      
                      {systemMenuOpen && (
                        <div className="pl-6 space-y-1">
                          <button
                            onClick={() => { setActiveSection('system_users'); setMobileMenuOpen(false); }}
                            className={`w-full p-2.5 rounded-lg flex items-center gap-2.5 text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                              activeSection === 'system_users'
                                ? 'bg-indigo-600 text-white shadow-sm'
                                : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-100'
                            }`}
                          >
                            <Users className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                            <span>App User</span>
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </nav>
              </div>
              <button
                onClick={safeSignOut}
                className="w-full text-slate-400 hover:text-white hover:bg-slate-800 p-3 rounded-lg flex items-center gap-3 text-sm font-semibold transition cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        )}

        {/* Content canvas with perfect margins and grids */}
        <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6">
          {/* Section 1: Dashboard overview */}
          {activeSection === 'dashboard' && (
            <div className="w-full space-y-6 animate-fade-in">
              <BudgetSummary 
                transactions={approvedOrStandardTransactions} 
                resellers={resellers} 
                allTransactions={transactions} 
              />
              {/* Graphs & Breakdowns */}
              <div className="space-y-6">
                <GraphicalReports transactions={approvedOrStandardTransactions} />
                <PaymentMethodBreakdown transactions={approvedOrStandardTransactions} />
              </div>
            </div>
          )}

          {/* Section 2: Unified list table views with floating entry point */}
          {activeSection === 'history' && (
            <div className="w-full animate-fade-in">
              <TransactionList 
                transactions={approvedOrStandardTransactions} 
                onDeleteTransaction={handleDeleteTransaction} 
                onDeleteAllTransactions={handleDeleteAllTransactions} 
              />
            </div>
          )}

          {/* Section 5: Home user subscriber list portal */}
          {activeSection === 'home_user' && (
            <HomeUserSection userId={user.uid} onAddTransaction={handleAddTransaction} transactions={transactions} currentUserProfile={currentUserProfile} />
          )}

          {/* Section 5 Duplicate: Reseller subscriber list portal */}
          {activeSection === 'reseller' && (
            <ResellerSection userId={user.uid} onAddTransaction={handleAddTransaction} transactions={transactions} currentUserProfile={currentUserProfile} />
          )}

          {/* Section 6: Voucher expense requests list and workflow */}
          {activeSection === 'voucher' && (
            <VoucherSection userId={user.uid} onAddTransaction={handleAddTransaction} currentUserProfile={currentUserProfile} />
          )}

          {/* Section 7: Daily closing audit and locked states */}
          {activeSection === 'daily_closing' && (
            <DailyClosingSection userId={user.uid} transactions={transactions} currentUserProfile={currentUserProfile} />
          )}

          {/* Section 8: System Users & RBAC Administrative dashboard */}
          {activeSection === 'system_users' && (
            <SystemUsersSection currentUserId={user.uid} />
          )}
        </div>

        {/* Humid and clean editorial footer */}
        <footer className="px-8 py-4 text-center text-slate-400 text-xs border-t border-slate-200/50 bg-white">
          <p className="font-sans">© 2026 Titas Accounting Software | Secure, Offline-Ready Local Data Inventory.</p>
        </footer>
      </main>
    </div>
  );
}
