import Link from 'next/link';
import { MedicareModeler } from '@/src/components/MedicareModeler';

export const metadata = {
  title: 'How Medicare works',
  description: 'A plain-English guide to Medicare for retirement planning.',
};

export default function MedicarePage() {
  return (
    <article className="mx-auto max-w-3xl space-y-10">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">How Medicare works</h1>
        <p className="mt-2 text-sm opacity-70">
          A plain-English guide to the parts, the costs, and the timing — weighted toward what matters for your
          retirement plan. General information, not advice; dollar figures are approximate 2025 and change yearly.
        </p>
      </header>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">The basics</h2>
        <p className="text-sm leading-relaxed opacity-80">
          Medicare is federal health insurance that starts at <strong>age 65</strong> (earlier in some disability
          cases). It isn&apos;t one plan — it&apos;s a set of &quot;parts,&quot; and you choose how to combine them.
          The two routes are <strong>Original Medicare</strong> (Parts A + B, usually plus a Part D drug plan and a
          Medigap supplement) or <strong>Medicare Advantage</strong> (Part C — a private all-in-one plan).
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">The parts</h2>
        <div className="overflow-x-auto rounded-lg border border-black/10 dark:border-white/10">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-black/10 text-left dark:border-white/10">
                <th className="p-3 font-medium">Part</th>
                <th className="p-3 font-medium">Covers</th>
                <th className="p-3 font-medium">Typical cost (2025)</th>
              </tr>
            </thead>
            <tbody>
              <Part part="A — Hospital" covers="Inpatient hospital, skilled nursing, hospice" cost="$0 premium for most (if you paid Medicare taxes ~10 years)" />
              <Part part="B — Medical" covers="Doctor visits, outpatient care, tests, equipment" cost="~$185/mo premium + ~$257 annual deductible" />
              <Part part="C — Advantage" covers="Private all-in-one alternative to A+B, usually bundling D" cost="Often low/$0 premium, but network-restricted" />
              <Part part="D — Drugs" covers="Prescription drugs (private plans)" cost="Varies; premium + deductible, now a $2,000 out-of-pocket cap" />
              <Part part="Medigap" covers="Supplements Original Medicare — pays the A/B deductibles & coinsurance" cost="~$120–$250/mo depending on plan letter, age, location" />
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">The big decision: Original + Medigap vs. Advantage</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-lg border border-black/10 p-4 dark:border-white/10">
            <h3 className="font-medium">Original Medicare + Medigap + Part D</h3>
            <p className="mt-2 text-sm opacity-75">
              Use <strong>any</strong> doctor or hospital that takes Medicare, nationwide, no referrals. Predictable
              costs once Medigap fills the gaps. Downside: higher monthly premiums (B + Medigap + D).
            </p>
          </div>
          <div className="rounded-lg border border-black/10 p-4 dark:border-white/10">
            <h3 className="font-medium">Medicare Advantage (Part C)</h3>
            <p className="mt-2 text-sm opacity-75">
              Lower premiums, often extras (dental, vision, gym). Downside: <strong>networks</strong> and
              prior-authorization, and costs can climb if you get seriously ill. Switching back to Medigap later can
              require medical underwriting, so the first choice matters.
            </p>
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">What it really costs</h2>
        <p className="text-sm leading-relaxed opacity-80">
          The headline premium is only part of it. For a typical person on Original Medicare in 2025:
        </p>
        <ul className="list-disc space-y-1 pl-5 text-sm opacity-80">
          <li><strong>Part A:</strong> usually $0 premium, but a <strong>~$1,676 deductible per hospital stay</strong> if
            you&apos;re admitted (Medigap covers this).</li>
          <li><strong>Part B:</strong> ~$185/mo premium + ~$257 annual deductible, then Medicare pays 80% and
            <strong> you pay the other 20% with no cap</strong> — which is the main thing Medigap exists to cover.</li>
          <li><strong>Part D:</strong> a premium plus cost-sharing, now capped at <strong>$2,000 out-of-pocket per
            year</strong>.</li>
          <li><strong>Medigap:</strong> ~$120–$250/mo depending on the plan letter (Plan G is the common choice),
            your age, and where you live.</li>
        </ul>
        <p className="text-sm leading-relaxed opacity-80">
          Rough all-in: a healthy couple on Original Medicare + Medigap + Part D often runs{' '}
          <strong>~$10,000–$14,000/year combined</strong> before IRMAA; a single person <strong>~$5,000–$7,000</strong>.
          Advantage plans lower the premiums but shift more cost to when you&apos;re sick. Model your own mix below.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Model your Medicare cost</h2>
        <p className="text-sm opacity-70">
          Adjust income, coverage, and premiums to see the annual cost and how IRMAA kicks in. Figures are
          approximate 2025.
        </p>
        <div className="rounded-lg border border-black/10 p-4 dark:border-white/10">
          <MedicareModeler />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">IRMAA — the high-income surcharge</h2>

        <div className="overflow-x-auto rounded-lg border border-black/10 dark:border-white/10">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-black/10 text-left dark:border-white/10">
                <th className="p-3 font-medium">Income — single</th>
                <th className="p-3 font-medium">Income — married</th>
                <th className="p-3 font-medium">Extra per person / year (B + D)</th>
              </tr>
            </thead>
            <tbody>
              <Irmaa single="up to $106k" married="up to $212k" extra="$0" />
              <Irmaa single="$106k–$133k" married="$212k–$266k" extra="~$1,050" />
              <Irmaa single="$133k–$167k" married="$266k–$334k" extra="~$2,640" />
              <Irmaa single="$167k–$200k" married="$334k–$400k" extra="~$4,240" />
              <Irmaa single="$200k–$500k" married="$400k–$750k" extra="~$5,830" />
              <Irmaa single="over $500k" married="over $750k" extra="~$6,360" />
            </tbody>
          </table>
        </div>
        <p className="text-xs opacity-50">
          Approximate 2025 combined Part B + Part D surcharge, <em>per person</em> — so a married couple both on
          Medicare pays it twice. Thresholds aren&apos;t inflation-indexed the way tax brackets are.
        </p>

        <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 text-sm leading-relaxed">
          <p>
            If your income is high, you pay a surcharge on <strong>both Part B and Part D</strong> premiums, called
            IRMAA. Three things make it tricky:
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li><strong>Two-year lookback:</strong> your premium is based on your income from <em>two years prior</em> —
              so income at 63 sets your premium at 65.</li>
            <li><strong>It&apos;s a cliff:</strong> going $1 over a bracket jumps you the whole tier.</li>
            <li><strong>You can appeal</strong> (form <strong>SSA-44</strong>) after a &quot;life-changing event&quot; —
              and <em>retiring</em> counts. If the old return reflects working income you no longer have, ask for a
              reduction.</li>
          </ul>
          <p className="mt-2">
            This is exactly why Roth conversions are best done <strong>before</strong> that lookback window — see the{' '}
            <Link href="/roth/lifetime" className="underline underline-offset-4">lifetime Roth analysis</Link>.
          </p>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Part D got much better (2025)</h2>
        <p className="text-sm leading-relaxed opacity-80">
          The Inflation Reduction Act overhauled prescription coverage:
        </p>
        <ul className="list-disc space-y-1 pl-5 text-sm opacity-80">
          <li>A hard <strong>$2,000 annual out-of-pocket cap</strong> on covered drugs — the old &quot;donut hole&quot;
            coverage gap is effectively gone.</li>
          <li><strong>Insulin capped at $35/month</strong>; recommended vaccines are free.</li>
          <li>You can <strong>spread</strong> that $2,000 across the year (the Medicare Prescription Payment Plan).</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Enrollment & penalties — don&apos;t miss the window</h2>
        <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-4 text-sm leading-relaxed">
          <ul className="list-disc space-y-1 pl-5">
            <li><strong>Initial window:</strong> a 7-month period around your 65th birthday.</li>
            <li><strong>Late penalties are permanent.</strong> Part B adds 10% per 12 months you delay; Part D adds 1%
              of the base premium per month — for life.</li>
            <li><strong>Still working at 65?</strong> With qualifying employer coverage you can delay Part B
              penalty-free, then get an 8-month Special Enrollment Period after you stop.</li>
            <li><strong>Retiring before 65?</strong> You bridge with ACA marketplace or COBRA coverage, then enroll in
              Medicare at 65.</li>
          </ul>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">HSA gotcha</h2>
        <p className="text-sm leading-relaxed opacity-80">
          Enrolling in <em>any</em> part of Medicare stops HSA contributions. If you want to keep funding an HSA past
          65, you have to delay Medicare — which only works if you have other qualifying coverage.
        </p>
      </section>

      <section className="space-y-3 rounded-lg border border-black/10 p-4 dark:border-white/10">
        <h2 className="text-lg font-semibold">How this connects to your plan</h2>
        <p className="text-sm leading-relaxed opacity-80">
          Your plan&apos;s healthcare cost is really Part B + Part D + Medigap + out-of-pocket. Rather than guess,
          build it from the pieces with the estimator on your{' '}
          <Link href="/profile" className="underline underline-offset-4">profile</Link> (&quot;Estimate from Medicare
          costs&quot;). And because IRMAA rides on income, the{' '}
          <Link href="/roth/lifetime" className="underline underline-offset-4">lifetime Roth model</Link> factors it
          into every conversion year.
        </p>
      </section>

      <p className="text-xs opacity-50">
        Sources to verify current numbers: medicare.gov, ssa.gov (IRMAA and SSA-44), and your plan&apos;s Summary of
        Benefits. This page is educational and not financial or medical advice.
      </p>
    </article>
  );
}

function Part({ part, covers, cost }: { part: string; covers: string; cost: string }) {
  return (
    <tr className="border-b border-black/5 last:border-0 dark:border-white/5">
      <td className="p-3 font-medium whitespace-nowrap">{part}</td>
      <td className="p-3 opacity-80">{covers}</td>
      <td className="p-3 opacity-80">{cost}</td>
    </tr>
  );
}

function Irmaa({ single, married, extra }: { single: string; married: string; extra: string }) {
  return (
    <tr className="border-b border-black/5 last:border-0 dark:border-white/5">
      <td className="p-3 opacity-80">{single}</td>
      <td className="p-3 opacity-80">{married}</td>
      <td className="p-3 font-medium">{extra}</td>
    </tr>
  );
}
