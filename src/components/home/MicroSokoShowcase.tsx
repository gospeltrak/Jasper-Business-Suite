import React from 'react';
import { CheckCircle2, ChevronRight, Store, ChefHat, Scissors, Rocket, Factory } from 'lucide-react';

export const MicroSokoShowcase: React.FC = () => {
  return (
    <div className="w-full bg-slate-50 dark:bg-[#05080e] py-24 border-y border-slate-200 dark:border-slate-800">
      <div className="max-w-7xl mx-auto px-4 md:px-6">
        
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-400 font-bold text-sm mb-6 border border-emerald-200 dark:border-emerald-800/50">
            <Rocket className="w-4 h-4" /> Introducing MicroSoko
          </div>
          <h2 className="text-4xl md:text-5xl font-black text-slate-900 dark:text-white mb-6 tracking-tight">
            The Micro-ERP Built for Informal Scale.
          </h2>
          <p className="text-lg text-slate-600 dark:text-slate-400">
            For food makers and micro-shops. Track costs, materials, and sales.
          </p>
        </div>

        {/* Niche Icons */}
        <div className="flex flex-wrap justify-center gap-4 mb-20">
          {[
            { icon: ChefHat, label: "Mama Ntilie & Restaurants" },
            { icon: Store, label: "Retail Kiosks & Dukas" },
            { icon: Scissors, label: "Saloons & Barbers" },
            { icon: Factory, label: "Micro-Millers (Mashine ya Kusaga)" }
          ].map((niche, idx) => (
            <div key={idx} className="flex items-center gap-2 bg-white dark:bg-slate-905 px-4 py-2 rounded-full border border-slate-200 dark:border-slate-800 shadow-sm text-sm font-bold text-slate-700 dark:text-slate-300">
              <niche.icon className="w-4 h-4 text-emerald-600" />
              {niche.label}
            </div>
          ))}
        </div>

        {/* Pricing Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          
          {/* Daily Tier */}
          <div className="bg-white dark:bg-slate-905 rounded-3xl p-8 border border-slate-200 dark:border-slate-800 flex flex-col relative overflow-hidden group hover:border-emerald-500 transition-colors">
            <div className="mb-8">
              <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Soko Siku</h3>
              <p className="text-slate-500 dark:text-slate-400 text-sm">Test first.</p>
            </div>
            <div className="mb-8 flex items-baseline gap-2">
              <span className="text-5xl font-black text-slate-900 dark:text-white font-mono">500</span>
              <span className="text-lg font-bold text-slate-500">TZS/day</span>
            </div>
            <div className="space-y-4 mb-8 flex-1">
              {['Single Active Terminal', 'Raw Material Tracking', 'Basic Sales Reports', 'M-Pesa Reconciliation'].map(feature => (
                <div key={feature} className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{feature}</span>
                </div>
              ))}
            </div>
            <button className="w-full py-4 rounded-xl font-bold border-2 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 text-slate-900 dark:text-white transition-colors">
              Start Daily Plan
            </button>
          </div>

          {/* Monthly Tier (Highlighted) */}
          <div className="bg-slate-900 dark:bg-emerald-900/10 rounded-3xl p-8 border-2 border-slate-900 dark:border-emerald-600 flex flex-col relative transform md:-translate-y-4 shadow-2xl">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 bg-emerald-500 text-white font-bold text-xs px-4 py-1 rounded-b-lg uppercase tracking-wider">
              Most Popular
            </div>
            <div className="mb-8 mt-4">
              <h3 className="text-xl font-bold text-white mb-2">Soko Mwezi</h3>
              <p className="text-slate-400 dark:text-emerald-100/70 text-sm">Best value.</p>
            </div>
            <div className="mb-8 flex items-baseline gap-2">
              <span className="text-5xl font-black text-white font-mono">10,000</span>
              <span className="text-lg font-bold text-slate-400">TZS/mo</span>
            </div>
            <div className="space-y-4 mb-8 flex-1">
              {['All Daily Features', 'Multi-staff Accounts', 'Full Manufacturing Batch Engine', 'Yield & Margin Leakage Alerts', 'Priority WhatsApp Support'].map(feature => (
                <div key={feature} className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                  <span className="text-sm font-medium text-slate-100">{feature}</span>
                </div>
              ))}
            </div>
            <button className="w-full py-4 rounded-xl font-bold bg-emerald-500 hover:bg-emerald-400 text-slate-900 transition-colors shadow-lg shadow-emerald-500/25">
              Start Monthly Plan
            </button>
          </div>

          {/* Weekly Tier */}
          <div className="bg-white dark:bg-slate-905 rounded-3xl p-8 border border-slate-200 dark:border-slate-800 flex flex-col relative overflow-hidden group hover:border-emerald-500 transition-colors">
            <div className="mb-8">
              <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Soko Wiki</h3>
              <p className="text-slate-500 dark:text-slate-400 text-sm">Weekly billing.</p>
            </div>
            <div className="mb-8 flex items-baseline gap-2">
              <span className="text-5xl font-black text-slate-900 dark:text-white font-mono">3,000</span>
              <span className="text-lg font-bold text-slate-500">TZS/week</span>
            </div>
            <div className="space-y-4 mb-8 flex-1">
              {['All Daily Features', '7-Day Trend Reports', 'Expense Categorization', 'Offline Mode Syncing'].map(feature => (
                <div key={feature} className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{feature}</span>
                </div>
              ))}
            </div>
            <button className="w-full py-4 rounded-xl font-bold border-2 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 text-slate-900 dark:text-white transition-colors">
              Start Weekly Plan
            </button>
          </div>

        </div>

      </div>
    </div>
  );
};
