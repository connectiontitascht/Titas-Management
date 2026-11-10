import React, { useState, useEffect } from 'react';
import { 
  Calculator, 
  Calendar, 
  CheckCircle, 
  Lock, 
  Unlock, 
  Printer, 
  TrendingUp, 
  TrendingDown, 
  Coins, 
  AlertCircle,
  FileText,
  Search,
  Check,
  Plus,
  Trash2,
  PlusCircle,
  Edit,
  FileDown,
  Filter,
  MoreVertical
} from 'lucide-react';
import { 
  collection, 
  doc, 
  setDoc, 
  deleteDoc, 
  query, 
  where, 
  orderBy,
  onSnapshot, 
  getDoc,
  getDocFromServer,
  serverTimestamp
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { Transaction, DailyClosing, ExpenseCategory, EXPENSE_CATEGORY_LABELS, AppUser } from '../types';
import { PaymentMethodLogo } from './PaymentLogos';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

interface DailyClosingSectionProps {
  userId: string;
  transactions: Transaction[];
  currentUserProfile?: AppUser | null;
}

export function DailyClosingSection({ userId, transactions, currentUserProfile }: DailyClosingSectionProps) {
  const [closings, setClosings] = useState<DailyClosing[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });

  // Opening balance inputs (States)
  const [openingCash, setOpeningCash] = useState<string>('0');
  const [openingBkash, setOpeningBkash] = useState<string>('0');
  const [openingNagad, setOpeningNagad] = useState<string>('0');
  const [openingRocket, setOpeningRocket] = useState<string>('0');
  const [openingBank, setOpeningBank] = useState<string>('0');
  const [openingSsl, setOpeningSsl] = useState<string>('0');

  // Cash Drawer statement inputs (States)
  const [khaOfficeCash, setKhaOfficeCash] = useState<string>('0');
  const [dhakaOfficeCash, setDhakaOfficeCash] = useState<string>('0');
  const [nayanCash, setNayanCash] = useState<string>('0');
  const [accountCash, setAccountCash] = useState<string>('0');

  const [transferKhaToNayan, setTransferKhaToNayan] = useState<string>('0');
  const [transferNayanToDhaka, setTransferNayanToDhaka] = useState<string>('0');
  const [transferDhakaToNayan, setTransferDhakaToNayan] = useState<string>('0');
  const [transferDhakaToKha, setTransferDhakaToKha] = useState<string>('0');

  const [notes, setNotes] = useState<string>('');
  const [isDrawerSubmitted, setIsDrawerSubmitted] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');
  const lastDateRef = React.useRef<string>('');
  
  // Modal viewer
  const [selectedClosing, setSelectedClosing] = useState<DailyClosing | null>(null);
  const [printPreviewData, setPrintPreviewData] = useState<DailyClosing | null>(null);

  // Entry Statement form states
  const [entryCategory, setEntryCategory] = useState<string>('customer_bill');
  const [entryAmount, setEntryAmount] = useState<string>('');
  const [entryPaymentMethod, setEntryPaymentMethod] = useState<string>('cash');

  // Expense Entry Statement form states
  const [expenseCategory, setExpenseCategory] = useState<string>('bandwidth_bill');
  const [expenseAmount, setExpenseAmount] = useState<string>('');
  const [expensePaymentMethod, setExpensePaymentMethod] = useState<string>('cash');

  // Editing Transaction Modal form states
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [editingTxCategory, setEditingTxCategory] = useState<string>('');
  const [editingTxAmount, setEditingTxAmount] = useState<string>('');
  const [editingTxPaymentMethod, setEditingTxPaymentMethod] = useState<string>('');

  // Custom confirmation modal state
  const [confirmModal, setConfirmModal] = useState<{
    message: string;
    description?: string;
    onConfirm: () => void;
  } | null>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  // Filters for Daily Closing Historical Logs (similar to transaction list)
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'income' | 'expense'>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [quickDateFilter, setQuickDateFilter] = useState<string>('all');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest');

  // 1. Fetch closing history for list view
  useEffect(() => {
    const q = query(
      collection(db, 'daily_closings'),
      where('userId', '==', userId),
      orderBy('date', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: DailyClosing[] = [];
      snapshot.forEach((doc) => {
        list.push(doc.data() as DailyClosing);
      });
      setClosings(list);
      setLoading(false);
    }, (err) => {
      console.error('Error fetching daily closings:', err);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [userId]);

  // 2. Automated previous-day closing balance retrieval & current closed data loading
  useEffect(() => {
    const fetchClosingAndPrep = async () => {
      try {
        setError('');
        
        // 1. Check if selected date is already closed
        const todayDocId = `dc_${userId}_${selectedDate}`;
        const todayDocRef = doc(db, 'daily_closings', todayDocId);
        const todayDocSnap = await getDocFromServer(todayDocRef);
        
        if (todayDocSnap.exists()) {
          const todayData = todayDocSnap.data() as DailyClosing;
          // Load saved inputs only if date changed!
          if (lastDateRef.current !== selectedDate) {
            setOpeningCash((todayData.openingCash ?? 0).toString());
            setOpeningBkash((todayData.openingBkash ?? 0).toString());
            setOpeningNagad((todayData.openingNagad ?? 0).toString());
            setOpeningRocket((todayData.openingRocket ?? 0).toString());
            setOpeningBank((todayData.openingBank ?? 0).toString());
            setOpeningSsl((todayData.openingSsl ?? 0).toString());
            
            setKhaOfficeCash((todayData.khaOfficeCash ?? 0).toString());
            setDhakaOfficeCash((todayData.dhakaOfficeCash ?? 0).toString());
            setNayanCash((todayData.nayanCash ?? 0).toString());
            setAccountCash((todayData.accountCash ?? 0).toString());
            
            setTransferKhaToNayan((todayData.transferKhaToNayan ?? 0).toString());
            setTransferNayanToDhaka((todayData.transferNayanToDhaka ?? 0).toString());
            setTransferDhakaToNayan((todayData.transferDhakaToNayan ?? 0).toString());
            setTransferDhakaToKha((todayData.transferDhakaToKha ?? 0).toString());
            setIsDrawerSubmitted(!!todayData.isDrawerSubmitted);
          }
          lastDateRef.current = selectedDate;
          if (todayData.status === 'closed') {
            return; // Done
          }
        }

        // 2. If open, retrieve previous day's closing
        const currentDate = new Date(selectedDate);
        if (isNaN(currentDate.getTime())) return;
        
        currentDate.setDate(currentDate.getDate() - 1);
        const prevDateString = currentDate.toISOString().split('T')[0];

        const prevDocId = `dc_${userId}_${prevDateString}`;
        const prevDocRef = doc(db, 'daily_closings', prevDocId);
        const prevDocSnap = await getDoc(prevDocRef);

        if (prevDocSnap.exists()) {
          const prevData = prevDocSnap.data() as DailyClosing;
          // Pre-populate today's opening balance with yesterday's closing balance
          setOpeningCash((prevData.closingCash ?? 0).toString());
          setOpeningBkash((prevData.closingBkash ?? 0).toString());
          setOpeningNagad((prevData.closingNagad ?? 0).toString());
          setOpeningRocket((prevData.closingRocket ?? 0).toString());
          setOpeningBank((prevData.closingBank ?? 0).toString());
          setOpeningSsl((prevData.closingSsl ?? 0).toString());
          setSuccess(`Opening balance has been loaded from the previous day's (${prevDateString}) closing balance.`);
          setTimeout(() => setSuccess(''), 5000);
        } else {
          // Reset if no closing found
          setOpeningCash('0');
          setOpeningBkash('0');
          setOpeningNagad('0');
          setOpeningRocket('0');
          setOpeningBank('0');
          setOpeningSsl('0');
        }

        // Only reset Cash Drawer inputs if the selected date has changed!
        if (lastDateRef.current !== selectedDate) {
          setKhaOfficeCash('0');
          setDhakaOfficeCash('0');
          setNayanCash('0');
          setAccountCash('0');
          
          setTransferKhaToNayan('0');
          setTransferNayanToDhaka('0');
          setTransferDhakaToNayan('0');
          setTransferDhakaToKha('0');
          setIsDrawerSubmitted(false);
        }
        lastDateRef.current = selectedDate;
      } catch (err) {
        console.error('Error fetching closing data:', err);
      }
    };

    fetchClosingAndPrep();
  }, [selectedDate, userId, closings]);

  // 3. Process current date transactions (dynamic aggregates)
  const dateTransactions = transactions.filter(t => t.date === selectedDate);
  
  // Aggregate functions by payment method
  const getAggregates = (method: string) => {
    const methodTransactions = dateTransactions.filter(t => {
      const pm = (t.paymentMethod || 'cash').trim().toLowerCase();
      if (method === 'cash') {
        return pm === 'cash' || !t.paymentMethod;
      }
      return pm === method;
    });

    const income = methodTransactions
      .filter(t => t.type === 'income')
      .reduce((sum, t) => sum + t.amount, 0);

    const expense = methodTransactions
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + t.amount, 0);

    return { income, expense };
  };

  const cashFlow = getAggregates('cash');
  const bkashFlow = getAggregates('bkash');
  const nagadFlow = getAggregates('nagad');
  const rocketFlow = getAggregates('rocket');
  const bankFlow = getAggregates('bank');
  const sslFlow = getAggregates('sslcommerz');

  // Parse helper
  const val = (s: string) => {
    const n = parseFloat(s);
    return isNaN(n) ? 0 : n;
  };

  // Closing calculations
  const closingCash = val(openingCash) + cashFlow.income - cashFlow.expense;
  const closingBkash = val(openingBkash) + bkashFlow.income - bkashFlow.expense;
  const closingNagad = val(openingNagad) + nagadFlow.income - nagadFlow.expense;
  const closingRocket = val(openingRocket) + rocketFlow.income - rocketFlow.expense;
  const closingBank = val(openingBank) + bankFlow.income - bankFlow.expense;
  const closingSsl = val(openingSsl) + sslFlow.income - sslFlow.expense;

  const totalOpening = val(openingCash) + val(openingBkash) + val(openingNagad) + val(openingRocket) + val(openingBank) + val(openingSsl);
  const totalInflow = cashFlow.income + bkashFlow.income + nagadFlow.income + rocketFlow.income + bankFlow.income + sslFlow.income;
  const totalOutflow = cashFlow.expense + bkashFlow.expense + nagadFlow.expense + rocketFlow.expense + bankFlow.expense + sslFlow.expense;
  const totalClosing = closingCash + closingBkash + closingNagad + closingRocket + closingBank + closingSsl;

  // Helper to retrieve the opening balance of a payment method
  const getPreviousBalanceForMethod = (method: string): number => {
    switch (method.toLowerCase()) {
      case 'cash': return val(openingCash);
      case 'bkash': return val(openingBkash);
      case 'nagad': return val(openingNagad);
      case 'rocket': return val(openingRocket);
      case 'bank': return val(openingBank);
      case 'sslcommerz': return val(openingSsl);
      default: return 0;
    }
  };

  const entryPreviousBalance = getPreviousBalanceForMethod(entryPaymentMethod);
  const entryClosingBalance = entryPreviousBalance + (parseFloat(entryAmount) || 0);

  const getPrevBalanceForTx = (tx: Transaction): number => {
    const method = (tx.paymentMethod || 'cash').toLowerCase();
    
    if (tx.date === selectedDate) {
      return getPreviousBalanceForMethod(method);
    }

    const priorClosings = closings
      .filter(c => c.date < tx.date)
      .sort((a, b) => b.date.localeCompare(a.date));

    if (priorClosings.length > 0) {
      const lastClosing = priorClosings[0];
      switch (method) {
        case 'cash': return lastClosing.closingCash;
        case 'bkash': return lastClosing.closingBkash;
        case 'nagad': return lastClosing.closingNagad;
        case 'rocket': return lastClosing.closingRocket;
        case 'bank': return lastClosing.closingBank;
        case 'sslcommerz': return lastClosing.closingSsl;
        default: return 0;
      }
    }

    return 0;
  };

  const getCategoryLabel = (tx: Transaction) => {
    if (tx.type === 'income') {
      const incomeLabels: Record<string, string> = {
        customer_bill: 'Customer Bill Collection',
        reseller_bill: 'Reseller Bill Collection',
        service_charge: 'Service Charge Collection',
        other_income: 'Other Income',
      };
      return incomeLabels[tx.category] || tx.category;
    } else {
      return EXPENSE_CATEGORY_LABELS[tx.category as ExpenseCategory]?.label || tx.category;
    }
  };

  const filteredDailyClosingTxs = (transactions || [])
    .filter(t => t.isDailyClosing === true)
    .filter(t => {
      // 1. Search filter
      const categoryLabel = getCategoryLabel(t).toLowerCase();
      const notesLower = (t.notes || '').toLowerCase();
      const titleLower = (t.title || '').toLowerCase();
      const pmLower = (t.paymentMethod || 'cash').toLowerCase();
      const searchLower = searchTerm.toLowerCase();

      const matchesSearch = 
        categoryLabel.includes(searchLower) ||
        notesLower.includes(searchLower) ||
        titleLower.includes(searchLower) ||
        pmLower.includes(searchLower) ||
        t.amount.toString().includes(searchLower) ||
        t.date.includes(searchLower);

      // 2. Type Filter (income / expense)
      const matchesType = typeFilter === 'all' ? true : t.type === typeFilter;

      // 3. Category Filter
      const matchesCategory = categoryFilter === 'all' ? true : t.category === categoryFilter;

      // 4. Date Filter
      let matchesDate = true;
      if (quickDateFilter === 'today') {
        const todayStr = new Date().toISOString().split('T')[0];
        matchesDate = t.date === todayStr;
      } else if (quickDateFilter === 'this-month') {
        const now = new Date();
        const currentYearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        matchesDate = t.date.startsWith(currentYearMonth);
      } else if (quickDateFilter === 'last-month') {
        const now = new Date();
        let year = now.getFullYear();
        let month = now.getMonth(); // previous month index
        if (month === 0) {
          month = 12;
          year = year - 1;
        }
        const lastYearMonth = `${year}-${String(month).padStart(2, '0')}`;
        matchesDate = t.date.startsWith(lastYearMonth);
      } else if (quickDateFilter === 'custom') {
        if (startDate) {
          matchesDate = matchesDate && t.date >= startDate;
        }
        if (endDate) {
          matchesDate = matchesDate && t.date <= endDate;
        }
      }

      return matchesSearch && matchesType && matchesCategory && matchesDate;
    });

  // Sort daily closing transactions based on user selection
  const dailyClosingTxs = [...filteredDailyClosingTxs].sort((a, b) => {
    if (sortOrder === 'newest') {
      if (b.date !== a.date) {
        return b.date.localeCompare(a.date);
      }
      const timeA = a.createdAt || '';
      const timeB = b.createdAt || '';
      return timeB.localeCompare(timeA);
    } else {
      if (a.date !== b.date) {
        return a.date.localeCompare(b.date);
      }
      const timeA = a.createdAt || '';
      const timeB = b.createdAt || '';
      return timeA.localeCompare(timeB);
    }
  });

  const handleExportCSVLogs = () => {
    const headers = ['SL', 'Date', 'Category', 'Payment Method', 'Type', 'Amount (BDT)', 'Previous Balance (BDT)', 'Closing Balance (BDT)', 'Notes'];
    const csvContent = [
      headers.join(','),
      ...dailyClosingTxs.map((tx, idx) => {
        const prevBal = getPrevBalanceForTx(tx);
        const closingBal = tx.type === 'income' ? prevBal + tx.amount : prevBal - tx.amount;
        const categoryLabel = getCategoryLabel(tx);
        return [
          idx + 1,
          `"${tx.date}"`,
          `"${categoryLabel.replace(/"/g, '""')}"`,
          `"${(tx.paymentMethod || 'cash').toUpperCase()}"`,
          `"${tx.type.toUpperCase()}"`,
          tx.amount,
          prevBal,
          closingBal,
          `"${(tx.notes || '').replace(/"/g, '""')}"`
        ].join(',');
      })
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `daily_closing_logs_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDownloadPDFLogs = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Please disable your browser popup blocker and try again.');
      return;
    }

    const dateText = 
      quickDateFilter === 'today' ? 'Today\'s Logs' :
      quickDateFilter === 'this-month' ? 'Current Month Logs' :
      quickDateFilter === 'last-month' ? 'Previous Month Logs' :
      quickDateFilter === 'custom' ? `Period: ${startDate || 'Start'} to ${endDate || 'End'}` : 
      'All Time Logs';

    const typeText = 
      typeFilter === 'income' ? ' (Income Only)' :
      typeFilter === 'expense' ? ' (Expense Only)' : '';

    const totalIncome = dailyClosingTxs
      .filter((t) => t.type === 'income')
      .reduce((sum, t) => sum + t.amount, 0);
    const totalExpense = dailyClosingTxs
      .filter((t) => t.type === 'expense')
      .reduce((sum, t) => sum + t.amount, 0);
    const netBalance = totalIncome - totalExpense;

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Titas_Internet_Daily_Closing_Logs_${new Date().toISOString().split('T')[0]}</title>
          <meta charset="utf-8">
          <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
          <script src="https://cdn.tailwindcss.com"></script>
          <style>
            body {
              font-family: 'Inter', sans-serif;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            @media print {
              .no-print { display: none !important; }
              body { padding: 0; margin: 0; background: white; }
              @page { size: portrait; margin: 10mm; }
            }
          </style>
        </head>
        <body class="bg-slate-50 text-slate-800 p-4 md:p-8">
          <div class="max-w-[1000px] w-full mx-auto bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-slate-100">
            
            <div class="no-print flex justify-between items-center bg-indigo-50 p-4 rounded-xl border border-indigo-100 mb-8">
              <div class="flex items-center gap-2">
                <span class="flex h-2 w-2 relative">
                  <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                  <span class="relative inline-flex rounded-full h-2 w-2 bg-indigo-600"></span>
                </span>
                <span class="text-xs font-bold text-indigo-800">Daily Closing Logs Report Preview</span>
              </div>
              <div class="flex gap-2.5">
                <button onclick="window.print()" class="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs px-4 py-2 rounded-lg cursor-pointer shadow-sm transition">
                  🖨️ Print Report / Save PDF
                </button>
                <button onclick="window.close()" class="bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-xs px-4 py-2 rounded-lg cursor-pointer transition">
                  Close
                </button>
              </div>
            </div>

            <div class="flex flex-col md:flex-row justify-between items-start md:items-center border-b-2 border-slate-100 pb-6 mb-8 gap-4">
              <div>
                <h1 class="text-2xl font-bold text-slate-900 tracking-tight">Titas Internet</h1>
                <p class="text-xs font-semibold text-slate-500 mt-1">Daily Closing & Accounts Statement Logs</p>
                <p class="text-[11px] text-slate-400 font-medium mt-0.5">Generated on: ${new Date().toLocaleString('en-US', { hour12: true })}</p>
              </div>
              <div class="md:text-right">
                <span class="inline-flex items-center gap-1.5 px-3.5 py-2 bg-indigo-50/70 border border-indigo-100/60 rounded-xl text-xs font-bold text-indigo-700">
                  📅 ${dateText}${typeText}
                </span>
              </div>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
              <div class="p-4 rounded-xl border border-emerald-100 bg-emerald-50/20 text-left">
                <span class="text-[11px] font-bold text-emerald-700 uppercase tracking-wider block">Total Daily Inflows (+)</span>
                <h3 class="text-xl font-extrabold text-emerald-800 mt-1">৳ ${totalIncome.toLocaleString()}</h3>
              </div>

              <div class="p-4 rounded-xl border border-rose-100 bg-rose-50/20 text-left">
                <span class="text-[11px] font-bold text-rose-700 uppercase tracking-wider block">Total Daily Outflows (-)</span>
                <h3 class="text-xl font-extrabold text-rose-800 mt-1">৳ ${totalExpense.toLocaleString()}</h3>
              </div>

              <div class="p-4 rounded-xl border border-indigo-100 bg-indigo-50/20 text-left">
                <span class="text-[11px] font-bold text-indigo-700 uppercase tracking-wider block">Net Balance Flow (=)</span>
                <h3 class="text-xl font-extrabold text-indigo-800 mt-1">৳ ${netBalance.toLocaleString()}</h3>
              </div>
            </div>

            <div class="mb-8 overflow-x-auto">
              <h3 class="text-xs font-bold text-slate-700 mb-3 border-b pb-1.5 uppercase tracking-wider">📝 Daily Closing Logs Statement</h3>
              <table class="w-full text-left text-[11px] border-collapse min-w-[800px]">
                <thead>
                  <tr class="bg-slate-50 text-slate-500 font-bold border-b border-slate-200">
                    <th class="py-2.5 px-3">S/L</th>
                    <th class="py-2.5 px-3">Date</th>
                    <th class="py-2.5 px-3">Category</th>
                    <th class="py-2.5 px-3">Payment Method</th>
                    <th class="py-2.5 px-3 text-right">Income / Expense</th>
                    <th class="py-2.5 px-3 text-right">Previous Balance</th>
                    <th class="py-2.5 px-3 text-right">Closing Balance</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-slate-100">
                  ${dailyClosingTxs.length === 0 ? `
                    <tr>
                      <td colspan="7" class="py-8 text-center text-slate-400 font-bold">No daily closing transactions found for the selected criteria.</td>
                    </tr>
                  ` : dailyClosingTxs.map((tx, idx) => {
                    const prevBal = getPrevBalanceForTx(tx);
                    const closingBal = tx.type === 'income' ? prevBal + tx.amount : prevBal - tx.amount;
                    const catLabel = getCategoryLabel(tx);
                    const isInc = tx.type === 'income';

                    return `
                      <tr class="hover:bg-slate-50/30">
                        <td class="py-2.5 px-3 text-slate-500 font-semibold font-mono">${idx + 1}</td>
                        <td class="py-2.5 px-3 text-slate-500 font-semibold font-mono whitespace-nowrap">${tx.date}</td>
                        <td class="py-2.5 px-3 font-bold text-slate-800">${catLabel}</td>
                        <td class="py-2.5 px-3 whitespace-nowrap">
                          <span class="inline-block bg-slate-100 text-slate-600 text-[10px] font-bold px-1.5 py-0.5 rounded uppercase font-mono">
                            ${tx.paymentMethod || 'cash'}
                          </span>
                        </td>
                        <td class="py-2.5 px-3 text-right font-bold font-mono whitespace-nowrap ${isInc ? 'text-emerald-600' : 'text-rose-600'}">
                          ${isInc ? '+' : '-'} ৳ ${tx.amount.toLocaleString()}
                        </td>
                        <td class="py-2.5 px-3 text-right font-mono text-slate-500">৳ ${prevBal.toLocaleString()}</td>
                        <td class="py-2.5 px-3 text-right font-extrabold font-mono text-indigo-900">৳ ${closingBal.toLocaleString()}</td>
                      </tr>
                    `;
                  }).join('')}
                </tbody>
              </table>
            </div>

            <div class="grid grid-cols-2 gap-12 pt-10 border-t border-dashed border-slate-300 mt-12">
              <div class="text-center">
                <div class="w-36 border-b border-slate-400 mx-auto mb-1.5 h-8"></div>
                <p class="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Accountant Signature</p>
              </div>
              <div class="text-center">
                <div class="w-36 border-b border-slate-400 mx-auto mb-1.5 h-8"></div>
                <p class="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Approving Officer Signature</p>
              </div>
            </div>

          </div>

          <script>
            window.onload = function() {
              setTimeout(function() {
                window.print();
              }, 400);
            }
          </script>
        </body>
      </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  const handlePrintLogsSummary = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Please disable your browser popup blocker and try again.');
      return;
    }

    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonthNumber = now.getMonth() + 1;
    const currentYearMonth = `${currentYear}-${String(currentMonthNumber).padStart(2, '0')}`;
    
    const monthNamesEnglish = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    const currentMonthNameEnglish = monthNamesEnglish[now.getMonth()];

    const totalIncome = dailyClosingTxs
      .filter((t) => t.type === 'income')
      .reduce((sum, t) => sum + t.amount, 0);
    const totalExpense = dailyClosingTxs
      .filter((t) => t.type === 'expense')
      .reduce((sum, t) => sum + t.amount, 0);
    const netBalance = totalIncome - totalExpense;

    const methodFlows: { [key: string]: { income: number; expense: number } } = {};
    dailyClosingTxs.forEach(t => {
      const pm = (t.paymentMethod || 'cash').toUpperCase();
      if (!methodFlows[pm]) {
        methodFlows[pm] = { income: 0, expense: 0 };
      }
      if (t.type === 'income') {
        methodFlows[pm].income += t.amount;
      } else {
        methodFlows[pm].expense += t.amount;
      }
    });

    const methodSummaryList = Object.entries(methodFlows).map(([method, data]) => ({
      method,
      income: data.income,
      expense: data.expense
    }));

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Daily_Closing_Summary_${currentYearMonth}</title>
          <meta charset="utf-8">
          <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
          <script src="https://cdn.tailwindcss.com"></script>
          <style>
            body {
              font-family: 'Inter', sans-serif;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            @media print {
              .no-print { display: none !important; }
              body { padding: 0; margin: 0; background: white; }
              @page { size: portrait; margin: 10mm; }
            }
          </style>
        </head>
        <body class="bg-slate-50 text-slate-800 p-4 md:p-8">
          <div class="max-w-[800px] w-full mx-auto bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-slate-100">
            
            <div class="no-print flex justify-between items-center bg-emerald-50 p-4 rounded-xl border border-emerald-100 mb-8">
              <span class="text-xs font-bold text-emerald-800">Monthly Closing Summary Report Preview</span>
              <div class="flex gap-2">
                <button onclick="window.print()" class="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-4 py-2 rounded-lg cursor-pointer shadow-sm transition">
                  🖨️ Print
                </button>
                <button onclick="window.close()" class="bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-xs px-4 py-2 rounded-lg cursor-pointer transition">
                  Close
                </button>
              </div>
            </div>

            <div class="text-center border-b-2 border-slate-100 pb-6 mb-8">
              <h1 class="text-2xl font-extrabold text-slate-900">TITAS ISP SYSTEM</h1>
              <p class="text-xs font-semibold text-slate-500 mt-1">Monthly Transaction and Daily Closing Summary Report</p>
              <span class="inline-block mt-3 bg-indigo-50 text-indigo-700 font-bold text-[11px] px-3.5 py-1.5 rounded-full uppercase">
                Summary of ${currentMonthNameEnglish} ${currentYear}
              </span>
            </div>

            <div class="grid grid-cols-2 gap-4 mb-8">
              <div class="p-4 bg-slate-50 border border-slate-200/60 rounded-xl text-xs">
                <span class="text-slate-400 font-bold block uppercase mb-1">Report Period</span>
                <span class="font-extrabold text-slate-800 text-sm">${currentMonthNameEnglish} - ${currentYear}</span>
              </div>
              <div class="p-4 bg-slate-50 border border-slate-200/60 rounded-xl text-xs">
                <span class="text-slate-400 font-bold block uppercase mb-1">Print Timestamp</span>
                <span class="font-extrabold text-slate-800 text-sm">${new Date().toLocaleString('en-US', { hour12: true })}</span>
              </div>
            </div>

            <div class="grid grid-cols-3 gap-4 mb-8">
              <div class="p-4 bg-emerald-50 border border-emerald-100 rounded-xl">
                <span class="text-[10px] font-bold text-emerald-700 uppercase tracking-wider block">Total Inflow (+)</span>
                <span class="text-base font-black text-emerald-800 mt-1 block">BDT ${totalIncome.toLocaleString()}</span>
              </div>
              <div class="p-4 bg-rose-50 border border-rose-100 rounded-xl">
                <span class="text-[10px] font-bold text-rose-700 uppercase tracking-wider block">Total Outflow (-)</span>
                <span class="text-base font-black text-rose-800 mt-1 block">BDT ${totalExpense.toLocaleString()}</span>
              </div>
              <div class="p-4 bg-indigo-50 border border-indigo-100 rounded-xl">
                <span class="text-[10px] font-bold text-indigo-700 uppercase tracking-wider block">Net Balance (=)</span>
                <span class="text-base font-black text-indigo-800 mt-1 block">BDT ${netBalance.toLocaleString()}</span>
              </div>
            </div>

            <h3 class="text-xs font-bold text-slate-700 mb-3 uppercase tracking-wider">💳 Method-Wise Summary Breakdown</h3>
            <table class="w-full text-left text-[11px] border-collapse border border-slate-200 rounded-xl overflow-hidden mb-8">
              <thead>
                <tr class="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold">
                  <th class="py-2.5 px-3">Payment Method</th>
                  <th class="py-2.5 px-3 text-right">Inflow (+)</th>
                  <th class="py-2.5 px-3 text-right">Outflow (-)</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100">
                ${methodSummaryList.length === 0 ? `
                  <tr>
                    <td colspan="3" class="py-6 text-center text-slate-400 font-bold">No payment method records found.</td>
                  </tr>
                ` : methodSummaryList.map(item => `
                  <tr>
                    <td class="py-2.5 px-3 font-bold text-slate-800">${item.method}</td>
                    <td class="py-2.5 px-3 text-right font-bold text-emerald-600">BDT ${item.income.toLocaleString()}</td>
                    <td class="py-2.5 px-3 text-right font-bold text-rose-600">BDT ${item.expense.toLocaleString()}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>

            <h3 class="text-xs font-bold text-slate-700 mb-3 uppercase tracking-wider">📝 Detailed Logs</h3>
            <table class="w-full text-left text-[11px] border-collapse border border-slate-200 rounded-xl overflow-hidden mb-8">
              <thead>
                <tr class="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold">
                  <th class="py-2.5 px-3">Date</th>
                  <th class="py-2.5 px-3">Category</th>
                  <th class="py-2.5 px-3 text-center">Type</th>
                  <th class="py-2.5 px-3 text-right">Amount</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100">
                ${dailyClosingTxs.slice(0, 15).map(tx => {
                  const isInc = tx.type === 'income';
                  const catLabel = getCategoryLabel(tx);
                  return `
                    <tr>
                      <td class="py-2.5 px-3 font-mono font-semibold text-slate-500">${tx.date}</td>
                      <td class="py-2.5 px-3 font-bold text-slate-800">${catLabel}</td>
                      <td class="py-2.5 px-3 text-center">
                        <span class="inline-block px-2 py-0.5 rounded text-[9px] font-bold ${isInc ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}">
                          ${isInc ? 'Income' : 'Expense'}
                        </span>
                      </td>
                      <td class="py-2.5 px-3 text-right font-bold font-mono ${isInc ? 'text-emerald-600' : 'text-rose-600'}">
                        BDT ${tx.amount.toLocaleString()}
                      </td>
                    </tr>
                  `;
                }).join('')}
                ${dailyClosingTxs.length > 15 ? `
                  <tr>
                    <td colspan="4" class="py-3 text-center text-slate-400 italic">Showing top 15 entries. Use full PDF Report download for complete details.</td>
                  </tr>
                ` : ''}
              </tbody>
            </table>

            <div class="signature-footer flex justify-between gap-12 pt-16 border-t border-dashed border-slate-200 mt-12">
              <div class="text-center w-36">
                <div class="border-b border-slate-300 w-full mb-1 h-6"></div>
                <p class="text-[9px] font-bold text-slate-500 uppercase">Prepared By</p>
              </div>
              <div class="text-center w-36">
                <div class="border-b border-slate-300 w-full mb-1 h-6"></div>
                <p class="text-[9px] font-bold text-slate-500 uppercase">Authorized Signature</p>
              </div>
            </div>

          </div>
          <script>
            window.onload = function() {
              setTimeout(function() {
                window.print();
              }, 400);
            }
          </script>
        </body>
      </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  // Add a new Daily Closing Entry Statement (Income Transaction)
  const handleAddEntryStatement = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    const isClosed = closings.some(c => c.date === selectedDate && c.status === 'closed');
    if (isClosed) {
      setError('Cannot add entry: This date is locked and closed. Please unlock/reopen the day first.');
      return;
    }

    if (!entryAmount || parseFloat(entryAmount) <= 0) {
      setError('Please enter a valid Today Income amount.');
      return;
    }

    const titleMap: Record<string, string> = {
      customer_bill: 'Customer Bill Collection',
      reseller_bill: 'Reseller Bill Collection',
      service_charge: 'Service Charge Collection',
      other_income: 'Other Income',
    };

    const newTxId = `tx-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const txDocRef = doc(db, 'transactions', newTxId);

    const newTx = {
      id: newTxId,
      userId,
      type: 'income',
      title: titleMap[entryCategory] || 'Income Statement',
      amount: parseFloat(entryAmount),
      category: entryCategory,
      date: selectedDate,
      paymentMethod: entryPaymentMethod,
      notes: `Daily Closing entry statement: ${titleMap[entryCategory] || 'Income'}`,
      isDailyClosing: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    try {
      await setDoc(txDocRef, newTx);
      setSuccess('Entry statement added successfully!');
      setEntryAmount('');
      setTimeout(() => setSuccess(''), 5500);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `transactions/${newTxId}`);
    }
  };

  // Add a new Daily Closing Expense Statement (Expense Transaction)
  const handleAddExpenseEntryStatement = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    const isClosed = closings.some(c => c.date === selectedDate && c.status === 'closed');
    if (isClosed) {
      setError('Cannot add expense: This date is locked and closed. Please unlock/reopen the day first.');
      return;
    }

    if (!expenseAmount || parseFloat(expenseAmount) <= 0) {
      setError('Please enter a valid Today Expense amount.');
      return;
    }

    const titleMap: Record<string, string> = {
      office_rent: 'Office Rent',
      transport: 'Transport',
      fuel: 'Fuel',
      materials: 'Materials',
      utilities: 'Utilities',
      promotion: 'Promotion',
      bandwidth_bill: 'Bandwidth Bill',
      software_bill: 'Software Bill',
      emoney_charge: 'E-Money Charge',
      salary: 'Salary',
      mobile_bill: 'Mobile Bill',
      office_expense: 'Office Expense',
      entertainment: 'Entertainment',
      allowance: 'Allowance',
      other_expense: 'Other Expense',
    };

    const newTxId = `tx-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const txDocRef = doc(db, 'transactions', newTxId);

    const newTx = {
      id: newTxId,
      userId,
      type: 'expense',
      title: titleMap[expenseCategory] || 'Expense Statement',
      amount: parseFloat(expenseAmount),
      category: expenseCategory,
      date: selectedDate,
      paymentMethod: expensePaymentMethod,
      notes: `Daily Closing expense statement: ${titleMap[expenseCategory] || 'Expense'}`,
      isDailyClosing: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    try {
      await setDoc(txDocRef, newTx);
      setSuccess('Expense statement entry added successfully!');
      setExpenseAmount('');
      setTimeout(() => setSuccess(''), 5500);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `transactions/${newTxId}`);
    }
  };

  // Delete an Entry Statement
  const handleDeleteEntryStatement = (txId: string) => {
    const tx = transactions.find(t => t.id === txId);
    if (tx) {
      const isClosed = closings.some(c => c.date === tx.date && c.status === 'closed');
      if (isClosed) {
        setError('Cannot delete transaction: This date has been locked and closed. Please unlock/reopen the day first.');
        setTimeout(() => setError(''), 5500);
        return;
      }
    }

    setConfirmModal({
      message: 'Delete Entry Statement?',
      description: 'Are you sure you want to delete this entry statement? This action cannot be undone.',
      onConfirm: async () => {
        setError('');
        setSuccess('');
        try {
          await deleteDoc(doc(db, 'transactions', txId));
          setSuccess('Entry statement deleted successfully.');
          setTimeout(() => setSuccess(''), 5500);
        } catch (err) {
          handleFirestoreError(err, OperationType.DELETE, `transactions/${txId}`);
        }
      }
    });
  };

  // Start editing a Statement
  const handleStartEdit = (tx: Transaction) => {
    const isClosed = closings.some(c => c.date === tx.date && c.status === 'closed');
    if (isClosed) {
      setError('Cannot edit transaction: This date has been locked and closed. Please unlock/reopen the day first.');
      setTimeout(() => setError(''), 5500);
      return;
    }
    setEditingTx(tx);
    setEditingTxCategory(tx.category);
    setEditingTxAmount(tx.amount.toString());
    setEditingTxPaymentMethod(tx.paymentMethod || 'cash');
  };

  // Submit Edited Statement
  const handleEditTxSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTx) return;
    setError('');
    setSuccess('');

    const isClosed = closings.some(c => c.date === editingTx.date && c.status === 'closed');
    if (isClosed) {
      setError('Cannot save changes: This date is locked and closed. Please unlock/reopen the day first.');
      setTimeout(() => setError(''), 5500);
      return;
    }

    const amt = parseFloat(editingTxAmount);
    if (isNaN(amt) || amt <= 0) {
      setError('Please enter a valid amount.');
      return;
    }

    try {
      const txDocRef = doc(db, 'transactions', editingTx.id);
      let notesText = '';
      let titleText = '';

      if (editingTx.type === 'income') {
        const titleMap: Record<string, string> = {
          customer_bill: 'Customer Bill Collection Statement',
          reseller_bill: 'Reseller Bill Collection Statement',
          service_charge: 'Service Charge Collection Statement',
          other_income: 'Other Income Statement',
        };
        titleText = titleMap[editingTxCategory] || 'Income Statement';
        notesText = `Daily Closing entry statement: ${titleText}`;
      } else {
        const titleMap: Record<string, string> = {
          bandwidth_bill: 'Bandwidth Bill',
          software_bill: 'Software Bill',
          emoney_charge: 'E-Money Charge',
          salary: 'Salary',
          mobile_bill: 'Mobile Bill',
          office_expense: 'Office Expense',
          entertainment: 'Entertainment',
          allowance: 'Allowance',
          other_expense: 'Other Expense',
          transport: 'Transport',
          fuel: 'Fuel',
          materials: 'Materials',
          utilities: 'Utilities',
          promotion: 'Promotion',
        };
        titleText = titleMap[editingTxCategory] || 'Expense Statement';
        notesText = `Daily Closing expense statement: ${titleText}`;
      }

      await setDoc(txDocRef, {
        ...editingTx,
        category: editingTxCategory,
        paymentMethod: editingTxPaymentMethod,
        amount: amt,
        title: titleText,
        notes: notesText,
        updatedAt: serverTimestamp()
      });

      setSuccess('Statement entry updated successfully!');
      setEditingTx(null);
      setTimeout(() => setSuccess(''), 5500);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `transactions/${editingTx.id}`);
    }
  };

  // Submit Cash Drawer Statement
  const handleDrawerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    const kha = parseFloat(khaOfficeCash || '0');
    const dhaka = parseFloat(dhakaOfficeCash || '0');
    const nayan = parseFloat(nayanCash || '0');
    const acc = parseFloat(accountCash || '0');
    
    const tKhaNayan = parseFloat(transferKhaToNayan || '0');
    const tNayanDhaka = parseFloat(transferNayanToDhaka || '0');
    const tDhakaNayan = parseFloat(transferDhakaToNayan || '0');
    const tDhakaKha = parseFloat(transferDhakaToKha || '0');

    if (kha < 0 || dhaka < 0 || nayan < 0 || acc < 0 || tKhaNayan < 0 || tNayanDhaka < 0 || tDhakaNayan < 0 || tDhakaKha < 0) {
      setError('Amounts cannot be negative.');
      return;
    }

    setIsDrawerSubmitted(true);

    const docId = `dc_${userId}_${selectedDate}`;
    try {
      const docRef = doc(db, 'daily_closings', docId);
      const docSnap = await getDoc(docRef);

      const payload: Partial<DailyClosing> = {
        id: docId,
        userId,
        date: selectedDate,
        khaOfficeCash: kha,
        dhakaOfficeCash: dhaka,
        nayanCash: nayan,
        accountCash: acc,
        transferKhaToNayan: tKhaNayan,
        transferNayanToDhaka: tNayanDhaka,
        transferDhakaToNayan: tDhakaNayan,
        transferDhakaToKha: tDhakaKha,
        isDrawerSubmitted: true,
        status: docSnap.exists() ? (docSnap.data()?.status || 'open') : 'open',
        updatedAt: serverTimestamp()
      };

      if (!docSnap.exists()) {
        payload.openingCash = parseFloat(openingCash || '0');
        payload.openingBkash = parseFloat(openingBkash || '0');
        payload.openingNagad = parseFloat(openingNagad || '0');
        payload.openingRocket = parseFloat(openingRocket || '0');
        payload.openingBank = parseFloat(openingBank || '0');
        payload.openingSsl = parseFloat(openingSsl || '0');
        payload.createdAt = serverTimestamp();
      }

      await setDoc(docRef, payload, { merge: true });
      setSuccess('Cash Drawer Statement successfully submitted and saved! See the formal statement layout below.');
      setTimeout(() => setSuccess(''), 5500);
    } catch (err) {
      console.error('Error saving drawer statement:', err);
      setError('Failed to save cash drawer statement to database.');
    }
  };

  const handleModifyDrawer = async () => {
    setIsDrawerSubmitted(false);
    const docId = `dc_${userId}_${selectedDate}`;
    try {
      const docRef = doc(db, 'daily_closings', docId);
      await setDoc(docRef, { isDrawerSubmitted: false, updatedAt: serverTimestamp() }, { merge: true });
      setSuccess('Statement submission reset. You can now modify the values above.');
      setTimeout(() => setSuccess(''), 4000);
    } catch (err) {
      console.error('Error updating drawer submission state:', err);
    }
  };

  // 4. Submit Daily Closing Day
  const handleSaveClosing = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (currentUserProfile && !currentUserProfile.permissions?.canManageDailyClosing) {
      setError('Access Denied: You do not possess permission to lock closing statements.');
      return;
    }

    if (!selectedDate) {
      setError('Please select a valid date.');
      return;
    }

    const docId = `dc_${userId}_${selectedDate}`;
    
    try {
      const docRef = doc(db, 'daily_closings', docId);
      const docSnap = await getDoc(docRef);

      const payload: any = {
        id: docId,
        userId,
        date: selectedDate,
        openingCash: val(openingCash),
        openingBkash: val(openingBkash),
        openingNagad: val(openingNagad),
        openingRocket: val(openingRocket),
        openingBank: val(openingBank),
        openingSsl: val(openingSsl),

        closingCash,
        closingBkash,
        closingNagad,
        closingRocket,
        closingBank,
        closingSsl,

        totalCashIn: cashFlow.income,
        totalBkashIn: bkashFlow.income,
        totalNagadIn: nagadFlow.income,
        totalRocketIn: rocketFlow.income,
        totalBankIn: bankFlow.income,
        totalSslIn: sslFlow.income,

        totalCashOut: cashFlow.expense,
        totalBkashOut: bkashFlow.expense,
        totalNagadOut: nagadFlow.expense,
        totalRocketOut: rocketFlow.expense,
        totalBankOut: bankFlow.expense,
        totalSslOut: sslFlow.expense,

        khaOfficeCash: val(khaOfficeCash),
        dhakaOfficeCash: val(dhakaOfficeCash),
        nayanCash: val(nayanCash),
        accountCash: val(accountCash),

        transferKhaToNayan: val(transferKhaToNayan),
        transferNayanToDhaka: val(transferNayanToDhaka),
        transferDhakaToNayan: val(transferDhakaToNayan),
        transferDhakaToKha: val(transferDhakaToKha),

        notes: notes.trim(),
        status: 'closed',
        closedBy: 'System Admin',
        updatedAt: serverTimestamp()
      };

      if (!docSnap.exists()) {
        payload.createdAt = serverTimestamp();
      }

      await setDoc(docRef, payload, { merge: true });
      setSuccess(`Daily closing for ${selectedDate} has been successfully completed and locked.`);
      setNotes('');
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `daily_closings/${docId}`);
    }
  };

  // 5. Delete/Reopen Closing
  const handleReopenClosing = (id: string, dateStr: string) => {
    setConfirmModal({
      message: 'Reopen Daily Closing?',
      description: `Are you sure you want to reopen and unlock the daily closing for ${dateStr}? This will let you edit or delete transactions for this date.`,
      onConfirm: async () => {
        try {
          const docRef = doc(db, 'daily_closings', id);
          await setDoc(docRef, { status: 'open', updatedAt: serverTimestamp() }, { merge: true });
          setSuccess(`Daily closing for ${dateStr} has been successfully reopened.`);
          setTimeout(() => setSuccess(''), 5000);
        } catch (err) {
          handleFirestoreError(err, OperationType.WRITE, `daily_closings/${id}`);
        }
      }
    });
  };

  // Print the currently active selected date closing
  const handlePrintCurrent = () => {
    const existing = closings.find(c => c.date === selectedDate);
    if (existing) {
      setPrintPreviewData(existing);
    } else {
      const activeObj: DailyClosing = {
        id: `dc_${userId}_${selectedDate}`,
        userId,
        date: selectedDate,
        openingCash: val(openingCash),
        openingBkash: val(openingBkash),
        openingNagad: val(openingNagad),
        openingRocket: val(openingRocket),
        openingBank: val(openingBank),
        openingSsl: val(openingSsl),

        closingCash,
        closingBkash,
        closingNagad,
        closingRocket,
        closingBank,
        closingSsl,

        totalCashIn: cashFlow.income,
        totalBkashIn: bkashFlow.income,
        totalNagadIn: nagadFlow.income,
        totalRocketIn: rocketFlow.income,
        totalBankIn: bankFlow.income,
        totalSslIn: sslFlow.income,

        totalCashOut: cashFlow.expense,
        totalBkashOut: bkashFlow.expense,
        totalNagadOut: nagadFlow.expense,
        totalRocketOut: rocketFlow.expense,
        totalBankOut: bankFlow.expense,
        totalSslOut: sslFlow.expense,

        khaOfficeCash: val(khaOfficeCash),
        dhakaOfficeCash: val(dhakaOfficeCash),
        nayanCash: val(nayanCash),
        accountCash: val(accountCash),

        transferKhaToNayan: val(transferKhaToNayan),
        transferNayanToDhaka: val(transferNayanToDhaka),
        transferDhakaToNayan: val(transferDhakaToNayan),
        transferDhakaToKha: val(transferDhakaToKha),

        notes: notes.trim(),
        status: 'open',
        closedBy: 'System Admin',
      };
      setPrintPreviewData(activeObj);
    }
  };

  // 6. Direct Print Layout
  const handlePrint = (dc: DailyClosing) => {
    setPrintPreviewData(dc);
  };

  const handleDownloadClosingPDF = (dc: DailyClosing) => {
    try {
      const doc = new jsPDF();
      
      // Top accent bar (teal color)
      doc.setFillColor(13, 148, 136);
      doc.rect(0, 0, 210, 8, 'F');
      
      // Title Block
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(16);
      doc.setTextColor(15, 23, 42); // slate-900
      doc.text('Titas Broadband & Accounting', 14, 24);
      
      doc.setFont('helvetica', 'medium');
      doc.setFontSize(10);
      doc.setTextColor(71, 85, 105); // slate-600
      doc.text('Daily Closing & Financial Statement Report', 14, 30);
      
      // Metadata
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(100, 116, 139); // slate-500
      doc.text(`Report Date: ${dc.date}`, 14, 39);
      doc.text(`Generated By: ${dc.closedBy || 'System Admin'}`, 14, 44);
      doc.text(`System Status: ${(dc.status || 'open').toUpperCase()}`, 120, 39);
      doc.text(`Run Time: ${new Date().toLocaleTimeString()} BDT`, 120, 44);
      
      doc.setDrawColor(226, 232, 240); // slate-200
      doc.line(14, 49, 196, 49);

      const tableRows = [
        ['Cash', `${dc.openingCash.toLocaleString()} BDT`, `+${dc.totalCashIn.toLocaleString()} BDT`, `-${dc.totalCashOut.toLocaleString()} BDT`, `${dc.closingCash.toLocaleString()} BDT`],
        ['bKash', `${dc.openingBkash.toLocaleString()} BDT`, `+${dc.totalBkashIn.toLocaleString()} BDT`, `-${dc.totalBkashOut.toLocaleString()} BDT`, `${dc.closingBkash.toLocaleString()} BDT`],
        ['Nagad', `${dc.openingNagad.toLocaleString()} BDT`, `+${dc.totalNagadIn.toLocaleString()} BDT`, `-${dc.totalNagadOut.toLocaleString()} BDT`, `${dc.closingNagad.toLocaleString()} BDT`],
        ['Rocket', `${dc.openingRocket.toLocaleString()} BDT`, `+${dc.totalRocketIn.toLocaleString()} BDT`, `-${dc.totalRocketOut.toLocaleString()} BDT`, `${dc.closingRocket.toLocaleString()} BDT`],
        ['Bank Transfer', `${dc.openingBank.toLocaleString()} BDT`, `+${dc.totalBankIn.toLocaleString()} BDT`, `-${dc.totalBankOut.toLocaleString()} BDT`, `${dc.closingBank.toLocaleString()} BDT`],
        ['SSL Commerz', `${dc.openingSsl.toLocaleString()} BDT`, `+${dc.totalSslIn.toLocaleString()} BDT`, `-${dc.totalSslOut.toLocaleString()} BDT`, `${dc.closingSsl.toLocaleString()} BDT`],
      ];

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(30, 41, 59);
      doc.text('Detailed Breakdown by Payment Method', 14, 56);

      autoTable(doc, {
        startY: 60,
        head: [['Payment Method', 'Opening Balance', 'Total Collection (+)', 'Total Expense (-)', 'Closing Balance']],
        body: tableRows,
        theme: 'striped',
        headStyles: {
          fillColor: [13, 148, 136], // teal-600
          textColor: [255, 255, 255],
          fontSize: 8.5,
          fontStyle: 'bold',
        },
        bodyStyles: {
          fontSize: 8,
          textColor: [51, 65, 85],
        },
        columnStyles: {
          1: { halign: 'right' },
          2: { halign: 'right', textColor: [5, 150, 105] }, // emerald-600
          3: { halign: 'right', textColor: [225, 29, 72] },  // rose-600
          4: { halign: 'right', fontStyle: 'bold', textColor: [15, 23, 42] },
        },
        styles: {
          font: 'helvetica',
          cellPadding: 3,
        },
        margin: { left: 14, right: 14 }
      });

      let nextStartY = (doc as any).lastAutoTable.finalY + 12;

      // Cash Drawer Statement (Physical Cash & Transfers) in PDF
      if (nextStartY + 50 > 280) {
        doc.addPage();
        nextStartY = 20;
      }

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(30, 41, 59);
      doc.text('Cash Drawer Statement (Physical Cash & Transfers)', 14, nextStartY);

      const drawerRows = [
        ['KHA Office Cash', `${(dc.khaOfficeCash ?? 0).toLocaleString()} BDT`, 'KHA Office to Nayan', `${(dc.transferKhaToNayan ?? 0).toLocaleString()} BDT`],
        ['Dhaka Office', `${(dc.dhakaOfficeCash ?? 0).toLocaleString()} BDT`, 'Nayan to Dhaka office', `${(dc.transferNayanToDhaka ?? 0).toLocaleString()} BDT`],
        ['Nayan Cash', `${(dc.nayanCash ?? 0).toLocaleString()} BDT`, 'Dhaka office to Nayan', `${(dc.transferDhakaToNayan ?? 0).toLocaleString()} BDT`],
        ['Account Cash', `${(dc.accountCash ?? 0).toLocaleString()} BDT`, 'Dhaka to KHA Office', `${(dc.transferDhakaToKha ?? 0).toLocaleString()} BDT`],
      ];

      autoTable(doc, {
        startY: nextStartY + 4,
        head: [['Cash Summary', 'Amount', 'Money Transfers', 'Amount']],
        body: drawerRows,
        theme: 'striped',
        headStyles: {
          fillColor: [71, 85, 105], // Slate-600
          textColor: [255, 255, 255],
          fontSize: 8.5,
          fontStyle: 'bold',
        },
        bodyStyles: {
          fontSize: 8,
          textColor: [51, 65, 85],
        },
        columnStyles: {
          1: { halign: 'right', fontStyle: 'bold' },
          3: { halign: 'right', fontStyle: 'bold' },
        },
        styles: {
          font: 'helvetica',
          cellPadding: 3,
        },
        margin: { left: 14, right: 14 }
      });

      nextStartY = (doc as any).lastAutoTable.finalY + 12;

      // Filter and render Daily Closing Entry & Expense Logs
      const previewTxs = (transactions || []).filter(t => t.isDailyClosing === true && t.date === dc.date);
      if (previewTxs.length > 0) {
        if (nextStartY + 35 > 280) {
          doc.addPage();
          nextStartY = 20;
        }

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.setTextColor(30, 41, 59);
        doc.text('Daily Closing Entry & Expense Logs', 14, nextStartY);

        const txRows = previewTxs.map(t => [
          getCategoryLabel(t),
          t.paymentMethod || 'cash',
          t.type === 'income' ? 'INFLOW (+)' : 'OUTFLOW (-)',
          `${t.amount.toLocaleString()} BDT`
        ]);

        autoTable(doc, {
          startY: nextStartY + 4,
          head: [['Category', 'Payment Method', 'Type', 'Amount']],
          body: txRows,
          theme: 'striped',
          headStyles: {
            fillColor: [71, 85, 105], // slate-600
            textColor: [255, 255, 255],
            fontSize: 8.5,
            fontStyle: 'bold',
          },
          bodyStyles: {
            fontSize: 8,
            textColor: [51, 65, 85],
          },
          columnStyles: {
            2: { halign: 'center', fontStyle: 'bold' },
            3: { halign: 'right', fontStyle: 'bold' },
          },
          didParseCell: (data) => {
            if (data.section === 'body' && data.column.index === 2) {
              const val = data.cell.raw as string;
              if (val.includes('INFLOW')) {
                data.cell.styles.textColor = [5, 150, 105];
              } else {
                data.cell.styles.textColor = [225, 29, 72];
              }
            }
          },
          styles: {
            font: 'helvetica',
            cellPadding: 3,
          },
          margin: { left: 14, right: 14 }
        });

        nextStartY = (doc as any).lastAutoTable.finalY + 12;
      }

      // Financial Summary Box
      const totalIn = dc.totalCashIn + dc.totalBkashIn + dc.totalNagadIn + dc.totalRocketIn + dc.totalBankIn + dc.totalSslIn;
      const totalOut = dc.totalCashOut + dc.totalBkashOut + dc.totalNagadOut + dc.totalRocketOut + dc.totalBankOut + dc.totalSslOut;
      const totalOpenBal = dc.openingCash + dc.openingBkash + dc.openingNagad + dc.openingRocket + dc.openingBank + dc.openingSsl;
      const totalCloseBal = dc.closingCash + dc.closingBkash + dc.closingNagad + dc.closingRocket + dc.closingBank + dc.closingSsl;

      if (nextStartY + 36 > 280) {
        doc.addPage();
        nextStartY = 20;
      }

      doc.setDrawColor(15, 23, 42); // slate-900 border
      doc.setLineWidth(0.4);
      doc.rect(14, nextStartY, 182, 32);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(30, 41, 59);
      doc.text('TOTAL OPENING BALANCE:', 18, nextStartY + 6);
      doc.text(`${totalOpenBal.toLocaleString()} BDT`, 192, nextStartY + 6, { align: 'right' });

      doc.setTextColor(5, 150, 105); // emerald-600
      doc.text('(+) TOTAL COLLECTION (INFLOW):', 18, nextStartY + 13);
      doc.text(`+ ${totalIn.toLocaleString()} BDT`, 192, nextStartY + 13, { align: 'right' });

      doc.setTextColor(225, 29, 72); // rose-600
      doc.text('(-) TOTAL EXPENSE (OUTFLOW):', 18, nextStartY + 20);
      doc.text(`- ${totalOut.toLocaleString()} BDT`, 192, nextStartY + 20, { align: 'right' });

      doc.setDrawColor(226, 232, 240);
      doc.line(18, nextStartY + 24, 192, nextStartY + 24);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(15, 23, 42);
      doc.text('(=) GRAND CLOSING BALANCE:', 18, nextStartY + 29);
      doc.text(`${totalCloseBal.toLocaleString()} BDT`, 192, nextStartY + 29, { align: 'right' });

      nextStartY += 38;

      // Notes / Comments
      if (dc.notes) {
        if (nextStartY + 16 > 280) {
          doc.addPage();
          nextStartY = 20;
        }
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8.5);
        doc.setTextColor(100, 116, 139);
        doc.text('Notes / Comments:', 14, nextStartY);

        doc.setFont('helvetica', 'italic');
        doc.setFontSize(8);
        doc.setTextColor(115, 115, 115);
        const splitNotes = doc.splitTextToSize(dc.notes, 182);
        doc.text(splitNotes, 14, nextStartY + 4);
        nextStartY += 5 + (splitNotes.length * 3.5);
      }

      // Signatures
      if (nextStartY + 25 > 280) {
        doc.addPage();
        nextStartY = 20;
      } else {
        nextStartY += 10;
      }

      doc.setDrawColor(15, 23, 42);
      doc.setLineWidth(0.3);
      doc.line(14, nextStartY + 15, 64, nextStartY + 15);
      doc.line(146, nextStartY + 15, 196, nextStartY + 15);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      doc.text('Prepared By', 39, nextStartY + 19, { align: 'center' });
      doc.text('Approved By', 171, nextStartY + 19, { align: 'center' });

      doc.save(`Daily_Closing_Report_${dc.date}.pdf`);
    } catch (err) {
      console.error('Failed to generate PDF:', err);
      alert('Failed to generate PDF report. Please try again.');
    }
  };

  // Render inline Print Preview Modal
  const renderPrintPreviewModal = () => {
    if (!printPreviewData) return null;

    const totalIn = printPreviewData.totalCashIn + printPreviewData.totalBkashIn + printPreviewData.totalNagadIn + printPreviewData.totalRocketIn + printPreviewData.totalBankIn + printPreviewData.totalSslIn;
    const totalOut = printPreviewData.totalCashOut + printPreviewData.totalBkashOut + printPreviewData.totalNagadOut + printPreviewData.totalRocketOut + printPreviewData.totalBankOut + printPreviewData.totalSslOut;
    const totalOpenBal = printPreviewData.openingCash + printPreviewData.openingBkash + printPreviewData.openingNagad + printPreviewData.openingRocket + printPreviewData.openingBank + printPreviewData.openingSsl;
    const totalCloseBal = printPreviewData.closingCash + printPreviewData.closingBkash + printPreviewData.closingNagad + printPreviewData.closingRocket + printPreviewData.closingBank + printPreviewData.closingSsl;

    return (
      <div className="fixed inset-0 bg-slate-950/70 z-[120] flex items-center justify-center p-4 overflow-y-auto animate-fade-in no-print">
        <style dangerouslySetInnerHTML={{ __html: `
          @media print {
            body * {
              visibility: hidden !important;
            }
            #printable-report-area, #printable-report-area * {
              visibility: visible !important;
            }
            #printable-report-area {
              position: fixed !important;
              left: 0 !important;
              top: 0 !important;
              width: 100% !important;
              height: auto !important;
              background: white !important;
              color: black !important;
              padding: 40px !important;
              margin: 0 !important;
              box-shadow: none !important;
              border: none !important;
              z-index: 99999 !important;
            }
            .no-print {
              display: none !important;
            }
          }
        ` }} />
        
        <div className="bg-white rounded-3xl max-w-2xl w-full p-6 shadow-2xl relative flex flex-col my-8 border border-slate-100 animate-scale-up max-h-[90vh]">
          {/* Header Actions */}
          <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4 shrink-0">
            <div className="flex items-center gap-2.5">
              <span className="p-2 bg-teal-50 text-teal-600 rounded-xl">
                <Printer className="w-5 h-5" />
              </span>
              <div>
                <h3 className="text-base font-extrabold text-slate-800">Print Report Preview</h3>
                <p className="text-[11px] text-slate-400 mt-0.5">Verify and print the formal daily closing layout</p>
              </div>
            </div>
            <button 
              onClick={() => setPrintPreviewData(null)}
              className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-50 transition cursor-pointer"
            >
              ✕
            </button>
          </div>

          {/* Printable Report Document Card */}
          <div className="flex-1 overflow-y-auto pr-1 bg-slate-100/50 p-6 rounded-2xl border border-slate-200/40">
            <div 
              id="printable-report-area" 
              className="bg-white p-8 rounded-xl shadow-sm border border-slate-200 max-w-xl mx-auto font-mono text-[11px] text-slate-800 leading-relaxed"
            >
              {/* Header */}
              <div className="text-center border-b border-dashed border-slate-300 pb-4 mb-4">
                <h1 className="text-base font-bold tracking-wider text-slate-900 uppercase">Titas Broadband & Accounting</h1>
                <p className="text-[10px] text-slate-500 font-medium mt-1 uppercase tracking-widest">Daily Closing & Financial Statement Report</p>
              </div>

              {/* Meta information */}
              <div className="grid grid-cols-2 gap-y-1.5 border-b border-dashed border-slate-200 pb-3 mb-4 text-[10px] text-slate-600">
                <div><strong>REPORT DATE:</strong> <span className="font-bold text-slate-900">{printPreviewData.date}</span></div>
                <div className="text-right"><strong>GENERATED BY:</strong> <span className="font-bold text-slate-900">{printPreviewData.closedBy || 'System Admin'}</span></div>
                <div><strong>SYSTEM STATUS:</strong> <span className={`font-bold ${printPreviewData.status === 'closed' ? 'text-emerald-700' : 'text-amber-700'}`}>{printPreviewData.status?.toUpperCase() || 'OPEN'}</span></div>
                <div className="text-right"><strong>RUN TIME:</strong> <span className="font-bold text-slate-900">{new Date().toLocaleTimeString()} BDT</span></div>
              </div>

              {/* Table Breakdown */}
              <div className="font-bold text-[9px] uppercase text-slate-400 tracking-wider mb-2">
                Detailed Breakdown by Payment Method
              </div>
              <div className="border-t border-b border-slate-200 py-1 mb-4 overflow-x-auto">
                <table className="w-full text-[10px] text-left">
                  <thead>
                    <tr className="border-b border-slate-200 pb-1 text-slate-500 font-bold">
                      <th className="py-1">METHOD</th>
                      <th className="py-1 text-right">OPENING</th>
                      <th className="py-1 text-right">INFLOW (+)</th>
                      <th className="py-1 text-right">OUTFLOW (-)</th>
                      <th className="py-1 text-right">CLOSING</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-slate-100">
                      <td className="py-1.5 font-semibold text-slate-700">Cash</td>
                      <td className="py-1.5 text-right font-mono">{printPreviewData.openingCash.toLocaleString()}</td>
                      <td className="py-1.5 text-right font-mono text-emerald-600">+{printPreviewData.totalCashIn.toLocaleString()}</td>
                      <td className="py-1.5 text-right font-mono text-rose-600">-{printPreviewData.totalCashOut.toLocaleString()}</td>
                      <td className="py-1.5 text-right font-mono font-bold text-slate-900">{printPreviewData.closingCash.toLocaleString()}</td>
                    </tr>
                    <tr className="border-b border-slate-100">
                      <td className="py-1.5 font-semibold text-slate-700">bKash</td>
                      <td className="py-1.5 text-right font-mono">{printPreviewData.openingBkash.toLocaleString()}</td>
                      <td className="py-1.5 text-right font-mono text-emerald-600">+{printPreviewData.totalBkashIn.toLocaleString()}</td>
                      <td className="py-1.5 text-right font-mono text-rose-600">-{printPreviewData.totalBkashOut.toLocaleString()}</td>
                      <td className="py-1.5 text-right font-mono font-bold text-slate-900">{printPreviewData.closingBkash.toLocaleString()}</td>
                    </tr>
                    <tr className="border-b border-slate-100">
                      <td className="py-1.5 font-semibold text-slate-700">Nagad</td>
                      <td className="py-1.5 text-right font-mono">{printPreviewData.openingNagad.toLocaleString()}</td>
                      <td className="py-1.5 text-right font-mono text-emerald-600">+{printPreviewData.totalNagadIn.toLocaleString()}</td>
                      <td className="py-1.5 text-right font-mono text-rose-600">-{printPreviewData.totalNagadOut.toLocaleString()}</td>
                      <td className="py-1.5 text-right font-mono font-bold text-slate-900">{printPreviewData.closingNagad.toLocaleString()}</td>
                    </tr>
                    <tr className="border-b border-slate-100">
                      <td className="py-1.5 font-semibold text-slate-700">Rocket</td>
                      <td className="py-1.5 text-right font-mono">{printPreviewData.openingRocket.toLocaleString()}</td>
                      <td className="py-1.5 text-right font-mono text-emerald-600">+{printPreviewData.totalRocketIn.toLocaleString()}</td>
                      <td className="py-1.5 text-right font-mono text-rose-600">-{printPreviewData.totalRocketOut.toLocaleString()}</td>
                      <td className="py-1.5 text-right font-mono font-bold text-slate-900">{printPreviewData.closingRocket.toLocaleString()}</td>
                    </tr>
                    <tr className="border-b border-slate-100">
                      <td className="py-1.5 font-semibold text-slate-700">Bank</td>
                      <td className="py-1.5 text-right font-mono">{printPreviewData.openingBank.toLocaleString()}</td>
                      <td className="py-1.5 text-right font-mono text-emerald-600">+{printPreviewData.totalBankIn.toLocaleString()}</td>
                      <td className="py-1.5 text-right font-mono text-rose-600">-{printPreviewData.totalBankOut.toLocaleString()}</td>
                      <td className="py-1.5 text-right font-mono font-bold text-slate-900">{printPreviewData.closingBank.toLocaleString()}</td>
                    </tr>
                    <tr className="border-b border-slate-100">
                      <td className="py-1.5 font-semibold text-slate-700">SSL</td>
                      <td className="py-1.5 text-right font-mono">{printPreviewData.openingSsl.toLocaleString()}</td>
                      <td className="py-1.5 text-right font-mono text-emerald-600">+{printPreviewData.totalSslIn.toLocaleString()}</td>
                      <td className="py-1.5 text-right font-mono text-rose-600">-{printPreviewData.totalSslOut.toLocaleString()}</td>
                      <td className="py-1.5 text-right font-mono font-bold text-slate-900">{printPreviewData.closingSsl.toLocaleString()}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Cash Drawer Statement */}
              <div className="font-bold text-[9px] uppercase text-slate-400 tracking-wider mb-2 mt-5">
                Cash Drawer Statement (Physical Cash & Transfers)
              </div>
              <div className="border-t border-b border-slate-200 py-2 mb-4 grid grid-cols-2 gap-4">
                {/* Cash Summary Details */}
                <div>
                  <div className="font-bold text-[9px] text-slate-500 uppercase tracking-wider mb-1.5 border-b border-slate-100 pb-0.5">
                    CASH SUMMARY DETAILS
                  </div>
                  <table className="w-full text-[10px] text-left">
                    <tbody>
                      <tr className="border-b border-slate-100">
                        <td className="py-1 text-slate-600">KHA Office Cash</td>
                        <td className="py-1 text-right font-mono font-bold text-slate-900">
                          {(printPreviewData.khaOfficeCash ?? 0).toLocaleString()} ৳
                        </td>
                      </tr>
                      <tr className="border-b border-slate-100">
                        <td className="py-1 text-slate-600">Dhaka office</td>
                        <td className="py-1 text-right font-mono font-bold text-slate-900">
                          {(printPreviewData.dhakaOfficeCash ?? 0).toLocaleString()} ৳
                        </td>
                      </tr>
                      <tr className="border-b border-slate-100">
                        <td className="py-1 text-slate-600">Nayan Cash</td>
                        <td className="py-1 text-right font-mono font-bold text-slate-900">
                          {(printPreviewData.nayanCash ?? 0).toLocaleString()} ৳
                        </td>
                      </tr>
                      <tr className="border-b border-slate-100">
                        <td className="py-1 text-slate-600">Account Cash</td>
                        <td className="py-1 text-right font-mono font-bold text-slate-900">
                          {(printPreviewData.accountCash ?? 0).toLocaleString()} ৳
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Transfer Money Details */}
                <div>
                  <div className="font-bold text-[9px] text-slate-500 uppercase tracking-wider mb-1.5 border-b border-slate-100 pb-0.5">
                    TRANSFER MONEY DETAILS
                  </div>
                  <table className="w-full text-[10px] text-left">
                    <tbody>
                      <tr className="border-b border-slate-100">
                        <td className="py-1 text-slate-600">KHA Office to Nayan</td>
                        <td className="py-1 text-right font-mono font-bold text-slate-900">
                          {(printPreviewData.transferKhaToNayan ?? 0).toLocaleString()} ৳
                        </td>
                      </tr>
                      <tr className="border-b border-slate-100">
                        <td className="py-1 text-slate-600">Nayan to Dhaka office</td>
                        <td className="py-1 text-right font-mono font-bold text-slate-900">
                          {(printPreviewData.transferNayanToDhaka ?? 0).toLocaleString()} ৳
                        </td>
                      </tr>
                      <tr className="border-b border-slate-100">
                        <td className="py-1 text-slate-600">Dhaka office to Nayan</td>
                        <td className="py-1 text-right font-mono font-bold text-slate-900">
                          {(printPreviewData.transferDhakaToNayan ?? 0).toLocaleString()} ৳
                        </td>
                      </tr>
                      <tr className="border-b border-slate-100">
                        <td className="py-1 text-slate-600">Dhaka to KHA Office</td>
                        <td className="py-1 text-right font-mono font-bold text-slate-900">
                          {(printPreviewData.transferDhakaToKha ?? 0).toLocaleString()} ৳
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Daily Closing Transaction Logs */}
              <div className="font-bold text-[9px] uppercase text-slate-400 tracking-wider mb-2 mt-5">
                Daily Closing Entry & Expense Logs
              </div>
              <div className="border-t border-b border-slate-200 py-1 mb-5 overflow-x-auto">
                {(() => {
                  const previewTxs = (transactions || []).filter(t => t.isDailyClosing === true && t.date === printPreviewData.date);
                  if (previewTxs.length === 0) {
                    return (
                      <div className="py-2 text-center text-slate-400 italic text-[10px]">
                        No entry statements or expense logs recorded for this day.
                      </div>
                    );
                  }
                  return (
                    <table className="w-full text-[10px] text-left">
                      <thead>
                        <tr className="border-b border-slate-200 pb-1 text-slate-500 font-bold">
                          <th className="py-1">CATEGORY</th>
                          <th className="py-1">METHOD</th>
                          <th className="py-1 text-right">TYPE</th>
                          <th className="py-1 text-right">AMOUNT</th>
                        </tr>
                      </thead>
                      <tbody>
                        {previewTxs.map((tx, idx) => {
                          const categoryLabel = getCategoryLabel(tx);
                          return (
                            <tr key={tx.id || idx} className="border-b border-slate-100">
                              <td className="py-1.5 font-semibold text-slate-700">{categoryLabel}</td>
                              <td className="py-1.5 text-slate-600 capitalize">{tx.paymentMethod || 'cash'}</td>
                              <td className={`py-1.5 text-right font-bold ${tx.type === 'income' ? 'text-emerald-600' : 'text-rose-600'}`}>
                                {tx.type === 'income' ? 'INFLOW' : 'OUTFLOW'}
                              </td>
                              <td className={`py-1.5 text-right font-mono font-bold ${tx.type === 'income' ? 'text-emerald-700' : 'text-rose-700'}`}>
                                {tx.type === 'income' ? '+' : '-'}{tx.amount.toLocaleString()} BDT
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  );
                })()}
              </div>

              {/* Financial Summary */}
              <div className="border border-slate-900 p-3 space-y-1.5 mb-5">
                <div className="flex justify-between font-bold">
                  <span>TOTAL OPENING BALANCE:</span>
                  <span>{totalOpenBal.toLocaleString()} BDT</span>
                </div>
                <div className="flex justify-between font-bold text-emerald-700">
                  <span>(+) TOTAL COLLECTION (INFLOW):</span>
                  <span>+ {totalIn.toLocaleString()} BDT</span>
                </div>
                <div className="flex justify-between font-bold text-rose-700">
                  <span>(-) TOTAL EXPENSE (OUTFLOW):</span>
                  <span>- {totalOut.toLocaleString()} BDT</span>
                </div>
                <div className="flex justify-between font-extrabold border-t border-slate-300 pt-1.5 text-xs text-slate-900">
                  <span>(=) GRAND CLOSING BALANCE:</span>
                  <span>{totalCloseBal.toLocaleString()} BDT</span>
                </div>
              </div>

              {/* Notes */}
              {printPreviewData.notes && (
                <div className="p-3 bg-slate-50 border border-slate-200/50 rounded-lg text-[10px] text-slate-500 mb-5 italic leading-relaxed">
                  <strong>Notes / Comments:</strong> {printPreviewData.notes}
                </div>
              )}

              {/* Signature Blocks */}
              <div className="mt-8 flex justify-between text-[10px] text-slate-500">
                <div className="border-t border-slate-950 w-28 pt-1 text-center">Prepared By</div>
                <div className="border-t border-slate-950 w-28 pt-1 text-center">Approved By</div>
              </div>
            </div>
          </div>

          {/* Action Footer */}
          <div className="flex items-center gap-3 mt-4 shrink-0 no-print">
            <button
              onClick={() => window.print()}
              className="flex-1 py-3 bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-2 transition cursor-pointer shadow-lg shadow-teal-600/10"
            >
              <Printer className="w-4 h-4" />
              <span>Print Formally</span>
            </button>
            <button
              onClick={() => handleDownloadClosingPDF(printPreviewData)}
              className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-2 transition cursor-pointer shadow-lg shadow-indigo-600/10"
            >
              <FileDown className="w-4 h-4" />
              <span>Download PDF</span>
            </button>
            <button
              onClick={() => setPrintPreviewData(null)}
              className="py-3 px-6 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition cursor-pointer"
            >
              Close Preview
            </button>
          </div>
        </div>
      </div>
    );
  };

  // Check if today is already closed
  const isDateAlreadyClosed = closings.some(c => c.date === selectedDate && c.status === 'closed');
  const activeClosingDoc = closings.find(c => c.date === selectedDate);

  return (
    <div className="space-y-6 animate-fade-in select-none">
      {/* Title Header */}
      <div className="bg-gradient-to-r from-slate-900 to-indigo-950 rounded-2xl p-6 text-white shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 translate-x-12 -translate-y-12 w-64 h-64 bg-indigo-500/10 rounded-full blur-2xl"></div>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div className="flex items-center gap-3.5">
            <span className="p-3 bg-indigo-500/20 text-indigo-400 rounded-xl border border-indigo-500/30">
              <Calculator className="w-6 h-6" />
            </span>
            <div>
              <h2 className="text-2xl font-black tracking-tight">Daily Closing Portal</h2>
              <p className="text-xs text-indigo-200/80 mt-0.5 font-medium">Manage and lock daily opening, collection, expense, and closing balances across all payment methods</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <div className="bg-slate-800/80 border border-slate-700/80 rounded-xl px-4 py-2 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-indigo-400" />
              <input 
                type="date" 
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="bg-transparent text-white font-mono text-xs focus:outline-none cursor-pointer"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Alert Messaging */}
      {error && (
        <div className="p-4 bg-rose-50 border border-rose-100 rounded-xl text-rose-700 text-xs flex items-center gap-2.5">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
          <span className="font-semibold">{error}</span>
        </div>
      )}

      {success && (
        <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-xl text-emerald-700 text-xs flex items-center gap-2.5">
          <CheckCircle className="w-4 h-4 shrink-0 text-emerald-500" />
          <span className="font-semibold">{success}</span>
        </div>
      )}

      {/* Main calculation workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Side 2-Columns: Daily Income Statement Entry Card */}
        <div className="lg:col-span-2 space-y-8">
          {/* Daily Income Statement Entry Card */}
          <div className="bg-white border-2 border-[#1a1a1e] p-8 shadow-[6px_6px_0_rgba(26,26,30,0.08)]">
            <div className="flex items-center justify-between border-b border-[#1a1a1e] pb-6 mb-8">
              <div className="flex items-center gap-4">
                <span className="p-3 bg-[#1a1a1e] text-white">
                  <PlusCircle className="w-6 h-6" />
                </span>
                <div>
                  <h3 className="font-syne text-xl font-bold uppercase tracking-tighter">Daily Income Entry</h3>
                  <p className="font-mono text-[10px] uppercase text-[#1a1a1e]/60">Record Date: {selectedDate}</p>
                </div>
              </div>
              {isDateAlreadyClosed && (
                <span className="flex items-center gap-2 text-xs bg-red-100 text-red-600 px-4 py-2 font-bold border-2 border-red-600">
                  <Lock className="w-4 h-4" /> Locked
                </span>
              )}
            </div>

            {/* Income Statement Entry Form */}
            {!isDateAlreadyClosed && (
              <form onSubmit={handleAddEntryStatement} className="grid grid-cols-1 sm:grid-cols-4 gap-6 items-end">
                <div className="input-group">
                  <label className="block font-mono text-[10px] uppercase text-[#1a1a1e]/60 mb-2">Category</label>
                  <select
                    value={entryCategory}
                    onChange={(e) => setEntryCategory(e.target.value)}
                    className="w-full text-sm p-3 border-2 border-[#1a1a1e] rounded-none font-mono cursor-pointer"
                  >
                    <option value="customer_bill">Customer Bill</option>
                    <option value="reseller_bill">Reseller Bill</option>
                    <option value="service_charge">Service Charge</option>
                    <option value="other_income">Other</option>
                  </select>
                </div>
                <div className="input-group">
                  <label className="block font-mono text-[10px] uppercase text-[#1a1a1e]/60 mb-2">Method</label>
                  <select
                    value={entryPaymentMethod}
                    onChange={(e) => setEntryPaymentMethod(e.target.value)}
                    className="w-full text-sm p-3 border-2 border-[#1a1a1e] rounded-none font-mono cursor-pointer"
                  >
                    <option value="cash">Cash</option>
                    <option value="bkash">bKash</option>
                    <option value="nagad">Nagad</option>
                    <option value="rocket">Rocket</option>
                    <option value="bank">Bank</option>
                    <option value="sslcommerz">SSL Commerz</option>
                  </select>
                </div>
                <div className="input-group">
                  <label className="block font-mono text-[10px] uppercase text-[#1a1a1e]/60 mb-2">Amount (BDT)</label>
                  <input
                    type="number"
                    placeholder="0.00"
                    value={entryAmount}
                    onChange={(e) => setEntryAmount(e.target.value)}
                    className="w-full text-sm p-3 border-2 border-[#1a1a1e] rounded-none font-mono"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full p-3 bg-[#1a1a1e] text-white font-bold text-sm uppercase tracking-wider hover:bg-[#6366f1] transition cursor-pointer"
                >
                  + Add Income
                </button>
              </form>
            )}

            {/* Income Statement Records Table removed as per user request */}
          </div>

          {/* Daily Expense Statement Entry Card */}
          <div className="bg-white border-2 border-[#1a1a1e] p-8 shadow-[6px_6px_0_rgba(26,26,30,0.08)]">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-5">
              <div className="flex items-center gap-2.5">
                <span className="p-2 bg-rose-50 text-rose-600 rounded-xl">
                  <TrendingDown className="w-5 h-5" />
                </span>
                <div>
                  <h3 className="text-sm font-extrabold text-slate-800">Daily Expense Statement Entry ({selectedDate})</h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">Daily expense records table by category and payment method</p>
                </div>
              </div>
              {isDateAlreadyClosed && (
                <span className="flex items-center gap-1 text-[10px] bg-rose-50 text-rose-600 px-2.5 py-1 rounded-full font-bold border border-rose-100">
                  <Lock className="w-3 h-3" /> Locked
                </span>
              )}
            </div>

            {/* Expense Statement Entry Form */}
            {!isDateAlreadyClosed && (
              <form onSubmit={handleAddExpenseEntryStatement} className="bg-slate-50 border border-slate-200/50 rounded-2xl p-4 mb-6 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 items-end">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Category</label>
                    <select
                      value={expenseCategory}
                      onChange={(e) => setExpenseCategory(e.target.value)}
                      className="w-full text-xs px-3 py-2 bg-white border border-slate-200 rounded-xl text-slate-700 focus:ring-1 focus:ring-indigo-500 focus:outline-none font-bold cursor-pointer"
                    >
                      {Object.entries(EXPENSE_CATEGORY_LABELS).map(([key, item]) => (
                        <option key={key} value={key}>
                          {item.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Payment Method</label>
                    <select
                      value={expensePaymentMethod}
                      onChange={(e) => setExpensePaymentMethod(e.target.value)}
                      className="w-full text-xs px-3 py-2 bg-white border border-slate-200 rounded-xl text-slate-700 focus:ring-1 focus:ring-indigo-500 focus:outline-none font-bold capitalize cursor-pointer"
                    >
                      <option value="cash">Cash</option>
                      <option value="bkash">bKash</option>
                      <option value="nagad">Nagad</option>
                      <option value="rocket">Rocket</option>
                      <option value="bank">Bank Transfer</option>
                      <option value="sslcommerz">SSL Commerz</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Today Expense (BDT)</label>
                    <input
                      type="number"
                      placeholder="Amount"
                      value={expenseAmount}
                      onChange={(e) => setExpenseAmount(e.target.value)}
                      className="w-full text-xs px-3 py-2 bg-white border border-slate-200 rounded-xl text-slate-700 focus:ring-1 focus:ring-indigo-500 focus:outline-none font-semibold font-mono"
                    />
                  </div>
                  <div>
                    <button
                      type="submit"
                      className="w-full py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition cursor-pointer"
                    >
                      <Plus className="w-4 h-4" /> Add Expense
                    </button>
                  </div>
                </div>
              </form>
            )}

            {/* Expense Statement Records Table removed as per user request */}
          </div>

          {/* Cash Drawer Statement Card */}
          {/* Cash Drawer Statement Card */}
          {currentUserProfile?.role !== 'accountant' && (
            <div id="cash-drawer-statement-card" className="bg-white rounded-2xl p-6 border border-slate-200/60 shadow-sm transition-all duration-300">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-5">
                <div className="flex items-center gap-2.5">
                  <span className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                    <Coins className="w-5 h-5" />
                  </span>
                  <div>
                    <h3 className="text-sm font-extrabold text-slate-800">Cash Drawer Statement ({selectedDate})</h3>
                    <p className="text-[11px] text-slate-400 mt-0.5">Summary of physical cash locations and transfers</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <button onClick={() => setIsMenuOpen(!isMenuOpen)} className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition cursor-pointer">
                      <MoreVertical className="w-4 h-4" />
                    </button>
                    {isMenuOpen && (
                      <div className="absolute right-0 top-full mt-2 w-40 bg-white border border-slate-200 rounded-xl shadow-lg z-50 p-2">
                        <button onClick={() => { setIsMenuOpen(false); alert('Action 1 clicked'); }} className="w-full text-left text-xs p-2 hover:bg-slate-50 rounded-lg font-semibold text-slate-700 cursor-pointer">View History</button>
                        <button onClick={() => { setIsMenuOpen(false); alert('Action 2 clicked'); }} className="w-full text-left text-xs p-2 hover:bg-slate-50 rounded-lg font-semibold text-slate-700 cursor-pointer">Export Data</button>
                      </div>
                    )}
                  </div>
                  {isDateAlreadyClosed ? (
                    <span className="flex items-center gap-1 text-[10px] bg-rose-50 text-rose-600 px-2.5 py-1 rounded-full font-bold border border-rose-100">
                      <Lock className="w-3 h-3" /> Locked
                    </span>
                  ) : isDrawerSubmitted ? (
                    <span className="flex items-center gap-1 text-[10px] bg-emerald-50 text-emerald-600 px-2.5 py-1 rounded-full font-bold border border-emerald-100 animate-pulse">
                      <CheckCircle className="w-3 h-3" /> Submitted
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-[10px] bg-indigo-50 text-indigo-600 px-2.5 py-1 rounded-full font-bold border border-indigo-100">
                      <Unlock className="w-3 h-3" /> Editable
                    </span>
                  )}
                </div>
              </div>

              {/* If NOT closed, show edit forms */}
              {!isDateAlreadyClosed ? (
                <div className="space-y-6">
                  <form onSubmit={handleDrawerSubmit} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* Cash Summary Details Form */}
                      <div className="border border-slate-200/60 rounded-2xl p-4 bg-slate-50/50">
                        <h4 className="text-xs font-black text-slate-700 uppercase tracking-wider mb-4 pb-2 border-b border-slate-200 flex items-center justify-between">
                          <span>Cash Summary Details</span>
                          <span className="text-[10px] font-bold text-slate-400">Amount (BDT)</span>
                        </h4>
                        <div className="space-y-3.5">
                          {[
                            { label: 'KHA Office Cash', value: khaOfficeCash, setter: setKhaOfficeCash, id: 'khaOfficeCash' },
                            { label: 'Dhaka office', value: dhakaOfficeCash, setter: setDhakaOfficeCash, id: 'dhakaOfficeCash' },
                            { label: 'Nayan Cash', value: nayanCash, setter: setNayanCash, id: 'nayanCash' },
                            { label: 'Account Cash', value: accountCash, setter: setAccountCash, id: 'accountCash' },
                          ].map((item) => (
                            <div key={item.id} className="flex items-center justify-between gap-4">
                              <label className="text-xs font-bold text-slate-600" htmlFor={item.id}>{item.label}</label>
                              <div className="relative w-36">
                                <span className="absolute left-3 top-2 text-[10px] font-bold text-slate-400">৳</span>
                                <input
                                  type="number"
                                  id={item.id}
                                  value={item.value}
                                  onChange={(e) => item.setter(e.target.value)}
                                  className="w-full text-xs pl-6 pr-3 py-1.5 bg-white border border-slate-200 rounded-xl text-slate-700 focus:ring-1 focus:ring-indigo-500 focus:outline-none font-bold font-mono text-right"
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Transfer Money Details Form */}
                      <div className="border border-slate-200/60 rounded-2xl p-4 bg-slate-50/50">
                        <h4 className="text-xs font-black text-slate-700 uppercase tracking-wider mb-4 pb-2 border-b border-slate-200 flex items-center justify-between">
                          <span>Transfer Money Details</span>
                          <span className="text-[10px] font-bold text-slate-400">Amount (BDT)</span>
                        </h4>
                        <div className="space-y-3.5">
                          {[
                            { label: 'KHA Office to Nayan', value: transferKhaToNayan, setter: setTransferKhaToNayan, id: 'transferKhaToNayan' },
                            { label: 'Nayan to Dhaka office', value: transferNayanToDhaka, setter: setTransferNayanToDhaka, id: 'transferNayanToDhaka' },
                            { label: 'Dhaka office to Nayan', value: transferDhakaToNayan, setter: setTransferDhakaToNayan, id: 'transferDhakaToNayan' },
                            { label: 'Dhaka office to KHA Office', value: transferDhakaToKha, setter: setTransferDhakaToKha, id: 'transferDhakaToKha' },
                          ].map((item) => (
                            <div key={item.id} className="flex items-center justify-between gap-4">
                              <label className="text-xs font-bold text-slate-600" htmlFor={item.id}>{item.label}</label>
                              <div className="relative w-36">
                                <span className="absolute left-3 top-2 text-[10px] font-bold text-slate-400">৳</span>
                                <input
                                  type="number"
                                  id={item.id}
                                  value={item.value}
                                  onChange={(e) => item.setter(e.target.value)}
                                  className="w-full text-xs pl-6 pr-3 py-1.5 bg-white border border-slate-200 rounded-xl text-slate-700 focus:ring-1 focus:ring-indigo-500 focus:outline-none font-bold font-mono text-right"
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="flex justify-end pt-2">
                      <button
                        type="submit"
                        className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold rounded-xl text-xs flex items-center gap-2 shadow-lg shadow-indigo-600/20 transition cursor-pointer"
                      >
                        <CheckCircle className="w-4 h-4" />
                        Submit Drawer Statement
                      </button>
                    </div>
                  </form>

                  {/* If submitted, show beautiful statement layout underneath (niche diye) */}
                  {isDrawerSubmitted && (
                    <div className="border-t border-slate-100 pt-6 mt-6">
                      <div className="bg-slate-50 border border-indigo-100 rounded-2xl p-5 relative overflow-hidden">
                        <div className="absolute right-0 top-0 translate-x-10 -translate-y-10 w-40 h-40 bg-indigo-500/5 rounded-full blur-xl"></div>
                        
                        <div className="flex items-center justify-between border-b border-slate-200/80 pb-3.5 mb-4">
                          <div>
                            <h4 className="text-xs font-black text-indigo-950 uppercase tracking-wider flex items-center gap-1.5">
                              <FileText className="w-4 h-4 text-indigo-600" />
                              <span>Cash Drawer Official Statement</span>
                            </h4>
                            <p className="text-[10px] text-slate-400 font-medium">Record Date: {selectedDate} • Status: Verified Draft</p>
                          </div>
                          <button
                            type="button"
                            onClick={handleModifyDrawer}
                            className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 text-[10px] font-bold rounded-lg transition-all flex items-center gap-1 border border-rose-100 cursor-pointer"
                          >
                            Clear/Reset Statement
                          </button>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          {/* Cash Summary Column */}
                          <div>
                            <h5 className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-3 pb-1 border-b border-slate-100 flex items-center justify-between">
                              <span>Physical Cash summary</span>
                              <span>Amount (৳)</span>
                            </h5>
                            <div className="space-y-2 text-xs">
                              <div className="flex justify-between py-1 border-b border-dashed border-slate-200">
                                <span className="text-slate-500 font-medium">KHA Office Cash</span>
                                <span className="font-mono font-bold text-slate-800">{parseFloat(khaOfficeCash || '0').toLocaleString()} ৳</span>
                              </div>
                              <div className="flex justify-between py-1 border-b border-dashed border-slate-200">
                                <span className="text-slate-500 font-medium">Dhaka Office Cash</span>
                                <span className="font-mono font-bold text-slate-800">{parseFloat(dhakaOfficeCash || '0').toLocaleString()} ৳</span>
                              </div>
                              <div className="flex justify-between py-1 border-b border-dashed border-slate-200">
                                <span className="text-slate-500 font-medium">Nayan Cash</span>
                                <span className="font-mono font-bold text-slate-800">{parseFloat(nayanCash || '0').toLocaleString()} ৳</span>
                              </div>
                              <div className="flex justify-between py-1 border-b border-dashed border-slate-200">
                                <span className="text-slate-500 font-medium">Account Cash</span>
                                <span className="font-mono font-bold text-slate-800">{parseFloat(accountCash || '0').toLocaleString()} ৳</span>
                              </div>
                              <div className="flex justify-between pt-2.5 pb-1 text-indigo-700 font-bold border-t border-slate-200">
                                <span>Total Physical Cash</span>
                                <span className="font-mono text-sm font-black">
                                  {(parseFloat(khaOfficeCash || '0') + parseFloat(dhakaOfficeCash || '0') + parseFloat(nayanCash || '0') + parseFloat(accountCash || '0')).toLocaleString()} ৳
                                </span>
                              </div>
                            </div>
                          </div>
                          {/* Transfer Column */}
                          <div>
                            <h5 className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-3 pb-1 border-b border-slate-100 flex items-center justify-between">
                              <span>Transfer Details</span>
                              <span>Amount (৳)</span>
                            </h5>
                            <div className="space-y-2 text-xs">
                              <div className="flex justify-between py-1 border-b border-dashed border-slate-200">
                                <span className="text-slate-500 font-medium">KHA to Nayan</span>
                                <span className="font-mono font-bold text-slate-800">{parseFloat(transferKhaToNayan || '0').toLocaleString()} ৳</span>
                              </div>
                              <div className="flex justify-between py-1 border-b border-dashed border-slate-200">
                                <span className="text-slate-500 font-medium">Nayan to Dhaka</span>
                                <span className="font-mono font-bold text-slate-800">{parseFloat(transferNayanToDhaka || '0').toLocaleString()} ৳</span>
                              </div>
                              <div className="flex justify-between py-1 border-b border-dashed border-slate-200">
                                <span className="text-slate-500 font-medium">Dhaka to Nayan</span>
                                <span className="font-mono font-bold text-slate-800">{parseFloat(transferDhakaToNayan || '0').toLocaleString()} ৳</span>
                              </div>
                              <div className="flex justify-between py-1 border-b border-dashed border-slate-200">
                                <span className="text-slate-500 font-medium">Dhaka to KHA</span>
                                <span className="font-mono font-bold text-slate-800">{parseFloat(transferDhakaToKha || '0').toLocaleString()} ৳</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-xs text-slate-400 font-bold">This day is closed and locked. Drawer statement submitted.</p>
                </div>
              )}
            </div>
          )}

                  /* If closed, show ONLY the beautiful report layout */
                  <div className="space-y-6">
                    <div className="bg-slate-50 border border-indigo-100 rounded-2xl p-5 relative overflow-hidden">
                      <div className="absolute right-0 top-0 translate-x-10 -translate-y-10 w-40 h-40 bg-indigo-500/5 rounded-full blur-xl"></div>
                      
                      <div className="flex items-center justify-between border-b border-slate-200/80 pb-3.5 mb-4">
                        <div>
                          <h4 className="text-xs font-black text-indigo-950 uppercase tracking-wider flex items-center gap-1.5">
                            <FileText className="w-4 h-4 text-indigo-600" />
                            <span>Cash Drawer Official Statement</span>
                          </h4>
                          <p className="text-[10px] text-slate-400 font-medium">Record Date: {selectedDate} • Status: Locked &amp; Closed</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Cash Summary Column */}
                        <div>
                          <h5 className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-3 pb-1 border-b border-slate-100 flex items-center justify-between">
                            <span>Physical Cash summary</span>
                            <span>Amount (৳)</span>
                          </h5>
                          <div className="space-y-2 text-xs">
                            <div className="flex justify-between py-1 border-b border-dashed border-slate-200">
                              <span className="text-slate-500 font-medium">KHA Office Cash</span>
                              <span className="font-mono font-bold text-slate-800">{parseFloat(khaOfficeCash || '0').toLocaleString()} ৳</span>
                            </div>
                            <div className="flex justify-between py-1 border-b border-dashed border-slate-200">
                              <span className="text-slate-500 font-medium">Dhaka Office Cash</span>
                              <span className="font-mono font-bold text-slate-800">{parseFloat(dhakaOfficeCash || '0').toLocaleString()} ৳</span>
                            </div>
                            <div className="flex justify-between py-1 border-b border-dashed border-slate-200">
                              <span className="text-slate-500 font-medium">Nayan Cash</span>
                              <span className="font-mono font-bold text-slate-800">{parseFloat(nayanCash || '0').toLocaleString()} ৳</span>
                            </div>
                            <div className="flex justify-between py-1 border-b border-dashed border-slate-200">
                              <span className="text-slate-500 font-medium">Account Cash</span>
                              <span className="font-mono font-bold text-slate-800">{parseFloat(accountCash || '0').toLocaleString()} ৳</span>
                            </div>
                            <div className="flex justify-between pt-2.5 pb-1 text-indigo-700 font-bold border-t border-slate-200">
                              <span>Total Physical Cash</span>
                              <span className="font-mono text-sm font-black">
                                {(parseFloat(khaOfficeCash || '0') + parseFloat(dhakaOfficeCash || '0') + parseFloat(nayanCash || '0') + parseFloat(accountCash || '0')).toLocaleString()} ৳
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Transfers Column */}
                        <div>
                          <h5 className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-3 pb-1 border-b border-slate-100 flex items-center justify-between">
                            <span>Money Transfers</span>
                            <span>Amount (৳)</span>
                          </h5>
                          <div className="space-y-2 text-xs">
                            <div className="flex justify-between py-1 border-b border-dashed border-slate-200">
                              <span className="text-slate-500 font-medium">KHA Office to Nayan</span>
                              <span className="font-mono font-bold text-slate-800">{parseFloat(transferKhaToNayan || '0').toLocaleString()} ৳</span>
                            </div>
                            <div className="flex justify-between py-1 border-b border-dashed border-slate-200">
                              <span className="text-slate-500 font-medium">Nayan to Dhaka office</span>
                              <span className="font-mono font-bold text-slate-800">{parseFloat(transferNayanToDhaka || '0').toLocaleString()} ৳</span>
                            </div>
                            <div className="flex justify-between py-1 border-b border-dashed border-slate-200">
                              <span className="text-slate-500 font-medium">Dhaka office to Nayan</span>
                              <span className="font-mono font-bold text-slate-800">{parseFloat(transferDhakaToNayan || '0').toLocaleString()} ৳</span>
                            </div>
                            <div className="flex justify-between py-1 border-b border-dashed border-slate-200">
                              <span className="text-slate-500 font-medium">Dhaka office to KHA Office</span>
                              <span className="font-mono font-bold text-slate-800">{parseFloat(transferDhakaToKha || '0').toLocaleString()} ৳</span>
                            </div>
                            <div className="flex justify-between pt-2.5 pb-1 text-slate-700 font-bold border-t border-slate-200">
                              <span>Total Cash Transfers</span>
                              <span className="font-mono text-sm font-extrabold text-slate-800">
                                {(parseFloat(transferKhaToNayan || '0') + parseFloat(transferNayanToDhaka || '0') + parseFloat(transferDhakaToNayan || '0') + parseFloat(transferDhakaToKha || '0')).toLocaleString()} ৳
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

        </div>
        {/* Right Column: Submission Form / Closing Status */}
        <div className="space-y-6">
          <div className="bg-white rounded-2xl p-6 border border-slate-200/60 shadow-sm flex flex-col gap-5">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-4">
              <span className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg">
                <Check className="w-4 h-4" />
              </span>
              <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider">Closing Summary</h3>
            </div>

            {/* Aggregated totals visualization */}
            <div className="space-y-3 font-mono">
              <div className="p-3 bg-slate-50 rounded-xl flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-3.5 h-3.5 text-slate-500" />
                  <span className="text-[11px] font-semibold text-slate-500">Total Opening:</span>
                </div>
                <span className="text-xs font-bold text-slate-700">{totalOpening.toLocaleString()} BDT</span>
              </div>

              <div className="p-3 bg-emerald-50/50 rounded-xl flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="text-[11px] font-semibold text-emerald-600">Total Collection (Inflow):</span>
                </div>
                <span className="text-xs font-extrabold text-emerald-600">+{totalInflow.toLocaleString()} BDT</span>
              </div>

              <div className="p-3 bg-rose-50/50 rounded-xl flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <TrendingDown className="w-3.5 h-3.5 text-rose-600" />
                  <span className="text-[11px] font-semibold text-rose-600">Total Expense (Outflow):</span>
                </div>
                <span className="text-xs font-extrabold text-rose-600">-{totalOutflow.toLocaleString()} BDT</span>
              </div>

              <div className="p-3.5 bg-indigo-50 border border-indigo-100 rounded-xl flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Lock className="w-3.5 h-3.5 text-indigo-600" />
                  <span className="text-xs font-bold text-indigo-700">Grand Closing:</span>
                </div>
                <span className="text-sm font-black text-indigo-800">{totalClosing.toLocaleString()} BDT</span>
              </div>
            </div>

            {/* Notes Input / Display */}
            {isDateAlreadyClosed ? (
              activeClosingDoc?.notes ? (
                <div className="space-y-2">
                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Special Notes / Comments:</label>
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 font-semibold italic whitespace-pre-wrap">
                    {activeClosingDoc.notes}
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Special Notes / Comments:</label>
                  <div className="p-3 bg-slate-50 border border-slate-200/50 rounded-xl text-xs text-slate-400 italic font-medium">
                    No special notes entered for this day.
                  </div>
                </div>
              )
            ) : (
              <div className="space-y-2">
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Special Notes / Comments (Optional):</label>
                <textarea 
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Enter additional details, deposit notes, or daily remarks..."
                  rows={3}
                  className="w-full text-xs p-3 border border-slate-200 rounded-xl focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                ></textarea>
              </div>
            )}

            {/* Action Buttons */}
            <div className="space-y-3">
              {isDateAlreadyClosed ? (
                <div className="space-y-3">
                  <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2.5 justify-center">
                    <CheckCircle className="w-4.5 h-4.5 text-emerald-600" />
                    <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wide">Account Successfully Closed & Locked</span>
                  </div>
                  <button 
                    type="button"
                    onClick={handlePrintCurrent}
                    className="w-full py-2.5 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 transition cursor-pointer shadow-md shadow-teal-600/10"
                  >
                    <Printer className="w-4 h-4" />
                    <span>Print Closing Report</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleReopenClosing(`dc_${userId}_${selectedDate}`, selectedDate)}
                    className="w-full py-2.5 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 font-bold rounded-xl text-xs flex items-center justify-center gap-2 transition cursor-pointer"
                  >
                    <Unlock className="w-4 h-4" />
                    <span>Reopen / Unlock Day</span>
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <button 
                    onClick={handleSaveClosing}
                    className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 transition cursor-pointer shadow-lg shadow-indigo-600/20"
                  >
                    <Lock className="w-4 h-4" />
                    <span>Complete & Lock Day</span>
                  </button>
                  <button 
                    type="button"
                    onClick={handlePrintCurrent}
                    className="w-full py-2.5 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 transition cursor-pointer shadow-md shadow-teal-600/10"
                  >
                    <Printer className="w-4 h-4" />
                    <span>Print Preview Report</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Daily Closings Historical Grid */}
      <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex flex-col xl:flex-row xl:items-center justify-between gap-4 bg-slate-50/50">
          <div className="flex items-center gap-2">
            <FileText className="w-4.5 h-4.5 text-indigo-600" />
            <h3 className="text-sm font-extrabold text-slate-800">Historical Daily Closing Logs</h3>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs">
            {/* Download PDF report button */}
            <button
              onClick={handleDownloadPDFLogs}
              title="Download PDF report for current filtered daily closing logs"
              className="flex items-center gap-1.5 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-sm hover:shadow transition-all cursor-pointer"
            >
              <FileDown className="w-3.5 h-3.5 text-indigo-100" />
              Download PDF Report
            </button>

            {/* Monthly Summary direct Print button */}
            <button
              onClick={handlePrintLogsSummary}
              title="Print summary of daily closing logs"
              className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-sm hover:shadow transition-all cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5 text-emerald-100" />
              Current Month Summary (Print)
            </button>

            {/* Export CSV button */}
            <button
              onClick={handleExportCSVLogs}
              title="Export filtered daily closing logs as CSV"
              className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold shadow-sm hover:shadow transition-all cursor-pointer"
            >
              <FileDown className="w-3.5 h-3.5 text-slate-300" />
              Export CSV
            </button>

            {/* Quick buttons: All, Income, Expense */}
            <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200/40">
              <button
                onClick={() => { setTypeFilter('all'); setCategoryFilter('all'); }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  typeFilter === 'all' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                All
              </button>
              <button
                onClick={() => { setTypeFilter('income'); setCategoryFilter('all'); }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  typeFilter === 'income' ? 'bg-emerald-50 text-emerald-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                Income
              </button>
              <button
                onClick={() => { setTypeFilter('expense'); setCategoryFilter('all'); }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  typeFilter === 'expense' ? 'bg-rose-50 text-rose-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                Expense
              </button>
            </div>
          </div>
        </div>

        {/* Filters Container */}
        <div className="p-4 bg-slate-50/40 border-b border-slate-100 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Search */}
            <div className="relative">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1 block">Search Logs</label>
              <div className="relative">
                <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search category, notes, method, amount..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 bg-white text-slate-800 font-medium"
                />
              </div>
            </div>

            {/* Category Dropdown */}
            <div className="relative">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1 block">Category Filter</label>
              <div className="relative">
                <Filter className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="w-full pl-9 pr-8 py-2 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 bg-white text-slate-700 font-medium appearance-none cursor-pointer"
                >
                  <option value="all">All Categories</option>
                  {typeFilter === 'all' || typeFilter === 'income' ? (
                    <optgroup label="Income Categories">
                      <option value="customer_bill">Customer Bill Collection</option>
                      <option value="reseller_bill">Reseller Bill Collection</option>
                      <option value="service_charge">Service Charge Collection</option>
                      <option value="other_income">Other Income</option>
                    </optgroup>
                  ) : null}
                  {typeFilter === 'all' || typeFilter === 'expense' ? (
                    <optgroup label="Expense Categories">
                      {Object.entries(EXPENSE_CATEGORY_LABELS).map(([key, item]) => (
                        <option key={key} value={key}>
                          {item.label}
                        </option>
                      ))}
                    </optgroup>
                  ) : null}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-400">
                  <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                    <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/>
                  </svg>
                </div>
              </div>
            </div>

            {/* Date Filter Quick Options */}
            <div className="relative">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1 block">Date Filter</label>
              <div className="relative">
                <Calendar className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                <select
                  value={quickDateFilter}
                  onChange={(e) => {
                    const val = e.target.value;
                    setQuickDateFilter(val);
                    if (val !== 'custom') {
                      setStartDate('');
                      setEndDate('');
                    }
                  }}
                  className="w-full pl-9 pr-8 py-2 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 bg-white text-slate-700 font-medium appearance-none cursor-pointer"
                >
                  <option value="all">All Time</option>
                  <option value="today">Today</option>
                  <option value="this-month">This Month</option>
                  <option value="last-month">Last Month</option>
                  <option value="custom">Custom Range</option>
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-400">
                  <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                    <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/>
                  </svg>
                </div>
              </div>
            </div>

            {/* Sort Order */}
            <div className="relative">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1 block">Sort Order</label>
              <div className="relative">
                <Calendar className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                <select
                  value={sortOrder}
                  onChange={(e) => setSortOrder(e.target.value as any)}
                  className="w-full pl-9 pr-8 py-2 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 bg-white text-slate-700 font-medium appearance-none cursor-pointer"
                >
                  <option value="newest">Newest First</option>
                  <option value="oldest">Oldest First</option>
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-400">
                  <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                    <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/>
                  </svg>
                </div>
              </div>
            </div>
          </div>

          {/* Custom Date Inputs */}
          {quickDateFilter === 'custom' && (
            <div className="grid grid-cols-2 gap-3 p-3 bg-indigo-50/40 rounded-xl border border-indigo-100/50">
              <div>
                <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-1 block">Start Date</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs bg-white text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-1 block">End Date</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs bg-white text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
            </div>
          )}

          {/* Reset Filters Bar */}
          {(searchTerm !== '' || typeFilter !== 'all' || categoryFilter !== 'all' || quickDateFilter !== 'all' || startDate !== '' || endDate !== '') && (
            <div className="flex items-center justify-between text-[11px] bg-slate-100 px-3 py-2 rounded-xl border border-slate-200/50">
              <span className="text-slate-500 font-semibold">
                Active Filters: {typeFilter !== 'all' ? `Type (${typeFilter})` : ''} 
                {categoryFilter !== 'all' ? ` • Category (${categoryFilter})` : ''} 
                {searchTerm !== '' ? ` • Keyword ("${searchTerm}")` : ''} 
                {quickDateFilter !== 'all' ? ` • Date (${quickDateFilter === 'custom' ? `${startDate || 'Start'} to ${endDate || 'End'}` : quickDateFilter})` : ''}
              </span>
              <button
                onClick={() => {
                  setSearchTerm('');
                  setTypeFilter('all');
                  setCategoryFilter('all');
                  setQuickDateFilter('all');
                  setStartDate('');
                  setEndDate('');
                  setSortOrder('newest');
                }}
                className="text-[11px] text-indigo-600 hover:text-indigo-800 font-extrabold hover:underline cursor-pointer flex items-center gap-1"
              >
                Clear All
              </button>
            </div>
          )}
        </div>

        {loading ? (
          <div className="p-8 text-center text-slate-400 font-medium text-xs">Loading data, please wait...</div>
        ) : dailyClosingTxs.length === 0 ? (
          <div className="p-12 text-center text-slate-400 font-semibold text-xs flex flex-col items-center gap-2 bg-slate-50/20">
            <AlertCircle className="w-8 h-8 text-slate-300" />
            <span>
              {(searchTerm !== '' || typeFilter !== 'all' || categoryFilter !== 'all' || quickDateFilter !== 'all' || startDate !== '' || endDate !== '') 
                ? "No daily closing transactions match your search filter criteria." 
                : "No daily closing statements or expense entries found."}
            </span>
            {(searchTerm !== '' || typeFilter !== 'all' || categoryFilter !== 'all' || quickDateFilter !== 'all' || startDate !== '' || endDate !== '') && (
              <button
                onClick={() => {
                  setSearchTerm('');
                  setTypeFilter('all');
                  setCategoryFilter('all');
                  setQuickDateFilter('all');
                  setStartDate('');
                  setEndDate('');
                  setSortOrder('newest');
                }}
                className="mt-2 px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl text-xs font-bold transition cursor-pointer"
              >
                Reset Filter Criteria
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/50 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  <th className="py-3 px-4">S/L</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4">Payment Method</th>
                  <th className="py-3 px-4 text-right">Income / Expense</th>
                  <th className="py-3 px-4 text-right">Previous Balance</th>
                  <th className="py-3 px-4 text-right">Closing Balance</th>
                  <th className="py-3 px-6 text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {dailyClosingTxs.map((tx, idx) => {
                  const prevBal = getPrevBalanceForTx(tx);
                  const closingBal = tx.type === 'income' ? prevBal + tx.amount : prevBal - tx.amount;
                  const categoryLabel = getCategoryLabel(tx);
                  const isTxDateClosed = closings.some(c => c.date === tx.date && c.status === 'closed');

                  return (
                    <tr key={tx.id} className="border-b border-slate-100/70 hover:bg-slate-50/50 transition">
                      <td className="py-3 px-4 text-xs font-mono text-slate-500">{idx + 1}</td>
                      <td className="py-3 px-4 text-xs font-mono font-semibold text-slate-600">{tx.date}</td>
                      <td className="py-3 px-4 text-xs font-bold text-slate-700">{categoryLabel}</td>
                      <td className="py-3 px-4 text-xs text-slate-600">
                        <span className="inline-flex items-center gap-1.5 bg-slate-100 px-2.5 py-0.5 rounded-full text-[10px] font-bold text-slate-600 capitalize">
                          {tx.paymentMethod || 'cash'}
                        </span>
                      </td>
                      <td className={`py-3 px-4 text-xs font-mono font-bold text-right ${tx.type === 'income' ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {tx.type === 'income' ? '+' : '-'}{(tx.amount ?? 0).toLocaleString()} BDT
                      </td>
                      <td className="py-3 px-4 text-xs font-mono text-right text-slate-500">
                        {(prevBal ?? 0).toLocaleString()} BDT
                      </td>
                      <td className="py-3 px-4 text-xs font-mono font-extrabold text-right text-indigo-900">
                        {(closingBal ?? 0).toLocaleString()} BDT
                      </td>
                      <td className="py-3 px-6 text-center">
                        {isTxDateClosed ? (
                          <div className="flex items-center justify-center gap-1.5">
                            <div className="inline-flex items-center gap-1 text-[10px] text-rose-500 font-bold bg-rose-50/50 px-2 py-0.5 rounded-full border border-rose-100">
                              <Lock className="w-3 h-3" /> Locked
                            </div>
                            <button
                              type="button"
                              onClick={() => handleReopenClosing(`dc_${userId}_${tx.date}`, tx.date)}
                              className="p-1 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded transition cursor-pointer"
                              title="Unlock / Reopen this day to edit or delete"
                            >
                              <Unlock className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-center gap-2">
                            <button
                              type="button"
                              onClick={() => handleStartEdit(tx)}
                              className="p-1.5 text-slate-400 hover:text-indigo-600 rounded-lg hover:bg-indigo-50/80 transition cursor-pointer"
                              title="Edit statement entry"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteEntryStatement(tx.id)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition cursor-pointer"
                              title="Delete statement entry"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Closing Detail View Modal */}
      {selectedClosing && (
        <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 shadow-2xl relative overflow-hidden animate-scale-up">
            <div className="absolute right-0 top-0 translate-x-12 -translate-y-12 w-32 h-32 bg-slate-100 rounded-full"></div>
            
            <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-4 relative z-10">
              <div className="flex items-center gap-2.5">
                <span className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                  <Calculator className="w-5 h-5" />
                </span>
                <div>
                  <h3 className="text-base font-extrabold text-slate-800">Daily Closing Detailed View</h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">Date: {selectedClosing.date}</p>
                </div>
              </div>
              <button 
                onClick={() => setSelectedClosing(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-50"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
              <div className="grid grid-cols-5 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 pb-2">
                <div className="col-span-2">Payment Method</div>
                <div className="text-right">Opening Balance</div>
                <div className="text-right">Inflow (+In)</div>
                <div className="text-right">Closing Balance</div>
              </div>

              {/* Cash */}
              <div className="grid grid-cols-5 items-center text-xs font-medium py-1.5 border-b border-slate-50">
                <div className="col-span-2 flex items-center gap-2.5">
                  <PaymentMethodLogo method="cash" className="w-6 h-6" />
                  <span>Cash</span>
                </div>
                <div className="text-right font-mono text-slate-600">{selectedClosing.openingCash.toLocaleString()}</div>
                <div className="text-right font-mono text-emerald-600">+{selectedClosing.totalCashIn.toLocaleString()}</div>
                <div className="text-right font-mono text-slate-800 font-bold">{selectedClosing.closingCash.toLocaleString()}</div>
              </div>

              {/* bKash */}
              <div className="grid grid-cols-5 items-center text-xs font-medium py-1.5 border-b border-slate-50">
                <div className="col-span-2 flex items-center gap-2.5">
                  <PaymentMethodLogo method="bkash" className="w-6 h-6" />
                  <span>bKash</span>
                </div>
                <div className="text-right font-mono text-slate-600">{selectedClosing.openingBkash.toLocaleString()}</div>
                <div className="text-right font-mono text-emerald-600">+{selectedClosing.totalBkashIn.toLocaleString()}</div>
                <div className="text-right font-mono text-slate-800 font-bold">{selectedClosing.closingBkash.toLocaleString()}</div>
              </div>

              {/* Nagad */}
              <div className="grid grid-cols-5 items-center text-xs font-medium py-1.5 border-b border-slate-50">
                <div className="col-span-2 flex items-center gap-2.5">
                  <PaymentMethodLogo method="nagad" className="w-6 h-6" />
                  <span>Nagad</span>
                </div>
                <div className="text-right font-mono text-slate-600">{selectedClosing.openingNagad.toLocaleString()}</div>
                <div className="text-right font-mono text-emerald-600">+{selectedClosing.totalNagadIn.toLocaleString()}</div>
                <div className="text-right font-mono text-slate-800 font-bold">{selectedClosing.closingNagad.toLocaleString()}</div>
              </div>

              {/* Rocket */}
              <div className="grid grid-cols-5 items-center text-xs font-medium py-1.5 border-b border-slate-50">
                <div className="col-span-2 flex items-center gap-2.5">
                  <PaymentMethodLogo method="rocket" className="w-6 h-6" />
                  <span>Rocket</span>
                </div>
                <div className="text-right font-mono text-slate-600">{selectedClosing.openingRocket.toLocaleString()}</div>
                <div className="text-right font-mono text-emerald-600">+{selectedClosing.totalRocketIn.toLocaleString()}</div>
                <div className="text-right font-mono text-slate-800 font-bold">{selectedClosing.closingRocket.toLocaleString()}</div>
              </div>

              {/* Bank */}
              <div className="grid grid-cols-5 items-center text-xs font-medium py-1.5 border-b border-slate-50">
                <div className="col-span-2 flex items-center gap-2.5">
                  <PaymentMethodLogo method="bank" className="w-6 h-6" />
                  <span>Bank Transfer</span>
                </div>
                <div className="text-right font-mono text-slate-600">{selectedClosing.openingBank.toLocaleString()}</div>
                <div className="text-right font-mono text-emerald-600">+{selectedClosing.totalBankIn.toLocaleString()}</div>
                <div className="text-right font-mono text-slate-800 font-bold">{selectedClosing.closingBank.toLocaleString()}</div>
              </div>

              {/* SSL */}
              <div className="grid grid-cols-5 items-center text-xs font-medium py-1.5 border-b border-slate-100">
                <div className="col-span-2 flex items-center gap-2.5">
                  <PaymentMethodLogo method="sslcommerz" className="w-6 h-6" />
                  <span>SSL Commerz</span>
                </div>
                <div className="text-right font-mono text-slate-600">{selectedClosing.openingSsl.toLocaleString()}</div>
                <div className="text-right font-mono text-emerald-600">+{selectedClosing.totalSslIn.toLocaleString()}</div>
                <div className="text-right font-mono text-slate-800 font-bold">{selectedClosing.closingSsl.toLocaleString()}</div>
              </div>

              {/* Total Summary Row */}
              <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4 space-y-2 mt-4 font-mono text-xs font-semibold text-slate-700">
                <div className="flex justify-between">
                  <span>Total Opening Balance:</span>
                  <span>{(selectedClosing.openingCash + selectedClosing.openingBkash + selectedClosing.openingNagad + selectedClosing.openingRocket + selectedClosing.openingBank + selectedClosing.openingSsl).toLocaleString()} BDT</span>
                </div>
                <div className="flex justify-between text-emerald-600">
                  <span>(+) Total Collection (Inflow):</span>
                  <span>+{(selectedClosing.totalCashIn + selectedClosing.totalBkashIn + selectedClosing.totalNagadIn + selectedClosing.totalRocketIn + selectedClosing.totalBankIn + selectedClosing.totalSslIn).toLocaleString()} BDT</span>
                </div>
                <div className="flex justify-between text-rose-600">
                  <span>(-) Total Expense (Outflow):</span>
                  <span>-{(selectedClosing.totalCashOut + selectedClosing.totalBkashOut + selectedClosing.totalNagadOut + selectedClosing.totalRocketOut + selectedClosing.totalBankOut + selectedClosing.totalSslOut).toLocaleString()} BDT</span>
                </div>
                <div className="flex justify-between border-t border-indigo-100 pt-2 text-indigo-900 font-extrabold text-sm">
                  <span>(=) Grand Closing Balance:</span>
                  <span>{(selectedClosing.closingCash + selectedClosing.closingBkash + selectedClosing.closingNagad + selectedClosing.closingRocket + selectedClosing.closingBank + selectedClosing.closingSsl).toLocaleString()} BDT</span>
                </div>
              </div>

              {/* Cash Drawer Statement inside Modal */}
              <div className="border border-slate-100 rounded-2xl p-4 bg-slate-50/50 mt-4">
                <h4 className="text-[11px] font-black text-slate-500 uppercase tracking-wider mb-3 pb-1 border-b border-slate-200 flex items-center gap-1.5">
                  <Coins className="w-3.5 h-3.5 text-indigo-500" />
                  <span>Cash Drawer Statement</span>
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Cash Summary Details */}
                  <div className="bg-white border border-slate-100 rounded-xl p-3">
                    <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2">Cash Summary</h5>
                    <div className="space-y-1.5 text-xs">
                      <div className="flex justify-between">
                        <span className="text-slate-500 font-medium">KHA Office Cash:</span>
                        <span className="font-bold font-mono text-slate-700">{(selectedClosing.khaOfficeCash ?? 0).toLocaleString()} ৳</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500 font-medium">Dhaka office:</span>
                        <span className="font-bold font-mono text-slate-700">{(selectedClosing.dhakaOfficeCash ?? 0).toLocaleString()} ৳</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500 font-medium">Nayan Cash:</span>
                        <span className="font-bold font-mono text-slate-700">{(selectedClosing.nayanCash ?? 0).toLocaleString()} ৳</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500 font-medium">Account Cash:</span>
                        <span className="font-bold font-mono text-slate-700">{(selectedClosing.accountCash ?? 0).toLocaleString()} ৳</span>
                      </div>
                    </div>
                  </div>

                  {/* Transfer Money Details */}
                  <div className="bg-white border border-slate-100 rounded-xl p-3">
                    <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2">Transfer Money</h5>
                    <div className="space-y-1.5 text-xs">
                      <div className="flex justify-between">
                        <span className="text-slate-500 font-medium">KHA Office to Nayan:</span>
                        <span className="font-bold font-mono text-slate-700">{(selectedClosing.transferKhaToNayan ?? 0).toLocaleString()} ৳</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500 font-medium">Nayan to Dhaka office:</span>
                        <span className="font-bold font-mono text-slate-700">{(selectedClosing.transferNayanToDhaka ?? 0).toLocaleString()} ৳</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500 font-medium">Dhaka office to Nayan:</span>
                        <span className="font-bold font-mono text-slate-700">{(selectedClosing.transferDhakaToNayan ?? 0).toLocaleString()} ৳</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500 font-medium">Dhaka office to KHA Office:</span>
                        <span className="font-bold font-mono text-slate-700">{(selectedClosing.transferDhakaToKha ?? 0).toLocaleString()} ৳</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {selectedClosing.notes && (
                <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl text-xs text-slate-500 mt-3 font-medium">
                  <strong>Notes / Comments:</strong> {selectedClosing.notes}
                </div>
              )}
            </div>

            <div className="flex items-center gap-3 mt-6">
              <button
                onClick={() => handlePrint(selectedClosing)}
                className="flex-1 py-2.5 bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-2 transition cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                <span>Print Report</span>
              </button>
              <button
                onClick={() => handleDownloadClosingPDF(selectedClosing)}
                className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-2 transition cursor-pointer shadow-lg shadow-indigo-600/10"
              >
                <FileDown className="w-4 h-4" />
                <span>Download PDF</span>
              </button>
              <button
                onClick={() => setSelectedClosing(null)}
                className="py-2.5 px-5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Editing Transaction Statement Modal */}
      {editingTx && (
        <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4">
          <form onSubmit={handleEditTxSubmit} className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl relative overflow-hidden animate-scale-up">
            <div className="absolute right-0 top-0 translate-x-12 -translate-y-12 w-32 h-32 bg-indigo-50 rounded-full"></div>
            
            <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-4 relative z-10">
              <div className="flex items-center gap-2.5">
                <span className={`p-2 rounded-xl ${editingTx.type === 'income' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                  <Edit className="w-5 h-5" />
                </span>
                <div>
                  <h3 className="text-base font-extrabold text-slate-800">
                    Edit {editingTx.type === 'income' ? 'Income' : 'Expense'} Statement
                  </h3>
                  <p className="text-[11px] text-slate-400 mt-0.5 font-mono">Date: {editingTx.date}</p>
                </div>
              </div>
              <button 
                type="button"
                onClick={() => setEditingTx(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-50"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 relative z-10">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Category</label>
                <select
                  value={editingTxCategory}
                  onChange={(e) => setEditingTxCategory(e.target.value)}
                  className="w-full text-xs px-3 py-2 bg-white border border-slate-200 rounded-xl text-slate-700 focus:ring-1 focus:ring-indigo-500 focus:outline-none font-bold cursor-pointer"
                >
                  {editingTx.type === 'income' ? (
                    <>
                      <option value="customer_bill">Customer Bill</option>
                      <option value="reseller_bill">Reseller Bill</option>
                      <option value="service_charge">Service Charge</option>
                      <option value="other_income">Other</option>
                    </>
                  ) : (
                    Object.entries(EXPENSE_CATEGORY_LABELS).map(([key, item]) => (
                      <option key={key} value={key}>
                        {item.label}
                      </option>
                    ))
                  )}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Payment Method</label>
                <select
                  value={editingTxPaymentMethod}
                  onChange={(e) => setEditingTxPaymentMethod(e.target.value)}
                  className="w-full text-xs px-3 py-2 bg-white border border-slate-200 rounded-xl text-slate-700 focus:ring-1 focus:ring-indigo-500 focus:outline-none font-bold capitalize cursor-pointer"
                >
                  <option value="cash">Cash</option>
                  <option value="bkash">bKash</option>
                  <option value="nagad">Nagad</option>
                  <option value="rocket">Rocket</option>
                  <option value="bank">Bank Transfer</option>
                  <option value="sslcommerz">SSL Commerz</option>
                  <option value="upay">Upay</option>
                  <option value="cellfin">Cellfin</option>
                  <option value="tap">Tap</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Amount (BDT)</label>
                <input
                  type="number"
                  placeholder="Amount"
                  value={editingTxAmount}
                  onChange={(e) => setEditingTxAmount(e.target.value)}
                  className="w-full text-xs px-3 py-2 bg-white border border-slate-200 rounded-xl text-slate-700 focus:ring-1 focus:ring-indigo-500 focus:outline-none font-semibold font-mono"
                  required
                />
              </div>
            </div>

            <div className="flex items-center gap-3 mt-6 relative z-10">
              <button
                type="submit"
                className={`flex-1 py-2.5 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-2 transition cursor-pointer ${editingTx.type === 'income' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-rose-600 hover:bg-rose-700'}`}
              >
                <span>Save Changes</span>
              </button>
              <button
                type="button"
                onClick={() => setEditingTx(null)}
                className="py-2.5 px-5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Confirmation Modal */}
      {confirmModal && (
        <div className="fixed inset-0 bg-slate-900/60 z-[100] flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl relative overflow-hidden animate-scale-up border border-slate-100">
            <div className="absolute right-0 top-0 translate-x-8 -translate-y-8 w-24 h-24 bg-rose-50/50 rounded-full"></div>
            <div className="text-center relative z-10">
              <span className="inline-flex p-3 rounded-2xl bg-rose-50 text-rose-600 mb-4">
                <AlertCircle className="w-6 h-6" />
              </span>
              <h3 className="text-base font-extrabold text-slate-800">{confirmModal.message}</h3>
              {confirmModal.description && (
                <p className="text-xs text-slate-500 mt-2 leading-relaxed">{confirmModal.description}</p>
              )}
              <div className="flex items-center gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => {
                    confirmModal.onConfirm();
                    setConfirmModal(null);
                  }}
                  className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl transition cursor-pointer shadow-md shadow-rose-600/10"
                >
                  Yes, Confirm
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmModal(null)}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Inline Print Preview Modal */}
      {renderPrintPreviewModal()}
    </div>
  );
}
