import { useState, useEffect } from 'react';
import {
  subscribeToAuth,
  loginUser as apiLogin,
  registerUser as apiRegister,
  loginGuest as apiLoginGuest,
  logout as apiLogout,
  syncUserStats
} from '../supabase';

export function useAuth() {
  const [currentUser, setCurrentUser] = useState(null);
  const [authMode, setAuthMode] = useState('login'); // 'login', 'signup', 'guest'
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authName, setAuthName] = useState('');
  const [authClan, setAuthClan] = useState('None');
  const [authError, setAuthError] = useState('');
  const [isAuthLoading, setIsAuthLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = subscribeToAuth((user) => {
      setCurrentUser(user);
      setIsAuthLoading(false);
    });
    return () => {
      if (typeof unsubscribe === 'function') unsubscribe();
    };
  }, []);

  const handleLogin = async (e) => {
    if (e) e.preventDefault();
    setAuthError('');
    if (!authEmail || !authPassword) {
      setAuthError('Please enter email and password.');
      return false;
    }
    const res = await apiLogin(authEmail, authPassword);
    if (!res.success) {
      setAuthError(res.error || 'Authentication failed.');
      return false;
    }
    return true;
  };

  const handleRegister = async (e) => {
    if (e) e.preventDefault();
    setAuthError('');
    if (!authName || !authEmail || !authPassword) {
      setAuthError('All fields are required.');
      return false;
    }
    const res = await apiRegister(authEmail, authPassword, authName, authClan || 'None');
    if (!res.success) {
      setAuthError(res.error || 'Registration failed.');
      return false;
    }
    return true;
  };

  const handleGuestLogin = async () => {
    setAuthError('');
    const res = await apiLoginGuest();
    if (!res.success) {
      setAuthError('Guest access failed.');
      return false;
    }
    return true;
  };

  const handleLogout = async () => {
    await apiLogout();
    setCurrentUser(null);
  };

  const updateUserProfile = async (updatedData) => {
    if (!currentUser) return;
    const newProfile = { ...currentUser, ...updatedData };
    setCurrentUser(newProfile);
    await syncUserStats(newProfile);
  };

  return {
    currentUser,
    setCurrentUser,
    authMode,
    setAuthMode,
    authEmail,
    setAuthEmail,
    authPassword,
    setAuthPassword,
    authName,
    setAuthName,
    authClan,
    setAuthClan,
    authError,
    setAuthError,
    isAuthLoading,
    handleLogin,
    handleRegister,
    handleGuestLogin,
    handleLogout,
    updateUserProfile
  };
}
