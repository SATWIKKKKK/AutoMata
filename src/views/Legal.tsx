import React from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft } from 'lucide-react';
import { View } from '../App';

interface LegalProps {
  onViewChange: (view: View) => void;
}

function LegalShell({ title, lastUpdated, children, onViewChange }: { title: string; lastUpdated: string; children: React.ReactNode; onViewChange: (view: View) => void }) {
  return (
    <div className="min-h-screen bg-background relative overflow-x-hidden">
      <div className="fixed inset-0 blueprint-grid opacity-20 pointer-events-none" />
      <nav className="sticky top-0 z-50 border-b border-blueprint-line bg-white/80 backdrop-blur-md">
        <div className="max-w-[1440px] mx-auto flex items-center justify-between px-4 md:px-8 h-16">
          <button onClick={() => onViewChange('landing')} className="font-serif italic text-2xl text-primary tracking-tight">AUTOMATA</button>
          <button onClick={() => onViewChange('landing')} className="flex items-center gap-2 text-sm text-blueprint-muted hover:text-primary transition-colors">
            <ArrowLeft size={16} /> Back
          </button>
        </div>
      </nav>
      <main className="max-w-3xl mx-auto px-4 sm:px-8 py-16 relative z-10">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
          <div className="space-y-2">
            <h1 className="text-4xl font-serif italic text-primary">{title}</h1>
            <p className="text-sm text-blueprint-muted font-mono">Last updated: {lastUpdated}</p>
          </div>
          <div className="prose prose-neutral max-w-none space-y-8 text-blueprint-muted leading-relaxed">
            {children}
          </div>
        </motion.div>
      </main>
      <footer className="border-t border-blueprint-line py-8 px-8 bg-white relative z-10 mt-16">
        <div className="max-w-[1440px] mx-auto flex flex-wrap gap-6 justify-center text-xs text-blueprint-muted font-mono">
          {(['privacy', 'terms', 'security'] as View[]).map(v => (
            <button key={v} onClick={() => onViewChange(v)} className="hover:text-primary transition-colors uppercase">{v}</button>
          ))}
        </div>
      </footer>
    </div>
  );
}

export function Privacy({ onViewChange }: LegalProps) {
  return (
    <LegalShell title="Privacy Policy" lastUpdated="April 27, 2026" onViewChange={onViewChange}>
      <section>
        <h2 className="text-xl font-semibold text-primary mb-3">1. Information We Collect</h2>
        <p>We collect information you provide directly to us when you create an account, such as your name, email address, and password. We also collect information about how you use the platform including workflow configurations, execution logs, and usage metrics.</p>
      </section>
      <section>
        <h2 className="text-xl font-semibold text-primary mb-3">2. How We Use Your Information</h2>
        <p>We use the information we collect to operate and improve the Automata platform, provide customer support, send transactional emails, and comply with legal obligations. We do not sell your personal data to third parties.</p>
      </section>
      <section>
        <h2 className="text-xl font-semibold text-primary mb-3">3. Data Storage</h2>
        <p>Your workflow data is stored in an encrypted SQLite database on your local instance or our secure cloud infrastructure. API keys and secrets are encrypted at rest using industry-standard AES-256 encryption.</p>
      </section>
      <section>
        <h2 className="text-xl font-semibold text-primary mb-3">4. Third-Party Services</h2>
        <p>Automata integrates with third-party services (Gmail, Slack, HubSpot, etc.) only when you explicitly authorise these connections. We access only the minimum permissions required to execute your configured workflows.</p>
      </section>
      <section>
        <h2 className="text-xl font-semibold text-primary mb-3">5. Your Rights</h2>
        <p>You have the right to access, correct, or delete your personal data at any time. Contact us at privacy@automata.ai to exercise these rights. We will respond within 30 days.</p>
      </section>
      <section>
        <h2 className="text-xl font-semibold text-primary mb-3">6. Contact</h2>
        <p>For any privacy-related questions, reach out to: <span className="font-mono text-primary">privacy@automata.ai</span></p>
      </section>
    </LegalShell>
  );
}

export function Terms({ onViewChange }: LegalProps) {
  return (
    <LegalShell title="Terms of Service" lastUpdated="April 27, 2026" onViewChange={onViewChange}>
      <section>
        <h2 className="text-xl font-semibold text-primary mb-3">1. Acceptance of Terms</h2>
        <p>By accessing or using the Automata platform, you agree to be bound by these Terms of Service. If you do not agree, please do not use the platform.</p>
      </section>
      <section>
        <h2 className="text-xl font-semibold text-primary mb-3">2. Use of the Platform</h2>
        <p>You may use Automata only for lawful purposes. You are responsible for all activity that occurs under your account. You may not use the platform to transmit malware, perform unauthorized data scraping, or violate any applicable laws.</p>
      </section>
      <section>
        <h2 className="text-xl font-semibold text-primary mb-3">3. API Keys and Credentials</h2>
        <p>You are responsible for keeping your API keys and credentials secure. Automata stores credentials in encrypted form but cannot be held liable for losses resulting from your failure to maintain credential security.</p>
      </section>
      <section>
        <h2 className="text-xl font-semibold text-primary mb-3">4. Billing and Payments</h2>
        <p>Paid plans are billed monthly. Payments are processed via Razorpay (coming soon). Refunds may be issued at our discretion within 7 days of a billing event for unused capacity.</p>
      </section>
      <section>
        <h2 className="text-xl font-semibold text-primary mb-3">5. Intellectual Property</h2>
        <p>Automata retains all rights to the platform software. Workflows you create remain your intellectual property. You grant Automata a limited licence to execute your workflows on your behalf.</p>
      </section>
      <section>
        <h2 className="text-xl font-semibold text-primary mb-3">6. Limitation of Liability</h2>
        <p>Automata is provided "as is". To the maximum extent permitted by law, we are not liable for any indirect, incidental, or consequential damages arising from your use of the platform.</p>
      </section>
      <section>
        <h2 className="text-xl font-semibold text-primary mb-3">7. Contact</h2>
        <p>For legal inquiries: <span className="font-mono text-primary">legal@automata.ai</span></p>
      </section>
    </LegalShell>
  );
}

export function SecurityPage({ onViewChange }: LegalProps) {
  return (
    <LegalShell title="Security" lastUpdated="April 27, 2026" onViewChange={onViewChange}>
      <section>
        <h2 className="text-xl font-semibold text-primary mb-3">Infrastructure Security</h2>
        <p>Automata runs on hardened infrastructure with network-level isolation between tenant workloads. All traffic is encrypted in transit via TLS 1.3. Database encryption uses AES-256 at rest.</p>
      </section>
      <section>
        <h2 className="text-xl font-semibold text-primary mb-3">Credential Management</h2>
        <p>API keys and OAuth tokens are encrypted using a per-tenant Fernet key before storage. Decryption only occurs at workflow execution time within an isolated worker process. Keys are never logged or exposed in UI responses.</p>
      </section>
      <section>
        <h2 className="text-xl font-semibold text-primary mb-3">Authentication</h2>
        <p>Passwords are hashed using bcrypt with a minimum work factor of 12. Session tokens are short-lived JWTs signed with a rotating secret. We plan to support passkeys and hardware security keys in a future release.</p>
      </section>
      <section>
        <h2 className="text-xl font-semibold text-primary mb-3">Workflow Isolation</h2>
        <p>Each workflow execution runs in an isolated worker process. Workflows cannot access other tenants' data or credentials. Execution logs are tenant-scoped and not shared.</p>
      </section>
      <section>
        <h2 className="text-xl font-semibold text-primary mb-3">Responsible Disclosure</h2>
        <p>If you discover a security vulnerability, please report it responsibly to <span className="font-mono text-primary">security@automata.ai</span>. We aim to acknowledge reports within 24 hours and resolve critical issues within 72 hours.</p>
      </section>
      <section>
        <h2 className="text-xl font-semibold text-primary mb-3">Compliance</h2>
        <p>We are working towards SOC 2 Type II compliance. Enterprise customers can request our security questionnaire and audit reports by contacting our sales team.</p>
      </section>
    </LegalShell>
  );
}
