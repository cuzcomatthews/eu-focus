'use client';

import { useSession, signOut } from 'next-auth/react';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Leaf,
  LayoutDashboard,
  KanbanSquare,
  TreePine,
  Users,
  BarChart3,
  Settings,
  LogOut,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  MoreHorizontal,
  MessageCircle,
} from 'lucide-react';
import { useTimerStore } from '@/stores/timerStore';
import styles from './dashboard.module.css';

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/workspace', label: 'Workspace', icon: KanbanSquare },
  { href: '/focus', label: 'Focus Garden', icon: TreePine },
  { href: '/accountability', label: 'Accountability', icon: MessageCircle },
  { href: '/squads', label: 'Squads', icon: Users },
  { href: '/analytics', label: 'Analytics', icon: BarChart3 },
  { href: '/settings', label: 'Settings', icon: Settings },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const { phase, timeRemaining, activeTaskTitle, restoreFromStorage } = useTimerStore();

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    }
  }, [status, router]);

  useEffect(() => {
    restoreFromStorage();
  }, [restoreFromStorage]);

  // Timer tick interval
  useEffect(() => {
    const tick = useTimerStore.getState().tick;
    const interval = setInterval(() => {
      tick();
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  if (status === 'loading') {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--bg-primary)',
        color: 'var(--text-secondary)',
      }}>
        Loading...
      </div>
    );
  }

  if (!session) return null;

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const showFloatingTimer = phase !== 'idle' && pathname !== '/focus';

  return (
    <div className={`${styles.dashboardLayout} ${isSidebarCollapsed ? styles.layoutCollapsed : ''}`}>
      <aside className={`${styles.sidebar} ${isSidebarCollapsed ? styles.sidebarCollapsed : ''} ${isMobileSidebarOpen ? styles.sidebarMobileOpen : ''}`}>
        <div className={styles.sidebarHeader}>
          <div className={styles.sidebarLogo}>
            <Leaf size={20} />
          </div>
          <span className={styles.sidebarTitle}>EU FOCUS</span>
          <button
            className={styles.sidebarCollapseBtn}
            onClick={() => setIsSidebarCollapsed((prev) => !prev)}
            title={isSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {isSidebarCollapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
          </button>
        </div>

        <nav className={styles.sidebarNav}>
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setIsMobileSidebarOpen(false)}
              className={`${styles.navLink} ${
                pathname === item.href ? styles.navLinkActive : ''
              }`}
              title={isSidebarCollapsed ? item.label : undefined}
            >
              <item.icon size={20} className={styles.navIcon} />
              <span className={styles.navLabel}>{item.label}</span>
            </Link>
          ))}
        </nav>

        <div className={styles.sidebarFooter}>
          <div className={styles.userInfo}>
            <div className={styles.userAvatar}>
              {session.user?.image ? (
                <img src={session.user.image} alt="" />
              ) : (
                session.user?.name?.[0]?.toUpperCase() || 'U'
              )}
            </div>
            <span className={styles.userName}>
              {session.user?.name || session.user?.email}
            </span>
            <button
              className={styles.logoutBtn}
              onClick={() => signOut({ callbackUrl: '/login' })}
              title="Sign out"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>

      {isMobileSidebarOpen && <button className={styles.sidebarBackdrop} onClick={() => setIsMobileSidebarOpen(false)} aria-label="Close sidebar" />}

      <main className={styles.mainContent}>
        <div className={styles.mobileTopBar}>
          <button className={styles.mobileTopBtn} onClick={() => setIsMobileSidebarOpen(true)} title="Open sidebar">
            <MoreHorizontal size={20} />
          </button>
          <button className={styles.mobileTopBtn} onClick={() => setIsSidebarCollapsed((prev) => !prev)} title="Toggle sidebar width">
            <Menu size={20} />
          </button>
        </div>
        <div className={styles.pageContainer}>
          {children}
        </div>
      </main>

      {showFloatingTimer && (
        <Link href="/focus" className={styles.floatingTimer}>
          <div className={`${styles.floatingTimerDot} ${
            phase === 'break' ? styles.floatingTimerDotBreak : ''
          }`} />
          <div>
            <div className={styles.floatingTimerTime}>
              {formatTime(timeRemaining)}
            </div>
            <div className={styles.floatingTimerTask}>
              {activeTaskTitle || 'Focus session'}
            </div>
          </div>
        </Link>
      )}
    </div>
  );
}
