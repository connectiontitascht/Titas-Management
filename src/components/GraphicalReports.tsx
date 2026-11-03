/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  BarChart3, 
  TrendingUp, 
  TrendingDown, 
  Calendar,
  AlertCircle,
  PiggyBank
} from 'lucide-react';
import { 
  Transaction, 
  INCOME_CATEGORY_LABELS, 
  EXPENSE_CATEGORY_LABELS 
} from '../types';

interface GraphicalReportsProps {
  transactions: Transaction[];
}

export function GraphicalReports({ transactions }: GraphicalReportsProps) {
  const [activeTab, setActiveTab] = useState<'trends' | 'categories'>('trends');
  const [hoveredPoint, setHoveredPoint] = useState<{ date: string; income: number; expense: number; index: number } | null>(null);

  // Date translation helpers
  const translateMonth = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('en-US', { month: 'short' });
    } catch {
      return dateStr;
    }
  };

  const translateDayNum = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('en-US', { day: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  // 1. Process Trend Data (Group by Date)
  const trendData = useMemo(() => {
    if (transactions.length === 0) return [];
    
    // Group transactions by date
    const dateGroups: Record<string, { income: number; expense: number }> = {};
    
    // Sort transactions by date first
    const sorted = [...transactions].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    
    // Build maps of last 8 active days
    sorted.forEach(t => {
      if (!dateGroups[t.date]) {
        dateGroups[t.date] = { income: 0, expense: 0 };
      }
      if (t.type === 'income') {
        dateGroups[t.date].income += t.amount;
      } else {
        dateGroups[t.date].expense += t.amount;
      }
    });

    const dates = Object.keys(dateGroups).sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
    
    // Take last 8 active days for readable representation
    const recentDates = dates.slice(-8);
    
    return recentDates.map(date => ({
      date,
      income: dateGroups[date].income,
      expense: dateGroups[date].expense,
    }));
  }, [transactions]);

  // Max value for charting scales
  const maxTrendVal = useMemo(() => {
    if (trendData.length === 0) return 1000;
    const maxVal = Math.max(...trendData.map(d => Math.max(d.income, d.expense)));
    return maxVal === 0 ? 1000 : maxVal * 1.15; // padding top
  }, [trendData]);

  // 2. Process Categories Data (Income / Expenses Breakdowns)
  const categorySummary = useMemo(() => {
    const expenseGroups: Record<string, number> = {};
    const incomeGroups: Record<string, number> = {};
    let totalExpense = 0;
    let totalIncome = 0;

    transactions.forEach(t => {
      if (t.type === 'expense') {
        expenseGroups[t.category] = (expenseGroups[t.category] || 0) + t.amount;
        totalExpense += t.amount;
      } else {
        incomeGroups[t.category] = (incomeGroups[t.category] || 0) + t.amount;
        totalIncome += t.amount;
      }
    });

    const expensesList = Object.entries(expenseGroups).map(([category, amount]) => {
      const percentage = totalExpense > 0 ? Math.round((amount / totalExpense) * 100) : 0;
      return {
        category,
        amount,
        percentage,
        label: EXPENSE_CATEGORY_LABELS[category as any]?.label || category,
        color: EXPENSE_CATEGORY_LABELS[category as any]?.color || 'bg-slate-500',
      };
    }).sort((a, b) => b.amount - a.amount);

    const incomeList = Object.entries(incomeGroups).map(([category, amount]) => {
      const percentage = totalIncome > 0 ? Math.round((amount / totalIncome) * 100) : 0;
      return {
        category,
        amount,
        percentage,
        label: INCOME_CATEGORY_LABELS[category as any]?.label || category,
        color: INCOME_CATEGORY_LABELS[category as any]?.color || 'bg-emerald-500',
      };
    }).sort((a, b) => b.amount - a.amount);

    return { expensesList, incomeList, totalExpense, totalIncome };
  }, [transactions]);


  // Helper English formatter
  const formatAmount = (num: number) => {
    return 'BDT ' + Math.round(num).toLocaleString('en-US');
  };

  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 h-full flex flex-col justify-between">
      {/* Chart Headers */}
      <div>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-50 pb-4 mb-6">
          <div className="flex items-center gap-2.5">
            <span className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
              <BarChart3 className="w-5 h-5" />
            </span>
            <div>
              <h3 className="text-xl font-bold text-slate-800">Graphical Reports</h3>
              <p className="text-xs text-slate-400 mt-0.5">Visual insights of your income and expenses</p>
            </div>
          </div>

          {/* Tab buttons */}
          <div className="flex bg-slate-100 p-0.5 rounded-xl self-start sm:self-auto">
            <button
              onClick={() => setActiveTab('trends')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'trends'
                  ? 'bg-white text-slate-800 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              Income vs Expense (Trends)
            </button>
            <button
              onClick={() => setActiveTab('categories')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'categories'
                  ? 'bg-white text-slate-800 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              Categories
            </button>
          </div>
        </div>

        {transactions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4 border border-slate-100/80">
              <PiggyBank className="w-8 h-8 text-slate-400" />
            </div>
            <p className="text-slate-500 font-bold">Insufficient Data</p>
            <p className="text-slate-400 text-xs mt-1 max-w-xs">
              Please add some transactions to automatically generate graphical charts.
            </p>
          </div>
        ) : (
          <AnimatePresence mode="wait">
            {activeTab === 'trends' ? (
              <motion.div
                key="trends-render"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.25 }}
                className="space-y-6"
              >
                {/* Visual Chart Legend */}
                <div className="flex gap-4 items-center text-xs justify-end text-slate-400">
                  <span className="flex items-center gap-1.5 font-semibold text-emerald-600">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                    Income
                  </span>
                  <span className="flex items-center gap-1.5 font-semibold text-rose-600">
                    <span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span>
                    Expense
                  </span>
                </div>

                {trendData.length < 2 ? (
                  <div className="bg-slate-50 border border-dashed border-slate-200 rounded-xl p-6 text-center text-xs text-slate-500">
                    <Calendar className="w-5 h-5 mx-auto mb-2 text-slate-400" />
                    Trend lines and charts will appear once there are transactions recorded on different days.
                  </div>
                ) : (
                  <div className="relative pt-4">
                    {/* SVG Chart */}
                    <div className="w-full h-56 relative flex items-end">
                      {/* Grid Lines in background */}
                      <div className="absolute inset-0 flex flex-col justify-between pointer-events-none pb-6">
                        {[0, 1, 2, 3].map((g) => (
                          <div key={g} className="border-b border-slate-100 w-full h-0 text-[10px] text-slate-300 relative">
                            <span className="absolute -top-3 left-0 font-mono text-slate-300">
                              {parseInt(String((maxTrendVal / 3) * (3 - g))).toLocaleString('en-US')}
                            </span>
                          </div>
                        ))}
                      </div>

                      {/* Interactive bars representing entries */}
                      <div className="w-full h-full flex justify-around items-end z-10 pl-8 pb-6 pt-2">
                        {trendData.map((d, index) => {
                          const incomeHeight = `${(d.income / maxTrendVal) * 100}%`;
                          const expenseHeight = `${(d.expense / maxTrendVal) * 100}%`;

                          return (
                            <div 
                              key={d.date} 
                              className="flex flex-col items-center flex-1 origin-bottom gap-1 h-full justify-end relative group px-1"
                              onMouseEnter={() => setHoveredPoint({ ...d, index })}
                              onMouseLeave={() => setHoveredPoint(null)}
                            >
                              {/* Income and Expense bars side by side */}
                              <div className="flex items-end gap-1.5 h-full w-full max-w-[50px] justify-center">
                                {/* Income Bar */}
                                <motion.div 
                                  initial={{ scaleY: 0 }}
                                  animate={{ scaleY: 1 }}
                                  transition={{ delay: index * 0.04 }}
                                  className="w-2.5 bg-emerald-500 hover:bg-emerald-600 rounded-t-full origin-bottom"
                                  style={{ height: incomeHeight }}
                                ></motion.div>

                                {/* Expense Bar */}
                                <motion.div 
                                  initial={{ scaleY: 0 }}
                                  animate={{ scaleY: 1 }}
                                  transition={{ delay: index * 0.04 + 0.02 }}
                                  className="w-2.5 bg-rose-500 hover:bg-rose-600 rounded-t-full origin-bottom"
                                  style={{ height: expenseHeight }}
                                ></motion.div>
                              </div>

                              {/* Label underneath */}
                              <span className="absolute bottom-[-24px] text-[11px] font-medium text-slate-400 whitespace-nowrap">
                                {translateDayNum(d.date)} {translateMonth(d.date)}
                              </span>
                            </div>
                          );
                        })}
                      </div>

                      {/* Custom Point Tooltip Box on Hover */}
                      <AnimatePresence>
                        {hoveredPoint && (
                          <motion.div
                            initial={{ opacity: 0, scale: 0.9, y: 15 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.9, y: 15 }}
                            className="absolute bg-slate-900 border border-slate-800 text-white p-3 rounded-xl shadow-xl z-30 left-12 right-12 md:left-auto md:right-auto md:w-56 top-[-30px]"
                            style={{
                              left: hoveredPoint.index > trendData.length / 2 ? '15%' : 'auto',
                              right: hoveredPoint.index > trendData.length / 2 ? 'auto' : '15%',
                            }}
                          >
                            <p className="text-[11px] font-semibold text-slate-400 flex items-center gap-1 border-b border-slate-800 pb-1 mb-1.5 font-sans">
                              <Calendar className="w-3.5 h-3.5 text-indigo-400" />
                              {new Date(hoveredPoint.date).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
                            </p>
                            <div className="space-y-1 text-xs">
                              <div className="flex justify-between font-medium text-emerald-400">
                                <span className="flex items-center gap-1 font-sans">
                                  <TrendingUp className="w-3 h-3" /> Income:
                                </span>
                                <span className="font-mono">{formatAmount(hoveredPoint.income)}</span>
                              </div>
                              <div className="flex justify-between font-medium text-rose-400">
                                <span className="flex items-center gap-1 font-sans">
                                  <TrendingDown className="w-3 h-3" /> Expense:
                                </span>
                                <span className="font-mono">{formatAmount(hoveredPoint.expense)}</span>
                              </div>
                              <div className="flex justify-between font-bold text-slate-200 border-t border-slate-800/80 pt-1 mt-1 font-sans">
                                <span>Balance:</span>
                                <span>
                                  {formatAmount(hoveredPoint.income - hoveredPoint.expense)}
                                </span>
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>

                    <div className="pt-6 text-[11px] text-slate-400 text-center flex items-center justify-center gap-1.5 font-sans leading-relaxed">
                      <AlertCircle className="w-3.5 h-3.5 text-slate-300 shrink-0" />
                      Hover over any day to see detailed income and expense metrics.
                    </div>
                  </div>
                )}
              </motion.div>
            ) : (
              <motion.div
                key="categories-render"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.25 }}
                className="space-y-6"
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {/* Expense categories */}
                  <div>
                    <h4 className="text-sm font-semibold text-slate-700 flex items-center gap-1.5 mb-3">
                      <span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span>
                      Expense Breakdown
                    </h4>
                    
                    {categorySummary.expensesList.length === 0 ? (
                      <div className="text-xs text-slate-400 py-6 border border-dashed border-slate-100 rounded-xl text-center">
                        No expenses recorded
                      </div>
                    ) : (
                      <div className="space-y-3.5">
                        {categorySummary.expensesList.map((item) => (
                          <div key={item.category} className="group">
                            <div className="flex justify-between items-center text-xs mb-1">
                              <span className="font-medium text-slate-600 flex items-center gap-2">
                                <span className={`w-2 h-2 rounded-full ${item.color}`}></span>
                                {item.label}
                              </span>
                              <span className="text-slate-400 font-medium">
                                <span className="text-slate-700 font-mono font-semibold mr-1.5">{formatAmount(item.amount)}</span> 
                                ({item.percentage}%)
                              </span>
                            </div>
                            <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                              <motion.div 
                                initial={{ width: 0 }}
                                animate={{ width: `${item.percentage}%` }}
                                transition={{ duration: 0.5 }}
                                className={`h-full rounded-full transition-all ${item.color}`}
                              ></motion.div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Income categories */}
                  <div>
                    <h4 className="text-sm font-semibold text-slate-700 flex items-center gap-1.5 mb-3">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                      Income Sources
                    </h4>

                    {categorySummary.incomeList.length === 0 ? (
                      <div className="text-xs text-slate-400 py-6 border border-dashed border-slate-100 rounded-xl text-center">
                        No income recorded
                      </div>
                    ) : (
                      <div className="space-y-3.5">
                        {categorySummary.incomeList.map((item) => (
                          <div key={item.category} className="group">
                            <div className="flex justify-between items-center text-xs mb-1">
                              <span className="font-medium text-slate-600 flex items-center gap-2">
                                <span className={`w-2 h-2 rounded-full ${item.color}`}></span>
                                {item.label}
                              </span>
                              <span className="text-slate-400 font-medium">
                                <span className="text-slate-700 font-mono font-semibold mr-1.5">{formatAmount(item.amount)}</span> 
                                ({item.percentage}%)
                              </span>
                            </div>
                            <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                              <motion.div 
                                initial={{ width: 0 }}
                                animate={{ width: `${item.percentage}%` }}
                                transition={{ duration: 0.5 }}
                                className={`h-full rounded-full transition-all ${item.color}`}
                              ></motion.div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        )}
      </div>

      {/* Dynamic Summary Note at the bottom */}
      {transactions.length > 0 && (
        <div className="bg-slate-50 border border-slate-100/80 p-4 rounded-xl mt-6">
          <h4 className="text-xs font-bold text-slate-700 flex items-center gap-1.5 mb-1.5">
            💡 Financial Insight & Recommendation:
          </h4>
          <p className="text-xs text-slate-500 leading-relaxed font-sans">
            {categorySummary.totalExpense > categorySummary.totalIncome ? (
              <span className="text-rose-600 font-medium">
                Your current expenses exceed your total income. Please optimize your expenses and find ways to save.
              </span>
            ) : categorySummary.totalExpense > categorySummary.totalIncome * 0.8 ? (
              <span className="text-amber-600 font-medium">
                You have spent more than 80% of your income. Consider reducing minor expenses to protect your balance.
              </span>
            ) : (
              <span className="text-emerald-700 font-medium">
                Excellent! Your expenses are well-managed and you are keeping a healthy portion of your income as savings.
              </span>
            )}
          </p>
        </div>
      )}
    </div>
  );
}
