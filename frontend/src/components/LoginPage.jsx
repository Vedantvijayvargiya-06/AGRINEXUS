import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import {
  Sprout,
  ShieldCheck,
  Mail,
  Lock,
  Eye,
  EyeOff,
  Smartphone,
  KeyRound,
  AlertCircle,
  Loader2,
  ArrowRight,
  CheckCircle2,
  Globe,
  UserPlus,
  User,
  MapPin,
  Settings
} from 'lucide-react';

export default function LoginPage() {
  const {
    loginWithPassword,
    signup,
    getAdminSetupStatus,
    claimAdminSetup,
    requestOtp,
    loginWithOtp
  } = useAuth();
  const { lang, toggleLanguage } = useLanguage();

  const [activeTab, setActiveTab] = useState('password'); // 'password' | 'otp' | 'signup'

  // Password Login State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // OTP Login State
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  // Signup State (strictly least-privilege public roles: farmer / buyer)
  const [signupName, setSignupName] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPhone, setSignupPhone] = useState('');
  const [signupLocality, setSignupLocality] = useState('Kolar, Karnataka');
  const [signupRole, setSignupRole] = useState('farmer');
  const [signupPassword, setSignupPassword] = useState('');

  // First-Run Admin Claim State (only rendered when server reports unclaimed initial admin)
  const [adminNeedsSetup, setAdminNeedsSetup] = useState(false);
  const [showAdminSetup, setShowAdminSetup] = useState(false);
  const [adminSetupPassword, setAdminSetupPassword] = useState('');

  // Status & Error
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    let mounted = true;
    getAdminSetupStatus()
      .then((status) => {
        if (mounted && status?.needs_setup) {
          setAdminNeedsSetup(true);
        }
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, []);

  // 1. Password Login Handler
  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    if (!email.trim() || !password) {
      setErrorMessage('Please enter both your registered email and password.');
      return;
    }

    setLoading(true);
    try {
      await loginWithPassword(email.trim(), password);
      setSuccessMessage('Authentication successful! Loading AgriNexus workspace...');
    } catch (err) {
      setErrorMessage(err.message || 'Authentication failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  // 2. Request OTP Handler
  const handleRequestOtp = async (e) => {
    e?.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    const cleanPhone = phone.trim();
    if (!/^\d{10}$/.test(cleanPhone)) {
      setErrorMessage('Please enter a valid 10-digit mobile number.');
      return;
    }

    setLoading(true);
    try {
      const res = await requestOtp(cleanPhone);
      setOtpSent(true);
      setSuccessMessage(res.message || '6-digit OTP has been dispatched to your mobile number.');
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
      setErrorMessage(err.message || 'Failed to dispatch OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // 3. Verify OTP Handler
  const handleOtpVerify = async (e) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    const cleanOtp = otp.trim();
    if (!/^\d{6}$/.test(cleanOtp)) {
      setErrorMessage('Please enter the 6-digit OTP code received.');
      return;
    }

    setLoading(true);
    try {
      await loginWithOtp(phone.trim(), cleanOtp);
      setSuccessMessage('Kisan OTP verification successful! Entering dashboard...');
    } catch (err) {
      setErrorMessage(err.message || 'Invalid or expired OTP. Please check and retry.');
    } finally {
      setLoading(false);
    }
  };

  // 4. Public Signup Handler
  const handleSignupSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    if (signupName.trim().length < 2) {
      setErrorMessage('Please enter your full name (at least 2 characters).');
      return;
    }
    if (!signupEmail.trim() && !signupPhone.trim()) {
      setErrorMessage('Please provide an email address or 10-digit mobile number.');
      return;
    }
    if (signupPhone.trim() && !/^\d{10}$/.test(signupPhone.trim())) {
      setErrorMessage('Mobile number must be exactly 10 digits.');
      return;
    }
    if (signupPassword.length < 8) {
      setErrorMessage('Password must be at least 8 characters long.');
      return;
    }

    setLoading(true);
    try {
      await signup({
        name: signupName.trim(),
        email: signupEmail.trim() || null,
        phone: signupPhone.trim() || null,
        password: signupPassword,
        locality: signupLocality.trim() || 'Kolar, Karnataka',
        role: signupRole
      });
      setSuccessMessage('Account created! Entering AgriNexus workspace...');
    } catch (err) {
      setErrorMessage(err.message || 'Registration failed. Please verify your details.');
    } finally {
      setLoading(false);
    }
  };

  // 5. One-Time Admin Claim Handler
  const handleAdminClaimSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    if (adminSetupPassword.length < 8) {
      setErrorMessage('Administrator password must be at least 8 characters.');
      return;
    }

    setLoading(true);
    try {
      await claimAdminSetup(adminSetupPassword);
      setAdminNeedsSetup(false);
      setShowAdminSetup(false);
    } catch (err) {
      setErrorMessage(err.message || 'Failed to complete administrator setup.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-950 flex flex-col justify-center items-center p-3 sm:p-4 relative selection:bg-emerald-500 selection:text-white">
      {/* Top Bar with Language toggle */}
      <div className="w-full max-w-md flex justify-end mb-3 sm:mb-0 sm:w-auto sm:fixed sm:top-4 sm:right-4 z-10">
        <button
          type="button"
          onClick={toggleLanguage}
          className="px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-800/80 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center space-x-1.5 backdrop-blur-md transition-colors"
        >
          <Globe className="w-3.5 h-3.5 text-emerald-400" />
          <span>{lang === 'en' ? 'हिंदी में बदलें' : 'Switch to English'}</span>
        </button>
      </div>

      <div className="w-full max-w-md animate-in fade-in zoom-in-95 duration-200">
        {/* Brand Banner */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 text-white shadow-lg shadow-emerald-500/30 mb-3">
            <Sprout className="w-8 h-8" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Agri<span className="text-emerald-400">Nexus</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Post-Harvest Decision Intelligence & Spoilage Prevention System
          </p>
          <div className="inline-flex items-center space-x-1.5 mt-2 px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[11px] font-semibold">
            <ShieldCheck className="w-3 h-3" />
            <span>Enterprise Edition</span>
          </div>
        </div>

        {/* Login Card */}
        <div className="bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden">
          {/* Method Tabs */}
          <div className="grid grid-cols-3 p-1.5 bg-slate-100/90 border-b border-slate-200 text-[11px] sm:text-xs font-bold gap-1">
            <button
              type="button"
              onClick={() => {
                setActiveTab('password');
                setErrorMessage('');
                setSuccessMessage('');
              }}
              className={`py-2 px-1 rounded-xl flex items-center justify-center space-x-1 transition-all ${
                activeTab === 'password'
                  ? 'bg-white text-emerald-800 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <KeyRound className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">Sign In</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab('otp');
                setErrorMessage('');
                setSuccessMessage('');
              }}
              className={`py-2 px-1 rounded-xl flex items-center justify-center space-x-1 transition-all ${
                activeTab === 'otp'
                  ? 'bg-white text-emerald-800 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Smartphone className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">Kisan OTP</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab('signup');
                setErrorMessage('');
                setSuccessMessage('');
              }}
              className={`py-2 px-1 rounded-xl flex items-center justify-center space-x-1 transition-all ${
                activeTab === 'signup'
                  ? 'bg-white text-emerald-800 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <UserPlus className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">Sign Up</span>
            </button>
          </div>

          <div className="p-4 sm:p-7">
            {/* Notifications / Alerts */}
            {errorMessage && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-800 rounded-xl text-xs flex items-center space-x-2 font-medium animate-in fade-in">
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}
            {successMessage && (
              <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs flex items-center space-x-2 font-medium animate-in fade-in">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{successMessage}</span>
              </div>
            )}

            {/* TAB 1: Password Login */}
            {activeTab === 'password' && (
              <form onSubmit={handlePasswordSubmit} className="space-y-4">
                <div>
                  <label
                    htmlFor="login-email"
                    className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center space-x-1"
                  >
                    <Mail className="w-3.5 h-3.5 text-slate-500" />
                    <span>Registered Email Address</span>
                  </label>
                  <input
                    id="login-email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      setErrorMessage('');
                    }}
                    placeholder="Enter your email address"
                    className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all font-medium"
                  />
                </div>

                <div>
                  <label
                    htmlFor="login-password"
                    className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center space-x-1"
                  >
                    <Lock className="w-3.5 h-3.5 text-slate-500" />
                    <span>Password</span>
                  </label>
                  <div className="relative">
                    <input
                      id="login-password"
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        setErrorMessage('');
                      }}
                      placeholder="Enter your password"
                      className="w-full px-3.5 py-2.5 pr-10 border border-slate-300 rounded-xl text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all font-medium"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                      className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 focus:outline-none"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center justify-center space-x-2 shadow-lg shadow-emerald-600/25 transition-all disabled:opacity-50 mt-2"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Verifying Credentials...</span>
                    </>
                  ) : (
                    <>
                      <span>Sign In to AgriNexus</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>
            )}

            {/* TAB 2: Kisan OTP Login */}
            {activeTab === 'otp' && (
              <div className="space-y-4">
                <div>
                  <label
                    htmlFor="otp-phone"
                    className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center space-x-1"
                  >
                    <Smartphone className="w-3.5 h-3.5 text-slate-500" />
                    <span>Farmer Mobile Number (10 digits)</span>
                  </label>
                  <div className="flex flex-wrap sm:flex-nowrap gap-2">
                    <div className="flex items-center flex-1 min-w-[160px] space-x-2">
                      <div className="flex items-center px-2.5 sm:px-3 py-2.5 border border-slate-300 rounded-xl bg-slate-50 text-slate-500 text-xs font-bold shrink-0">
                        +91
                      </div>
                      <input
                        id="otp-phone"
                        type="tel"
                        maxLength={10}
                        value={phone}
                        onChange={(e) => {
                          setPhone(e.target.value.replace(/\D/g, ''));
                          setErrorMessage('');
                        }}
                        placeholder="Enter 10-digit mobile"
                        disabled={otpSent && cooldown > 0}
                        className="flex-1 min-w-0 px-3 py-2.5 border border-slate-300 rounded-xl text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={handleRequestOtp}
                      disabled={loading || phone.length < 10 || cooldown > 0}
                      className="w-full sm:w-auto px-3.5 py-2.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold disabled:opacity-50 transition-colors whitespace-nowrap shrink-0"
                    >
                      {cooldown > 0 ? `${cooldown}s` : otpSent ? 'Resend' : 'Send OTP'}
                    </button>
                  </div>
                </div>

                {otpSent && (
                  <form onSubmit={handleOtpVerify} className="space-y-3 pt-2 border-t border-slate-100 animate-in fade-in">
                    <div>
                      <label
                        htmlFor="otp-code"
                        className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center space-x-1"
                      >
                        <Lock className="w-3.5 h-3.5 text-slate-500" />
                        <span>Enter 6-Digit OTP</span>
                      </label>
                      <input
                        id="otp-code"
                        type="text"
                        maxLength={6}
                        required
                        value={otp}
                        onChange={(e) => {
                          setOtp(e.target.value.replace(/\D/g, ''));
                          setErrorMessage('');
                        }}
                        placeholder="• • • • • •"
                        className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-center text-lg tracking-widest font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-bold"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={loading || otp.length !== 6}
                      className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center justify-center space-x-2 shadow-lg shadow-emerald-600/25 transition-all disabled:opacity-50"
                    >
                      {loading ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Verifying OTP...</span>
                        </>
                      ) : (
                        <>
                          <span>Verify & Access Dashboard</span>
                          <ArrowRight className="w-4 h-4" />
                        </>
                      )}
                    </button>
                  </form>
                )}
              </div>
            )}

            {/* TAB 3: Public Registration */}
            {activeTab === 'signup' && (
              <form onSubmit={handleSignupSubmit} className="space-y-3">
                <div>
                  <label
                    htmlFor="signup-name"
                    className="block text-xs font-bold text-slate-700 mb-1 flex items-center space-x-1"
                  >
                    <User className="w-3.5 h-3.5 text-slate-500" />
                    <span>Full Name</span>
                  </label>
                  <input
                    id="signup-name"
                    type="text"
                    required
                    value={signupName}
                    onChange={(e) => setSignupName(e.target.value)}
                    placeholder="e.g.Kavita Gowda"
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <label htmlFor="signup-email" className="block text-xs font-bold text-slate-700 mb-1">
                      Email Address
                    </label>
                    <input
                      id="signup-email"
                      type="email"
                      required
                      value={signupEmail}
                      onChange={(e) => setSignupEmail(e.target.value)}
                      placeholder="name@example.com"
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label htmlFor="signup-phone" className="block text-xs font-bold text-slate-700 mb-1">
                      Mobile (10 digits)
                    </label>
                    <input
                      id="signup-phone"
                      type="tel"
                      maxLength={10}
                      value={signupPhone}
                      onChange={(e) => setSignupPhone(e.target.value.replace(/\D/g, ''))}
                      placeholder="Optional 10 digits"
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <label htmlFor="signup-role" className="block text-xs font-bold text-slate-700 mb-1">
                      Account Type
                    </label>
                    <select
                      id="signup-role"
                      value={signupRole}
                      onChange={(e) => setSignupRole(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs text-slate-900 bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    >
                      <option value="farmer">Farmer / Grower</option>
                      <option value="buyer">Procurement Buyer</option>
                    </select>
                  </div>
                  <div>
                    <label htmlFor="signup-locality" className="block text-xs font-bold text-slate-700 mb-1 flex items-center space-x-1">
                      <MapPin className="w-3 h-3 text-slate-400" />
                      <span>Locality</span>
                    </label>
                    <input
                      id="signup-locality"
                      type="text"
                      value={signupLocality}
                      onChange={(e) => setSignupLocality(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="signup-password" className="block text-xs font-bold text-slate-700 mb-1">
                    Password (min 8 characters)
                  </label>
                  <input
                    id="signup-password"
                    type="password"
                    required
                    minLength={8}
                    value={signupPassword}
                    onChange={(e) => setSignupPassword(e.target.value)}
                    placeholder="Create a strong password"
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center justify-center space-x-2 shadow-lg shadow-emerald-600/25 transition-all disabled:opacity-50"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Creating Account...</span>
                    </>
                  ) : (
                    <>
                      <span>Create Account</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>
            )}

            {/* First-Run Initial Admin Claim Flow */}
            {adminNeedsSetup && (
              <div className="mt-5 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAdminSetup((prev) => !prev)}
                  className="w-full text-left px-3 py-2 rounded-xl bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-900 text-xs font-semibold flex items-center justify-between transition-colors"
                >
                  <span className="flex items-center space-x-1.5">
                    <Settings className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                    <span>First-Time Administrator Setup Required</span>
                  </span>
                  <span className="text-[11px] font-bold">{showAdminSetup ? 'Hide' : 'Configure'}</span>
                </button>

                {showAdminSetup && (
                  <form onSubmit={handleAdminClaimSubmit} className="mt-3 p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2.5">
                    <p className="text-[11px] text-slate-600">
                      Set the initial password for <strong>superadmin@agrinexus.gov.in</strong>. This one-time claim locks immediately after setup.
                    </p>
                    <input
                      type="password"
                      required
                      minLength={8}
                      value={adminSetupPassword}
                      onChange={(e) => setAdminSetupPassword(e.target.value)}
                      placeholder="New administrator password (min 8 chars)"
                      aria-label="New administrator password"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs text-slate-900 bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    />
                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold transition-colors disabled:opacity-50"
                    >
                      Claim & Sign In as Administrator
                    </button>
                  </form>
                )}
              </div>
            )}
          </div>

          {/* Footer security badge */}
          <div className="bg-slate-50 px-4 sm:px-6 py-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500">
            <span className="flex items-center space-x-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span>PBKDF2-SHA256 Protected</span>
            </span>
            <span className="font-semibold text-slate-600">JWT Session Auth</span>
          </div>
        </div>

        {/* Footer info */}
        <p className="text-center text-[11px] text-slate-400 mt-4">
          Ministry of Agriculture & Farmers Welfare • Digital Agriculture Mission
        </p>
      </div>
    </div>
  );
}
