/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  Users, 
  UserPlus, 
  Trash2, 
  Lock, 
  Mail, 
  Shield, 
  CheckCircle, 
  XCircle,
  Key,
  AlertTriangle,
  Info,
  ShieldAlert,
  UserCheck
} from 'lucide-react';
import { 
  collection, 
  doc, 
  setDoc, 
  deleteDoc, 
  onSnapshot, 
  query, 
  where,
  getDocs,
  serverTimestamp 
} from 'firebase/firestore';
import { initializeApp, getApps } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, signOut } from 'firebase/auth';
import { db, handleFirestoreError, OperationType } from '../firebase';
import firebaseConfig from '../../firebase-applet-config.json';
import { AppUser, UserRole } from '../types';

interface SystemUsersSectionProps {
  currentUserId: string;
}

const DEFAULT_PERMISSIONS: Record<UserRole, AppUser['permissions']> = {
  admin: {
    canDeleteTransactions: true,
    canDeleteVouchers: true,
    canApproveSupervisor: true,
    canApproveManager: true,
    canApproveAccounts: true,
    canManageDailyClosing: true,
    canManageSubscribers: true
  },
  supervisor: {
    canDeleteTransactions: false,
    canDeleteVouchers: false,
    canApproveSupervisor: true,
    canApproveManager: false,
    canApproveAccounts: false,
    canManageDailyClosing: false,
    canManageSubscribers: false
  },
  manager: {
    canDeleteTransactions: false,
    canDeleteVouchers: false,
    canApproveSupervisor: false,
    canApproveManager: true,
    canApproveAccounts: false,
    canManageDailyClosing: false,
    canManageSubscribers: false
  },
  accountant: {
    canDeleteTransactions: false,
    canDeleteVouchers: false,
    canApproveSupervisor: false,
    canApproveManager: false,
    canApproveAccounts: true,
    canManageDailyClosing: true,
    canManageSubscribers: true
  },
  operator: {
    canDeleteTransactions: false,
    canDeleteVouchers: false,
    canApproveSupervisor: false,
    canApproveManager: false,
    canApproveAccounts: false,
    canManageDailyClosing: false,
    canManageSubscribers: false
  }
};

const DEFAULT_MENU_ACCESS = {
  showDashboard: true,
  showHistory: true,
  showHomeUser: true,
  showReseller: true,
  showVoucher: true,
  showDailyClosing: true,
};

const getMenuAccessLabel = (key: string) => {
  switch (key) {
    case 'showDashboard': return 'Dashboard';
    case 'showHistory': return 'Tx List';
    case 'showHomeUser': return 'Home User';
    case 'showReseller': return 'Reseller';
    case 'showVoucher': return 'Voucher';
    case 'showDailyClosing': return 'Closing';
    default: return key;
  }
};

export function SystemUsersSection({ currentUserId }: SystemUsersSectionProps) {
  const [appUsers, setAppUsers] = useState<AppUser[]>([]);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserRole>('operator');
  const [permissions, setPermissions] = useState<AppUser['permissions']>(DEFAULT_PERMISSIONS.operator);
  const [menuAccess, setMenuAccess] = useState<Required<AppUser>['menuAccess']>(DEFAULT_MENU_ACCESS);
  
  const [editingUser, setEditingUser] = useState<AppUser | null>(null);
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Start editing a user
  const startEditUser = (user: AppUser) => {
    setEditingUser(user);
    setEmail(user.email);
    setPassword(user.password || '');
    setRole(user.role);
    setPermissions(user.permissions);
    setMenuAccess(user.menuAccess || DEFAULT_MENU_ACCESS);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const cancelEdit = () => {
    setEditingUser(null);
    setEmail('');
    setPassword('');
    setRole('operator');
    setPermissions(DEFAULT_PERMISSIONS.operator);
    setMenuAccess(DEFAULT_MENU_ACCESS);
  };

  // Sync default permissions when role is selected
  const handleRoleChange = (selectedRole: UserRole) => {
    setRole(selectedRole);
    setPermissions(DEFAULT_PERMISSIONS[selectedRole]);
  };

  // Toggle individual permission checkbox
  const togglePermission = (key: keyof AppUser['permissions']) => {
    setPermissions(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  // Toggle individual menu checkbox
  const toggleMenuAccess = (key: keyof Required<AppUser>['menuAccess']) => {
    setMenuAccess(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  // Fetch created users
  useEffect(() => {
    const q = query(collection(db, 'app_users'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: AppUser[] = [];
      snapshot.forEach((docSnap) => {
        list.push({
          id: docSnap.id,
          ...docSnap.data()
        } as AppUser);
      });
      setAppUsers(list);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'app_users');
    });

    return () => unsubscribe();
  }, []);

  // Handle user creation or update
  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!email || !password) {
      setError('Please fill in both Email and Password fields.');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    setLoading(true);

    try {
      const emailTrimmed = email.trim().toLowerCase();
      
      let userRef;
      let newUser: AppUser;
      
      if (editingUser) {
        // Update existing user
        userRef = doc(db, 'app_users', editingUser.id);
        newUser = {
          ...editingUser,
          email: emailTrimmed,
          password: password,
          role,
          permissions,
          menuAccess,
          updatedAt: new Date().toISOString()
        };
      } else {
        // Create new user
        // Check if user already exists
        const q = query(collection(db, 'app_users'), where('email', '==', emailTrimmed));
        const querySnapshot = await getDocs(q);
        if (!querySnapshot.empty) {
          setError('An app user with this email address already exists.');
          setLoading(false);
          return;
        }

        // Generate a new custom ID
        const newUid = `custom_user_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
        userRef = doc(db, 'app_users', newUid);
        newUser = {
          id: newUid,
          email: emailTrimmed,
          password: password,
          isCustomUser: true,
          role,
          permissions,
          menuAccess,
          createdBy: currentUserId,
          createdAt: new Date().toISOString()
        };
      }

      await setDoc(userRef, newUser);

      setSuccess(`App User "${emailTrimmed}" has been successfully ${editingUser ? 'updated' : 'created'}!`);
      
      if (editingUser) {
        cancelEdit();
      } else {
        setEmail('');
        setPassword('');
        setRole('operator');
        setPermissions(DEFAULT_PERMISSIONS.operator);
        setMenuAccess(DEFAULT_MENU_ACCESS);
      }
    } catch (err: any) {
      console.error('Error saving app user:', err);
      setError(err.message || 'Failed to save user. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Delete User
  const handleDeleteUser = async (userToDelete: AppUser) => {
    if (userToDelete.id === currentUserId) {
      alert('You cannot delete your own logged-in user account!');
      return;
    }

    if (!window.confirm(`Are you sure you want to permanently delete user "${userToDelete.email}"? This will revoke their platform permissions.`)) {
      return;
    }

    try {
      await deleteDoc(doc(db, 'app_users', userToDelete.id));
      alert(`User "${userToDelete.email}" permissions have been successfully deleted from the database.`);
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `app_users/${userToDelete.id}`);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in" id="system-users-view">
      {/* Editorial Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 text-white rounded-3xl p-6 sm:p-8 border border-slate-800">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-indigo-400 animate-pulse" />
            <span className="text-xs font-black uppercase tracking-widest text-indigo-400">System Namespace</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black tracking-tight">App User Permissions & Role Management</h2>
          <p className="text-xs text-slate-400 font-medium">
            Register operator staff, supervisors, managers, or accountants and configure their custom access scopes.
          </p>
        </div>
        <div className="flex items-center gap-2.5 shrink-0 bg-slate-950/80 px-4 py-3 rounded-2xl border border-slate-800">
          <Users className="w-5 h-5 text-indigo-400" />
          <div className="text-left font-sans">
            <span className="text-[10px] text-slate-500 font-bold block uppercase tracking-wider">Total Users</span>
            <span className="text-sm font-extrabold text-white block leading-none">{appUsers.length} Users</span>
          </div>
        </div>
      </div>

      {/* Main Grid: Create form vs list table */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Side: Create User Form */}
        <div className="lg:col-span-5 bg-white p-6 sm:p-8 rounded-3xl border border-slate-200 shadow-sm space-y-6">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
            <UserPlus className="w-5 h-5 text-indigo-600" />
            <h3 className="font-extrabold text-sm text-slate-800">{editingUser ? 'Edit Existing App User' : 'Create New App User'}</h3>
            {editingUser && (
              <button onClick={cancelEdit} className="ml-auto text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider hover:bg-slate-200">
                Cancel
              </button>
            )}
          </div>

          {error && (
            <div className="p-3 bg-rose-50 border border-rose-100 text-rose-700 text-xs rounded-xl flex items-start gap-2.5 font-semibold">
              <ShieldAlert className="w-4.5 h-4.5 text-rose-500 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="p-3 bg-emerald-50 border border-emerald-100 text-emerald-700 text-xs rounded-xl flex items-start gap-2.5 font-semibold">
              <CheckCircle className="w-4.5 h-4.5 text-emerald-500 shrink-0 mt-0.5" />
              <span>{success}</span>
            </div>
          )}

          <div className="p-3 bg-emerald-50/50 border border-emerald-100 text-emerald-800 text-[11px] rounded-xl leading-relaxed space-y-1">
            <p className="font-bold text-emerald-900">⚡ Firebase Auth-Free Database Accounts:</p>
            <p className="text-slate-650 font-medium">Operators, managers, and accountants are now created directly as secure database records. They can log in immediately <strong>without needing any setup or changes in your Firebase Console Authentication panel</strong>.</p>
          </div>

          <form onSubmit={handleSaveUser} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1">
                <Mail className="w-3.5 h-3.5 text-slate-450" />
                <span>Email Address (Login ID)</span>
              </label>
              <input 
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="operator@titas.com"
                className="w-full p-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono"
                required
                disabled={loading}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1">
                <Lock className="w-3.5 h-3.5 text-slate-450" />
                <span>Access Password</span>
              </label>
              <input 
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="At least 6 characters"
                className="w-full p-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono"
                required
                disabled={loading}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1">
                <Shield className="w-3.5 h-3.5 text-slate-450" />
                <span>Designated Role</span>
              </label>
              <select
                value={role}
                onChange={e => handleRoleChange(e.target.value as UserRole)}
                className="w-full p-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500 font-bold text-slate-800"
                disabled={loading}
              >
                <option value="operator">Operator / Entry Staff</option>
                <option value="supervisor">Supervisor (Voucher Step 2)</option>
                <option value="manager">Manager (Voucher Step 3)</option>
                <option value="accountant">Accountant / Ledger Clerk</option>
                <option value="admin">Admin / System Owner</option>
              </select>
            </div>

            {/* Granular Permissions Section */}
            <div className="space-y-3 pt-3 border-t border-slate-100">
              <span className="text-[10px] text-slate-400 font-black uppercase tracking-widest block">Configure Access Permissions</span>
              
              <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                <label className="flex items-center gap-2.5 p-2 bg-slate-50 hover:bg-slate-100/80 rounded-xl border border-slate-200/50 cursor-pointer transition select-none">
                  <input 
                    type="checkbox"
                    checked={permissions.canDeleteTransactions}
                    onChange={() => togglePermission('canDeleteTransactions')}
                    className="rounded text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5"
                    disabled={loading}
                  />
                  <div className="text-left">
                    <span className="text-xs font-bold text-slate-800 block">Delete Transactions</span>
                    <span className="text-[9px] text-slate-500 block leading-tight">Can delete entries from standard cash book</span>
                  </div>
                </label>

                <label className="flex items-center gap-2.5 p-2 bg-slate-50 hover:bg-slate-100/80 rounded-xl border border-slate-200/50 cursor-pointer transition select-none">
                  <input 
                    type="checkbox"
                    checked={permissions.canDeleteVouchers}
                    onChange={() => togglePermission('canDeleteVouchers')}
                    className="rounded text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5"
                    disabled={loading}
                  />
                  <div className="text-left">
                    <span className="text-xs font-bold text-slate-800 block">Delete Vouchers</span>
                    <span className="text-[9px] text-slate-500 block leading-tight">Can delete or reset voucher request slips</span>
                  </div>
                </label>

                <label className="flex items-center gap-2.5 p-2 bg-slate-50 hover:bg-slate-100/80 rounded-xl border border-slate-200/50 cursor-pointer transition select-none">
                  <input 
                    type="checkbox"
                    checked={permissions.canApproveSupervisor}
                    onChange={() => togglePermission('canApproveSupervisor')}
                    className="rounded text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5"
                    disabled={loading}
                  />
                  <div className="text-left">
                    <span className="text-xs font-bold text-slate-800 block">Supervisor Approvals</span>
                    <span className="text-[9px] text-slate-500 block leading-tight">Can review and approve vouchers at Step 2</span>
                  </div>
                </label>

                <label className="flex items-center gap-2.5 p-2 bg-slate-50 hover:bg-slate-100/80 rounded-xl border border-slate-200/50 cursor-pointer transition select-none">
                  <input 
                    type="checkbox"
                    checked={permissions.canApproveManager}
                    onChange={() => togglePermission('canApproveManager')}
                    className="rounded text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5"
                    disabled={loading}
                  />
                  <div className="text-left">
                    <span className="text-xs font-bold text-slate-800 block">Manager Approvals</span>
                    <span className="text-[9px] text-slate-500 block leading-tight">Can review and approve vouchers at Step 3</span>
                  </div>
                </label>

                <label className="flex items-center gap-2.5 p-2 bg-slate-50 hover:bg-slate-100/80 rounded-xl border border-slate-200/50 cursor-pointer transition select-none">
                  <input 
                    type="checkbox"
                    checked={permissions.canApproveAccounts}
                    onChange={() => togglePermission('canApproveAccounts')}
                    className="rounded text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5"
                    disabled={loading}
                  />
                  <div className="text-left">
                    <span className="text-xs font-bold text-slate-800 block">Accounts Post & Vet</span>
                    <span className="text-[9px] text-slate-500 block leading-tight">Can commit vouchers to general ledger</span>
                  </div>
                </label>

                <label className="flex items-center gap-2.5 p-2 bg-slate-50 hover:bg-slate-100/80 rounded-xl border border-slate-200/50 cursor-pointer transition select-none">
                  <input 
                    type="checkbox"
                    checked={permissions.canManageDailyClosing}
                    onChange={() => togglePermission('canManageDailyClosing')}
                    className="rounded text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5"
                    disabled={loading}
                  />
                  <div className="text-left">
                    <span className="text-xs font-bold text-slate-800 block">Daily Closing Locks</span>
                    <span className="text-[9px] text-slate-500 block leading-tight">Can record drawer statements and freeze days</span>
                  </div>
                </label>

                <label className="flex items-center gap-2.5 p-2 bg-slate-50 hover:bg-slate-100/80 rounded-xl border border-slate-200/50 cursor-pointer transition select-none">
                  <input 
                    type="checkbox"
                    checked={permissions.canManageSubscribers}
                    onChange={() => togglePermission('canManageSubscribers')}
                    className="rounded text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5"
                    disabled={loading}
                  />
                  <div className="text-left">
                    <span className="text-xs font-bold text-slate-800 block">Subscriber Management</span>
                    <span className="text-[9px] text-slate-500 block leading-tight">Can manage Home Users and Reseller lines</span>
                  </div>
                </label>
              </div>
            </div>

            {/* Menu Bar Access Section */}
            <div className="space-y-3 pt-3 border-t border-slate-100">
              <span className="text-[10px] text-slate-400 font-black uppercase tracking-widest block">Configure Menu Bar Access</span>
              
              <div className="grid grid-cols-2 gap-2">
                <label className="flex items-center gap-2 p-2 bg-slate-50 hover:bg-slate-100/80 rounded-xl border border-slate-200/50 cursor-pointer transition select-none">
                  <input 
                    type="checkbox"
                    checked={menuAccess.showDashboard}
                    onChange={() => toggleMenuAccess('showDashboard')}
                    className="rounded text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5"
                    disabled={loading}
                  />
                  <span className="text-[11px] font-bold text-slate-850">Dashboard</span>
                </label>

                <label className="flex items-center gap-2 p-2 bg-slate-50 hover:bg-slate-100/80 rounded-xl border border-slate-200/50 cursor-pointer transition select-none">
                  <input 
                    type="checkbox"
                    checked={menuAccess.showHistory}
                    onChange={() => toggleMenuAccess('showHistory')}
                    className="rounded text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5"
                    disabled={loading}
                  />
                  <span className="text-[11px] font-bold text-slate-850">Tx List</span>
                </label>

                <label className="flex items-center gap-2 p-2 bg-slate-50 hover:bg-slate-100/80 rounded-xl border border-slate-200/50 cursor-pointer transition select-none">
                  <input 
                    type="checkbox"
                    checked={menuAccess.showHomeUser}
                    onChange={() => toggleMenuAccess('showHomeUser')}
                    className="rounded text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5"
                    disabled={loading}
                  />
                  <span className="text-[11px] font-bold text-slate-850">Home User</span>
                </label>

                <label className="flex items-center gap-2 p-2 bg-slate-50 hover:bg-slate-100/80 rounded-xl border border-slate-200/50 cursor-pointer transition select-none">
                  <input 
                    type="checkbox"
                    checked={menuAccess.showReseller}
                    onChange={() => toggleMenuAccess('showReseller')}
                    className="rounded text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5"
                    disabled={loading}
                  />
                  <span className="text-[11px] font-bold text-slate-850">Reseller</span>
                </label>

                <label className="flex items-center gap-2 p-2 bg-slate-50 hover:bg-slate-100/80 rounded-xl border border-slate-200/50 cursor-pointer transition select-none">
                  <input 
                    type="checkbox"
                    checked={menuAccess.showVoucher}
                    onChange={() => toggleMenuAccess('showVoucher')}
                    className="rounded text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5"
                    disabled={loading}
                  />
                  <span className="text-[11px] font-bold text-slate-850">Voucher</span>
                </label>

                <label className="flex items-center gap-2 p-2 bg-slate-50 hover:bg-slate-100/80 rounded-xl border border-slate-200/50 cursor-pointer transition select-none">
                  <input 
                    type="checkbox"
                    checked={menuAccess.showDailyClosing}
                    onChange={() => toggleMenuAccess('showDailyClosing')}
                    className="rounded text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5"
                    disabled={loading}
                  />
                  <span className="text-[11px] font-bold text-slate-850">Daily Closing</span>
                </label>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-xs shadow-md transition duration-150 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <>
                  <UserPlus className="w-4 h-4" />
                  <span>{editingUser ? 'Update Account & Save Changes' : 'Create Account & Save Permissions'}</span>
                </>
              )}
            </button>
          </form>
        </div>

        {/* Right Side: Registered App Users List */}
        <div className="lg:col-span-7 bg-white p-6 sm:p-8 rounded-3xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-slate-700" />
              <h3 className="font-extrabold text-sm text-slate-800 font-sans">Active App Users</h3>
            </div>
            <span className="text-[10px] bg-indigo-50 text-indigo-600 font-bold px-2 py-0.5 rounded-full uppercase tracking-wider font-sans">
              Configured Roles
            </span>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-100">
            <table className="w-full text-left border-collapse font-sans text-xs">
              <thead>
                <tr className="bg-slate-50 text-slate-500 font-bold border-b border-slate-100">
                  <th className="p-3.5">User Identity</th>
                  <th className="p-3.5 text-center">Designated Role</th>
                  <th className="p-3.5 text-center">Menu Access</th>
                  <th className="p-3.5 text-center">Permissions Grid</th>
                  <th className="p-3.5 text-center w-20">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {appUsers.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-slate-450 font-semibold italic">
                      No app users configured yet. Only the default primary Super Admin exists.
                    </td>
                  </tr>
                ) : (
                  appUsers.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50/55 transition duration-150 font-medium">
                      <td className="p-3.5 space-y-0.5">
                        <div className="flex items-center gap-2">
                          <UserCheck className="w-4 h-4 text-emerald-500 shrink-0" />
                          <span className="font-bold text-slate-800 font-mono truncate max-w-[150px] sm:max-w-[180px]">{item.email}</span>
                        </div>
                        <div className="text-[9px] text-slate-400 font-bold block">
                          ID: <span className="font-mono text-slate-500 select-all">{item.id}</span>
                        </div>
                        {item.password && (
                          <div className="text-[9px] text-slate-400 font-bold flex items-center gap-1">
                            <span>Password:</span>
                            <span className="font-mono text-indigo-600 bg-indigo-50 px-1 py-0.5 rounded border border-indigo-150 select-all font-extrabold">{item.password}</span>
                          </div>
                        )}
                      </td>
                      
                      <td className="p-3.5 text-center">
                        <span className={`inline-block text-[10px] font-extrabold px-2.5 py-0.5 rounded-full capitalize ${
                          item.role === 'admin' ? 'bg-indigo-950 text-indigo-400' :
                          item.role === 'supervisor' ? 'bg-emerald-950 text-emerald-400' :
                          item.role === 'manager' ? 'bg-amber-950 text-amber-400' :
                          item.role === 'accountant' ? 'bg-cyan-950 text-cyan-400' :
                          'bg-slate-100 text-slate-650'
                        }`}>
                          {item.role === 'admin' ? 'System Admin' : item.role}
                        </span>
                      </td>

                      <td className="p-3.5">
                        <div className="flex flex-wrap gap-1.5 justify-center max-w-[180px] mx-auto">
                          {(item.menuAccess ? Object.entries(item.menuAccess) : [
                            ['showDashboard', true],
                            ['showHistory', true],
                            ['showHomeUser', true],
                            ['showReseller', true],
                            ['showVoucher', true],
                            ['showDailyClosing', true]
                          ]).map(([key, value]) => {
                            if (!value) return null;
                            return (
                              <span key={key} className="bg-slate-100 text-slate-600 text-[8px] font-extrabold px-1.5 py-0.5 rounded border border-slate-200">
                                {getMenuAccessLabel(key)}
                              </span>
                            );
                          })}
                          {item.menuAccess && !Object.values(item.menuAccess).some(Boolean) && (
                            <span className="text-rose-500 italic text-[9px] font-bold">No Menu Access</span>
                          )}
                        </div>
                      </td>
 
                      <td className="p-3.5">
                        <div className="flex flex-wrap gap-1.5 justify-center max-w-[250px] mx-auto">
                          {item.permissions?.canDeleteTransactions && (
                            <span className="bg-slate-100 text-slate-600 text-[8px] font-bold px-1.5 py-0.5 rounded border border-slate-200">Tx Del</span>
                          )}
                          {item.permissions?.canDeleteVouchers && (
                            <span className="bg-slate-100 text-slate-600 text-[8px] font-bold px-1.5 py-0.5 rounded border border-slate-200">Vo Del</span>
                          )}
                          {item.permissions?.canApproveSupervisor && (
                            <span className="bg-emerald-50 text-emerald-600 text-[8px] font-bold px-1.5 py-0.5 rounded border border-emerald-100">Supervisor App</span>
                          )}
                          {item.permissions?.canApproveManager && (
                            <span className="bg-amber-50 text-amber-600 text-[8px] font-bold px-1.5 py-0.5 rounded border border-amber-100 font-sans">Manager App</span>
                          )}
                          {item.permissions?.canApproveAccounts && (
                            <span className="bg-cyan-50 text-cyan-600 text-[8px] font-bold px-1.5 py-0.5 rounded border border-cyan-100">Accounts App</span>
                          )}
                          {item.permissions?.canManageDailyClosing && (
                            <span className="bg-purple-50 text-purple-600 text-[8px] font-bold px-1.5 py-0.5 rounded border border-purple-100 font-sans">Closing</span>
                          )}
                          {item.permissions?.canManageSubscribers && (
                            <span className="bg-teal-50 text-teal-600 text-[8px] font-bold px-1.5 py-0.5 rounded border border-teal-100">Subscribers</span>
                          )}
                          {!Object.values(item.permissions || {}).some(Boolean) && (
                            <span className="text-slate-400 italic text-[9px] font-semibold">No active permissions</span>
                          )}
                        </div>
                      </td>

                      <td className="p-3.5 text-center flex items-center justify-center gap-1">
                        <button
                          type="button"
                          onClick={() => startEditUser(item)}
                          className="p-1.5 rounded-lg text-indigo-500 hover:text-indigo-600 hover:bg-indigo-50 transition cursor-pointer flex items-center justify-center"
                          title="Edit Permissions/Role"
                        >
                          <Shield className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteUser(item)}
                          disabled={item.id === currentUserId}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed"
                          title={item.id === currentUserId ? "Cannot delete yourself" : "Delete Permissions"}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Quick Informational Notice */}
          <div className="p-4 bg-amber-50 border border-amber-100 text-amber-800 text-xs rounded-2xl flex gap-3">
            <Info className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <span className="font-extrabold block">How Role Permissions Work:</span>
              <p className="text-slate-650 leading-relaxed font-medium text-[11px]">
                When any of the created accounts logs into this software, their specific role and checked/unchecked privileges are dynamically verified. For example, an <strong>Operator / Entry Staff</strong> can record data but is blocked from deleting transactions or processing multi-step voucher approvals.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
