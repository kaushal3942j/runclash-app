import React, { useState } from 'react';
import { Flame, Map, Users, Shield, Share2, Heart, MessageSquare, Clock } from 'lucide-react';
import { toggleLikePost } from '../../services/socialService';
import { CommentsModal } from '../social/CommentsModal';

const SocialPostContent = ({ activity }) => {
  const [likes, setLikes] = useState(activity.post_likes?.[0]?.count || 0);
  const [commentsCount, setCommentsCount] = useState(activity.post_comments?.[0]?.count || 0);
  const [showComments, setShowComments] = useState(false);
  const [isLiked, setIsLiked] = useState(activity.post_likes?.[0]?.count > 0);
  const [showDetail, setShowDetail] = useState(false);

  const handleLike = async (e) => {
    if (e) e.stopPropagation();
    const wasLiked = isLiked;
    setIsLiked(!wasLiked);
    setLikes(prev => wasLiked ? prev - 1 : prev + 1);

    const res = await toggleLikePost(activity.id);
    if (!res.success) {
      setIsLiked(wasLiked);
      setLikes(prev => wasLiked ? prev + 1 : prev - 1);
    }
  };

  const [shareText, setShareText] = useState('');

  const handleShare = async (e) => {
    if (e) e.stopPropagation();
    
    const shareData = {
      title: 'RunClash Post',
      text: activity.caption || 'Check out this run on RunClash!',
      url: activity.media_url || window.location.href,
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch (err) {
        if (err.name !== 'AbortError') {
          console.error('Error sharing:', err);
          fallbackShare(shareData.url);
        }
      }
    } else {
      fallbackShare(shareData.url);
    }
  };

  const fallbackShare = (url) => {
    try {
      navigator.clipboard.writeText(url);
      setShareText('Copied Link!');
      setTimeout(() => setShareText(''), 2000);
    } catch (err) {
      setShareText('Failed to copy');
      setTimeout(() => setShareText(''), 2000);
    }
  };

  const PostMedia = ({ isDetail = false }) => (
    <div 
      onClick={() => !isDetail && setShowDetail(true)}
      style={{ cursor: !isDetail ? 'pointer' : 'default', width: '100%', position: 'relative' }}
    >
      {activity.media_url && activity.media_type === 'photo' && (
        <img loading="lazy" src={activity.media_url} style={{ width: '100%', borderRadius: isDetail ? '0' : '12px', maxHeight: isDetail ? '60vh' : '450px', objectFit: 'contain', border: isDetail ? 'none' : '1px solid #2A2A2A', background: isDetail ? '#000' : 'transparent' }} alt="Post media" />
      )}
      {activity.media_url && activity.media_type === 'video' && (
        <video src={activity.media_url} controls style={{ width: '100%', borderRadius: isDetail ? '0' : '12px', maxHeight: isDetail ? '60vh' : '450px', objectFit: 'contain', border: isDetail ? 'none' : '1px solid #2A2A2A', background: isDetail ? '#000' : 'transparent' }} />
      )}
      {!isDetail && activity.media_url && (
        <div style={{ position: 'absolute', top: '8px', right: '8px', background: 'rgba(0,0,0,0.6)', padding: '4px 8px', borderRadius: '12px', fontSize: '10px', color: 'white', fontWeight: 'bold' }}>
          TAP TO EXPAND
        </div>
      )}
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {activity.caption && (
          <div style={{ fontSize: '14px', color: 'white', fontWeight: '500', lineHeight: '1.4' }}>{activity.caption}</div>
      )}
      
      <PostMedia />
      
      {/* Bottom Action Bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '4px', paddingTop: '12px', borderTop: '1px solid #1A1A1A' }}>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={handleLike} style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', color: isLiked ? '#FC4C02' : 'var(--clash-text-secondary)', background: 'transparent', border: 'none', padding: '8px 12px', fontWeight: '600', fontSize: '13px', borderRadius: '8px' }}>
              <Heart size={18} fill={isLiked ? '#FC4C02' : 'transparent'} /> {likes > 0 ? likes : ''}
            </button>
            <button onClick={(e) => { e.stopPropagation(); setShowComments(true); }} style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', color: 'var(--clash-text-secondary)', background: 'transparent', border: 'none', padding: '8px 12px', fontWeight: '600', fontSize: '13px', borderRadius: '8px' }}>
              <MessageSquare size={18} /> {commentsCount > 0 ? commentsCount : ''}
            </button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {shareText && <span style={{ fontSize: '10px', color: '#10B981', fontWeight: 'bold' }}>{shareText}</span>}
            <button onClick={handleShare} style={{ color: 'var(--clash-text-secondary)', background: 'transparent', border: 'none', padding: '8px 12px', cursor: 'pointer', borderRadius: '8px' }}>
              <Share2 size={18} />
            </button>
          </div>
      </div>

      {showComments && (
        <CommentsModal 
          activity={activity} 
          commentsCount={commentsCount} 
          setCommentsCount={setCommentsCount} 
          onClose={() => setShowComments(false)} 
        />
      )}
      {showDetail && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: '#0B0B0D', zIndex: 100000,
          display: 'flex', flexDirection: 'column', overflowY: 'auto'
        }}>
          {/* Header */}
          <div style={{ padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #1A1A1A' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <img loading="lazy" src={activity.profiles?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(activity.profiles?.display_name || 'R')}&background=333&color=fff`} style={{ width: '32px', height: '32px', borderRadius: '50%' }} alt="avatar" />
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ color: 'white', fontWeight: 'bold', fontSize: '14px' }}>{activity.profiles?.display_name || 'Runner'}</span>
                <span style={{ color: 'var(--clash-text-secondary)', fontSize: '10px' }}>{new Date(activity.created_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}</span>
              </div>
            </div>
            <button onClick={() => setShowDetail(false)} style={{ background: 'transparent', border: 'none', color: 'white', cursor: 'pointer' }}>
              <span style={{ fontSize: '24px', lineHeight: '1' }}>&times;</span>
            </button>
          </div>
          
          <PostMedia isDetail={true} />
          
          <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {activity.caption && (
                <div style={{ fontSize: '15px', color: 'white', fontWeight: '500', lineHeight: '1.5' }}>{activity.caption}</div>
            )}
            
            <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid #1A1A1A', paddingBottom: '16px' }}>
              <button onClick={handleLike} style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', color: isLiked ? '#FC4C02' : 'var(--clash-text-secondary)', background: 'transparent', border: 'none', padding: '8px 12px', fontWeight: '600', fontSize: '14px', borderRadius: '8px' }}>
                <Heart size={20} fill={isLiked ? '#FC4C02' : 'transparent'} /> {likes > 0 ? likes : ''} Like
              </button>
              <button onClick={(e) => { e.stopPropagation(); setShowComments(true); }} style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', color: 'var(--clash-text-secondary)', background: 'transparent', border: 'none', padding: '8px 12px', fontWeight: '600', fontSize: '14px', borderRadius: '8px' }}>
                <MessageSquare size={20} /> {commentsCount > 0 ? commentsCount : ''} Comment
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export const ActivityCard = ({ activity, onActorClick, onTerritoryClick }) => {
  if (!activity) return null;

  const actor = activity.actor || { display_name: 'Runner', level: 1 };
  const displayName = actor.display_name || actor.displayName || 'Runner';
  const username = actor.username ? `@${actor.username}` : null;
  const avatarUrl = actor.avatar_url || actor.avatarUrl;

  const timeString = new Date(activity.created_at || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const renderContent = () => {
    switch (activity.activity_type) {
      case 'run_completed': {
        const dist = activity.metadata?.distance ? Number(activity.metadata.distance).toFixed(2) : '0.00';
        const dur = activity.metadata?.duration ? Math.floor(activity.metadata.duration / 60) : 0;
        const cal = activity.metadata?.calories || 0;
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'white', fontSize: '13px', fontWeight: '700' }}>
              <Flame size={14} style={{ color: '#FC4C02' }} />
              Completed a {dist} km tactical run!
            </div>
            <div style={{ display: 'flex', gap: '12px', fontSize: '11px', color: 'var(--clash-text-secondary)' }}>
              <span>Duration: {dur} mins</span>
              <span>•</span>
              <span>Energy: {cal} kcal</span>
            </div>
          </div>
        );
      }
      case 'territory_claimed': {
        const name = activity.metadata?.name || 'Sector';
        const area = activity.metadata?.area ? `${Math.round(activity.metadata.area).toLocaleString()} m²` : '';
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <div
              onClick={() => onTerritoryClick && onTerritoryClick(activity.territory_id)}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'white', fontSize: '13px', fontWeight: '700', cursor: onTerritoryClick ? 'pointer' : 'default' }}
            >
              <Map size={14} style={{ color: '#8B5CF6' }} />
              Captured territory: <span style={{ color: '#FC4C02', textDecoration: 'underline' }}>{name}</span> ({area})
            </div>
          </div>
        );
      }
      case 'friendship_created': {
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'white', fontSize: '12px', fontWeight: '600' }}>
            <Users size={14} style={{ color: '#10B981' }} />
            Connected as friends on RunClash!
          </div>
        );
      }
      case 'clan_joined': {
        const clanName = activity.metadata?.clan_name || 'a Clan';
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'white', fontSize: '12px', fontWeight: '600' }}>
            <Shield size={14} style={{ color: '#F59E0B' }} />
            Joined alliance <span style={{ color: '#F59E0B' }}>{clanName}</span>!
          </div>
        );
      }
      case 'social_post': {
        return <SocialPostContent activity={activity} />;
      }
      default:
        return <div style={{ fontSize: '12px', color: 'white' }}>Updated profile activities.</div>;
    }
  };

  return (
    <div className="clash-card" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div
          onClick={() => onActorClick && onActorClick(activity.actor_id)}
          style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}
        >
          <div style={{
            width: '36px',
            height: '36px',
            borderRadius: '50%',
            backgroundColor: '#242424',
            border: '1px solid #FC4C02',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
            flexShrink: 0
          }}>
            {avatarUrl ? (
              <img loading="lazy" src={avatarUrl} alt={displayName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <span style={{ fontSize: '14px', fontWeight: '800', color: 'white' }}>
                {displayName[0]?.toUpperCase() || 'R'}
              </span>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ fontSize: '12px', fontWeight: '800', color: 'white' }}>{displayName}</span>
              {username && <span style={{ fontSize: '9px', color: '#FC4C02', fontWeight: '700' }}>{username}</span>}
            </div>
            <span style={{ fontSize: '9px', color: 'var(--clash-text-secondary)' }}>LVL {actor.level || 1}</span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '10px', color: 'var(--clash-text-secondary)' }}>
          <Clock size={11} />
          {timeString}
        </div>
      </div>

      {/* Activity Body */}
      <div style={{ padding: '8px 12px', backgroundColor: '#1A1A1A', borderRadius: '12px', border: '1px solid #2A2A2A' }}>
        {renderContent()}
      </div>
    </div>
  );
};
