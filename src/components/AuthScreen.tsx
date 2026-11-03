import React, { useState } from 'react';
import { db } from '../firebase';
import { 
  collection, 
  query, 
  where, 
  getDocs 
} from 'firebase/firestore';
import { 
  Mail, 
  Lock, 
  User, 
  LogIn, 
  UserPlus, 
  AlertCircle
} from 'lucide-react';

interface AuthScreenProps {
  onCustomLogin?: (user: { uid: string; email: string; isCustom: boolean }) => void;
}

export function AuthScreen({ onCustomLogin }: AuthScreenProps) {
  const [isLogin, setIsLogin] = useState(true);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Traditional Email/Password Auth (Firestore-only)
  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email || !password) {
      setError('Please enter both email and password.');
      return;
    }

    const emailLower = email.trim().toLowerCase();

    setLoading(true);

    try {
        // Sign-In
        // Check if there is a custom Firestore-only user with this email
        const appUsersRef = collection(db, 'app_users');
        const q = query(appUsersRef, where('email', '==', emailLower));
        const querySnapshot = await getDocs(q);
        
        if (!querySnapshot.empty) {
          const userDoc = querySnapshot.docs[0];
          const userData = userDoc.data();
          if (userData.password) {
            if (userData.password === password) {
              if (onCustomLogin) {
                onCustomLogin({
                  uid: userDoc.id,
                  email: userData.email,
                  isCustom: true
                });
                return;
              }
            } else {
              setError('Incorrect password for this user account.');
              return;
            }
          } else {
            setError('User account not configured for local login.');
            return;
          }
        } else {
            setError('User not found.');
            return;
        }
    } catch (err: any) {
      console.error(err);
      setError('Something went wrong during login. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F1F5F9] w-full flex items-center justify-center p-4 sm:p-6 relative overflow-hidden">
      {/* Decorative blurry background highlights */}
      <div className="absolute top-[10%] left-[5%] w-[400px] h-[400px] bg-indigo-500/10 blur-[120px] rounded-full pointer-events-none -z-10"></div>
      <div className="absolute bottom-[10%] right-[30%] w-[400px] h-[400px] bg-rose-500/10 blur-[120px] rounded-full pointer-events-none -z-10"></div>

      {/* Centered Register/Login card */}
      <div className="w-full max-w-md bg-white p-8 sm:p-10 rounded-2xl shadow-xl border border-slate-100 flex flex-col justify-center relative">
        {/* Simple elegant Logo header */}
        <div className="flex items-center gap-2.5 justify-center mb-6">
          <div className="w-9 h-9 bg-indigo-600 rounded-lg flex items-center justify-center font-bold text-lg text-white shadow-md">
            TA
          </div>
          <span className="text-sm font-bold text-slate-800 tracking-tight">Titas Accounting</span>
        </div>

        <div className="space-y-6">
          <div className="text-center space-y-1">
            <h3 className="text-xl font-bold text-slate-900">
              Log In to Account
            </h3>
            <p className="text-slate-500 text-[11px]">
              Sign in to access your financial records
            </p>
          </div>

          {/* Status Notifications */}
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-100 text-rose-700 text-xs rounded-lg flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-500" />
              <span>{error}</span>
            </div>
          )}

          {/* Form Auth */}
          <form onSubmit={handleEmailAuth} className="space-y-3.5">
            <div className="space-y-1">
              <label className="block text-[11px] font-semibold text-slate-700">Email Address</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
                  <Mail className="w-4 h-4" />
                </span>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="pl-9 w-full p-2 text-xs border border-slate-200 rounded-lg bg-slate-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  disabled={loading}
                  required
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="block text-[11px] font-semibold text-slate-700">Password</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
                  <Lock className="w-4 h-4" />
                </span>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Password"
                  className="pl-9 w-full p-2 text-xs border border-slate-200 rounded-lg bg-slate-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  disabled={loading}
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold text-xs shadow-sm hover:shadow transition duration-150 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-70"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <>
                  <LogIn className="w-4 h-4" />
                  <span>Log In</span>
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
