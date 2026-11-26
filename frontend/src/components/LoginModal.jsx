import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { X, Smartphone, KeyRound, Lock, AlertCircle, CheckCircle2, ArrowRight, ShieldCheck, RefreshCw, Eye, EyeOff } from 'lucide-react';

export default function LoginModal({ isOpen, onClose }) {
  const { loginWithPassword, requestOtp, loginWithOtp, error, clearError } = useAuth();
  const { t } = useLanguage();

  const [activeTab, setActiveTab] = useState('password'); // 'password' (default) | 'otp'

  // OTP Form State
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  // Password Form State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Status
  const [loading, setLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');
  const [localError, setLocalError] = useState('');

  if (!isOpen) return null;

  const handleClose = () => {
    setLocalError('');
    setStatusMsg('');
    if (clearError) clearError();
    onClose();
  };

  // 1. Request OTP
  const handleSendOtp = async (e) => {
    e?.preventDefault();
    setLocalError('');
    setStatusMsg('');
    if (!phone || phone.length < 10) {
      setLocalError('Please enter a valid 10-digit phone number');
      return;
    }

    setLoading(true);
    try {
      const res = await requestOtp(phone);
      setOtpSent(true);
      setStatusMsg(res.message || 'OTP sent successfully');
      setCooldown(60);
      const timer = setInterval(() => {
        setCooldown((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } catch (err) {
      setLocalError(err.message || 'Failed to send OTP');
    } finally {
      setLoading(false);
    }
  };

  // 2. Verify OTP Login
  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    setLocalError('');
    if (!otp || otp.length !== 6) {
      setLocalError('Please enter the 6-digit OTP');
      return;
    }

    setLoading(true);
    try {
      await loginWithOtp(phone, otp);
      setStatusMsg('Login successful! Redirecting...');
      setTimeout(() => {
        handleClose();
      }, 800);
    } catch (err) {
      setLocalError(err.message || 'OTP verification failed');
    } finally {
      setLoading(false);
    }
  };

  // 3. Password Login
  const handlePasswordLogin = async (e) => {
    e.preventDefault();
    setLocalError('');
    if (!email || !password) {
      setLocalError('Please provide both email and password');
      return;
    }

    setLoading(true);
    try {
      await loginWithPassword(email, password);
      setStatusMsg('Login successful! Redirecting...');
      setTimeout(() => {
        handleClose();
      }, 800);
    } catch (err) {
      setLocalError(err.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95 border border-slate-100">
        
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between gap-2 bg-slate-50">
          <div className="flex items-center space-x-2 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center text-white shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm sm:text-base font-bold text-slate-900 truncate">AgriNexus Secure Access</h3>
              <p className="text-[11px] text-slate-500 truncate">Multi-Factor Authentication</p>
            </div>
          </div>
          <button type="button" aria-label="Close login modal" onClick={handleClose} className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200 shrink-0">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Auth Method Tabs */}
        <div className="grid grid-cols-2 p-1.5 bg-slate-100/80 m-3 sm:m-4 rounded-xl text-[11px] sm:text-xs font-semibold gap-1">
          <button
            type="button"
            onClick={() => { setActiveTab('otp'); setLocalError(''); setStatusMsg(''); }}
            className={`py-2 px-1.5 rounded-lg flex items-center justify-center space-x-1 transition-all ${
              activeTab === 'otp' ? 'bg-white text-emerald-800 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Smartphone className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">Kisan OTP Login</span>
          </button>
          <button
            type="button"
            onClick={() => { setActiveTab('password'); setLocalError(''); setStatusMsg(''); }}
            className={`py-2 px-1.5 rounded-lg flex items-center justify-center space-x-1 transition-all ${
              activeTab === 'password' ? 'bg-white text-emerald-800 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <KeyRound className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">FPO / Admin</span>
          </button>
        </div>

        {/* Alerts */}
        <div className="px-5 space-y-2">
          {localError && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-800 rounded-xl text-xs flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
              <span>{localError}</span>
            </div>
          )}
          {statusMsg && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs flex items-center space-x-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
              <span>{statusMsg}</span>
            </div>
          )}
        </div>

        {/* Body: Password Tab */}
        {activeTab === 'password' && (
          <form onSubmit={handlePasswordLogin} className="p-5 space-y-3.5 pt-2 text-xs">
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                Official Email Address
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email address"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                Account Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="w-full px-3 py-2 pr-9 border border-slate-300 rounded-lg text-slate-900 text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <p className="text-[10px] text-slate-400 mt-1">
                Protected by salted PBKDF2-SHA256 password hashing.
              </p>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white rounded-xl text-xs font-bold flex items-center justify-center space-x-1.5 shadow-md shadow-emerald-600/20 transition-all"
            >
              {loading && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
              <span>Sign In with Password</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </form>
        )}

        {/* Body: OTP Tab */}
        {activeTab === 'otp' && (
          <form onSubmit={handleVerifyOtp} className="p-5 space-y-3.5 pt-2 text-xs">
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                Registered Mobile Number
              </label>
              <div className="flex flex-wrap sm:flex-nowrap gap-2">
                <input
                  type="tel"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="Enter 10-digit mobile number"
                  className="flex-1 min-w-0 px-3 py-2 border border-slate-300 rounded-lg text-slate-900 font-mono text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={handleSendOtp}
                  disabled={loading || cooldown > 0}
                  className="w-full sm:w-auto px-3 py-2 bg-slate-800 hover:bg-slate-900 disabled:bg-slate-300 text-white rounded-lg text-xs font-semibold whitespace-nowrap transition-colors shrink-0"
                >
                  {cooldown > 0 ? `Resend (${cooldown}s)` : (otpSent ? 'Resend OTP' : 'Send OTP')}
                </button>
              </div>
              <p className="text-[10px] text-slate-400 mt-1">
                A single-use 6-digit cryptographic OTP will be challenged. Valid for 5 minutes.
              </p>
            </div>

            {otpSent && (
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Enter 6-Digit OTP
                </label>
                <input
                  type="text"
                  maxLength={6}
                  required
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  placeholder="• • • • • •"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-center tracking-widest text-slate-900 font-mono text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none font-bold"
                />
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !otpSent}
              className="w-full mt-2 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white rounded-xl text-xs font-bold flex items-center justify-center space-x-1.5 shadow-md shadow-emerald-600/20 transition-all"
            >
              {loading && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
              <span>Verify OTP & Sign In</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </form>
        )}

      </div>
    </div>
  );
}
