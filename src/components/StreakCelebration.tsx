'use client';

import { useEffect, useState } from 'react';
import { Flame } from 'lucide-react';
import styles from './StreakCelebration.module.css';

interface StreakCelebrationProps {
  streak: number;
  onComplete: () => void;
}

export default function StreakCelebration({ streak, onComplete }: StreakCelebrationProps) {
  const [stage, setStage] = useState<'hidden' | 'entering' | 'celebrating' | 'leaving'>('hidden');

  useEffect(() => {
    // Sequence
    setStage('entering');
    
    const t1 = setTimeout(() => {
      setStage('celebrating');
    }, 600);
    
    const t2 = setTimeout(() => {
      setStage('leaving');
    }, 3500);
    
    const t3 = setTimeout(() => {
      setStage('hidden');
      onComplete();
    }, 4000);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [onComplete]);

  if (stage === 'hidden') return null;

  return (
    <div className={styles.overlay}>
      <div className={`${styles.container} ${styles[stage]}`}>
        <div className={styles.flameContainer}>
          <Flame className={styles.flameIcon} size={120} />
          {/* Particles */}
          <div className={`${styles.particle} ${styles.p1}`} />
          <div className={`${styles.particle} ${styles.p2}`} />
          <div className={`${styles.particle} ${styles.p3}`} />
          <div className={`${styles.particle} ${styles.p4}`} />
          <div className={`${styles.particle} ${styles.p5}`} />
          <div className={`${styles.particle} ${styles.p6}`} />
        </div>
        
        <div className={styles.textContainer}>
          <h2 className={styles.title}>{streak} DAY STREAK!</h2>
          <p className={styles.subtitle}>You're on fire! Keep the momentum.</p>
        </div>
      </div>
    </div>
  );
}
