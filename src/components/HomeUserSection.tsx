/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { PlusCircle, Search, Calendar, CheckCircle2, DollarSign, Receipt, Pencil, Trash2, Download, Users, TrendingUp, FileSpreadsheet, Upload, Loader2 } from 'lucide-react';
import { doc, setDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { Transaction, AppUser } from '../types';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { PaymentMethodLogo } from './PaymentLogos';

// Helper to render beautiful English text for Billing YYYY-MM format
const getEnglishMonthName = (monthStr: string) => {
  if (!monthStr) return 'N/A';
  const parts = monthStr.split('-');
  if (parts.length === 2) {
    const year = parts[0];
    const month = parseInt(parts[1], 10);
    const monthsEn = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    if (month >= 1 && month <= 12) {
      return `${monthsEn[month - 1]} ${year}`;
    }
  }
  return monthStr;
};

interface HomeUserSectionProps {
  userId: string;
  onAddTransaction: (transaction: Omit<Transaction, 'id'>) => Promise<void>;
  transactions: Transaction[];
  currentUserProfile?: AppUser | null;
}

export function HomeUserSection({ userId, onAddTransaction, transactions, currentUserProfile }: HomeUserSectionProps) {
  // Search query state
  const [searchQuery, setSearchQuery] = useState('');

  // Date range filter states (on-screen table filter)
  const [startDateFilter, setStartDateFilter] = useState('');
  const [endDateFilter, setEndDateFilter] = useState('');
  const [onScreenPaymentMethodFilter, setOnScreenPaymentMethodFilter] = useState('all');

  // PDF date select modal states
  const [isPdfModalOpen, setIsPdfModalOpen] = useState(false);
  const [pdfStartDate, setPdfStartDate] = useState('');
  const [pdfEndDate, setPdfEndDate] = useState('');
  const [pdfStatusFilter, setPdfStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const [pdfPaymentMethodFilter, setPdfPaymentMethodFilter] = useState<string>('all');

  // Manual billing states
  const [isManualBillOpen, setIsManualBillOpen] = useState(false);
  const [manualBillDate, setManualBillDate] = useState(() => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  });
  const [manualClientCode, setManualClientCode] = useState('');
  const [manualClientName, setManualClientName] = useState('');
  const [manualBillingMonth, setManualBillingMonth] = useState(() => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    return `${yyyy}-${mm}`;
  });
  const [manualAmount, setManualAmount] = useState('');
  const [manualCollector, setManualCollector] = useState('');
  const [manualReceiver, setManualReceiver] = useState('System Admin');
  const [manualPaymentMethod, setManualPaymentMethod] = useState('Cash');
  const [manualBillError, setManualBillError] = useState('');

  // Edit billing states
  const [isEditBillOpen, setIsEditBillOpen] = useState(false);
  const [editBillId, setEditBillId] = useState<string | null>(null);
  const [editBillDate, setEditBillDate] = useState('');
  const [editClientCode, setEditClientCode] = useState('');
  const [editClientName, setEditClientName] = useState('');
  const [editBillingMonth, setEditBillingMonth] = useState('');
  const [editAmount, setEditAmount] = useState('');
  const [editCollector, setEditCollector] = useState('');
  const [editReceiver, setEditReceiver] = useState('System Admin');
  const [editPaymentMethod, setEditPaymentMethod] = useState('Cash');
  const [editBillError, setEditBillError] = useState('');

  // Rejection modal states
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  const [rejectingTxId, setRejectingTxId] = useState<string | null>(null);
  const [rejectionReasonInput, setRejectionReasonInput] = useState('');
  const [rejectionError, setRejectionError] = useState('');

  // Bulk Excel import states
  const [isBulkBillOpen, setIsBulkBillOpen] = useState(false);
  const [parsedTransactions, setParsedTransactions] = useState<any[]>([]);
  const [isUploadingBulk, setIsUploadingBulk] = useState(false);
  const [bulkUploadProgress, setBulkUploadProgress] = useState(0);
  const [uploadedSuccessCount, setUploadedSuccessCount] = useState(0);
  const [bulkUploadError, setBulkUploadError] = useState('');

  // Approval filter tab state
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');

  // Handle status update directly in Firebase
  const handleUpdateStatus = async (transactionId: string, newStatus: 'manager_approved' | 'accountant_approved' | 'rejected' | 'pending') => {
    try {
      const docRef = doc(db, 'transactions', transactionId);
      const updateData: any = {
        status: newStatus,
        updatedAt: serverTimestamp(),
      };
      if (newStatus === 'manager_approved' || newStatus === 'accountant_approved') {
        updateData.rejectionReason = '';
      }
      await setDoc(docRef, updateData, { merge: true });
      
      let englishStatus = newStatus.replace('_', ' ');
      
      alert(`The bill status has been successfully updated to ${englishStatus}!`);
    } catch (err) {
      console.error('Failed to change status', err);
      handleFirestoreError(err, OperationType.WRITE, `transactions/${transactionId}`);
      alert('Failed to update bill status.');
    }
  };

  const handleInitiateReject = (transactionId: string) => {
    setRejectingTxId(transactionId);
    setRejectionReasonInput('');
    setRejectionError('');
    setIsRejectModalOpen(true);
  };

  const handleConfirmReject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectionReasonInput.trim()) {
      setRejectionError('Please verify and enter a cancellation reason.');
      return;
    }
    if (!rejectingTxId) return;

    try {
      const docRef = doc(db, 'transactions', rejectingTxId);
      await setDoc(docRef, {
        status: 'rejected',
        rejectionReason: rejectionReasonInput.trim(),
        updatedAt: serverTimestamp(),
      }, { merge: true });

      alert('The bill has been successfully cancelled/rejected!');
      setIsRejectModalOpen(false);
      setRejectingTxId(null);
      setRejectionReasonInput('');
    } catch (err) {
      console.error('Failed to reject bill', err);
      handleFirestoreError(err, OperationType.WRITE, `transactions/${rejectingTxId}`);
      alert('Failed to cancel the bill.');
    }
  };

  const handleDownloadTemplate = () => {
    // Columns list for the template
    const headers = [
      ['Client Code', 'Client Name', 'Amount', 'Billing Month', 'Date', 'Collector Name', 'Receiver Name', 'Payment Method']
    ];
    // Couple of illustrative samples
    const sampleRows = [
      ['H1001', 'Abul Kashem', 500, '2026-06', '2026-06-08', 'Rahim', 'System Admin', 'Cash'],
      ['H1002', 'Fatema Begum', 800, '2026-06', '2026-06-08', 'Karim', 'System Admin', 'bKash']
    ];
    const data = [...headers, ...sampleRows];
    
    const ws = XLSX.utils.aoa_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Bulk Bill Template");
    XLSX.writeFile(wb, "bulk_bill_sample_template.xlsx");
  };

  const normalizeExcelDate = (val: any): string => {
    if (!val) return '';
    const str = String(val).trim();
    if (!isNaN(Number(str))) {
      const serial = Number(str);
      const date = new Date(Math.round((serial - 25569) * 86400 * 1000));
      const yyyy = date.getFullYear();
      const mm = String(date.getMonth() + 1).padStart(2, '0');
      const dd = String(date.getDate()).padStart(2, '0');
      return `${yyyy}-${mm}-${dd}`;
    }
    const parts = str.split(/[-/]/);
    if (parts.length === 3) {
      if (parts[0].length === 4) {
        return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
      } else if (parts[2].length === 4) {
        const day = parts[0];
        const month = parts[1];
        const year = parts[2];
        return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
      }
    }
    const d = new Date(str);
    if (!isNaN(d.getTime())) {
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      return `${yyyy}-${mm}-${dd}`;
    }
    return str;
  };

  const handleExcelFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setBulkUploadError('');
    setParsedTransactions([]);
    
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstream = evt.target?.result;
        if (!bstream) return;
        const wb = XLSX.read(bstream, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        
        const data = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];
        if (data.length <= 1) {
          setBulkUploadError('No data found in the Excel file or file format is invalid.');
          return;
        }
        
        const headers = data[0].map(h => String(h || '').trim().toLowerCase());
        
        // Match columns intelligently using sub-keys
        const codeIdx = headers.findIndex(h => h.includes('code') || h.includes('কোড') || h.includes('client id') || h.includes('id'));
        const nameIdx = headers.findIndex(h => h.includes('name') || h.includes('নাম'));
        const amountIdx = headers.findIndex(h => h.includes('amount') || h.includes('টাকা') || h.includes('এমাউন্ট') || h.includes('মূল্য'));
        const monthIdx = headers.findIndex(h => h.includes('month') || h.includes('মাস'));
        const dateIdx = headers.findIndex(h => h.includes('date') || h.includes('তারিখ'));
        const collectorIdx = headers.findIndex(h => h.includes('collector') || h.includes('কালেক্টর'));
        const receiverIdx = headers.findIndex(h => h.includes('receiver') || h.includes('গ্রহণকারী') || h.includes('গ্রহনকারী'));
        const methodIdx = headers.findIndex(h => h.includes('method') || h.includes('পদ্ধতি') || h.includes('মাধ্যম'));
        
        if (codeIdx === -1 || nameIdx === -1 || amountIdx === -1 || monthIdx === -1 || dateIdx === -1 || collectorIdx === -1 || receiverIdx === -1 || methodIdx === -1) {
          setBulkUploadError('Invalid headers! Your spreadsheet must contain all mandatory columns (Client Code, Client Name, Amount, Billing Month, Date, Collector Name, Receiver Name, Payment Method). Please download the template for reference.');
          return;
        }
        
        const rowsToParse = data.slice(1);
        const list: any[] = [];
        
        for (let i = 0; i < rowsToParse.length; i++) {
          const row = rowsToParse[i];
          if (!row || row.length === 0) {
            continue;
          }
          
          const clientCode = row[codeIdx] ? String(row[codeIdx]).trim() : '';
          const clientName = row[nameIdx] ? String(row[nameIdx]).trim() : '';
          const rawAmount = parseFloat(row[amountIdx]);
          const amount = isNaN(rawAmount) ? 0 : rawAmount;
          const billingMonth = row[monthIdx] ? String(row[monthIdx]).trim() : '';
          const billDate = row[dateIdx] ? normalizeExcelDate(row[dateIdx]) : '';
          const collector = row[collectorIdx] ? String(row[collectorIdx]).trim() : '';
          const receiver = row[receiverIdx] ? String(row[receiverIdx]).trim() : '';
          const method = row[methodIdx] ? String(row[methodIdx]).trim() : '';
          
          let rowError = '';
          if (!clientCode) {
            rowError = 'Client Code is missing';
          } else if (!clientName) {
            rowError = 'Client Name is missing';
          } else if (amount <= 0) {
            rowError = 'Amount is invalid or missing';
          } else if (!billingMonth) {
            rowError = 'Billing Month is missing';
          } else if (!billDate) {
            rowError = 'Date is missing';
          } else if (!collector) {
            rowError = 'Collector Name is missing';
          } else if (!receiver) {
            rowError = 'Receiver Name is missing';
          } else if (!method) {
            rowError = 'Payment Method is missing';
          }
          
          list.push({
            clientCode,
            clientName,
            amount,
            billingMonth,
            billDate,
            collector,
            receiver,
            method,
            error: rowError
          });
        }
        
        if (list.length === 0) {
          setBulkUploadError('No data rows found in the file.');
        } else {
          setParsedTransactions(list);
        }
      } catch (err) {
        console.error('Failed reading excel file', err);
        setBulkUploadError('Error parsing Excel file. Please use the layout of the sample template.');
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleConfirmBulkUpload = async () => {
    if (currentUserProfile && !currentUserProfile.permissions?.canManageSubscribers) {
      alert('Access Denied: You do not have permission to manage subscriber accounts or billings.');
      return;
    }
    if (parsedTransactions.length === 0) return;
    
    const validRows = parsedTransactions.filter(r => !r.error);
    if (validRows.length === 0) {
      setBulkUploadError('No valid rows found to upload!');
      return;
    }
    
    setIsUploadingBulk(true);
    setBulkUploadProgress(0);
    setUploadedSuccessCount(0);
    
    let successCount = 0;
    
    for (let i = 0; i < validRows.length; i++) {
      const item = validRows[i];
      try {
        let notesText = `Bulk Excel upload. Client Code: ${item.clientCode}, Client Name: ${item.clientName}`;
        if (item.collector && item.collector !== 'N/A') {
          notesText += `, Collector: ${item.collector}`;
        }
        if (item.receiver && item.receiver !== 'System Admin') {
          notesText += `, Receiver: ${item.receiver}`;
        }
        
        await onAddTransaction({
          type: 'income',
          title: `Home Subscriber Monthly Bill: (${item.clientName})`,
          amount: item.amount,
          category: 'customer_bill',
          date: item.billDate,
          paymentMethod: item.method,
          receivedBy: item.collector !== 'N/A' ? item.collector : undefined,
          receivedDate: item.billDate,
          notes: notesText,
          clientId: item.clientCode,
          monthlyBill: item.amount,
          billingMonth: item.billingMonth,
          collectorName: item.collector,
          receiverName: item.receiver,
          status: 'pending' // Set status to pending for approval
        });
        
        successCount++;
        setUploadedSuccessCount(successCount);
        setBulkUploadProgress(Math.round(((i + 1) / validRows.length) * 100));
      } catch (err) {
        console.error(`Failed uploading row ${i}`, err);
      }
    }
    
    setIsUploadingBulk(false);
    alert(`Successfully bulk uploaded ${successCount} bill(s)!`);
    setIsBulkBillOpen(false);
    setParsedTransactions([]);
  };

  const handleProcessManualBillPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    setManualBillError('');

    if (currentUserProfile && !currentUserProfile.permissions?.canManageSubscribers) {
      setManualBillError('Access Denied: You do not have permission to manage subscriber accounts or billings.');
      return;
    }

    const amtNum = parseFloat(manualAmount);
    if (!manualClientName.trim()) {
      setManualBillError('Please enter Client Name.');
      return;
    }
    if (isNaN(amtNum) || amtNum <= 0) {
      setManualBillError('Please enter valid Amount (must be greater than 0).');
      return;
    }
    if (!manualClientCode.trim()) {
      setManualBillError('Please enter Client ID (Client Code).');
      return;
    }

    try {
      const finalDate = manualBillDate || (() => {
        const today = new Date();
        const yyyy = today.getFullYear();
        const mm = String(today.getMonth() + 1).padStart(2, '0');
        const dd = String(today.getDate()).padStart(2, '0');
        return `${yyyy}-${mm}-${dd}`;
      })();

      let notesText = `Manual bill collection. Client Code: ${manualClientCode.trim()}, Client Name: ${manualClientName.trim()}`;
      if (manualCollector.trim()) {
        notesText += `, Collector: ${manualCollector.trim()}`;
      }
      if (manualReceiver.trim()) {
        notesText += `, Receiver: ${manualReceiver.trim()}`;
      }

      await onAddTransaction({
        type: 'income',
        title: `Home Subscriber Monthly Bill: (${manualClientName.trim()})`,
        amount: amtNum,
        category: 'customer_bill',
        date: finalDate,
        paymentMethod: manualPaymentMethod,
        receivedBy: manualCollector.trim() || undefined,
        receivedDate: finalDate,
        notes: notesText,
        clientId: manualClientCode.trim(),
        monthlyBill: amtNum,
        billingMonth: manualBillingMonth,
        collectorName: manualCollector.trim() || 'N/A',
        receiverName: manualReceiver.trim() || 'System Admin',
        status: 'pending' // Create as pending for approval
      });

      // Clear fields and close
      setManualClientCode('');
      setManualClientName('');
      setManualAmount('');
      setManualCollector('');
      setManualReceiver('System Admin');
      setIsManualBillOpen(false);
      alert('The bill has been successfully added!');
    } catch (err) {
      console.error('Manual bill payment posting failed', err);
      setManualBillError('Failed to save the bill.');
    }
  };

  const openEditModal = (bill: Transaction) => {
    setEditBillId(bill.id);
    setEditBillDate(bill.date);
    setEditClientCode(bill.clientId || '');
    const clientName = bill.title ? bill.title.replace('হোম ইউজার মাসিক বিল: ', '').replace('Home Subscriber Monthly Bill: ', '').replace(/[()]/g, '') : '';
    setEditClientName(clientName);
    setEditBillingMonth(bill.billingMonth || '');
    setEditAmount(bill.amount.toString());
    setEditCollector(bill.collectorName || bill.receivedBy || '');
    setEditReceiver(bill.receiverName || 'System Admin');
    setEditPaymentMethod(bill.paymentMethod || 'Cash');
    setEditBillError('');
    setIsEditBillOpen(true);
  };

  const handleUpdateManualBillPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editBillId) return;
    setEditBillError('');

    if (currentUserProfile && !currentUserProfile.permissions?.canManageSubscribers) {
      setEditBillError('Access Denied: You do not have permission to manage subscriber accounts or billings.');
      return;
    }

    const billToEdit = transactions.find(t => t.id === editBillId);
    if (billToEdit && billToEdit.status !== 'pending' && billToEdit.status !== 'rejected') {
        setEditBillError('This bill is already approved and cannot be edited.');
        return;
    }

    const amtNum = parseFloat(editAmount);
    if (!editClientName.trim()) {
      setEditBillError('Please enter Client Name.');
      return;
    }
    if (isNaN(amtNum) || amtNum <= 0) {
      setEditBillError('Please enter valid Amount.');
      return;
    }
    if (!editClientCode.trim()) {
      setEditBillError('Please enter Client ID (Client Code).');
      return;
    }

    try {
      const docRef = doc(db, 'transactions', editBillId);

      let notesText = `Manual bill collection. Client Code: ${editClientCode.trim()}, Client Name: ${editClientName.trim()}`;
      if (editCollector.trim()) {
        notesText += `, Collector: ${editCollector.trim()}`;
      }
      if (editReceiver.trim()) {
        notesText += `, Receiver: ${editReceiver.trim()}`;
      }

      await setDoc(docRef, {
        title: `Home Subscriber Monthly Bill: (${editClientName.trim()})`,
        amount: amtNum,
        date: editBillDate,
        receivedDate: editBillDate,
        notes: notesText,
        clientId: editClientCode.trim(),
        monthlyBill: amtNum,
        billingMonth: editBillingMonth,
        paymentMethod: editPaymentMethod,
        collectorName: editCollector.trim() || 'N/A',
        receiverName: editReceiver.trim() || 'System Admin',
        updatedAt: serverTimestamp(),
      }, { merge: true });

      setIsEditBillOpen(false);
      setEditBillId(null);
      alert('Successfully updated the bill!');
    } catch (err) {
      console.error('Manual bill payment edit failed', err);
      setEditBillError('Failed to update the bill.');
    }
  };

  const handleDeleteManualBillPayment = async (transactionId: string, clientName: string) => {
    console.log('Delete button clicked for:', transactionId);
    if (currentUserProfile && !currentUserProfile.permissions?.canDeleteTransactions) {
      console.log('Access denied. Permissions:', currentUserProfile.permissions);
      alert('Access Denied: You do not have permission to delete transaction records (bills).');
      return;
    }
    console.log('Before confirm');
    if (window.confirm(`Are you sure you want to delete the bill for "${clientName}"?`)) {
        console.log('After confirm, proceeding to delete:', transactionId);
        try {
            console.log('Before deleteDoc');
            const docRef = doc(db, 'transactions', transactionId);
            await deleteDoc(docRef);
            console.log('After deleteDoc');
            alert('The bill was successfully deleted!');
        } catch (err) {
            console.error('Manual bill payment delete failed', err);
            alert('Failed to delete the bill.');
        }
    } else {
        console.log('User cancelled delete');
    }
  };

  // Filter only home user received bills (customer_bill category or specific manually added format)
  const homeUserBills = (transactions || []).filter(t => {
    // Exclude daily closing entries
    const isDailyClosing = t.isDailyClosing === true || 
      (t.notes && (t.notes.includes('Daily Closing entry statement:') || t.notes.includes('Daily Closing expense statement:')));
    if (isDailyClosing) return false;

    return (
      t.category === 'customer_bill' || 
      !!t.clientId || 
      t.title.includes('হোম ইউজার') || 
      t.title.includes('Home Subscriber') ||
      (t.notes && (t.notes.includes('ম্যানুয়াল বিল জমা') || t.notes.includes('Manual bill collection')))
    );
  }).map(t => ({
    ...t,
    status: t.status || 'approved' as const
  }));

  // Filter running month bills or specified date-range bills
  const runningMonthBills = React.useMemo(() => {
    const today = new Date();
    const currentYear = today.getFullYear();
    const currentMonthNum = today.getMonth() + 1;
    const currentMonthStr = `${currentYear}-${String(currentMonthNum).padStart(2, '0')}`;

    return homeUserBills.filter(t => {
      // If on-screen date filters are set (either start or end date)
      if (startDateFilter || endDateFilter) {
        if (startDateFilter && t.date < startDateFilter) return false;
        if (endDateFilter && t.date > endDateFilter) return false;
        return true;
      }
      
      // Default: Only include current "running month" (e.g. 2026-06)
      return t.date && t.date.startsWith(currentMonthStr);
    });
  }, [homeUserBills, startDateFilter, endDateFilter]);

  // Today's date in YYYY-MM-DD format for filtering approved bills strictly to running day (today)
  const todayStr = React.useMemo(() => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }, []);

  const pendingBills = runningMonthBills.filter(t => t.status === 'pending');
  // Approved status shows only current running day's approved bills
  const approvedBills = runningMonthBills.filter(t => t.status === 'accountant_approved' && t.date === todayStr);
  const rejectedBills = runningMonthBills.filter(t => t.status === 'rejected');

  // Filter bills based on search query & status & date filters
  const filteredBills = runningMonthBills.filter(t => {
    // 1. Filter by status filter
    if (statusFilter !== 'all') {
      if (t.status !== statusFilter) return false;
      // If Approved tab, only display current running day (today's) bills
      if (statusFilter === 'approved') {
        if (t.date !== todayStr) return false;
      }
    }

    // 2. Filter by date-range (runningMonthBills is already filtered, but keeping this for extra robustness)
    if (startDateFilter) {
      if (t.date < startDateFilter) return false;
    }
    if (endDateFilter) {
      if (t.date > endDateFilter) return false;
    }

    // Filter by on-screen payment method filter
    if (onScreenPaymentMethodFilter !== 'all') {
      const pMethod = t.paymentMethod || 'Cash';
      if (pMethod !== onScreenPaymentMethodFilter) return false;
    }

    // 3. Filter by search query
    const qStr = searchQuery.toLowerCase();
    if (!qStr) return true;
    return (
      t.title.toLowerCase().includes(qStr) ||
      (t.notes && t.notes.toLowerCase().includes(qStr)) ||
      (t.clientId && t.clientId.toLowerCase().includes(qStr)) ||
      (t.collectorName && t.collectorName.toLowerCase().includes(qStr)) ||
      (t.receiverName && t.receiverName.toLowerCase().includes(qStr)) ||
      (t.billingMonth && t.billingMonth.toLowerCase().includes(qStr))
    );
  });

  // Calculate statistics for home user billing
  const totalApprovedAmount = filteredBills.filter(t => t.status === 'accountant_approved').reduce((sum, t) => sum + t.amount, 0);
  const totalPendingAmount = filteredBills.filter(t => t.status === 'pending').reduce((sum, t) => sum + t.amount, 0);
  const totalCollectedCount = filteredBills.length;

  // Dashboard Overview Metrics (filtered by specified date range / running month only)
  const totalUniqueClients = React.useMemo(() => {
    const clients = new Set<string>();
    runningMonthBills.forEach(t => {
      if (t.clientId && t.clientId.trim()) {
        clients.add(t.clientId.trim().toUpperCase());
      } else if (t.title) {
        const cleaned = t.title.replace('হোম ইউজার মাসিক বিল: ', '').replace(/[()]/g, '').trim();
        if (cleaned) {
          clients.add(cleaned.toUpperCase());
        }
      }
    });
    return clients.size;
  }, [runningMonthBills]);

  const overallReceivedBillsCount = React.useMemo(() => {
    return runningMonthBills.filter(t => t.status === 'accountant_approved').length;
  }, [runningMonthBills]);

  const overallCollectedAmountSum = React.useMemo(() => {
    return runningMonthBills.filter(t => t.status === 'accountant_approved').reduce((sum, t) => sum + t.amount, 0);
  }, [runningMonthBills]);

  const paymentBreakdown = React.useMemo(() => {
    const defaultData = {
      Cash: { approvedSum: 0, approvedCount: 0, pendingSum: 0, pendingCount: 0 },
      bKash: { approvedSum: 0, approvedCount: 0, pendingSum: 0, pendingCount: 0 },
      Nagad: { approvedSum: 0, approvedCount: 0, pendingSum: 0, pendingCount: 0 },
      Bank: { approvedSum: 0, approvedCount: 0, pendingSum: 0, pendingCount: 0 },
      Rocket: { approvedSum: 0, approvedCount: 0, pendingSum: 0, pendingCount: 0 },
      SSLCommerz: { approvedSum: 0, approvedCount: 0, pendingSum: 0, pendingCount: 0 }
    };

    runningMonthBills.forEach((t) => {
      const pm = (t.paymentMethod || 'Cash').trim().toLowerCase();
      let method = 'Cash';
      
      if (pm === 'bkash') method = 'bKash';
      else if (pm === 'nagad') method = 'Nagad';
      else if (pm === 'rocket') method = 'Rocket';
      else if (pm === 'bank') method = 'Bank';
      else if (pm === 'sslcommerz') method = 'SSLCommerz';
      else method = 'Cash';

      const isApproved = t.status === 'accountant_approved';
      const isPending = t.status === 'pending';

      const normMethod = method as 'Cash' | 'bKash' | 'Nagad' | 'Bank' | 'Rocket' | 'SSLCommerz';

      if (isApproved) {
        defaultData[normMethod].approvedSum += t.amount;
        defaultData[normMethod].approvedCount += 1;
      } else if (isPending) {
        defaultData[normMethod].pendingSum += t.amount;
        defaultData[normMethod].pendingCount += 1;
      }
    });

    return defaultData;
  }, [runningMonthBills]);

  // PDF Download Trigger
  const handleDownloadPDF = (
    startDate?: string, 
    endDate?: string, 
    statusOverride?: 'all' | 'pending' | 'approved' | 'rejected',
    paymentMethodOverride?: string
  ) => {
    try {
      const doc = new jsPDF();
      
      // Top accent bar (indigo)
      doc.setFillColor(79, 70, 229);
      doc.rect(0, 0, 210, 8, 'F');
      
      // Title Block
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(15);
      doc.setTextColor(30, 41, 59);
      const currentTimeStr = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
      doc.text(`Home Subscriber Billing Report (${currentTimeStr})`, 14, 25);
      
      // Subtitle with timestamp
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(100, 116, 139);
      doc.text(`Generated on: ${new Date().toLocaleString('en-US')}`, 14, 32);
      
      // Horizontal separator line
      doc.setDrawColor(226, 232, 240);
      doc.line(14, 36, 196, 36);
      
      // Filter list based on parameters specifically
      const selectedStatus = statusOverride || statusFilter;
      const selectedPaymentMethod = paymentMethodOverride || pdfPaymentMethodFilter || 'all';
      let pdfBills = homeUserBills;

      if (selectedStatus !== 'all') {
        pdfBills = pdfBills.filter(t => t.status === selectedStatus);
      }

      if (selectedPaymentMethod !== 'all') {
        pdfBills = pdfBills.filter(t => t.paymentMethod === selectedPaymentMethod);
      }

      if (startDate) {
        pdfBills = pdfBills.filter(t => t.date >= startDate);
      }
      if (endDate) {
        pdfBills = pdfBills.filter(t => t.date <= endDate);
      }

      if (searchQuery) {
        const qStr = searchQuery.toLowerCase();
        pdfBills = pdfBills.filter(t => (
          t.title.toLowerCase().includes(qStr) ||
          (t.notes && t.notes.toLowerCase().includes(qStr)) ||
          (t.clientId && t.clientId.toLowerCase().includes(qStr)) ||
          (t.collectorName && t.collectorName.toLowerCase().includes(qStr)) ||
          (t.receiverName && t.receiverName.toLowerCase().includes(qStr)) ||
          (t.billingMonth && t.billingMonth.toLowerCase().includes(qStr))
        ));
      }

      const pdfApprovedAmt = pdfBills.filter(t => t.status === 'approved').reduce((sum, t) => sum + t.amount, 0);
      const pdfPendingAmt = 0;

      // Highlights / Statistics panel
      doc.setFillColor(248, 250, 252);
      doc.roundedRect(14, 42, 182, 28, 3, 3, 'F');
      
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(148, 163, 184);
      doc.text('TOTAL APPROVED', 20, 50);
      doc.text('TOTAL PENDING', 85, 50);
      doc.text('TOTAL RECORDS', 150, 50);
      
      doc.setFontSize(12);
      doc.setTextColor(5, 150, 105); // emerald green
      doc.text(`BDT ${pdfApprovedAmt.toLocaleString('en-US')}`, 20, 60);
      
      doc.setTextColor(217, 119, 6); // amber
      doc.text(`BDT ${pdfPendingAmt.toLocaleString('en-US')}`, 85, 60);
      
      doc.setTextColor(30, 41, 59); // dark state
      doc.text(`${pdfBills.length} Bill(s)`, 150, 60);
      
      // Filter status metadata below highlights
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(100, 116, 139);
      const activeFilterText = selectedStatus === 'all' ? 'All Records' : 
                               selectedStatus === 'approved' ? 'Approved Only' :
                               selectedStatus === 'pending' ? 'Pending Only' : 'Rejected Only';
      
      let filterMetaText = `Status: ${activeFilterText}`;
      if (selectedPaymentMethod !== 'all') {
        filterMetaText += ` | Method: ${selectedPaymentMethod}`;
      }
      if (startDate || endDate) {
        filterMetaText += ` | Range: ${startDate || 'All Time'} to ${endDate || 'All Time'}`;
      }
      doc.text(filterMetaText, 14, 78);
      if (searchQuery) {
        doc.text(`Search Query: "${searchQuery}"`, 140, 78);
      }
      
      // Data compilation
      const tableRows = pdfBills.map((bill) => {
        const clientNameInBm = bill.title ? bill.title.replace(/Home Subscriber Monthly Bill: |Home User Monthly Bill: |হোম ইউজার মাসিক বিল: |হোম সাবস্ক্রাইবার মান্থলি বিল: /g, '').replace(/[()]/g, '') : '—';
        const formattedMonth = bill.billingMonth ? getEnglishMonthName(bill.billingMonth) : 'N/A';
        const formattedStatus = bill.status ? bill.status.toUpperCase() : 'APPROVED';
        
        return [
          bill.date,
          bill.clientId || 'H-USER',
          clientNameInBm || 'Customer Name',
          formattedMonth,
          `BDT ${bill.amount.toLocaleString('en-US')}`,
          bill.collectorName || bill.receivedBy || 'N/A',
          bill.paymentMethod || 'Cash',
          formattedStatus
        ];
      });
      
      // Render the table using autoTable
      autoTable(doc, {
        startY: 84,
        head: [['Date', 'Subscriber ID', 'Subscriber Name', 'Billing Month', 'Amount', 'Collector', 'Method', 'Approval Status']],
        body: tableRows,
        theme: 'striped',
        headStyles: {
          fillColor: [79, 70, 229],
          textColor: [255, 255, 255],
          fontSize: 8,
          fontStyle: 'bold',
          halign: 'left'
        },
        bodyStyles: {
          fontSize: 7.5,
          textColor: [51, 65, 85]
        },
        columnStyles: {
          4: { halign: 'right', fontStyle: 'bold' },
          6: { halign: 'center' },
          7: { halign: 'center', fontStyle: 'bold' }
        },
        didParseCell: (data) => {
          if (data.section === 'body' && data.column.index === 7) {
            const val = data.cell.raw as string;
            if (val === 'APPROVED') {
              data.cell.styles.textColor = [5, 150, 105];
            } else if (val === 'PENDING') {
              data.cell.styles.textColor = [217, 119, 6];
            } else if (val === 'REJECTED') {
              data.cell.styles.textColor = [225, 29, 72];
            }
          }
        },
        styles: {
          font: 'helvetica',
          cellPadding: 3
        },
        margin: { left: 14, right: 14 }
      });

      // Signature Section at the bottom of the last page
      let finalY = (doc as any).lastAutoTable.finalY || 150;
      if (finalY + 35 > 280) {
        doc.addPage();
        finalY = 30;
      }
      
      const sigY = finalY + 25;
      doc.setDrawColor(186, 195, 201);
      doc.setLineWidth(0.3);
      
      // Left signature line (Prepared By / Collector)
      doc.line(14, sigY, 74, sigY);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(71, 85, 105);
      doc.text('Prepared By / Collector Signature', 14, sigY + 5);
      
      // Right signature line (Authorized Signature)
      doc.line(150, sigY, 196, sigY);
      doc.text('Authorized Signature', 150, sigY + 5);
      
      // Footer page count stamp
      const pageCount = doc.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(148, 163, 184);
        doc.text(`Page ${i} of ${pageCount}`, 196 - 15, 285, { align: 'right' });
        doc.text('Titas Internet Services - Home Billing Monthly Report', 14, 285);
      }
      
      // Save and Download
      const dateStr = new Date().toISOString().split('T')[0];
      doc.save(`Titas-Home-Billing-Report-${dateStr}.pdf`);
    } catch (pdfError) {
      console.error('Error generating PDF:', pdfError);
      alert('An error occurred while downloading the PDF.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Upper Dashboard Summary Grid Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 animate-fade-in">
        {/* Card 1: Total Subscriber */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all duration-300 flex items-center gap-4">
          <div className="p-3.5 bg-indigo-50/80 text-indigo-600 rounded-xl">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider block">Total Subscribers</span>
            <p className="text-lg sm:text-xl font-extrabold text-slate-800 tracking-tight mt-0.5">{totalUniqueClients} User(s)</p>
            <span className="text-[9.5px] text-slate-400 font-semibold block mt-0.5">Active subscribers in running/filtered month</span>
          </div>
        </div>

        {/* Card 2: Received Bills Count */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all duration-300 flex items-center gap-4">
          <div className="p-3.5 bg-emerald-50/80 text-emerald-600 rounded-xl">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider block">Received Bills</span>
            <p className="text-lg sm:text-xl font-extrabold text-emerald-600 tracking-tight mt-0.5">{overallReceivedBillsCount} Bill(s)</p>
            <span className="text-[9.5px] text-slate-400 font-semibold block mt-0.5">Successful bills in running/filtered month</span>
          </div>
        </div>

        {/* Card 3: Total Collections */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all duration-300 flex items-center gap-4">
          <div className="p-3.5 bg-violet-50/80 text-violet-600 rounded-xl">
            <TrendingUp className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider block">Total Collections</span>
            <p className="text-lg sm:text-xl font-extrabold text-violet-600 tracking-tight mt-0.5">BDT {overallCollectedAmountSum.toLocaleString('en-US')}</p>
            <span className="text-[9.5px] text-slate-400 font-semibold block mt-0.5">Total collection for running/filtered month</span>
          </div>
        </div>
      </div>

      {/* Payment Method Distribution Grid */}
      <div className="space-y-3 animate-fade-in">
        <div className="flex items-center gap-1.5 pl-1">
          <span className="p-1 bg-indigo-50 text-indigo-600 rounded-md">
            <Receipt className="w-4 h-4" />
          </span>
          <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
            Payment Method Breakdown
          </h4>
        </div>
        
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          {[
            {
              key: 'Cash',
              name: 'Cash Balance',
              logo: <PaymentMethodLogo method="Cash" className="w-5 h-5" />,
              bg: 'bg-emerald-50/40 border-emerald-100 hover:bg-emerald-50/80 text-emerald-800',
              badgeColor: 'bg-emerald-100 text-emerald-800',
              stats: paymentBreakdown.Cash
            },
            {
              key: 'bKash',
              name: 'bKash Balance',
              logo: <PaymentMethodLogo method="bKash" className="w-5 h-5" />,
              bg: 'bg-pink-50/40 border-pink-100 hover:bg-pink-50/80 text-pink-800',
              badgeColor: 'bg-pink-100 text-pink-800',
              stats: paymentBreakdown.bKash
            },
            {
              key: 'Nagad',
              name: 'Nagad Balance',
              logo: <PaymentMethodLogo method="Nagad" className="w-5 h-5" />,
              bg: 'bg-orange-50/40 border-orange-100 hover:bg-orange-50/80 text-orange-850 text-orange-850 text-orange-800',
              badgeColor: 'bg-orange-100 text-orange-800',
              stats: paymentBreakdown.Nagad
            },
            {
              key: 'Bank',
              name: 'Bank Balance',
              logo: <PaymentMethodLogo method="Bank" className="w-5 h-5" />,
              bg: 'bg-blue-50/40 border-blue-100 hover:bg-blue-50/80 text-blue-800',
              badgeColor: 'bg-blue-100 text-blue-800',
              stats: paymentBreakdown.Bank
            },
            {
              key: 'Rocket',
              name: 'Rocket Balance',
              logo: <PaymentMethodLogo method="Rocket" className="w-5 h-5" />,
              bg: 'bg-purple-50/40 border-purple-100 hover:bg-purple-50/80 text-purple-800',
              badgeColor: 'bg-purple-100 text-purple-800',
              stats: paymentBreakdown.Rocket
            },
            {
              key: 'SSLCommerz',
              name: 'SSLCommerz Balance',
              logo: <PaymentMethodLogo method="SSLCommerz" className="w-5 h-5" />,
              bg: 'bg-indigo-50/40 border-indigo-100 hover:bg-indigo-50/80 text-indigo-800',
              badgeColor: 'bg-indigo-100 text-indigo-800',
              stats: paymentBreakdown.SSLCommerz
            }
          ].map((item) => (
            <div 
              key={item.key} 
              className={`p-4 rounded-2xl border ${item.bg} shadow-sm hover:shadow transition-all duration-300 flex flex-col justify-between`}
            >
              <div className="flex items-center justify-between gap-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">{item.name}</span>
                {item.logo}
              </div>
              <div className="mt-3">
                <p className="text-base font-extrabold tracking-tight font-mono">
                  BDT {item.stats.approvedSum.toLocaleString('en-US')}
                </p>
                <div className="mt-2.5 border-t border-slate-200/40 pt-2 text-[9.5px] font-semibold text-slate-500 flex justify-between items-center">
                  <span>Total Bills:</span>
                  <span className="font-mono text-indigo-600 font-bold">{item.stats.approvedCount} Bills</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Top section: Add Bill Card */}
      <div className="flex flex-col items-center justify-center py-8 px-4 bg-white rounded-2xl border border-slate-100 shadow-sm animate-fade-in text-center">
        <div className="flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => {
              setManualBillDate(() => {
                const today = new Date();
                const yyyy = today.getFullYear();
                const mm = String(today.getMonth() + 1).padStart(2, '0');
                const dd = String(today.getDate()).padStart(2, '0');
                return `${yyyy}-${mm}-${dd}`;
              });
              setManualBillingMonth(() => {
                const today = new Date();
                const yyyy = today.getFullYear();
                const mm = String(today.getMonth() + 1).padStart(2, '0');
                return `${yyyy}-${mm}`;
              });
              setManualClientCode('');
              setManualClientName('');
              setManualAmount('');
              setManualCollector('');
              setManualReceiver('System Admin');
              setManualBillError('');
              setIsManualBillOpen(true);
            }}
            className="flex items-center justify-center gap-2 px-7 py-3 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 active:scale-95 rounded-2xl shadow-md hover:shadow-indigo-500/10 cursor-pointer transition-all duration-200"
          >
            <PlusCircle className="w-4.5 h-4.5" />
            <span>Add Bill</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setBulkUploadError('');
              setParsedTransactions([]);
              setIsBulkBillOpen(true);
            }}
            className="flex items-center justify-center gap-2 px-7 py-3 text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 hover:text-emerald-800 active:scale-95 rounded-2xl shadow-sm border border-emerald-200/50 cursor-pointer transition-all duration-200"
          >
            <FileSpreadsheet className="w-4.5 h-4.5 text-emerald-600" />
            <span>Bulk Bill Add</span>
          </button>
        </div>
      </div>

      {/* Manual bill collection dialog popup requested by user */}
      {isManualBillOpen && (
        <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4">
          <form onSubmit={handleProcessManualBillPayment} className="bg-white rounded-2xl shadow-xl border border-slate-100 max-w-sm w-full p-6 text-left space-y-4 font-sans text-xs text-slate-800 animate-fade-in">
            <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3">
              <div className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg">
                <PlusCircle className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-800">Add Bill</h4>
                <p className="text-[11px] text-slate-400 font-semibold">Receive a new bill payment manually</p>
              </div>
            </div>

            <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
              {/* 1. তারিখ / Date */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Date *</label>
                <input
                  type="date"
                  required
                  value={manualBillDate}
                  onChange={(e) => setManualBillDate(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-800 font-sans"
                />
              </div>

              {/* 2. ক্লায়েন্ট কোড / Client Code */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Client ID *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g., H-123456"
                  value={manualClientCode}
                  onChange={(e) => setManualClientCode(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-800 font-mono font-bold"
                />
              </div>

              {/* 3. ক্লাইন্ট নেম / Client Name */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Client Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g., Rajib Hasan"
                  value={manualClientName}
                  onChange={(e) => setManualClientName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-800 font-bold"
                />
              </div>

              {/* 4. বিলিং মান্থ / Billing Month */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Billing Month *</label>
                <input
                  type="month"
                  required
                  value={manualBillingMonth}
                  onChange={(e) => setManualBillingMonth(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-800 font-sans"
                />
              </div>

              {/* 5. এমাউন্ট / Amount */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Amount (BDT) *</label>
                <input
                  type="number"
                  required
                  min="1"
                  placeholder="e.g., 500"
                  value={manualAmount}
                  onChange={(e) => setManualAmount(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-800 font-mono font-bold text-sm"
                />
              </div>

              {/* পেমেন্ট মেথড / Payment Method */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Payment Method *</label>
                <select
                  value={manualPaymentMethod}
                  onChange={(e) => setManualPaymentMethod(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-800 font-semibold bg-white cursor-pointer"
                >
                  <option value="Cash">💵 Cash</option>
                  <option value="bKash">📱 bKash</option>
                  <option value="Nagad">📱 Nagad</option>
                  <option value="Rocket">📱 Rocket</option>
                  <option value="Bank">🏦 Bank</option>
                  <option value="SSLCommerz">💳 SSLCommerz</option>
                </select>
              </div>

              {/* 6. কালেক্টর / Collector */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Collector *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g., Sakib Hasan"
                  value={manualCollector}
                  onChange={(e) => setManualCollector(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-800 font-semibold"
                />
              </div>

              {/* 7. গ্রহনকারী / Receiver */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Receiver *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g., System Admin"
                  value={manualReceiver}
                  onChange={(e) => setManualReceiver(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-800 font-semibold"
                />
              </div>

              {manualBillError && (
                <p className="text-[11px] text-rose-500 font-semibold">⚠️ {manualBillError}</p>
              )}
            </div>

            <div className="flex gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setIsManualBillOpen(false)}
                className="flex-1 py-1.5 border border-slate-200 rounded-xl hover:bg-slate-50 text-slate-600 font-semibold text-xs transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-xs transition cursor-pointer shadow-sm"
              >
                Post Bill
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Bulk bill Excel file upload dialog popup */}
      {isBulkBillOpen && (
        <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-100 max-w-lg w-full p-6 text-left space-y-4 font-sans text-xs text-slate-800 animate-fade-in max-h-[85vh] overflow-y-auto">
            <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3">
              <div className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg">
                <FileSpreadsheet className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-800">Add Bulk Bills via Excel File</h4>
                <p className="text-[11px] text-slate-400 font-semibold">Create draft bills for multiple subscribers at once</p>
              </div>
            </div>

            <div className="space-y-3.5">
              {/* Instructions and Download Template */}
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-150 space-y-2">
                <p className="font-extrabold text-slate-700 text-xs flex items-center gap-1">
                  📚 Data Format Guidelines:
                </p>
                <ul className="list-disc list-inside space-y-1 text-slate-500 font-semibold text-[10.5px] leading-relaxed">
                  <li>Your Excel file must contain all columns, and entering every info is <strong className="text-indigo-600">compulsory (Mandatory)</strong>.</li>
                  <li>Billing Month format must be <strong className="text-indigo-600">YYYY-MM</strong> e.g.: <code className="bg-slate-100 px-1 border border-slate-200">2026-06</code>.</li>
                  <li>Date format must be <strong className="text-indigo-600">YYYY-MM-DD</strong> e.g.: <code className="bg-slate-100 px-1 border border-slate-200">2026-06-08</code>.</li>
                  <li>Required columns: Client Code, Client Name, Amount, Billing Month, Date, Collector Name, Receiver Name, Payment Method.</li>
                </ul>
                <button
                  type="button"
                  onClick={handleDownloadTemplate}
                  className="mt-1 inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-white hover:bg-slate-100 border border-slate-200 text-indigo-600 rounded-lg text-[11px] font-bold transition cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  Download Excel Template File
                </button>
              </div>

              {!isUploadingBulk && (
                <div 
                  className="border-2 border-dashed border-slate-200 hover:border-indigo-400 rounded-2xl p-5 flex flex-col items-center justify-center text-center cursor-pointer transition bg-slate-50/50"
                  onClick={() => document.getElementById('bulk-excel-file-input')?.click()}
                >
                  <Upload className="w-8 h-8 text-slate-400 mb-2 animate-bounce" />
                  <p className="font-bold text-slate-700 mb-0.5 text-xs">Drag & drop or select your Excel file here</p>
                  <p className="text-[10px] text-slate-400 font-semibold">Supported formats: .xlsx, .xls</p>
                  <input
                    id="bulk-excel-file-input"
                    type="file"
                    accept=".xlsx, .xls"
                    onChange={handleExcelFileChange}
                    className="hidden"
                  />
                </div>
              )}

              {/* Error indicator */}
              {bulkUploadError && (
                <p className="p-2.5 bg-rose-50 text-rose-600 font-semibold rounded-xl text-[11px] border border-rose-100">
                  ⚠️ {bulkUploadError}
                </p>
              )}

              {/* Loader / Upload Progress */}
              {isUploadingBulk && (
                <div className="py-4 space-y-3.5 text-center">
                  <div className="flex items-center justify-center gap-2 text-indigo-600 font-extrabold text-sm">
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Uploading bills, please wait...</span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                    <div 
                      className="bg-indigo-600 h-full rounded-full transition-all duration-300"
                      style={{ width: `${bulkUploadProgress}%` }}
                    />
                  </div>
                  <div className="flex justify-between items-center text-[11px] text-slate-500 font-extrabold">
                    <span>Progress: {bulkUploadProgress}%</span>
                    <span>Successfully uploaded: {uploadedSuccessCount} record(s)</span>
                  </div>
                </div>
              )}

              {/* Data Preview table if parsed */}
              {!isUploadingBulk && parsedTransactions.length > 0 && (
                <div className="space-y-2">
                  <p className="font-extrabold text-slate-700 text-xs">
                    📁 Excel Data Preview ({parsedTransactions.length} record(s) found):
                  </p>
                  <div className="border border-slate-150 rounded-xl overflow-hidden max-h-[180px] overflow-y-auto">
                    <table className="w-full border-collapse text-left">
                      <thead className="bg-slate-50 text-[10px] text-slate-500 font-bold border-b border-slate-150 sticky top-0">
                        <tr>
                          <th className="py-1.5 px-2 text-left">Code</th>
                          <th className="py-1.5 px-2 text-left">Name</th>
                          <th className="py-1.5 px-2 text-left">Amount</th>
                          <th className="py-1.5 px-2 text-left">Month</th>
                          <th className="py-1.5 px-2 text-left">Date</th>
                          <th className="py-1.5 px-2 text-left">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-sans text-[10px]">
                        {parsedTransactions.map((tx, idx) => (
                          <tr key={idx} className="hover:bg-slate-50/50">
                            <td className="py-1.5 px-2 font-bold text-slate-700">{tx.clientCode}</td>
                            <td className="py-1.5 px-2 font-semibold text-slate-500 truncate max-w-[90px]">{tx.clientName}</td>
                            <td className="py-1.5 px-2 font-bold text-slate-700">BDT {tx.amount}</td>
                            <td className="py-1.5 px-2 text-slate-500">{tx.billingMonth}</td>
                            <td className="py-1.5 px-2 text-slate-500">{tx.billDate}</td>
                            <td className="py-1.5 px-2 font-extrabold">
                              {tx.error ? (
                                <span className="text-rose-600">❌ {tx.error}</span>
                              ) : (
                                <span className="text-emerald-700">✓ Ready</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-2.5 pt-2 border-t border-slate-100">
              <button
                type="button"
                disabled={isUploadingBulk}
                onClick={() => {
                  setIsBulkBillOpen(false);
                  setParsedTransactions([]);
                  setBulkUploadError('');
                }}
                className="flex-1 py-1.5 border border-slate-200 rounded-xl hover:bg-slate-50 text-slate-600 font-semibold text-xs transition cursor-pointer disabled:opacity-50"
              >
                Close
              </button>
              <button
                type="button"
                disabled={isUploadingBulk || parsedTransactions.length === 0 || parsedTransactions.filter(r => !r.error).length === 0}
                onClick={handleConfirmBulkUpload}
                className="flex-1 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs transition cursor-pointer shadow-sm disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                <span>Confirm & Bulk Upload ({parsedTransactions.filter(r => !r.error).length})</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit manual bill collection dialog popup */}
      {isEditBillOpen && (
        <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4">
          <form onSubmit={handleUpdateManualBillPayment} className="bg-white rounded-2xl shadow-xl border border-slate-100 max-w-sm w-full p-6 text-left space-y-4 font-sans text-xs text-slate-800 animate-fade-in">
            <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3">
              <div className="p-1.5 bg-amber-50 text-amber-600 rounded-lg">
                <Pencil className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-800">Edit Bill</h4>
                <p className="text-[11px] text-slate-400 font-semibold">Modify previously recorded billing metadata</p>
              </div>
            </div>

            <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
              {/* 1. তারিখ / Date */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Date *</label>
                <input
                  type="date"
                  required
                  value={editBillDate}
                  onChange={(e) => setEditBillDate(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-amber-500 text-slate-800 font-sans"
                />
              </div>

              {/* 2. Client Code */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Client ID *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g., H-123456"
                  value={editClientCode}
                  onChange={(e) => setEditClientCode(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-amber-500 text-slate-800 font-mono font-bold"
                />
              </div>

              {/* 3. Client Name */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Client Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g., Rajib Hasan"
                  value={editClientName}
                  onChange={(e) => setEditClientName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-amber-500 text-slate-800 font-bold"
                />
              </div>

              {/* 4. Billing Month */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Billing Month *</label>
                <input
                  type="month"
                  required
                  value={editBillingMonth}
                  onChange={(e) => setEditBillingMonth(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-amber-500 text-slate-800 font-sans"
                />
              </div>

               {/* 5. Amount */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Amount (BDT) *</label>
                <input
                  type="number"
                  required
                  min="1"
                  placeholder="e.g., 500"
                  value={editAmount}
                  onChange={(e) => setEditAmount(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-amber-500 text-slate-800 font-mono font-bold text-sm"
                />
              </div>

              {/* Payment Method */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Payment Method *</label>
                <select
                  value={editPaymentMethod}
                  onChange={(e) => setEditPaymentMethod(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-amber-500 text-slate-800 font-semibold bg-white cursor-pointer"
                >
                  <option value="Cash">💵 Cash</option>
                  <option value="bKash">📱 bKash</option>
                  <option value="Nagad">📱 Nagad</option>
                  <option value="Rocket">📱 Rocket</option>
                  <option value="Bank">🏦 Bank</option>
                  <option value="SSLCommerz">💳 SSLCommerz</option>
                </select>
              </div>

              {/* 6. Collector */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Collector *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g., Sakib Hasan"
                  value={editCollector}
                  onChange={(e) => setEditCollector(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-amber-500 text-slate-800 font-semibold"
                />
              </div>

              {/* 7. Receiver */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Receiver *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g., System Admin"
                  value={editReceiver}
                  onChange={(e) => setEditReceiver(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-amber-500 text-slate-800 font-semibold"
                />
              </div>

              {editBillError && (
                <p className="text-[11px] text-rose-500 font-semibold">⚠️ {editBillError}</p>
              )}
            </div>

            <div className="flex gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => {
                  setIsEditBillOpen(false);
                  setEditBillId(null);
                }}
                className="flex-1 py-1.5 border border-slate-200 rounded-xl hover:bg-slate-50 text-slate-600 font-semibold text-xs transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-bold text-xs transition cursor-pointer shadow-sm"
              >
                Update
              </button>
            </div>
          </form>
        </div>
      )}

      {isRejectModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4">
          <form onSubmit={handleConfirmReject} className="bg-white rounded-2xl shadow-xl border border-slate-100 max-w-sm w-full p-6 text-left space-y-4 font-sans text-xs text-slate-800 animate-fade-in animate-scale-up">
            <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3">
              <div className="p-1.5 bg-rose-50 text-rose-600 rounded-lg">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-800">Cancel Bill</h4>
                <p className="text-[11px] text-rose-500 font-semibold">Providing a valid cancellation reason is mandatory</p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Reason for Cancellation *</label>
                <textarea
                  required
                  rows={3}
                  placeholder="e.g., Incorrect Account / Duplicate Entry / Customer did not pay"
                  value={rejectionReasonInput}
                  onChange={(e) => setRejectionReasonInput(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-rose-500 text-slate-800 font-semibold"
                />
              </div>

              {rejectionError && (
                <p className="text-[11px] text-rose-500 font-semibold">⚠️ {rejectionError}</p>
              )}
            </div>

            <div className="flex gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => {
                  setIsRejectModalOpen(false);
                  setRejectingTxId(null);
                  setRejectionReasonInput('');
                  setRejectionError('');
                }}
                className="flex-1 py-1.5 border border-slate-200 rounded-xl hover:bg-slate-50 text-slate-600 font-semibold text-xs transition cursor-pointer"
              >
                Close
              </button>
              <button
                type="submit"
                className="flex-1 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold text-xs transition cursor-pointer shadow-sm"
              >
                Confirm Cancellation
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Bottom section: Appproval-Based Summary List */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden animate-fade-in">
        {/* Card Header and Search Bar */}
        <div className="p-5 md:p-6 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h4 className="text-base font-extrabold text-slate-800 flex items-center gap-2">
              <span className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg">
                <Receipt className="w-4.5 h-4.5" />
              </span>
              Approval Ledger
            </h4>
            <p className="text-slate-400 text-[11px] font-semibold mt-0.5">Ledger transfers and database record entries for collected subscriber bills</p>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
            <div className="relative w-full sm:w-60">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3.5 top-3" />
              <input
                type="text"
                placeholder="Search Client ID, Name, Month, Collector..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-slate-50 hover:bg-slate-100/50 transition text-slate-700"
              />
            </div>

            <button
              type="button"
              onClick={() => {
                setPdfStartDate(startDateFilter);
                setPdfEndDate(endDateFilter);
                setPdfStatusFilter(statusFilter);
                setPdfPaymentMethodFilter('all');
                setIsPdfModalOpen(true);
              }}
              className="flex items-center justify-center gap-1.5 px-4.5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 active:scale-95 rounded-xl shadow-sm cursor-pointer transition-all w-full sm:w-auto"
              title="Launch PDF Report Generator"
            >
              <Download className="w-3.5 h-3.5" />
              <span>PDF Download</span>
            </button>
          </div>
        </div>

        {/* On-screen Date Filtering Row */}
        <div className="px-6 py-3 bg-slate-50 border-b border-slate-100 flex flex-wrap items-center gap-4 text-xs">
          <div className="flex items-center gap-1.5 text-slate-700 font-bold">
            <Calendar className="w-3.5 h-3.5 text-indigo-500" />
            <span>Filter by Date/Method:</span>
          </div>
          
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1.5">
              <span className="text-slate-400 font-semibold">Start:</span>
              <input
                type="date"
                value={startDateFilter}
                onChange={(e) => setStartDateFilter(e.target.value)}
                className="px-2.5 py-1 border border-slate-200 rounded-lg text-[11px] focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white text-slate-700 font-mono font-bold"
              />
            </div>
            
            <div className="flex items-center gap-1.5">
              <span className="text-slate-400 font-semibold">End:</span>
              <input
                type="date"
                value={endDateFilter}
                onChange={(e) => setEndDateFilter(e.target.value)}
                className="px-2.5 py-1 border border-slate-200 rounded-lg text-[11px] focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white text-slate-700 font-mono font-bold"
              />
            </div>

            <div className="flex items-center gap-1.5">
              <span className="text-slate-400 font-semibold">Method:</span>
              <select
                value={onScreenPaymentMethodFilter}
                onChange={(e) => setOnScreenPaymentMethodFilter(e.target.value)}
                className="px-2 py-1 border border-slate-200 rounded-lg text-[11px] focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white text-slate-700 font-bold"
              >
                <option value="all">All Methods</option>
                <option value="Cash">💵 Cash</option>
                <option value="bKash">📱 bKash</option>
                <option value="Nagad">📱 Nagad</option>
                <option value="Rocket">📱 Rocket</option>
                <option value="Bank">🏦 Bank</option>
                <option value="SSLCommerz">💳 SSLCommerz</option>
              </select>
            </div>

            {(startDateFilter || endDateFilter || onScreenPaymentMethodFilter !== 'all') && (
              <button
                type="button"
                onClick={() => {
                  setStartDateFilter('');
                  setEndDateFilter('');
                  setOnScreenPaymentMethodFilter('all');
                }}
                className="px-2.5 py-1 text-rose-500 bg-rose-50 hover:bg-rose-100 border border-rose-150 rounded-lg font-bold text-[10px] transition cursor-pointer"
              >
                Clear Filters
              </button>
            )}
          </div>
        </div>

        {/* Dynamic Statistics Block */}
        <div className="px-6 py-4 bg-slate-50/50 border-b border-slate-100 flex flex-wrap gap-6 items-center">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
              <DollarSign className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Amount</span>
              <p className="text-sm font-extrabold text-emerald-600 font-mono">BDT {totalApprovedAmount.toLocaleString('en-US')}</p>
            </div>
          </div>

          <div className="h-8 w-px bg-slate-200 hidden xs:block"></div>

          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
              <Receipt className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Transactions</span>
              <p className="text-sm font-extrabold text-slate-800 font-mono">{totalCollectedCount}</p>
            </div>
          </div>
        </div>

        {/* Data Table */}
        <div className="overflow-x-auto">
          {filteredBills.length === 0 ? (
            <div className="p-16 text-center text-slate-400 text-xs">
              <p className="font-semibold text-slate-500">No subscriber bills found for the selected month/filters.</p>
              <p className="text-slate-400 text-[11px] mt-1">Click the 'Add Bill' button up top to manually enter a new payment collection.</p>
            </div>
          ) : (
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50/75 text-slate-500 uppercase tracking-wider text-[10px] font-bold border-b border-slate-100">
                  <th className="p-4 pl-6">Date (Entry Time)</th>
                  <th className="p-4">Client ID</th>
                  <th className="p-4">Client Name</th>
                  <th className="p-4">Billing Month</th>
                  <th className="p-4 text-center">Payment Method</th>
                  <th className="p-4 text-right">Amount</th>
                  <th className="p-4">Collector Name</th>
                  <th className="p-4 pr-6 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredBills.map((bill) => {
                  const clientName = bill.title ? bill.title.replace(/Home Subscriber Monthly Bill: |Home User Monthly Bill: |হোম ইউজার মাসিক বিল: /g, '').replace(/[()]/g, '') : '—';
                  return (
                    <tr key={bill.id} className="hover:bg-indigo-50/10 transition">
                      {/* Entry Date */}
                      <td className="p-4 pl-6 font-mono text-[10.5px] text-slate-500 whitespace-nowrap">{bill.date}</td>
                      {/* Customer ID */}
                      <td className="p-4 font-mono text-[11px] font-bold text-indigo-600">
                        {bill.clientId || 'H-USER'}
                      </td>
                      {/* Client Name */}
                      <td className="p-4">
                        <p className="font-bold text-slate-800">{clientName}</p>
                      </td>
                      {/* Billing Month */}
                      <td className="p-4">
                        {bill.billingMonth ? (
                          <span className="inline-flex items-center gap-1 font-semibold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded text-[10px]">
                            <Calendar className="w-3 h-3 text-indigo-400" />
                            {getEnglishMonthName(bill.billingMonth)}
                          </span>
                        ) : '—'}
                      </td>
                      {/* Payment Method */}
                      <td className="p-4 text-center">
                        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-bold border ${
                          bill.paymentMethod === 'Cash' ? 'bg-emerald-50 border-emerald-100 text-emerald-700' :
                          bill.paymentMethod === 'bKash' ? 'bg-pink-50 border-pink-100 text-pink-700' :
                          bill.paymentMethod === 'Nagad' ? 'bg-orange-50 border-orange-100 text-orange-700' :
                          bill.paymentMethod === 'Rocket' ? 'bg-purple-50 border-purple-100 text-purple-700' :
                          bill.paymentMethod === 'Bank' ? 'bg-blue-50 border-blue-100 text-blue-700' : 
                          bill.paymentMethod === 'SSLCommerz' ? 'bg-indigo-50 border-indigo-100 text-indigo-700' : 'bg-slate-50 border-slate-100 text-slate-700'
                        }`}>
                          <PaymentMethodLogo method={bill.paymentMethod} className="w-3.5 h-3.5" />
                          {bill.paymentMethod === 'Cash' ? 'Cash' :
                           bill.paymentMethod === 'bKash' ? 'bKash' :
                           bill.paymentMethod === 'Nagad' ? 'Nagad' :
                           bill.paymentMethod === 'Rocket' ? 'Rocket' :
                           bill.paymentMethod === 'Bank' ? 'Bank' : 
                           bill.paymentMethod === 'SSLCommerz' ? 'SSLCommerz' : (bill.paymentMethod || 'Cash')}
                        </span>
                      </td>
                      {/* Amount */}
                      <td className="p-4 text-right font-mono font-extrabold text-slate-800">
                        BDT {bill.amount.toLocaleString('en-US')}
                      </td>
                      {/* Collector Name */}
                      <td className="p-4 text-slate-600 font-semibold">{bill.collectorName || bill.receivedBy || 'N/A'}</td>
                      {/* Action buttons */}
                      <td className="p-4 pr-6 text-center whitespace-nowrap animate-fade-in">
                        <div className="flex items-center justify-center gap-2">
                          {bill.status === 'accountant_approved' && currentUserProfile?.role === 'operator' ? (
                            <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded">Approved</span>
                          ) : (
                            <>
                              {bill.status === 'pending' && currentUserProfile?.permissions?.canApproveManager && (
                                <button
                                  type="button"
                                  onClick={() => handleUpdateStatus(bill.id, 'manager_approved')}
                                  className="p-1.5 border border-emerald-200 text-emerald-600 bg-emerald-50 rounded hover:bg-emerald-100 transition cursor-pointer"
                                  title="Manager Approve Bill"
                                >
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                              {bill.status === 'manager_approved' && currentUserProfile?.permissions?.canApproveAccounts && (
                                <button
                                  type="button"
                                  onClick={() => handleUpdateStatus(bill.id, 'accountant_approved')}
                                  className="p-1.5 border border-sky-200 text-sky-600 bg-sky-50 rounded hover:bg-sky-100 transition cursor-pointer"
                                  title="Accountant Approve Bill"
                                >
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                              {(bill.status === 'pending' || bill.status === 'rejected') && (
                                <button
                                  type="button"
                                  onClick={() => openEditModal(bill)}
                                  className="p-1.5 border border-amber-200 text-amber-600 bg-amber-50 rounded hover:bg-amber-100 transition cursor-pointer"
                                  title="Edit Bill"
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                </button>
                              )}
                              {bill.status === 'pending' && (
                                <button
                                  type="button"
                                  onClick={() => handleInitiateReject(bill.id)}
                                  className="p-1.5 border border-rose-200 text-rose-600 bg-rose-50 rounded hover:bg-rose-100 transition cursor-pointer"
                                  title="Reject Bill"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                              {currentUserProfile?.permissions?.canDeleteTransactions && (
                                <button
                                  type="button"
                                  onClick={() => handleDeleteManualBillPayment(bill.id, clientName)}
                                  className="p-1.5 border border-rose-200 text-rose-600 bg-rose-50 rounded hover:bg-rose-100 transition cursor-pointer"
                                  title="Delete Bill"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* PDF Download Range and Status Choice Modal Popup */}
      {isPdfModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-150 max-w-sm w-full p-6 text-left space-y-4 font-sans text-xs text-slate-800 animate-fade-in">
            <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3">
              <div className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg">
                <Download className="w-5 h-5 animate-bounce" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-800">Download PDF Report</h4>
                <p className="text-[11px] text-slate-400 font-semibold text-wrap">Select time range and criteria details</p>
              </div>
            </div>

            <div className="space-y-3">
              {/* 1. Start Date */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Start Date</label>
                <input
                  type="date"
                  value={pdfStartDate}
                  onChange={(e) => setPdfStartDate(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono font-bold text-slate-850"
                  placeholder="Select start date"
                />
              </div>

              {/* 2. End Date */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">End Date</label>
                <input
                  type="date"
                  value={pdfEndDate}
                  onChange={(e) => setPdfEndDate(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono font-bold text-slate-850"
                  placeholder="Select end date"
                />
              </div>

              {/* Quick helper shortcuts */}
              <div className="flex gap-1.5 justify-end">
                <button
                  type="button"
                  onClick={() => {
                    const today = new Date();
                    const yyyy = today.getFullYear();
                    const mm = String(today.getMonth() + 1).padStart(2, '0');
                    const dd = String(today.getDate()).padStart(2, '0');
                    const todayStr = `${yyyy}-${mm}-${dd}`;
                    setPdfStartDate(todayStr);
                    setPdfEndDate(todayStr);
                  }}
                  className="px-2 py-1 bg-slate-100 hover:bg-slate-200 rounded text-[10px] text-slate-600 font-semibold cursor-pointer"
                >
                  Today
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const today = new Date();
                    const yyyy = today.getFullYear();
                    const mm = String(today.getMonth() + 1).padStart(2, '0');
                    const firstDay = `${yyyy}-${mm}-01`;
                    const lastDay = new Date(yyyy, today.getMonth() + 1, 0).getDate();
                    const lastDayStr = `${yyyy}-${mm}-${String(lastDay).padStart(2, '0')}`;
                    setPdfStartDate(firstDay);
                    setPdfEndDate(lastDayStr);
                  }}
                  className="px-2 py-1 bg-slate-100 hover:bg-slate-200 rounded text-[10px] text-slate-600 font-semibold cursor-pointer"
                >
                  This Month
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPdfStartDate('');
                    setPdfEndDate('');
                  }}
                  className="px-2 py-1 bg-slate-100 hover:bg-slate-200 rounded text-[10px] text-slate-600 font-semibold cursor-pointer"
                >
                  All Time
                </button>
              </div>

              {/* 3. Status selection override */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Approval Status</label>
                <select
                  value={pdfStatusFilter}
                  onChange={(e: any) => setPdfStatusFilter(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white text-slate-850 font-bold focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer text-xs"
                >
                  <option value="all">All Records</option>
                  <option value="approved">Approved Only</option>
                  <option value="pending">Pending Only</option>
                  <option value="rejected">Rejected Only</option>
                </select>
              </div>

              {/* 4. Payment Method filter option */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Payment Method</label>
                <select
                  value={pdfPaymentMethodFilter}
                  onChange={(e) => setPdfPaymentMethodFilter(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white text-slate-850 font-bold focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer text-xs"
                >
                  <option value="all">All Payment Methods</option>
                  <option value="Cash">💵 Cash</option>
                  <option value="bKash">📱 bKash</option>
                  <option value="Nagad">📱 Nagad</option>
                  <option value="Rocket">📱 Rocket</option>
                  <option value="Bank">🏦 Bank</option>
                  <option value="SSLCommerz">💳 SSLCommerz</option>
                </select>
              </div>

              {/* Quick live indicators inside modal */}
              {(() => {
                let listCount = homeUserBills;
                if (pdfStatusFilter !== 'all') {
                  listCount = listCount.filter(t => t.status === pdfStatusFilter);
                }
                if (pdfPaymentMethodFilter !== 'all') {
                  listCount = listCount.filter(t => t.paymentMethod === pdfPaymentMethodFilter);
                }
                if (pdfStartDate) {
                  listCount = listCount.filter(t => t.date >= pdfStartDate);
                }
                if (pdfEndDate) {
                  listCount = listCount.filter(t => t.date <= pdfEndDate);
                }
                const count = listCount.length;
                const sum = listCount.reduce((s, x) => s + x.amount, 0);

                return (
                  <div className="p-2 border border-indigo-100 bg-indigo-50/50 rounded-xl space-y-0.5 text-[10.5px] text-indigo-700 font-semibold animate-fade-in mt-2 flex items-center justify-between">
                    <span>Selected: {count} bill(s)</span>
                    <span>Total: BDT {sum.toLocaleString('en-US')}</span>
                  </div>
                );
              })()}
            </div>

            <div className="flex gap-2.5 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsPdfModalOpen(false)}
                className="flex-1 py-2 border border-slate-200 rounded-xl hover:bg-slate-50 text-slate-600 font-bold text-xs transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  handleDownloadPDF(pdfStartDate, pdfEndDate, pdfStatusFilter, pdfPaymentMethodFilter);
                  setIsPdfModalOpen(false);
                }}
                className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white rounded-xl font-bold text-xs transition cursor-pointer shadow-sm flex items-center justify-center gap-1"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
