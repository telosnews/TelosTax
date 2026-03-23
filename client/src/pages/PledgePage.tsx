import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Code2, Shield, Eye, Sparkles, ExternalLink, Heart } from 'lucide-react';
import { getTipLinks } from '../services/stripeService';

export default function PledgePage() {
  const navigate = useNavigate();
  const [tipLinks, setTipLinks] = useState<{ small: string | null; medium: string | null; large: string | null }>({
    small: null, medium: null, large: null,
  });

  useEffect(() => {
    getTipLinks().then(setTipLinks);
  }, []);

  return (
    <div className="min-h-screen bg-surface-900">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        {/* Back button */}
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors mb-8"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="text-sm">Back to dashboard</span>
        </button>

        {/* Header */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center mb-4">
            <span className="font-bold text-5xl"><span className="text-telos-orange-400">Telos</span><span className="text-telos-blue-400">Tax</span></span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-white mb-3">
            About This Project
          </h1>
          <p className="text-slate-400 text-lg max-w-xl mx-auto">
            A free, open-source tax preparation app built entirely with AI — exploring whether new coding tools can replace premium software.
          </p>
        </div>

        {/* What is TelosTax */}
        <div className="card mb-4">
          <h2 className="text-lg font-semibold text-white mb-3">What is TelosTax?</h2>
          <div className="space-y-3 text-sm text-slate-300 leading-relaxed">
            <p>
              TelosTax is a project from <a href="https://www.telos.news" target="_blank" rel="noopener noreferrer" className="text-telos-blue-400 hover:text-telos-blue-300 underline">Telos News</a>.
              It was built by a journalist with no coding
              experience and no specialized knowledge of tax law, using Anthropic's Claude Code
              as an AI coding assistant. The entire app — over 230,000 lines of code across a tax
              calculation engine, a React frontend, and an Express server — was written by AI.
            </p>
            <p>
              The project explores two questions: whether AI coding tools are really up to the task
              of replacing premium software, and whether journalists can harness AI for a positive
              public-interest goal.
            </p>
          </div>
        </div>

        {/* Support */}
        <div className="card mb-4">
          <div className="flex items-start gap-3 mb-3">
            <div className="p-2 bg-telos-orange-500/10 rounded-lg text-telos-orange-400 shrink-0">
              <Heart className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-white text-sm">Support this project</h3>
              <p className="text-sm text-slate-400 mt-1">
                You can support this project by subscribing to Telos News or making a direct contribution.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-3 ml-11">
            <a
              href="https://www.telos.news"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg
                         bg-telos-orange-600 hover:bg-telos-orange-500 text-white transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Subscribe to Telos News
            </a>
            <div className="flex gap-2">
              {([
                { label: '$5', link: tipLinks.small },
                { label: '$10', link: tipLinks.medium },
                { label: '$25', link: tipLinks.large },
              ] as const).map(({ label, link }) => (
                <button
                  key={label}
                  onClick={() => link && window.open(link, '_blank', 'noopener,noreferrer')}
                  disabled={!link}
                  className="text-sm px-4 py-2 rounded-lg bg-telos-blue-600 hover:bg-telos-blue-500
                             text-white font-medium
                             transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Important caveat */}
        <div className="card mb-4 bg-amber-500/5 border-amber-500/20">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-amber-500/10 rounded-lg text-amber-400 shrink-0">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-amber-300 mb-2">Important: This is a prototype</h3>
              <p className="text-sm text-slate-300 leading-relaxed">
                This tool is for informational purposes only and does not constitute tax advice.
                Do not use this app to file your taxes without having your return carefully reviewed
                by a qualified tax professional. TelosTax needs vetting by tax experts and human
                coders, which is why it's available as a free, open-source project. The tax engine
                may contain errors. If you're a tax professional or developer who'd like to help
                stress-test the app, please get in touch.
              </p>
            </div>
          </div>
        </div>

        {/* Why it exists */}
        <div className="card mb-4">
          <h2 className="text-lg font-semibold text-white mb-3">Why does this exist?</h2>
          <div className="space-y-3 text-sm text-slate-300 leading-relaxed">
            <p>
              The IRS used to offer Direct File, a free online tax-filing system that was popular
              and easy to use. Intuit, the $125 billion company that makes TurboTax, ran a massive
              lobbying campaign to convince the Trump administration to kill it.
            </p>
            <p>
              At the same time, TurboTax asks its 40 million users to consent to sharing their
              most sensitive financial data across Intuit's platforms — including Credit Karma — and
              even to having their tax returns sent overseas for processing. There is no reason why
              Americans should be pushed to do this while filing their taxes.
            </p>
            <p>
              TelosTax is proof that a full-featured tax preparation app can be built to respect
              your privacy instead of exploiting it.
            </p>
          </div>
        </div>

        {/* How it's different */}
        <div className="card mb-4">
          <h2 className="text-lg font-semibold text-white mb-3">How it's built</h2>
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-telos-blue-500/10 rounded-lg text-telos-blue-400 shrink-0">
                <Code2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-semibold text-white text-sm">Open source</h3>
                <p className="text-sm text-slate-400 mt-1">
                  The entire tax engine is public. Anyone can read the code, verify the math,
                  and contribute. Every calculation traces to an IRS statute or regulation.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="p-2 bg-telos-blue-500/10 rounded-lg text-telos-blue-400 shrink-0">
                <Shield className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-semibold text-white text-sm">Privacy by design</h3>
                <p className="text-sm text-slate-400 mt-1">
                  Your tax return lives only in your browser, encrypted with AES-256-GCM. No
                  accounts, no cloud storage, no data collection. After you load the app, you
                  don't even need an internet connection.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="p-2 bg-telos-blue-500/10 rounded-lg text-telos-blue-400 shrink-0">
                <Eye className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-semibold text-white text-sm">AI transparency</h3>
                <p className="text-sm text-slate-400 mt-1">
                  If you enable AI features, a built-in Privacy Audit Log shows you exactly what
                  was sent to the AI provider, what PII was blocked, and what came back. As far
                  as we know, no AI product offers this level of transparency.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="p-2 bg-telos-blue-500/10 rounded-lg text-telos-blue-400 shrink-0">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-semibold text-white text-sm">Two modes</h3>
                <p className="text-sm text-slate-400 mt-1">
                  <strong className="text-slate-300">Private Mode</strong> is the default — fully
                  offline, zero data leaves your device. <strong className="text-slate-300">BYOK
                  Mode</strong> adds AI features using your own Anthropic API key, with PII
                  automatically stripped from every message.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Get involved */}
        <div className="card mt-4 bg-surface-800">
          <h2 className="text-lg font-semibold text-white mb-3">Get involved</h2>
          <p className="text-sm text-slate-300 leading-relaxed mb-4">
            TelosTax is an open-source project that needs help from tax professionals and
            developers. If you'd like to contribute, dig into the code, or stress-test the
            engine, the project is on GitHub.
          </p>
          <div className="flex flex-wrap gap-3">
            <a
              href="https://github.com/telosnews/TelosTax"
              target="_blank"
              rel="noopener noreferrer"
              className="btn-primary inline-flex items-center gap-2 text-sm"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              View on GitHub
            </a>
            <a
              href="mailto:ryan@telos.news"
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg
                         bg-surface-700 text-slate-200 hover:bg-surface-600 transition-colors"
            >
              Contact: ryan@telos.news
            </a>
          </div>
        </div>

        {/* Footer */}
        <div className="text-xs text-slate-600 mt-12 text-center leading-relaxed">
          <p>This tool is for informational purposes only and does not constitute tax advice.</p>
          <div className="flex items-center justify-center gap-3 mt-2">
            <button onClick={() => navigate('/terms')} className="text-slate-400 hover:text-slate-300 transition-colors">Terms</button>
            <span className="text-slate-700">&middot;</span>
            <button onClick={() => navigate('/privacy')} className="text-slate-400 hover:text-slate-300 transition-colors">Privacy</button>
          </div>
          <button
            onClick={() => navigate('/')}
            className="mt-4 text-slate-500 hover:text-slate-300 transition-colors"
          >
            &larr; Back to dashboard
          </button>
        </div>
      </div>
    </div>
  );
}
