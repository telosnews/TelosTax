import { useNavigate } from 'react-router-dom';
import { ArrowLeft, FileText } from 'lucide-react';

export default function TermsPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-surface-900">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors mb-8"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="text-sm">Back</span>
        </button>

        <div className="flex items-center gap-3 mb-8">
          <div className="p-2 bg-telos-blue-500/10 rounded-lg">
            <FileText className="w-6 h-6 text-telos-blue-400" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white">Terms of Service</h1>
        </div>

        <div className="prose prose-invert max-w-none space-y-6 text-slate-300 text-sm leading-relaxed">
          <p className="text-slate-400 text-xs">Last updated: March 22, 2026</p>

          <section>
            <h2 className="text-lg font-semibold text-white mt-6 mb-3">1. What TelosTax Is</h2>
            <p>
              TelosTax is a free, open-source tax preparation tool that helps you estimate your federal
              and state income tax liability for all 50 states and the District of Columbia. It runs
              entirely in your web browser. All calculations are performed on your device using the
              open-source <code className="text-telos-orange-300 bg-surface-800 px-1.5 py-0.5 rounded">@telostax/engine</code> library.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mt-6 mb-3">2. What TelosTax Is Not</h2>
            <p>
              TelosTax is <strong className="text-white">not</strong> a tax preparer, tax advisor, CPA,
              enrolled agent, or attorney. It does not provide tax advice, legal advice, or financial
              advice of any kind. It is a tool that performs mathematical calculations based on
              information you provide and IRS-published tax rules.
            </p>
            <p>
              TelosTax does not file tax returns with the IRS or any state tax authority. In Private
              Mode (the default), it does not transmit your data to any third party. In BYOK Mode,
              PII-stripped messages are relayed to Anthropic for AI-powered features (see Section 7a
              below). It generates documents for your personal review and records only.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mt-6 mb-3">3. Your Responsibility</h2>
            <p>You are solely responsible for:</p>
            <ul className="list-disc list-inside space-y-1 text-slate-400">
              <li>The accuracy of the information you enter</li>
              <li>Verifying any tax calculations before relying on them</li>
              <li>Filing your actual tax return with the IRS (if required)</li>
              <li>Consulting a qualified tax professional for advice specific to your situation</li>
              <li>Understanding your tax obligations under federal, state, and local law</li>
              <li>Verifying data pulled from imported documents — imports are approximate, not perfect</li>
              <li>Setting and remembering your encryption passphrase (there is no "forgot password" option)</li>
              <li>Keeping a backup of your data via export in case you clear your browser or lose your device</li>
            </ul>
            <p className="mt-3">
              Tax law is complex and changes frequently. TelosTax implements the rules as we understand
              them for the 2025 tax year, but we make no guarantee that our implementation is complete,
              current, or correct for every situation.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mt-6 mb-3">4. No Warranty</h2>
            <p>
              TelosTax is provided <strong className="text-white">"as is"</strong> and <strong className="text-white">"as available"</strong> without
              warranty of any kind, either express or implied, including but not limited to the implied
              warranties of merchantability, fitness for a particular purpose, and non-infringement.
            </p>
            <p>
              We do not warrant that the tax calculations will be accurate, complete, or suitable for
              filing with the IRS. We do not warrant that the software will be free of errors, bugs,
              or interruptions.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mt-6 mb-3">5. Limitation of Liability</h2>
            <p>
              To the maximum extent permitted by applicable law, TelosTax and its contributors shall
              not be liable for any indirect, incidental, special, consequential, or punitive damages,
              including but not limited to: loss of profits, data, or goodwill; tax penalties or
              interest; IRS audit costs; or any other intangible losses resulting from your use of or
              inability to use TelosTax.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mt-6 mb-3">6. Open Source</h2>
            <p>
              The TelosTax calculation engine is released under the MIT License. You may inspect, modify,
              and redistribute the source code in accordance with that license. The open-source nature
              of the engine means you can independently verify every calculation it performs.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mt-6 mb-3">7. Local Data Storage</h2>
            <p>
              All tax data you enter is stored exclusively in your browser's local storage on your
              device, encrypted with your passphrase when one is set. Documents you import (PDFs, CSVs,
              photos, and other files) are processed entirely in your browser and never uploaded. We have
              no servers that receive, store, or process your tax information. See
              our <button onClick={() => navigate('/privacy')} className="text-telos-blue-400 hover:text-telos-blue-300 underline">Privacy Policy</button> for
              full details.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mt-6 mb-3">7a. AI Features (BYOK Mode)</h2>
            <p>
              TelosTax includes optional AI-powered features that require you to provide your own
              Anthropic API key ("BYOK Mode"). These features are disabled by default.
            </p>
            <ul className="list-disc list-inside space-y-1 text-slate-400 mt-3">
              <li>
                <strong className="text-slate-300">Your API key, your account.</strong> AI usage is
                billed directly to your Anthropic account. TelosTax does not charge for AI features
                and receives no payment from Anthropic.
              </li>
              <li>
                <strong className="text-slate-300">TelosTax is not responsible for Anthropic's service.</strong> We
                relay your messages but have no control over Anthropic's availability, pricing,
                rate limits, or model behavior. Anthropic's terms of service govern your use of
                their API.
              </li>
              <li>
                <strong className="text-slate-300">AI responses are not tax advice.</strong> The AI
                assistant can explain tax concepts and help with data entry, but all tax calculations
                are performed by our deterministic engine. TelosTax is not responsible for the accuracy,
                completeness, or reliability of AI-generated responses. You should not rely on AI
                responses as a substitute for professional tax advice.
              </li>
              <li>
                <strong className="text-slate-300">You are responsible for your API key.</strong> Your
                key is stored in your browser's encrypted localStorage. We never store it on our
                server. If your key is compromised, revoke it from your Anthropic account.
              </li>
            </ul>
            <p className="mt-3">
              See our <button onClick={() => navigate('/privacy')} className="text-telos-blue-400 hover:text-telos-blue-300 underline">Privacy Policy</button> (Section 13) for
              full details on what data is sent, how PII is blocked, and how our relay server works.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mt-6 mb-3">8. Eligibility</h2>
            <p>
              You must be at least 18 years old (or the age of majority in your jurisdiction) to use
              TelosTax. By using this software, you represent that you meet this requirement.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mt-6 mb-3">9. Indemnification</h2>
            <p>
              To the maximum extent permitted by applicable law, you agree to indemnify and hold
              harmless TelosTax, its author, and its contributors from any claims, losses, damages,
              liabilities, or expenses (including reasonable attorneys&apos; fees) arising from your use
              of the software, including but not limited to penalties, interest, or audit costs
              assessed by any taxing authority, or any misuse of the AI features.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mt-6 mb-3">10. Governing Law &amp; Dispute Resolution</h2>
            <p>
              These terms are governed by the laws of the District of Columbia, without regard to
              conflict of law principles. Any dispute arising under these terms shall be resolved
              exclusively in the courts located in the District of Columbia, and you consent to
              personal jurisdiction in those courts.
            </p>
            <p>
              To the fullest extent permitted by law, any dispute shall be resolved on an individual
              basis. You waive any right to participate in a class action, class arbitration, or other
              representative proceeding against TelosTax or its contributors.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mt-6 mb-3">11. Changes to These Terms</h2>
            <p>
              We may update these terms from time to time. Changes will be reflected on this page
              with an updated &ldquo;Last updated&rdquo; date. Your continued use of TelosTax after changes
              constitutes acceptance of the revised terms.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mt-6 mb-3">12. Severability</h2>
            <p>
              If any provision of these terms is found to be unenforceable or invalid, that provision
              shall be limited or eliminated to the minimum extent necessary, and the remaining
              provisions shall remain in full force and effect.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mt-6 mb-3">13. Contact</h2>
            <p>
              If you have questions about these terms, find a calculation error, or want to contribute
              to the project, email us at <a href="mailto:ryan@telos.news" className="text-telos-blue-400 hover:text-telos-blue-300 underline">ryan@telos.news</a> or
              visit our <a href="https://github.com/telosnews/TelosTax" target="_blank" rel="noopener noreferrer" className="text-telos-blue-400 hover:text-telos-blue-300 underline">GitHub repository</a>.
            </p>
          </section>
        </div>

        {/* Footer */}
        <div className="text-xs text-slate-600 mt-12 text-center leading-relaxed">
          <p>This tool is for informational purposes only and does not constitute tax advice.</p>
          <div className="flex items-center justify-center gap-3 mt-2">
            <button onClick={() => navigate('/pledge')} className="text-slate-400 hover:text-slate-300 transition-colors">About</button>
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
