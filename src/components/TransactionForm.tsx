/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  PlusCircle, 
  Tag, 
  Calendar, 
  ArrowUpRight, 
  ArrowDownRight,
  FileText
} from 'lucide-react';
import { 
  Transaction, 
  TransactionType, 
  TransactionCategory,
  INCOME_CATEGORY_LABELS, 
  EXPENSE_CATEGORY_LABELS 
} from '../types';

interface TransactionFormProps {
  onAddTransaction: (transaction: Omit<Transaction, 'id'>) => void;
}

export function TransactionForm({ onAddTransaction }: TransactionFormProps) {
  const [type, setType] = useState<TransactionType>('expense');
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState<TransactionCategory>('office_expense');
  const [date, setDate] = useState(() => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  });
  const [notes, setNotes] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [receivedBy, setReceivedBy] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Update default category when transaction type changes
  useEffect(() => {
    if (type === 'income') {
      setCategory('customer_bill');
    } else {
      setCategory('office_expense');
    }
  }, [type]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    // Field validations
    if (!title.trim()) {
      setErrorMsg('Please enter a description or title for this transaction.');
      return;
    }

    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setErrorMsg('Please enter a valid amount greater than zero.');
      return;
    }

    if (!category) {
      setErrorMsg('Please select a valid transaction category.');
      return;
    }

    if (!date) {
      setErrorMsg('Please select the transaction date.');
      return;
    }

    // Call callback to add transaction
    onAddTransaction({
      type,
      title: title.trim(),
      amount: parsedAmount,
      category,
      date,
      paymentMethod: paymentMethod || undefined,
      receivedBy: receivedBy.trim() || undefined,
      receivedDate: date,
      notes: notes.trim() || undefined,
    });

    // Reset Form fields safely
    setTitle('');
    setAmount('');
    setNotes('');
    setPaymentMethod('');
    setReceivedBy('');
    setErrorMsg('');
  };

  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
      <h3 className="text-xl font-bold text-slate-800 mb-5 flex items-center gap-2">
        <span className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg">
          <PlusCircle className="w-5 h-5" />
        </span>
        Add New Transaction
      </h3>

      <form onSubmit={handleSubmit} className="space-y-4 font-sans text-xs">
        {/* Toggle between Income and Expense */}
        <div className="grid grid-cols-2 gap-3 p-1 bg-slate-100 rounded-xl">
          <button
            type="button"
            onClick={() => setType('expense')}
            className={`py-2.5 px-4 rounded-lg font-semibold flex items-center justify-center gap-2 transition-all ${
              type === 'expense'
                ? 'bg-rose-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-800'
            }`}
          >
            <ArrowDownRight className="w-4 h-4" />
            Expense
          </button>
          <button
            type="button"
            onClick={() => setType('income')}
            className={`py-2.5 px-4 rounded-lg font-semibold flex items-center justify-center gap-2 transition-all ${
              type === 'income'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-800'
            }`}
          >
            <ArrowUpRight className="w-4 h-4" />
            Income
          </button>
        </div>

        {/* Transaction Title */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center gap-1">
            Transaction Title / Description <span className="text-rose-500">*</span>
          </label>
          <input
            type="text"
            placeholder="e.g., Office lunch, Freelance gig, Bandwidth bill"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-slate-800 transition-all text-xs font-semibold"
          />
        </div>

        {/* Amount and Date row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Amount input */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center gap-1">
              Amount (BDT) <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <span className="absolute left-4 top-2.5 text-slate-400 font-semibold font-mono">৳</span>
              <input
                type="number"
                step="any"
                min="0.01"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full pl-8 pr-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-slate-800 font-mono text-xs font-bold"
              />
            </div>
          </div>

          {/* Date Picker */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center gap-1">
              Transaction Date <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <Calendar className="absolute left-4 top-3 w-4 h-4 text-slate-400" />
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-slate-800 text-xs font-mono font-bold cursor-pointer"
              />
            </div>
          </div>
        </div>

        {/* Categories Select */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center gap-1">
            Category <span className="text-rose-500">*</span>
          </label>
          <div className="relative">
            <Tag className="absolute left-4 top-3 w-4 h-4 text-slate-400" />
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as TransactionCategory)}
              className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-slate-800 text-xs bg-white cursor-pointer font-bold"
            >
              {type === 'income' ? (
                Object.entries(INCOME_CATEGORY_LABELS).map(([key, item]) => (
                  <option key={key} value={key}>
                    {item.label}
                  </option>
                ))
              ) : (
                Object.entries(EXPENSE_CATEGORY_LABELS).map(([key, item]) => (
                  <option key={key} value={key}>
                    {item.label}
                  </option>
                ))
              )}
            </select>
          </div>
        </div>

        {/* Payment Method Selector (Optional) */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center gap-1">
            Payment Method (Optional)
          </label>
          <div className="relative">
            <span className="absolute left-4 top-3 text-slate-400 font-bold text-xs">💳</span>
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-slate-800 text-xs bg-white cursor-pointer font-bold"
            >
              <option value="">Select Method (Optional)</option>
              <option value="Cash">💵 Cash</option>
              <option value="bKash">📱 bKash</option>
              <option value="Nagad">📱 Nagad</option>
              <option value="Rocket">📱 Rocket</option>
              <option value="Bank">🏦 Bank Transfer</option>
              <option value="SSLCommerz">💳 SSLCommerz</option>
            </select>
          </div>
        </div>

        {/* Bill Collector / Employee Name (Optional) */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center gap-1">
            Collected / Spent By (Employee Name) - Optional
          </label>
          <div className="relative">
            <span className="absolute left-4 top-3 text-slate-400 font-bold text-xs">👤</span>
            <input
              type="text"
              placeholder="e.g., Sakib Hasan, Javed Ahmad"
              value={receivedBy}
              onChange={(e) => setReceivedBy(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-slate-800 text-xs font-semibold"
            />
          </div>
        </div>

        {/* Short Notes (Optional) */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center gap-1">
            Additional Notes (Optional)
          </label>
          <div className="relative">
            <FileText className="absolute left-4 top-3 w-4 h-4 text-slate-400" />
            <textarea
              rows={2}
              placeholder="Provide any extra details here..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-slate-800 text-xs font-semibold"
            />
          </div>
        </div>

        {/* Error message show */}
        {errorMsg && (
          <p className="text-xs text-rose-500 bg-rose-50 p-2.5 rounded-lg border border-rose-100 font-medium">
            ⚠️ {errorMsg}
          </p>
        )}

        {/* Submit Button */}
        <button
          type="submit"
          className="w-full mt-2 bg-slate-900 text-white font-bold py-3 px-4 rounded-xl hover:bg-indigo-600 transition-colors duration-300 shadow-sm flex items-center justify-center gap-2 cursor-pointer text-xs uppercase tracking-wider"
        >
          <PlusCircle className="w-5 h-5" />
          Save Transaction
        </button>
      </form>
    </div>
  );
}
