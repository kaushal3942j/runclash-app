import React, { useState } from 'react';
import { ShieldCheck, Lock, Mail, Eye, EyeOff, AlertCircle, CheckCircle2, X, RefreshCw } from 'lucide-react';

export const ProtectAccountModal = ({
  isOpen,
  onClose,
  onUpgrade,
  currentDisplayName = 'Runner'
}) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successResult, setSuccessResult] = useState(null);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    setErrorMessage('');

    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setErrorMessage('Email address is required.');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail)) {
      setErrorMessage('Please enter a valid email address (e.g. runner@domain.com).');
      return;
    }

    if (!password) {
      setErrorMessage('Password is required.');
      return;
    }

    if (password.length < 6) {
      setErrorMessage('Password must be at least 6 characters long.');
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage('Passwords do not match. Please verify and retype.');
      return;
    }

    if (!onUpgrade) {
      setErrorMessage('Account upgrade service is unavailable.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await onUpgrade(trimmedEmail, password);
      if (res && res.success) {
        setSuccessResult({
          email: trimmedEmail,
          requiresEmailConfirmation: res.requiresEmailConfirmation,
          message: res.message
        });
      } else {
        setErrorMessage(res?.message || res?.error || 'Failed to protect account. Please try again.');
      }
    } catch (err) {
      setErrorMessage(err?.message || 'An unexpected error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    if (isLoading) return;
    setErrorMessage('');
    setEmail('');
    setPassword('');
    setConfirmPassword('');
    setSuccessResult(null);
    onClose();
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.85)',
        backdropFilter: 'blur(8px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px'
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
    >
      <div
        className="clash-card fade-in"
        style={{
          width: '100%',
          maxWidth: '420px',
          background: '#141414',
          border: '1px solid #2A2A2A',
          borderRadius: '20px',
          padding: '24px',
          boxShadow: '0 20px 40px rgba(0,0,0,0.8), 0 0 30px rgba(252,76,2,0.15)',
          display: 'flex',
          flexDirection: 'column',
          gap: '18px',
          position: 'relative'
        }}
      >
        {/* Close Button */}
        <button
          onClick={handleClose}
          disabled={isLoading}
          style={{
            position: 'absolute',
            top: '16px',
            right: '16px',
            background: 'transparent',
            border: 'none',
            color: '#A0A0A0',
            cursor: isLoading ? 'not-allowed' : 'pointer',
            padding: '4px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
          aria-label="Close"
        >
          <X size={20} />
        </button>

        {/* Modal Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div
            style={{
              width: '44px',
              height: '44px',
              borderRadius: '12px',
              backgroundColor: 'rgba(252, 76, 2, 0.12)',
              border: '1.5px solid #FC4C02',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}
          >
            <ShieldCheck size={24} style={{ color: '#FC4C02' }} />
          </div>
          <div>
            <h3
              className="clash-title"
              style={{
                margin: 0,
                fontSize: '17px',
                color: 'white',
                fontWeight: '900',
                letterSpacing: '0.5px',
                textTransform: 'uppercase'
              }}
            >
              Protect Account
            </h3>
            <span style={{ fontSize: '11px', color: '#A0A0A0', display: 'block', marginTop: '2px' }}>
              Secure runner <strong style={{ color: '#FC4C02' }}>{currentDisplayName}</strong>
            </span>
          </div>
        </div>

        {/* SUCCESS VIEW */}
        {successResult ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', textAlign: 'center', padding: '10px 0' }}>
            <div
              style={{
                width: '56px',
                height: '56px',
                borderRadius: '50%',
                backgroundColor: 'rgba(16, 185, 129, 0.15)',
                border: '2px solid #10B981',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto'
              }}
            >
              <CheckCircle2 size={32} style={{ color: '#10B981' }} />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <h4 style={{ margin: 0, fontSize: '16px', fontWeight: '800', color: 'white' }}>
                {successResult.requiresEmailConfirmation ? 'Verification Email Sent' : 'Account Secured!'}
              </h4>
              <p style={{ margin: 0, fontSize: '12px', color: '#D1D5DB', lineHeight: '1.5' }}>
                {successResult.message}
              </p>
            </div>

            <div
              style={{
                backgroundColor: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid #2A2A2A',
                borderRadius: '12px',
                padding: '12px',
                fontSize: '11px',
                color: '#9CA3AF',
                textAlign: 'left',
                lineHeight: '1.4'
              }}
            >
              <strong style={{ color: 'white' }}>What remains safe:</strong>
              <ul style={{ margin: '6px 0 0 16px', padding: 0 }}>
                <li>Your profile and display name</li>
                <li>Conquered territories & sectors</li>
                <li>Complete running distance and history</li>
                <li>Clan membership & XP status</li>
              </ul>
            </div>

            <button
              id="protect-account-done-btn"
              onClick={handleClose}
              className="clash-btn-primary"
              style={{
                height: '44px',
                fontSize: '12px',
                fontWeight: '800',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                borderRadius: '12px',
                cursor: 'pointer'
              }}
            >
              Return to RunClash
            </button>
          </div>
        ) : (
          /* FORM VIEW */
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div
              style={{
                backgroundColor: 'rgba(252, 76, 2, 0.08)',
                border: '1px solid rgba(252, 76, 2, 0.25)',
                borderRadius: '12px',
                padding: '12px',
                fontSize: '11px',
                color: '#E5E7EB',
                lineHeight: '1.5'
              }}
            >
              Link an email and password to secure your progress. This prevents data loss if your browser storage is cleared, and lets you log in from any device.
            </div>

            {/* Error Banner */}
            {errorMessage && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '8px',
                  backgroundColor: 'rgba(239, 68, 68, 0.12)',
                  border: '1px solid #EF4444',
                  borderRadius: '10px',
                  padding: '10px 12px',
                  fontSize: '11px',
                  color: '#FCA5A5',
                  lineHeight: '1.4'
                }}
              >
                <AlertCircle size={16} style={{ color: '#EF4444', flexShrink: 0, marginTop: '1px' }} />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Email Field */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label htmlFor="protect-account-email" style={{ fontSize: '11px', fontWeight: '700', color: '#D1D5DB' }}>
                Email Address
              </label>
              <div style={{ position: 'relative' }}>
                <Mail
                  size={15}
                  style={{
                    position: 'absolute',
                    left: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: '#6B7280'
                  }}
                />
                <input
                  id="protect-account-email"
                  type="email"
                  required
                  autoCapitalize="none"
                  autoCorrect="off"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="runner@example.com"
                  disabled={isLoading}
                  style={{
                    width: '100%',
                    height: '42px',
                    backgroundColor: '#0B0B0D',
                    border: '1px solid #2A2A2A',
                    borderRadius: '10px',
                    padding: '0 12px 0 36px',
                    fontSize: '12px',
                    color: 'white',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>
            </div>

            {/* Password Field */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label htmlFor="protect-account-password" style={{ fontSize: '11px', fontWeight: '700', color: '#D1D5DB' }}>
                Password (minimum 6 characters)
              </label>
              <div style={{ position: 'relative' }}>
                <Lock
                  size={15}
                  style={{
                    position: 'absolute',
                    left: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: '#6B7280'
                  }}
                />
                <input
                  id="protect-account-password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Create a secure password"
                  disabled={isLoading}
                  style={{
                    width: '100%',
                    height: '42px',
                    backgroundColor: '#0B0B0D',
                    border: '1px solid #2A2A2A',
                    borderRadius: '10px',
                    padding: '0 40px 0 36px',
                    fontSize: '12px',
                    color: 'white',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    position: 'absolute',
                    right: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    color: '#6B7280',
                    cursor: 'pointer',
                    padding: 0,
                    display: 'flex',
                    alignItems: 'center'
                  }}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Confirm Password Field */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label htmlFor="protect-account-confirm-password" style={{ fontSize: '11px', fontWeight: '700', color: '#D1D5DB' }}>
                Confirm Password
              </label>
              <div style={{ position: 'relative' }}>
                <Lock
                  size={15}
                  style={{
                    position: 'absolute',
                    left: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: '#6B7280'
                  }}
                />
                <input
                  id="protect-account-confirm-password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter your password"
                  disabled={isLoading}
                  style={{
                    width: '100%',
                    height: '42px',
                    backgroundColor: '#0B0B0D',
                    border: '1px solid #2A2A2A',
                    borderRadius: '10px',
                    padding: '0 12px 0 36px',
                    fontSize: '12px',
                    color: 'white',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>
            </div>

            <div style={{ fontSize: '10px', color: '#9CA3AF', lineHeight: '1.4' }}>
              * Note: If Supabase email confirmation is enabled, a confirmation email will be sent. Your account will be permanently linked upon verification.
            </div>

            {/* Action Buttons */}
            <div style={{ display: 'flex', gap: '10px', marginTop: '6px' }}>
              <button
                type="button"
                onClick={handleClose}
                disabled={isLoading}
                className="clash-btn-secondary"
                style={{
                  flex: 1,
                  height: '44px',
                  borderRadius: '12px',
                  fontSize: '11px',
                  fontWeight: '700',
                  color: '#A0A0A0',
                  borderColor: '#2A2A2A',
                  cursor: isLoading ? 'not-allowed' : 'pointer'
                }}
              >
                Cancel
              </button>

              <button
                id="protect-account-submit-btn"
                type="submit"
                disabled={isLoading}
                className="clash-btn-primary"
                style={{
                  flex: 2,
                  height: '44px',
                  borderRadius: '12px',
                  fontSize: '11px',
                  fontWeight: '800',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  cursor: isLoading ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px'
                }}
              >
                {isLoading ? (
                  <>
                    <RefreshCw size={14} className="spin" />
                    Securing...
                  </>
                ) : (
                  'Secure & Link Email'
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
