'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Image from 'next/image';
import {
  Users, Flame, Send, Pin, Eye, Clock, Plus, Trash2,
  MessageCircle, Activity, Pencil, X, BarChart2, Share2, Image as ImageIcon, ChevronLeft
} from 'lucide-react';
import styles from './squads.module.css';

type Tab = 'members' | 'stats';

type UserStreak = {
  type: string;
  currentCount: number;
};

type SquadListItem = {
  id: string;
  name: string;
  streakCount: number;
  _count: {
    members: number;
  };
};

type SquadPin = {
  id: string;
  contentHtml: string;
  createdAt: string;
  author: {
    name: string | null;
    avatarUrl: string | null;
  };
};

type SquadMessage = {
  id: string;
  authorId: string;
  content: string;
  imageUrl: string | null;
  createdAt: string;
  author?: {
    name: string | null;
    avatarUrl: string | null;
  } | null;
};

type SquadMember = {
  id: string;
  userId: string;
  joinedAt: string;
  user: {
    id: string;
    name: string | null;
    avatarUrl: string | null;
    focusTime7d?: number;
    streaks?: UserStreak[];
  };
};

type SquadDetail = {
  id: string;
  name: string;
  maxMembers: number;
  streakCount: number;
  userId: string;
  members: SquadMember[];
  pins: SquadPin[];
  messages: SquadMessage[];
};

type SpyTask = {
  id: string;
  title: string;
  status: string;
  color: string;
  descriptionHtml: string | null;
  completedPomodoros: number;
  estimatedPomodoros: number;
  habit?: {
    name: string;
    iconSvg: string;
  } | null;
};

type SpyData = {
  tasks: SpyTask[];
};

const sanitizeImageSrc = (src?: string | null) => {
  if (!src) return null;
  const trimmed = src.trim();
  return trimmed.length > 0 ? trimmed : null;
};

export default function SquadsPage() {
  const [squadsList, setSquadsList] = useState<SquadListItem[]>([]);
  const [squad, setSquad] = useState<SquadDetail | null>(null);
  const [activeSquadId, setActiveSquadId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>('members');
  
  // Squad creation / joining
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [newSquadName, setNewSquadName] = useState('');
  const [joinCode, setJoinCode] = useState('');

  // Chat & Pin states
  const [message, setMessage] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [showChatPanel, setShowChatPanel] = useState(false);
  const [brokenImageIds, setBrokenImageIds] = useState<Record<string, boolean>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showPinModal, setShowPinModal] = useState(false);
  const [pinContent, setPinContent] = useState('');
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Edit & Spy states
  const [editingName, setEditingName] = useState(false);
  const [squadName, setSquadName] = useState('');
  const [spyData, setSpyData] = useState<SpyData | null>(null);
  const [showSpyModal, setShowSpyModal] = useState(false);
  const [selectedTask, setSelectedTask] = useState<SpyTask | null>(null);

  const fetchData = useCallback(async () => {
    if (!activeSquadId) {
      const res = await fetch('/api/squads');
      if (res.ok) {
        setSquadsList(await res.json());
      }
    } else {
      const res = await fetch(`/api/squads?id=${activeSquadId}`);
      if (res.ok) {
        const data = await res.json();
        setSquad(data);
        if (!editingName) setSquadName(data.name);
      }
    }
    setLoading(false);
  }, [activeSquadId, editingName]);

  useEffect(() => {
    fetchData();
    const i = setInterval(fetchData, 5000);
    return () => clearInterval(i);
  }, [fetchData]);

  useEffect(() => {
    if (showChatPanel && squad) {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [squad?.messages, showChatPanel, squad]);

  useEffect(() => {
    if (!showChatPanel) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowChatPanel(false);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [showChatPanel]);

  const doAction = async (action: string, extra = {}) => {
    const res = await fetch('/api/squads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, squadId: activeSquadId, ...extra }),
    });
    fetchData();
    return res;
  };

  const saveName = async () => {
    if (!squadName.trim()) return;
    await doAction('rename', { name: squadName });
    setEditingName(false);
  };

  const createPin = async () => {
    if (!pinContent.trim()) return;
    await doAction('pin', { contentHtml: pinContent.replace(/\n/g, '<br/>') });
    setPinContent('');
    setShowPinModal(false);
  };

  const sendMessage = async () => {
    if (!message.trim()) return;
    const currentMessage = message;
    setMessage('');
    await doAction('message', { content: currentMessage });
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // Check file type
    if (!file.type.startsWith('image/')) {
        alert("Please upload an image file.");
        return;
    }

    setIsUploading(true);
    try {
      const res = await fetch(`/api/upload?filename=${encodeURIComponent(file.name)}`, {
        method: 'POST', body: file
      });

      let data: { url?: string; warning?: string; error?: string } = {};
      try {
        data = await res.json();
      } catch {
        data = {};
      }

      if (res.ok && data.url) {
        await doAction('message', { content: 'Sent an image', imageUrl: data.url });
      } else {
        alert(data.error || "Image upload failed.");
      }
    } catch(err) {
      console.error(err);
      alert("An error occurred during upload.");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const openSpyModal = async (memberId: string) => {
    const res = await fetch(`/api/squads/spy?memberId=${memberId}`);
    if (res.ok) {
      setSpyData(await res.json());
      setShowSpyModal(true);
    } else {
      alert("Failed to spy on member. Ensure you share a squad.");
    }
  };

  const copyInvite = () => {
    if (!squad) return;
    navigator.clipboard.writeText(`JOIN-${squad.id.substring(0, 8).toUpperCase()}`);
    alert("Invite code copied to clipboard!");
  };

  const createSquad = async () => {
    if (!newSquadName.trim()) return;
    const res = await fetch('/api/squads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'create', name: newSquadName }),
    });
    if (res.ok) {
      const data = await res.json();
      setActiveSquadId(data.id);
      setShowCreateModal(false);
      setNewSquadName('');
    }
  };

  const joinSquad = async () => {
    if (!joinCode.trim()) return;

    const res = await fetch('/api/squads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'join', squadId: joinCode.replace(/^JOIN-/i, '').trim() }),
    });
    if (res.ok) {
      const data: { success?: boolean; id?: string; error?: string } = await res.json();
      if (data.success) {
        setActiveSquadId(data.id || joinCode.replace(/^JOIN-/i, '').trim());
      }
      setShowJoinModal(false);
      setJoinCode('');
    } else {
      let message = 'Failed to join squad.';
      try {
        const err = (await res.json()) as { error?: string };
        if (err?.error) message = err.error;
      } catch {
        // Keep fallback message when server responds with empty/non-JSON payload.
      }
      alert(message);
    }
  };

  const timeAgo = (date: string) => {
    const s = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
    if (s < 60) return 'Just now';
    if (s < 3600) return `${Math.floor(s / 60)}m ago`;
    if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
    return `${Math.floor(s / 86400)}d ago`;
  };

  if (loading) {
    return <div className={styles.emptyState}>Loading Squads...</div>;
  }

  // --- RENDERING SQUADS LIST ---
  if (!activeSquadId || (!squad && squadsList.length >= 0)) {
    return (
      <div className={styles.page}>
        <div className={styles.headerCard}>
          <div className={styles.headerLeft}>
            <Users size={32} color="var(--accent-primary)" />
            <div className={styles.squadInfo}>
              <h1>My Squads</h1>
              <p style={{ color: 'var(--text-muted)' }}>Join forces with friends and stay accountable together.</p>
            </div>
          </div>
          <div className={styles.headerRight}>
            <button className={styles.secondaryBtn} onClick={() => setShowJoinModal(true)}>Join Squad</button>
            <button className={styles.primaryBtn} onClick={() => setShowCreateModal(true)}>
              <Plus size={16} /> New Squad
            </button>
          </div>
        </div>

        {squadsList.length === 0 ? (
          <div className={styles.emptyState} style={{ marginTop: '32px' }}>
            <Users size={48} color="var(--text-muted)" style={{ marginBottom: '16px' }} />
            <h3>No Squads Yet</h3>
            <p>You are not in any squads. Create one or join an existing squad using an invite code.</p>
          </div>
        ) : (
          <div className={styles.storyboardGrid} style={{ marginTop: '32px' }}>
            {squadsList.map((sq) => (
              <div key={sq.id} className={styles.pinCard} style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column' }} onClick={() => setActiveSquadId(sq.id)}>
                <h3 style={{ fontSize: '18px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Users size={18} color="var(--accent-primary)" /> {sq.name}
                </h3>
                <div style={{ marginTop: 'auto', paddingTop: '16px', display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)', fontSize: '12px' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Users size={14} /> {sq._count.members} Members
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--accent-warning)' }}>
                    <Flame size={14} /> {sq.streakCount} Streak
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Modals for List View */}
        {(showCreateModal || showJoinModal) && (
          <div className={styles.modalOverlay}>
            <div className={styles.modalContent}>
              <h3>{showCreateModal ? 'Create New Squad' : 'Join a Squad'}</h3>
              <div style={{ margin: '16px 0' }}>
                {showCreateModal ? (
                  <input autoFocus placeholder="Squad Name (e.g. Morning Club)" className={styles.chatInput} value={newSquadName} onChange={e => setNewSquadName(e.target.value)} onKeyDown={e => e.key === 'Enter' && createSquad()} />
                ) : (
                  <input autoFocus placeholder="Enter code (e.g. JOIN-XXXXXX)" className={styles.chatInput} value={joinCode} onChange={e => setJoinCode(e.target.value)} onKeyDown={e => e.key === 'Enter' && joinSquad()} />
                )}
              </div>
              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                <button className={styles.secondaryBtn} onClick={() => { setShowCreateModal(false); setShowJoinModal(false); }}>Cancel</button>
                <button className={styles.primaryBtn} onClick={showCreateModal ? createSquad : joinSquad}>{showCreateModal ? 'Create' : 'Join'}</button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // If squad details failed to load
  if (!squad) return <div className={styles.emptyState}>Loading...</div>;

  // --- RENDERING SQUAD DETAIL ---
  return (
    <div className={styles.page}>
      
      {/* Squad Header */}
      <div className={styles.headerCard}>
        <div className={styles.headerLeft}>
          <button className={styles.iconBtn} onClick={() => setActiveSquadId(null)} style={{ marginRight: '16px' }} title="Back to Squads">
            <ChevronLeft size={24} />
          </button>
          <div className={styles.squadAvatar}>
            <Users size={32} />
          </div>
          <div className={styles.squadInfo}>
            {editingName ? (
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '4px' }}>
                <input 
                  className={styles.chatInput} 
                  style={{ padding: '6px 16px' }}
                  value={squadName} 
                  onChange={e => setSquadName(e.target.value)} 
                  autoFocus 
                  onBlur={saveName}
                  onKeyDown={e => e.key === 'Enter' && saveName()}
                />
              </div>
            ) : (
              <h1 onClick={() => setEditingName(true)} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
                {squad.name} <Pencil size={14} color="var(--text-muted)" />
              </h1>
            )}
            
            <div className={styles.squadMeta}>
              <button className={styles.inviteCode} onClick={copyInvite} title="Copy full ID to share">
                JOIN-{squad.id.substring(0, 8).toUpperCase()} <Share2 size={12} />
              </button>
              <span>{squad.members.length} / {squad.maxMembers} Members</span>
            </div>
          </div>
        </div>

        <div className={styles.headerRight}>
          <div className={styles.squadStreak} title="Squad Streak (Increments when any member is active)">
            <Flame size={20} fill="currentColor" />
            {squad.streakCount} Day{squad.streakCount !== 1 ? 's' : ''}
          </div>
          <button className={styles.secondaryBtn} onClick={async () => { await doAction('leave'); setActiveSquadId(null); }} style={{ color: 'var(--accent-danger)' }}>
            Leave
          </button>
        </div>
      </div>

      {/* STORYBOARD (Always Visible at Top) */}
      <div className={styles.tabContent} style={{ marginBottom: '32px', background: 'var(--bg-secondary)', padding: '24px', borderRadius: '16px' }}>
        <div className={styles.storyboardHeader}>
          <h2 style={{ fontSize: '18px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Pin size={18} color="var(--accent-primary)" /> Pinned Notes
          </h2>
          <button className={styles.secondaryBtn} onClick={() => setShowPinModal(true)}>
            <Plus size={16} /> New Pin
          </button>
        </div>
        
        {squad.pins.length > 0 ? (
          <div className={styles.storyboardGrid}>
            {squad.pins.map((pin) => (
              <div key={pin.id} className={styles.pinCard}>
                <button className={styles.deletePinBtn} onClick={() => doAction('deletePin', { pinId: pin.id })}>
                  <Trash2 size={14} />
                </button>
                <div className={styles.pinContent} dangerouslySetInnerHTML={{ __html: pin.contentHtml }} />
                <div className={styles.pinMeta}>
                  <div className={styles.pinAvatar}>
                    {pin.author.name?.[0]?.toUpperCase() || '?'}
                  </div>
                  <span>{pin.author.name} · {timeAgo(pin.createdAt)}</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className={styles.emptyState} style={{ padding: '24px', minHeight: 'auto', border: '1px dashed var(--border-color)' }}>
            <p>No pinned notes yet. Add one to share important rules or info!</p>
          </div>
        )}
      </div>

      {/* Navigation Tabs */}
      <div className={styles.tabsContainer}>
        <button className={styles.tab + (activeTab === 'members' ? ` ${styles.active}` : '')} onClick={() => setActiveTab('members')}>
          <Users size={16} className={styles.tabIcon} /> Members
        </button>
        <button className={styles.tab + (activeTab === 'stats' ? ` ${styles.active}` : '')} onClick={() => setActiveTab('stats')}>
          <BarChart2 size={16} className={styles.tabIcon} /> Stats (Leaderboard)
        </button>
        <button className={styles.tab} onClick={() => setShowChatPanel(true)}>
          <MessageCircle size={16} className={styles.tabIcon} /> Open Chat
        </button>
      </div>

      {/* Tab Content: MEMBERS */}
      {activeTab === 'members' && (
        <div className={styles.tabContent}>
          <div className={styles.membersGrid}>
            {squad.members.map((m) => {
              const u = m.user;
              const isMe = u.id === squad.userId; 
              const memberAvatarSrc = sanitizeImageSrc(u.avatarUrl);
              return (
                <div key={m.id} className={styles.memberCard}>
                  <div className={styles.memberHeader}>
                    <div className={styles.memberIdentity}>
                      <div className={styles.memberAvatar}>
                        {memberAvatarSrc ? (
                          <Image
                            src={memberAvatarSrc}
                            alt={u.name || 'Member avatar'}
                            width={48}
                            height={48}
                            style={{ width: '100%', height: '100%', borderRadius: '50%' }}
                            unoptimized
                          />
                        ) : (u.name?.[0]?.toUpperCase() || '?')}
                      </div>
                      <div>
                        <div className={styles.memberName}>{u.name} {isMe && '(You)'}</div>
                        <div className={styles.memberRole}>Joined {new Date(m.joinedAt).toLocaleDateString()}</div>
                      </div>
                    </div>
                  </div>
                  
                  <div className={styles.memberStats}>
                    <div className={`${styles.statBadge} ${styles.streak}`}>
                      <Flame size={14} fill="currentColor" />
                      {u.streaks?.find((s) => s.type === 'global')?.currentCount || 0} Streak
                    </div>
                    <div className={styles.statBadge}>
                      <Clock size={14} /> {Math.floor((u.focusTime7d || 0)/60)}h {(u.focusTime7d || 0)%60}m (7d)
                    </div>
                  </div>

                  <div className={styles.memberActions}>
                    <button className={styles.secondaryBtn} onClick={() => openSpyModal(u.id)}>
                      <Eye size={16} /> Spy Mode
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Tab Content: STATS */}
      {activeTab === 'stats' && (
        <div className={styles.tabContent}>
          <div className={styles.statsContainer}>
            <div className={styles.statCard} style={{ background: 'var(--surface-color)' }}>
              <div style={{ paddingBottom: '24px', borderBottom: '1px solid var(--border-color)', marginBottom: '24px' }}>
                <h2 style={{ fontSize: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Activity size={24} color="var(--accent-primary)" /> Squad Leaderboard
                </h2>
                <p style={{ color: 'var(--text-muted)' }}>Top focus time over the last 7 days.</p>
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {squad.members.map((m, index: number) => {
                  const score = m.user.focusTime7d || 0;
                  const leaderboardAvatarSrc = sanitizeImageSrc(m.user.avatarUrl);
                  const maxScore = Math.max(squad.members[0]?.user.focusTime7d || 1, 1);
                  const percentage = Math.min((score / maxScore) * 100, 100);
                  const isTop3 = index < 3;
                  const rankColors = ['#ffd700', '#c0c0c0', '#cd7f32'];
                  
                  return (
                    <div key={m.id} className={styles.leaderboardRow} style={{ padding: '16px', background: 'var(--bg-secondary)', borderRadius: '12px' }}>
                      <div className={styles.leaderRank} style={{ color: isTop3 ? rankColors[index] : 'var(--text-muted)', fontSize: isTop3 ? '24px' : '18px' }}>
                        #{index + 1}
                      </div>
                      <div className={styles.leaderInfo} style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: '160px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <div className={styles.pinAvatar} style={{ width: '32px', height: '32px', fontSize: '14px', margin: 0 }}>
                            {leaderboardAvatarSrc ? (
                              <Image
                                src={leaderboardAvatarSrc}
                                alt={m.user.name || 'Member avatar'}
                                width={32}
                                height={32}
                                style={{ width: '100%', height: '100%', borderRadius: '50%' }}
                                unoptimized
                              />
                            ) : (m.user.name?.[0]?.toUpperCase() || '?')}
                          </div>
                          <span style={{ fontWeight: 600, fontSize: '16px' }}>{m.user.name}</span>
                        </div>
                        <div style={{ display: 'flex', gap: '8px', fontSize: '12px', color: 'var(--text-muted)', fontWeight: 500 }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--accent-warning)', background: 'rgba(255, 170, 0, 0.1)', padding: '2px 8px', borderRadius: '12px' }}>
                            <Flame size={12} fill="currentColor" /> {m.user.streaks?.find((s) => s.type === 'global')?.currentCount || 0} global
                          </span>
                        </div>
                      </div>
                      <div className={styles.leaderBar} style={{ height: '24px', background: 'var(--bg-primary)', borderRadius: '12px', overflow: 'hidden', flex: 1, position: 'relative', border: '1px solid rgba(255,255,255,0.05)' }}>
                        <div className={styles.leaderBarFill} style={{ 
                          width: `${percentage}%`, 
                          height: '100%',
                          background: percentage > 0 
                            ? (isTop3 ? 'linear-gradient(90deg, var(--accent-warning) 0%, #ff5500 100%)' : 'linear-gradient(90deg, var(--accent-primary) 0%, #a855f7 100%)')
                            : 'transparent',
                          borderRadius: '12px',
                          transition: 'width 1.5s cubic-bezier(0.4, 0, 0.2, 1)',
                          position: 'relative',
                          boxShadow: isTop3 ? '0 0 10px rgba(255, 170, 0, 0.3)' : 'none'
                        }}>
                          {percentage > 0 && <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'linear-gradient(rgba(255,255,255,0.2) 0%, transparent 100%)' }} />}
                        </div>
                      </div>
                      <div className={styles.leaderScore} style={{ fontWeight: 800, fontSize: '18px', minWidth: '70px', textAlign: 'right', color: isTop3 ? rankColors[index] : 'var(--text-primary)' }}>
                        {score}<span style={{fontSize: '14px', color: 'var(--text-muted)', fontWeight: 'normal'}}>m</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {showChatPanel && <div className={styles.chatBackdrop} onClick={() => setShowChatPanel(false)} />}

      {showChatPanel && (
        <aside className={styles.chatFloatingPanel}>
          <div className={styles.chatContainer}>
            <div className={styles.chatHeader}>
              <h2 style={{ fontSize: '16px', margin: 0 }}>Squad Chat</h2>
              <button className={styles.iconBtn} onClick={() => setShowChatPanel(false)}>
                <X size={18} />
              </button>
            </div>

            <div className={styles.chatMessages}>
              {squad.messages.length === 0 && (
                <div className={styles.emptyState} style={{ border: 'none', background: 'transparent' }}>
                  <MessageCircle size={32} />
                  <p>No messages yet. Start the conversation!</p>
                </div>
              )}

              {squad.messages.map((msg) => {
                const isOwn = msg.authorId === squad.userId;
                const isImageBroken = brokenImageIds[msg.id];
                const authorAvatarSrc = sanitizeImageSrc(msg.author?.avatarUrl);
                const messageImageSrc = sanitizeImageSrc(msg.imageUrl);

                return (
                  <div key={msg.id} className={`${styles.messageRow} ${isOwn ? styles.own : ''}`}>
                    <div className={styles.messageAvatar}>
                      {authorAvatarSrc ? (
                        <Image
                          src={authorAvatarSrc}
                          alt={msg.author?.name || 'Author avatar'}
                          width={32}
                          height={32}
                          style={{ width: '100%', height: '100%', borderRadius: '50%' }}
                          unoptimized
                        />
                      ) : (msg.author?.name?.[0]?.toUpperCase() || '?')}
                    </div>
                    <div className={styles.messageContent}>
                      <div className={styles.messageMeta}>
                        <span>{isOwn ? 'You' : msg.author?.name}</span>
                        <span>{timeAgo(msg.createdAt)}</span>
                      </div>
                      <div className={styles.messageBubble}>
                        {messageImageSrc && !isImageBroken && (
                          <Image
                            src={messageImageSrc}
                            alt="Uploaded image"
                            className={styles.messageImage}
                            width={1200}
                            height={800}
                            sizes="(max-width: 768px) 56vw, 280px"
                            unoptimized
                            onError={() => setBrokenImageIds(prev => ({ ...prev, [msg.id]: true }))}
                          />
                        )}
                        {messageImageSrc && isImageBroken && (
                          <a className={styles.messageImageLink} href={messageImageSrc} target="_blank" rel="noreferrer">
                            Open uploaded image
                          </a>
                        )}
                        {msg.content && msg.content !== 'Sent an image' && msg.content}
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={chatEndRef} />
            </div>

            <div className={styles.chatInputArea}>
              <div className={styles.chatComposer}>
                <input
                  type="file"
                  ref={fileInputRef}
                  style={{ display: 'none' }}
                  accept="image/*,.gif,.png,.jpg,.jpeg"
                  onChange={handleImageUpload}
                />
                <button
                  className={styles.iconBtn}
                  style={{ color: 'var(--text-muted)' }}
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  title="Upload Image/GIF"
                >
                  <ImageIcon size={20} />
                </button>
                <div className={styles.chatInputWrapper}>
                  <input
                    className={styles.chatInput}
                    placeholder={isUploading ? 'Uploading...' : 'Share your focus wins...'}
                    value={message}
                    onChange={e => setMessage(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && sendMessage()}
                    disabled={isUploading}
                  />
                </div>
                <button className={`${styles.primaryBtn} ${styles.chatSendBtn}`} onClick={sendMessage} disabled={isUploading || !message.trim()}>
                  <Send size={16} />
                </button>
              </div>
            </div>
          </div>
        </aside>
      )}

      {/* Pin Modal */}
      {showPinModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent} style={{ maxWidth: '500px', width: '100%' }}>
            <h3>Create a Pinned Note</h3>
            <p className={styles.pinModalSubtitle}>Pins stay at the top for everyone in the squad.</p>
            <div className={styles.pinModalInputWrap}>
              <textarea 
                className={`${styles.textArea} ${styles.pinModalTextArea}`}
                placeholder="Important links, rules, or weekly goals..."
                value={pinContent}
                onChange={e => setPinContent(e.target.value)}
                autoFocus
              />
            </div>
            <div className={styles.modalActions}>
              <button className={styles.secondaryBtn} onClick={() => setShowPinModal(false)}>Cancel</button>
              <button className={styles.primaryBtn} onClick={createPin} disabled={!pinContent.trim()}>Pin Note</button>
            </div>
          </div>
        </div>
      )}

      {/* Spy Modal */}
      {showSpyModal && spyData && (
        <div className={styles.modalOverlay} onClick={() => setShowSpyModal(false)} style={{ backdropFilter: 'blur(8px)', zIndex: 100 }}>
          <div className={`${styles.modalContent} ${styles.spyModeModal}`} onClick={e => e.stopPropagation()} style={{ maxWidth: '900px', width: '90%', height: '80vh', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Eye color="var(--accent-primary)" /> Spy Mode
              </h2>
              <button className={styles.iconBtn} onClick={() => setShowSpyModal(false)}>
                <X size={24} />
              </button>
            </div>
            
            <div style={{ overflowY: 'auto', flex: 1, paddingRight: '8px' }}>
              <h3 style={{ marginBottom: '16px', fontSize: '16px' }}>Current Kanban Board</h3>
              
              <div className={styles.kanbanPreviewContainer}>
                <div className={styles.spyKanbanColumn}>
                  <h4>To Do</h4>
                  <div className={styles.spyTaskList}>
                    {spyData.tasks.filter((t) => t.status === 'todo').map((t) => (
                      <div key={t.id} className={styles.spyTaskCard} style={{ cursor: 'pointer', transition: 'transform 0.2s', borderLeft: `4px solid ${t.color}` }} onClick={() => setSelectedTask(t)}>
                        <div style={{ fontWeight: 500, display: 'flex', justifyContent:'space-between', alignItems: 'center' }}>
                          <span>{t.title}</span>
                          {t.descriptionHtml && <span className={styles.badge} style={{fontSize: '10px', background: 'var(--bg-primary)'}}>Details</span>}
                        </div>
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <span dangerouslySetInnerHTML={{ __html: t.habit?.iconSvg || '' }} /> {t.habit?.name}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                
                <div className={styles.spyKanbanColumn}>
                  <h4>In Progress</h4>
                  <div className={styles.spyTaskList}>
                    {spyData.tasks.filter((t) => t.status === 'in_progress').map((t) => (
                      <div key={t.id} className={styles.spyTaskCard} style={{ cursor: 'pointer', transition: 'transform 0.2s', borderLeft: `4px solid ${t.color}` }} onClick={() => setSelectedTask(t)}>
                        <div style={{ fontWeight: 500, display: 'flex', justifyContent:'space-between', alignItems: 'center' }}>
                          <span>{t.title}</span>
                          {t.descriptionHtml && <span className={styles.badge} style={{fontSize: '10px', background: 'var(--bg-primary)'}}>Details</span>}
                        </div>
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                          {t.completedPomodoros} / {t.estimatedPomodoros} Pomodoros
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                
                <div className={styles.spyKanbanColumn} style={{ opacity: 0.8 }}>
                  <h4>Done</h4>
                  <div className={styles.spyTaskList}>
                    {spyData.tasks.filter((t) => t.status === 'done').map((t) => (
                      <div key={t.id} className={styles.spyTaskCard} style={{ cursor: 'pointer', borderLeft: `4px solid ${t.color}` }} onClick={() => setSelectedTask(t)}>
                        <div style={{ fontWeight: 500, textDecoration: 'line-through', color: 'var(--text-muted)' }}>{t.title}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            
            {/* Detailed Task View overlay in Spy Mode */}
            {selectedTask && (
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', zIndex: 110, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setSelectedTask(null)}>
                <div className={styles.modalContent} style={{ maxWidth: '600px', width: '90%', maxHeight: '90%', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <h3 style={{ display:'flex', alignItems: 'center', gap: '8px' }}>
                      <span dangerouslySetInnerHTML={{ __html: selectedTask.habit?.iconSvg || '' }} /> 
                      {selectedTask.title}
                    </h3>
                    <button className={styles.iconBtn} onClick={() => setSelectedTask(null)}>
                      <X size={20} />
                    </button>
                  </div>
                  
                  <div style={{ display: 'flex', gap: '8px', marginBottom: '24px' }}>
                    <div className={styles.statBadge} style={{ background: selectedTask.color, color: '#fff' }}>
                      {selectedTask.habit?.name}
                    </div>
                    <div className={styles.statBadge}>
                      Status: {selectedTask.status.replace('_', ' ').toUpperCase()}
                    </div>
                    <div className={styles.statBadge}>
                      {selectedTask.completedPomodoros} / {selectedTask.estimatedPomodoros} Pomodoros
                    </div>
                  </div>
                  
                  <div style={{ background: 'var(--bg-primary)', padding: '16px', borderRadius: '12px' }}>
                    <h4 style={{ fontSize: '14px', marginBottom: '12px', color: 'var(--text-muted)' }}>Task Details</h4>
                    {selectedTask.descriptionHtml && selectedTask.descriptionHtml !== '<p></p>' ? (
                      <div className={styles.spyTaskDetail} dangerouslySetInnerHTML={{ __html: selectedTask.descriptionHtml }} />
                    ) : (
                      <p style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>No detailed description provided.</p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
}
