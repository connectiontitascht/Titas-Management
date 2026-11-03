import React from 'react';
import { Transaction } from '../types';
import { PaymentMethodLogo } from './PaymentLogos';
import { CreditCard, ArrowUpRight, ArrowDownRight, TrendingUp } from 'lucide-react';

interface PaymentMethodBreakdownProps {
  transactions: Transaction[];
}

export function PaymentMethodBreakdown({ transactions }: PaymentMethodBreakdownProps) {
  // Define known payment methods with display info
  const paymentMethodsInfo = [
    { key: 'cash', label: 'Cash', color: 'text-emerald-600', bgColor: 'bg-emerald-50', borderColor: 'border-emerald-100', progressColor: 'bg-emerald-500' },
    { key: 'bkash', label: 'bKash', color: 'text-pink-600', bgColor: 'bg-pink-50', borderColor: 'border-pink-100', progressColor: 'bg-pink-500' },
    { key: 'nagad', label: 'Nagad', color: 'text-orange-600', bgColor: 'bg-orange-50', borderColor: 'border-orange-100', progressColor: 'bg-orange-500' },
    { key: 'rocket', label: 'Rocket', color: 'text-purple-600', bgColor: 'bg-purple-50', borderColor: 'border-purple-100', progressColor: 'bg-purple-500' },
    { key: 'bank', label: 'Bank', color: 'text-blue-600', bgColor: 'bg-blue-50', borderColor: 'border-blue-100', progressColor: 'bg-blue-500' },
    { key: 'sslcommerz', label: 'SSL Commerz', color: 'text-indigo-600', bgColor: 'bg-indigo-50', borderColor: 'border-indigo-100', progressColor: 'bg-indigo-500' },
  ];

  // Process transaction data for each payment method
  const breakdownData = paymentMethodsInfo.map(method => {
    const rawMethodKey = method.key;
    
    // Filter transactions for this method (with fallback to 'cash' for empty/undefined ones if rawKey is 'cash')
    const methodTransactions = transactions.filter(t => {
      const pm = (t.paymentMethod || 'cash').trim().toLowerCase();
      if (rawMethodKey === 'cash') {
        return pm === 'cash' || !t.paymentMethod;
      }
      return pm === rawMethodKey;
    });

    const income = methodTransactions
      .filter(t => t.type === 'income')
      .reduce((sum, t) => sum + t.amount, 0);

    const expense = methodTransactions
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + t.amount, 0);

    const netValue = income - expense;

    return {
      ...method,
      income,
      expense,
      netValue,
      count: methodTransactions.length,
    };
  });

  // Calculate total volume for percentages
  const grandTotalAll = breakdownData.reduce((sum, m) => sum + m.income + m.expense, 0);

  // Formatting helper in English
  const formatAmount = (num: number) => {
    return 'BDT ' + num.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  };

  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 mt-6 select-none">
      {/* Header */}
      <div className="flex items-center gap-2.5 border-b border-slate-50 pb-4 mb-6">
        <span className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
          <CreditCard className="w-5 h-5" />
        </span>
        <div>
          <h3 className="text-xl font-bold text-slate-800">Payment Method Breakdown</h3>
          <p className="text-xs text-slate-400 mt-0.5">Analysis of total transactions and receipts based on payment channels</p>
        </div>
      </div>

      {/* Grid structure */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {breakdownData.map((channel) => {
          const totalChannelVolume = channel.income + channel.expense;
          const percentage = grandTotalAll > 0 ? Math.round((totalChannelVolume / grandTotalAll) * 100) : 0;

          return (
            <div
              key={channel.key}
              className={`bg-white rounded-xl p-5 border ${channel.borderColor} hover:shadow-md transition-all duration-300 relative overflow-hidden group`}
            >
              {/* Background Accent Blob */}
              <div className={`absolute top-0 right-0 w-24 h-24 ${channel.bgColor} rounded-full -mr-8 -mt-8 group-hover:scale-125 transition-transform duration-300 opacity-40`}></div>
              
              <div className="relative z-10 flex flex-col h-full justify-between">
                {/* Method Name & Logo */}
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-1 rounded-xl bg-white shadow-sm border border-slate-100">
                    <PaymentMethodLogo method={channel.key} className="w-8 h-8" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-800">{channel.label}</h4>
                    <span className="text-[10px] font-semibold text-slate-400">
                      {channel.count} Transactions
                    </span>
                  </div>
                </div>

                {/* Calculations */}
                <div className="space-y-2 mt-2">
                  <div className="flex justify-between items-end border-b border-slate-50 pb-1.5">
                    <span className="text-[11px] text-slate-400 flex items-center gap-1">
                      <ArrowUpRight className="w-3.5 h-3.5 text-emerald-500" />
                      Received
                    </span>
                    <span className="text-sm font-bold font-mono text-emerald-600">
                      {formatAmount(channel.income)}
                    </span>
                  </div>

                  <div className="flex justify-between items-end border-b border-slate-50 pb-1.5">
                    <span className="text-[11px] text-slate-400 flex items-center gap-1">
                      <ArrowDownRight className="w-3.5 h-3.5 text-rose-500" />
                      Paid Out
                    </span>
                    <span className="text-sm font-bold font-mono text-rose-600">
                      {formatAmount(channel.expense)}
                    </span>
                  </div>

                  <div className="flex justify-between items-end pt-1">
                    <span className="text-[11px] text-slate-500 font-semibold flex items-center gap-1">
                      <TrendingUp className="w-3.5 h-3.5 text-indigo-500" />
                      Net Balance
                    </span>
                    <span className={`text-sm font-black font-mono ${channel.netValue >= 0 ? 'text-indigo-600' : 'text-rose-700'}`}>
                      {formatAmount(channel.netValue)}
                    </span>
                  </div>
                </div>

                {/* Progress Bar proportion */}
                <div className="mt-4">
                  <div className="flex justify-between items-center text-[9.5px] font-bold text-slate-400 mb-1">
                    <span>Share: {percentage}%</span>
                    <span>Volume: {formatAmount(totalChannelVolume)}</span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${channel.progressColor}`}
                      style={{ width: `${percentage}%` }}
                    ></div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
