'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Flame, Play, Users, Target } from 'lucide-react';
import styles from './dashboard.module.css';

interface DashboardData {
  streak: number;
  longestStreak: number;
  nextTask: {
    id: string;
    title: string;
    dueDate: string | null;
    estimatedPomodoros: number;
    completedPomodoros: number;
  } | null;
  todayPomodoros: number;
  squadActivity: {
    id: string;
    userName: string;
    userAvatar: string | null;
    taskTitle: string;
    durationMinutes: number;
    createdAt: string;
  }[];
  analytics: {
    weeklyConsistency: number;
    completionRate: number;
    habitHealth: number;
    dailyGoalProgress: number;
  };
}

const Ring = ({ value, color, label }: { value: number, color: string, label: string }) => {
  const safeValue = Math.max(0, Math.min(100, value));
  const radius = 24;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (safeValue / 100) * circumference;

  return (
    <div className={styles.ringWrapper}>
      <svg className={styles.ringSvg} width="72" height="72" viewBox="0 0 72 72">
        <circle
          className={styles.ringBg}
          cx="36" cy="36" r={radius}
        />
        <circle
          className={styles.ringProgress}
          cx="36" cy="36" r={radius}
          style={{ 
            stroke: color, 
            strokeDasharray: circumference, 
            strokeDashoffset 
          }}
        />
      </svg>
      <div className={styles.ringValue}>{safeValue}%</div>
      <div className={styles.ringLabel}>{label}</div>
    </div>
  );
};

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);

  useEffect(() => {
    fetch('/api/dashboard')
      .then(res => res.json())
      .then(setData)
      .catch(() => {});
  }, []);

  return (
    <div className={styles.page}>
      
      {/* Top Section: Hero & Streak Component */}
      <div className={styles.topSection}>
        
        {/* Hero Card */}
        <div className={styles.heroCard}>
          <div className={styles.heroContent}>
            <div className={styles.heroTag}>MORNING SESSION</div>
            <h1 className={styles.heroTitle}>
              Ready for<br />
              <span className={styles.heroHighlight}>Deep Focus Mode?</span>
            </h1>
            <p className={styles.heroSubtitle}>
              Your energy levels are peaking. This is the optimal time for complex problem solving.
            </p>
            
            <div className={styles.heroActions}>
              {data?.nextTask ? (
                <Link href={`/focus?taskId=${data.nextTask.id}`} className={styles.primaryBtn}>
                  START POMODORO
                </Link>
              ) : (
                <Link href={`/focus`} className={styles.primaryBtn}>
                  START POMODORO
                </Link>
              )}
              <Link href="/workspace" className={styles.secondaryBtn}>
                View Schedule
              </Link>
            </div>
          </div>
          
          <div className={styles.heroTimerVisual}>
            <div className={styles.timerBox}>
              <div className={styles.timerDot} />
              <div className={styles.timerText}>25:00</div>
              <div className={styles.timerLabel}>BASE TIMER</div>
            </div>
          </div>
        </div>

        {/* Global Streak / Momentum Card */}
        <div className={styles.streakCard}>
          <div className={styles.streakHeader}>
            <Flame className={styles.streakIconSm} size={16} />
            MOMENTUM
          </div>
          
          <div className={styles.streakMain}>
            <div className={styles.streakNumber}>{data?.streak || 0}</div>
            <div className={styles.streakText}>Day Streak</div>
          </div>
          
          <p className={styles.streakMessage}>
            Don&apos;t break the chain! Complete just 1 more pomodoro today to maintain your Momentum level.
          </p>
          
          <div className={styles.streakBgFlame}>
            <Flame size={120} />
          </div>
        </div>
      </div>

      <div className={styles.mainGrid}>
        <div className={styles.leftCol}>
          <div className={styles.analyticsCard}>
            <div className={styles.cardHeader}>
              <h2 className={styles.cardTitle}>Focus Analytics</h2>
              <span className={styles.cardSubtitle}>Real-time velocity tracking</span>
              <span className={styles.weekLabel}>THIS WEEK</span>
            </div>

            <div className={styles.ringsContainer}>
              <Ring value={data?.analytics?.weeklyConsistency ?? 0} color="#14b8a6" label="7-DAY CONSISTENCY" />
              <Ring value={data?.analytics?.completionRate ?? 0} color="#58cc02" label="FOCUS QUALITY" />
              <Ring value={data?.analytics?.dailyGoalProgress ?? 0} color="#ff9600" label="DAILY GOAL" />
              <Ring value={data?.analytics?.habitHealth ?? 0} color="#3b82f6" label="HABIT HEALTH" />
            </div>
          </div>


        </div>

        {/* Right Column: Up Next & Squad */}
        <div className={styles.rightCol}>
          
          {/* Up Next List */}
          <div className={styles.upNextCard}>
            <div className={styles.cardHeaderSmall}>
              <h3>Up Next</h3>
              <Link href="/workspace" className={styles.editLink}>Edit List</Link>
            </div>
            
            <div className={styles.taskList}>
              {data?.nextTask ? (
                <div className={styles.taskRow}>
                  <div className={styles.taskStatusIndicator} />
                  <div className={styles.taskDetails}>
                    <div className={styles.taskRowTitle}>{data.nextTask.title}</div>
                    <div className={styles.taskRowMeta}>
                      {data.nextTask.estimatedPomodoros * 25} MINS • PRIORITY
                    </div>
                  </div>
                  <Link href={`/focus?taskId=${data.nextTask.id}`} className={styles.taskPlayBtn}>
                    <Play size={16} />
                  </Link>
                </div>
              ) : (
                 <div className={styles.emptyTaskRow}>
                    <Target size={18} />
                    <span>No priority tasks scheduled.</span>
                 </div>
              )}
            </div>
          </div>

          {/* Squad Activity */}
          <div className={styles.squadCard}>
            <div className={styles.cardHeaderSmall}>
              <h3><Users size={16} /> Squad Activity</h3>
            </div>
            
            <div className={styles.activityList}>
              {data?.squadActivity && data.squadActivity.length > 0 ? (
                data.squadActivity.map((activity) => (
                  <div key={activity.id} className={styles.activityItem}>
                    <div className={styles.activityAvatar}>
                      {activity.userAvatar ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={activity.userAvatar} alt={activity.userName} width={32} height={32} style={{ borderRadius: '50%' }} />
                      ) : (
                        activity.userName.substring(0, 2).toUpperCase()
                      )}
                    </div>
                    <div className={styles.activityContent}>
                      <p><strong>{activity.userName}</strong> completed a <strong>{activity.durationMinutes}m</strong> session for <em>{activity.taskTitle}</em></p>
                      <span className={styles.activityTime}>
                        {new Date(activity.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • FOCUS
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <div className={styles.emptyTaskRow}>
                  <Users size={18} />
                  <span>No recent squad activity.</span>
                </div>
              )}
            </div>
            
            <Link href="/squads" className={styles.squadBtn}>
              Open Squad Chat
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
