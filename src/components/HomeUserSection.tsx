/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { 
  PlusCircle, 
  Search, 
  Calendar, 
  CheckCircle2, 
  DollarSign, 
  Receipt, 
  Pencil, 
  Trash2, 
  Download, 
  Users, 
  TrendingUp, 
  FileSpreadsheet, 
  Upload, 
  Loader2,
  ListFilter,
  Clock,
  Activity,
  CheckCircle,
  XCircle,
  X,
  FileText,
  ShieldCheck,
  Briefcase,
  UserCheck,
  ShieldAlert,
  AlertTriangle,
  AlertCircle,
  Lock
} from 'lucide-react';
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

// Helper for human-readable dates in approval tracking
const formatEnglishDateTime = (isoStr?: string | any) => {
  if (!isoStr) return 'N/A';
  try {
    const d = typeof isoStr === 'string' ? new Date(isoStr) : (isoStr.toDate ? isoStr.toDate() : new Date());
    return d.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  } catch {
    return String(isoStr);
  }
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

  // Expandable row state (blue square ▶ toggle matching Vouchers Tracker)
  const [expandedBills, setExpandedBills] = useState<Record<string, boolean>>({});
  const toggleBillExpand = (id: string) => {
    setExpandedBills(prev => ({ ...prev, [id]: !prev[id] }));
  };

  // Tracking modal state
  const [trackingBill, setTrackingBill] = useState<Transaction | null>(null);

  // Approval Modal with Name, Designation & Description Box
  const [approvalModal, setApprovalModal] = useState<{
    isOpen: boolean;
    bill: Transaction | null;
    targetStatus: 'pending_manager' | 'pending_accounts' | 'approved';
    layerTitle: string;
    defaultDesignation: string;
  }>({
    isOpen: false,
    bill: null,
    targetStatus: 'pending_manager',
    layerTitle: '',
    defaultDesignation: ''
  });

  const [approverNameInput, setApproverNameInput] = useState('');
  const [approverDesignationInput, setApproverDesignationInput] = useState('');
  const [approvalCommentInput, setApprovalCommentInput] = useState('');
  const [isSubmittingApproval, setIsSubmittingApproval] = useState(false);
  const [approvalModalError, setApprovalModalError] = useState('');

  // Delete Bill confirmation modal (No window.confirm/alert)
  const [billToDelete, setBillToDelete] = useState<{
    id: string;
    clientId?: string;
    clientName: string;
    amount: number;
    billingMonth?: string;
    date?: string;
    collectorName?: string;
  } | null>(null);
  const [isDeletingBill, setIsDeletingBill] = useState(false);
  const [deleteBillError, setDeleteBillError] = useState('');

  // Delete All Bills confirmation modal
  const [isDeleteAllModalOpen, setIsDeleteAllModalOpen] = useState(false);
  const [isDeletingAllBills, setIsDeletingAllBills] = useState(false);
  const [deleteAllBillsError, setDeleteAllBillsError] = useState('');

  // Access Denied notice modal for unauthorized delete attempts
  const [deleteAccessDeniedNotice, setDeleteAccessDeniedNotice] = useState<string | null>(null);

  // Success toast notification
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Helper to check role-based approval permissions for Home User bills
  const hasBillApprovalPermission = (bill: Transaction | null): boolean => {
    if (!bill) return false;
    if (!currentUserProfile) return true; // fallback
    if (currentUserProfile.role === 'admin' || currentUserProfile.email?.toLowerCase() === 'connection.titascht@gmail.com') {
      return true; // Admin has full access across all approval layers
    }

    if (bill.status === 'pending_supervisor' || !bill.status || (bill.status as any) === 'pending') {
      return !!currentUserProfile.permissions?.canApproveSupervisor || currentUserProfile.role === 'supervisor';
    }
    if (bill.status === 'pending_manager') {
      return !!currentUserProfile.permissions?.canApproveManager || currentUserProfile.role === 'manager';
    }
    if (bill.status === 'pending_accounts') {
      return !!currentUserProfile.permissions?.canApproveAccounts || currentUserProfile.role === 'accountant';
    }
    return false;
  };

  const canRejectBill = (bill: Transaction | null): boolean => {
    if (!bill) return false;
    if (!currentUserProfile) return true;
    if (currentUserProfile.role === 'admin' || currentUserProfile.email?.toLowerCase() === 'connection.titascht@gmail.com') return true;
    return !!(
      currentUserProfile.permissions?.canApproveSupervisor ||
      currentUserProfile.permissions?.canApproveManager ||
      currentUserProfile.permissions?.canApproveAccounts ||
      currentUserProfile.permissions?.canDeleteTransactions ||
      currentUserProfile.role === 'supervisor' ||
      currentUserProfile.role === 'manager' ||
      currentUserProfile.role === 'accountant'
    );
  };

  const canReviewAgainBill = (bill: Transaction | null): boolean => {
    if (!bill) return false;
    if (!currentUserProfile) return true;
    if (currentUserProfile.role === 'admin' || currentUserProfile.email?.toLowerCase() === 'connection.titascht@gmail.com') return true;
    return !!(
      currentUserProfile.permissions?.canApproveSupervisor ||
      currentUserProfile.permissions?.canApproveManager ||
      currentUserProfile.permissions?.canApproveAccounts ||
      currentUserProfile.role === 'supervisor' ||
      currentUserProfile.role === 'manager' ||
      currentUserProfile.role === 'accountant'
    );
  };

  const openApprovalModal = (
    bill: Transaction, 
    targetStatus: 'pending_manager' | 'pending_accounts' | 'approved',
    layerTitle: string,
    defaultDesignation: string
  ) => {
    if (!hasBillApprovalPermission(bill)) {
      setDeleteAccessDeniedNotice(
        `Access Denied: You do not have permission to execute "${layerTitle}". This approval requires an authorized role (Supervisor, Manager, or Accountant/Admin).`
      );
      return;
    }
    const currentName = currentUserProfile?.displayName || (currentUserProfile?.email ? currentUserProfile.email.split('@')[0] : '');
    setApprovalModal({
      isOpen: true,
      bill,
      targetStatus,
      layerTitle,
      defaultDesignation
    });
    setApproverNameInput(currentName);
    setApproverDesignationInput(defaultDesignation);
    setApprovalCommentInput('');
    setApprovalModalError('');
  };

  const handleConfirmApproval = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!approvalModal.bill) return;

    if (!hasBillApprovalPermission(approvalModal.bill)) {
      setApprovalModalError('Access Denied: You do not have role permission to execute this approval.');
      return;
    }

    if (!approverNameInput.trim()) {
      setApprovalModalError('Please enter your full name (অনুমোদনকারীর নাম).');
      return;
    }
    if (!approverDesignationInput.trim()) {
      setApprovalModalError('Please enter your designation / title (পদবী).');
      return;
    }

    setIsSubmittingApproval(true);
    setApprovalModalError('');
    try {
      const docRef = doc(db, 'transactions', approvalModal.bill.id);
      const now = new Date().toISOString();
      const updateData: any = {
        status: approvalModal.targetStatus,
        updatedAt: serverTimestamp(),
      };

      if (approvalModal.targetStatus === 'pending_manager') {
        updateData.supervisorApprovedBy = approverNameInput.trim();
        updateData.supervisorDesignation = approverDesignationInput.trim();
        updateData.supervisorApprovedAt = now;
        if (approvalCommentInput.trim()) {
          updateData.supervisorComment = approvalCommentInput.trim();
        }
      } else if (approvalModal.targetStatus === 'pending_accounts') {
        updateData.managerApprovedBy = approverNameInput.trim();
        updateData.managerDesignation = approverDesignationInput.trim();
        updateData.managerApprovedAt = now;
        if (approvalCommentInput.trim()) {
          updateData.managerComment = approvalCommentInput.trim();
        }
      } else if (approvalModal.targetStatus === 'approved') {
        updateData.accountsApprovedBy = approverNameInput.trim();
        updateData.accountsDesignation = approverDesignationInput.trim();
        updateData.accountsApprovedAt = now;
        if (approvalCommentInput.trim()) {
          updateData.accountsComment = approvalCommentInput.trim();
        }
        updateData.rejectionReason = '';
      }

      await setDoc(docRef, updateData, { merge: true });
      alert(`The bill has been successfully approved as ${approvalModal.layerTitle}!`);
      setApprovalModal({
        isOpen: false,
        bill: null,
        targetStatus: 'pending_manager',
        layerTitle: '',
        defaultDesignation: ''
      });
    } catch (err) {
      console.error('Failed to submit approval', err);
      handleFirestoreError(err, OperationType.WRITE, `transactions/${approvalModal.bill.id}`);
      alert('Failed to register approval.');
    } finally {
      setIsSubmittingApproval(false);
    }
  };

  const getBillApproverName = (bill: Transaction) => {
    if (bill.status === 'approved') {
      const name = bill.accountsApprovedBy || bill.receiverName || 'System Admin';
      const des = bill.accountsDesignation ? ` (${bill.accountsDesignation})` : '';
      return `${name}${des}`;
    }
    if (bill.status === 'pending_accounts') {
      const name = bill.managerApprovedBy || 'Manager';
      const des = bill.managerDesignation ? ` (${bill.managerDesignation})` : '';
      return `${name}${des}`;
    }
    if (bill.status === 'pending_manager') {
      const name = bill.supervisorApprovedBy || 'Supervisor';
      const des = bill.supervisorDesignation ? ` (${bill.supervisorDesignation})` : '';
      return `${name}${des}`;
    }
    return '-';
  };

  const handleReviewAgain = async (billId: string) => {
    const bill = (transactions || []).find(t => t.id === billId);
    if (!canReviewAgainBill(bill || null)) {
      setDeleteAccessDeniedNotice('Access Denied: Only authorized approvers (Supervisor, Manager, Accountant) or Admin can send bills back for review.');
      return;
    }
    await handleUpdateStatus(billId, 'pending_supervisor');
    setToastMessage('Bill has been sent back for review (Wait Supervisor).');
    setTimeout(() => setToastMessage(null), 4000);
  };

  const downloadSingleBillReceipt = (bill: Transaction) => {
    try {
      const doc = new jsPDF();
      const clientName = bill.title ? bill.title.replace(/Home Subscriber Monthly Bill: |Home User Monthly Bill: |হোম ইউজার মাসিক বিল: /g, '').replace(/[()]/g, '') : 'Subscriber';
      
      doc.setFillColor(79, 70, 229);
      doc.rect(0, 0, 210, 10, 'F');
      
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(16);
      doc.setTextColor(30, 41, 59);
      doc.text('TITAS INTERNET SERVICES', 14, 25);
      
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9.5);
      doc.setTextColor(100, 116, 139);
      doc.text('Subscriber Monthly Bill Payment Receipt Slip', 14, 32);
      
      doc.setFillColor(248, 250, 252);
      doc.roundedRect(14, 40, 182, 95, 3, 3, 'F');
      doc.setDrawColor(226, 232, 240);
      doc.roundedRect(14, 40, 182, 95, 3, 3, 'S');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(51, 65, 85);
      doc.text(`Receipt ID: ${bill.id}`, 20, 52);
      doc.text(`Date: ${bill.date}`, 130, 52);

      doc.line(20, 56, 186, 56);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9.5);
      doc.setTextColor(71, 85, 105);

      doc.text(`Subscriber ID:`, 20, 66);
      doc.setFont('helvetica', 'bold');
      doc.text(`${bill.clientId || 'H-USER'}`, 65, 66);

      doc.setFont('helvetica', 'normal');
      doc.text(`Subscriber Name:`, 20, 75);
      doc.setFont('helvetica', 'bold');
      doc.text(`${clientName}`, 65, 75);

      doc.setFont('helvetica', 'normal');
      doc.text(`Billing Month:`, 20, 84);
      doc.setFont('helvetica', 'bold');
      doc.text(`${getEnglishMonthName(bill.billingMonth || '')}`, 65, 84);

      doc.setFont('helvetica', 'normal');
      doc.text(`Payment Method:`, 20, 93);
      doc.setFont('helvetica', 'bold');
      doc.text(`${bill.paymentMethod || 'Cash'}`, 65, 93);

      doc.setFont('helvetica', 'normal');
      doc.text(`Collector Name:`, 20, 102);
      doc.setFont('helvetica', 'bold');
      doc.text(`${bill.collectorName || bill.receivedBy || 'N/A'}`, 65, 102);

      doc.setFont('helvetica', 'normal');
      doc.text(`Approval Status:`, 20, 111);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(bill.status === 'approved' ? 5 : 217, bill.status === 'approved' ? 150 : 119, bill.status === 'approved' ? 105 : 6);
      doc.text(`${(bill.status || 'pending').toUpperCase().replace('_', ' ')}`, 65, 111);

      doc.setFillColor(238, 242, 255);
      doc.roundedRect(20, 118, 170, 11, 2, 2, 'F');
      doc.setTextColor(79, 70, 229);
      doc.setFontSize(10.5);
      doc.setFont('helvetica', 'bold');
      doc.text(`Paid Amount: BDT ${bill.amount.toLocaleString('en-US')}`, 25, 125.5);

      doc.setDrawColor(186, 195, 201);
      doc.setLineWidth(0.3);
      doc.line(20, 175, 75, 175);
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      doc.text('Collector Signature', 20, 180);

      doc.line(135, 175, 190, 175);
      doc.text('Authorized Signature', 135, 180);

      doc.save(`Receipt-${bill.clientId || 'Bill'}-${bill.date}.pdf`);
    } catch (e) {
      console.error(e);
      alert('Could not download slip');
    }
  };

  // Handle status update directly in Firebase
  const handleUpdateStatus = async (transactionId: string, newStatus: 'pending_supervisor' | 'pending_manager' | 'pending_accounts' | 'approved' | 'rejected') => {
    try {
      const docRef = doc(db, 'transactions', transactionId);
      const updateData: any = {
        status: newStatus,
        updatedAt: serverTimestamp(),
      };
      
      // Add approval metadata & timestamps
      const now = new Date().toISOString();
      const approverEmail = currentUserProfile?.email || 'Authorized User';

      if (newStatus === 'pending_manager') {
        updateData.supervisorApprovedBy = approverEmail;
        updateData.supervisorApprovedAt = now;
      }
      if (newStatus === 'pending_accounts') {
        updateData.managerApprovedBy = approverEmail;
        updateData.managerApprovedAt = now;
      }
      if (newStatus === 'approved') {
        updateData.accountsApprovedBy = approverEmail;
        updateData.accountsApprovedAt = now;
        updateData.rejectionReason = '';
      }
      if (newStatus === 'pending_supervisor') {
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
    const bill = (transactions || []).find(t => t.id === transactionId);
    if (!canRejectBill(bill || null)) {
      setDeleteAccessDeniedNotice('Access Denied: Only authorized approvers or Admin can cancel or reject bills.');
      return;
    }
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

  const handleDeleteAllBills = () => {
    handleInitiateDeleteAllBills();
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
    const isAdmin = !currentUserProfile || currentUserProfile.role === 'admin' || currentUserProfile.email?.toLowerCase() === 'connection.titascht@gmail.com';
    const isExplicitlyDenied = !isAdmin && currentUserProfile.permissions?.canAddSubscriberBills === false;
    if (isExplicitlyDenied) {
      alert('Access Denied: You do not have permission to add subscriber bills.');
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
          status: 'pending_supervisor' // Set status to pending for approval
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

    const isAdmin = !currentUserProfile || currentUserProfile.role === 'admin' || currentUserProfile.email?.toLowerCase() === 'connection.titascht@gmail.com';
    const isExplicitlyDenied = !isAdmin && currentUserProfile.permissions?.canAddSubscriberBills === false;
    if (isExplicitlyDenied) {
      setManualBillError('Access Denied: You do not have permission to add subscriber bills.');
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

    // Auto-generate unique client ID if left blank
    const finalClientCode = manualClientCode.trim() || `H-${Math.floor(100000 + Math.random() * 900000)}`;

    try {
      const finalDate = manualBillDate || (() => {
        const today = new Date();
        const yyyy = today.getFullYear();
        const mm = String(today.getMonth() + 1).padStart(2, '0');
        const dd = String(today.getDate()).padStart(2, '0');
        return `${yyyy}-${mm}-${dd}`;
      })();

      let notesText = `Manual bill collection. Client Code: ${finalClientCode}, Client Name: ${manualClientName.trim()}`;
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
        clientId: finalClientCode,
        monthlyBill: amtNum,
        billingMonth: manualBillingMonth,
        collectorName: manualCollector.trim() || 'N/A',
        receiverName: manualReceiver.trim() || 'System Admin',
        status: 'pending_supervisor' // Create as pending for approval
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

    const isAdmin = !currentUserProfile || currentUserProfile.role === 'admin' || currentUserProfile.email?.toLowerCase() === 'connection.titascht@gmail.com';
    const canManage = isAdmin || currentUserProfile?.permissions?.canManageSubscribers || currentUserProfile?.permissions?.canAddSubscriberBills;
    if (!canManage) {
      setEditBillError('Access Denied: You do not have permission to manage subscriber accounts or billings.');
      return;
    }

    const billToEdit = transactions.find(t => t.id === editBillId);
    if (billToEdit && ['approved'].includes(billToEdit.status || '')) {
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

  const isAdmin = !currentUserProfile || currentUserProfile.role === 'admin' || currentUserProfile.email?.toLowerCase() === 'connection.titascht@gmail.com';
  const canDeleteBills = isAdmin || !!currentUserProfile?.permissions?.canDeleteTransactions;

  const handleInitiateDeleteBill = (bill: Transaction, cName: string) => {
    if (!canDeleteBills) {
      setDeleteAccessDeniedNotice('Access Denied: Only Admin users (or users with delete permissions) are authorized to delete subscriber bills.');
      return;
    }
    setBillToDelete({
      id: bill.id,
      clientId: bill.clientId,
      clientName: cName,
      amount: bill.amount,
      billingMonth: bill.billingMonth,
      date: bill.date,
      collectorName: bill.collectorName,
    });
    setDeleteBillError('');
  };

  const handleConfirmDeleteBill = async () => {
    if (!billToDelete) return;
    setIsDeletingBill(true);
    setDeleteBillError('');
    try {
      const docRef = doc(db, 'transactions', billToDelete.id);
      await deleteDoc(docRef);
      const name = billToDelete.clientName;
      setBillToDelete(null);
      setToastMessage(`Bill for "${name}" has been permanently deleted.`);
      setTimeout(() => setToastMessage(null), 4000);
    } catch (err: any) {
      console.error('Failed to delete bill:', err);
      setDeleteBillError(err?.message || 'Failed to delete the bill. Please try again.');
    } finally {
      setIsDeletingBill(false);
    }
  };

  const handleInitiateDeleteAllBills = () => {
    if (!canDeleteBills) {
      setDeleteAccessDeniedNotice('Access Denied: Only Admin users are authorized to reset all subscriber bills.');
      return;
    }
    setIsDeleteAllModalOpen(true);
    setDeleteAllBillsError('');
  };

  const handleConfirmDeleteAllBills = async () => {
    setIsDeletingAllBills(true);
    setDeleteAllBillsError('');
    try {
      const deletePromises = runningMonthBills.map(bill => deleteDoc(doc(db, 'transactions', bill.id)));
      await Promise.all(deletePromises);
      setIsDeleteAllModalOpen(false);
      setToastMessage('All subscriber bills for the running month have been reset to 0.');
      setTimeout(() => setToastMessage(null), 4000);
    } catch (err: any) {
      console.error('Failed to reset all bills:', err);
      setDeleteAllBillsError(err?.message || 'Failed to reset all bills. Please try again.');
    } finally {
      setIsDeletingAllBills(false);
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

  const pendingBills = runningMonthBills.filter(t => ['pending', 'pending_supervisor', 'pending_manager', 'pending_accounts'].includes(t.status || ''));
  const approvedBills = runningMonthBills.filter(t => t.status === 'approved');
  const rejectedBills = runningMonthBills.filter(t => t.status === 'rejected');

  // Filter bills based on search query & status & date filters
  const filteredBills = runningMonthBills.filter(t => {
    // 1. Filter by status filter
    if (statusFilter !== 'all') {
      if (statusFilter === 'pending') {
        if (!['pending', 'pending_supervisor', 'pending_manager', 'pending_accounts'].includes(t.status || '')) {
          return false;
        }
      } else if (statusFilter === 'approved') {
        if (t.status !== 'approved') return false;
      } else if (statusFilter === 'rejected') {
        if (t.status !== 'rejected') return false;
      } else {
        if (t.status !== statusFilter) return false;
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
  const totalApprovedAmount = filteredBills.filter(t => t.status === 'approved' || t.status === 'accountant_approved').reduce((sum, t) => sum + t.amount, 0);
  const totalPendingAmount = filteredBills.filter(t => ['pending', 'pending_supervisor', 'pending_manager', 'pending_accounts'].includes(t.status || '')).reduce((sum, t) => sum + t.amount, 0);
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
    return runningMonthBills.filter(t => t.status === 'approved' || t.status === 'accountant_approved').length;
  }, [runningMonthBills]);

  const overallCollectedAmountSum = React.useMemo(() => {
    return runningMonthBills.filter(t => t.status === 'approved' || t.status === 'accountant_approved').reduce((sum, t) => sum + t.amount, 0);
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
      else if (pm === 'sslcommerz' || pm === 'ssl') method = 'SSLCommerz';
      else method = 'Cash';

      // Only approved bills contribute to the approved payment method balance breakdown
      const isApproved = t.status === 'approved' || t.status === 'accountant_approved';
      const isPending = ['pending', 'pending_supervisor', 'pending_manager', 'pending_accounts'].includes(t.status || '');

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
                  <span>Approved Bills:</span>
                  <span className="font-mono text-indigo-600 font-bold">{item.stats.approvedCount} Bills</span>
                </div>
                {item.stats.pendingCount > 0 && (
                  <div className="mt-1 text-[9px] font-semibold text-amber-600 flex justify-between items-center">
                    <span>Pending Approval:</span>
                    <span className="font-mono font-bold text-amber-700">{item.stats.pendingCount} Bill(s)</span>
                  </div>
                )}
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
                <label className="block text-xs font-semibold text-slate-700 mb-1">Client ID (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g., H-123456 (auto-assigned if blank)"
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

      {/* 🛡️ APPROVAL POPUP MODAL (Name, Designation & Description Box) */}
      {approvalModal.isOpen && approvalModal.bill && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <form 
            onSubmit={handleConfirmApproval}
            className="bg-white rounded-2xl shadow-2xl border border-slate-150 max-w-md w-full p-6 text-left space-y-4 font-sans text-xs text-slate-800 animate-fade-in"
          >
            {/* Header */}
            <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
              <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl">
                <ShieldCheck className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-800">{approvalModal.layerTitle}</h4>
                <p className="text-[11px] text-slate-400 font-semibold">Enter approver name, designation & verification remarks</p>
              </div>
            </div>

            {/* Bill summary chip */}
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/60 space-y-1">
              <div className="flex justify-between items-center text-[11px]">
                <span className="text-slate-500 font-medium">Subscriber:</span>
                <span className="font-bold text-slate-800">
                  {approvalModal.bill.title ? approvalModal.bill.title.replace(/Home Subscriber Monthly Bill: |Home User Monthly Bill: |হোম ইউজার মাসিক বিল: /g, '').replace(/[()]/g, '') : 'Subscriber'}
                </span>
              </div>
              <div className="flex justify-between items-center text-[11px]">
                <span className="text-slate-500 font-medium">Client ID / Month:</span>
                <span className="font-mono font-bold text-indigo-600">
                  {approvalModal.bill.clientId || 'H-USER'} ({getEnglishMonthName(approvalModal.bill.billingMonth || '')})
                </span>
              </div>
              <div className="flex justify-between items-center text-[11px]">
                <span className="text-slate-500 font-medium">Collection Amount:</span>
                <span className="font-mono font-black text-emerald-600">
                  ৳ {approvalModal.bill.amount.toLocaleString('en-US')} ({approvalModal.bill.paymentMethod || 'Cash'})
                </span>
              </div>
            </div>

            <div className="space-y-3">
              {/* Approver Name */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1 flex items-center gap-1">
                  <UserCheck className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Approver Full Name (অনুমোদনকারীর নাম) *</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g., Newton Chakma"
                  value={approverNameInput}
                  onChange={(e) => setApproverNameInput(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500 font-semibold text-slate-800"
                />
              </div>

              {/* Designation */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1 flex items-center gap-1">
                  <Briefcase className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Designation / Title (পদবী) *</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g., Supervisor / Operations Manager / Accountant"
                  value={approverDesignationInput}
                  onChange={(e) => setApproverDesignationInput(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500 font-semibold text-slate-800"
                />
              </div>

              {/* Description / Audit remarks */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  <span>Approval Description & Remarks (অনুমোদনের বিবরণ / অডিট নোট)</span>
                </label>
                <textarea
                  rows={3}
                  placeholder="Write verification notes, counterfoil checks performed, or approval remarks..."
                  value={approvalCommentInput}
                  onChange={(e) => setApprovalCommentInput(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500 font-medium text-slate-800"
                />
              </div>

              {approvalModalError && (
                <p className="text-[11px] text-rose-500 font-semibold">⚠️ {approvalModalError}</p>
              )}
            </div>

            {/* Action buttons */}
            <div className="flex gap-2.5 pt-2">
              <button
                type="button"
                disabled={isSubmittingApproval}
                onClick={() => {
                  setApprovalModal({
                    isOpen: false,
                    bill: null,
                    targetStatus: 'pending_manager',
                    layerTitle: '',
                    defaultDesignation: ''
                  });
                }}
                className="flex-1 py-2 border border-slate-200 rounded-xl hover:bg-slate-50 text-slate-600 font-bold text-xs transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmittingApproval}
                className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white rounded-xl font-bold text-xs transition cursor-pointer shadow-sm flex items-center justify-center gap-1.5"
              >
                {isSubmittingApproval ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Saving Approval...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-3.5 h-3.5" />
                    <span>Confirm & Approve</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Bottom section: Vouchers and Approval Tracker Ledger */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4 animate-fade-in">
        {/* Header matching image_5d113622.png */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-slate-50 text-slate-600 rounded-lg">
              <ListFilter className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-800">Home User Bills and Approval Tracker</h3>
              <p className="text-[10px] text-slate-400 font-semibold">All subscriber bill slips and current status</p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {runningMonthBills.length > 0 && (
              <button
                type="button"
                onClick={handleDeleteAllBills}
                className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-xl text-xs font-black transition flex items-center gap-1.5 cursor-pointer"
                title="Delete all subscriber bills for this month"
              >
                <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                <span>Delete All Entries (Reset to 0)</span>
              </button>
            )}

            {/* Tabs for filtering: All, Pending, Approved, Rejected */}
            <div className="flex bg-slate-100 p-1 rounded-xl gap-0.5 self-start sm:self-auto shrink-0 select-none">
              <button
                type="button"
                onClick={() => setStatusFilter('all')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition whitespace-nowrap cursor-pointer ${
                  statusFilter === 'all'
                    ? 'bg-white text-slate-800 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                All
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('pending')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition whitespace-nowrap cursor-pointer ${
                  statusFilter === 'pending'
                    ? 'bg-white text-slate-800 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                Pending
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('approved')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition whitespace-nowrap cursor-pointer ${
                  statusFilter === 'approved'
                    ? 'bg-white text-slate-800 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                Approved
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('rejected')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition whitespace-nowrap cursor-pointer ${
                  statusFilter === 'rejected'
                    ? 'bg-white text-slate-800 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                Rejected
              </button>
            </div>
          </div>
        </div>

        {/* Toolbar: Search, Date Filter, Payment Method & PDF Export */}
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 pt-1">
          <div className="flex flex-wrap items-center gap-2.5 flex-1">
            <div className="relative w-full sm:w-64">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search Client ID, Name, Collector..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-slate-50 hover:bg-slate-100/50 transition text-slate-700"
              />
            </div>

            <div className="flex items-center gap-1.5">
              <span className="text-slate-400 text-[11px] font-semibold">Start:</span>
              <input
                type="date"
                value={startDateFilter}
                onChange={(e) => setStartDateFilter(e.target.value)}
                className="px-2 py-1 border border-slate-200 rounded-lg text-[11px] focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white text-slate-700 font-mono font-bold"
              />
            </div>

            <div className="flex items-center gap-1.5">
              <span className="text-slate-400 text-[11px] font-semibold">End:</span>
              <input
                type="date"
                value={endDateFilter}
                onChange={(e) => setEndDateFilter(e.target.value)}
                className="px-2 py-1 border border-slate-200 rounded-lg text-[11px] focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white text-slate-700 font-mono font-bold"
              />
            </div>

            <div className="flex items-center gap-1.5">
              <span className="text-slate-400 text-[11px] font-semibold">Method:</span>
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

            {(startDateFilter || endDateFilter || onScreenPaymentMethodFilter !== 'all' || searchQuery) && (
              <button
                type="button"
                onClick={() => {
                  setStartDateFilter('');
                  setEndDateFilter('');
                  setOnScreenPaymentMethodFilter('all');
                  setSearchQuery('');
                }}
                className="px-2.5 py-1 text-rose-500 bg-rose-50 hover:bg-rose-100 border border-rose-200/50 rounded-lg font-bold text-[10px] transition cursor-pointer"
              >
                Clear Filters
              </button>
            )}
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
            className="flex items-center justify-center gap-1.5 px-3.5 py-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 active:scale-95 rounded-xl shadow-sm cursor-pointer transition-all self-start lg:self-auto shrink-0"
            title="Launch PDF Report Generator"
          >
            <Download className="w-3.5 h-3.5" />
            <span>PDF Download</span>
          </button>
        </div>

        {/* Data Table */}
        {filteredBills.length === 0 ? (
          <div className="py-12 px-4 border border-dashed border-slate-200 rounded-2xl text-center space-y-2">
            <p className="text-xs text-slate-400 font-bold">No subscriber bills found for the selected filters.</p>
            <p className="text-[10px] text-slate-400">Use the 'Add Bill' button at top to enter a new payment collection.</p>
          </div>
        ) : (
          <div className="overflow-x-auto max-h-[580px] overflow-y-auto pr-1">
            <table className="w-full min-w-[1000px] text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-xs text-slate-400 font-bold uppercase select-none">
                  <th className="py-3 px-2 w-8"></th>
                  <th className="py-3 px-3">Date (Entry Time)</th>
                  <th className="py-3 px-3">Client ID</th>
                  <th className="py-3 px-3">Client Name</th>
                  <th className="py-3 px-3">Billing Month</th>
                  <th className="py-3 px-3 text-center">Payment Method</th>
                  <th className="py-3 px-3">Collector Name</th>
                  <th className="py-3 px-3 text-right">Amount</th>
                  <th className="py-3 px-3 text-center">Status</th>
                  <th className="py-3 px-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {filteredBills.map((bill) => {
                  const clientName = bill.title ? bill.title.replace(/Home Subscriber Monthly Bill: |Home User Monthly Bill: |হোম ইউজার মাসিক বিল: /g, '').replace(/[()]/g, '') : '—';
                  const isExpanded = !!expandedBills[bill.id];
                  const approver = getBillApproverName(bill);
                  const isPending = ['pending', 'pending_supervisor', 'pending_manager', 'pending_accounts'].includes(bill.status || '');

                  return (
                    <React.Fragment key={bill.id}>
                      <tr className="hover:bg-slate-50/50 transition-colors">
                        {/* Expand Toggle: Blue rounded square matching image */}
                        <td className="py-3.5 px-2 text-center">
                          <button
                            type="button"
                            onClick={() => toggleBillExpand(bill.id)}
                            className="w-5 h-5 bg-blue-600 hover:bg-blue-700 text-white rounded flex items-center justify-center transition cursor-pointer text-[10px] shadow-sm"
                            title={isExpanded ? "Collapse Details" : "Expand Details"}
                          >
                            <span
                              className="block transform transition-transform duration-200"
                              style={{ transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)' }}
                            >
                              ▶
                            </span>
                          </button>
                        </td>

                        {/* Date (Entry Time) */}
                        <td className="py-3.5 px-3 font-mono font-medium text-slate-500 whitespace-nowrap text-[11px]">
                          {bill.date}
                        </td>

                        {/* Client ID */}
                        <td className="py-3.5 px-3 font-mono font-bold text-slate-800 whitespace-nowrap">
                          {bill.clientId || (bill.id ? `BILL-${bill.id.slice(-6).toUpperCase()}` : 'H-USER')}
                        </td>

                        {/* Client Name */}
                        <td className="py-3.5 px-3 font-semibold text-slate-700 whitespace-nowrap">
                          {clientName}
                        </td>

                        {/* Billing Month */}
                        <td className="py-3.5 px-3 whitespace-nowrap">
                          {bill.billingMonth ? (
                            <span className="inline-flex items-center gap-1 font-bold text-indigo-600 bg-indigo-50 border border-indigo-100/60 px-2 py-0.5 rounded text-[10px]">
                              <Calendar className="w-3 h-3 text-indigo-400" />
                              {getEnglishMonthName(bill.billingMonth)}
                            </span>
                          ) : (
                            <span className="text-slate-400 font-mono text-[11px]">—</span>
                          )}
                        </td>

                        {/* Payment Method */}
                        <td className="py-3.5 px-3 whitespace-nowrap text-center">
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200/50">
                            <PaymentMethodLogo method={bill.paymentMethod} className="w-3.5 h-3.5" />
                            <span>{bill.paymentMethod || 'Cash'}</span>
                          </span>
                        </td>

                        {/* Collector Name */}
                        <td className="py-3.5 px-3 whitespace-nowrap">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-50 text-slate-700 border border-slate-200/60 text-[10.5px] font-bold">
                            {bill.collectorName || bill.receivedBy || 'N/A'}
                          </span>
                        </td>

                        {/* Amount */}
                        <td className="py-3.5 px-3 text-right font-black text-slate-800 font-mono whitespace-nowrap">
                          ৳ {bill.amount.toLocaleString('en-US')}
                        </td>

                        {/* Status */}
                        <td className="py-3.5 px-3 text-center whitespace-nowrap">
                          {((bill.status as any) === 'pending' || bill.status === 'pending_supervisor') && (
                            <span className="inline-flex items-center gap-1 text-[10px] bg-amber-50 text-amber-700 border border-amber-200/50 px-2 py-0.5 rounded-full font-bold">
                              <Clock className="w-3 h-3 text-amber-500 shrink-0" />
                              <span>Wait Supervisor</span>
                            </span>
                          )}
                          {bill.status === 'pending_manager' && (
                            <span className="inline-flex items-center gap-1 text-[10px] bg-blue-50 text-blue-700 border border-blue-200/50 px-2 py-0.5 rounded-full font-bold">
                              <Clock className="w-3 h-3 text-blue-500 shrink-0" />
                              <span>Wait Manager</span>
                            </span>
                          )}
                          {bill.status === 'pending_accounts' && (
                            <span className="inline-flex items-center gap-1 text-[10px] bg-purple-50 text-purple-700 border border-purple-200/50 px-2 py-0.5 rounded-full font-bold">
                              <Clock className="w-3 h-3 text-purple-500 shrink-0" />
                              <span>Wait Accounts</span>
                            </span>
                          )}
                          {bill.status === 'approved' && (
                            <span className="inline-flex items-center gap-1 text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200/50 px-2 py-0.5 rounded-full font-bold">
                              <CheckCircle className="w-3 h-3 text-emerald-500 shrink-0" />
                              <span>Approved</span>
                            </span>
                          )}
                          {bill.status === 'rejected' && (
                            <span className="inline-flex items-center gap-1 text-[10px] bg-rose-50 text-rose-700 border border-rose-200/50 px-2 py-0.5 rounded-full font-bold">
                              <XCircle className="w-3 h-3 text-rose-500 shrink-0" />
                              <span>Cancelled</span>
                            </span>
                          )}
                        </td>

                        {/* Actions button panel */}
                        <td className="py-3.5 px-3 text-center whitespace-nowrap">
                          <div className="flex items-center justify-center gap-1.5 select-none">
                            {isPending && (
                              <>
                                {((bill.status as any) === 'pending' || bill.status === 'pending_supervisor') && (
                                  hasBillApprovalPermission(bill) ? (
                                    <button
                                      type="button"
                                      onClick={() => openApprovalModal(bill, 'pending_manager', 'Supervisor Approval (Step 1)', 'Supervisor')}
                                      className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[10px] font-bold transition shadow-sm cursor-pointer whitespace-nowrap"
                                      title="Supervisor Approve Bill"
                                    >
                                      Supervisor Approve
                                    </button>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => setDeleteAccessDeniedNotice('Access Denied: Step 1 approval requires Supervisor or Admin role permission.')}
                                      className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-400 rounded-lg text-[10px] font-semibold transition cursor-pointer whitespace-nowrap flex items-center gap-1 border border-slate-200/60"
                                      title="Locked: Requires Supervisor approval permission"
                                    >
                                      <Lock className="w-2.5 h-2.5 text-slate-400" />
                                      <span>Supervisor Approve</span>
                                    </button>
                                  )
                                )}
                                {bill.status === 'pending_manager' && (
                                  hasBillApprovalPermission(bill) ? (
                                    <button
                                      type="button"
                                      onClick={() => openApprovalModal(bill, 'pending_accounts', 'Manager Approval (Step 2)', 'Manager')}
                                      className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[10px] font-bold transition shadow-sm cursor-pointer whitespace-nowrap"
                                      title="Manager Approve Bill"
                                    >
                                      Manager Approve
                                    </button>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => setDeleteAccessDeniedNotice('Access Denied: Step 2 approval requires Manager or Admin role permission.')}
                                      className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-400 rounded-lg text-[10px] font-semibold transition cursor-pointer whitespace-nowrap flex items-center gap-1 border border-slate-200/60"
                                      title="Locked: Requires Manager approval permission"
                                    >
                                      <Lock className="w-2.5 h-2.5 text-slate-400" />
                                      <span>Manager Approve</span>
                                    </button>
                                  )
                                )}
                                {bill.status === 'pending_accounts' && (
                                  hasBillApprovalPermission(bill) ? (
                                    <button
                                      type="button"
                                      onClick={() => openApprovalModal(bill, 'approved', 'Accounts Final Approval (Step 3)', 'Accountant')}
                                      className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[10px] font-bold transition shadow-sm cursor-pointer whitespace-nowrap"
                                      title="Accounts Approve Bill"
                                    >
                                      Accounts Approve
                                    </button>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => setDeleteAccessDeniedNotice('Access Denied: Step 3 approval requires Accounts or Admin role permission.')}
                                      className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-400 rounded-lg text-[10px] font-semibold transition cursor-pointer whitespace-nowrap flex items-center gap-1 border border-slate-200/60"
                                      title="Locked: Requires Accounts approval permission"
                                    >
                                      <Lock className="w-2.5 h-2.5 text-slate-400" />
                                      <span>Accounts Approve</span>
                                    </button>
                                  )
                                )}

                                {canRejectBill(bill) ? (
                                  <button
                                    type="button"
                                    onClick={() => handleInitiateReject(bill.id)}
                                    className="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-[10px] font-bold transition shadow-sm cursor-pointer whitespace-nowrap"
                                    title="Cancel"
                                  >
                                    Cancel
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => setDeleteAccessDeniedNotice('Access Denied: Only authorized approvers or Admin can cancel bills.')}
                                    className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-400 rounded-lg text-[10px] font-semibold transition cursor-pointer whitespace-nowrap flex items-center gap-1 border border-slate-200/60"
                                    title="Requires approval permission to cancel"
                                  >
                                    <Lock className="w-2.5 h-2.5 text-slate-400" />
                                    <span>Cancel</span>
                                  </button>
                                )}

                                <button
                                  type="button"
                                  onClick={() => openEditModal(bill)}
                                  className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition cursor-pointer"
                                  title="Edit Bill"
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                </button>
                              </>
                            )}

                            {(bill.status === 'approved' || bill.status === 'rejected') && (
                              canReviewAgainBill(bill) ? (
                                <button
                                  type="button"
                                  onClick={() => handleReviewAgain(bill.id)}
                                  className="px-2 py-1 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg text-[9px] font-bold transition cursor-pointer whitespace-nowrap"
                                  title="Send back for review"
                                >
                                  Review Again
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => setDeleteAccessDeniedNotice('Access Denied: Only authorized approvers or Admin can send bills back for review.')}
                                  className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-400 rounded-lg text-[9px] font-semibold transition cursor-pointer whitespace-nowrap flex items-center gap-1 border border-slate-200/60"
                                  title="Requires approval role to review"
                                >
                                  <Lock className="w-2.5 h-2.5 text-slate-400" />
                                  <span>Review Again</span>
                                </button>
                              )
                            )}

                            {/* Download Slip Button */}
                            <button
                              type="button"
                              onClick={() => downloadSingleBillReceipt(bill)}
                              className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition cursor-pointer"
                              title="Download Bill Slip"
                            >
                              <Download className="w-3.5 h-3.5" />
                            </button>

                            {/* Delete Bill Button */}
                            <button
                              type="button"
                              onClick={() => handleInitiateDeleteBill(bill, clientName)}
                              className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                              title={canDeleteBills ? "Delete Bill" : "Delete Bill (Admin Permission Required)"}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>

                            {/* Real-time Tracking Button */}
                            <button
                              type="button"
                              onClick={() => setTrackingBill(bill)}
                              className="px-2.5 py-1 bg-slate-900 hover:bg-indigo-950 text-white rounded-lg text-[10px] font-extrabold transition flex items-center gap-1.5 cursor-pointer hover:shadow shrink-0 ml-1 whitespace-nowrap"
                              title="Track Bill Live & View Time"
                            >
                              <Activity className="w-3.5 h-3.5 text-indigo-400 animate-pulse" />
                              <span>⏱ Track</span>
                            </button>
                          </div>
                        </td>
                      </tr>

                      {/* Expandable nested table detail box */}
                      {isExpanded && (
                        <tr className="bg-slate-50/40 select-text">
                          <td colSpan={10} className="p-4 border-t border-slate-100">
                            <div className="space-y-3.5 text-left pl-8 max-w-4xl">
                              {/* Metadata info */}
                              <div className="flex flex-wrap items-center gap-x-6 gap-y-1.5 text-slate-500 font-bold text-[10px] border-b border-slate-100 pb-2">
                                <span>📅 Date: <strong className="text-slate-700 font-mono">{bill.date}</strong></span>
                                <span>👤 Collector: <strong className="text-slate-700">{bill.collectorName || bill.receivedBy || 'N/A'}</strong></span>
                                <span>🏢 Receiver: <strong className="text-slate-700">{bill.receiverName || 'System Admin'}</strong></span>
                                <span>🗓 Billing Month: <strong className="text-slate-700">{getEnglishMonthName(bill.billingMonth || '')}</strong></span>
                              </div>

                              {/* Bill Notes / Description */}
                              {bill.notes && (
                                <div className="space-y-1">
                                  <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-tight">Audit Note & Comments:</span>
                                  <p className="text-[11px] text-slate-600 bg-white p-3 rounded-xl border border-slate-200/60 leading-snug font-medium italic">
                                    "{bill.notes}"
                                  </p>
                                </div>
                              )}

                              {/* Rejection reason comments */}
                              {bill.status === 'rejected' && bill.rejectionReason && (
                                <div className="p-3 bg-rose-50 border border-rose-100/70 rounded-xl flex items-start gap-2 text-[11px] text-rose-700 leading-snug">
                                  <XCircle className="w-4 h-4 shrink-0 text-rose-500 mt-0.5" />
                                  <div>
                                    <strong className="text-rose-800">Cancellation Reason: </strong>
                                    {bill.rejectionReason}
                                  </div>
                                </div>
                              )}

                              {/* 3-Layer Approver Cards */}
                              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
                                <div className={`p-2.5 rounded-xl border text-[10.5px] ${bill.supervisorApprovedAt ? 'bg-emerald-50/60 border-emerald-200/80 text-emerald-950' : 'bg-slate-50 border-slate-200/60 text-slate-500'}`}>
                                  <div className="flex items-center justify-between font-bold mb-1">
                                    <span className="flex items-center gap-1">
                                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                                      <span>1. Supervisor</span>
                                    </span>
                                    <span className="font-mono text-[9.5px]">{bill.supervisorApprovedAt ? '✓ Approved' : '⏳ Pending'}</span>
                                  </div>
                                  {bill.supervisorApprovedBy ? (
                                    <div className="space-y-0.5 text-[10px]">
                                      <p className="font-semibold text-slate-800">By: {bill.supervisorApprovedBy} <span className="text-slate-500 font-normal">({bill.supervisorDesignation || 'Supervisor'})</span></p>
                                      <p className="text-slate-400 font-mono text-[9px]">{formatEnglishDateTime(bill.supervisorApprovedAt)}</p>
                                      {bill.supervisorComment && <p className="italic text-slate-600 bg-white/90 p-1.5 rounded border border-emerald-100 mt-1 font-sans">"{bill.supervisorComment}"</p>}
                                    </div>
                                  ) : (
                                    <p className="text-[10px] text-slate-400 italic">Not approved yet</p>
                                  )}
                                </div>

                                <div className={`p-2.5 rounded-xl border text-[10.5px] ${bill.managerApprovedAt ? 'bg-emerald-50/60 border-emerald-200/80 text-emerald-950' : 'bg-slate-50 border-slate-200/60 text-slate-500'}`}>
                                  <div className="flex items-center justify-between font-bold mb-1">
                                    <span className="flex items-center gap-1">
                                      <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
                                      <span>2. Manager</span>
                                    </span>
                                    <span className="font-mono text-[9.5px]">{bill.managerApprovedAt ? '✓ Approved' : '⏳ Pending'}</span>
                                  </div>
                                  {bill.managerApprovedBy ? (
                                    <div className="space-y-0.5 text-[10px]">
                                      <p className="font-semibold text-slate-800">By: {bill.managerApprovedBy} <span className="text-slate-500 font-normal">({bill.managerDesignation || 'Manager'})</span></p>
                                      <p className="text-slate-400 font-mono text-[9px]">{formatEnglishDateTime(bill.managerApprovedAt)}</p>
                                      {bill.managerComment && <p className="italic text-slate-600 bg-white/90 p-1.5 rounded border border-blue-100 mt-1 font-sans">"{bill.managerComment}"</p>}
                                    </div>
                                  ) : (
                                    <p className="text-[10px] text-slate-400 italic">Not approved yet</p>
                                  )}
                                </div>

                                <div className={`p-2.5 rounded-xl border text-[10.5px] ${bill.accountsApprovedAt ? 'bg-emerald-50/60 border-emerald-200/80 text-emerald-950' : 'bg-slate-50 border-slate-200/60 text-slate-500'}`}>
                                  <div className="flex items-center justify-between font-bold mb-1">
                                    <span className="flex items-center gap-1">
                                      <ShieldCheck className="w-3.5 h-3.5 text-purple-600" />
                                      <span>3. Accounts</span>
                                    </span>
                                    <span className="font-mono text-[9.5px]">{bill.accountsApprovedAt ? '✓ Approved' : '⏳ Pending'}</span>
                                  </div>
                                  {bill.accountsApprovedBy ? (
                                    <div className="space-y-0.5 text-[10px]">
                                      <p className="font-semibold text-slate-800">By: {bill.accountsApprovedBy} <span className="text-slate-500 font-normal">({bill.accountsDesignation || 'Accountant'})</span></p>
                                      <p className="text-slate-400 font-mono text-[9px]">{formatEnglishDateTime(bill.accountsApprovedAt)}</p>
                                      {bill.accountsComment && <p className="italic text-slate-600 bg-white/90 p-1.5 rounded border border-purple-100 mt-1 font-sans">"{bill.accountsComment}"</p>}
                                    </div>
                                  ) : (
                                    <p className="text-[10px] text-slate-400 italic">Not approved yet</p>
                                  )}
                                </div>
                              </div>

                              <div className="flex items-center gap-3 pt-1">
                                <button
                                  type="button"
                                  onClick={() => downloadSingleBillReceipt(bill)}
                                  className="inline-flex items-center gap-1.5 text-[11px] font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 border border-indigo-100 px-3 py-1 rounded-lg transition cursor-pointer"
                                >
                                  <Download className="w-3.5 h-3.5" />
                                  <span>Download Verification Receipt</span>
                                </button>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
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

      {/* 🕒 TIME & APPROVAL TRACKING PORTAL MODAL */}
      {trackingBill && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex flex-col justify-between overflow-y-auto animate-fade-in font-sans">
          {/* Header Bar */}
          <div className="bg-slate-900 border-b border-slate-800 px-6 py-4 flex items-center justify-between sticky top-0 z-10 shadow-lg">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                <Activity className="w-5 h-5 animate-pulse" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base sm:text-lg font-black text-white tracking-tight">Subscriber Bill Tracking Portal</h2>
                  <span className="bg-indigo-900/50 text-indigo-300 border border-indigo-800 text-[10px] sm:text-xs font-bold px-2 py-0.5 rounded-full font-mono">
                    ID: {trackingBill.clientId || (trackingBill.id ? `BILL-${trackingBill.id.slice(-6).toUpperCase()}` : 'BILL-001')}
                  </span>
                </div>
                <p className="text-[10px] sm:text-xs text-slate-400 font-semibold uppercase tracking-wider">Real-time Approval Tracking & Total Time Analysis</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => downloadSingleBillReceipt(trackingBill)}
                className="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white text-xs font-bold rounded-xl border border-indigo-500/20 transition flex items-center gap-1.5 cursor-pointer shadow-sm"
              >
                <Download className="w-4 h-4 text-white" />
                <span className="hidden sm:inline">Download Slip</span>
              </button>
              <button
                type="button"
                onClick={() => setTrackingBill(null)}
                className="p-2.5 bg-rose-950/40 hover:bg-rose-900/60 active:bg-rose-800/80 text-rose-300 border border-rose-800/50 rounded-xl transition cursor-pointer font-bold duration-150"
                title="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Main Space - Two Columns on desktop */}
          <div className="flex-1 max-w-7xl w-full mx-auto p-6 sm:p-8 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            
            {/* Left Box: Subscriber Bill specifications and details */}
            <div className="lg:col-span-7 bg-slate-900/80 rounded-3xl border border-slate-800 p-6 sm:p-8 space-y-6">
              
              <div className="flex justify-between items-start border-b border-slate-800 pb-5">
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 tracking-widest block mb-1">Subscriber</span>
                  <div className="text-lg font-bold text-white flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-slate-800 text-indigo-400 flex items-center justify-center font-bold font-sans text-xs shrink-0 select-none">
                      {trackingBill.title ? trackingBill.title.replace(/Home Subscriber Monthly Bill: |Home User Monthly Bill: |হোম ইউজার মাসিক বিল: /g, '').substring(0, 2).toUpperCase() : 'SU'}
                    </div>
                    <span>{trackingBill.title ? trackingBill.title.replace(/Home Subscriber Monthly Bill: |Home User Monthly Bill: |হোম ইউজার মাসিক বিল: /g, '').replace(/[()]/g, '') : 'Subscriber'}</span>
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-[10px] uppercase font-bold text-slate-400 tracking-widest block mb-1">Category & Type</span>
                  <span className="px-3 py-1 rounded bg-indigo-950 border border-indigo-800 text-indigo-300 text-xs font-black">
                    Customer Bill (Income)
                  </span>
                </div>
              </div>

              {/* Standard Attributes details */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-5">
                <div>
                  <span className="text-[10px] text-slate-400 font-bold block uppercase font-sans">Date</span>
                  <span className="text-sm font-semibold text-white font-sans font-mono">{trackingBill.date}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-bold block uppercase font-sans">Total Amount</span>
                  <span className="text-base font-black text-emerald-400 font-sans font-mono">৳ {trackingBill.amount.toLocaleString('en-US')}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-bold block uppercase font-sans">Current Status</span>
                  <span className="mt-1 inline-block">
                    {trackingBill.status === 'approved' && (
                      <span className="text-[10px] bg-emerald-950 text-emerald-400 border border-emerald-800 px-2.5 py-0.5 rounded-full font-bold font-sans">Approved</span>
                    )}
                    {(trackingBill.status === 'pending' || trackingBill.status === 'pending_supervisor') && (
                      <span className="text-[10px] bg-amber-950 text-amber-400 border border-amber-800 px-2.5 py-0.5 rounded-full font-bold font-sans animate-pulse">Wait Supervisor</span>
                    )}
                    {trackingBill.status === 'pending_manager' && (
                      <span className="text-[10px] bg-blue-950 text-blue-400 border border-blue-800 px-2.5 py-0.5 rounded-full font-bold font-sans animate-pulse">Wait Manager</span>
                    )}
                    {trackingBill.status === 'pending_accounts' && (
                      <span className="text-[10px] bg-purple-950 text-purple-400 border border-purple-800 px-2.5 py-0.5 rounded-full font-bold font-sans animate-pulse">Wait Accounts</span>
                    )}
                    {trackingBill.status === 'rejected' && (
                      <span className="text-[10px] bg-rose-950 text-rose-400 border border-rose-800 px-2.5 py-0.5 rounded-full font-bold font-sans">Cancelled</span>
                    )}
                  </span>
                </div>
              </div>

              {/* Subscriber Information Table */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5 border-b border-slate-800 pb-2">
                  <span>📋 Bill Collection Details</span>
                </h4>
                <div className="overflow-hidden border border-slate-800 rounded-2xl bg-slate-950">
                  <table className="w-full text-xs text-left text-slate-300">
                    <thead className="bg-slate-900 border-b border-slate-800 text-[10px] font-bold text-slate-400 select-none">
                      <tr>
                        <th className="p-3">Field</th>
                        <th className="p-3">Details</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-900">
                      <tr className="hover:bg-slate-900/50">
                        <td className="p-3 text-slate-400 font-semibold">Subscriber ID</td>
                        <td className="p-3 font-mono font-bold text-indigo-400">{trackingBill.clientId || 'H-USER'}</td>
                      </tr>
                      <tr className="hover:bg-slate-900/50">
                        <td className="p-3 text-slate-400 font-semibold">Billing Month</td>
                        <td className="p-3 font-semibold text-white">{getEnglishMonthName(trackingBill.billingMonth || '')}</td>
                      </tr>
                      <tr className="hover:bg-slate-900/50">
                        <td className="p-3 text-slate-400 font-semibold">Payment Method</td>
                        <td className="p-3 font-semibold text-white">{trackingBill.paymentMethod || 'Cash'}</td>
                      </tr>
                      <tr className="hover:bg-slate-900/50">
                        <td className="p-3 text-slate-400 font-semibold">Collector</td>
                        <td className="p-3 font-semibold text-white">{trackingBill.collectorName || trackingBill.receivedBy || 'N/A'}</td>
                      </tr>
                      <tr className="hover:bg-slate-900/50">
                        <td className="p-3 text-slate-400 font-semibold">Receiver / Cashier</td>
                        <td className="p-3 font-semibold text-white">{trackingBill.receiverName || 'System Admin'}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Extra comments or cancellation message */}
              {trackingBill.notes && (
                <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800">
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-1">Audit Note / Collector Comment</span>
                  <p className="text-xs text-slate-200 leading-relaxed font-semibold italic">"{trackingBill.notes}"</p>
                </div>
              )}

              {trackingBill.status === 'rejected' && trackingBill.rejectionReason && (
                <div className="p-4 bg-rose-950/30 rounded-2xl border border-rose-900/50">
                  <span className="text-[10px] text-rose-400 font-extrabold uppercase tracking-wider block mb-1">❌ Official Cancellation Reason</span>
                  <p className="text-xs text-rose-200 font-extrabold">{trackingBill.rejectionReason}</p>
                </div>
              )}
            </div>

            {/* Right Box: Highly polished step-by-step visual tracker */}
            <div className="lg:col-span-5 bg-slate-900 rounded-3xl border border-slate-800 p-6 sm:p-8 space-y-6 flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 pb-4 border-b border-slate-800 mb-6">
                  <Clock className="w-5 h-5 text-indigo-400 animate-pulse animate-spin" style={{ animationDuration: '6s' }} />
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider">Real-time Approval Track & Time</h3>
                </div>

                {/* Vertical timeline steps */}
                <div className="space-y-6 relative before:absolute before:top-2 before:bottom-2 before:left-4 before:w-[2px] before:bg-slate-800 font-sans">
                  
                  {/* Step 1: Draft & Submit */}
                  <div className="flex gap-4 relative">
                    <div className="w-8 h-8 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-500/50 flex items-center justify-center font-bold font-sans z-10 shrink-0 shadow-[0_0_15px_rgba(16,185,129,0.2)]">
                      ✓
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-xs sm:text-sm font-black text-white">Step 1: Submission & Entry</h4>
                        <span className="bg-emerald-950 text-emerald-400 text-[9px] font-bold px-1.5 py-0.5 rounded tracking-wider">Completed</span>
                      </div>
                      <p className="text-[11px] text-slate-400 font-semibold mt-1">
                        Collected by <span className="text-slate-200 font-extrabold">{trackingBill.collectorName || trackingBill.receivedBy || 'Collector'}</span>.
                      </p>
                      <div className="mt-1 text-[9px] text-slate-500 font-bold bg-slate-950 px-2 py-0.5 rounded border border-slate-800/85 inline-block font-sans">
                        {formatEnglishDateTime(trackingBill.createdAt || trackingBill.date)}
                      </div>
                    </div>
                  </div>

                  {/* Step 2: Supervisor Approval */}
                  <div className="flex gap-4 relative">
                    {(trackingBill.status === 'pending_manager' || trackingBill.status === 'pending_accounts' || trackingBill.status === 'approved') ? (
                      <div className="w-8 h-8 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-500/50 flex items-center justify-center font-bold font-sans z-10 shrink-0">
                        ✓
                      </div>
                    ) : trackingBill.status === 'rejected' && !trackingBill.supervisorApprovedAt ? (
                      <div className="w-8 h-8 rounded-full bg-rose-950 text-rose-400 border border-rose-500/50 flex items-center justify-center font-bold font-sans z-10 shrink-0">
                        ✕
                      </div>
                    ) : (trackingBill.status === 'pending' || trackingBill.status === 'pending_supervisor') ? (
                      <div className="w-8 h-8 rounded-full bg-indigo-950 text-indigo-400 border border-indigo-500/50 flex items-center justify-center font-bold font-sans z-10 shrink-0 relative">
                        <span className="absolute inset-0 rounded-full bg-indigo-400/25 animate-ping"></span>
                        <span className="relative text-[10px]">⌛</span>
                      </div>
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-slate-800 text-slate-400 border border-slate-700/80 flex items-center justify-center font-bold z-10 shrink-0">
                        ⌛
                      </div>
                    )}
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-xs sm:text-sm font-black text-white">Step 2: Supervisor Approval</h4>
                        {(trackingBill.status === 'pending_manager' || trackingBill.status === 'pending_accounts' || trackingBill.status === 'approved') ? (
                          <span className="bg-emerald-950 text-emerald-400 text-[9px] font-bold px-1.5 py-0.5 rounded">Approved</span>
                        ) : trackingBill.status === 'rejected' && !trackingBill.supervisorApprovedAt ? (
                          <span className="bg-rose-950 text-rose-400 text-[9px] font-bold px-1.5 py-0.5 rounded">Cancelled</span>
                        ) : (trackingBill.status === 'pending' || trackingBill.status === 'pending_supervisor') ? (
                          <span className="bg-indigo-950 text-indigo-400 text-[9px] font-bold px-1.5 py-0.5 rounded animate-pulse">Awaiting</span>
                        ) : (
                          <span className="bg-slate-800 text-slate-400 text-[9px] font-bold px-1.5 py-0.5 rounded">Pending</span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-400 font-semibold mt-1">
                        Initial vetting of subscriber collection and receipt amount.
                      </p>
                      {trackingBill.supervisorApprovedAt && (
                        <div className="mt-1 text-[9px] text-slate-300 font-bold bg-slate-950 px-2.5 py-1 rounded border border-slate-800/85 block font-sans space-y-0.5">
                          <div>Approved by <span className="text-white font-bold">{trackingBill.supervisorApprovedBy || 'Supervisor'}</span> <span className="text-slate-400 font-normal">({trackingBill.supervisorDesignation || 'Supervisor'})</span> at {formatEnglishDateTime(trackingBill.supervisorApprovedAt)}</div>
                          {trackingBill.supervisorComment && <div className="text-slate-400 text-[9px] italic font-sans font-medium">Remarks: "{trackingBill.supervisorComment}"</div>}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Step 3: Manager Approval */}
                  <div className="flex gap-4 relative">
                    {(trackingBill.status === 'pending_accounts' || trackingBill.status === 'approved') ? (
                      <div className="w-8 h-8 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-500/50 flex items-center justify-center font-bold font-sans z-10 shrink-0">
                        ✓
                      </div>
                    ) : trackingBill.status === 'rejected' && trackingBill.supervisorApprovedAt && !trackingBill.managerApprovedAt ? (
                      <div className="w-8 h-8 rounded-full bg-rose-950 text-rose-400 border border-rose-500/50 flex items-center justify-center font-bold font-sans z-10 shrink-0">
                        ✕
                      </div>
                    ) : trackingBill.status === 'pending_manager' ? (
                      <div className="w-8 h-8 rounded-full bg-indigo-950 text-indigo-400 border border-indigo-500/50 flex items-center justify-center font-bold font-sans z-10 shrink-0 relative">
                        <span className="absolute inset-0 rounded-full bg-indigo-400/25 animate-ping"></span>
                        <span className="relative text-[10px]">⌛</span>
                      </div>
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-slate-800 text-slate-400 border border-slate-700/80 flex items-center justify-center font-bold z-10 shrink-0">
                        ⌛
                      </div>
                    )}
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-xs sm:text-sm font-black text-white">Step 3: Manager Approval</h4>
                        {(trackingBill.status === 'pending_accounts' || trackingBill.status === 'approved') ? (
                          <span className="bg-emerald-950 text-emerald-400 text-[9px] font-bold px-1.5 py-0.5 rounded">Approved</span>
                        ) : trackingBill.status === 'rejected' && trackingBill.supervisorApprovedAt && !trackingBill.managerApprovedAt ? (
                          <span className="bg-rose-950 text-rose-400 text-[9px] font-bold px-1.5 py-0.5 rounded">Cancelled</span>
                        ) : trackingBill.status === 'pending_manager' ? (
                          <span className="bg-indigo-950 text-indigo-400 text-[9px] font-bold px-1.5 py-0.5 rounded animate-pulse">Awaiting</span>
                        ) : (
                          <span className="bg-slate-800 text-slate-400 text-[9px] font-bold px-1.5 py-0.5 rounded">Pending</span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-400 font-semibold mt-1">
                        Operational verification, billing month clearance, and review.
                      </p>
                      {trackingBill.managerApprovedAt && (
                        <div className="mt-1 text-[9px] text-slate-300 font-bold bg-slate-950 px-2.5 py-1 rounded border border-slate-800/85 block font-sans space-y-0.5">
                          <div>Approved by <span className="text-white font-bold">{trackingBill.managerApprovedBy || 'Manager'}</span> <span className="text-slate-400 font-normal">({trackingBill.managerDesignation || 'Manager'})</span> at {formatEnglishDateTime(trackingBill.managerApprovedAt)}</div>
                          {trackingBill.managerComment && <div className="text-slate-400 text-[9px] italic font-sans font-medium">Remarks: "{trackingBill.managerComment}"</div>}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Step 4: Accounts Approval & Posting */}
                  <div className="flex gap-4 relative">
                    {trackingBill.status === 'approved' ? (
                      <div className="w-8 h-8 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-500/50 flex items-center justify-center font-bold font-sans z-10 shrink-0 shadow-[0_0_15px_rgba(16,185,129,0.3)]">
                        ✓
                      </div>
                    ) : trackingBill.status === 'rejected' && trackingBill.managerApprovedAt ? (
                      <div className="w-8 h-8 rounded-full bg-rose-950 text-rose-400 border border-rose-500/50 flex items-center justify-center font-bold font-sans z-10 shrink-0">
                        ✕
                      </div>
                    ) : trackingBill.status === 'pending_accounts' ? (
                      <div className="w-8 h-8 rounded-full bg-indigo-950 text-indigo-400 border border-indigo-500/50 flex items-center justify-center font-bold font-sans z-10 shrink-0 relative">
                        <span className="absolute inset-0 rounded-full bg-indigo-400/25 animate-ping"></span>
                        <span className="relative text-[10px]">⌛</span>
                      </div>
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-slate-800 text-slate-400 border border-slate-700/80 flex items-center justify-center font-bold z-10 shrink-0">
                        ⌛
                      </div>
                    )}
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-xs sm:text-sm font-black text-white">Step 4: Accounts Posting</h4>
                        {trackingBill.status === 'approved' ? (
                          <span className="bg-emerald-950 text-emerald-400 text-[9px] font-bold px-1.5 py-0.5 rounded font-sans">Approved</span>
                        ) : trackingBill.status === 'rejected' && trackingBill.managerApprovedAt ? (
                          <span className="bg-rose-950 text-rose-400 text-[9px] font-bold px-1.5 py-0.5 rounded font-sans">Cancelled</span>
                        ) : trackingBill.status === 'pending_accounts' ? (
                          <span className="bg-indigo-950 text-indigo-400 text-[9px] font-bold px-1.5 py-0.5 rounded animate-pulse">Awaiting</span>
                        ) : (
                          <span className="bg-slate-800 text-slate-400 text-[9px] font-bold px-1.5 py-0.5 rounded font-sans">Pending</span>
                        )}
                      </div>
                      
                      <div className="text-[11px] text-slate-400 font-semibold mt-1 leading-relaxed">
                        {trackingBill.status === 'approved' && (
                          <p>
                            Vetted and posted to cash book. Total collection of <span className="text-emerald-400 font-bold">৳ {trackingBill.amount.toLocaleString('en-US')}</span> was committed to ledger.
                          </p>
                        )}
                        {trackingBill.status === 'rejected' && trackingBill.managerApprovedAt && (
                          <p className="text-rose-300 font-bold">
                            Rejected at accounts stage. Reason: {trackingBill.rejectionReason || 'N/A'}
                          </p>
                        )}
                        {(trackingBill.status === 'pending' || trackingBill.status === 'pending_supervisor' || trackingBill.status === 'pending_manager' || trackingBill.status === 'pending_accounts') && (
                          <p>
                            Awaiting accountant ledger commitment.
                          </p>
                        )}
                      </div>

                      {trackingBill.accountsApprovedAt && (
                        <div className="mt-1 text-[9px] text-slate-300 font-bold bg-slate-950 px-2.5 py-1 rounded border border-slate-800/85 block font-sans space-y-0.5">
                          <div>Vetted & Approved by <span className="text-white font-bold">{trackingBill.accountsApprovedBy || 'Accountant'}</span> <span className="text-slate-400 font-normal">({trackingBill.accountsDesignation || 'Accountant'})</span> at {formatEnglishDateTime(trackingBill.accountsApprovedAt)}</div>
                          {trackingBill.accountsComment && <div className="text-slate-400 text-[9px] italic font-sans font-medium">Remarks: "{trackingBill.accountsComment}"</div>}
                        </div>
                      )}
                    </div>
                  </div>

                </div>
              </div>

              {/* Status statistics inside tracking column */}
              <div className="mt-8 p-4 bg-slate-950 border border-slate-800 rounded-3xl space-y-3 font-sans text-xs">
                <div className="flex items-center gap-1.5 text-slate-300 font-black uppercase text-[10px] tracking-widest select-none">
                  <Activity className="w-3.5 h-3.5 text-indigo-400" />
                  <span>System Latency & Processing Data</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-slate-900 px-3 py-2.5 rounded-xl border border-slate-800">
                    <span className="text-[9px] text-slate-500 font-bold block uppercase font-sans">Bill Age</span>
                    <span className="text-white font-bold block mt-0.5 font-sans">
                      {(() => {
                        const sTime = trackingBill.createdAt ? new Date(trackingBill.createdAt).getTime() : Date.now();
                        const diffSec = Math.floor((Date.now() - sTime) / 1000);
                        if (diffSec < 60) return 'Just now';
                        const diffMin = Math.floor(diffSec / 60);
                        if (diffMin < 60) return `${diffMin} minutes ago`;
                        const diffHrs = Math.floor(diffMin / 60);
                        if (diffHrs < 24) return `${diffHrs} hours ago`;
                        const diffDays = Math.floor(diffHrs / 24);
                        return `${diffDays} days ago`;
                      })()}
                    </span>
                  </div>
                  <div className="bg-slate-900 px-3 py-2.5 rounded-xl border border-slate-800">
                    <span className="text-[9px] text-slate-500 font-bold block uppercase font-sans">Latest Status</span>
                    <span className="text-white font-extrabold block mt-0.5">
                      {trackingBill.status === 'approved' ? 'Approved & Posted' : 
                       trackingBill.status === 'rejected' ? 'Cancelled' : 
                       trackingBill.status === 'pending_manager' ? 'Wait Manager' :
                       trackingBill.status === 'pending_accounts' ? 'Wait Accounts' :
                       'Wait Supervisor'}
                    </span>
                  </div>
                </div>
              </div>

            </div>

          </div>
        </div>
      )}

      {/* Single Bill Delete Confirmation Modal (Admin) */}
      {billToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-100 overflow-hidden">
            {/* Header */}
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-rose-50/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-800">Delete Bill Record</h3>
                  <p className="text-xs text-slate-500 font-medium">Permanent deletion from approval ledger</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setBillToDelete(null)}
                disabled={isDeletingBill}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <div className="p-6 space-y-4">
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/60 space-y-2 text-xs">
                <div className="flex justify-between items-center py-0.5 border-b border-slate-200/40">
                  <span className="text-slate-500 font-medium">Client Name:</span>
                  <span className="font-bold text-slate-800">{billToDelete.clientName}</span>
                </div>
                <div className="flex justify-between items-center py-0.5 border-b border-slate-200/40">
                  <span className="text-slate-500 font-medium">Client ID:</span>
                  <span className="font-mono font-bold text-indigo-600">{billToDelete.clientId || 'H-USER'}</span>
                </div>
                <div className="flex justify-between items-center py-0.5 border-b border-slate-200/40">
                  <span className="text-slate-500 font-medium">Amount:</span>
                  <span className="font-mono font-black text-rose-600">৳ {billToDelete.amount.toLocaleString('en-US')}</span>
                </div>
                {billToDelete.billingMonth && (
                  <div className="flex justify-between items-center py-0.5 border-b border-slate-200/40">
                    <span className="text-slate-500 font-medium">Billing Month:</span>
                    <span className="font-bold text-slate-700">{getEnglishMonthName(billToDelete.billingMonth)}</span>
                  </div>
                )}
                {billToDelete.date && (
                  <div className="flex justify-between items-center py-0.5">
                    <span className="text-slate-500 font-medium">Date:</span>
                    <span className="font-mono text-slate-700">{billToDelete.date}</span>
                  </div>
                )}
              </div>

              <div className="p-3.5 bg-rose-50/70 border border-rose-200/60 rounded-xl flex items-start gap-2.5 text-xs text-rose-700">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <p className="leading-snug font-medium">
                  <strong>Warning:</strong> This subscriber bill payment entry will be permanently deleted from the database. This action cannot be undone.
                </p>
              </div>

              {deleteBillError && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-600 text-xs rounded-xl flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{deleteBillError}</span>
                </div>
              )}
            </div>

            {/* Footer Buttons */}
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setBillToDelete(null)}
                disabled={isDeletingBill}
                className="px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-xl text-xs font-bold hover:bg-slate-100 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteBill}
                disabled={isDeletingBill}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer shadow-md shadow-rose-600/20 disabled:opacity-50"
              >
                {isDeletingBill ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Yes, Permanently Delete</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete All Bills Confirmation Modal (Admin) */}
      {isDeleteAllModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-100 overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-rose-50/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-800">Reset All Entries (Reset to 0)</h3>
                  <p className="text-xs text-slate-500 font-medium">Delete all subscriber bills for this month</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsDeleteAllModalOpen(false)}
                disabled={isDeletingAllBills}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <p className="text-xs text-slate-600 font-medium leading-relaxed">
                You are about to delete <strong className="text-slate-900">{runningMonthBills.length}</strong> bill record(s) for the current month. Total collections and balances will reset to <strong>BDT 0</strong>.
              </p>

              <div className="p-3.5 bg-rose-50 border border-rose-200/70 rounded-xl flex items-start gap-2.5 text-xs text-rose-700">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <p className="leading-snug font-medium">
                  <strong>Permanent Action:</strong> This cannot be undone. All entries in the table will be permanently deleted.
                </p>
              </div>

              {deleteAllBillsError && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-600 text-xs rounded-xl flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{deleteAllBillsError}</span>
                </div>
              )}
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setIsDeleteAllModalOpen(false)}
                disabled={isDeletingAllBills}
                className="px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-xl text-xs font-bold hover:bg-slate-100 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteAllBills}
                disabled={isDeletingAllBills}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer shadow-md shadow-rose-600/20 disabled:opacity-50"
              >
                {isDeletingAllBills ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Resetting...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Yes, Reset All to 0</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Access Denied Modal for Unauthorized Delete Attempts */}
      {deleteAccessDeniedNotice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-slate-100 text-center space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-600 mx-auto flex items-center justify-center">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-bold text-slate-800">Admin Permission Required</h3>
              <p className="text-xs text-slate-500 font-medium leading-relaxed">
                {deleteAccessDeniedNotice}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setDeleteAccessDeniedNotice(null)}
              className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition cursor-pointer"
            >
              Understood
            </button>
          </div>
        </div>
      )}

      {/* Floating Success Toast */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-4 py-3 rounded-2xl shadow-2xl flex items-center gap-2.5 text-xs font-bold border border-slate-800 animate-slide-up">
          <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}
