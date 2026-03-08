import WhoopDashboard from "@/components/WhoopDashboard";

export default function Home() {
  return (
    <>
      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 nav-blur bg-background/80 border-b border-border">
        <div className="mx-auto max-w-6xl px-6 flex items-center justify-between h-14">
          <a href="/" className="text-lg font-semibold tracking-tight gradient-text">
            Ascent
          </a>
          <div className="flex items-center gap-6">
            <a href="/privacy" className="text-xs text-muted hover:text-foreground transition-colors">
              Privacy
            </a>
            <a
              href="https://matthewjamesschmidt.com"
              className="text-xs text-muted hover:text-foreground transition-colors"
            >
              matthewjamesschmidt.com
            </a>
          </div>
        </div>
      </nav>

      <main className="pt-24 pb-16">
        <div className="mx-auto max-w-6xl px-6">
          {/* Header */}
          <div className="mb-12">
            <p className="text-sm uppercase tracking-[0.2em] text-muted mb-3">
              Health Dashboard
            </p>
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-3">
              <span className="gradient-text">Ascent</span>
            </h1>
            <p className="text-muted max-w-xl leading-relaxed">
              Live biometrics tracked with{" "}
              <a
                href="https://whoop.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-foreground hover:underline"
              >
                Whoop
              </a>
              . Recovery, sleep, strain, and workout data — updated every 5 minutes.
            </p>
          </div>

          <WhoopDashboard />
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border py-6">
        <div className="mx-auto max-w-6xl px-6 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-xs text-muted">
            &copy; {new Date().getFullYear()} Matthew James Schmidt
          </p>
          <div className="flex items-center gap-4">
            <a href="/privacy" className="text-xs text-muted hover:text-foreground transition-colors">
              Privacy Policy
            </a>
            <span className="text-xs text-muted">Powered by Whoop API</span>
          </div>
        </div>
      </footer>
    </>
  );
}
