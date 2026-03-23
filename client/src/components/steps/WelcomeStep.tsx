import StepNavigation from '../layout/StepNavigation';
import { FileText, Briefcase, Receipt, ShieldCheck, ArrowRight, Home, HandHeart, GraduationCap, Landmark, PiggyBank, Baby, HardDrive, Calculator, Compass, Wrench } from 'lucide-react';

export default function WelcomeStep() {
  return (
    <div>
      {/* Hero */}
      <div className="text-center pt-4 pb-8">
        <h1 className="text-4xl sm:text-5xl font-bold mb-4">
          <span className="text-telos-orange-400">Telos</span><span className="text-telos-blue-400">Tax</span>
        </h1>
        <p className="text-xl text-slate-300 max-w-lg mx-auto leading-relaxed">
          Let's prepare your 2025 tax return.
        </p>
      </div>

      {/* What to expect */}
      <div className="card mb-4">
        <h3 className="font-semibold text-slate-200 mb-3">Here's how it works</h3>
        <p className="text-sm text-slate-400 leading-relaxed mb-4">
          We'll walk you through your tax return one section at a time. First we'll collect some basic info about you, then move through your income sources, deductions, and credits. If anything doesn't apply to you, we'll skip it automatically.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-1 text-xs text-slate-400 mb-4">
          <span className="px-2 py-1 rounded-full bg-telos-blue-600/20 text-telos-blue-300 border border-telos-blue-500/30 whitespace-nowrap">Your Info</span>
          <ArrowRight className="w-3 h-3 shrink-0" />
          <span className="px-2 py-1 rounded-full bg-telos-blue-600/20 text-telos-blue-300 border border-telos-blue-500/30">Income</span>
          <ArrowRight className="w-3 h-3 shrink-0" />
          <span className="px-2 py-1 rounded-full bg-telos-blue-600/20 text-telos-blue-300 border border-telos-blue-500/30">Deductions</span>
          <ArrowRight className="w-3 h-3 shrink-0" />
          <span className="px-2 py-1 rounded-full bg-telos-blue-600/20 text-telos-blue-300 border border-telos-blue-500/30">Credits</span>
          <ArrowRight className="w-3 h-3 shrink-0" />
          <span className="px-2 py-1 rounded-full bg-telos-blue-600/20 text-telos-blue-300 border border-telos-blue-500/30 whitespace-nowrap">State Taxes</span>
          <ArrowRight className="w-3 h-3 shrink-0" />
          <span className="px-2 py-1 rounded-full bg-telos-blue-600/20 text-telos-blue-300 border border-telos-blue-500/30">Review</span>
          <ArrowRight className="w-3 h-3 shrink-0" />
          <span className="px-2 py-1 rounded-full bg-telos-blue-600/20 text-telos-blue-300 border border-telos-blue-500/30">File</span>
        </div>
        <ul className="text-sm text-slate-400 space-y-2">
          <li className="flex items-start gap-2.5">
            <HardDrive className="w-4 h-4 text-telos-orange-400 shrink-0 mt-0.5" />
            <span><strong className="text-slate-300">Your progress saves automatically</strong> — close the tab and come back anytime. You'll pick up right where you left off.</span>
          </li>
          <li className="flex items-start gap-2.5">
            <Calculator className="w-4 h-4 text-telos-orange-400 shrink-0 mt-0.5" />
            <span><strong className="text-slate-300">Your tax estimate updates live</strong> as you enter data, so you can see your refund (or amount owed) change in real time at the top of the screen.</span>
          </li>
          <li className="flex items-start gap-2.5">
            <Compass className="w-4 h-4 text-telos-orange-400 shrink-0 mt-0.5" />
            <span><strong className="text-slate-300">You can jump around</strong> using the sidebar on the left. Nothing is locked — go back to any section and make changes whenever you want.</span>
          </li>
          <li className="flex items-start gap-2.5">
            <Wrench className="w-4 h-4 text-telos-orange-400 shrink-0 mt-0.5" />
            <span><strong className="text-slate-300">Built-in tools help you understand your taxes</strong> — run what-if scenarios, check your audit risk profile, compare year-over-year changes, and get a plain-English breakdown of how every number on your return was calculated.</span>
          </li>
          <li className="flex items-start gap-2.5">
            <HardDrive className="w-4 h-4 text-telos-orange-400 shrink-0 mt-0.5" />
            <span><strong className="text-slate-300">No account needed. Your data stays in your browser,</strong> encrypted with a passphrase only you know. If you enable AI features (BYOK mode), only PII-stripped messages pass through our relay server — and nothing is stored.</span>
          </li>
        </ul>
      </div>

      {/* What you'll need */}
      <div className="card mb-4">
        <h3 className="font-semibold text-slate-200 mb-1">Gather any records that apply to you</h3>
        <p className="text-sm text-slate-400 mb-3">Most people only need a few of these. We'll skip anything that doesn't apply.</p>
        <div className="grid sm:grid-cols-2 gap-x-6 gap-y-2.5">
          <div className="flex items-center gap-3">
            <ShieldCheck className="w-4 h-4 text-slate-400 shrink-0" />
            <span className="text-sm text-slate-400">Social Security numbers (you, spouse, dependents)</span>
          </div>
          <div className="flex items-center gap-3">
            <FileText className="w-4 h-4 text-slate-400 shrink-0" />
            <span className="text-sm text-slate-400">W-2 forms from employers</span>
          </div>
          <div className="flex items-center gap-3">
            <Receipt className="w-4 h-4 text-slate-400 shrink-0" />
            <span className="text-sm text-slate-400">1099 forms (NEC, INT, DIV, B, R, K-1, etc.)</span>
          </div>
          <div className="flex items-center gap-3">
            <Briefcase className="w-4 h-4 text-slate-400 shrink-0" />
            <span className="text-sm text-slate-400">Business income &amp; expense records</span>
          </div>
          <div className="flex items-center gap-3">
            <Home className="w-4 h-4 text-slate-400 shrink-0" />
            <span className="text-sm text-slate-400">Mortgage interest statement (Form 1098)</span>
          </div>
          <div className="flex items-center gap-3">
            <Landmark className="w-4 h-4 text-slate-400 shrink-0" />
            <span className="text-sm text-slate-400">Property tax &amp; state/local tax records</span>
          </div>
          <div className="flex items-center gap-3">
            <HandHeart className="w-4 h-4 text-slate-400 shrink-0" />
            <span className="text-sm text-slate-400">Charitable donation receipts</span>
          </div>
          <div className="flex items-center gap-3">
            <PiggyBank className="w-4 h-4 text-slate-400 shrink-0" />
            <span className="text-sm text-slate-400">Retirement &amp; HSA contribution records</span>
          </div>
          <div className="flex items-center gap-3">
            <GraduationCap className="w-4 h-4 text-slate-400 shrink-0" />
            <span className="text-sm text-slate-400">Student loan interest (Form 1098-E) &amp; tuition (1098-T)</span>
          </div>
          <div className="flex items-center gap-3">
            <Baby className="w-4 h-4 text-slate-400 shrink-0" />
            <span className="text-sm text-slate-400">Childcare provider info &amp; expenses</span>
          </div>
        </div>
        <p className="text-sm text-slate-400 mt-3 text-center">Don't have everything? No problem — you can come back and add it later.</p>
      </div>

      <StepNavigation continueLabel="Let's Go" showBack={false} />
    </div>
  );
}
