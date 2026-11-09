/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { 
  TrendingUp, 
  TrendingDown, 
  Wallet,
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

  // Formatting helpers in English digits with ৳ prefix
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
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
      {/* 1. Total Income Card */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 hover:shadow-md transition-all duration-300 relative overflow-hidden group flex flex-col justify-between min-h-[145px]">
        {/* Soft background glow */}
        <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-50/70 rounded-full -mr-8 -mt-8 pointer-events-none group-hover:scale-110 transition-transform duration-300"></div>
        
        <div className="flex justify-between items-center relative z-10 mb-2">
          <p className="text-slate-500 text-[11px] font-bold uppercase tracking-wider">TOTAL INCOME</p>
          <div className="p-2 bg-emerald-50 rounded-xl text-emerald-500 shadow-xs">
            <TrendingUp className="w-4 h-4" />
          </div>
        </div>

        <div className="relative z-10">
          <h3 className="text-2xl font-black text-emerald-500 tracking-tight font-sans">
            {formatAmount(totalIncome)}
          </h3>
          <p className="text-[11px] text-slate-400 mt-1 flex items-center gap-1.5 font-medium">
            <span className="px-1.5 py-0.5 rounded bg-emerald-100/80 text-emerald-700 text-[10px] font-bold font-mono">
              {transactions.filter(t => t.type === 'income').length}
            </span>
            <span>TX Entries</span>
          </p>
        </div>
      </div>

      {/* 2. Total Expense Card */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 hover:shadow-md transition-all duration-300 relative overflow-hidden group flex flex-col justify-between min-h-[145px]">
        {/* Soft background glow */}
        <div className="absolute top-0 right-0 w-24 h-24 bg-rose-50/70 rounded-full -mr-8 -mt-8 pointer-events-none group-hover:scale-110 transition-transform duration-300"></div>

        <div className="flex justify-between items-center relative z-10 mb-2">
          <p className="text-slate-500 text-[11px] font-bold uppercase tracking-wider">TOTAL EXPENSE</p>
          <div className="p-2 bg-rose-50 rounded-xl text-rose-500 shadow-xs">
            <TrendingDown className="w-4 h-4" />
          </div>
        </div>

        <div className="relative z-10">
          <h3 className="text-2xl font-black text-rose-500 tracking-tight font-sans">
            {formatAmount(totalExpense)}
          </h3>
          <p className="text-[11px] text-slate-400 mt-1 flex items-center gap-1.5 font-medium">
            <span className="px-1.5 py-0.5 rounded bg-rose-100/80 text-rose-700 text-[10px] font-bold font-mono">
              {transactions.filter(t => t.type === 'expense').length}
            </span>
            <span>TX Entries</span>
          </p>
        </div>
      </div>

      {/* 3. Net Balance Card */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 hover:shadow-md transition-all duration-300 relative overflow-hidden group flex flex-col justify-between min-h-[145px]">
        {/* Soft background glow */}
        <div className="absolute top-0 right-0 w-24 h-24 bg-blue-50/70 rounded-full -mr-8 -mt-8 pointer-events-none group-hover:scale-110 transition-transform duration-300"></div>

        <div className="flex justify-between items-center relative z-10 mb-2">
          <p className="text-slate-500 text-[11px] font-bold uppercase tracking-wider">NET BALANCE</p>
          <div className={`p-2 rounded-xl shadow-xs ${isPositive ? 'bg-blue-50 text-blue-500' : 'bg-rose-50 text-rose-500'}`}>
            <Wallet className="w-4 h-4" />
          </div>
        </div>

        <div className="relative z-10">
          <h3 className={`text-2xl font-black tracking-tight font-sans ${isPositive ? 'text-blue-600' : 'text-rose-600'}`}>
            {formatAmount(netBalance)}
          </h3>
          <div className="mt-1">
            <p className="text-[10px] font-semibold text-slate-400">
              Usage: {expensePercentage}%
            </p>
            <div className="w-full h-1 bg-slate-100 rounded-full overflow-hidden mt-1.5">
              <div 
                className={`h-full rounded-full transition-all duration-500 ${expensePercentage > 85 ? 'bg-amber-500' : 'bg-blue-500'}`}
                style={{ width: `${expensePercentage}%` }}
              ></div>
            </div>
          </div>
        </div>
      </div>

      {/* 4. Home Subscribers Card */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 hover:shadow-md transition-all duration-300 relative overflow-hidden group flex flex-col justify-between min-h-[145px]">
        {/* Soft background glow */}
        <div className="absolute top-0 right-0 w-24 h-24 bg-amber-50/70 rounded-full -mr-8 -mt-8 pointer-events-none group-hover:scale-110 transition-transform duration-300"></div>

        <div className="flex justify-between items-center relative z-10 mb-2">
          <p className="text-slate-500 text-[11px] font-bold uppercase tracking-wider">HOME SUBSCRIBERS</p>
          <div className="p-2 bg-amber-50 rounded-xl text-amber-500 shadow-xs">
            <Users className="w-4 h-4" />
          </div>
        </div>

        <div className="relative z-10">
          <div className="flex items-center gap-1.5 mb-1">
            <span className="px-1.5 py-0.5 rounded bg-amber-100/80 text-amber-800 text-xs font-bold font-mono">
              {uniqueHomeUsers}
            </span>
            <span className="text-xs font-bold text-slate-700">Clients</span>
          </div>
          <p className="text-[11px] text-slate-500 font-medium flex items-center justify-between">
            <span>Month Collection:</span>
            <span className="font-bold text-emerald-600 font-mono">৳ {homeUserCollectedThisMonth.toLocaleString()}</span>
          </p>
        </div>
      </div>

      {/* 5. Zone Resellers Card */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 hover:shadow-md transition-all duration-300 relative overflow-hidden group flex flex-col justify-between min-h-[145px]">
        {/* Soft background glow */}
        <div className="absolute top-0 right-0 w-24 h-24 bg-cyan-50/70 rounded-full -mr-8 -mt-8 pointer-events-none group-hover:scale-110 transition-transform duration-300"></div>

        <div className="flex justify-between items-center relative z-10 mb-2">
          <p className="text-slate-500 text-[11px] font-bold uppercase tracking-wider">ZONE RESELLERS</p>
          <div className="p-2 bg-cyan-50 rounded-xl text-cyan-500 shadow-xs">
            <Globe className="w-4 h-4" />
          </div>
        </div>

        <div className="relative z-10">
          <div className="flex items-center gap-1.5 mb-1">
            <span className="px-1.5 py-0.5 rounded bg-cyan-100/80 text-cyan-800 text-xs font-bold font-mono">
              {totalResellers}
            </span>
            <span className="text-xs font-bold text-slate-700">Resellers</span>
          </div>
          <div className="space-y-0.5">
            <p className="text-[10px] text-slate-500 font-medium flex items-center justify-between">
              <span>Month Collection:</span>
              <span className="font-bold text-emerald-600 font-mono">৳ {resellerCollectedThisMonth.toLocaleString()}</span>
            </p>
            <p className="text-[10px] text-slate-400 font-medium flex items-center justify-between">
              <span>Total Due:</span>
              <span className="font-bold text-rose-500 font-mono">৳ {totalResellersDue.toLocaleString()}</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
