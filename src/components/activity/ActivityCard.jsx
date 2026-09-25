import React, { useState } from 'react';
import { Flame, Map, Users, Shield, Clock, Camera, Heart, MessageSquare } from 'lucide-react';
import { toggleLikePost, getComments, addComment } from '../../services/socialService';

const SocialPostContent = ({ activity }) => {
  const [likes, setLikes] = useState(activity.social_likes?.[0]?.count || 0);
  const [commentsCount, setCommentsCount] = useState(activity.social_comments?.[0]?.count || 0);
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');

  const handleLike = async () => {
    const res = await toggleLikePost(activity.id);
    if (res.success) {
      setLikes(prev => res.action === 'liked' ? prev + 1 : prev - 1);
    }
  };

  const handleShowComments = async () => {
    if (!showComments) {
      const res = await getComments(activity.id);
      if (res.success) setComments(res.data || []);
    }
    setShowComments(!showComments);
  };

  const handleAddComment = async (e) => {
    e.preventDefault();
    if (!newComment.trim()) return;
    const res = await addComment(activity.id, newComment);
    if (res.success) {
      setComments([...comments, res.data]);
      setNewComment('');
      setCommentsCount(prev => prev + 1);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {activity.caption && (
          <div style={{ fontSize: '13px', color: 'white', fontWeight: '500' }}>{activity.caption}</div>
      )}
      {activity.media_url && activity.media_type === 'photo' && (
          <img src={activity.media_url} style={{ width: '100%', borderRadius: '8px', maxHeight: '400px', objectFit: 'cover' }} alt="Post media" />
      )}
      {activity.media_url && activity.media_type === 'video' && (
          <video src={activity.media_url} controls style={{ width: '100%', borderRadius: '8px', maxHeight: '400px', objectFit: 'cover' }} />
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginTop: '4px', fontSize: '12px', color: 'var(--clash-text-secondary)' }}>
          <span onClick={handleLike} style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer', color: likes > 0 ? '#FC4C02' : 'inherit' }}>
            <Heart size={14} /> {likes}
          </span>
          <span onClick={handleShowComments} style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
            <MessageSquare size={14} /> {commentsCount}
          </span>
      </div>

      {showComments && (
        <div style={{ marginTop: '8px', borderTop: '1px solid #333', paddingTop: '8px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {comments.map(c => (
            <div key={c.id} style={{ display: 'flex', gap: '8px', fontSize: '11px' }}>
              <div style={{ fontWeight: 'bold', color: 'white' }}>{c.profiles?.display_name || 'Runner'}:</div>
              <div style={{ color: '#DDD' }}>{c.text}</div>
            </div>
          ))}
          <form onSubmit={handleAddComment} style={{ display: 'flex', gap: '4px', marginTop: '4px' }}>
            <input 
              value={newComment} onChange={e => setNewComment(e.target.value)} 
              placeholder="Add a comment..." 
              style={{ flex: 1, background: '#111', color: 'white', border: '1px solid #333', padding: '6px', borderRadius: '4px', fontSize: '11px' }}
            />
            <button type="submit" style={{ background: '#FC4C02', color: 'white', border: 'none', padding: '6px 10px', borderRadius: '4px', cursor: 'pointer', fontSize: '11px' }}>Post</button>
          </form>
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
              <img src={avatarUrl} alt={displayName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
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
