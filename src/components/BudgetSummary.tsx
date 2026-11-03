/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { 
  TrendingUp, 
  TrendingDown, 
  Wallet,
  ArrowUpRight,
  ArrowDownRight,
  Users,
  Globe
} from 'lucide-react';
import { Transaction } from '../types';

interface BudgetSummaryProps {
  transactions: Transaction[];
  resellers?: any[];
  allTransactions?: Transaction[];
}

export function BudgetSummary({ transactions, resellers = [], allTransactions = [] }: BudgetSummaryProps) {
  // Calculate Totals
  const totalIncome = transactions
    .filter(t => t.type === 'income')
    .reduce((sum, t) => sum + t.amount, 0);

  const totalExpense = transactions
    .filter(t => t.type === 'expense')
    .reduce((sum, t) => sum + t.amount, 0);

  const netBalance = totalIncome - totalExpense;
  const isPositive = netBalance >= 0;

  // Formatting helpers in English digits
  const formatAmount = (num: number) => {
    return '৳ ' + num.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  };

  // Expense ratio of Income
  const expensePercentage = totalIncome > 0 ? Math.min(100, Math.round((totalExpense / totalIncome) * 100)) : 0;

  // Filter home user transactions from allTransactions
  const homeUserBills = React.useMemo(() => {
    return allTransactions.filter(t => {
      const isDailyClosing = t.isDailyClosing === true || 
        (t.notes && (t.notes.includes('Daily Closing entry statement:') || t.notes.includes('Daily Closing expense statement:')));
      if (isDailyClosing) return false;
      return (
        t.category === 'customer_bill' || 
        !!t.clientId || 
        (t.title && (t.title.includes('হোম ইউজার') || t.title.includes('Home Subscriber'))) ||
        (t.notes && (t.notes.includes('ম্যানুয়াল বিল জমা') || t.notes.includes('Manual bill collection')))
      );
    });
  }, [allTransactions]);

  // Unique Home Users
  const uniqueHomeUsers = React.useMemo(() => {
    const clients = new Set<string>();
    homeUserBills.forEach(t => {
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
  }, [homeUserBills]);

  // Running month prefix (YYYY-MM)
  const runningMonthStr = React.useMemo(() => {
    const today = new Date();
    const currentYear = today.getFullYear();
    const currentMonthNum = today.getMonth() + 1;
    return `${currentYear}-${String(currentMonthNum).padStart(2, '0')}`;
  }, []);

  // Home user collection amount for the current running month
  const homeUserCollectedThisMonth = React.useMemo(() => {
    return homeUserBills
      .filter(t => t.status === 'approved' && t.date && t.date.startsWith(runningMonthStr))
      .reduce((sum, t) => sum + t.amount, 0);
  }, [homeUserBills, runningMonthStr]);

  // Resellers metrics
  const totalResellers = resellers.length;
  const totalResellersDue = React.useMemo(() => {
    return resellers.reduce((sum, r) => sum + (r.totalDue || 0), 0);
  }, [resellers]);

  // Resellers collection amount for the current running month
  const resellerCollectedThisMonth = React.useMemo(() => {
    const resellerBills = allTransactions.filter(t => {
      const isDailyClosing = t.isDailyClosing === true || 
        (t.notes && (t.notes.includes('Daily Closing entry statement:') || t.notes.includes('Daily Closing expense statement:')));
      if (isDailyClosing) return false;
      return (
        t.category === 'reseller_bill' || 
        (t.title && (t.title.includes('Reseller') || t.title.includes('রিসেলার'))) ||
        (t.notes && (t.notes.includes('Reseller') || t.notes.includes('রিসেলার')))
      );
    });
    return resellerBills
      .filter(t => t.type === 'income' && t.date && t.date.startsWith(runningMonthStr))
      .reduce((sum, t) => sum + t.amount, 0);
  }, [allTransactions, runningMonthStr]);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
      {/* Total Income Card */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 hover:shadow transition-all duration-300 relative overflow-hidden group">
        <div className="flex justify-between items-start relative z-10 h-full flex-col">
          <div className="w-full flex justify-between items-center mb-3">
            <p className="text-slate-500 text-[10px] font-bold uppercase tracking-wider">Total Income</p>
            <div className="p-1.5 bg-emerald-50 rounded-lg text-emerald-600">
              <TrendingUp className="w-3.5 h-3.5" />
            </div>
          </div>
          <div>
            <h3 className="text-lg font-black text-emerald-600 font-mono tracking-tight">
              {formatAmount(totalIncome)}
            </h3>
            <p className="text-[9px] text-slate-400 mt-0.5 flex items-center gap-1 font-semibold">
              <span className="flex items-center gap-0.5 text-emerald-600 bg-emerald-50 px-1 py-0.5 rounded font-bold font-mono">
                {transactions.filter(t => t.type === 'income').length}
              </span>
              TX Entries
            </p>
          </div>
        </div>
      </div>

      {/* Total Expense Card */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 hover:shadow transition-all duration-300 relative overflow-hidden group">
        <div className="flex justify-between items-start relative z-10 h-full flex-col">
          <div className="w-full flex justify-between items-center mb-3">
            <p className="text-slate-500 text-[10px] font-bold uppercase tracking-wider">Total Expense</p>
            <div className="p-1.5 bg-rose-50 rounded-lg text-rose-600">
              <TrendingDown className="w-3.5 h-3.5" />
            </div>
          </div>
          <div>
            <h3 className="text-lg font-black text-rose-600 font-mono tracking-tight">
              {formatAmount(totalExpense)}
            </h3>
            <p className="text-[9px] text-slate-400 mt-0.5 flex items-center gap-1 font-semibold">
              <span className="flex items-center gap-0.5 text-rose-600 bg-rose-50 px-1 py-0.5 rounded font-bold font-mono">
                {transactions.filter(t => t.type === 'expense').length}
              </span>
              TX Entries
            </p>
          </div>
        </div>
      </div>

      {/* Net Balance Card */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 hover:shadow transition-all duration-300 relative overflow-hidden group">
        <div className="flex justify-between items-start relative z-10 h-full flex-col">
          <div className="w-full flex justify-between items-center mb-3">
            <p className="text-slate-500 text-[10px] font-bold uppercase tracking-wider">Net Balance</p>
            <div className={`p-1.5 rounded-lg ${isPositive ? 'bg-blue-50 text-blue-600' : 'bg-rose-50 text-rose-700'}`}>
              <Wallet className="w-3.5 h-3.5" />
            </div>
          </div>
          <div>
            <h3 className={`text-lg font-black font-mono tracking-tight ${isPositive ? 'text-blue-600' : 'text-rose-700'}`}>
              {formatAmount(netBalance)}
            </h3>
            <div className="mt-1">
              <p className="text-[9px] mb-0.5 font-bold text-slate-400">
                <span>Usage: {expensePercentage}%</span>
              </p>
              <div className="w-full h-1 bg-slate-100 rounded-full overflow-hidden">
                <div 
                  className={`h-full rounded-full transition-all duration-500 ${expensePercentage > 85 ? 'bg-amber-500' : 'bg-blue-500'}`}
                  style={{ width: `${expensePercentage}%` }}
                ></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Home Subscribers Card */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 hover:shadow transition-all duration-300 relative overflow-hidden group">
        <div className="flex justify-between items-start relative z-10 h-full flex-col">
          <div className="w-full flex justify-between items-center mb-3">
            <p className="text-slate-500 text-[10px] font-bold uppercase tracking-wider">Home Subscribers</p>
            <div className="p-1.5 bg-amber-50 rounded-lg text-amber-600">
              <Users className="w-3.5 h-3.5" />
            </div>
          </div>
          <div>
            <h3 className="text-lg font-black text-amber-600 font-mono tracking-tight">
              {uniqueHomeUsers} <span className="text-[10px] font-bold text-slate-500 font-sans">Clients</span>
            </h3>
            <div className="mt-1 space-y-0.5">
              <p className="text-[9px] text-slate-500 flex justify-between items-center font-semibold">
                <span>Month Collection:</span>
                <span className="font-bold text-emerald-600 font-mono">৳ {homeUserCollectedThisMonth.toLocaleString()}</span>
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Zone Resellers Card */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 hover:shadow transition-all duration-300 relative overflow-hidden group">
        <div className="flex justify-between items-start relative z-10 h-full flex-col">
          <div className="w-full flex justify-between items-center mb-3">
            <p className="text-slate-500 text-[10px] font-bold uppercase tracking-wider">Zone Resellers</p>
            <div className="p-1.5 bg-cyan-50 rounded-lg text-cyan-600">
              <Globe className="w-3.5 h-3.5" />
            </div>
          </div>
          <div>
            <h3 className="text-lg font-black text-cyan-600 font-mono tracking-tight">
              {totalResellers} <span className="text-[10px] font-bold text-slate-500 font-sans">Resellers</span>
            </h3>
            <div className="mt-1 space-y-0.5">
              <p className="text-[9px] text-slate-500 flex justify-between items-center font-semibold gap-3">
                <span>Month Collection:</span>
                <span className="font-bold text-emerald-600 font-mono">৳ {resellerCollectedThisMonth.toLocaleString()}</span>
              </p>
              <p className="text-[9px] text-slate-400 flex justify-between items-center font-semibold gap-3">
                <span>Total Due:</span>
                <span className="font-bold text-rose-500 font-mono">৳ {totalResellersDue.toLocaleString()}</span>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
