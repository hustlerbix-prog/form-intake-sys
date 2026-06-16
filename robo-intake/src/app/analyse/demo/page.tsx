export default function AnalyseDemoPage() {
  return (
    <div className="min-h-screen bg-navy flex items-center justify-center px-6">
      <div className="max-w-xl w-full">
        <div className="text-teal font-syne text-lg font-bold">ROBO AI Agency</div>
        <h1 className="mt-6 text-white font-syne text-3xl font-bold tracking-tight">Sandbox Demo</h1>
        <p className="mt-4 text-slateText leading-7">
          This is a standalone scripted version of the intake form with no API calls.
        </p>
        <div className="mt-8 flex flex-col sm:flex-row gap-3">
          <a
            href="/sandbox/intake-form.html"
            className="inline-flex items-center justify-center rounded-lg bg-teal text-navy font-bold px-5 h-11 hover:brightness-110 transition"
          >
            Open sandbox
          </a>
          <a
            href="/analyse"
            className="inline-flex items-center justify-center rounded-lg border border-navy-600 text-white font-semibold px-5 h-11 hover:bg-navy-800 transition"
          >
            Back to live intake
          </a>
        </div>
      </div>
    </div>
  );
}

