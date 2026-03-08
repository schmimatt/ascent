import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy — Ascent",
  description: "Privacy policy for Ascent health dashboard.",
};

export default function PrivacyPage() {
  return (
    <>
      <nav className="fixed top-0 left-0 right-0 z-50 nav-blur bg-background/80 border-b border-border">
        <div className="mx-auto max-w-3xl px-6 flex items-center justify-between h-14">
          <a href="/" className="text-lg font-semibold tracking-tight gradient-text">
            Ascent
          </a>
          <a href="/" className="text-xs text-muted hover:text-foreground transition-colors">
            Dashboard
          </a>
        </div>
      </nav>

      <main className="pt-24 pb-16">
        <div className="mx-auto max-w-3xl px-6">
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-2">
            Privacy Policy
          </h1>
          <p className="text-sm text-muted mb-12">Last updated: March 8, 2026</p>

          <div className="space-y-8 text-muted leading-relaxed">
            <section>
              <h2 className="text-lg font-semibold text-foreground mb-3">Overview</h2>
              <p>
                Ascent (<strong>ascent.matthewjamesschmidt.com</strong>) is a personal health
                dashboard built by Matthew James Schmidt. It displays health and fitness
                data retrieved from the Whoop API. This privacy policy explains what data
                is collected, how it is used, and your rights.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground mb-3">Data We Access</h2>
              <p className="mb-3">
                Ascent connects to the Whoop API using OAuth 2.0 to access the following
                data from the site owner&apos;s Whoop account only:
              </p>
              <ul className="list-disc list-inside space-y-1">
                <li>Profile information (name)</li>
                <li>Body measurements (height, weight, max heart rate)</li>
                <li>Recovery scores (recovery %, HRV, resting heart rate, SpO2, skin temperature)</li>
                <li>Sleep data (duration, stages, efficiency, respiratory rate)</li>
                <li>Strain and cycle data (daily strain, calories, heart rate)</li>
                <li>Workout data (activity type, duration, strain, heart rate zones, distance)</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground mb-3">How Data Is Used</h2>
              <ul className="list-disc list-inside space-y-1">
                <li>Health data is displayed publicly on this dashboard for personal/portfolio purposes.</li>
                <li>Data is fetched from the Whoop API on each page load and cached for up to 5 minutes.</li>
                <li>No health data is stored in a database or persisted beyond the server cache.</li>
                <li>No health data is shared with third parties, sold, or used for advertising.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground mb-3">Data We Do Not Collect</h2>
              <ul className="list-disc list-inside space-y-1">
                <li>We do not collect any data from visitors to this site.</li>
                <li>We do not use cookies, analytics, or tracking scripts.</li>
                <li>We do not access any Whoop account other than the site owner&apos;s.</li>
                <li>We do not store Whoop credentials on the client side.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground mb-3">Authentication</h2>
              <p>
                Whoop API access is authenticated via OAuth 2.0. Access tokens are
                short-lived (1 hour) and refresh tokens are stored securely as server-side
                environment variables. No authentication credentials are exposed to the
                browser or any client-side code.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground mb-3">Third-Party Services</h2>
              <ul className="list-disc list-inside space-y-1">
                <li><strong>Whoop API</strong> — source of health data. See <a href="https://www.whoop.com/privacy/" target="_blank" rel="noopener noreferrer" className="text-foreground underline hover:no-underline">Whoop&apos;s Privacy Policy</a>.</li>
                <li><strong>Vercel</strong> — hosting platform. See <a href="https://vercel.com/legal/privacy-policy" target="_blank" rel="noopener noreferrer" className="text-foreground underline hover:no-underline">Vercel&apos;s Privacy Policy</a>.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground mb-3">Data Retention</h2>
              <p>
                No health data is permanently stored. Data is fetched in real-time from the
                Whoop API and cached in server memory for up to 5 minutes. When the cache
                expires, fresh data is fetched from Whoop.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground mb-3">Your Rights</h2>
              <p>
                If you have questions about this privacy policy or the data displayed on
                this site, please contact Matthew James Schmidt via the links on{" "}
                <a href="https://matthewjamesschmidt.com" className="text-foreground underline hover:no-underline">
                  matthewjamesschmidt.com
                </a>.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground mb-3">Changes</h2>
              <p>
                This privacy policy may be updated from time to time. Changes will be
                reflected on this page with an updated date.
              </p>
            </section>
          </div>
        </div>
      </main>

      <footer className="border-t border-border py-6">
        <div className="mx-auto max-w-3xl px-6 flex items-center justify-between">
          <p className="text-xs text-muted">
            &copy; {new Date().getFullYear()} Matthew James Schmidt
          </p>
          <a href="/" className="text-xs text-muted hover:text-foreground transition-colors">
            Back to Dashboard
          </a>
        </div>
      </footer>
    </>
  );
}
