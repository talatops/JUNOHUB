import Link from "next/link";

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4 md:p-6 relative overflow-hidden auth-glass-dark">
      <div className="w-full max-w-3xl relative z-10">
        <div className="bg-white/5 backdrop-blur-xl rounded-2xl md:rounded-3xl p-6 md:p-10 border border-white/10 text-slate-100">
          <header className="mb-8">
            <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-white mb-2">
              Privacy Policy
            </h1>
            <p className="text-sm text-slate-400">
              This page explains how JUNO collects, uses, and protects your
              data, including data accessed from connected services such as
              Gmail.
            </p>
          </header>

          <div className="space-y-6 text-sm md:text-base leading-relaxed text-slate-200">
            <section>
              <h2 className="text-lg font-semibold text-white mb-2">
                1. Overview
              </h2>
              <p>
                JUNO is a dropshipping and e-commerce management platform. We
                collect and process only the data necessary to provide and
                improve our services, operate your account, and integrate with
                third-party platforms you choose to connect.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-white mb-2">
                2. Data We Collect
              </h2>
              <p className="mb-2">
                When you use JUNO, we may collect the following categories of
                data:
              </p>
              <ul className="list-disc list-inside space-y-1 text-slate-200">
                <li>Account information (name, email address, role).</li>
                <li>
                  Store and order data from your connected e-commerce platforms.
                </li>
                <li>
                  Configuration and usage data related to your JUNO account.
                </li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-white mb-2">
                3. Gmail and Google Data
              </h2>
              <p className="mb-2">
                If you connect your Gmail account, JUNO will request access
                to Gmail scopes that allow us to read relevant messages in order
                to power JUNO&apos;s email and support features.
              </p>
              <ul className="list-disc list-inside space-y-1 text-slate-200 mb-2">
                <li>
                  Gmail data is used solely to provide in-app functionality such
                  as viewing, classifying, and responding to customer emails.
                </li>
                <li>
                  We do not sell or share Gmail content with third parties for
                  advertising or marketing purposes.
                </li>
                <li>
                  Access to Gmail data is restricted to the JUNO systems that
                  need it to provide the features you enable.
                </li>
              </ul>
              <p>
                You can revoke JUNO&apos;s access to your Google account at
                any time via your Google Account security settings.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-white mb-2">
                4. How We Use Your Data
              </h2>
              <p className="mb-2">We use your data to:</p>
              <ul className="list-disc list-inside space-y-1 text-slate-200">
                <li>Authenticate you and operate your JUNO account.</li>
                <li>
                  Sync and manage products, orders, and inventory with your
                  connected stores.
                </li>
                <li>
                  Provide analytics, notifications, and workflow automation
                  features.
                </li>
                <li>
                  Improve the reliability, security, and performance of JUNO.
                </li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-white mb-2">
                5. Data Storage and Security
              </h2>
              <p>
                We store data using industry-standard security practices and
                restrict access to authorized personnel and services only. While
                no system can be perfectly secure, we continuously work to
                protect your information from unauthorized access, disclosure,
                alteration, or destruction.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-white mb-2">
                6. Your Rights and Choices
              </h2>
              <p className="mb-2">
                Depending on your jurisdiction, you may have rights to:
              </p>
              <ul className="list-disc list-inside space-y-1 text-slate-200">
                <li>Access the personal data we store about you.</li>
                <li>Request correction or deletion of your personal data.</li>
                <li>Restrict or object to certain types of processing.</li>
                <li>Export your data where technically feasible.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-white mb-2">
                7. Contact
              </h2>
              <p>
                If you have questions about this Privacy Policy or our data
                practices, please contact us using the support email provided in
                your JUNO account or documentation.
              </p>
            </section>

            <section className="pt-4 border-t border-white/10 mt-6 text-xs text-slate-400">
              <p>
                This Privacy Policy is provided for informational purposes and
                may be updated from time to time as JUNO evolves.
              </p>
            </section>
          </div>

          <footer className="mt-8 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
            <span>JUNO Systems &copy; {new Date().getFullYear()}</span>
            <div className="flex items-center gap-4">
              <Link
                href="/terms-of-service"
                className="hover:text-indigo-300 underline-offset-4 hover:underline"
              >
                Terms of Service
              </Link>
              <Link
                href="/login"
                className="hover:text-indigo-300 underline-offset-4 hover:underline"
              >
                Back to Login
              </Link>
            </div>
          </footer>
        </div>
      </div>
    </div>
  );
}
