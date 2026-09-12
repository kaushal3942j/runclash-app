import React, { useState } from 'react';
import { requestPhoneOtp, verifyPhoneOtp } from '../services/authService';
import { supabase, useSupabase } from '../supabase';

export default function PhoneVerificationModal({ isOpen, onClose, onVerified, isDark = true }) {
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState('phone'); // 'phone' | 'otp'
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleRequestOtp = async (e) => {
    e.preventDefault();
    if (!phone || phone.trim().length < 10) {
      setError('Please enter a valid phone number (e.g. 9876543210 or +919876543210)');
      return;
    }
    
    // Normalize Indian numbers
    let formattedPhone = phone.trim().replace(/\s+/g, '');
    if (!formattedPhone.startsWith('+')) {
      if (formattedPhone.length === 10) {
        formattedPhone = '+91' + formattedPhone;
      } else {
        formattedPhone = '+' + formattedPhone;
      }
    }

    setLoading(true);
    setError(null);
    
    const res = await requestPhoneOtp(formattedPhone);
    setLoading(false);

    if (res.success) {
      setPhone(formattedPhone);
      setStep('otp');
    } else {
      if (res.error === 'unsupported_phone_provider') {
        setError('Phone verification is currently unavailable. Please configure an SMS provider in Supabase before using phone verification.');
      } else {
        const msg =
          res.error?.message ||
          res.error?.error_description ||
          (typeof res.error === 'string'
            ? res.error
            : JSON.stringify(res.error));
        setError(msg || 'Failed to send OTP.');
      }
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    if (!otp || otp.length < 6) {
      setError('Please enter the 6-digit code.');
      return;
    }

    setLoading(true);
    setError(null);

    const res = await verifyPhoneOtp(phone, otp.trim());
    setLoading(false);

    if (res.success) {
      if (onVerified) onVerified();
      onClose();
    } else {
      const msg =
        res.error?.message ||
        res.error?.error_description ||
        (typeof res.error === 'string'
          ? res.error
          : JSON.stringify(res.error));
      setError(msg || 'Invalid OTP code.');
    }
  };

  const bgClass = isDark ? 'bg-gray-900 text-white' : 'bg-white text-gray-900';
  const overlayClass = isDark ? 'bg-black/70' : 'bg-black/50';
  const inputClass = isDark ? 'bg-gray-800 border-gray-700 text-white placeholder-gray-500' : 'bg-gray-50 border-gray-300 text-gray-900 placeholder-gray-400';

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      zIndex: 99999,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '16px',
      backgroundColor: isDark ? 'rgba(0, 0, 0, 0.75)' : 'rgba(0, 0, 0, 0.5)',
      backdropFilter: 'blur(4px)',
      boxSizing: 'border-box'
    }}>
      <div style={{
        position: 'relative',
        width: '100%',
        maxWidth: '400px',
        maxHeight: '90vh',
        overflowY: 'auto',
        borderRadius: '16px',
        padding: '24px',
        backgroundColor: isDark ? '#111827' : '#ffffff',
        color: isDark ? '#ffffff' : '#111827',
        border: `1px solid ${isDark ? '#374151' : '#e5e7eb'}`,
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        boxSizing: 'border-box'
      }}>
        
        {/* Close Button */}
        <button 
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '16px',
            right: '16px',
            background: 'none',
            border: 'none',
            color: isDark ? '#9ca3af' : '#6b7280',
            cursor: 'pointer',
            padding: '4px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
          aria-label="Close"
        >
          <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <h2 style={{
          fontSize: '24px',
          fontWeight: '900',
          fontStyle: 'italic',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          textAlign: 'center',
          margin: '0 0 8px 0',
          color: isDark ? '#ffffff' : '#111827'
        }}>
          Verify Phone
        </h2>
        
        <p style={{
          fontSize: '14px',
          textAlign: 'center',
          marginBottom: '24px',
          color: isDark ? '#9ca3af' : '#4b5563',
          margin: '0 0 24px 0'
        }}>
          {step === 'phone' 
            ? 'Verify your identity to claim territories and create tactical clans.'
            : `We sent a 6-digit code to ${phone}.`}
        </p>

        {error && (
          <div style={{
            marginBottom: '16px',
            padding: '12px',
            borderRadius: '8px',
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.5)',
            color: '#ef4444',
            fontSize: '12px',
            fontWeight: '600',
            textAlign: 'center'
          }}>
            {error}
          </div>
        )}

        {step === 'phone' ? (
          <form onSubmit={handleRequestOtp} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label style={{
                display: 'block',
                fontSize: '12px',
                fontWeight: '700',
                color: isDark ? '#9ca3af' : '#4b5563',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                marginBottom: '4px'
              }}>
                Mobile Number
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+1 234 567 8900"
                required
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  borderRadius: '12px',
                  border: `1px solid ${isDark ? '#374151' : '#d1d5db'}`,
                  backgroundColor: isDark ? '#1f2937' : '#f9fafb',
                  color: isDark ? '#ffffff' : '#111827',
                  outline: 'none',
                  boxSizing: 'border-box',
                  fontSize: '16px'
                }}
              />
            </div>
            
            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%',
                background: 'linear-gradient(to right, #0891b2, #2563eb)',
                color: 'white',
                fontWeight: '700',
                padding: '12px 16px',
                borderRadius: '12px',
                border: 'none',
                boxShadow: '0 10px 15px -3px rgba(8, 145, 178, 0.3)',
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.7 : 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '14px',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                minHeight: '48px'
              }}
            >
              {loading ? 'SENDING...' : 'SEND SMS CODE'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleVerifyOtp} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label style={{
                display: 'block',
                fontSize: '12px',
                fontWeight: '700',
                color: isDark ? '#9ca3af' : '#4b5563',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                marginBottom: '4px'
              }}>
                6-Digit OTP
              </label>
              <input
                type="text"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                placeholder="000000"
                maxLength={6}
                required
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  borderRadius: '12px',
                  border: `1px solid ${isDark ? '#374151' : '#d1d5db'}`,
                  backgroundColor: isDark ? '#1f2937' : '#f9fafb',
                  color: isDark ? '#ffffff' : '#111827',
                  outline: 'none',
                  boxSizing: 'border-box',
                  textAlign: 'center',
                  letterSpacing: '0.5em',
                  fontFamily: 'monospace',
                  fontSize: '20px'
                }}
              />
            </div>
            
            <button
              type="submit"
              disabled={loading || otp.length < 6}
              style={{
                width: '100%',
                background: 'linear-gradient(to right, #16a34a, #059669)',
                color: 'white',
                fontWeight: '700',
                padding: '12px 16px',
                borderRadius: '12px',
                border: 'none',
                boxShadow: '0 10px 15px -3px rgba(22, 163, 74, 0.3)',
                cursor: (loading || otp.length < 6) ? 'not-allowed' : 'pointer',
                opacity: (loading || otp.length < 6) ? 0.5 : 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '14px',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                minHeight: '48px'
              }}
            >
              {loading ? 'VERIFYING...' : 'VERIFY CODE'}
            </button>
            
            <button
              type="button"
              onClick={() => { setStep('phone'); setOtp(''); setError(null); }}
              style={{
                width: '100%',
                background: 'none',
                border: 'none',
                color: isDark ? '#9ca3af' : '#6b7280',
                fontSize: '12px',
                fontWeight: '700',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                cursor: 'pointer',
                padding: '8px',
                marginTop: '8px'
              }}
            >
              CHANGE PHONE NUMBER
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
