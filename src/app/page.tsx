import Link from 'next/link';
import { Timer, BarChart3, Users } from 'lucide-react';
import styles from './page.module.css';

export default function HomePage() {
  return (
    <div className={styles.page}>
      <nav className={styles.nav}>
        <span className={styles.logo}>EU Focus</span>
        <Link href="/login" className={styles.signIn}>
          Sign In
        </Link>
      </nav>

      <section className={styles.hero}>
        <div className={styles.heroBadge}>
          <span className={styles.heroBadgeDot} />
          Pomodoro-based productivity
        </div>

        <h1 className={styles.heroTitle}>
          Turn every minute into{' '}
          <span className={styles.heroTitleAccent}>real progress</span>
        </h1>

        <p className={styles.heroSub}>
          Deep work timer, habit tracking, and team accountability — all in one
          place. Build the focus you&rsquo;ve always wanted.
        </p>

        <div className={styles.heroCta}>
          <Link href="/register" className={styles.ctaPrimary}>
            Get Started Free
          </Link>
          <Link href="/dashboard" className={styles.ctaSecondary}>
            View Demo
          </Link>
        </div>

        <div className={styles.pomodoroVisual}>
          <div className={styles.pomodoroGlow} />
          <svg className={styles.pomodoroSvg} viewBox="0 0 240 240">
            <defs>
              <linearGradient id="pomodoroGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#6366f1" />
                <stop offset="100%" stopColor="#8b5cf6" />
              </linearGradient>
            </defs>
            <circle
              className={styles.pomodoroBg}
              cx="120"
              cy="120"
              r="105"
            />
            <circle
              className={styles.pomodoroProgress}
              cx="120"
              cy="120"
              r="105"
            />
          </svg>
          <div className={styles.pomodoroCenter}>
            <span className={styles.pomodoroTime}>25:00</span>
            <span className={styles.pomodoroLabel}>focus session</span>
          </div>
        </div>
      </section>

      <section className={styles.features}>
        <p className={styles.featuresLabel}>How it works</p>
        <h2 className={styles.featuresTitle}>Three tools. One flow.</h2>

        <div className={styles.featureGrid}>
          <div className={styles.featureCard}>
            <div className={`${styles.featureIcon} ${styles.featureIconFocus}`}>
              <Timer size={22} />
            </div>
            <h3 className={styles.featureName}>Deep Focus</h3>
            <p className={styles.featureDesc}>
              Pomodoro timer with ambient sounds, lofi scenes, and YouTube
              integrations. Stay in flow longer.
            </p>
          </div>

          <div className={styles.featureCard}>
            <div className={`${styles.featureIcon} ${styles.featureIconHabit}`}>
              <BarChart3 size={22} />
            </div>
            <h3 className={styles.featureName}>Track Progress</h3>
            <p className={styles.featureDesc}>
              Streak system, analytics dashboard, and habit tracking. See your
              consistency grow week after week.
            </p>
          </div>

          <div className={styles.featureCard}>
            <div className={`${styles.featureIcon} ${styles.featureIconSquad}`}>
              <Users size={22} />
            </div>
            <h3 className={styles.featureName}>Squad Sync</h3>
            <p className={styles.featureDesc}>
              Real-time collaboration with your team. Shared accountability,
              activity feeds, and group streaks.
            </p>
          </div>
        </div>
      </section>

      <section className={styles.finalCta}>
        <div className={styles.finalCtaBg} />
        <h2 className={styles.finalCtaTitle}>
          Ready to eliminate procrastination?
        </h2>
        <p className={styles.finalCtaSub}>
          Join the Focus Garden. One pomodoro at a time.
        </p>
        <Link href="/register" className={styles.ctaPrimary}>
          Start Free
        </Link>
      </section>

      <footer className={styles.footer}>
        <span className={styles.footerLeft}>&copy; {new Date().getFullYear()} EU Focus</span>
        <div className={styles.footerLinks}>
          <Link href="/privacy" className={styles.footerLink}>
            Privacy
          </Link>
          <Link href="/terms" className={styles.footerLink}>
            Terms
          </Link>
        </div>
      </footer>
    </div>
  );
}
