import Link from 'next/link';
import { ArrowRight, Users, BarChart3, ShieldCheck, TimerReset, Activity } from 'lucide-react';
import styles from './page.module.css';

const benefits = [
  {
    title: 'Coordination Score',
    text: 'Measure how your personal execution aligns with team reliability and contribution.',
    icon: Users,
  },
  {
    title: 'Focus Infrastructure',
    text: 'Convert every intention into concrete focus blocks with environmental support.',
    icon: TimerReset,
  },
  {
    title: 'Behavior Analytics',
    text: 'See consistency, streak quality, and failure patterns before they compound.',
    icon: BarChart3,
  },
];

const faqs = [
  {
    q: 'How is the social factor calculated?',
    a: 'It combines participation quality, execution consistency, and delivery reliability over time.',
  },
  {
    q: 'Can I track my own stats and team stats?',
    a: 'Yes. Individual dashboards and social views coexist so you can compare behavior in context.',
  },
  {
    q: 'Does it work for solo users?',
    a: 'Yes. Solo mode gives you personal metrics and later lets you join squads when you want.',
  },
];

export default function Home() {
  return (
    <div className={styles.page}>
      <div className={styles.backgroundHalo} />

      <header className={styles.navbar}>
        <div className={styles.logo}>EU Focus</div>
        <nav>
          <a href="#how">How</a>
          <a href="#social">Social Factor</a>
          <a href="#stats">Stats</a>
          <a href="#pricing">Pricing</a>
        </nav>
        <Link href="/login" className={styles.navCta}>Sign In</Link>
      </header>

      <section className={styles.hero}>
        <p className={styles.kicker}>Behavioral coordination platform</p>
        <h1>Find your rhythm. Prove your reliability. Improve your social execution.</h1>
        <p>
          EU Focus helps you transform daily focus sessions into measurable outcomes. From personal streaks to
          social performance, every action contributes to a clear, trackable coordination profile.
        </p>
        <div className={styles.heroActions}>
          <Link href="/register" className={styles.primaryBtn}>
            Start Free
            <ArrowRight size={16} />
          </Link>
          <Link href="/dashboard" className={styles.secondaryBtn}>View Product</Link>
        </div>
      </section>

      <section id="how" className={styles.section}>
        <h2>How the system works</h2>
        <div className={styles.steps}>
          <article>
            <span>01</span>
            <h3>Plan</h3>
            <p>Create tasks with clear intent and define what done means.</p>
          </article>
          <article>
            <span>02</span>
            <h3>Execute</h3>
            <p>Run focus cycles with tracklist and ambient controls designed for deep sessions.</p>
          </article>
          <article>
            <span>03</span>
            <h3>Analyze</h3>
            <p>Review outputs, consistency, and trends through your analytics dashboard.</p>
          </article>
          <article>
            <span>04</span>
            <h3>Coordinate</h3>
            <p>Use social signals to improve team reliability and collaborative pace.</p>
          </article>
        </div>
      </section>

      <section id="social" className={styles.sectionAlt}>
        <div className={styles.splitLeft}>
          <h2>Social Factor, clearly measured</h2>
          <p>
            Your Coordination Score is not guesswork. It is composed of concrete behavioral dimensions and visible over time.
          </p>
          <div className={styles.formula}>Score = 0.40 Consistency + 0.35 Participation + 0.25 Reliability</div>
        </div>
        <div className={styles.splitRight}>
          <ul>
            <li><Users size={16} /> Participation in squads and shared sessions</li>
            <li><Activity size={16} /> Consistency of completed focus commitments</li>
            <li><ShieldCheck size={16} /> Reliability against planned outcomes</li>
          </ul>
        </div>
      </section>

      <section id="stats" className={styles.section}>
        <h2>Why teams and solo builders choose EU Focus</h2>
        <div className={styles.benefits}>
          {benefits.map((item) => (
            <article key={item.title}>
              <item.icon size={18} />
              <h3>{item.title}</h3>
              <p>{item.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className={styles.sectionAltSimple}>
        <h2>Features you can use today</h2>
        <div className={styles.featureTags}>
          <span>Deep Focus Timer</span>
          <span>Ambient Sound Stack</span>
          <span>Tracklist Player</span>
          <span>Task Execution Metrics</span>
          <span>Streak Visualization</span>
          <span>Squad Coordination Views</span>
          <span>Analytics Export</span>
          <span>Progress Trends</span>
        </div>
      </section>

      <section id="pricing" className={styles.section}>
        <h2>Simple pricing to start</h2>
        <div className={styles.pricingRow}>
          <article>
            <h3>Starter</h3>
            <p className={styles.price}>$0</p>
            <p>Personal focus and basic analytics.</p>
          </article>
          <article>
            <h3>Pro</h3>
            <p className={styles.price}>$30</p>
            <p>Advanced tracking, playlists, and exports.</p>
          </article>
          <article>
            <h3>Team</h3>
            <p className={styles.price}>$100</p>
            <p>Social factor dashboards and squad intelligence.</p>
          </article>
        </div>
      </section>

      <section className={styles.sectionAltSimple}>
        <h2>FAQ</h2>
        <div className={styles.faqList}>
          {faqs.map((item) => (
            <article key={item.q}>
              <h3>{item.q}</h3>
              <p>{item.a}</p>
            </article>
          ))}
        </div>
      </section>

      <section className={styles.finalCta}>
        <div className={styles.finalStageGrid}>
          <article className={styles.finalStageLead}>
            <p className={styles.finalEyebrow}>Final step</p>
            <h2>Stop treating focus as mood. Treat it as operating behavior.</h2>
            <p>
              EU Focus turns your daily sessions into evidence. You can defend your consistency,
              improve your team reliability, and ship with fewer coordination failures.
            </p>
            <div className={styles.finalActions}>
              <Link href="/register" className={styles.primaryBtnLarge}>
                Create Account
                <ArrowRight size={18} />
              </Link>
              <Link href="/dashboard" className={styles.secondaryBtn}>Explore Dashboard</Link>
            </div>
          </article>

          <article className={styles.finalStageSignal}>
            <h3>What improves first</h3>
            <ul>
              <li>Task completion becomes predictable, not random.</li>
              <li>Streak quality rises because sessions are trackable.</li>
              <li>Social factor trends stop depending on memory.</li>
            </ul>
            <div className={styles.signalStats}>
              <div>
                <strong>7d</strong>
                <span>faster behavior feedback loop</span>
              </div>
              <div>
                <strong>1 view</strong>
                <span>individual + social execution context</span>
              </div>
            </div>
          </article>
        </div>
      </section>

      <footer className={styles.footer}>
        <div className={styles.footerBrand}>
          <strong>EU Focus</strong>
          <p>Focus performance and social coordination in one operating system.</p>
        </div>
        <div className={styles.footerLinks}>
          <a href="#">Privacy</a>
          <a href="#">Terms</a>
          <a href="#">Contact</a>
        </div>
      </footer>
    </div>
  );
}
