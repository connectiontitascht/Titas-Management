/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { 
  Search, 
  Trash2, 
  ArrowUpRight, 
  ArrowDownRight, 
  Filter, 
  Calendar,
  X,
  CreditCard,
  EyeOff,
  Printer,
  Download
} from 'lucide-react';
import { 
  Transaction, 
  TransactionCategory, 
  TransactionType,
  ALL_CATEGORY_LABELS,
  IncomeCategory,
  ExpenseCategory,
  INCOME_CATEGORY_LABELS,
  EXPENSE_CATEGORY_LABELS
} from '../types';
import { PaymentMethodLogo } from './PaymentLogos';

interface TransactionListProps {
  transactions: Transaction[];
  onDeleteTransaction: (id: string) => void;
  onDeleteAllTransactions?: () => void;
}

export function TransactionList({ transactions, onDeleteTransaction, onDeleteAllTransactions }: TransactionListProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<TransactionType | 'all'>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest' | 'amount-desc' | 'amount-asc'>('newest');
  const [quickDateFilter, setQuickDateFilter] = useState<string>('all');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  // Helpers for formatting details based on transaction type (Standard vs Voucher)
  const isVoucherTx = (title: string): boolean => {
    const lowercaseTitle = title.toLowerCase();
    return lowercaseTitle.includes('voucher approved') || lowercaseTitle.includes('vou-');
  };

  const extractVoucherId = (title: string): string => {
    const match = title.match(/(VOU-[A-Z0-9-]+)/i);
    return match ? match[1].toUpperCase() : title;
  };

  const extractClientName = (title: string): string => {
    let cleaned = title;
    cleaned = cleaned.replace('Home User Monthly Bill: ', '');
    cleaned = cleaned.replace('হোম ইউজার মাসিক বিল: ', '');
    cleaned = cleaned.replace('Voucher Approved: ', '');
    cleaned = cleaned.replace(/[()]/g, '');
    return cleaned.trim();
  };

  const extractVoucherCreator = (t: Transaction): string => {
    if (t.receivedBy) return t.receivedBy;
    const match = t.title.match(/\(([^)]+)\)$/);
    if (match && match[1]) return match[1].trim();
    return '-';
  };

  const extractApproverName = (notes?: string): string => {
    if (!notes) return 'System Admin';
    const match = notes.match(/Approver:\s*([^)]+)/);
    if (match && match[1]) {
      return match[1].trim();
    }
    return 'System Admin';
  };

  // Format Helper
  const formatAmount = (num: number, type: TransactionType) => {
    const sign = type === 'income' ? '+' : '-';
    return `${sign} ৳ ${num.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
  };

  const formatDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  // Filter transactions
  const filteredTransactions = transactions.filter((t) => {
    const matchesSearch = t.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          (t.notes && t.notes.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesType = typeFilter === 'all' || t.type === typeFilter;
    const matchesCategory = categoryFilter === 'all' || t.category === categoryFilter;

    // Date filtering logic
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

  // Sort transactions
  const sortedTransactions = [...filteredTransactions].sort((a, b) => {
    if (sortOrder === 'newest') {
      return new Date(b.date).getTime() - new Date(a.date).getTime();
    }
    if (sortOrder === 'oldest') {
      return new Date(a.date).getTime() - new Date(b.date).getTime();
    }
    if (sortOrder === 'amount-desc') {
      return b.amount - a.amount;
    }
    if (sortOrder === 'amount-asc') {
      return a.amount - b.amount;
    }
    return 0;
  });

  // PDF Download Modal Options State
  const [isDownloadModalOpen, setIsDownloadModalOpen] = useState(false);
  const [downloadTypeFilter, setDownloadTypeFilter] = useState<TransactionType | 'all'>('all');
  const [downloadRangeType, setDownloadRangeType] = useState<'all' | 'today' | 'this-month' | 'last-month' | 'this-year' | 'last-year' | 'custom'>('all');
  const [downloadStartDate, setDownloadStartDate] = useState<string>('');
  const [downloadEndDate, setDownloadEndDate] = useState<string>('');

  const resetFilters = () => {
    setSearchTerm('');
    setTypeFilter('all');
    setCategoryFilter('all');
    setSortOrder('newest');
    setQuickDateFilter('all');
    setStartDate('');
    setEndDate('');
  };

  const handleDownloadPDFWithParams = (
    type: TransactionType | 'all',
    rangeType: 'all' | 'today' | 'this-month' | 'last-month' | 'this-year' | 'last-year' | 'custom',
    customStart: string,
    customEnd: string
  ) => {
    // Filter the original transactions list for the PDF
    const reportTxList = transactions.filter((t) => {
      // Filter by type
      const matchesType = type === 'all' || t.type === type;

      // Filter by date
      let matchesDate = true;
      if (rangeType === 'today') {
        const todayStr = new Date().toISOString().split('T')[0];
        matchesDate = t.date === todayStr;
      } else if (rangeType === 'this-month') {
        const now = new Date();
        const currentYearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        matchesDate = t.date.startsWith(currentYearMonth);
      } else if (rangeType === 'last-month') {
        const now = new Date();
        let year = now.getFullYear();
        let month = now.getMonth(); // previous month index
        if (month === 0) {
          month = 12;
          year = year - 1;
        }
        const lastYearMonth = `${year}-${String(month).padStart(2, '0')}`;
        matchesDate = t.date.startsWith(lastYearMonth);
      } else if (rangeType === 'this-year') {
        const now = new Date();
        const currentYear = `${now.getFullYear()}-`;
        matchesDate = t.date.startsWith(currentYear);
      } else if (rangeType === 'last-year') {
        const now = new Date();
        const lastYear = `${now.getFullYear() - 1}-`;
        matchesDate = t.date.startsWith(lastYear);
      } else if (rangeType === 'custom') {
        if (customStart) {
          matchesDate = matchesDate && t.date >= customStart;
        }
        if (customEnd) {
          matchesDate = matchesDate && t.date <= customEnd;
        }
      }

      return matchesType && matchesDate;
    });

    // Sort reportTxList (always show newest first in PDF reports for readability)
    reportTxList.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    // Calculate totals for report list
    const totalIncome = reportTxList
      .filter((t) => t.type === 'income')
      .reduce((sum, t) => sum + t.amount, 0);
    const totalExpense = reportTxList
      .filter((t) => t.type === 'expense')
      .reduce((sum, t) => sum + t.amount, 0);
    const netBalance = totalIncome - totalExpense;

    // Filter range text
    const dateText = 
      rangeType === 'today' ? 'Today\'s Transactions' :
      rangeType === 'this-month' ? 'Current Month Transactions' :
      rangeType === 'last-month' ? 'Previous Month Transactions' :
      rangeType === 'this-year' ? 'Current Year Transactions' :
      rangeType === 'last-year' ? 'Previous Year Transactions' :
      rangeType === 'custom' ? `Ledger Period: ${customStart || 'Start'} to ${customEnd || 'End'}` : 
      'All Time Transaction Ledger';

    const typeText = 
      type === 'income' ? ' (Income Only)' :
      type === 'expense' ? ' (Expense Only)' : '';

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Please disable your browser popup blocker and try again.');
      return;
    }    // Beautiful HTML template
    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Titas_Internet_Transaction_Report_${new Date().toISOString().split('T')[0]}</title>
          <meta charset="utf-8">
          <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
          <script src="https://cdn.tailwindcss.com"></script>
          <style>
            body {
              font-family: 'Inter', sans-serif;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            @media print {
              .no-print { display: none; }
              body { padding: 0; margin: 0; background: white; }
              @page { size: landscape; margin: 8mm; }
            }
          </style>
        </head>
        <body class="bg-slate-50 text-slate-800 p-4 md:p-8">
          <div class="max-w-[1300px] w-full mx-auto bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-slate-100">
            
            <!-- Floating Navigation Controls -->
            <div class="no-print flex justify-between items-center bg-indigo-50 p-4 rounded-xl border border-indigo-100 mb-8">
              <div class="flex items-center gap-2">
                <span class="flex h-2 w-2 relative">
                  <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                  <span class="relative inline-flex rounded-full h-2 w-2 bg-indigo-600"></span>
                </span>
                <span class="text-xs font-bold text-indigo-800">Report Print & PDF Download Preview</span>
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

            <!-- PDF Banner Header -->
            <div class="flex flex-col md:flex-row justify-between items-start md:items-center border-b-2 border-slate-100 pb-6 mb-8 gap-4">
              <div>
                <h1 class="text-2xl font-bold text-slate-900 tracking-tight">Titas Internet</h1>
                <p class="text-xs font-semibold text-slate-500 mt-1">Internet Service Provider (ISP) Billing Ledger</p>
                <p class="text-[11px] text-slate-400 font-medium mt-0.5">Generated on: ${new Date().toLocaleString('en-US', { hour12: true })}</p>
              </div>
              <div class="md:text-right">
                <span class="inline-flex items-center gap-1.5 px-3.5 py-2 bg-indigo-50/70 border border-indigo-100/60 rounded-xl text-xs font-bold text-indigo-700">
                  📅 ${dateText}${typeText}
                </span>
              </div>
            </div>

            <!-- Financial Cards Summary -->
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
              <div class="p-4 rounded-xl border border-emerald-100 bg-emerald-50/20 text-left">
                <span class="text-[11px] font-bold text-emerald-700 uppercase tracking-wider">Total Collections & Income (+)</span>
                <h3 class="text-xl font-extrabold text-emerald-800 mt-1">৳ ${totalIncome.toLocaleString('en-US', { minimumFractionDigits: 0 })}</h3>
              </div>

              <div class="p-4 rounded-xl border border-rose-100 bg-rose-50/20 text-left">
                <span class="text-[11px] font-bold text-rose-700 uppercase tracking-wider">Total Expenses & Payments (-)</span>
                <h3 class="text-xl font-extrabold text-rose-800 mt-1">৳ ${totalExpense.toLocaleString('en-US', { minimumFractionDigits: 0 })}</h3>
              </div>

              <div class="p-4 rounded-xl border border-indigo-100 bg-indigo-50/20 text-left">
                <span class="text-[11px] font-bold text-indigo-700 uppercase tracking-wider">Recent Net Balance (=)</span>
                <h3 class="text-xl font-extrabold text-indigo-800 mt-1">৳ ${netBalance.toLocaleString('en-US', { minimumFractionDigits: 0 })}</h3>
              </div>
            </div>

            <!-- Main Items Table -->
            <div class="mb-8 overflow-x-auto">
              <h3 class="text-xs font-bold text-slate-700 mb-3 border-b pb-1.5 uppercase tracking-wider">📝 Transaction Statement</h3>
              <table class="w-full text-left text-[11px] border-collapse min-w-[1000px]">
                <thead>
                  <tr class="bg-slate-50 text-slate-500 font-bold border-b border-slate-200">
                    <th class="py-2.5 px-3">Date</th>
                    <th class="py-2.5 px-3">Transaction Details / Voucher ID</th>
                    <th class="py-2.5 px-3">Client ID / Voucher Creator</th>
                    <th class="py-2.5 px-3">Collector Name / Approver</th>
                    <th class="py-2.5 px-3">Office Collector Name</th>
                    <th class="py-2.5 px-3 text-center">Payment Method</th>
                    <th class="py-2.5 px-3 text-center">Category</th>
                    <th class="py-2.5 px-3 text-right">Amount (BDT)</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-slate-100">
                  ${reportTxList.length === 0 ? `
                    <tr>
                      <td colspan="8" class="py-8 text-center text-slate-400 font-bold">No transaction entries found for the selected criteria.</td>
                    </tr>
                  ` : reportTxList.map(t => {
                    const isInc = t.type === 'income';
                    const catLabel = ALL_CATEGORY_LABELS[t.category]?.label || t.category;
                    const isVoucher = isVoucherTx(t.title);

                    const detailsStr = isVoucher ? extractVoucherId(t.title) : extractClientName(t.title);
                    const clientIdStr = isVoucher ? extractVoucherCreator(t) : (t.clientId || '-');
                    const collectorStr = isVoucher ? extractApproverName(t.notes) : (t.collectorName || t.receivedBy || '-');
                    const officeCollectorStr = isVoucher ? '-' : (t.receiverName || '-');
                    const paymentMethodStr = t.paymentMethod || '-';
                    
                    // formatDate local replacement
                    let localDateStr = t.date;
                    try {
                      const dObj = new Date(t.date);
                      localDateStr = dObj.toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric'
                      });
                    } catch (e) {}

                    return `
                      <tr class="hover:bg-slate-50/30">
                        <td class="py-2.5 px-3 text-slate-500 font-semibold font-mono whitespace-nowrap">${localDateStr}</td>
                        <td class="py-2.5 px-3">
                          <div class="font-bold text-slate-800">${detailsStr}</div>
                          ${t.billingMonth ? `
                            <span class="inline-block mt-0.5 text-[9px] bg-indigo-50 text-indigo-700 font-bold px-1 rounded">
                              🌙 Billing Month: ${t.billingMonth}
                            </span>
                          ` : ''}
                          ${t.notes && !isVoucher ? `<p class="text-[10px] text-slate-400 mt-0.5">${t.notes}</p>` : ''}
                        </td>
                        <td class="py-2.5 px-3 text-indigo-600 font-bold font-mono whitespace-nowrap">${clientIdStr}</td>
                        <td class="py-2.5 px-3 text-slate-700 font-semibold whitespace-nowrap">${collectorStr}</td>
                        <td class="py-2.5 px-3 text-slate-600 font-semibold whitespace-nowrap">${officeCollectorStr}</td>
                        <td class="py-2.5 px-3 text-center whitespace-nowrap">
                          <span class="inline-block bg-slate-100 text-slate-600 text-[10px] font-bold px-1.5 py-0.5 rounded font-mono">
                            ${paymentMethodStr}
                          </span>
                        </td>
                        <td class="py-2.5 px-3 text-slate-600 text-center font-medium">${catLabel}</td>
                        <td class="py-2.5 px-3 text-right font-bold text-slate-800 font-mono whitespace-nowrap ${isInc ? 'text-emerald-600' : 'text-rose-600'}">
                          ${isInc ? '+' : '-'} ৳ ${t.amount.toLocaleString('en-US')}
                        </td>
                      </tr>
                    `;
                  }).join('')}
                </tbody>
              </table>
            </div>

            <!-- Calculation summary footer block -->
            <div class="flex flex-col md:flex-row justify-between items-start md:items-center bg-slate-50 border border-slate-200/60 p-4 rounded-xl text-xs gap-3 mb-12">
              <div>
                <p class="font-bold text-slate-700">Total Transactions: ${reportTxList.length}</p>
                <p class="text-slate-400 text-[10px] mt-0.5">This is a system-generated automated report. No manual entry is required.</p>
              </div>
              <div class="text-[11px] text-slate-600 font-medium">
                <p>Report Ledger: <strong class="text-slate-800 font-bold">${dateText}</strong></p>
              </div>
            </div>

            <!-- Document Signatures section -->
            <div class="grid grid-cols-2 gap-12 pt-10 border-t border-dashed border-slate-300">
              <div class="text-center">
                <div class="w-36 border-b border-slate-400 mx-auto mb-1.5 h-8"></div>
                <p class="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Collector / Officer Signature</p>
              </div>
              <div class="text-center">
                <div class="w-36 border-b border-slate-400 mx-auto mb-1.5 h-8"></div>
                <p class="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Approving Manager Signature</p>
              </div>
            </div>

          </div>

          <script>
            // Automatic print trigger
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

  const handlePrintSingleReceipt = (t: Transaction) => {
    const isInc = t.type === 'income';
    const catLabel = ALL_CATEGORY_LABELS[t.category]?.label || t.category;
    
    let customDate = t.date;
    try {
      const dObj = new Date(t.date);
      customDate = dObj.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    } catch (e) {}

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Please disable your browser popup blocker and try again.');
      return;
    }

    const receiptTitle = isInc ? `Receipt_${t.id}` : `Expense_Voucher_${t.id}`;
    
    const payMethodEng = t.paymentMethod || 'Cash';

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>${receiptTitle}</title>
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
              .no-print { display: none; }
              body { padding: 0; margin: 0; background: white; }
              .receipt-container { border: none !important; box-shadow: none !important; margin: 0 !important; width: 100% !important; max-width: 100% !important; }
            }
          </style>
        </head>
        <body class="bg-slate-50 text-slate-800 p-4 md:p-12">
          
          <div class="receipt-container max-w-lg mx-auto bg-white p-6 rounded-2xl shadow-md border border-slate-200/80 relative font-sans">
            
            <div class="no-print flex justify-between items-center bg-indigo-50 p-3 rounded-xl border border-indigo-100 mb-6 gap-2">
              <span class="text-xs font-bold text-indigo-800 block">Receipt Print Preview</span>
              <div class="flex gap-2">
                <button onclick="window.print()" class="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[11px] px-3.5 py-1.5 rounded-lg cursor-pointer shadow-sm transition">
                  🖨️ Print
                </button>
                <button onclick="window.close()" class="bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-[11px] px-3.5 py-1.5 rounded-lg cursor-pointer transition">
                  Close
                </button>
              </div>
            </div>

            <div class="text-center border-b border-slate-100 pb-4 mb-5">
              <h1 class="text-xl font-black text-indigo-950 tracking-tight">Titas Internet</h1>
              <p class="text-[10px] font-bold text-slate-500 uppercase tracking-wide mt-1">High-Speed Fiber Internet & Cable Solutions</p>
              <p class="text-[9px] text-slate-400 font-medium">Billing Division | Type: ${isInc ? 'Collection Slip' : 'Expense Slip'}</p>
            </div>

            <div class="flex justify-between items-center mb-6 gap-2">
              <span class="text-[10px] font-bold text-slate-400 font-mono">ID: #${t.id}</span>
              <span class="px-3 py-1 text-xs font-bold rounded-lg ${isInc ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'}">
                ${isInc ? '💵 Money Receipt' : '📝 Office Expense Voucher'}
              </span>
            </div>

            <div class="space-y-3.5 text-xs text-slate-700 mb-6">
              
              <div class="flex justify-between items-center py-2 border-b border-dashed border-slate-100">
                <span class="text-slate-400 font-bold">Date:</span>
                <span class="font-extrabold text-slate-800">${customDate}</span>
              </div>

              <div class="flex justify-between items-center py-2 border-b border-dashed border-slate-100">
                <span class="text-slate-400 font-bold">Particulars / Details:</span>
                <span class="font-extrabold text-slate-800 text-right max-w-[220px] leading-tight">${t.title}</span>
              </div>

              <div class="flex justify-between items-center py-2 border-b border-dashed border-slate-100">
                <span class="text-slate-400 font-bold">Category:</span>
                <span class="font-bold text-slate-700 bg-slate-50 px-2 py-0.5 rounded border border-slate-100">${catLabel}</span>
              </div>

              ${t.paymentMethod ? `
                <div class="flex justify-between items-center py-2 border-b border-dashed border-slate-100">
                  <span class="text-slate-400 font-bold">Payment Method:</span>
                  <span class="font-bold text-slate-800">${payMethodEng}</span>
                </div>
              ` : ''}

              ${t.billingMonth ? `
                <div class="flex justify-between items-center py-2 border-b border-dashed border-slate-100">
                  <span class="text-slate-400 font-bold">Billing Month:</span>
                  <span class="font-semibold text-slate-800">${t.billingMonth}</span>
                </div>
              ` : ''}

              ${t.monthlyBill ? `
                <div class="flex justify-between items-center py-2 border-b border-dashed border-slate-100">
                  <span class="text-slate-400 font-bold">Monthly Charge:</span>
                  <span class="font-semibold text-slate-800">BDT ${t.monthlyBill.toLocaleString('en-US')}</span>
                </div>
              ` : ''}

              ${t.receivedBy ? `
                <div class="flex justify-between items-center py-2 border-b border-dashed border-slate-100">
                  <span class="text-slate-400 font-bold">Officer / Collector:</span>
                  <span class="font-bold text-slate-800">${t.receivedBy}</span>
                </div>
              ` : ''}

              ${t.notes ? `
                <div class="bg-slate-50 p-3 rounded-xl border border-slate-100 text-[11px] leading-relaxed text-slate-500 italic mt-3 mb-1">
                  <strong>Notes:</strong> ${t.notes}
                </div>
              ` : ''}

            </div>

            <div class="bg-indigo-900 text-slate-100 p-4 rounded-xl text-center mb-8 shadow-sm">
              <span class="text-[10px] font-bold text-indigo-200 block uppercase tracking-wider mb-1">Total Paid Amount</span>
              <span class="text-2xl font-black font-sans">BDT ${t.amount.toLocaleString('en-US')}</span>
            </div>

            <div class="text-[10px] text-slate-400 font-medium text-center mb-8 p-2 border border-dashed border-slate-100 rounded-lg">
              Thank you for choosing Titas Internet.
            </div>

            <div class="grid grid-cols-2 gap-6 pt-8 border-t border-dashed border-slate-200">
              <div class="text-center">
                <div class="border-b border-slate-300 w-24 mx-auto mb-1 h-6"></div>
                <p class="text-[9px] font-bold text-slate-500 uppercase tracking-tight">Collector / Officer</p>
              </div>
              <div class="text-center">
                <div class="border-b border-slate-300 w-24 mx-auto mb-1 h-6"></div>
                <p class="text-[9px] font-bold text-slate-500 uppercase tracking-tight">Authorized Signature</p>
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

  const handleDownloadPDF = () => {
    // Open the download modal configuration overlay!
    setDownloadStartDate(startDate || '');
    setDownloadEndDate(endDate || '');
    setDownloadRangeType(quickDateFilter === 'custom' ? 'custom' : (quickDateFilter as any));
    setDownloadTypeFilter(typeFilter);
    setIsDownloadModalOpen(true);
  };

  const handleExportCSV = () => {
    const headers = ['Date', 'Title', 'Type', 'Category', 'Amount', 'Notes', 'Payment Method'];
    const csvContent = [
      headers.join(','),
      ...sortedTransactions.map(t => [
        `"${t.date}"`,
        `"${t.title.replace(/"/g, '""')}"`,
        `"${t.type}"`,
        `"${t.category}"`,
        t.amount,
        `"${(t.notes || '').replace(/"/g, '""')}"`,
        `"${t.paymentMethod || ''}"`
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `transactions_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrintCurrentMonthSummary = () => {
    // ... [restored code] ...
    // (I will just re-add the whole function)
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonthNumber = now.getMonth() + 1;
    const currentYearMonth = `${currentYear}-${String(currentMonthNumber).padStart(2, '0')}`;
    
    const monthNamesEnglish = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    const currentMonthNameEnglish = monthNamesEnglish[now.getMonth()];

    // Filter current month transactions
    const currentMonthTx = transactions.filter(t => t.date.startsWith(currentYearMonth));

    // Sort by date ascending (oldest to newest) to show structured accounting ledger
    const sortedTx = [...currentMonthTx].sort((a, b) => a.date.localeCompare(b.date));

    // Calculations
    const totalIncome = sortedTx
      .filter((t) => t.type === 'income')
      .reduce((sum, t) => sum + t.amount, 0);
    const totalExpense = sortedTx
      .filter((t) => t.type === 'expense')
      .reduce((sum, t) => sum + t.amount, 0);
    const netBalance = totalIncome - totalExpense;

    // Category-wise summary calculation
    const categorySummary: { [key: string]: { income: number; expense: number } } = {};
    sortedTx.forEach(t => {
      const catLabel = ALL_CATEGORY_LABELS[t.category]?.label || t.category;
      if (!categorySummary[catLabel]) {
        categorySummary[catLabel] = { income: 0, expense: 0 };
      }
      if (t.type === 'income') {
        categorySummary[catLabel].income += t.amount;
      } else {
        categorySummary[catLabel].expense += t.amount;
      }
    });

    const categorySummaryList = Object.entries(categorySummary).map(([category, data]) => ({
      category,
      income: data.income,
      expense: data.expense
    }));

    const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Monthly_Transaction_Summary_${currentYearMonth}</title>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
        
        * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
        }
        
        body {
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            background-color: #ffffff;
            color: #1e293b;
            padding: 30px;
            display: flex;
            flex-direction: column;
            align-items: center;
            min-height: 100vh;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
        }

        .report-container {
            background: #ffffff;
            width: 100%;
            max-width: 800px;
            border: 1px solid #cbd5e1;
            border-radius: 12px;
            padding: 35px;
            position: relative;
        }

        .header-section {
            text-align: center;
            border-bottom: 2px dashed #cbd5e1;
            padding-bottom: 20px;
            margin-bottom: 25px;
        }

        .brand-title {
            font-size: 26px;
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

        .report-tag {
            display: inline-block;
            background-color: #f1f5f9;
            color: #4f46e5;
            font-size: 12px;
            font-weight: 700;
            padding: 5px 16px;
            border: 1px solid #e2e8f0;
            border-radius: 9999px;
            margin-top: 12px;
            text-transform: uppercase;
        }

        .meta-grid {
            display: grid;
            grid-template-cols: 1fr 1fr;
            gap: 15px;
            margin-bottom: 25px;
            background-color: #f8fafc;
            border: 1px solid #e2e8f0;
            padding: 15px;
            border-radius: 10px;
        }

        .meta-item {
            font-size: 13px;
        }

        .meta-label {
            color: #64748b;
            font-weight: 600;
            font-size: 11px;
            display: block;
            margin-bottom: 2px;
            text-transform: uppercase;
        }

        .meta-value {
            font-weight: 700;
            color: #0f172a;
            font-size: 14px;
        }

        .stats-grid {
            display: grid;
            grid-template-cols: 1fr 1fr 1fr;
            gap: 15px;
            margin-bottom: 25px;
        }

        .stat-card {
            border-radius: 10px;
            padding: 14px 18px;
            color: #0f172a;
            border: 1.5px solid #cbd5e1;
            text-align: left;
        }

        .stat-card.income {
            background-color: #f0fdf4;
            border-color: #bbf7d0;
        }

        .stat-card.expense {
            background-color: #fef2f2;
            border-color: #fecaca;
        }

        .stat-card.balance {
            background-color: #f5f3ff;
            border-color: #ddd6fe;
        }

        .stat-label {
            font-size: 11px;
            font-weight: 700;
            color: #475569;
            text-transform: uppercase;
            display: block;
            margin-bottom: 4px;
        }

        .stat-value {
            font-size: 18px;
            font-weight: 800;
        }

        .stat-card.income .stat-value { color: #15803d; }
        .stat-card.expense .stat-value { color: #b91c1c; }
        .stat-card.balance .stat-value { color: #6d28d9; }

        .section-title {
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

        .summary-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 12px;
            margin-bottom: 25px;
            border-radius: 8px;
            overflow: hidden;
            border: 1px solid #cbd5e1;
        }

        .summary-table th {
            background-color: #f8fafc;
            color: #475569;
            padding: 8px 12px;
            font-weight: 700;
            border-bottom: 2px solid #cbd5e1;
            font-size: 11px;
            text-transform: uppercase;
        }

        .summary-table td {
            padding: 10px 12px;
            border-bottom: 1px solid #cbd5e1;
            color: #334155;
            line-height: 1.4;
        }

        .summary-table tr:last-child td {
            border-bottom: none;
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
            .report-container {
                border: none !important;
                padding: 0 !important;
                width: 100% !important;
                max-width: 100% !important;
            }
        }
    </style>
</head>
<body style="background-color: #f1f5f9; display: flex; flex-direction: column; align-items: center; padding: 25px; min-height: 100vh;">
    
    <div class="no-print" style="display: flex; justify-content: space-between; align-items: center; background-color: #ecfdf5; border: 1px solid #a7f3d0; padding: 12px 20px; border-radius: 12px; margin-bottom: 25px; width: 100%; max-width: 800px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);">
        <span style="font-size: 14px; font-weight: 700; color: #065f46;">Monthly Transaction and Ledger Summary Report Preview</span>
        <div style="display: flex; gap: 8px;">
            <button onclick="window.print()" style="background-color: #059669; color: #ffffff; font-weight: 700; font-size: 12px; padding: 6px 14px; border: none; border-radius: 8px; cursor: pointer;">🖨️ Print</button>
            <button onclick="window.close()" style="background-color: #ffffff; color: #475569; border: 1px solid #cbd5e1; font-weight: 700; font-size: 12px; padding: 6px 14px; border-radius: 8px; cursor: pointer;">Close</button>
        </div>
    </div>

    <div class="report-container">
        <div class="header-section">
            <h1 class="brand-title">TITAS ISP SYSTEM</h1>
            <p class="brand-subtitle">Titas Internet - Accounts Dept</p>
            <div class="report-tag">Monthly Summary Report (${currentMonthNameEnglish} ${currentYear})</div>
        </div>
        
        <div class="meta-grid">
            <div class="meta-item">
                <span class="meta-label">Report Month</span>
                <span class="meta-value" style="color: #4f46e5;">${currentMonthNameEnglish} - ${currentYear}</span>
            </div>
            <div class="meta-item">
                <span class="meta-label">Print Timestamp</span>
                <span class="meta-value font-sans" style="font-size: 12px; color: #64748b;">${new Date().toLocaleString('en-US', { hour12: true })}</span>
            </div>
            <div class="meta-item">
                <span class="meta-label">Total Transactions</span>
                <span class="meta-value">${sortedTx.length} items</span>
            </div>
            <div class="meta-item">
                <span class="meta-label">Authority</span>
                <span class="meta-value">Titas Internet System</span>
            </div>
        </div>

        <div class="stats-grid">
            <div class="stat-card income">
                <span class="stat-label">Total Receipts (+)</span>
                <span class="stat-value">BDT ${totalIncome.toLocaleString('en-US')}</span>
            </div>
            <div class="stat-card expense">
                <span class="stat-label">Total Expenses (-)</span>
                <span class="stat-value">BDT ${totalExpense.toLocaleString('en-US')}</span>
            </div>
            <div class="stat-card balance">
                <span class="stat-label">Net Balance (=)</span>
                <span class="stat-value">BDT ${netBalance.toLocaleString('en-US')}</span>
            </div>
        </div>

        <div class="section-title">📊 Category-wise Summary</div>
        <table class="summary-table">
            <thead>
                <tr>
                    <th style="text-align: left; width: 40%;">Category</th>
                    <th style="text-align: right; width: 30%;">Total Income</th>
                    <th style="text-align: right; width: 30%;">Total Expense</th>
                </tr>
            </thead>
            <tbody>
                ${categorySummaryList.length === 0 ? `
                <tr>
                    <td colspan="3" style="text-align: center; color: #64748b; font-weight: 500; padding: 24px 0;">No category-wise transactions found for this month.</td>
                </tr>
                ` : categorySummaryList.map(item => `
                <tr>
                    <td style="font-weight: 600; color: #0f172a;">${item.category}</td>
                    <td style="text-align: right; font-weight: 700; color: #15803d; font-family: sans-serif;">BDT ${item.income.toLocaleString('en-US')}</td>
                    <td style="text-align: right; font-weight: 700; color: #b91c1c; font-family: sans-serif;">BDT ${item.expense.toLocaleString('en-US')}</td>
                </tr>
                `).join('')}
            </tbody>
        </table>

        <div class="section-title">📝 Detailed Ledger List</div>
        <table class="summary-table">
            <thead>
                <tr>
                    <th style="text-align: center; width: 15%;">Date</th>
                    <th style="text-align: left; width: 45%;">Particulars / Title</th>
                    <th style="text-align: center; width: 15%;">Type</th>
                    <th style="text-align: right; width: 25%;">Amount</th>
                </tr>
            </thead>
            <tbody>
                ${sortedTx.length === 0 ? `
                <tr>
                    <td colspan="4" style="text-align: center; color: #64748b; font-weight: 500; padding: 24px 0;">No transaction records for this month.</td>
                </tr>
                ` : sortedTx.map(t => {
                  const isInc = t.type === 'income';
                  const pMethod = t.paymentMethod ? ` [${t.paymentMethod}]` : '';
                  return `
                <tr>
                    <td style="text-align: center; color: #475569; font-weight: 500; font-family: sans-serif;">${t.date}</td>
                    <td>
                        <div style="font-weight: 700; color: #0f172a;">${t.title}</div>
                        <div style="font-size: 10px; color: #64748b; margin-top: 2px;">Category: ${ALL_CATEGORY_LABELS[t.category]?.label || t.category}${pMethod}</div>
                    </td>
                    <td style="text-align: center;">
                        <span style="font-weight: 700; padding: 2px 8px; border-radius: 4px; font-size: 10px; display: inline-block; ${isInc ? 'background-color: #d1fae5; color: #15803d;' : 'background-color: #fee2e2; color: #b91c1c;'}">${isInc ? 'Income' : 'Expense'}</span>
                    </td>
                    <td style="text-align: right; font-weight: 700; color: ${isInc ? '#15803d' : '#b91c1c'}; font-family: sans-serif;">${isInc ? '+' : '-'} BDT ${t.amount.toLocaleString('en-US')}</td>
                </tr>
                  `;
                }).join('')}
            </tbody>
        </table>

        <div class="signature-footer">
            <div class="signature-line">
                <div class="signature-line-placeholder"></div>
                <span>Prepared By / Accountant</span>
            </div>
            <div class="signature-line">
                <div class="signature-line-placeholder"></div>
                <span>Verified Officer</span>
            </div>
            <div class="signature-line">
                <div class="signature-line-placeholder"></div>
                <span>Authorized Signature</span>
            </div>
        </div>
    </div>
</body>
</html>`;

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Please disable your browser popup blocker and try again.');
      return;
    }
    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };


  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">
        <div>
          <h3 className="text-xl font-bold text-slate-800">Transaction History</h3>
          <p className="text-sm text-slate-400 mt-1">Comprehensive ledger of all recorded income and expenses</p>
        </div>
 
        {/* Filters and Controls */}
        <div className="flex flex-wrap gap-2 text-xs items-center">
          {onDeleteAllTransactions && transactions.length > 0 && (
            <button
              onClick={onDeleteAllTransactions}
              title="Delete all transactions and reset balance"
              className="flex items-center gap-1.5 px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-xl text-xs font-black shadow-sm transition-all cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5 text-rose-500" />
              Clear All Records
            </button>
          )}
 
          {/* Download PDF report button */}
          <button
            onClick={handleDownloadPDF}
            title="Download PDF report for current filtered ledger"
            className="flex items-center gap-1.5 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-sm hover:shadow transition-all cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-indigo-100" />
            Download PDF Report
          </button>
 
          {/* Monthly Transaction Summary direct Print button */}
          <button
            onClick={handlePrintCurrentMonthSummary}
            title="Print transaction summary for the current month"
            className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-sm hover:shadow transition-all cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5 text-emerald-100" />
            Current Month Summary (Print)
          </button>

          {/* Export CSV button */}
          <button
            onClick={handleExportCSV}
            title="Export filtered transactions as CSV"
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold shadow-sm hover:shadow transition-all cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-slate-300" />
            Export CSV
          </button>
 
          {/* Reset Filters button */}
          {(searchTerm || typeFilter !== 'all' || categoryFilter !== 'all' || sortOrder !== 'newest' || quickDateFilter !== 'all' || startDate || endDate) && (
            <button
              onClick={resetFilters}
              className="flex items-center gap-1.5 px-3 py-2 bg-rose-50 text-rose-600 rounded-xl text-xs font-semibold hover:bg-rose-100 transition-colors cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
              Clear Filters
            </button>
          )}
 
          {/* Type Switcher */}
          <div className="bg-slate-100 p-0.5 rounded-xl flex border border-slate-200/50">
            <button
              onClick={() => { setTypeFilter('all'); setCategoryFilter('all'); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                typeFilter === 'all' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
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
 
      {/* Inputs block */}
      <div className="space-y-3 bg-slate-50 p-4 rounded-xl mb-5 border border-slate-200/50 shadow-inner">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Search */}
          <div className="relative">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1 block">Global Search</label>
            <div className="relative">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search by description or notes..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 bg-white text-slate-800 font-medium"
              />
            </div>
          </div>

          {/* Category Dropdown */}
          <div className="relative">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1 block">Global Category Filter</label>
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
                  {Object.entries(INCOME_CATEGORY_LABELS).map(([key, item]) => (
                    <option key={key} value={key}>
                      {item.label}
                    </option>
                  ))}
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
              <option value="custom">Custom Date Range</option>
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-400">
              <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/>
              </svg>
            </div>
          </div>

          {/* Sort Filter */}
          <div className="relative">
            <Calendar className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
            <select
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value as any)}
              className="w-full pl-9 pr-8 py-2 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 bg-white text-slate-700 font-medium appearance-none cursor-pointer"
            >
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
              <option value="amount-desc">Amount: High to Low</option>
              <option value="amount-asc">Amount: Low to High</option>
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-400">
              <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/>
              </svg>
            </div>
          </div>
        </div>

        {/* Custom Start/End Date Range fields (Only show if quickDateFilter is 'custom') */}
        {quickDateFilter === 'custom' && (
          <div className="pt-2.5 border-t border-slate-200/60 flex flex-wrap items-center gap-4 animate-fadeIn">
            <span className="text-[11px] font-bold text-indigo-700 bg-indigo-50/80 px-2.5 py-1 rounded-md border border-indigo-100/50">📅 Select Custom Date Range:</span>
            
            <div className="flex items-center gap-2">
              <label className="text-[11px] font-bold text-slate-500">Start Date:</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 font-semibold text-slate-700 bg-white cursor-pointer"
              />
            </div>

            <div className="flex items-center gap-2">
              <label className="text-[11px] font-bold text-slate-500">End Date:</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 font-semibold text-slate-700 bg-white cursor-pointer"
              />
            </div>
          </div>
        )}
      </div>

      {/* Transactions Container */}
      <div className="overflow-x-auto">
        {sortedTransactions.length > 0 ? (
          <table className="w-full min-w-[1100px] text-left">
            <thead>
              <tr className="border-b border-slate-100 text-[13px] text-slate-400 font-bold">
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">Transaction Details / Voucher ID</th>
                <th className="py-3 px-4">Client ID / Voucher Creator</th>
                <th className="py-3 px-4">Collector Name / Approver</th>
                <th className="py-3 px-4">Office Collector Name</th>
                <th className="py-3 px-4">Payment Method</th>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4">Type</th>
                <th className="py-3 px-4 text-right">Amount</th>
                <th className="py-3 px-4 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sortedTransactions.map((t) => {
                const isIncome = t.type === 'income';
                const labelObj = ALL_CATEGORY_LABELS[t.category] || { label: t.category, color: 'bg-emerald-500', icon: 'Coins' };
                const isVoucher = isVoucherTx(t.title);
                
                return (
                  <tr key={t.id} className="hover:bg-slate-50/50 group transition-colors">
                    {/* Date Column */}
                    <td className="py-3.5 px-4 text-xs font-mono text-slate-500 whitespace-nowrap">
                      {formatDate(t.date)}
                    </td>
 
                    {/* Title & Notes */}
                    <td className="py-3.5 px-4 min-w-[200px]">
                      <div>
                        {isVoucher ? (
                          <span className="text-slate-800 text-sm font-semibold block">{extractVoucherId(t.title)}</span>
                        ) : (
                          <div>
                            <span className="text-slate-800 text-sm font-semibold block">{extractClientName(t.title)}</span>
                            {t.billingMonth && (
                              <span className="inline-block mt-1 text-[10px] bg-indigo-50 text-indigo-700 font-bold px-1.5 py-0.5 rounded">
                                🌙 Billing Month: {t.billingMonth}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </td>
 
                    {/* Client ID / Voucher Creator */}
                    <td className="py-3.5 px-4 text-xs font-mono font-bold text-indigo-600 whitespace-nowrap">
                      {isVoucher ? extractVoucherCreator(t) : (t.clientId || '-')}
                    </td>
 
                    {/* Collector Name / Approver */}
                    <td className="py-3.5 px-4 text-xs font-semibold text-slate-700 whitespace-nowrap">
                      {isVoucher ? extractApproverName(t.notes) : (t.collectorName || t.receivedBy || '-')}
                    </td>
 
                    {/* Office Collector Name */}
                    <td className="py-3.5 px-4 text-xs font-semibold text-slate-600 whitespace-nowrap">
                      {isVoucher ? '-' : (t.receiverName || '-')}
                    </td>

                    {/* Payment Method Logo & Name */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      {t.paymentMethod ? (
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200/50">
                          <PaymentMethodLogo method={t.paymentMethod} className="w-3.5 h-3.5" />
                          {t.paymentMethod === 'Cash' ? 'Cash' :
                           t.paymentMethod === 'bKash' ? 'bKash' :
                           t.paymentMethod === 'Nagad' ? 'Nagad' :
                           t.paymentMethod === 'Rocket' ? 'Rocket' :
                           t.paymentMethod === 'Bank' ? 'Bank' : 
                           t.paymentMethod === 'SSLCommerz' ? 'SSLCommerz' : t.paymentMethod}
                        </span>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </td>

                    {/* Category Label with Color Dot */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1.5 text-xs">
                        <span className={`w-2.5 h-2.5 rounded-full ${labelObj.color}`}></span>
                        <span className="text-slate-600 font-medium">{labelObj.label}</span>
                      </span>
                    </td>

                    {/* Dynamic Badges */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      {isIncome ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 text-emerald-700 text-xs rounded-full font-bold">
                          <ArrowUpRight className="w-3.5 h-3.5" />
                          Income
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-rose-50 text-rose-700 text-xs rounded-full font-bold">
                          <ArrowDownRight className="w-3.5 h-3.5" />
                          Expense
                        </span>
                      )}
                    </td>

                    {/* Amount formatted */}
                    <td className={`py-3.5 px-4 text-right font-bold text-sm font-mono whitespace-nowrap ${
                      isIncome ? 'text-emerald-600' : 'text-rose-600'
                    }`}>
                      {formatAmount(t.amount, t.type)}
                    </td>

                    {/* Actions collated button */}
                    <td className="py-3.5 px-4 text-center whitespace-nowrap">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => handlePrintSingleReceipt(t)}
                          title="Print Receipt"
                          className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all cursor-pointer"
                        >
                          <Printer className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => onDeleteTransaction(t.id)}
                          title="Delete"
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <div className="text-center py-12 px-4">
            <div className="inline-flex p-3 bg-slate-50 text-slate-400 rounded-full mb-3">
              <EyeOff className="w-6 h-6" />
            </div>
            <p className="text-slate-500 font-semibold mb-1">No transactions found.</p>
            <p className="text-slate-400 text-xs text-center max-w-sm mx-auto">
              There are no transactions matching your active filters, or you haven't recorded any transactions yet.
            </p>
          </div>
        )}
      </div>

      {/* Footer statistics statement */}
      {sortedTransactions.length > 0 && (
        <div className="flex justify-between items-center mt-5 text-xs text-slate-400 px-2 pt-4 border-t border-slate-50 font-mono">
          <span>Total Transactions: {sortedTransactions.length}</span>
          <span>All financial ledger records are securely synchronized</span>
        </div>
      )}

      {/* PDF Download Parametric configuration Modal Overlay */}
      {isDownloadModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fadeIn" id="pdf-download-modal">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100 flex flex-col gap-4">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg">
                  <Download className="w-5 h-5 font-bold" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-800">Export PDF Report</h4>
                  <p className="text-[11px] text-slate-400 font-semibold">Customize transaction ledger PDF export</p>
                </div>
              </div>
              <button
                onClick={() => setIsDownloadModalOpen(false)}
                className="p-1 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 transition"
                id="close-pdf-modal"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Form Fields */}
            <div className="space-y-4 text-left">
              {/* 1. Transaction Type */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 text-left">
                  📁 Transaction Type
                </label>
                <select
                  value={downloadTypeFilter}
                  onChange={(e) => setDownloadTypeFilter(e.target.value as any)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white text-slate-800 font-semibold cursor-pointer"
                >
                  <option value="all">All Transactions</option>
                  <option value="income">Income Only</option>
                  <option value="expense">Expenses Only</option>
                </select>
              </div>

              {/* 2. Download Range Option */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 text-left">
                  📅 Timeframe
                </label>
                <select
                  value={downloadRangeType}
                  onChange={(e) => {
                    const val = e.target.value as any;
                    setDownloadRangeType(val);
                    if (val !== 'custom') {
                      setDownloadStartDate('');
                      setDownloadEndDate('');
                    }
                  }}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white text-slate-800 font-semibold cursor-pointer"
                >
                  <option value="all">All Time</option>
                  <option value="today">Today</option>
                  <option value="this-month">This Month</option>
                  <option value="last-month">Last Month</option>
                  <option value="custom">Custom Date-to-Date</option>
                </select>
              </div>

              {/* 3. Custom Date Range inputs (Only when rangeType is 'custom') */}
              {downloadRangeType === 'custom' && (
                <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 border border-slate-150 rounded-xl animate-fadeIn">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 mb-1">📅 Start Date:</label>
                    <input
                      type="date"
                      value={downloadStartDate}
                      onChange={(e) => setDownloadStartDate(e.target.value)}
                      className="w-full px-2.5 py-1.5 border border-slate-200 rounded-md text-xs font-semibold text-slate-700 bg-white cursor-pointer"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 mb-1">📅 End Date:</label>
                    <input
                      type="date"
                      value={downloadEndDate}
                      onChange={(e) => setDownloadEndDate(e.target.value)}
                      className="w-full px-2.5 py-1.5 border border-slate-200 rounded-md text-xs font-semibold text-slate-700 bg-white cursor-pointer"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* CTA Actions */}
            <div className="flex gap-2.5 pt-3 border-t border-slate-100">
              <button
                onClick={() => setIsDownloadModalOpen(false)}
                className="flex-1 py-2 border border-slate-200 rounded-xl hover:bg-slate-50 text-slate-600 font-semibold text-xs transition cursor-pointer text-center"
                id="cancel-report-btn"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  handleDownloadPDFWithParams(downloadTypeFilter, downloadRangeType, downloadStartDate, downloadEndDate);
                  setIsDownloadModalOpen(false);
                }}
                className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-xs transition cursor-pointer shadow-sm text-center flex items-center justify-center gap-1"
                id="generate-report-btn"
              >
                <Download className="w-3.5 h-3.5" />
                Download PDF
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
