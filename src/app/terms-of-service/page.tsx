import Link from "next/link";

export default function TermsOfServicePage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4 md:p-6 relative overflow-hidden auth-glass-dark">
      <div className="w-full max-w-3xl relative z-10">
        <div className="bg-white/5 backdrop-blur-xl rounded-2xl md:rounded-3xl p-6 md:p-10 border border-white/10 text-slate-100">
          <header className="mb-8">
            <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-white mb-2">
              Terms of Service
            </h1>
            <p className="text-sm text-slate-400">
              These Terms govern your use of JUNO. By creating an account or
              using the platform, you agree to these Terms.
            </p>
          </header>

          <div className="space-y-6 text-sm md:text-base leading-relaxed text-slate-200">
            <section>
              <h2 className="text-lg font-semibold text-white mb-2">
                1. Using JUNO
              </h2>
              <p>
                JUNO provides tools for managing dropshipping and e-commerce
                operations. You agree to use the platform only for lawful
                purposes and in compliance with all applicable laws and
                regulations.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-white mb-2">
                2. Accounts and Security
              </h2>
              <p className="mb-2">
                You are responsible for maintaining the confidentiality of your
                account credentials and for all activity that occurs under your
                account.
              </p>
              <ul className="list-disc list-inside space-y-1 text-slate-200">
                <li>Keep your password secure and do not share it.</li>
                <li>
                  Notify us promptly of any unauthorized access or security
                  issues.
                </li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-white mb-2">
                3. Third-Party Integrations
              </h2>
              <p className="mb-2">
                JUNO integrates with third-party services such as e-commerce
                platforms and email providers (including Gmail). Your use of
                those services is also governed by their respective terms and
                policies.
              </p>
              <p>
                By connecting these services, you authorize JUNO to access
                and process data from them as necessary to provide in-app
                features, subject to our{" "}
                <Link
                  href="/privacy-policy"
                  className="underline underline-offset-4 hover:text-indigo-300"
                >
                  Privacy Policy
                </Link>
                .
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-white mb-2">
                4. Data and Content
              </h2>
              <p className="mb-2">
                You retain ownership of your data and content. By using JUNO,
                you grant us a limited license to process that data solely to
                operate and improve the service.
              </p>
              <p>
                You are responsible for ensuring that you have all necessary
                rights and permissions to use and process any data you connect
                to JUNO.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-white mb-2">
                5. Service Availability
              </h2>
              <p>
                We aim to provide a reliable and performant service, but JUNO
                is provided on an &quot;as is&quot; and &quot;as available&quot;
                basis. We may modify, suspend, or discontinue features from time
                to time.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-white mb-2">
                6. Limitation of Liability
              </h2>
              <p>
                To the maximum extent permitted by law, JUNO will not be
                liable for indirect, incidental, special, consequential, or
                punitive damages, or any loss of profits or revenues arising out
                of or related to your use of the service.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-white mb-2">
                7. Changes to These Terms
              </h2>
              <p>
                We may update these Terms from time to time. If we make
                material changes, we will provide notice by appropriate means.
                Your continued use of JUNO after the changes become
                effective constitutes your acceptance of the updated Terms.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-white mb-2">
                8. Contact
              </h2>
              <p>
                If you have any questions about these Terms, please contact us
                using the support email provided in your JUNO account or
                documentation.
              </p>
            </section>

            <section className="pt-4 border-t border-white/10 mt-6 text-xs text-slate-400">
              <p>
                These Terms of Service are provided for informational purposes
                and may be updated from time to time as JUNO evolves.
              </p>
            </section>
          </div>

          <footer className="mt-8 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
            <span>JUNO Systems &copy; {new Date().getFullYear()}</span>
            <div className="flex items-center gap-4">
              <Link
                href="/privacy-policy"
                className="hover:text-indigo-300 underline-offset-4 hover:underline"
              >
                Privacy Policy
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
