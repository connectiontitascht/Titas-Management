/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  TrendingDown, 
  Info,
  Utensils, 
  Home, 
  Car, 
  Zap, 
  Sparkles, 
  HeartPulse, 
  GraduationCap, 
  Coins,
  Sparkle,
  Hammer,
  Power,
  Award,
  Globe,
  Cpu,
  Wallet,
  Briefcase,
  Phone,
  Settings,
  PlusCircle
} from 'lucide-react';
import { Transaction, EXPENSE_CATEGORY_LABELS } from '../types';

interface CategorySpendingBreakdownProps {
  transactions: Transaction[];
}

export function CategorySpendingBreakdown({ transactions }: CategorySpendingBreakdownProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  // Translate category icon names to elements
  const renderCategoryIcon = (iconName: string) => {
    switch (iconName) {
      case 'Utensils': return <Utensils className="w-3.5 h-3.5" />;
      case 'Home': return <Home className="w-3.5 h-3.5" />;
      case 'Car': return <Car className="w-3.5 h-3.5" />;
      case 'Zap': return <Zap className="w-3.5 h-3.5" />;
      case 'Sparkles': return <Sparkles className="w-3.5 h-3.5" />;
      case 'HeartPulse': return <HeartPulse className="w-3.5 h-3.5" />;
      case 'GraduationCap': return <GraduationCap className="w-3.5 h-3.5" />;
      case 'Coins': return <Coins className="w-3.5 h-3.5" />;
      case 'Hammer': return <Hammer className="w-3.5 h-3.5" />;
      case 'Power': return <Power className="w-3.5 h-3.5" />;
      case 'Award': return <Award className="w-3.5 h-3.5" />;
      case 'Globe': return <Globe className="w-3.5 h-3.5" />;
      case 'Cpu': return <Cpu className="w-3.5 h-3.5" />;
      case 'Wallet': return <Wallet className="w-3.5 h-3.5" />;
      case 'Briefcase': return <Briefcase className="w-3.5 h-3.5" />;
      case 'Phone': return <Phone className="w-3.5 h-3.5" />;
      case 'Settings': return <Settings className="w-3.5 h-3.5" />;
      case 'PlusCircle': return <PlusCircle className="w-3.5 h-3.5" />;
      default: return <Coins className="w-3.5 h-3.5" />;
    }
  };

  // 1. Process data specifically for spending (expenses)
  const chartData = useMemo(() => {
    const expenseGroups: Record<string, number> = {};
    
    // sum transactions of type 'expense'
    transactions.forEach(t => {
      if (t.type === 'expense') {
        expenseGroups[t.category] = (expenseGroups[t.category] || 0) + t.amount;
      }
    });

    const activeList = Object.entries(EXPENSE_CATEGORY_LABELS).map(([key, config]) => {
      const amount = expenseGroups[key] || 0;
      return {
        category: key,
        amount,
        label: config.label,
        color: config.color,
        icon: config.icon,
      };
    })
    .filter(item => item.amount > 0)
    .sort((a, b) => b.amount - a.amount);

    const totalExpenseAmount = activeList.reduce((sum, item) => sum + item.amount, 0);

    return activeList.map(item => ({
      ...item,
      percentage: totalExpenseAmount > 0 ? Math.round((item.amount / totalExpenseAmount) * 100) : 0,
    }));
  }, [transactions]);

  // Max spending amount of any category for vertical scale calculation
  const maxCategoryAmount = useMemo(() => {
    if (chartData.length === 0) return 1000;
    const maxAmount = Math.max(...chartData.map(d => d.amount));
    return maxAmount === 0 ? 1000 : maxAmount * 1.1; // 10% buffering at top
  }, [chartData]);

  // Total overall expenditures formatting
  const totalSpend = useMemo(() => {
    return chartData.reduce((sum, i) => sum + i.amount, 0);
  }, [chartData]);

  // Highest spending category helper description
  const highestCategory = useMemo(() => {
    if (chartData.length === 0) return null;
    return chartData[0];
  }, [chartData]);

  const formatAmount = (num: number) => {
    return 'BDT ' + Math.round(num).toLocaleString('en-US');
  };

  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 hover:shadow-md transition-shadow duration-300">
      
      {/* Widget Header */}
      <div className="flex items-center justify-between border-b border-slate-50 pb-4 mb-6">
        <div className="flex items-center gap-2.5">
          <span className="p-2 bg-rose-50 text-rose-500 rounded-xl">
            <TrendingDown className="w-5 h-5" />
          </span>
          <div>
            <h3 className="text-lg font-extrabold text-slate-800">Category Spending Breakdown</h3>
            <p className="text-xs text-slate-400 mt-0.5">Bar chart and ratio of your expenses across different categories</p>
          </div>
        </div>
        
        {totalSpend > 0 && (
          <span className="text-[11px] font-bold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-lg">
            Total Spend: <span className="text-rose-600 font-mono font-bold">{formatAmount(totalSpend)}</span>
          </span>
        )}
      </div>

      {chartData.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 text-center">
          <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center mb-3">
            <Info className="w-6 h-6 text-slate-400" />
          </div>
          <p className="text-slate-500 text-sm font-bold">No Expense Records Found</p>
          <p className="text-slate-400 text-xs mt-1 max-w-sm">
            Please add an expense transaction with a category to see real-time breakdown on this chart.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Vertical Bar Chart Graphic with Axis Marks */}
          <div className="relative pt-6">
            
            {/* Legend / Info Label overlay */}
            <div className="flex justify-end gap-3 text-[10px] text-slate-400 font-semibold mb-3">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded bg-rose-500/80"></span>
                Expenditure amount (BDT)
              </span>
            </div>

            {/* Main Visual Stage */}
            <div className="h-48 flex items-end relative w-full border-b border-slate-200">
              
              {/* Grid Background lines inside chart */}
              <div className="absolute inset-0 flex flex-col justify-between pointer-events-none pb-0 text-[10px] text-slate-300 font-mono">
                {[0, 1, 2, 3].map((g) => {
                  const val = Math.round((maxCategoryAmount / 3) * (3 - g));
                  return (
                    <div key={g} className="border-t border-slate-100/70 w-full relative h-0">
                      <span className="absolute -top-2 left-0 font-medium text-[9px] text-slate-400 bg-white pr-1">
                        {formatAmount(val)}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Dynamic Columns Wrapper container */}
              <div className="w-full h-full flex justify-around items-end z-10 pl-16 pr-2">
                {chartData.map((d, idx) => {
                  const heightPercent = `${(d.amount / maxCategoryAmount) * 100}%`;
                  const isHovered = hoveredIndex === idx;

                  return (
                    <div
                      key={d.category}
                      className="flex flex-col items-center flex-1 h-full justify-end relative px-1 group"
                      onMouseEnter={() => setHoveredIndex(idx)}
                      onMouseLeave={() => setHoveredIndex(null)}
                    >
                      {/* Bar Column Pillar */}
                      <div className="w-full max-w-[28px] sm:max-w-[42px] h-full flex items-end justify-center relative">
                        
                        {/* Dynamic Tooltip bubble */}
                        <AnimatePresence>
                          {isHovered && (
                            <motion.div
                              initial={{ opacity: 0, scale: 0.95, y: 5 }}
                              animate={{ opacity: 1, scale: 1, y: 0 }}
                              exit={{ opacity: 0, scale: 0.95, y: 5 }}
                              className="absolute bg-slate-900 text-white rounded-lg px-2.5 py-1.5 text-[10px] shadow-lg font-medium select-none pointer-events-none z-30 -top-12 whitespace-nowrap text-center text-xs"
                            >
                              <p className="font-extrabold text-slate-200 mb-0.5">{d.label}</p>
                              <p className="font-mono text-rose-300 font-bold">{formatAmount(d.amount)}</p>
                              <div className="absolute left-1/2 -translate-x-1/2 bottom-[-4px] w-2 h-2 bg-slate-900 rotate-45"></div>
                            </motion.div>
                          )}
                        </AnimatePresence>

                        {/* Visual Colored Bar */}
                        <motion.div
                          initial={{ scaleY: 0 }}
                          animate={{ scaleY: 1 }}
                          transition={{ type: "spring", stiffness: 70, delay: idx * 0.05 }}
                          style={{ height: heightPercent }}
                          className={`w-full rounded-t-lg origin-bottom transition-all duration-200 cursor-pointer ${d.color} ${
                            isHovered ? 'brightness-110 shadow-md scale-x-105' : 'bg-opacity-85'
                          }`}
                        >
                          {/* Inner percent badge for large columns */}
                          {d.amount / maxCategoryAmount > 0.3 && (
                            <span className="hidden sm:block absolute top-2 inset-x-0 text-center text-[10px] font-black text-white/90 drop-shadow-sm font-sans select-none">
                              {d.percentage}%
                            </span>
                          )}
                        </motion.div>

                      </div>

                      {/* Icon & Mini-label at bottom */}
                      <div className="absolute bottom-[-32px] flex flex-col items-center text-center">
                        <span className={`p-1 rounded-md text-white ${d.color} shadow-sm shrink-0 mb-0.5`}>
                          {renderCategoryIcon(d.icon)}
                        </span>
                        <span className="hidden md:block text-[10px] font-bold text-slate-500 max-w-[55px] truncate">
                          {d.label}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

            </div>

            {/* Responsive spacer for the absolute positioned icons at bottom */}
            <div className="h-10"></div>
          </div>

          {/* Simple table-style list metrics for ultra precise analysis */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-slate-100">
            {chartData.map((d, idx) => (
              <div 
                key={d.category}
                className={`p-3 rounded-xl border transition-all duration-200 flex items-center justify-between gap-3 ${
                  hoveredIndex === idx 
                    ? 'bg-slate-50 border-slate-200 shadow-sm' 
                    : 'bg-white border-slate-100 hover:border-slate-200'
                }`}
                onMouseEnter={() => setHoveredIndex(idx)}
                onMouseLeave={() => setHoveredIndex(null)}
              >
                <div className="flex items-center gap-2.5">
                  <span className={`p-2 rounded-xl text-white ${d.color}`}>
                    {renderCategoryIcon(d.icon)}
                  </span>
                  <div>
                    <h5 className="text-xs font-bold text-slate-700">{d.label}</h5>
                    <p className="text-[10px] text-slate-400 font-medium">{d.percentage}% of total expenses</p>
                  </div>
                </div>

                <div className="text-right">
                  <span className="font-mono text-xs font-extrabold text-slate-800 tracking-tight block">
                    {formatAmount(d.amount)}
                  </span>
                  <span className="text-[9px] text-slate-400 font-bold block bg-slate-100 px-1.5 py-0.5 rounded-md mt-0.5">
                    {d.percentage}%
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* AI Observation Note */}
          {highestCategory && (
            <div className="bg-rose-50/50 border border-rose-100 p-3.5 rounded-xl flex gap-3 text-xs">
              <span className="text-rose-500 shrink-0">
                <Sparkle className="w-4 h-4 mt-0.5 fill-rose-500 animate-pulse" />
              </span>
              <div>
                <span className="font-extrabold text-slate-800 font-sans">Highest spending category: </span>
                <span className="font-bold text-rose-700 bg-rose-100/60 px-1.5 py-0.5 rounded mr-1">
                  {highestCategory.label} ({formatAmount(highestCategory.amount)})
                </span>
                <p className="text-slate-500 text-[11px] leading-relaxed mt-1 font-sans">
                  According to your logs, the largest portion of your expenses (<span className="font-bold text-slate-700">{highestCategory.percentage}%</span>) is spent here. Consider reviewing this category to optimize your financial budget.
                </p>
              </div>
            </div>
          )}

        </div>
      )}

    </div>
  );
}
