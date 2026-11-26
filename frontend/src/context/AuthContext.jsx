import React, { createContext, useContext, useState, useEffect } from 'react';
import { apiFetch, setAuthToken, clearAuthToken } from '../utils/api';

const AuthContext = createContext();

function getRoleAvatar(role) {
  switch (role) {
    case 'fpo_admin':
      return '🏢';
    case 'buyer':
      return '🛒';
    case 'admin':
      return '⚙️';
    default:
      return '👨‍🌾';
  }
}

function getRoleBadge(role) {
  switch (role) {
    case 'fpo_admin':
      return 'FPO Admin';
    case 'buyer':
      return 'Procurement Buyer';
    case 'admin':
      return 'System Admin';
    default:
      return 'Farmer';
  }
}

function enrichUser(user) {
  if (!user) return null;
  return {
    ...user,
    badge: getRoleBadge(user.role),
    avatar: getRoleAvatar(user.role)
  };
}

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [token, setToken] = useState('');
  const [authInitialized, setAuthInitialized] = useState(true);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const handleUnauthorized = () => {
      clearAuthToken();
      setToken('');
      setCurrentUser(null);
    };
    window.addEventListener('agrinexus:unauthorized', handleUnauthorized);
    return () => window.removeEventListener('agrinexus:unauthorized', handleUnauthorized);
  }, []);

  const establishSession = (accessToken, user) => {
    setToken(accessToken);
    setAuthToken(accessToken);
    setCurrentUser(enrichUser(user));
  };

  const loginWithPassword = async (email, password) => {
    setError('');
    const res = await apiFetch('/api/auth/login-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.detail || 'Password login failed');
    }
    establishSession(data.access_token, data.user);
    return data;
  };

  const signup = async ({ name, email, phone, password, locality, role = 'farmer' }) => {
    setError('');
    const res = await apiFetch('/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        email: email || null,
        phone: phone || null,
        password,
        locality: locality || 'Kolar, Karnataka',
        role
      })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.detail || 'Registration failed');
    }
    if (data.access_token && data.user) {
      establishSession(data.access_token, data.user);
    }
    return data;
  };

  const getAdminSetupStatus = async () => {
    const res = await apiFetch('/api/auth/admin-setup-status');
    if (!res.ok) return { needs_setup: false, demo_mode: false };
    return res.json();
  };

  const claimAdminSetup = async (password) => {
    setError('');
    const res = await apiFetch('/api/auth/admin-setup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.detail || 'Initial admin setup failed');
    }
    establishSession(data.access_token, data.user);
    return data;
  };

  const requestOtp = async (phone) => {
    setError('');
    const res = await apiFetch('/api/auth/request-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.detail || 'OTP request failed');
    }
    return data;
  };

  const loginWithOtp = async (phone, otp) => {
    setError('');
    const res = await apiFetch('/api/auth/login-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, otp })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.detail || 'OTP verification failed');
    }
    establishSession(data.access_token, data.user);
    return data;
  };

  const logout = () => {
    clearAuthToken();
    setToken('');
    setCurrentUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        token,
        authInitialized,
        loginWithPassword,
        signup,
        getAdminSetupStatus,
        claimAdminSetup,
        requestOtp,
        loginWithOtp,
        logout,
        isLoginModalOpen,
        setIsLoginModalOpen,
        error,
        clearError: () => setError('')
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
