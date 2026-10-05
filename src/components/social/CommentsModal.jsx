import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { Send, X } from 'lucide-react';
import { getComments, addComment } from '../../services/socialService';

export const CommentsModal = ({ activity, commentsCount, setCommentsCount, onClose }) => {
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [viewportHeight, setViewportHeight] = useState(window.innerHeight);

  React.useEffect(() => {
    if (window.visualViewport) {
      const handleResize = () => setViewportHeight(window.visualViewport.height);
      window.visualViewport.addEventListener('resize', handleResize);
      return () => window.visualViewport.removeEventListener('resize', handleResize);
    }
  }, []);

  React.useEffect(() => {
    const loadComments = async () => {
      setErrorMsg('');
      const res = await getComments(activity.id);
      if (res.success) {
        setComments(res.data || []);
      } else {
        setErrorMsg("Couldn't load comments.");
      }
      setIsLoading(false);
    };
    loadComments();
  }, [activity.id]);

  const handleAddComment = async (e) => {
    e.preventDefault();
    if (!newComment.trim() || isSubmitting) return;
    setIsSubmitting(true);
    setErrorMsg('');
    
    const res = await addComment(activity.id, newComment);
    if (res.success) {
      setComments([...comments, res.data]);
      setNewComment('');
      setCommentsCount(prev => prev + 1);
    } else {
      setErrorMsg("Couldn't post comment. Try again.");
    }
    setIsSubmitting(false);
  };

  const modalContent = (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      height: viewportHeight,
      background: 'rgba(0,0,0,0.7)',
      backdropFilter: 'blur(4px)',
      zIndex: 100000,
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'flex-end'
    }}>
      <div style={{
        background: '#0B0B0D',
        borderTop: '1px solid #2A2A2A',
        borderTopLeftRadius: '16px',
        borderTopRightRadius: '16px',
        height: '75vh',
        display: 'flex',
        flexDirection: 'column'
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px', borderBottom: '1px solid #1A1A1A' }}>
          <h3 style={{ margin: 0, color: 'white', fontSize: '16px', fontWeight: '800' }}>Comments</h3>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'white', cursor: 'pointer' }}>
            <X size={20} />
          </button>
        </div>

        {/* Post Preview */}
        <div style={{ padding: '12px 16px', borderBottom: '1px solid #1A1A1A', display: 'flex', gap: '12px', alignItems: 'center' }}>
          {activity.media_url && activity.media_type === 'photo' && (
            <img loading="lazy" src={activity.media_url} style={{ width: '40px', height: '40px', borderRadius: '4px', objectFit: 'cover' }} alt="Post thumbnail" />
          )}
          <div style={{ flex: 1, fontSize: '13px', color: 'white' }}>
            <span style={{ fontWeight: 'bold' }}>{activity.profiles?.display_name || 'Runner'}</span>
            <div style={{ color: 'var(--clash-text-secondary)', fontSize: '12px', marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {activity.caption || 'Photo post'}
            </div>
          </div>
        </div>

        {/* Comments List */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {errorMsg && (
            <div style={{ color: '#EF4444', fontSize: '12px', textAlign: 'center', background: 'rgba(239, 68, 68, 0.1)', padding: '8px', borderRadius: '8px' }}>
              {errorMsg}
            </div>
          )}
          
          {isLoading ? (
            <div style={{ color: 'var(--clash-text-secondary)', fontSize: '12px', textAlign: 'center' }}>Loading comments...</div>
          ) : comments.length === 0 ? (
            <div style={{ color: 'var(--clash-text-secondary)', fontSize: '12px', textAlign: 'center' }}>No comments yet.</div>
          ) : (
            comments.map(c => {
              const timeString = new Date(c.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
              return (
                <div key={c.id} style={{ display: 'flex', gap: '12px' }}>
                  <img loading="lazy"
                    src={c.profiles?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(c.profiles?.display_name || 'R')}&background=333&color=fff`} 
                    style={{ width: '32px', height: '32px', borderRadius: '50%' }}
                    alt="avatar"
                  />
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
                      <span style={{ fontWeight: 'bold', color: 'white', fontSize: '13px' }}>{c.profiles?.display_name || 'Runner'}</span>
                      <span style={{ fontSize: '10px', color: 'var(--clash-text-secondary)' }}>{timeString}</span>
                    </div>
                    <div style={{ color: '#DDD', fontSize: '13px', marginTop: '2px', wordBreak: 'break-word' }}>{c.content || c.text}</div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Input */}
        <form onSubmit={handleAddComment} style={{ padding: '12px 16px', borderTop: '1px solid #1A1A1A', display: 'flex', gap: '8px', background: '#0B0B0D' }}>
          <input 
            value={newComment} 
            onChange={e => setNewComment(e.target.value)} 
            placeholder="Write a comment..." 
            className="cyber-input"
            style={{ flex: 1, background: '#151515', color: 'white', border: '1px solid #2A2A2A', padding: '10px 12px', borderRadius: '20px', fontSize: '14px' }}
            disabled={isSubmitting}
          />
          <button type="submit" disabled={!newComment.trim() || isSubmitting} style={{ background: (newComment.trim() && !isSubmitting) ? '#FC4C02' : '#333', color: 'white', border: 'none', width: '40px', height: '40px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: (newComment.trim() && !isSubmitting) ? 'pointer' : 'default' }}>
            {isSubmitting ? <span className="spin">⟳</span> : <Send size={18} />}
          </button>
        </form>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};
