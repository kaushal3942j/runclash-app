import React, { useState, useRef, useEffect } from 'react';
import { RefreshCw } from 'lucide-react';

export const PullToRefresh = ({ onRefresh, children, disabled = false }) => {
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const pullDistanceRef = useRef(0);
  const startYRef = useRef(0);
  const startXRef = useRef(0);
  const isPullingRef = useRef(false);
  const containerRef = useRef(null);

  const MAX_PULL = 80;

  const handleTouchStart = (e) => {
    if (disabled || isRefreshing) return;
    if (containerRef.current && containerRef.current.scrollTop > 0) return;

    // Don't trigger pull-to-refresh if touching the map
    if (e.target.closest('.leaflet-container') || e.target.closest('.maplibregl-map')) return;

    startYRef.current = e.touches[0].clientY;
    startXRef.current = e.touches[0].clientX;
    isPullingRef.current = true;
  };

  const handleTouchMove = (e) => {
    if (!isPullingRef.current || disabled || isRefreshing) return;

    const currentY = e.touches[0].clientY;
    const currentX = e.touches[0].clientX;
    const diffY = currentY - startYRef.current;
    const diffX = Math.abs(currentX - startXRef.current);

    // If movement is predominantly horizontal, cancel pull
    if (diffX > diffY && diffX > 10) {
      isPullingRef.current = false;
      return;
    }

    // Only engage pull if we've moved down significantly (prevents tap-wiggle cancellation)
    if (diffY > 5) {
      const pull = Math.min((diffY - 5) * 0.4, MAX_PULL);
      pullDistanceRef.current = pull;
      setPullDistance(pull);

      if (pull > 0 && e.cancelable) {
        e.preventDefault();
      }
    }
  };

  const handleTouchEnd = async () => {
    if (!isPullingRef.current || disabled) return;

    isPullingRef.current = false;

    if (pullDistanceRef.current > MAX_PULL * 0.8) {
      setIsRefreshing(true);
      setPullDistance(MAX_PULL * 0.6);

      try {
        if (onRefresh) {
          await onRefresh();
        }
      } catch (err) {
        console.error(err);
      } finally {
        setIsRefreshing(false);
        setPullDistance(0);
        pullDistanceRef.current = 0;
      }
    } else {
      setPullDistance(0);
      pullDistanceRef.current = 0;
    }
  };

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const preventScroll = (e) => handleTouchMove(e);
    el.addEventListener('touchmove', preventScroll, { passive: false });
    return () => el.removeEventListener('touchmove', preventScroll);
  }, [disabled, isRefreshing]);

  return (
    <div
      ref={containerRef}
      style={{
        height: '100%',
        width: '100%',
        overflowY: 'auto',
        overflowX: 'hidden',
        position: 'relative',
        WebkitOverflowScrolling: 'touch'
      }}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: `${pullDistance}px`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          transition: isPullingRef.current ? 'none' : 'height 0.3s ease',
          zIndex: 10,
          pointerEvents: 'none'
        }}
      >
        <div style={{
          transform: `rotate(${pullDistance * 3}deg)`,
          opacity: pullDistance / MAX_PULL
        }}>
          <RefreshCw size={20} color="#FC4C02" className={isRefreshing ? "spin" : ""} />
        </div>
      </div>

      <div style={{
        transform: `translateY(${pullDistance}px)`,
        transition: isPullingRef.current ? 'none' : 'transform 0.3s ease',
        minHeight: '100%'
      }}>
        {children}
      </div>
    </div>
  );
};
