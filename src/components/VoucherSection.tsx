import React, { useState, useEffect } from 'react';
import { 
  FileText, 
  Trash2, 
  PlusCircle, 
  Coins, 
  CheckCircle, 
  XSquare, 
  Clock, 
  Activity, 
  UserCheck, 
  Calendar,
  AlertCircle,
  FileCheck2,
  ListFilter,
  Pencil,
  Download,
  ShieldAlert
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
import { db, handleFirestoreError, OperationType } from '../firebase';
import { Voucher, Transaction, EXPENSE_CATEGORY_LABELS, AppUser } from '../types';

interface VoucherSectionProps {
  userId: string;
  onAddTransaction: (transaction: Omit<Transaction, 'id'>) => Promise<void>;
  currentUserProfile?: AppUser | null;
}

export function VoucherSection({ userId, onAddTransaction, currentUserProfile }: VoucherSectionProps) {
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [loading, setLoading] = useState(true);

  const [expandedVouchers, setExpandedVouchers] = useState<Record<string, boolean>>({});
  
  const toggleVoucherExpand = (id: string) => {
    setExpandedVouchers(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const getApproverName = (v: Voucher) => {
    if (v.status === 'approved') {
      return v.accountsApprovedBy || 'Accountant';
    }
    if (v.status === 'waiting_accounts') {
      return `Mgr: ${v.managerApprovedBy || 'Approved'}`;
    }
    if (v.status === 'waiting_manager') {
      return `Sup: ${v.supervisorApprovedBy || 'Approved'}`;
    }
    return '-';
  };

  // New States for Popups and Tracking
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [trackingVoucher, setTrackingVoucher] = useState<Voucher | null>(null);

  // Form State
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('other_expense');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [submittedBy, setSubmittedBy] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Attachment States
  const [attachmentName, setAttachmentName] = useState('');
  const [attachmentData, setAttachmentData] = useState('');

  // Reject / Cancel Voucher States
  const [rejectingVoucher, setRejectingVoucher] = useState<Voucher | null>(null);
  const [rejectionInput, setRejectionInput] = useState('');
  const [rejectionError, setRejectionError] = useState('');
  const [deletingVoucher, setDeletingVoucher] = useState<Voucher | null>(null);

  // Multi-Step Approval States
  const [approvingVoucher, setApprovingVoucher] = useState<Voucher | null>(null);
  const [approvalStep, setApprovalStep] = useState<number>(1);
  const [checkedStep1, setCheckedStep1] = useState<boolean>(false);
  const [checkedStep2, setCheckedStep2] = useState<boolean>(false);
  const [checkedStep3, setCheckedStep3] = useState<boolean>(false);
  const [approvalAuditNote, setApprovalAuditNote] = useState<string>('');
  const [approvalApproverName, setApprovalApproverName] = useState<string>('');

  // Viewing Attachment State
  const [viewingAttachment, setViewingAttachment] = useState<{ name: string; data: string } | null>(null);

  // Helper to check role-based approval permissions
  const hasApprovalPermission = (voucher: Voucher | null): boolean => {
    if (!voucher) return false;
    if (!currentUserProfile) return true; // default fallback
    if (currentUserProfile.role === 'admin') return true; // Admin has full access to everything

    if (voucher.status === 'pending') {
      return !!currentUserProfile.permissions?.canApproveSupervisor;
    }
    if (voucher.status === 'waiting_manager') {
      return !!currentUserProfile.permissions?.canApproveManager;
    }
    if (voucher.status === 'waiting_accounts') {
      return !!currentUserProfile.permissions?.canApproveAccounts;
    }
    return false;
  };

  // Edit Voucher States
  const [editingVoucher, setEditingVoucher] = useState<Voucher | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editAmount, setEditAmount] = useState('');
  const [editCategory, setEditCategory] = useState('other_expense');
  const [editDate, setEditDate] = useState('');
  const [editSubmittedBy, setEditSubmittedBy] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editAttachmentName, setEditAttachmentName] = useState('');
  const [editAttachmentData, setEditAttachmentData] = useState('');
  const [editTransportLogs, setEditTransportLogs] = useState<{ fromLocation: string; toLocation: string; reason: string; amount: number }[]>([]);
  const [editFromLoc, setEditFromLoc] = useState('');
  const [editToLoc, setEditToLoc] = useState('');
  const [editTReason, setEditTReason] = useState('');
  const [editTAmount, setEditTAmount] = useState('');
  const [editError, setEditError] = useState('');

  // Edit general items state
  const [editVoucherItems, setEditVoucherItems] = useState<{ sn: number; description: string; uom: string; quantity: number; amount: number }[]>([]);
  const [editItemDesc, setEditItemDesc] = useState('');
  const [editItemUom, setEditItemUom] = useState('Pcs');
  const [editItemQty, setEditItemQty] = useState('');
  const [editItemAmt, setEditItemAmt] = useState('');

  // Start Editing Handler
  const handleStartEdit = (voucher: Voucher) => {
    if (voucher.status !== 'pending') {
      alert('Only pending vouchers can be modified.');
      return;
    }
    setEditingVoucher(voucher);
    setEditTitle(voucher.title);
    setEditAmount(voucher.amount.toString());
    setEditCategory(voucher.category);
    setEditDate(voucher.date);
    setEditSubmittedBy(voucher.submittedBy);
    setEditNotes(voucher.notes || '');
    setEditAttachmentName(voucher.attachmentName || '');
    setEditAttachmentData(voucher.attachmentData || '');
    setEditTransportLogs(voucher.transportLogs || []);
    setEditVoucherItems(voucher.items || []);
    setEditFromLoc('');
    setEditToLoc('');
    setEditTReason('');
    setEditTAmount('');
    setEditItemDesc('');
    setEditItemUom('Pcs');
    setEditItemQty('');
    setEditItemAmt('');
    setEditError('');
  };

  // Add Transport Log in Edit Dialog
  const handleAddEditTransportLog = (e: React.MouseEvent) => {
    e.preventDefault();
    if (!editFromLoc.trim() || !editToLoc.trim() || !editTReason.trim()) {
      alert('Please complete the transport route details.');
      return;
    }
    const val = Number(editTAmount);
    if (isNaN(val) || val <= 0) {
      alert('Please input a valid amount.');
      return;
    }

    const newLog = {
      fromLocation: editFromLoc.trim(),
      toLocation: editToLoc.trim(),
      reason: editTReason.trim(),
      amount: val
    };

    const updated = [...editTransportLogs, newLog];
    setEditTransportLogs(updated);

    const sum = updated.reduce((acc, item) => acc + item.amount, 0);
    setEditAmount(sum.toString());

    setEditFromLoc('');
    setEditToLoc('');
    setEditTReason('');
    setEditTAmount('');
  };

  // Remove Transport Log in Edit Dialog
  const handleRemoveEditTransportLog = (idx: number) => {
    const updated = editTransportLogs.filter((_, i) => i !== idx);
    setEditTransportLogs(updated);

    const sum = updated.reduce((acc, item) => acc + item.amount, 0);
    setEditAmount(sum > 0 ? sum.toString() : '0');
  };

  // Add Item to universal Table in Edit mode
  const handleAddEditItem = (e: React.MouseEvent) => {
    e.preventDefault();
    if (!editItemDesc.trim()) {
      alert(editCategory === 'office_rent' ? 'Please enter the rental month.' : 'Please enter the item description.');
      return;
    }
    const qty = Number(editItemQty);
    const amt = Number(editItemAmt);
    if (isNaN(qty) || qty <= 0) {
      alert('Please enter a valid quantity in numbers.');
      return;
    }
    if (isNaN(amt) || amt <= 0) {
      alert('Please enter a valid amount in numbers.');
      return;
    }

    const newItem = {
      sn: editVoucherItems.length + 1,
      description: editItemDesc.trim(),
      uom: editCategory === 'office_rent' ? 'Month' : (editItemUom.trim() || 'Pcs'),
      quantity: qty,
      amount: amt
    };

    const updated = [...editVoucherItems, newItem];
    setEditVoucherItems(updated);

    const sum = updated.reduce((acc, item) => acc + item.amount, 0);
    setEditAmount(sum.toString());

    setEditItemDesc('');
    setEditItemUom('Pcs');
    setEditItemQty('');
    setEditItemAmt('');
  };

  const handleRemoveEditItem = (idx: number) => {
    const filtered = editVoucherItems.filter((_, i) => i !== idx);
    const updated = filtered.map((item, i) => ({
      ...item,
      sn: i + 1
    }));
    setEditVoucherItems(updated);

    const sum = updated.reduce((acc, item) => acc + item.amount, 0);
    setEditAmount(sum > 0 ? sum.toString() : '0');
  };

  // Edit File Upload Event Handler
  const handleEditFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 1.2 * 1024 * 1024) {
      alert('The voucher file size cannot exceed 1.2 MB. Please select a smaller file.');
      e.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setEditAttachmentName(file.name);
        setEditAttachmentData(reader.result);
      }
    };
    reader.onerror = () => {
      alert('An error occurred while processing the file.');
    };
    reader.readAsDataURL(file);
  };

  // Save Edit Voucher
  const handleSaveEditVoucher = async (e: React.FormEvent) => {
    e.preventDefault();
    setEditError('');

    if (!editTitle.trim()) {
      setEditError('Voucher number is missing.');
      return;
    }
    const parsedAmount = Number(editAmount);
    if (editCategory === 'transport' && editTransportLogs.length === 0) {
      setEditError('At least one route detail must be added for the transport category.');
      return;
    }
    if (editCategory !== 'transport' && editVoucherItems.length > 0) {
      const calculatedSum = editVoucherItems.reduce((acc, i) => acc + i.amount, 0);
      if (calculatedSum !== parsedAmount) {
        setEditError('The total voucher amount does not match the sum of the item table. Please correct the items.');
        return;
      }
    }
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setEditError('Please enter a correct expense amount for the voucher.');
      return;
    }
    if (!editSubmittedBy.trim()) {
      setEditError('Please enter the name of the submitter.');
      return;
    }

    if (!editingVoucher) return;

    const docRef = doc(db, 'vouchers', editingVoucher.id);
    try {
      await setDoc(docRef, {
        id: editingVoucher.id,
        userId,
        title: editTitle.trim(),
        amount: parsedAmount,
        category: editCategory,
        date: editDate,
        submittedBy: editSubmittedBy.trim(),
        status: editingVoucher.status,
        notes: editNotes.trim(),
        rejectionReason: editingVoucher.rejectionReason || '',
        attachmentName: editAttachmentName || '',
        attachmentData: editAttachmentData || '',
        transportLogs: editCategory === 'transport' ? editTransportLogs : [],
        items: editCategory === 'transport' ? [] : editVoucherItems,
        createdAt: editingVoucher.createdAt ? new Date(editingVoucher.createdAt) : serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      if (editingVoucher.status === 'approved') {
        alert('Voucher information updated successfully. Note: This was already an approved voucher, so ensure consistency with previous transaction statements if you want to balance total transactions.');
      } else {
        alert('Voucher entry updated successfully!');
      }

      setEditingVoucher(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `vouchers/${editingVoucher.id}`);
      setEditError('Failed to save the updated voucher.');
    }
  };

  // Download/Print Voucher Slip as a beautiful printable HTML document with print styling and auto-print
  const downloadVoucherSlip = (v: Voucher) => {
    const categoryLabel = EXPENSE_CATEGORY_LABELS[v.category as keyof typeof EXPENSE_CATEGORY_LABELS]?.label || 'Others';
    
    let statusClass = 'status-pending';
    let statusText = 'Pending';
    if (v.status === 'approved') {
      statusClass = 'status-approved';
      statusText = 'Approved';
    } else if (v.status === 'rejected') {
      statusClass = 'status-rejected';
      statusText = 'Rejected';
    }

    let transportRoutesHtml = '';
    if (v.category === 'transport' && v.transportLogs && v.transportLogs.length > 0) {
      transportRoutesHtml = `
      <div class="table-title">🚗 Detailed Transport Routes & Fare Details</div>
      <table class="route-table">
          <thead>
              <tr>
                  <th style="width: 8%; text-align: center;">SL</th>
                  <th style="width: 45%; text-align: left;">Route (Route Path)</th>
                  <th style="width: 32%; text-align: left;">Purpose / Medium</th>
                  <th style="text-align: right; width: 15%;">Fare</th>
              </tr>
          </thead>
          <tbody>
              ${v.transportLogs.map((log, idx) => `
              <tr>
                  <td style="text-align: center; font-weight: bold; color: #64748b;">${idx + 1}</td>
                  <td style="font-weight: 600; color: #0f172a;">${log.fromLocation} &rarr; ${log.toLocation}</td>
                  <td style="color: #475569;">${log.reason}</td>
                  <td style="text-align: right; font-weight: 700; color: #10b981; font-family: sans-serif;">৳ ${log.amount.toLocaleString('en-US')}</td>
              </tr>
              `).join('')}
          </tbody>
      </table>
      `;
    }

    let itemsTableHtml = '';
    if (v.category !== 'transport' && v.items && v.items.length > 0) {
      itemsTableHtml = `
      <div class="table-title">📋 Detailed Voucher Items & Price List</div>
      <table class="route-table">
          <thead>
              <tr>
                  <th style="width: 8%; text-align: center;">SL</th>
                  <th style="width: 50%; text-align: left;">Description</th>
                  <th style="width: 15%; text-align: center;">UoM</th>
                  <th style="width: 12%; text-align: center;">Qty</th>
                  <th style="text-align: right; width: 15%;">Amount</th>
              </tr>
          </thead>
          <tbody>
              ${v.items.map((item) => `
              <tr>
                  <td style="text-align: center; font-weight: bold; color: #64748b;">${item.sn}</td>
                  <td style="font-weight: 600; color: #0f172a;">${item.description}</td>
                  <td style="text-align: center; color: #475569;">${item.uom}</td>
                  <td style="text-align: center; font-weight: 700; color: #334155;">${item.quantity}</td>
                  <td style="text-align: right; font-weight: 700; color: #10b981; font-family: sans-serif;">৳ ${item.amount.toLocaleString('en-US')}</td>
              </tr>
              `).join('')}
          </tbody>
      </table>
      `;
    }

    const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Voucher Slip - ${v.title}</title>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Hind+Siliguri:wght@400;500;600;700&display=swap');
        
        * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
        }
        
        body {
            font-family: 'Hind Siliguri', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            background-color: #ffffff;
            color: #1e293b;
            padding: 20px;
            display: flex;
            flex-direction: column;
            align-items: center;
            min-height: 100vh;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
        }

        .voucher-card {
            background: #ffffff;
            width: 100%;
            max-width: 650px;
            border: 1px solid #cbd5e1;
            border-radius: 12px;
            padding: 30px;
            position: relative;
        }

        .brand-header {
            text-align: center;
            border-bottom: 2px dashed #cbd5e1;
            padding-bottom: 20px;
            margin-bottom: 25px;
            position: relative;
        }

        .brand-logo-circle {
            width: 48px;
            height: 48px;
            border-radius: 50%;
            background-color: #e0e7ff;
            color: #4f46e5;
            margin: 0 auto 12px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 22px;
            font-weight: bold;
        }

        .brand-title {
            font-size: 24px;
            font-weight: 800;
            color: #1e1b4b;
            margin: 0;
            letter-spacing: 0.5px;
        }

        .brand-subtitle {
            font-size: 13px;
            color: #475569;
            margin: 6px 0 0 0;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }

        .voucher-tag {
            display: inline-block;
            background-color: #f8fafc;
            color: #475569;
            font-size: 11px;
            font-weight: 700;
            padding: 4px 14px;
            border: 1px solid #cbd5e1;
            border-radius: 9999px;
            margin-top: 12px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }

        .info-grid {
            display: grid;
            grid-template-cols: 1fr 1fr;
            gap: 15px;
            margin-bottom: 25px;
        }

        .info-item {
            font-size: 13px;
        }

        .info-label {
            color: #64748b;
            font-weight: 600;
            font-size: 11px;
            display: block;
            margin-bottom: 4px;
            text-transform: uppercase;
            letter-spacing: 0.3px;
        }

        .info-value {
            font-weight: 700;
            color: #0f172a;
            font-size: 14px;
        }

        .amount-section {
            background-color: #f1f5f9;
            border: 1.5px solid #cbd5e1;
            border-radius: 12px;
            padding: 16px 20px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 25px;
            color: #0f172a;
        }

        .amount-label {
            font-size: 13px;
            font-weight: 700;
            color: #334155;
        }

        .amount-value {
            font-size: 24px;
            font-weight: 850;
            color: #047857;
            font-family: sans-serif;
        }

        .status-badge {
            display: inline-flex;
            align-items: center;
            padding: 3px 10px;
            border-radius: 8px;
            font-size: 12px;
            font-weight: 700;
        }
        
        .status-approved { background-color: #d1fae5; color: #065f46; border: 1px solid #a7f3d0; }
        .status-pending { background-color: #fef3c7; color: #92400e; border: 1px solid #fde68a; }
        .status-rejected { background-color: #fee2e2; color: #991b1b; border: 1px solid #fecaca; }
        
        .table-title {
            font-size: 13px;
            font-weight: 700;
            color: #334155;
            margin-top: 25px;
            margin-bottom: 12px;
            padding-bottom: 6px;
            border-bottom: 2px solid #cbd5e1;
            text-transform: uppercase;
            letter-spacing: 0.3px;
        }

        .route-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 12px;
            margin-bottom: 25px;
            border-radius: 8px;
            overflow: hidden;
            border: 1px solid #cbd5e1;
        }

        .route-table th {
            background-color: #f8fafc;
            color: #475569;
            padding: 8px 12px;
            font-weight: 700;
            border-bottom: 2px solid #cbd5e1;
            font-size: 11px;
            text-transform: uppercase;
        }

        .route-table td {
            padding: 10px 12px;
            border-bottom: 1px solid #cbd5e1;
            color: #334155;
            line-height: 1.4;
        }

        .route-table tr:last-child td {
            border-bottom: none;
        }

        .notes-box {
            font-size: 13px;
            background-color: #f8fafc;
            border-left: 4px solid #64748b;
            padding: 14px 18px;
            border-radius: 8px;
            margin-bottom: 25px;
            line-height: 1.5;
            border: 1px solid #cbd5e1;
            border-left: 4px solid #64748b;
        }

        .notes-title {
            font-weight: 700;
            color: #334155;
            margin-bottom: 6px;
            font-size: 11px;
            text-transform: uppercase;
            letter-spacing: 0.3px;
        }

        .signature-footer {
            margin-top: 50px;
            display: flex;
            justify-content: space-between;
            gap: 20px;
        }

        .signature-line {
            text-align: center;
            width: 160px;
            display: flex;
            flex-direction: column;
            align-items: center;
        }

        .signature-line-placeholder {
            height: 35px;
            width: 100%;
            border-bottom: 1.5px solid #cbd5e1;
            margin-bottom: 8px;
        }

        .signature-line span {
            font-size: 11px;
            font-weight: 600;
            color: #475569;
        }

        @media print {
            .no-print { display: none !important; }
            body {
                background-color: #ffffff !important;
                padding: 0 !important;
                margin: 0 !important;
                color: #000000 !important;
            }
            .voucher-card {
                border: none !important;
                padding: 0 !important;
                width: 100% !important;
                max-width: 100% !important;
            }
        }
    </style>
</head>
<body style="background-color: #e2e8f0; display: flex; flex-direction: column; align-items: center; padding: 20px;">
    
    <div class="no-print" style="display: flex; justify-content: space-between; align-items: center; background-color: #e0e7ff; border: 1px solid #c7d2fe; padding: 12px 20px; border-radius: 12px; margin-bottom: 20px; width: 100%; max-width: 650px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);">
        <span style="font-size: 14px; font-weight: 700; color: #3730a3; font-family: 'Hind Siliguri', sans-serif;">Voucher Print Ready Preview</span>
        <div style="display: flex; gap: 8px;">
            <button onclick="window.print()" style="background-color: #4f46e5; color: #ffffff; font-weight: 700; font-size: 12px; padding: 6px 14px; border: none; border-radius: 8px; cursor: pointer; font-family: 'Hind Siliguri', sans-serif;">🖨️ Print</button>
            <button onclick="window.close()" style="background-color: #ffffff; color: #475569; border: 1px solid #cbd5e1; font-weight: 700; font-size: 12px; padding: 6px 14px; border-radius: 8px; cursor: pointer; font-family: 'Hind Siliguri', sans-serif;">Close</button>
        </div>
    </div>

    <div class="voucher-card">
        <div class="brand-header">
            <div class="brand-logo-circle">🔥</div>
            <h1 class="brand-title">TITAS ISP SYSTEM</h1>
            <p class="brand-subtitle">Payment Voucher Slip</p>
            <div class="voucher-tag">Official Accounting Document</div>
        </div>
        
        <div class="info-grid">
            <div class="info-item">
                <span class="info-label">Voucher No</span>
                <span class="info-value font-sans" style="font-weight: 800; color: #4f46e5;">${v.title}</span>
            </div>
            <div class="info-item">
                <span class="info-label">Date</span>
                <span class="info-value font-sans">${v.date}</span>
            </div>
            <div class="info-item">
                <span class="info-label">Submitted By</span>
                <span class="info-value">${v.submittedBy}</span>
            </div>
            <div class="info-item">
                <span class="info-label">Expense Category</span>
                <span class="info-value text-indigo-950">${categoryLabel}</span>
            </div>
            <div class="info-item">
                <span class="info-label">Approval Status</span>
                <span class="info-value">
                    <span class="status-badge ${statusClass}">${statusText}</span>
                </span>
            </div>
            <div class="info-item">
                <span class="info-label">Print Timestamp</span>
                <span class="info-value font-sans" style="font-size: 12px; color: #64748b;">${new Date().toLocaleString('en-US')}</span>
            </div>
        </div>

        ${transportRoutesHtml}
        ${itemsTableHtml}

        ${v.notes ? `
        <div class="notes-box">
            <div class="notes-title">📝 Voucher Notes / Comments</div>
            <div style="font-weight: 500;">${v.notes}</div>
        </div>
        ` : ''}

        ${v.attachmentData ? `
        <div class="notes-box" style="border-left: 4px solid #10b981; background-color: #f0fdf4; border: 1px solid #dcfce7;">
            <div class="notes-title" style="color: #065f46;">📎 Attachment</div>
            <a href="${v.attachmentData}" download="${v.attachmentName || 'attachment'}" style="color: #059669; font-weight: 600; text-decoration: underline;">Download ${v.attachmentName || 'Attachment'}</a>
        </div>
        ` : ''}

        ${v.status === 'rejected' && v.rejectionReason ? `
        <div class="notes-box" style="border-left: 4px solid #ef4444; background-color: #fef2f2; border: 1px solid #fee2e2; border-left: 4px solid #ef4444;">
            <div class="notes-title" style="color: #b91c1c;">❌ Rejection Reason</div>
            <div style="color: #991b1b; font-weight: 600;">${v.rejectionReason}</div>
        </div>
        ` : ''}

        <div class="amount-section">
            <span class="amount-label">Net Payable Amount</span>
            <span class="amount-value">৳ ${v.amount.toLocaleString('en-US')} /=</span>
        </div>

        <div class="signature-footer">
            <div class="signature-line">
                <div class="signature-line-placeholder"></div>
                <span>Submitter's Signature</span>
            </div>
            <div class="signature-line">
                <div class="signature-line-placeholder"></div>
                <span>Verifier / Accountant</span>
            </div>
            <div class="signature-line">
                <div class="signature-line-placeholder"></div>
                <span>Approver's Signature</span>
            </div>
        </div>
    </div>

    <script>
        // Auto-triggers browser print dialog when the page is opened
        window.addEventListener('DOMContentLoaded', () => {
            setTimeout(() => {
                window.print();
            }, 300);
        });
    </script>
</body>
</html>`;

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Please disable your browser\'s popup blocker and try again.');
      return;
    }
    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  // Download file attachment
  const downloadAttachment = (name: string, data: string) => {
    const link = document.createElement('a');
    link.href = data;
    link.setAttribute('download', name || 'attachment');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // File Upload Event Handler
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 1.2 * 1024 * 1024) {
      alert('The voucher file size cannot exceed 1.2 MB. Please select a smaller file.');
      e.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setAttachmentName(file.name);
        setAttachmentData(reader.result);
      }
    };
    reader.onerror = () => {
      alert('An error occurred while processing the file.');
    };
    reader.readAsDataURL(file);
  };

  // Transport Log States
  const [transportLogs, setTransportLogs] = useState<{ fromLocation: string; toLocation: string; reason: string; amount: number }[]>([]);
  const [fromLoc, setFromLoc] = useState('');
  const [toLoc, setToLoc] = useState('');
  const [tReason, setTReason] = useState('');
  const [tAmount, setTAmount] = useState('');

  // General Items Table States (Auto-generated SN, Description, UoM, Quantity, Taka/Amount)
  const [voucherItems, setVoucherItems] = useState<{ sn: number; description: string; uom: string; quantity: number; amount: number }[]>([]);
  const [itemDesc, setItemDesc] = useState('');
  const [itemUom, setItemUom] = useState('Pcs');
  const [itemQty, setItemQty] = useState('');
  const [itemAmt, setItemAmt] = useState('');

  // Reset transport logs and items if category is changed
  useEffect(() => {
    setTransportLogs([]);
    setVoucherItems([]);
    setAmount('0');
  }, [category]);

  // Status Filter State
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');

  // Auto-generate voucher number once vouchers list is loaded and if the title is empty
  useEffect(() => {
    if (!loading && !title) {
      const today = new Date();
      const year = today.getFullYear();
      const month = String(today.getMonth() + 1).padStart(2, '0');
      const day = String(today.getDate()).padStart(2, '0');
      const count = vouchers.length;
      const serial = String(count + 1).padStart(3, '0');
      setTitle(`VOU-${year}${month}${day}-${serial}`);
    }
  }, [loading, vouchers.length, title]);

  // Load vouchers from firestore
  useEffect(() => {
    if (!userId) return;

    let vouchersQuery;
    if (currentUserProfile?.role === 'admin') {
      vouchersQuery = query(collection(db, 'vouchers'));
    } else {
      vouchersQuery = query(
        collection(db, 'vouchers'),
        where('userId', '==', userId)
      );
    }

    const unsubscribe = onSnapshot(
      vouchersQuery,
      (snapshot) => {
        const list: Voucher[] = [];
        snapshot.forEach((docSnapshot) => {
          const data = docSnapshot.data();
          list.push({
            id: docSnapshot.id,
            userId: data.userId,
            title: data.title,
            amount: Number(data.amount) || 0,
            category: data.category || 'other_expense',
            date: data.date || '',
            submittedBy: data.submittedBy || 'Unknown',
            status: data.status || 'pending',
            notes: data.notes || '',
            rejectionReason: data.rejectionReason || '',
            attachmentName: data.attachmentName || '',
            attachmentData: data.attachmentData || '',
            transportLogs: data.transportLogs || [],
            items: data.items || [],
            supervisorApprovedBy: data.supervisorApprovedBy || '',
            managerApprovedBy: data.managerApprovedBy || '',
            accountsApprovedBy: data.accountsApprovedBy || '',
            supervisorApprovedAt: data.supervisorApprovedAt || '',
            managerApprovedAt: data.managerApprovedAt || '',
            accountsApprovedAt: data.accountsApprovedAt || '',
            supervisorComment: data.supervisorComment || '',
            managerComment: data.managerComment || '',
            accountsComment: data.accountsComment || '',
            createdAt: data.createdAt?.toDate?.()?.toISOString() || '',
            updatedAt: data.updatedAt?.toDate?.()?.toISOString() || '',
          });
        });
        
        // Sort by date descending
        list.sort((a, b) => b.date.localeCompare(a.date));
        setVouchers(list);
        setLoading(false);
      },
      (err) => {
        handleFirestoreError(err, OperationType.GET, 'vouchers');
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [userId]);

  // Transport Event Handlers
  const handleAddTransportLog = (e: React.MouseEvent) => {
    e.preventDefault();
    if (!fromLoc.trim() || !toLoc.trim() || !tReason.trim()) {
      alert('Please complete the travel details (from, to, and purpose).');
      return;
    }
    const val = Number(tAmount);
    if (isNaN(val) || val <= 0) {
      alert('Please input a valid amount.');
      return;
    }

    const newLog = {
      fromLocation: fromLoc.trim(),
      toLocation: toLoc.trim(),
      reason: tReason.trim(),
      amount: val
    };

    const updated = [...transportLogs, newLog];
    setTransportLogs(updated);

    // Auto calculate voucher amount based on log entries
    const sum = updated.reduce((acc, item) => acc + item.amount, 0);
    setAmount(sum.toString());

    // Reset inputs
    setFromLoc('');
    setToLoc('');
    setTReason('');
    setTAmount('');
  };

  const handleRemoveTransportLog = (idx: number) => {
    const updated = transportLogs.filter((_, i) => i !== idx);
    setTransportLogs(updated);
    
    const sum = updated.reduce((acc, item) => acc + item.amount, 0);
    setAmount(sum > 0 ? sum.toString() : '0');
  };

  // Add Item to universal Table
  const handleAddItem = (e: React.MouseEvent) => {
    e.preventDefault();
    if (!itemDesc.trim()) {
      alert(category === 'office_rent' ? 'Please enter the rental month.' : 'Please enter the item description.');
      return;
    }
    const qty = Number(itemQty);
    const amt = Number(itemAmt);
    if (isNaN(qty) || qty <= 0) {
      alert('Please enter a valid quantity in numbers.');
      return;
    }
    if (isNaN(amt) || amt <= 0) {
      alert('Please enter a valid amount in numbers.');
      return;
    }

    const newItem = {
      sn: voucherItems.length + 1,
      description: itemDesc.trim(),
      uom: category === 'office_rent' ? 'Month' : (itemUom.trim() || 'Pcs'),
      quantity: qty,
      amount: amt
    };

    const updated = [...voucherItems, newItem];
    setVoucherItems(updated);

    // Auto-calculate voucher amount based on item entries
    const sum = updated.reduce((acc, item) => acc + item.amount, 0);
    setAmount(sum.toString());

    // Reset inputs
    setItemDesc('');
    setItemUom('Pcs');
    setItemQty('');
    setItemAmt('');
  };

  const handleRemoveItem = (idx: number) => {
    const filtered = voucherItems.filter((_, i) => i !== idx);
    // Auto re-generate serial numbers (sn)
    const updated = filtered.map((item, i) => ({
      ...item,
      sn: i + 1
    }));
    setVoucherItems(updated);

    const sum = updated.reduce((acc, item) => acc + item.amount, 0);
    setAmount(sum > 0 ? sum.toString() : '0');
  };

  // Handle submit voucher
  const handleSubmitVoucher = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!title.trim()) {
      setError('Voucher number is missing.');
      return;
    }
    const parsedAmount = Number(amount);
    if (category === 'transport' && transportLogs.length === 0) {
      setError('At least one route detail must be added for the transport category.');
      return;
    }
    if (category !== 'transport' && voucherItems.length > 0) {
      // Validate amount corresponds to items
      const calculatedSum = voucherItems.reduce((acc, i) => acc + i.amount, 0);
      if (calculatedSum !== parsedAmount) {
        setError('The total voucher amount does not match the sum of the item table. Please correct it.');
        return;
      }
    }
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setError('Please enter a correct expense amount for the voucher.');
      return;
    }
    if (!submittedBy.trim()) {
      setError('Please enter the name of the submitter.');
      return;
    }

    const voucherId = `vou-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const docRef = doc(db, 'vouchers', voucherId);

    try {
      await setDoc(docRef, {
        id: voucherId,
        userId,
        title: title.trim(),
        amount: parsedAmount,
        category,
        date,
        submittedBy: submittedBy.trim(),
        status: 'pending',
        notes: notes.trim(),
        rejectionReason: '',
        attachmentName: attachmentName || '',
        attachmentData: attachmentData || '',
        transportLogs: category === 'transport' ? transportLogs : [],
        items: category === 'transport' ? [] : voucherItems,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      setTitle('');
      setAmount('');
      setNotes('');
      setSubmittedBy('');
      setAttachmentName('');
      setAttachmentData('');
      setTransportLogs([]);
      setVoucherItems([]);
      setIsCreateModalOpen(false);
      alert('The new daily expense voucher has been submitted successfully and is pending approval review!');
      setSuccess('The new voucher has been submitted successfully and is pending!');
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `vouchers/${voucherId}`);
      setError('Failed to save the voucher.');
    }
  };

  // Handle Approve / Reject / Pending Status Updates
  const handleUpdateStatus = async (
    voucher: Voucher, 
    newStatus: 'pending' | 'waiting_manager' | 'waiting_accounts' | 'approved' | 'rejected', 
    overrideReason?: string,
    auditNote?: string,
    approverName?: string
  ) => {
    if (currentUserProfile && newStatus !== 'pending') {
      if (!hasApprovalPermission(voucher)) {
        alert('Access Denied: You do not have permission to approve or reject this voucher at its current stage.');
        return;
      }
    }

    const docRef = doc(db, 'vouchers', voucher.id);
    let finalNotes = voucher.notes || '';

    // Save details
    const supBy = newStatus === 'waiting_manager' ? (approverName || 'Supervisor') : (voucher.supervisorApprovedBy || '');
    const supAt = newStatus === 'waiting_manager' ? new Date().toISOString() : (voucher.supervisorApprovedAt || '');
    const supComm = newStatus === 'waiting_manager' ? (auditNote || '') : (voucher.supervisorComment || '');

    const mgrBy = newStatus === 'waiting_accounts' ? (approverName || 'Manager') : (voucher.managerApprovedBy || '');
    const mgrAt = newStatus === 'waiting_accounts' ? new Date().toISOString() : (voucher.managerApprovedAt || '');
    const mgrComm = newStatus === 'waiting_accounts' ? (auditNote || '') : (voucher.managerComment || '');

    const accBy = newStatus === 'approved' ? (approverName || 'Accountant') : (voucher.accountsApprovedBy || '');
    const accAt = newStatus === 'approved' ? new Date().toISOString() : (voucher.accountsApprovedAt || '');
    const accComm = newStatus === 'approved' ? (auditNote || '') : (voucher.accountsComment || '');

    if (newStatus === 'approved') {
      const stamp = ` (Approved Audit Note: ${auditNote || 'All information is correct'}${approverName ? ` | Approver: ${approverName}` : ''})`;
      if (!finalNotes.includes('Approved Audit Note')) {
        finalNotes = finalNotes + stamp;
      }
    }

    try {
      await setDoc(docRef, {
        id: voucher.id,
        userId: voucher.userId,
        title: voucher.title,
        amount: voucher.amount,
        category: voucher.category,
        date: voucher.date,
        submittedBy: voucher.submittedBy,
        status: newStatus,
        notes: finalNotes,
        rejectionReason: overrideReason !== undefined ? overrideReason : (voucher.rejectionReason || ''),
        attachmentName: voucher.attachmentName || '',
        attachmentData: voucher.attachmentData || '',
        transportLogs: voucher.transportLogs || [],
        items: voucher.items || [],
        supervisorApprovedBy: supBy,
        supervisorApprovedAt: supAt,
        supervisorComment: supComm,
        managerApprovedBy: mgrBy,
        managerApprovedAt: mgrAt,
        managerComment: mgrComm,
        accountsApprovedBy: accBy,
        accountsApprovedAt: accAt,
        accountsComment: accComm,
        createdAt: voucher.createdAt ? new Date(voucher.createdAt) : serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      // If transition to approved occurs, automatically post as an expense to App transactions
      if (newStatus === 'approved') {
        await onAddTransaction({
          type: 'expense',
          title: `Voucher Approved: ${voucher.title} (${voucher.submittedBy})`,
          amount: voucher.amount,
          category: voucher.category as any,
          date: voucher.date,
          notes: `Advance voucher approval. Comments: ${finalNotes}`,
          receivedBy: voucher.submittedBy,
          receivedDate: voucher.date,
          paymentMethod: 'Cash'
        });
        alert('The voucher has been fully approved by Supervisor, Manager & Accounts and automatically added as an expense to the main cash-out transactions!');
      } else if (newStatus === 'rejected') {
        alert('The voucher has been cancelled successfully!');
      } else if (newStatus === 'waiting_manager') {
        alert('The voucher has been approved by Supervisor and is now pending Manager approval!');
      } else if (newStatus === 'waiting_accounts') {
        alert('The voucher has been approved by Manager and is now pending Accounts approval!');
      } else {
        alert('The voucher has been reset/moved back to review.');
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `vouchers/${voucher.id}`);
    }
  };

  // Handle Delete Voucher
  const handleDeleteVoucher = async (voucherId: string) => {
    const isAdmin = currentUserProfile?.role === 'admin';
    if (currentUserProfile && !currentUserProfile.permissions?.canDeleteVouchers && !isAdmin) {
      alert('Access Denied: You do not have permission to delete vouchers.');
      return;
    }
    const voucher = vouchers.find(v => v.id === voucherId);
    if (voucher) {
      setDeletingVoucher(voucher);
    }
  };

  // Actually delete the voucher
  const confirmDeleteVoucher = async () => {
    const isAdmin = currentUserProfile?.role === 'admin';
    if (currentUserProfile && !currentUserProfile.permissions?.canDeleteVouchers && !isAdmin) {
      alert('Access Denied: You do not have permission to delete vouchers.');
      return;
    }
    if (!deletingVoucher) return;
    const voucherId = deletingVoucher.id;
    const docRef = doc(db, 'vouchers', voucherId);
    try {
      await deleteDoc(docRef);
      setDeletingVoucher(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `vouchers/${voucherId}`);
    }
  };

  // Handle Delete All Vouchers and Reset Penal/Penalty Amounts
  const handleDeleteAllVouchers = async () => {
    if (currentUserProfile && currentUserProfile.role !== 'admin') {
      alert('Access Denied: Only System Administrators can delete all vouchers and reset panel amounts.');
      return;
    }
    if (vouchers.length === 0) {
      alert('No voucher entries found.');
      return;
    }
    if (!window.confirm('Are you sure you want to delete all voucher entries and zero out all penal/penalty amounts? This action cannot be undone!')) return;
    if (!window.confirm('Confirm one last time: You are about to delete all voucher data and reset the penal amounts to zero. Are you sure?')) return;
    
    setLoading(true);
    let successCount = 0;
    let resellerResetCount = 0;
    try {
      // 1. Delete all vouchers
      for (const voucher of vouchers) {
        const docRef = doc(db, 'vouchers', voucher.id);
        await deleteDoc(docRef);
        successCount++;
      }

      // 2. Query and reset penal amounts for all resellers belonging to this user
      const resellersRef = collection(db, 'resellers');
      const resellersQuery = query(resellersRef, where('userId', '==', userId));
      const resellersSnapshot = await getDocs(resellersQuery);
      
      for (const docSnap of resellersSnapshot.docs) {
        const docRef = doc(db, 'resellers', docSnap.id);
        await updateDoc(docRef, {
          totalDue: 0,
          unpaidMonths: 0,
          updatedAt: serverTimestamp()
        });
        resellerResetCount++;
      }

      alert(`Successfully deleted all (${successCount}) voucher entries and zeroed out penal/penalty amounts for (${resellerResetCount}) resellers.`);
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, 'vouchers/all_and_penal');
    } finally {
      setLoading(false);
    }
  };

  // Filter list
  const filteredVouchers = vouchers.filter(v => {
    if (statusFilter === 'all') return true;
    if (statusFilter === 'pending') {
      return v.status === 'pending' || v.status === 'waiting_manager' || v.status === 'waiting_accounts';
    }
    return v.status === statusFilter;
  });

  // Calculations
  const statsTotalCount = vouchers.length;
  const statsTotalAmount = vouchers.reduce((acc, v) => acc + v.amount, 0);

  const statsPendingCount = vouchers.filter(v => v.status === 'pending' || v.status === 'waiting_manager' || v.status === 'waiting_accounts').length;
  const statsPendingAmount = vouchers.filter(v => v.status === 'pending' || v.status === 'waiting_manager' || v.status === 'waiting_accounts').reduce((acc, v) => acc + v.amount, 0);

  const statsApprovedCount = vouchers.filter(v => v.status === 'approved').length;
  const statsApprovedAmount = vouchers.filter(v => v.status === 'approved').reduce((acc, v) => acc + v.amount, 0);

  const statsRejectedCount = vouchers.filter(v => v.status === 'rejected').length;
  const statsRejectedAmount = vouchers.filter(v => v.status === 'rejected').reduce((acc, v) => acc + v.amount, 0);

  // Helper for formatting date and time in English
  const formatEnglishDateTime = (isoString?: string) => {
    if (!isoString) return 'Unknown Time';
    try {
      const d = new Date(isoString);
      if (isNaN(d.getTime())) return 'Unknown Time';
      const datePart = d.toLocaleDateString('en-US', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      });
      const timePart = d.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
      });
      return `${datePart} - ${timePart}`;
    } catch {
      return 'Unknown Time';
    }
  };

  return (
    <div className="space-y-6">
      {/* Informative Header Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 select-none">
        
        {/* Total Vouchers Card */}
        <div className="bg-gradient-to-br from-white to-slate-50/50 p-5 rounded-2xl border-l-4 border-indigo-600 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-xs sm:text-[13px] font-black text-indigo-600 uppercase tracking-tight block">All Vouchers</span>
            </div>
            <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl">
              <FileCheck2 className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-5 space-y-2">
            <div className="text-2xl font-black text-slate-800 tracking-tight font-sans">
              ৳ {statsTotalAmount.toLocaleString('en-US')}
            </div>
            <div className="flex items-center gap-1.5">
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black bg-indigo-50 text-indigo-700">
                {statsTotalCount} Vouchers
              </span>
              <span className="text-[10px] text-slate-400 font-bold">Total Submitted</span>
            </div>
          </div>
        </div>

        {/* Pending Vouchers Card */}
        <div className="bg-gradient-to-br from-white to-slate-50/50 p-5 rounded-2xl border-l-4 border-amber-500 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-xs sm:text-[13px] font-black text-amber-600 uppercase tracking-tight block">Pending</span>
            </div>
            <div className="p-2.5 bg-amber-50 text-amber-500 rounded-xl relative">
              <Clock className="w-5 h-5 animate-pulse" />
              <span className="absolute top-0 right-0 w-2 h-2 bg-amber-500 rounded-full animate-ping"></span>
            </div>
          </div>
          <div className="mt-5 space-y-2">
            <div className="text-2xl font-black text-amber-600 tracking-tight font-sans">
              ৳ {statsPendingAmount.toLocaleString('en-US')}
            </div>
            <div className="flex items-center gap-1.5">
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-50 text-amber-700">
                {statsPendingCount} Pending
              </span>
              <span className="text-[10px] text-slate-400 font-bold">Awaiting Review</span>
            </div>
          </div>
        </div>

        {/* Approved Vouchers Card */}
        <div className="bg-gradient-to-br from-white to-slate-50/50 p-5 rounded-2xl border-l-4 border-emerald-500 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-xs sm:text-[13px] font-black text-emerald-600 uppercase tracking-tight block">Approved</span>
            </div>
            <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl">
              <Coins className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-5 space-y-2">
            <div className="text-2xl font-black text-emerald-700 tracking-tight font-sans">
              ৳ {statsApprovedAmount.toLocaleString('en-US')}
            </div>
            <div className="flex items-center gap-1.5">
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-50 text-emerald-700">
                {statsApprovedCount} Approved
              </span>
              <span className="text-[10px] text-slate-400 font-bold">Cash-Out Expensed</span>
            </div>
          </div>
        </div>

        {/* Rejected Vouchers Card */}
        <div className="bg-gradient-to-br from-white to-slate-50/50 p-5 rounded-2xl border-l-4 border-rose-500 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-xs sm:text-[13px] font-black text-rose-600 uppercase tracking-tight block">Rejected</span>
            </div>
            <div className="p-2.5 bg-rose-50 text-rose-500 rounded-xl">
              <XSquare className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-5 space-y-2">
            <div className="text-2xl font-black text-rose-600 tracking-tight font-sans">
              ৳ {statsRejectedAmount.toLocaleString('en-US')}
            </div>
            <div className="flex items-center gap-1.5">
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-50 text-rose-700">
                {statsRejectedCount} Rejected
              </span>
              <span className="text-[10px] text-slate-400 font-bold">Rejected with Reason</span>
            </div>
          </div>
        </div>

      </div>

      <div className="flex flex-col gap-6">
        {/* Submissions form Option Launcher */}
        <div className="flex flex-col sm:items-start">
          <button
            onClick={() => {
              setIsCreateModalOpen(true);
              setSuccess('');
              setError('');
            }}
            className="w-full sm:w-auto px-6 py-4 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-750 text-white font-extrabold text-xs sm:text-xs rounded-xl shadow-md transition-all duration-200 cursor-pointer flex items-center justify-center gap-1.5 transform active:scale-95"
          >
            <PlusCircle className="w-4 h-4" />
            <span>➕ New Voucher Entry</span>
          </button>
        </div>

        {/* Submissions Form in modern Dialog Popup Modal (Triggered dynamically) */}
        {isCreateModalOpen && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 select-none animate-fade-in">
            <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-xl w-full p-6 sm:p-7 space-y-4 flex flex-col max-h-[92vh] overflow-y-auto transform scale-100 transition-all duration-250">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                    <FileText className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-800">New Daily Expense Voucher Entry</h3>
                    <p className="text-[10px] text-slate-400 font-bold font-sans">Fill out the form with expense slip or receipt details</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="text-slate-400 hover:text-slate-600 text-base font-extrabold p-1"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleSubmitVoucher} className="space-y-4">
            {error && (
              <div className="p-3 bg-rose-50 border border-rose-100 rounded-xl flex items-start gap-2 text-rose-600 text-xs font-semibold">
                <AlertCircle className="w-4.5 h-4.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}
            {success && (
              <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-xl flex items-start gap-2 text-emerald-600 text-xs font-bold">
                <CheckCircle className="w-4.5 h-4.5 shrink-0" />
                <span>{success}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">Voucher Number *</label>
              <input
                type="text"
                placeholder="Auto-generated voucher number"
                value={title}
                readOnly
                className="w-full px-3.5 py-2.5 border border-slate-200 bg-slate-50 text-slate-600 font-bold rounded-xl focus:outline-none text-xs cursor-not-allowed select-all"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Amount (৳) *</label>
                <input
                  type="number"
                  placeholder="e.g., 1500"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  disabled={category === 'transport'}
                  className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl bg-slate-50/50 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-800 text-xs font-bold disabled:opacity-75 disabled:bg-slate-100"
                />
                {category === 'transport' && (
                  <span className="text-[9px] text-indigo-600 font-bold mt-1 block">Automatically calculated from the route details below</span>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Select Category *</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-800 text-xs cursor-pointer"
                >
                  {Object.entries(EXPENSE_CATEGORY_LABELS).map(([key, item]) => (
                    <option key={key} value={key}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Transport detailed custom log entry sub-section */}
            {category === 'transport' && (
              <div className="p-4 bg-indigo-50/60 border border-indigo-100 rounded-2xl space-y-3">
                <div className="flex items-center gap-1.5 text-indigo-900 font-bold text-xs">
                  <span>🚗 Transport Details Entry Box</span>
                </div>
                
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 mb-0.5">From Location *</label>
                    <input 
                      type="text" 
                      placeholder="Source (e.g., Dhamrai)" 
                      value={fromLoc}
                      onChange={(e) => setFromLoc(e.target.value)}
                      className="w-full px-2.5 py-2.5 border border-slate-200 bg-white rounded-xl focus:outline-none focus:ring-1 focus:ring-indigo-400 text-slate-800 text-xs" 
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 mb-0.5">To Location *</label>
                    <input 
                      type="text" 
                      placeholder="Destination (e.g., Savar)" 
                      value={toLoc}
                      onChange={(e) => setToLoc(e.target.value)}
                      className="w-full px-2.5 py-2.5 border border-slate-200 bg-white rounded-xl focus:outline-none focus:ring-1 focus:ring-indigo-400 text-slate-800 text-xs" 
                    />
                  </div>
                </div>

                <div className="grid grid-cols-12 gap-2">
                  <div className="col-span-8">
                    <label className="block text-[10px] font-bold text-slate-500 mb-0.5">Purpose / Reason of Travel *</label>
                    <input 
                      type="text" 
                      placeholder="e.g., For optical fiber splicing" 
                      value={tReason}
                      onChange={(e) => setTReason(e.target.value)}
                      className="w-full px-2.5 py-2.5 border border-slate-200 bg-white rounded-xl focus:outline-none focus:ring-1 focus:ring-indigo-400 text-slate-800 text-xs" 
                    />
                  </div>
                  <div className="col-span-4">
                    <label className="block text-[10px] font-bold text-slate-500 mb-0.5">Fare (৳) *</label>
                    <input 
                      type="number" 
                      placeholder="e.g., 200" 
                      value={tAmount}
                      onChange={(e) => setTAmount(e.target.value)}
                      className="w-full px-2.5 py-2.5 border border-slate-200 bg-white rounded-xl focus:outline-none focus:ring-1 focus:ring-indigo-400 text-slate-800 text-xs font-bold" 
                    />
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleAddTransportLog}
                  className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-bold text-xs rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5 shadow-sm"
                >
                  <PlusCircle className="w-3.5 h-3.5" />
                  <span>Add Route Entry</span>
                </button>

                {/* Table of transport elements */}
                {transportLogs.length > 0 && (
                  <div className="mt-3 overflow-x-auto border border-indigo-100 rounded-xl bg-white shadow-inner">
                    <table className="w-full text-[11px] text-left text-slate-700">
                      <thead className="bg-[#F8FAFC] text-[9px] font-black uppercase text-indigo-900 border-b border-indigo-100 select-none">
                        <tr>
                          <th className="p-2">Route (From - To)</th>
                          <th className="p-2">Purpose</th>
                          <th className="p-2 text-right">Fare</th>
                          <th className="p-2 text-center">Delete</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {transportLogs.map((log, idx) => (
                          <tr key={idx} className="hover:bg-slate-50/50">
                            <td className="p-2 font-bold text-slate-800">
                              {log.fromLocation} → {log.toLocation}
                            </td>
                            <td className="p-2 text-slate-500 font-medium">{log.reason}</td>
                            <td className="p-2 text-right font-black text-slate-800 font-mono">
                              ৳ {log.amount}
                            </td>
                            <td className="p-2 text-center">
                              <button
                                type="button"
                                onClick={() => handleRemoveTransportLog(idx)}
                                className="text-rose-500 hover:text-rose-700 p-0.5"
                                title="Delete"
                              >
                                <Trash2 className="w-3.5 h-3.5 mx-auto cursor-pointer" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <div className="bg-indigo-50/30 p-2 text-right border-t border-indigo-100 text-[10px] font-black text-indigo-950">
                      Total Transport Expense: <span className="font-mono text-xs">৳ {transportLogs.reduce((sum, l) => sum + l.amount, 0)}</span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* General Items Table Section (Shown when category is selected and is not transport) */}
            {category !== 'transport' && (
              <div className="p-4 bg-indigo-50/40 border border-slate-200/60 rounded-2xl space-y-3">
                <div className="flex items-center gap-1.5 text-slate-800 font-bold text-xs select-none">
                  <span>{category === 'office_rent' ? '🏢 Office Rent Statement List' : '📋 Voucher Item List (Optional)'}</span>
                </div>
                
                <div className="grid grid-cols-12 gap-2 text-[10px] font-bold text-slate-500 select-none">
                  <div className="col-span-5">{category === 'office_rent' ? 'Rent Month *' : 'Item Description *'}</div>
                  {category !== 'office_rent' && <div className="col-span-2">UoM *</div>}
                  <div className={category === 'office_rent' ? 'col-span-3' : 'col-span-2'}>Qty *</div>
                  <div className={category === 'office_rent' ? 'col-span-4' : 'col-span-3'}>Amount *</div>
                </div>

                <div className="grid grid-cols-12 gap-2">
                  <div className="col-span-5">
                    <input 
                      type="text" 
                      placeholder={category === 'office_rent' ? 'e.g., January 2026' : 'e.g., Notebook and Pen'} 
                      value={itemDesc}
                      onChange={(e) => setItemDesc(e.target.value)}
                      className="w-full px-2.5 py-1.5 border border-slate-200 bg-white rounded-xl focus:outline-none focus:ring-1 focus:ring-indigo-400 text-slate-800 text-xs" 
                    />
                  </div>
                  {category !== 'office_rent' && (
                    <div className="col-span-2">
                      <select
                        value={itemUom}
                        onChange={(e) => setItemUom(e.target.value)}
                        className="w-full px-1.5 py-1.5 border border-slate-200 bg-white rounded-xl focus:outline-none focus:ring-1 focus:ring-indigo-400 text-slate-800 text-xs cursor-pointer"
                      >
                        <option value="Pcs">Pcs</option>
                        <option value="Kg">Kg</option>
                        <option value="Ltr">Ltr</option>
                        <option value="Bag">Bag</option>
                        <option value="Yard">Yard</option>
                        <option value="Ft">Ft</option>
                        <option value="Packet">Packet</option>
                        <option value="Box">Box</option>
                        <option value="Set">Set</option>
                        <option value="Others">Others</option>
                      </select>
                    </div>
                  )}
                  <div className={category === 'office_rent' ? 'col-span-3' : 'col-span-2'}>
                    <input 
                      type="number" 
                      placeholder={category === 'office_rent' ? 'e.g., 1' : 'qty'} 
                      value={itemQty}
                      onChange={(e) => setItemQty(e.target.value)}
                      className="w-full px-1 py-1.5 border border-slate-200 bg-white rounded-xl focus:outline-none focus:ring-1 focus:ring-indigo-400 text-slate-800 text-xs font-mono font-bold text-center" 
                    />
                  </div>
                  <div className={category === 'office_rent' ? 'col-span-4 flex gap-1' : 'col-span-3 flex gap-1'}>
                    <input 
                      type="number" 
                      placeholder="Amount" 
                      value={itemAmt}
                      onChange={(e) => setItemAmt(e.target.value)}
                      className="w-full px-1.5 py-1.5 border border-slate-200 bg-white rounded-xl focus:outline-none focus:ring-1 focus:ring-indigo-400 text-slate-800 text-xs font-mono font-bold" 
                    />
                    <button
                      type="button"
                      onClick={handleAddItem}
                      className="px-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black transition cursor-pointer shrink-0"
                      title="Add Item"
                    >
                      +
                    </button>
                  </div>
                </div>

                {/* Table of items */}
                {voucherItems.length > 0 && (
                  <div className="mt-2 overflow-hidden border border-slate-200 rounded-xl bg-white select-none">
                    <table className="w-full text-[11px] text-slate-700">
                      <thead className="bg-[#FAFAFA] text-[9px] font-black uppercase text-slate-400 border-b border-slate-100">
                        <tr>
                          <th className="p-2 w-10 text-center">SL</th>
                          <th className="p-2 text-left">{category === 'office_rent' ? 'Rent Month' : 'Description'}</th>
                          {category !== 'office_rent' && <th className="p-2 text-center">UoM</th>}
                          <th className="p-2 text-center">Qty</th>
                          <th className="p-2 text-right">Amount</th>
                          <th className="p-2 text-center w-10">Delete</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {voucherItems.map((item, idx) => (
                          <tr key={idx} className="hover:bg-slate-50/50">
                            <td className="p-2 text-center font-bold text-slate-400">{item.sn}</td>
                            <td className="p-2 font-bold text-slate-800">{item.description}</td>
                            {category !== 'office_rent' && <td className="p-2 text-center text-slate-500 font-medium">{item.uom}</td>}
                            <td className="p-2 text-center font-bold font-mono">
                              {item.quantity} {item.uom === 'Month' ? 'Month' : item.uom}
                            </td>
                            <td className="p-2 text-right font-black text-slate-800 font-mono">
                              ৳ {item.amount.toLocaleString('en-US')}
                            </td>
                            <td className="p-2 text-center">
                              <button
                                type="button"
                                onClick={() => handleRemoveItem(idx)}
                                className="text-rose-500 hover:text-rose-700 p-0.5"
                                title="Delete"
                              >
                                <Trash2 className="w-3.5 h-3.5 mx-auto cursor-pointer" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <div className="bg-slate-50 p-2 text-right border-t border-slate-100 text-[10px] font-black text-slate-600">
                      Total {category === 'office_rent' ? 'Rent' : 'Item Value'}: <span className="font-sans font-mono text-xs text-slate-900">৳ {voucherItems.reduce((sum, l) => sum + l.amount, 0).toLocaleString('en-US')}</span>
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Voucher Date *</label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full px-3.5 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-800 text-xs font-semibold cursor-pointer"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Submitter / Employee Name *</label>
                <input
                  type="text"
                  placeholder="e.g., Md. Javed Iqbal"
                  value={submittedBy}
                  onChange={(e) => setSubmittedBy(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-800 text-xs"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">Additional Comments (Optional)</label>
              <textarea
                rows={2}
                placeholder="Payment slip related notes..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-800 text-xs"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">Upload Voucher File (Receipt / Proof)</label>
              <div className="border border-dashed border-slate-200 rounded-xl p-3.5 text-center bg-slate-50/30 hover:bg-slate-50 transition-all">
                {!attachmentData ? (
                  <label className="cursor-pointer block">
                    <div className="flex flex-col items-center justify-center gap-1.5 py-1">
                      <span className="text-xl">📎</span>
                      <span className="text-xs font-bold text-indigo-600 font-sans">Select File (Max 1.2 MB)</span>
                      <span className="text-[10px] text-slate-400 font-medium">Receipt or voucher image / PDF copy</span>
                    </div>
                    <input 
                      type="file" 
                      accept="image/*,application/pdf" 
                      onChange={handleFileChange} 
                      className="hidden" 
                    />
                  </label>
                ) : (
                  <div className="flex items-center justify-between gap-2 bg-white p-2 border border-slate-200 rounded-lg">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-base shrink-0">📄</span>
                      <span className="text-xs font-bold text-slate-700 truncate">{attachmentName}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setAttachmentName('');
                        setAttachmentData('');
                      }}
                      className="text-rose-500 hover:text-rose-700 text-[10px] font-bold shrink-0 px-2.5 py-1.5 bg-rose-50 rounded-lg hover:bg-rose-100 transition"
                    >
                      Delete
                    </button>
                  </div>
                )}
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white rounded-xl font-bold text-xs transition shadow-sm cursor-pointer flex items-center justify-center gap-2"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Submit Voucher for Review</span>
            </button>
          </form>
        </div>
      </div>
    )}

    {/* Slips Display (Full width layout block) */}
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-slate-50 text-slate-600 rounded-lg">
                <ListFilter className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-800">Vouchers and Approval Tracker</h3>
                <p className="text-[10px] text-slate-400 font-semibold">All expense slips and current status</p>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {vouchers.length > 0 && (
                <button
                  type="button"
                  onClick={handleDeleteAllVouchers}
                  className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-xl text-xs font-black transition flex items-center gap-1.5 cursor-pointer"
                  title="Delete all vouchers"
                >
                  <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                  <span>Delete All Entries (Reset to 0)</span>
                </button>
              )}
              {/* Tabs for filtering */}
              <div className="flex bg-slate-100 p-1 rounded-xl gap-0.5 self-start sm:self-auto shrink-0 select-none">
                <button
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

          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center space-y-2">
              <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
              <p className="text-xs text-slate-400 font-semibold">Loading voucher data...</p>
            </div>
          ) : filteredVouchers.length === 0 ? (
            <div className="py-12 px-4 border border-dashed border-slate-200 rounded-2xl text-center space-y-2">
              <p className="text-xs text-slate-400 font-bold">No vouchers found.</p>
              <p className="text-[10px] text-slate-400">Use the form on the left to enter a new voucher.</p>
            </div>
          ) : (
            <div className="overflow-x-auto max-h-[580px] overflow-y-auto pr-1">
              <table className="w-full min-w-[1000px] text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 text-xs text-slate-400 font-bold uppercase select-none">
                    <th className="py-3 px-2 w-8"></th>
                    <th className="py-3 px-3">Voucher ID</th>
                    <th className="py-3 px-3">Voucher Creator</th>
                    <th className="py-3 px-3">Approver Name</th>
                    <th className="py-3 px-3">Payment Method</th>
                    <th className="py-3 px-3">Category</th>
                    <th className="py-3 px-3">Type</th>
                    <th className="py-3 px-3 text-right">Amount</th>
                    <th className="py-3 px-3 text-center">Status</th>
                    <th className="py-3 px-3 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {filteredVouchers.map((voucher) => {
                    const categoryInfo = EXPENSE_CATEGORY_LABELS[voucher.category as keyof typeof EXPENSE_CATEGORY_LABELS] || { label: 'Other Expense', color: 'bg-slate-500' };
                    const isExpanded = !!expandedVouchers[voucher.id];
                    const approver = getApproverName(voucher);

                    return (
                      <React.Fragment key={voucher.id}>
                        <tr className="hover:bg-slate-50/50 transition-colors">
                          {/* Expand Toggle */}
                          <td className="py-3.5 px-2 text-center">
                            <button
                              type="button"
                              onClick={() => toggleVoucherExpand(voucher.id)}
                              className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded transition cursor-pointer"
                              title={isExpanded ? "Collapse Details" : "Expand Details"}
                            >
                              <span className="block transform transition-transform duration-200 text-[9px]" style={{ transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)' }}>
                                ▶
                              </span>
                            </button>
                          </td>

                          {/* Voucher ID */}
                          <td className="py-3.5 px-3 font-mono font-bold text-slate-800 whitespace-nowrap">
                            {voucher.title}
                          </td>

                          {/* Voucher Creator */}
                          <td className="py-3.5 px-3 font-semibold text-slate-700 whitespace-nowrap">
                            {voucher.submittedBy}
                          </td>

                          {/* Approver */}
                          <td className="py-3.5 px-3 font-semibold text-slate-600 whitespace-nowrap">
                            {approver}
                          </td>

                          {/* Payment Method */}
                          <td className="py-3.5 px-3 whitespace-nowrap">
                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200/50">
                              💵 Cash
                            </span>
                          </td>

                          {/* Category */}
                          <td className="py-3.5 px-3 whitespace-nowrap">
                            <span className={`text-[10px] px-2 py-0.5 rounded font-bold text-white ${categoryInfo.color}`}>
                              {categoryInfo.label}
                            </span>
                          </td>

                          {/* Type */}
                          <td className="py-3.5 px-3 whitespace-nowrap font-bold text-rose-600">
                            Expense
                          </td>

                          {/* Amount */}
                          <td className="py-3.5 px-3 text-right font-black text-slate-800 font-mono whitespace-nowrap">
                            ৳ {voucher.amount.toLocaleString('en-US')}
                          </td>

                          {/* Status */}
                          <td className="py-3.5 px-3 text-center whitespace-nowrap">
                            {voucher.status === 'pending' && (
                              <span className="inline-flex items-center gap-1 text-[10px] bg-amber-50 text-amber-700 border border-amber-200/50 px-2 py-0.5 rounded-full font-bold">
                                <Clock className="w-3 h-3 text-amber-500 shrink-0" />
                                <span>Wait Supervisor</span>
                              </span>
                            )}
                            {voucher.status === 'waiting_manager' && (
                              <span className="inline-flex items-center gap-1 text-[10px] bg-blue-50 text-blue-700 border border-blue-200/50 px-2 py-0.5 rounded-full font-bold">
                                <Clock className="w-3 h-3 text-blue-500 shrink-0" />
                                <span>Wait Manager</span>
                              </span>
                            )}
                            {voucher.status === 'waiting_accounts' && (
                              <span className="inline-flex items-center gap-1 text-[10px] bg-purple-50 text-purple-700 border border-purple-200/50 px-2 py-0.5 rounded-full font-bold">
                                <Clock className="w-3 h-3 text-purple-500 shrink-0" />
                                <span>Wait Accounts</span>
                              </span>
                            )}
                            {voucher.status === 'approved' && (
                              <span className="inline-flex items-center gap-1 text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200/50 px-2 py-0.5 rounded-full font-bold">
                                <CheckCircle className="w-3 h-3 text-emerald-500 shrink-0" />
                                <span>Approved</span>
                              </span>
                            )}
                            {voucher.status === 'rejected' && (
                              <span className="inline-flex items-center gap-1 text-[10px] bg-rose-50 text-rose-700 border border-rose-200/50 px-2 py-0.5 rounded-full font-bold">
                                <XSquare className="w-3 h-3 text-rose-500 shrink-0" />
                                <span>Cancelled</span>
                              </span>
                            )}
                          </td>

                          {/* Actions button panel */}
                          <td className="py-3.5 px-3 text-center whitespace-nowrap">
                            <div className="flex items-center justify-center gap-1.5 select-none">
                              {(voucher.status === 'pending' || voucher.status === 'waiting_manager' || voucher.status === 'waiting_accounts') && (
                                <>
                                  <button
                                    onClick={() => {
                                      setApprovingVoucher(voucher);
                                      setApprovalStep(1);
                                      setCheckedStep1(false);
                                      setCheckedStep2(false);
                                      setCheckedStep3(false);
                                      setApprovalAuditNote('');
                                      if (voucher.status === 'pending') {
                                        setApprovalApproverName(voucher.supervisorApprovedBy || '');
                                      } else if (voucher.status === 'waiting_manager') {
                                        setApprovalApproverName(voucher.managerApprovedBy || '');
                                      } else {
                                        setApprovalApproverName(voucher.accountsApprovedBy || '');
                                      }
                                    }}
                                    className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[10px] font-bold transition shadow-sm cursor-pointer"
                                    title="Start step-by-step approval"
                                  >
                                    {voucher.status === 'pending' && 'Supervisor Approve'}
                                    {voucher.status === 'waiting_manager' && 'Manager Approve'}
                                    {voucher.status === 'waiting_accounts' && 'Accounts Approve'}
                                  </button>
                                  <button
                                    onClick={() => {
                                      setRejectingVoucher(voucher);
                                      setRejectionInput('');
                                      setRejectionError('');
                                    }}
                                    className="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-[10px] font-bold transition shadow-sm cursor-pointer"
                                    title="Cancel"
                                  >
                                    Cancel
                                  </button>
                                </>
                              )}
                              {(voucher.status === 'approved' || voucher.status === 'rejected') && (
                                <button
                                  onClick={() => handleUpdateStatus(voucher, 'pending')}
                                  className="px-2 py-1 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg text-[9px] font-bold transition cursor-pointer"
                                >
                                  Review Again
                                </button>
                              )}

                              {/* Edit Button - Only visible for uncompleted status vouchers */}
                              {(voucher.status === 'pending' || voucher.status === 'waiting_manager' || voucher.status === 'waiting_accounts') && (
                                <button
                                  onClick={() => handleStartEdit(voucher)}
                                  className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition cursor-pointer"
                                  title="Edit Voucher"
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                </button>
                              )}

                              {/* Download Slip Button */}
                              <button
                                onClick={() => downloadVoucherSlip(voucher)}
                                className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition cursor-pointer"
                                title="Download Voucher Slip"
                              >
                                <Download className="w-3.5 h-3.5" />
                              </button>

                              <button
                                onClick={() => handleDeleteVoucher(voucher.id)}
                                className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                                title="Delete Voucher"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>

                              {/* 🕒 TIME & APPROVAL TRACKING BUTTON */}
                              <button
                                onClick={() => setTrackingVoucher(voucher)}
                                className="px-2.5 py-1 bg-slate-900 hover:bg-indigo-650 text-white rounded-lg text-[10px] font-extrabold transition flex items-center gap-1.5 cursor-pointer hover:shadow shrink-0 ml-1"
                                title="Track Voucher Live & View Time"
                              >
                                <Activity className="w-3.5 h-3.5 text-indigo-400 animate-pulse" />
                                <span>🕒 Track</span>
                              </button>
                            </div>
                          </td>
                        </tr>

                        {/* Expandable nested table detail box */}
                        {isExpanded && (
                          <tr className="bg-slate-50/40 select-text">
                            <td colSpan={10} className="p-4 border-t border-slate-100">
                              <div className="space-y-3.5 text-left pl-8 max-w-4xl">
                                
                                {/* Submitted & Date meta details */}
                                <div className="flex flex-wrap items-center gap-x-6 gap-y-1.5 text-slate-500 font-bold text-[10px] border-b border-slate-100 pb-2">
                                  <span>📅 Submitter: <strong className="text-slate-700">{voucher.submittedBy}</strong></span>
                                  <span>📅 Creation Date: <strong className="text-slate-700">{voucher.date}</strong></span>
                                </div>

                                {/* Voucher Notes/Description */}
                                {voucher.notes && (
                                  <div className="space-y-1">
                                    <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-tight">Audit Note & Comments:</span>
                                    <p className="text-[11px] text-slate-600 bg-white p-3 rounded-xl border border-slate-200/60 leading-snug font-medium italic">
                                      {voucher.notes}
                                    </p>
                                  </div>
                                )}

                                {/* Rejected reason comments */}
                                {voucher.status === 'rejected' && voucher.rejectionReason && (
                                  <div className="p-3 bg-rose-50 border border-rose-100/70 rounded-xl flex items-start gap-2 text-[11px] text-rose-700 leading-snug">
                                    <AlertCircle className="w-4 h-4 shrink-0 text-rose-500 mt-0.5" />
                                    <div>
                                      <strong className="text-rose-800">Rejection Reason: </strong>
                                      {voucher.rejectionReason}
                                    </div>
                                  </div>
                                )}

                                {/* Attachment info */}
                                {voucher.attachmentData && (
                                  <div className="flex flex-wrap items-center gap-2 text-[10px] font-bold text-slate-400">
                                    <span>Attachment Receipt:</span>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setViewingAttachment({
                                          name: voucher.attachmentName || 'Receipt',
                                          data: voucher.attachmentData || ''
                                        });
                                      }}
                                      className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 border border-indigo-100 px-2.5 py-1 rounded-lg transition cursor-pointer"
                                    >
                                      <span>📎 View Receipt</span>
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() => downloadAttachment(voucher.attachmentName || 'attachment', voucher.attachmentData)}
                                      className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-100 px-2.5 py-1 rounded-lg transition cursor-pointer"
                                      title="Download attached file"
                                    >
                                      <Download className="w-3 h-3 text-emerald-500" />
                                      <span>Download</span>
                                    </button>
                                  </div>
                                )}

                                {/* Transport details table */}
                                {voucher.category === 'transport' && voucher.transportLogs && voucher.transportLogs.length > 0 && (
                                  <div className="overflow-hidden border border-slate-200/60 rounded-xl bg-white text-[11px]">
                                    <div className="bg-indigo-50/40 px-3 py-2 text-[9px] font-bold text-indigo-950 border-b border-indigo-100 flex items-center justify-between">
                                      <span>🚗 Detailed Transport Routes & Cost</span>
                                      <span className="font-mono bg-indigo-100/50 text-indigo-900 px-1.5 py-px rounded font-bold">Routes: {voucher.transportLogs.length}</span>
                                    </div>
                                    <table className="w-full text-slate-700 leading-tight border-collapse">
                                      <thead className="bg-[#FAFAFA] text-[9px] text-slate-400 font-extrabold uppercase border-b border-slate-100">
                                        <tr>
                                          <th className="px-3 py-2 text-left font-bold">Route</th>
                                          <th className="px-3 py-2 text-left font-bold">Purpose</th>
                                          <th className="px-3 py-2 text-right font-bold">Fare</th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-slate-100">
                                        {voucher.transportLogs.map((log, lIdx) => (
                                          <tr key={lIdx} className="hover:bg-slate-50/50">
                                            <td className="px-3 py-2 text-slate-800 font-bold">
                                              {log.fromLocation} ➔ {log.toLocation}
                                            </td>
                                            <td className="px-3 py-2 text-slate-500 font-medium">{log.reason}</td>
                                            <td className="px-3 py-2 text-right text-slate-900 font-bold font-mono">
                                              ${log.amount}
                                            </td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                )}

                                {/* General item list table */}
                                {voucher.category !== 'transport' && voucher.items && voucher.items.length > 0 && (
                                  <div className="overflow-hidden border border-slate-200/60 rounded-xl bg-white text-[11px]">
                                    <div className="bg-emerald-50/45 px-3 py-2 text-[9px] font-bold text-emerald-950 border-b border-emerald-100 flex items-center justify-between">
                                      <span>{voucher.category === 'office_rent' ? '🏢 Office Rent Statement' : '📋 Detailed Item & Price List'}</span>
                                      <span className="font-mono bg-emerald-100/50 text-emerald-900 px-1.5 py-px rounded font-bold">Items: {voucher.items.length}</span>
                                    </div>
                                    <table className="w-full text-slate-700 leading-tight border-collapse">
                                      <thead className="bg-[#FAFAFA] text-[9px] text-slate-400 font-extrabold uppercase border-b border-slate-100">
                                        <tr>
                                          <th className="px-3 py-1.5 text-center font-bold">SL</th>
                                          <th className="px-3 py-2 text-left font-bold">{voucher.category === 'office_rent' ? 'Rent Month' : 'Description'}</th>
                                          {voucher.category !== 'office_rent' && <th className="px-3 py-2 text-center font-bold">UoM</th>}
                                          <th className="px-3 py-2 text-center font-bold">Qty</th>
                                          <th className="px-3 py-2 text-right font-bold">Amount</th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-slate-100">
                                        {voucher.items.map((item, iIdx) => (
                                          <tr key={iIdx} className="hover:bg-slate-50/50">
                                            <td className="px-3 py-1.5 text-center font-bold text-slate-400 font-mono">{item.sn}</td>
                                            <td className="px-3 py-1.5 text-slate-800 font-bold">{item.description}</td>
                                            {voucher.category !== 'office_rent' && <td className="px-3 py-1.5 text-center text-slate-500">{item.uom}</td>}
                                            <td className="px-3 py-1.5 text-center font-mono font-bold">
                                              {item.quantity} {item.uom === 'Month' ? 'Month' : item.uom}
                                            </td>
                                            <td className="px-3 py-2 text-right font-bold text-slate-900 font-mono">
                                              ${item.amount.toLocaleString('en-US')}
                                            </td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                )}
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
      </div>

      {/* 2. FULL SCREEN VOUCHER APPROVAL TRACK & TIME VISUALIZER */}
      {trackingVoucher && (
        <div className="fixed inset-0 bg-slate-950 text-slate-100 z-50 overflow-y-auto flex flex-col font-sans select-none animate-fade-in text-left">
          {/* Header Bar */}
          <div className="sticky top-0 bg-slate-900 border-b border-slate-800 px-6 py-4 flex items-center justify-between z-10">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-slate-800 rounded-xl text-indigo-400">
                <Activity className="w-5 h-5 animate-spin" style={{ animationDuration: '4s' }} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base sm:text-lg font-black text-white tracking-tight">Voucher Tracking Portal</h2>
                  <span className="bg-indigo-900/50 text-indigo-300 border border-indigo-800 text-[10px] sm:text-xs font-bold px-2 py-0.5 rounded-full font-mono">
                    ID: {trackingVoucher.title}
                  </span>
                </div>
                <p className="text-[10px] sm:text-xs text-slate-400 font-semibold uppercase tracking-wider">Real-time Approval Tracking & Total Time Analysis</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => downloadVoucherSlip(trackingVoucher)}
                className="px-3 py-2 bg-indigo-600 hover:bg-indigo-750 active:bg-indigo-850 text-white text-xs font-bold rounded-xl border border-indigo-500/20 transition flex items-center gap-1.5 cursor-pointer"
              >
                <Download className="w-4 h-4 text-white" />
                <span className="hidden sm:inline">Download Slip</span>
              </button>
              <button
                onClick={() => setTrackingVoucher(null)}
                className="p-2.5 bg-rose-950/40 hover:bg-rose-900/60 active:bg-rose-800/80 text-rose-300 border border-rose-800/50 rounded-xl transition cursor-pointer font-bold duration-150"
                title="Close"
              >
                <XSquare className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Main Space - Two Columns on desktop */}
          <div className="flex-1 max-w-7xl w-full mx-auto p-6 sm:p-8 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            
            {/* Left Box: Voucher specifications and full slip view */}
            <div className="lg:col-span-7 bg-slate-900/80 rounded-3xl border border-slate-800 p-6 sm:p-8 space-y-6">
              
              <div className="flex justify-between items-start border-b border-slate-800 pb-5">
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 tracking-widest block mb-1">Submitter</span>
                  <div className="text-lg font-bold text-white flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-slate-800 text-indigo-400 flex items-center justify-center font-bold font-sans text-xs shrink-0 select-none">
                      {trackingVoucher.submittedBy ? trackingVoucher.submittedBy.substring(0, 2) : 'UR'}
                    </div>
                    <span>{trackingVoucher.submittedBy}</span>
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-[10px] uppercase font-bold text-slate-400 tracking-widest block mb-1">Expense Category</span>
                  <span className="px-3 py-1 rounded bg-indigo-950 border border-indigo-800 text-indigo-300 text-xs font-black">
                    {EXPENSE_CATEGORY_LABELS[trackingVoucher.category as keyof typeof EXPENSE_CATEGORY_LABELS]?.label || 'Other Expense'}
                  </span>
                </div>
              </div>

              {/* Standard Attributes details */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-5">
                <div>
                  <span className="text-[10px] text-slate-400 font-bold block uppercase font-sans">Date</span>
                  <span className="text-sm font-semibold text-white font-sans">{trackingVoucher.date}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-bold block uppercase font-sans">Total Amount</span>
                  <span className="text-base font-black text-emerald-400 font-sans">৳ {trackingVoucher.amount.toLocaleString('en-US')}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-bold block uppercase font-sans">Current Status</span>
                  <span className="mt-1 inline-block">
                    {trackingVoucher.status === 'approved' && (
                      <span className="text-[10px] bg-emerald-950 text-emerald-400 border border-emerald-800 px-2.5 py-0.5 rounded-full font-bold font-sans">Approved</span>
                    )}
                    {trackingVoucher.status === 'pending' && (
                      <span className="text-[10px] bg-amber-950 text-amber-400 border border-amber-800 px-2.5 py-0.5 rounded-full font-bold font-sans animate-pulse">Pending</span>
                    )}
                    {trackingVoucher.status === 'rejected' && (
                      <span className="text-[10px] bg-rose-950 text-rose-400 border border-rose-800 px-2.5 py-0.5 rounded-full font-bold font-sans">Cancelled</span>
                    )}
                  </span>
                </div>
              </div>

              {/* Items & details table within tracking */}
              {trackingVoucher.category === 'transport' && trackingVoucher.transportLogs && trackingVoucher.transportLogs.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5 border-b border-slate-800 pb-2">
                    <span>🚗 Transport Routes</span>
                  </h4>
                  <div className="overflow-hidden border border-slate-800 rounded-2xl bg-slate-950">
                    <table className="w-full text-xs text-left text-slate-300">
                      <thead className="bg-slate-900 border-b border-slate-800 text-[10px] font-bold text-slate-400 select-none">
                        <tr>
                          <th className="p-3">Route (From - To)</th>
                          <th className="p-3">Purpose</th>
                          <th className="p-3 text-right">Fare (৳)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-900">
                        {trackingVoucher.transportLogs.map((log, lIdx) => (
                          <tr key={lIdx} className="hover:bg-slate-900/50">
                            <td className="p-3 font-semibold text-white">
                              {log.fromLocation} → {log.toLocation}
                            </td>
                            <td className="p-3 text-slate-400 font-medium">{log.reason}</td>
                            <td className="p-3 text-right font-bold text-emerald-400 font-mono">
                              ৳ {log.amount}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* General Voucher Items Table */}
              {trackingVoucher.category !== 'transport' && trackingVoucher.items && trackingVoucher.items.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5 border-b border-slate-800 pb-2">
                    <span>{trackingVoucher.category === 'office_rent' ? '🏢 Office Rent Statement' : '📋 Voucher Details & Items'}</span>
                  </h4>
                  <div className="overflow-hidden border border-slate-800 rounded-2xl bg-slate-950">
                    <table className="w-full text-xs text-left text-slate-300">
                      <thead className="bg-slate-900 border-b border-slate-800 text-[10px] font-bold text-slate-400 select-none">
                        <tr>
                          <th className="p-3 text-center">SL</th>
                          <th className="p-3">{trackingVoucher.category === 'office_rent' ? 'Rent Month' : 'Item Description'}</th>
                          {trackingVoucher.category !== 'office_rent' && <th className="p-3 text-center">Unit</th>}
                          <th className="p-3 text-center">Quantity</th>
                          <th className="p-3 text-right">Price (৳)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-900">
                        {trackingVoucher.items.map((item, iIdx) => (
                          <tr key={iIdx} className="hover:bg-slate-900/50">
                            <td className="p-3 text-center text-slate-500 font-bold font-sans">{item.sn}</td>
                            <td className="p-3 font-semibold text-white">{item.description}</td>
                            {trackingVoucher.category !== 'office_rent' && <td className="p-3 text-center text-slate-400">{item.uom}</td>}
                            <td className="p-3 text-center font-bold text-white font-sans">
                              {item.quantity} {item.uom === 'Month' ? 'Month' : item.uom}
                            </td>
                            <td className="p-3 text-right font-bold text-emerald-400 font-sans">
                              ৳ {item.amount.toLocaleString('en-US')}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Extra comments or cancellation message */}
              {trackingVoucher.notes && (
                <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800">
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-1">Voucher Description / Comments</span>
                  <p className="text-xs text-slate-200 leading-relaxed font-semibold italic">"{trackingVoucher.notes}"</p>
                </div>
              )}

              {trackingVoucher.status === 'rejected' && trackingVoucher.rejectionReason && (
                <div className="p-4 bg-rose-950/30 rounded-2xl border border-rose-900/50">
                  <span className="text-[10px] text-rose-400 font-extrabold uppercase tracking-wider block mb-1">❌ Official Rejection Reason</span>
                  <p className="text-xs text-rose-200 font-extrabold">{trackingVoucher.rejectionReason}</p>
                </div>
              )}

              {/* Receipt attachment viewer inside tracking sheet */}
              {trackingVoucher.attachmentData ? (
                <div className="space-y-2">
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Supporting Receipt / Proof Invoice (Uploaded Voucher Copy):</span>
                  <div className="bg-slate-950 p-3 rounded-2xl border border-slate-800 flex justify-center max-h-[350px] overflow-hidden">
                    {trackingVoucher.attachmentData.startsWith('data:application/pdf') ? (
                      <iframe
                        src={trackingVoucher.attachmentData}
                        title="Voucher Detail PDF"
                        className="w-full h-[280px] rounded-lg border border-slate-800"
                      />
                    ) : (
                      <img
                        src={trackingVoucher.attachmentData}
                        alt="Uploaded Receipt"
                        referrerPolicy="no-referrer"
                        className="max-h-[280px] object-contain rounded-lg shadow-sm border border-slate-800"
                      />
                    )}
                  </div>
                </div>
              ) : (
                <div className="p-4 bg-slate-950 text-slate-500 rounded-2xl border border-slate-800 border-dashed text-center text-xs">
                  No receipt or image has been uploaded with this voucher.
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
                        Submitted by <span className="text-slate-200 font-extrabold">{trackingVoucher.submittedBy}</span>.
                      </p>
                      <div className="mt-1 text-[9px] text-slate-500 font-bold bg-slate-950 px-2 py-0.5 rounded border border-slate-800/85 inline-block font-sans">
                        {formatEnglishDateTime(trackingVoucher.createdAt)}
                      </div>
                    </div>
                  </div>

                  {/* Step 2: Supervisor Approval */}
                  <div className="flex gap-4 relative">
                    {(trackingVoucher.status === 'waiting_manager' || trackingVoucher.status === 'waiting_accounts' || trackingVoucher.status === 'approved') ? (
                      <div className="w-8 h-8 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-500/50 flex items-center justify-center font-bold font-sans z-10 shrink-0">
                        ✓
                      </div>
                    ) : trackingVoucher.status === 'rejected' && !trackingVoucher.supervisorApprovedAt ? (
                      <div className="w-8 h-8 rounded-full bg-rose-950 text-rose-400 border border-rose-500/50 flex items-center justify-center font-bold font-sans z-10 shrink-0">
                        ✕
                      </div>
                    ) : trackingVoucher.status === 'pending' ? (
                      <div className="w-8 h-8 rounded-full bg-indigo-950 text-indigo-400 border border-indigo-500/50 flex items-center justify-center font-bold font-sans z-10 shrink-0 relative">
                        <span className="absolute inset-0 rounded-full bg-indigo-400/25 animate-ping"></span>
                        <span className="relative text-[10px]">⌛</span>
                      </div>
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-slate-800 text-slate-505 border border-slate-700/80 flex items-center justify-center font-bold z-10 shrink-0">
                        ⌛
                      </div>
                    )}
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-xs sm:text-sm font-black text-white">Step 2: Supervisor Approval</h4>
                        {(trackingVoucher.status === 'waiting_manager' || trackingVoucher.status === 'waiting_accounts' || trackingVoucher.status === 'approved') ? (
                          <span className="bg-emerald-950 text-emerald-400 text-[9px] font-bold px-1.5 py-0.5 rounded">Approved</span>
                        ) : trackingVoucher.status === 'rejected' && !trackingVoucher.supervisorApprovedAt ? (
                          <span className="bg-rose-950 text-rose-400 text-[9px] font-bold px-1.5 py-0.5 rounded">Cancelled</span>
                        ) : trackingVoucher.status === 'pending' ? (
                          <span className="bg-indigo-950 text-indigo-400 text-[9px] font-bold px-1.5 py-0.5 rounded animate-pulse">Awaiting</span>
                        ) : (
                          <span className="bg-slate-800 text-slate-400 text-[9px] font-bold px-1.5 py-0.5 rounded">Pending</span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-400 font-semibold mt-1">
                        Initial vetting, quantity checking, and supporting receipt validation.
                      </p>
                      {trackingVoucher.supervisorApprovedAt && (
                        <div className="mt-1 text-[9px] text-slate-300 font-bold bg-slate-950 px-2 py-0.5 rounded border border-slate-800/85 block font-sans">
                          Approved by {trackingVoucher.supervisorApprovedBy || 'Supervisor'} at {formatEnglishDateTime(trackingVoucher.supervisorApprovedAt)}
                          {trackingVoucher.supervisorComment && <div className="text-slate-400 text-[9px] italic mt-0.5 font-sans font-medium">Comment: {trackingVoucher.supervisorComment}</div>}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Step 3: Manager Approval */}
                  <div className="flex gap-4 relative">
                    {(trackingVoucher.status === 'waiting_accounts' || trackingVoucher.status === 'approved') ? (
                      <div className="w-8 h-8 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-500/50 flex items-center justify-center font-bold font-sans z-10 shrink-0">
                        ✓
                      </div>
                    ) : trackingVoucher.status === 'rejected' && trackingVoucher.supervisorApprovedAt && !trackingVoucher.managerApprovedAt ? (
                      <div className="w-8 h-8 rounded-full bg-rose-950 text-rose-400 border border-rose-500/50 flex items-center justify-center font-bold font-sans z-10 shrink-0">
                        ✕
                      </div>
                    ) : trackingVoucher.status === 'waiting_manager' ? (
                      <div className="w-8 h-8 rounded-full bg-indigo-950 text-indigo-400 border border-indigo-500/50 flex items-center justify-center font-bold font-sans z-10 shrink-0 relative">
                        <span className="absolute inset-0 rounded-full bg-indigo-400/25 animate-ping"></span>
                        <span className="relative text-[10px]">⌛</span>
                      </div>
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-slate-800 text-slate-505 border border-slate-700/80 flex items-center justify-center font-bold z-10 shrink-0">
                        ⌛
                      </div>
                    )}
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-xs sm:text-sm font-black text-white">Step 3: Manager Approval</h4>
                        {(trackingVoucher.status === 'waiting_accounts' || trackingVoucher.status === 'approved') ? (
                          <span className="bg-emerald-950 text-emerald-400 text-[9px] font-bold px-1.5 py-0.5 rounded">Approved</span>
                        ) : trackingVoucher.status === 'rejected' && trackingVoucher.supervisorApprovedAt && !trackingVoucher.managerApprovedAt ? (
                          <span className="bg-rose-950 text-rose-400 text-[9px] font-bold px-1.5 py-0.5 rounded">Cancelled</span>
                        ) : trackingVoucher.status === 'waiting_manager' ? (
                          <span className="bg-indigo-950 text-indigo-400 text-[9px] font-bold px-1.5 py-0.5 rounded animate-pulse">Awaiting</span>
                        ) : (
                          <span className="bg-slate-800 text-slate-400 text-[9px] font-bold px-1.5 py-0.5 rounded">Pending</span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-400 font-semibold mt-1">
                        Executive decision, review of comments, and budget approval.
                      </p>
                      {trackingVoucher.managerApprovedAt && (
                        <div className="mt-1 text-[9px] text-slate-300 font-bold bg-slate-950 px-2 py-0.5 rounded border border-slate-800/85 block font-sans">
                          Approved by {trackingVoucher.managerApprovedBy || 'Manager'} at {formatEnglishDateTime(trackingVoucher.managerApprovedAt)}
                          {trackingVoucher.managerComment && <div className="text-slate-400 text-[9px] italic mt-0.5 font-sans font-medium">Comment: {trackingVoucher.managerComment}</div>}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Step 4: Accounts Approval & Posting */}
                  <div className="flex gap-4 relative">
                    {trackingVoucher.status === 'approved' ? (
                      <div className="w-8 h-8 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-500/50 flex items-center justify-center font-bold font-sans z-10 shrink-0 shadow-[0_0_15px_rgba(16,185,129,0.3)]">
                        ✓
                      </div>
                    ) : trackingVoucher.status === 'rejected' && trackingVoucher.managerApprovedAt ? (
                      <div className="w-8 h-8 rounded-full bg-rose-950 text-rose-400 border border-rose-500/50 flex items-center justify-center font-bold font-sans z-10 shrink-0">
                        ✕
                      </div>
                    ) : trackingVoucher.status === 'waiting_accounts' ? (
                      <div className="w-8 h-8 rounded-full bg-indigo-950 text-indigo-400 border border-indigo-500/50 flex items-center justify-center font-bold font-sans z-10 shrink-0 relative">
                        <span className="absolute inset-0 rounded-full bg-indigo-400/25 animate-ping"></span>
                        <span className="relative text-[10px]">⌛</span>
                      </div>
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-slate-800 text-slate-505 border border-slate-700/80 flex items-center justify-center font-bold z-10 shrink-0">
                        ⌛
                      </div>
                    )}
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-xs sm:text-sm font-black text-white">Step 4: Accounts posting</h4>
                        {trackingVoucher.status === 'approved' ? (
                          <span className="bg-emerald-950 text-emerald-400 text-[9px] font-bold px-1.5 py-0.5 rounded font-sans">Approved</span>
                        ) : trackingVoucher.status === 'rejected' && trackingVoucher.managerApprovedAt ? (
                          <span className="bg-rose-950 text-rose-400 text-[9px] font-bold px-1.5 py-0.5 rounded font-sans">Cancelled</span>
                        ) : trackingVoucher.status === 'waiting_accounts' ? (
                          <span className="bg-indigo-950 text-indigo-400 text-[9px] font-bold px-1.5 py-0.5 rounded animate-pulse">Awaiting</span>
                        ) : (
                          <span className="bg-slate-800 text-slate-400 text-[9px] font-bold px-1.5 py-0.5 rounded font-sans">Pending</span>
                        )}
                      </div>
                      
                      <div className="text-[11px] text-slate-400 font-semibold mt-1 leading-relaxed">
                        {trackingVoucher.status === 'approved' && (
                          <p>
                            Vetted and posted to cash book. Total expense of <span className="text-emerald-400 font-bold">৳ {trackingVoucher.amount.toLocaleString('en-US')}</span> was committed to ledger.
                          </p>
                        )}
                        {trackingVoucher.status === 'rejected' && trackingVoucher.managerApprovedAt && (
                          <p className="text-rose-300 font-bold">
                            Rejected at accounts stage. Reason: {trackingVoucher.rejectionReason || 'N/A'}
                          </p>
                        )}
                        {(trackingVoucher.status === 'pending' || trackingVoucher.status === 'waiting_manager' || trackingVoucher.status === 'waiting_accounts') && (
                          <p>
                            Awaiting accountant ledger commitment.
                          </p>
                        )}
                      </div>

                      {trackingVoucher.accountsApprovedAt && (
                        <div className="mt-1 text-[9px] text-slate-300 font-bold bg-slate-950 px-2 py-0.5 rounded border border-slate-800/85 block font-sans">
                          Vetted by {trackingVoucher.accountsApprovedBy || 'Accountant'} at {formatEnglishDateTime(trackingVoucher.accountsApprovedAt)}
                          {trackingVoucher.accountsComment && <div className="text-slate-400 text-[9px] italic mt-0.5 font-sans font-medium">Comment: {trackingVoucher.accountsComment}</div>}
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
                    <span className="text-[9px] text-slate-500 font-bold block uppercase font-sans">Voucher Age</span>
                    <span className="text-white font-bold block mt-0.5 font-sans">
                      {(() => {
                        const sTime = trackingVoucher.createdAt ? new Date(trackingVoucher.createdAt).getTime() : Date.now();
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
                      {trackingVoucher.status === 'approved' ? 'Approved & Posted' : 
                       trackingVoucher.status === 'rejected' ? 'Cancelled' : 
                       trackingVoucher.status === 'waiting_manager' ? 'Wait Manager' :
                       trackingVoucher.status === 'waiting_accounts' ? 'Wait Accounts' :
                       'Wait Supervisor'}
                    </span>
                  </div>
                </div>
              </div>

            </div>

          </div>
        </div>
      )}

      {/* Rejection / Cancellation Modal Dialog */}
      {rejectingVoucher && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 select-none">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center gap-2 bg-rose-50 p-2.5 rounded-xl text-rose-700">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <span className="font-extrabold text-sm font-sans">Confirm Voucher Rejection</span>
            </div>
            
            <p className="text-xs text-slate-500 leading-relaxed font-semibold">
              You are about to reject voucher <strong className="text-slate-800">{rejectingVoucher.title}</strong>. Please enter the reason for rejection (required for saving):
            </p>

            {rejectionError && (
              <div className="text-[11px] font-bold text-rose-600 bg-rose-50 border border-rose-100 p-2 rounded-lg">
                ❌ {rejectionError}
              </div>
            )}

            <textarea
              rows={3}
              placeholder="e.g., No supporting invoice was found or the receipt is not clear..."
              value={rejectionInput}
              onChange={(e) => setRejectionInput(e.target.value)}
              className="w-full px-3 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-rose-500 text-slate-800 text-xs"
            />

            <div className="flex justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => {
                  setRejectingVoucher(null);
                  setRejectionInput('');
                  setRejectionError('');
                }}
                className="px-4 py-2 bg-slate-150 hover:bg-slate-200 text-slate-600 font-bold text-xs rounded-xl transition cursor-pointer"
              >
                Close
              </button>
              <button
                type="button"
                onClick={async () => {
                  if (currentUserProfile && !hasApprovalPermission(rejectingVoucher)) {
                    setRejectionError('Access Denied: You do not possess the required permissions to reject this voucher.');
                    return;
                  }
                  if (!rejectionInput.trim()) {
                    setRejectionError('Rejection reason must be specified!');
                    return;
                  }
                  await handleUpdateStatus(rejectingVoucher, 'rejected', rejectionInput.trim());
                  setRejectingVoucher(null);
                  setRejectionInput('');
                  setRejectionError('');
                }}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl transition cursor-pointer flex items-center gap-1"
              >
                <XSquare className="w-3.5 h-3.5" />
                <span>Reject and Save</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Voucher Deletion Confirmation Modal Dialog */}
      {deletingVoucher && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 select-none">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-md w-full p-6 space-y-4 text-left">
            <div className="flex items-center gap-2 bg-rose-50 p-2.5 rounded-xl text-rose-700">
              <Trash2 className="w-5 h-5 shrink-0" />
              <span className="font-extrabold text-sm font-sans">Delete Voucher Confirmation</span>
            </div>
            
            <p className="text-xs text-slate-500 leading-relaxed font-semibold">
              Are you sure you want to permanently delete voucher <strong className="text-slate-800">{deletingVoucher.title}</strong> of amount <strong className="text-slate-800">৳ {deletingVoucher.amount.toLocaleString('en-US')}</strong>? This action cannot be undone and will remove all related tracking details.
            </p>

            <div className="flex justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setDeletingVoucher(null)}
                className="px-4 py-2 bg-slate-150 hover:bg-slate-200 text-slate-600 font-bold text-xs rounded-xl transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDeleteVoucher}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl transition cursor-pointer flex items-center gap-1"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Yes, Delete</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 📋 MULTI-STEP VOUCHER APPROVAL MODAL */}
      {approvingVoucher && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 select-none animate-fade-in text-left">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-xl w-full p-6 sm:p-7 space-y-6 flex flex-col max-h-[92vh] overflow-y-auto">
            
            {/* Header with Title and Close button */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                  <FileCheck2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-800">
                    {approvingVoucher.status === 'pending' && 'Supervisor Approval Process (Stage 1 of 3)'}
                    {approvingVoucher.status === 'waiting_manager' && 'Manager Approval Process (Stage 2 of 3)'}
                    {approvingVoucher.status === 'waiting_accounts' && 'Accounts Approval Process (Stage 3 of 3)'}
                  </h3>
                  <p className="text-[10px] text-slate-400 font-bold font-sans">
                    {approvingVoucher.status === 'pending' && 'Complete verification and sign-off as Supervisor'}
                    {approvingVoucher.status === 'waiting_manager' && 'Review details and grant Managerial approval'}
                    {approvingVoucher.status === 'waiting_accounts' && 'Final Accountants audit and automatic Cash Book posting'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setApprovingVoucher(null)}
                className="text-slate-400 hover:text-slate-600 text-base font-extrabold p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Role based access warning banner */}
            {!hasApprovalPermission(approvingVoucher) && (
              <div className="bg-rose-50 border border-rose-150 text-rose-800 p-4 rounded-2xl flex items-start gap-2.5 font-semibold text-xs leading-normal">
                <ShieldAlert className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
                <div>
                  <span className="block font-black text-rose-950 uppercase tracking-wide">Permission Restrained</span>
                  <span className="block text-[11px] text-rose-700/90 mt-1">
                    Your current account profile (<strong className="font-mono text-slate-900">{currentUserProfile?.email}</strong>) has the assigned role of <strong className="capitalize text-slate-900">{currentUserProfile?.role || 'operator'}</strong>. You do not hold the required authorization flags to sign off on vouchers at this stage ({approvingVoucher.status.replace('_', ' ')}).
                  </span>
                </div>
              </div>
            )}

            {/* Visual Step Progress Indicator */}
            <div className="grid grid-cols-3 gap-2 border-b border-slate-100 pb-5 text-center">
              {/* Step 1 Indicator */}
              <div className="flex flex-col items-center gap-1.5">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300 ${
                  approvalStep >= 1 ? 'bg-emerald-600 text-white shadow-md' : 'bg-slate-100 text-slate-400'
                }`}>
                  1
                </div>
                <span className={`text-[10px] font-bold ${approvalStep >= 1 ? 'text-emerald-600' : 'text-slate-400'}`}>Receipt & Info</span>
              </div>

              {/* Step 2 Indicator */}
              <div className="flex flex-col items-center gap-1.5">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300 ${
                  approvalStep >= 2 ? 'bg-emerald-600 text-white shadow-md' : 'bg-slate-100 text-slate-400'
                }`}>
                  2
                </div>
                <span className={`text-[10px] font-bold ${approvalStep >= 2 ? 'text-emerald-600' : 'text-slate-400'}`}>Detailed Audit</span>
              </div>

              {/* Step 3 Indicator */}
              <div className="flex flex-col items-center gap-1.5">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300 ${
                  approvalStep >= 3 ? 'bg-emerald-600 text-white shadow-md' : 'bg-slate-100 text-slate-400'
                }`}>
                  3
                </div>
                <span className={`text-[10px] font-bold ${approvalStep >= 3 ? 'text-emerald-600' : 'text-slate-400'}`}>Sign & Forward</span>
              </div>
            </div>

            {/* Step 1: Information Verification View */}
            {approvalStep === 1 && (
              <div className="space-y-4 animate-fade-in text-left">
                <div className="p-4 bg-slate-50 border border-slate-200/60 rounded-2xl space-y-3">
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <span className="text-[10px] text-slate-400 font-extrabold uppercase block">Voucher Details</span>
                      <span className="font-extrabold text-slate-800">{approvingVoucher.title}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 font-extrabold uppercase block">Total Amount</span>
                      <span className="text-sm font-black text-emerald-600">৳ {approvingVoucher.amount.toLocaleString('en-US')}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 font-extrabold uppercase block">Expense Category</span>
                      <span className="font-semibold text-slate-700">
                        {EXPENSE_CATEGORY_LABELS[approvingVoucher.category as keyof typeof EXPENSE_CATEGORY_LABELS]?.label || 'Others'}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 font-extrabold uppercase block">Submitter</span>
                      <span className="font-semibold text-slate-700">{approvingVoucher.submittedBy}</span>
                    </div>
                  </div>
                </div>

                {/* Supporting Receipt Attachment Area */}
                <div className="space-y-1.5">
                  <span className="text-[10px] text-slate-400 font-extrabold uppercase block">Supporting Receipt / Proof Invoice:</span>
                  {approvingVoucher.attachmentData ? (
                    <div className="bg-slate-950 p-2 rounded-xl border border-slate-800 flex justify-center max-h-[160px] overflow-hidden">
                      {approvingVoucher.attachmentData.startsWith('data:application/pdf') ? (
                        <div className="p-4 text-center text-xs text-indigo-300">
                          📄 PDF Receipt is attached ({approvingVoucher.attachmentName})
                        </div>
                      ) : (
                        <img
                          src={approvingVoucher.attachmentData}
                          alt="Supporting slip preview"
                          referrerPolicy="no-referrer"
                          className="max-h-[140px] object-contain rounded-lg shadow-sm border border-slate-800"
                        />
                      )}
                    </div>
                  ) : (
                    <div className="p-3 bg-amber-50 text-amber-700 border border-amber-100 rounded-xl text-[11px] font-bold text-center">
                      ⚠️ No receipt or image uploaded with the voucher!
                    </div>
                  )}
                </div>

                {/* Checkbox confirmation for Step 1 */}
                <label className="flex gap-2.5 items-start p-3 bg-indigo-50/50 border border-indigo-100 rounded-xl cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={checkedStep1}
                    onChange={(e) => setCheckedStep1(e.target.checked)}
                    className="w-4 h-4 mt-0.5 rounded text-indigo-600 border-slate-300 focus:ring-indigo-500 shrink-0 cursor-pointer"
                  />
                  <span className="text-xs text-slate-600 font-bold leading-tight">
                    {approvingVoucher.status === 'pending' && 'I confirm that as a Supervisor, the submitted amount, receipt, and basic details have been verified correctly. (Required)'}
                    {approvingVoucher.status === 'waiting_manager' && 'I confirm that as a Manager, the submitted amount, receipt, and basic details have been verified correctly. (Required)'}
                    {approvingVoucher.status === 'waiting_accounts' && 'I confirm that as an Accountant, the submitted amount, receipt, and basic details have been verified correctly. (Required)'}
                  </span>
                </label>

                {/* Action Controls for Step 1 */}
                <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setApprovingVoucher(null)}
                    className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-xs rounded-xl transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={!checkedStep1 || !hasApprovalPermission(approvingVoucher)}
                    onClick={() => setApprovalStep(2)}
                    className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-200 disabled:text-slate-400 text-white font-bold text-xs rounded-xl shadow-sm transition-all duration-150 cursor-pointer flex items-center gap-1.5"
                  >
                    <span>Next Step (2/3)</span>
                    <span>➔</span>
                  </button>
                </div>
              </div>
            )}

            {/* Step 2: Item List Audit and Comments */}
            {approvalStep === 2 && (
              <div className="space-y-4 animate-fade-in text-left">
                {/* Item List / Transport details display */}
                <div className="space-y-1.5">
                  <span className="text-[10px] text-slate-400 font-extrabold uppercase block hover:cursor-default">Purchased Goods / Travel Route Details:</span>
                  
                  {approvingVoucher.category === 'transport' && approvingVoucher.transportLogs && approvingVoucher.transportLogs.length > 0 ? (
                    <div className="overflow-hidden border border-slate-200/60 rounded-xl max-h-[140px] overflow-y-auto">
                      <table className="w-full text-xs text-left text-slate-600 font-sans">
                        <thead className="bg-[#FAFAFA] text-[10px] font-bold text-slate-400 border-b border-slate-100">
                          <tr>
                            <th className="p-2">Route</th>
                            <th className="p-2">Purpose</th>
                            <th className="p-2 text-right">Fare</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {approvingVoucher.transportLogs.map((log: any, idx: number) => (
                            <tr key={idx} className="hover:bg-slate-50">
                              <td className="p-2 font-semibold">
                                {log.fromLocation} ➔ {log.toLocation}
                              </td>
                              <td className="p-2 text-slate-500 font-medium">{log.reason}</td>
                              <td className="p-2 text-right font-bold text-emerald-600 font-mono">$ {log.amount}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : approvingVoucher.category !== 'transport' && approvingVoucher.items && approvingVoucher.items.length > 0 ? (
                    <div className="overflow-hidden border border-slate-200/60 rounded-xl max-h-[140px] overflow-y-auto">
                      <table className="w-full text-xs text-left text-slate-600 font-sans">
                        <thead className="bg-[#FAFAFA] text-[10px] font-bold text-slate-400 border-b border-slate-100">
                          <tr>
                            <th className="p-2">{approvingVoucher.category === 'office_rent' ? 'Rent Month' : 'Description'}</th>
                            <th className="p-2 text-center">Qty</th>
                            <th className="p-2 text-right">Amount</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {approvingVoucher.items.map((item: any, idx: number) => (
                            <tr key={idx} className="hover:bg-slate-50">
                              <td className="p-2 font-semibold">{item.description}</td>
                              <td className="p-2 text-center text-slate-500 font-mono">
                                {item.quantity} {item.uom === 'Month' ? 'Month' : item.uom}
                              </td>
                              <td className="p-2 text-right font-bold text-slate-800 font-mono">$ {item.amount}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="p-3 bg-slate-50 text-slate-400 border border-slate-200 border-dashed rounded-xl text-center text-xs">
                      No item or route details have been submitted.
                    </div>
                  )}
                </div>

                {/* Approver Commentary textarea */}
                <div className="space-y-1.5 text-xs">
                  <label htmlFor="auditNoteInput" className="text-[10px] text-slate-400 font-extrabold uppercase hover:cursor-pointer">
                    Audit Comment / Approval Note (Optional):
                  </label>
                  <textarea
                    id="auditNoteInput"
                    placeholder="e.g., Vouchers checked and found correct..."
                    value={approvalAuditNote}
                    onChange={(e) => setApprovalAuditNote(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500 text-slate-800 text-xs"
                    rows={2}
                  />
                </div>

                {/* Checkbox confirmation for Step 2 */}
                <label className="flex gap-2.5 items-start p-3 bg-indigo-50/50 border border-indigo-100 rounded-xl cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={checkedStep2}
                    onChange={(e) => setCheckedStep2(e.target.checked)}
                    className="w-4 h-4 mt-0.5 rounded text-indigo-600 border-slate-300 focus:ring-indigo-500 shrink-0 cursor-pointer"
                  />
                  <span className="text-xs text-slate-600 font-bold leading-tight">
                    {approvingVoucher.status === 'pending' && 'I have completed a Supervisor audit of the proof category, item details, and route information. (Required)'}
                    {approvingVoucher.status === 'waiting_manager' && 'I have completed a Managerial audit of the proof category, item details, and route information. (Required)'}
                    {approvingVoucher.status === 'waiting_accounts' && 'I have completed a final Accounts ledger audit of the proof category, item details, and route information. (Required)'}
                  </span>
                </label>

                {/* Actions Controls for Step 2 */}
                <div className="flex justify-between gap-2 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setApprovalStep(1)}
                    className="px-4 py-2.5 bg-slate-150 hover:bg-slate-200 text-slate-600 font-bold text-xs rounded-xl transition cursor-pointer"
                  >
                    Previous Step
                  </button>
                  <button
                    type="button"
                    disabled={!checkedStep2 || !hasApprovalPermission(approvingVoucher)}
                    onClick={() => setApprovalStep(3)}
                    className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-200 disabled:text-slate-400 text-white font-bold text-xs rounded-xl shadow-sm transition-all duration-150 cursor-pointer flex items-center gap-1.5"
                  >
                    <span>Next Step (3/3)</span>
                    <span>➔</span>
                  </button>
                </div>
              </div>
            )}

            {/* Step 3: Signature and Final Confirmation */}
            {approvalStep === 3 && (
              <div className="space-y-4 animate-fade-in text-left">
                {/* Approver Name Title signature */}
                <div className="space-y-1.5 text-xs">
                  <label htmlFor="approverNameInput" className="text-[10px] text-slate-400 font-extrabold uppercase hover:cursor-pointer">
                    {approvingVoucher.status === 'pending' && 'Name or Designation of Supervisor Officer (e.g., Supervisor / Team Lead):'}
                    {approvingVoucher.status === 'waiting_manager' && 'Name or Designation of Managerial Officer (e.g., Branch Manager / GM):'}
                    {approvingVoucher.status === 'waiting_accounts' && 'Name or Designation of Accounts Officer (e.g., Accountant / CFO):'}
                  </label>
                  <input
                    id="approverNameInput"
                    type="text"
                    placeholder="Enter name or designation..."
                    value={approvalApproverName}
                    onChange={(e) => setApprovalApproverName(e.target.value)}
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500 text-slate-800 text-xs font-bold"
                  />
                </div>

                {/* Final step confirmation */}
                <label className="flex gap-2.5 items-start p-3 bg-red-50/40 border border-red-100 rounded-xl cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={checkedStep3}
                    onChange={(e) => setCheckedStep3(e.target.checked)}
                    className="w-4 h-4 mt-0.5 rounded text-red-600 border-slate-300 focus:ring-red-500 shrink-0 cursor-pointer"
                  />
                  <span className="text-xs text-slate-600 font-bold leading-tight">
                    {approvingVoucher.status === 'pending' && 'I assume responsibility for approving this voucher bill as Supervisor and forward to Manager. (Required)'}
                    {approvingVoucher.status === 'waiting_manager' && 'I assume responsibility for approving this voucher bill as Manager and forward to Accounts. (Required)'}
                    {approvingVoucher.status === 'waiting_accounts' && 'I assume responsibility for approving this voucher bill as Accounts Officer and grant final consent to post to the Cash Book. (Required)'}
                  </span>
                </label>

                {/* Actions Controls for Step 3 */}
                <div className="flex justify-between gap-2 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setApprovalStep(2)}
                    className="px-4 py-2.5 bg-slate-150 hover:bg-slate-200 text-slate-600 font-bold text-xs rounded-xl transition cursor-pointer"
                  >
                    Previous Step
                  </button>
                  <button
                    type="button"
                    disabled={!checkedStep3 || !approvalApproverName.trim() || !hasApprovalPermission(approvingVoucher)}
                    onClick={async () => {
                      const nextStatus = 
                        approvingVoucher.status === 'pending' ? 'waiting_manager' :
                        approvingVoucher.status === 'waiting_manager' ? 'waiting_accounts' :
                        'approved';
                      
                      await handleUpdateStatus(
                        approvingVoucher,
                        nextStatus,
                        undefined,
                        approvalAuditNote.trim(),
                        approvalApproverName.trim()
                      );
                      setApprovingVoucher(null);
                    }}
                    className="px-5 py-2.5 bg-[#10B981] hover:bg-[#059669] text-white font-extrabold text-xs rounded-xl shadow-lg hover:shadow-xl shrink-0 transition flex items-center gap-1.5 cursor-pointer transform active:scale-95 disabled:bg-slate-200 disabled:text-slate-400 disabled:pointer-events-none"
                  >
                    <span>
                      {approvingVoucher.status === 'pending' && '✔️ Approve & Forward to Manager'}
                      {approvingVoucher.status === 'waiting_manager' && '✔️ Approve & Forward to Accounts'}
                      {approvingVoucher.status === 'waiting_accounts' && '✔️ Complete Final Approval & Posting'}
                    </span>
                  </button>
                </div>
              </div>
            )}

          </div>
        </div>
      )}

      {/* Attachment Viewer Modal Dialog */}
      {viewingAttachment && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-2xl w-full p-5 space-y-3 flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <span className="text-xs font-black text-slate-800 truncate font-sans">File: {viewingAttachment.name}</span>
              <button
                type="button"
                onClick={() => setViewingAttachment(null)}
                className="text-slate-400 hover:text-slate-600 text-lg font-bold p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 bg-slate-50 rounded-xl overflow-auto border border-slate-100 p-2 flex items-center justify-center min-h-[350px]">
              {viewingAttachment.data.startsWith('data:application/pdf') ? (
                <iframe
                  src={viewingAttachment.data}
                  title="PDF Attachment Viewer"
                  className="w-full h-[450px]"
                />
              ) : (
                <img
                  src={viewingAttachment.data}
                  alt="Attachment Preview"
                  referrerPolicy="no-referrer"
                  className="max-w-full max-h-[450px] object-contain rounded-lg"
                />
              )}
            </div>

            <div className="flex justify-end pt-1">
              <button
                type="button"
                onClick={() => setViewingAttachment(null)}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl transition cursor-pointer"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Voucher Modal Dialog */}
      {editingVoucher && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-lg w-full p-6 space-y-4 flex flex-col max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2 text-indigo-600">
                <Pencil className="w-5 h-5 animate-pulse" />
                <span className="font-extrabold text-sm font-sans text-slate-800">Edit Voucher Details</span>
              </div>
              <button
                type="button"
                onClick={() => setEditingVoucher(null)}
                className="text-slate-400 hover:text-slate-600 text-lg font-bold p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            {editError && (
              <div className="p-3 bg-rose-50 border border-rose-100 rounded-xl text-rose-600 text-xs font-semibold">
                ❌ {editError}
              </div>
            )}

            <form onSubmit={handleSaveEditVoucher} className="space-y-4">
              {/* Voucher Number (Title) - Readonly per user's requirement */}
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Voucher Number (Unchangeable)</label>
                <input
                  type="text"
                  value={editTitle}
                  readOnly
                  className="w-full px-3.5 py-2.5 border border-slate-200 bg-slate-100 text-slate-600 font-bold rounded-xl focus:outline-none text-xs cursor-not-allowed"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Amount ($) *</label>
                  <input
                    type="number"
                    placeholder="e.g., 1500"
                    value={editAmount}
                    onChange={(e) => setEditAmount(e.target.value)}
                    disabled={editCategory === 'transport'}
                    className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl bg-slate-50/50 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-800 text-xs font-bold disabled:opacity-75 disabled:bg-slate-100"
                  />
                  {editCategory === 'transport' && (
                    <span className="text-[9px] text-indigo-600 font-bold mt-1 block">Automatically calculated from the route details below</span>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Select Category *</label>
                  <select
                    value={editCategory}
                    onChange={(e) => {
                      setEditCategory(e.target.value);
                      if (e.target.value !== 'transport') {
                        setEditTransportLogs([]);
                      } else {
                        const sum = editTransportLogs.reduce((acc, item) => acc + item.amount, 0);
                        setEditAmount(sum.toString());
                      }
                    }}
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-800 text-xs cursor-pointer"
                  >
                    {Object.entries(EXPENSE_CATEGORY_LABELS).map(([key, item]) => (
                      <option key={key} value={key}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Transport detailed custom log entry sub-section for Edit Modal */}
              {editCategory === 'transport' && (
                <div className="p-4 bg-indigo-50/60 border border-indigo-100 rounded-2xl space-y-3">
                  <div className="flex items-center gap-1.5 text-indigo-900 font-bold text-xs">
                    <span>🚗 Transport Details Entry Box</span>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 mb-0.5">From Location *</label>
                      <input 
                        type="text" 
                        placeholder="Source (e.g., Dhamrai)" 
                        value={editFromLoc}
                        onChange={(e) => setEditFromLoc(e.target.value)}
                        className="w-full px-2.5 py-2.5 border border-slate-200 bg-white rounded-xl focus:outline-none focus:ring-1 focus:ring-indigo-400 text-slate-800 text-xs" 
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 mb-0.5">To Location *</label>
                      <input 
                        type="text" 
                        placeholder="Destination (e.g., Ashulia)" 
                        value={editToLoc}
                        onChange={(e) => setEditToLoc(e.target.value)}
                        className="w-full px-2.5 py-2.5 border border-slate-200 bg-white rounded-xl focus:outline-none focus:ring-1 focus:ring-indigo-400 text-slate-800 text-xs" 
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 mb-0.5">Purpose / Medium *</label>
                      <input 
                        type="text" 
                        placeholder="Purpose or Vehicle" 
                        value={editTReason}
                        onChange={(e) => setEditTReason(e.target.value)}
                        className="w-full px-2.5 py-2.5 border border-slate-200 bg-white rounded-xl focus:outline-none focus:ring-1 focus:ring-indigo-400 text-slate-800 text-xs" 
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 mb-0.5">Amount ($) *</label>
                      <div className="flex gap-1.5">
                        <input 
                          type="number" 
                          placeholder="Fare (e.g., 250)" 
                          value={editTAmount}
                          onChange={(e) => setEditTAmount(e.target.value)}
                          className="w-full px-2.5 py-2.5 border border-slate-200 bg-white rounded-xl focus:outline-none focus:ring-1 focus:ring-indigo-400 text-slate-800 text-xs font-mono font-bold" 
                        />
                        <button
                          type="button"
                          onClick={handleAddEditTransportLog}
                          className="px-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition cursor-pointer shrink-0"
                        >
                          Add
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Added routes list inside edit modal */}
                  {editTransportLogs.length > 0 && (
                    <div className="border border-indigo-100 rounded-xl overflow-hidden bg-white">
                      <div className="bg-indigo-100/40 px-2.5 py-1 text-[10px] font-bold text-indigo-950 flex justify-between select-none border-b border-indigo-100">
                        <span>Added Routes</span>
                        <span className="font-mono">Total Fare: $ {editAmount}</span>
                      </div>
                      <table className="w-full text-slate-700 text-[10px] leading-tight">
                        <tbody>
                          {editTransportLogs.map((log, lIdx) => (
                            <tr key={lIdx} className="border-b border-slate-100 hover:bg-slate-50/50">
                              <td className="px-2 py-1.5 font-bold">
                                {log.fromLocation} ➔ {log.toLocation}
                              </td>
                              <td className="px-2 py-1.5 text-slate-400">{log.reason}</td>
                              <td className="px-2 py-1.5 text-right font-mono font-bold">
                                $ {log.amount}
                              </td>
                              <td className="px-2 py-1.5 text-right">
                                <button
                                  type="button"
                                  onClick={() => handleRemoveEditTransportLog(lIdx)}
                                  className="text-rose-500 hover:text-rose-700 font-bold cursor-pointer"
                                  title="Delete"
                                >
                                  ✕
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* Items editing section for non-transport categories inside Edit Modal */}
              {editCategory !== 'transport' && (
                <div className="p-4 bg-indigo-50/40 border border-slate-200/60 rounded-2xl space-y-3">
                  <div className="flex items-center gap-1.5 text-slate-800 font-bold text-xs select-none">
                    <span>{editCategory === 'office_rent' ? '🏢 Office Rent Statement List' : '📋 Voucher Item List (Optional)'}</span>
                  </div>
                  
                  <div className="grid grid-cols-12 gap-2 text-[10px] font-bold text-slate-500 select-none">
                    <div className="col-span-5">{editCategory === 'office_rent' ? 'Rent Month *' : 'Item Description *'}</div>
                    {editCategory !== 'office_rent' && <div className="col-span-2">UoM *</div>}
                    <div className={editCategory === 'office_rent' ? 'col-span-3' : 'col-span-2'}>Qty *</div>
                    <div className={editCategory === 'office_rent' ? 'col-span-4' : 'col-span-3'}>Amount *</div>
                  </div>

                  <div className="grid grid-cols-12 gap-2">
                    <div className="col-span-5">
                      <input 
                        type="text" 
                        placeholder={editCategory === 'office_rent' ? 'e.g., January 2026' : 'e.g., Notebook and Pen'} 
                        value={editItemDesc}
                        onChange={(e) => setEditItemDesc(e.target.value)}
                        className="w-full px-2.5 py-1.5 border border-slate-200 bg-white rounded-xl focus:outline-none focus:ring-1 focus:ring-indigo-400 text-slate-800 text-xs" 
                      />
                    </div>
                    {editCategory !== 'office_rent' && (
                      <div className="col-span-2">
                        <select
                          value={editItemUom}
                          onChange={(e) => setEditItemUom(e.target.value)}
                          className="w-full px-1 py-1.5 border border-slate-200 bg-white rounded-xl focus:outline-none focus:ring-1 focus:ring-indigo-400 text-slate-800 text-[11px] cursor-pointer"
                        >
                          <option value="Pcs">Pcs</option>
                          <option value="Kg">Kg</option>
                          <option value="Ltr">Ltr</option>
                          <option value="Bag">Bag</option>
                          <option value="Yard">Yard</option>
                          <option value="Ft">Ft</option>
                          <option value="Packet">Packet</option>
                          <option value="Box">Box</option>
                          <option value="Set">Set</option>
                          <option value="Others">Others</option>
                        </select>
                      </div>
                    )}
                    <div className={editCategory === 'office_rent' ? 'col-span-3' : 'col-span-2'}>
                      <input 
                        type="number" 
                        placeholder={editCategory === 'office_rent' ? 'e.g., 1' : 'qty'} 
                        value={editItemQty}
                        onChange={(e) => setEditItemQty(e.target.value)}
                        className="w-full px-1 py-1.5 border border-slate-200 bg-white rounded-xl focus:outline-none focus:ring-1 focus:ring-indigo-400 text-slate-800 text-xs font-mono font-bold text-center" 
                      />
                    </div>
                    <div className={editCategory === 'office_rent' ? 'col-span-4 flex gap-1' : 'col-span-3 flex gap-1'}>
                      <input 
                        type="number" 
                        placeholder="Amount" 
                        value={editItemAmt}
                        onChange={(e) => setEditItemAmt(e.target.value)}
                        className="w-full px-1.5 py-1.5 border border-slate-200 bg-white rounded-xl focus:outline-none focus:ring-1 focus:ring-indigo-400 text-slate-800 text-xs font-mono font-bold" 
                      />
                      <button
                        type="button"
                        onClick={handleAddEditItem}
                        className="px-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black transition cursor-pointer shrink-0"
                        title="Add Item"
                      >
                        +
                      </button>
                    </div>
                  </div>

                  {/* Table of items in Edit modal */}
                  {editVoucherItems.length > 0 && (
                    <div className="border border-slate-200 rounded-xl overflow-hidden bg-white text-[10px] select-none">
                      <table className="w-full text-slate-700 leading-tight">
                        <thead className="bg-[#FAFAFA] text-[9px] text-slate-400 font-extrabold uppercase border-b border-slate-100">
                          <tr>
                            <th className="px-2 py-1.5 text-center">SL</th>
                            <th className="px-2 py-1.5 text-left">{editCategory === 'office_rent' ? 'Rent Month' : 'Description'}</th>
                            {editCategory !== 'office_rent' && <th className="px-2 py-1.5 text-center">UoM</th>}
                            <th className="px-2 py-1.5 text-center">Qty</th>
                            <th className="px-1.5 py-1.5 text-right">Amount</th>
                            <th className="px-2 py-1.5 text-center">Delete</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {editVoucherItems.map((item, idx) => (
                            <tr key={idx} className="hover:bg-slate-50/50">
                              <td className="px-2 py-1.5 text-center font-bold text-slate-400">{item.sn}</td>
                              <td className="px-2 py-1.5 font-bold text-slate-800">{item.description}</td>
                              {editCategory !== 'office_rent' && <td className="px-2 py-1.5 text-center text-slate-500">{item.uom}</td>}
                              <td className="px-2 py-1.5 text-center font-bold font-mono">
                                {item.quantity} {item.uom === 'Month' ? 'Month' : item.uom}
                              </td>
                              <td className="px-1.5 py-1.5 text-right font-black text-slate-800 font-mono">
                                ৳ {item.amount.toLocaleString('en-US')}
                              </td>
                              <td className="px-2 py-1.5 text-center">
                                <button
                                  type="button"
                                  onClick={() => handleRemoveEditItem(idx)}
                                  className="text-rose-500 hover:text-rose-700 font-bold cursor-pointer"
                                  title="Delete"
                                >
                                  ✕
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      <div className="bg-[#FAFAFA] p-1.5 text-right border-t border-slate-100 text-[9px] font-black text-slate-500">
                        Total {editCategory === 'office_rent' ? 'Rent' : 'Item Value'}: <span className="font-mono text-slate-900 font-extrabold text-[10px]">৳ {editVoucherItems.reduce((acc, item) => acc + item.amount, 0).toLocaleString('en-US')}</span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Date *</label>
                  <input
                    type="date"
                    value={editDate}
                    onChange={(e) => setEditDate(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-800 text-xs font-bold cursor-pointer"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Submitter *</label>
                  <input
                    type="text"
                    placeholder="e.g., Aminul Islam"
                    value={editSubmittedBy}
                    onChange={(e) => setEditSubmittedBy(e.target.value)}
                    className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-800 text-xs font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Description / Purpose (Optional)</label>
                <textarea
                  rows={2}
                  placeholder="Enter detailed description or purpose..."
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-800 text-xs"
                />
              </div>

              {/* Upload Voucher file details */}
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Upload Voucher File (Receipt Image / PDF)</label>
                <div className="border border-dashed border-slate-200 rounded-xl p-3 bg-slate-50 text-center relative hover:bg-slate-100 transition duration-150">
                  <input
                    type="file"
                    accept="image/*,application/pdf"
                    onChange={handleEditFileChange}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                  <div className="space-y-1 select-none">
                    <span className="text-[11px] text-slate-500 font-bold block">
                      📁 Select new file (or drag & drop)
                    </span>
                    <span className="text-[9px] text-slate-400 block font-semibold">
                      Maximum 1.2 MB image or PDF file allowed
                    </span>
                  </div>
                </div>
                {editAttachmentName && (
                  <div className="mt-2 p-2 bg-indigo-50 rounded-xl flex items-center justify-between text-[11px] font-bold text-indigo-950">
                    <span className="truncate">📎 {editAttachmentName}</span>
                    <button
                      type="button"
                      onClick={() => {
                        setEditAttachmentName('');
                        setEditAttachmentData('');
                      }}
                      className="text-rose-500 hover:text-rose-700 font-extrabold cursor-pointer text-sm font-sans"
                      title="Delete File"
                    >
                      ✕
                    </button>
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2.5 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingVoucher(null)}
                  className="px-4 py-2 bg-slate-150 hover:bg-slate-200 text-slate-600 font-bold text-xs rounded-xl transition cursor-pointer"
                >
                  Close
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl transition cursor-pointer"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}