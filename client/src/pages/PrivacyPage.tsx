import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Shield } from 'lucide-react';

export default function PrivacyPage() {
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
          <span className="font-bold text-4xl"><span className="text-telos-orange-400">Telos</span><span className="text-telos-blue-400">Tax</span></span>
          <h1 className="text-2xl sm:text-3xl font-bold text-white">Privacy Policy</h1>
        </div>

        <div className="prose prose-invert max-w-none space-y-6 text-slate-300 text-sm leading-relaxed">
          <p className="text-slate-400 text-xs">Last updated: March 22, 2026</p>

          {/* TL;DR box */}
          <div className="card bg-telos-blue-600/10 border-telos-blue-600/30">
            <h3 className="text-base font-semibold text-telos-blue-300 mb-2">The short version</h3>
            <p className="text-slate-300">
              Your tax data never leaves your computer. We don't collect data. We don't use cookies.
              We don't track you. Your tax return exists only on your device, encrypted with a
              passphrase only you know. If you enable AI features (BYOK mode), only PII-stripped
              messages pass through our relay server — and nothing is stored.
            </p>
          </div>

          {/* Prototype warning */}
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-amber-500/10 rounded-lg text-amber-400 shrink-0">
                <Shield className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-amber-300 mb-1.5">Important: This is a prototype</h3>
                <p className="text-xs text-slate-300 leading-relaxed">
                  This tool is for informational purposes only and does not constitute tax advice.
                  Do not use this app to file your taxes without having your return carefully reviewed
                  by a qualified tax professional. TelosTax needs vetting by tax experts and human
                  coders, which is why it&apos;s available as a free, open-source project. The tax engine
                  may contain errors. If you&apos;re a tax professional or developer who&apos;d like to help
                  stress-test the app, please get in touch.
                </p>
              </div>
            </div>
          </div>

          <section>
            <h2 className="text-lg font-semibold text-white mt-6 mb-3">1. What Tax Data We Collect</h2>
            <p className="font-semibold text-telos-orange-300">None.</p>
            <p>
              TelosTax runs entirely in your web browser. When you enter tax information — names,
              income, deductions, Social Security Numbers — that data is stored in your browser's <code className="text-telos-orange-300 bg-surface-800 px-1.5 py-0.5 rounded">localStorage</code> on
              your device. It is never transmitted over the internet.
            </p>
            <p>
              There is no TelosTax server that receives, processes, or stores your information. The
              application is static HTML, CSS, and JavaScript files served to your browser. After those
              files load, all operations happen locally.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mt-6 mb-3">2. Data Storage</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b border-slate-700">
                    <th className="text-left py-2 pr-4 text-slate-400 font-medium">Data Type</th>
                    <th className="text-left py-2 pr-4 text-slate-400 font-medium">Where Stored</th>
                    <th className="text-left py-2 text-slate-400 font-medium">Transmitted?</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-slate-800">
                    <td className="py-2 pr-4">Everything you enter (name, address, income, deductions)</td>
                    <td className="py-2 pr-4">Browser localStorage, encrypted when a passphrase is set</td>
                    <td className="py-2 text-telos-orange-300">Never</td>
                  </tr>
                  <tr className="border-b border-slate-800">
                    <td className="py-2 pr-4">Social Security Number (last 4 digits only)</td>
                    <td className="py-2 pr-4">Browser localStorage (AES-256-GCM encrypted)</td>
                    <td className="py-2 text-telos-orange-300">Never</td>
                  </tr>
                  <tr className="border-b border-slate-800">
                    <td className="py-2 pr-4">Imported documents (PDFs, CSVs, photos)</td>
                    <td className="py-2 pr-4">Read in your browser and discarded after extraction</td>
                    <td className="py-2 text-telos-orange-300">Never</td>
                  </tr>
                  <tr className="border-b border-slate-800">
                    <td className="py-2 pr-4">Tax calculation results</td>
                    <td className="py-2 pr-4">Browser memory (RAM)</td>
                    <td className="py-2 text-telos-orange-300">Never</td>
                  </tr>
                  <tr className="border-b border-slate-800">
                    <td className="py-2 pr-4">PDF, CSV, JSON, and .telostax exports</td>
                    <td className="py-2 pr-4">Generated in browser, saved to your device</td>
                    <td className="py-2 text-telos-orange-300">Never</td>
                  </tr>
                  <tr className="border-b border-slate-800">
                    <td className="py-2 pr-4">AI chat conversations (BYOK mode)</td>
                    <td className="py-2 pr-4">Browser localStorage (AES-256-GCM encrypted)</td>
                    <td className="py-2 text-slate-400">PII-stripped messages sent to Anthropic via our relay server</td>
                  </tr>
                  <tr className="border-b border-slate-800">
                    <td className="py-2 pr-4">Installed app cache (PWA)</td>
                    <td className="py-2 pr-4">Static files only — never tax data</td>
                    <td className="py-2 text-telos-orange-300">Never</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mt-6 mb-3">2a. Passphrase Protection</h2>
            <p>
              When you set a passphrase, TelosTax encrypts your saved data with AES-256-GCM — the same
              standard banks and governments use. Your passphrase is never saved to disk; it is held in
              memory only while the app is unlocked.
            </p>
            <p>
              After 15 minutes of inactivity the app locks itself automatically and your passphrase is
              cleared from memory. You will need to re-enter it to continue.
            </p>
            <p>
              There is no "forgot password" option because we never have your passphrase. We recommend
              exporting a backup of your data (see Section 6) so you always have a copy.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mt-6 mb-3">2b. Document Import</h2>
            <p>
              TelosTax can read data from PDFs, scanned documents, photos, broker CSV files, TXF files,
              FDX files, and popular tax software exports. Every one of these imports is processed
              entirely in your browser — nothing is uploaded to any server.
            </p>
            <p>
              Optical character recognition (OCR) for scanned documents and photos runs locally using
              self-hosted open-source software bundled with the app.
            </p>
            <p>
              If an imported document contains a full Social Security Number, it is immediately truncated
              to the last four digits before being stored.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mt-6 mb-3">3. Cookies & Tracking</h2>
            <p>
              TelosTax does not use cookies, analytics scripts, tracking pixels, fingerprinting, or any
              other tracking technology. We do not use Google Analytics, Facebook Pixel, Mixpanel, or
              any similar service.
            </p>
            <p>
              We do not collect browser information, device identifiers, or usage patterns. If you use
              BYOK mode, our relay server temporarily stores your IP address in a local database
              strictly for rate limiting (to prevent abuse). This data is not tied to your tax return,
              is not shared with any third party, and is automatically purged.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mt-6 mb-3">4. Third Parties</h2>
            <p>
              In Private Mode (the default), no third party receives any of your data. There are no
              analytics, tracking, or data-sharing integrations.
            </p>
            <p>
              If you enable BYOK Mode (Bring Your Own Key), PII-stripped messages are sent through our
              server to Anthropic's API using your own API key. Before any message leaves your browser,
              SSNs, EINs, addresses, phone numbers, and other personally identifiable information are
              detected and removed. Our server performs a second PII scan as defense-in-depth, then
              relays the message to Anthropic and discards it. See Section 13 for full details on how
              BYOK mode handles your data.
            </p>
            <p>
              The application may load open-source font files or other static assets from a CDN when the
              page loads, but these requests do not include any of your tax data.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mt-6 mb-3">5. Data Deletion</h2>
            <p>
              You can delete all of your tax data at any time using the "Delete all my data" button,
              available on the export page of any tax return and in the lower-left corner below the
              tools panel. This permanently removes everything — saved returns, encryption keys,
              browser storage, and offline app data. Nothing survives.
            </p>
            <p>
              You can also clear your data by clearing your browser's site data for this domain, or by
              using your browser's "Clear browsing data" feature.
            </p>
            <p>
              Since no copy of your data exists on any server, deletion is instant and irreversible. There
              is no "account" to close and no data retention period.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mt-6 mb-3">6. Data Portability</h2>
            <p>
              TelosTax provides one-click export in four formats: JSON, CSV, PDF, and <code className="text-telos-orange-300 bg-surface-800 px-1.5 py-0.5 rounded">.telostax</code> (an
              encrypted, password-protected format for safe backup and transfer). You can export your
              complete tax return data at any time from the export page. This data belongs to you and
              can be imported into other tools or kept for your records.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mt-6 mb-3">7. IRC Section 7216 Compliance</h2>
            <p>
              IRC Section 7216 prohibits tax return preparers from disclosing or using tax return
              information for purposes other than preparing the return. Because TelosTax is a self-preparation
              tool (you prepare your own return), and because your data never leaves your device, the
              traditional 7216 disclosure obligations that apply to paid preparers and cloud-based tax
              software do not apply in the same way.
            </p>
            <p>
              Nevertheless, we have designed TelosTax to exceed the privacy protections contemplated by
              Section 7216: we cannot disclose your data because we never possess it.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mt-6 mb-3">8. Security</h2>
            <p>
              Here's what we do on our end to protect your data:
            </p>
            <ul className="list-disc list-inside space-y-1 text-slate-400">
              <li>All saved data is encrypted with AES-256-GCM when you set a passphrase</li>
              <li>The app automatically locks after 15 minutes of inactivity and clears your passphrase from memory</li>
              <li>The app makes no outside network connections with your tax data — ever</li>
              <li>If you install TelosTax as an app (PWA), only static files are cached — never your tax data</li>
            </ul>
            <p className="mt-3">
              Because your data also depends on the security of your device and browser, we recommend:
            </p>
            <ul className="list-disc list-inside space-y-1 text-slate-400">
              <li>Using a password or biometric lock on your device</li>
              <li>Keeping your browser and operating system updated</li>
              <li>Not using TelosTax on shared or public computers</li>
              <li>Exporting and saving your data before clearing browser data</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mt-6 mb-3">9. Children's Privacy</h2>
            <p>
              TelosTax is designed for adults who need to prepare tax returns. We do not knowingly collect
              information from children under 13. Since we collect no data at all, this is inherently
              satisfied.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mt-6 mb-3">10. Open Source Verification</h2>
            <p>
              Every claim in this privacy policy can be independently verified by examining our source
              code. The calculation engine is open source under the MIT License. The application code
              contains no network calls that transmit user data. We encourage security researchers to
              audit our code.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mt-6 mb-3">11. Changes to This Policy</h2>
            <p>
              If we change this policy, we will update this page with the new policy and the date
              of the change. We committed early on that any feature transmitting data would require
              explicit consent — BYOK mode fulfills that commitment: it is entirely opt-in, clearly
              labeled, and disabled by default.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mt-6 mb-3">12. Contact</h2>
            <p>
              Questions about this privacy policy? Email us at <a href="mailto:ryan@telos.news" className="text-telos-blue-400 hover:text-telos-blue-300 underline">ryan@telos.news</a> or visit our <a href="https://github.com/telosnews/TelosTax" target="_blank" rel="noopener noreferrer" className="text-telos-blue-400 hover:text-telos-blue-300 underline">GitHub repository</a>.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mt-6 mb-3">13. AI Features (BYOK Mode)</h2>
            <p>
              TelosTax includes an optional AI assistant powered by Anthropic's Claude. It is disabled
              by default (Private Mode). To use it, you must explicitly switch to BYOK (Bring Your Own
              Key) mode and provide your own Anthropic API key.
            </p>
            <h3 className="text-sm font-semibold text-slate-200 mt-4 mb-2">What is sent</h3>
            <p>
              When you send a chat message in BYOK mode, the following is transmitted: your message
              text (after PII removal), conversation history (up to 10 messages), and non-identifying
              context about your position in the tax wizard (e.g., filing status, which step you're on,
              how many income forms you've entered — but never names, SSNs, addresses, or exact dollar
              amounts).
            </p>
            <h3 className="text-sm font-semibold text-slate-200 mt-4 mb-2">How PII is blocked</h3>
            <p>
              Before any message leaves your browser, a client-side scanner detects and removes Social
              Security Numbers, EINs, phone numbers, email addresses, street addresses, dates of birth,
              and other PII. Our server runs a second scan as defense-in-depth. You can inspect every
              outbound request — including what was blocked — in the Privacy Audit Log (accessible from
              AI Settings).
            </p>
            <h3 className="text-sm font-semibold text-slate-200 mt-4 mb-2">How our server works</h3>
            <p>
              Our server acts as a relay (required for browser CORS restrictions). It forwards your
              PII-stripped message to Anthropic using your API key, returns the response, and discards
              both. It does not store, log, cache, or read your messages or API key. The server code is
              open source.
            </p>
            <h3 className="text-sm font-semibold text-slate-200 mt-4 mb-2">What Anthropic does</h3>
            <p>
              Anthropic says it does not use API data for model training, and that API inputs and
              outputs are retained for up to 30 days for safety monitoring, then automatically
              deleted. For full details,
              see <a href="https://www.anthropic.com/privacy" target="_blank" rel="noopener noreferrer" className="text-telos-blue-400 hover:text-telos-blue-300 underline">Anthropic's privacy policy</a>.
            </p>
            <h3 className="text-sm font-semibold text-slate-200 mt-4 mb-2">AI features that use BYOK</h3>
            <ul className="list-disc list-inside space-y-1 text-slate-400">
              <li>AI chat conversations and tax Q&A</li>
              <li>Smart Expense Scanner (AI-powered transaction categorization)</li>
              <li>AI-enhanced document extraction (scanned PDFs and photos)</li>
              <li>Voice data entry via dictation</li>
            </ul>
            <p className="mt-3">
              All AI features are additive — the complete tax engine, smart suggestions, document
              import, and all 82 wizard steps work without AI in Private Mode.
            </p>
          </section>
        </div>

        {/* Footer */}
        <div className="text-xs text-slate-600 mt-12 text-center leading-relaxed">
          <p>This tool is for informational purposes only and does not constitute tax advice.</p>
          <div className="flex items-center justify-center gap-3 mt-2">
            <button onClick={() => navigate('/pledge')} className="text-slate-400 hover:text-slate-300 transition-colors">About</button>
            <span className="text-slate-700">&middot;</span>
            <button onClick={() => navigate('/terms')} className="text-slate-400 hover:text-slate-300 transition-colors">Terms</button>
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
