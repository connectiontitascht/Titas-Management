import React, { useState } from 'react';
import { Bell } from 'lucide-react';
import { useNotifications } from '../hooks/useNotifications';

export const NotificationBell = () => {
  const notifications = useNotifications();
  const unreadCount = notifications.filter(n => !n.read).length;
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button onClick={() => setOpen(!open)} className="p-2 hover:bg-slate-100 rounded-full relative">
        <Bell className="w-5 h-5 text-slate-600" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-rose-500 rounded-full"></span>
        )}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)}></div>
          <div className="absolute right-0 mt-2 w-72 bg-white border border-slate-200 rounded-xl shadow-xl z-40 p-4 animate-scale-up">
            <h3 className="font-bold text-sm mb-2">Notifications</h3>
            <div className="max-h-60 overflow-y-auto">
              {notifications.length === 0 && <p className="text-xs text-slate-500">No notifications.</p>}
              {notifications.map(n => (
                <div key={n.id} className="text-xs py-2 border-b border-slate-100 last:border-none">
                  <p className={`font-semibold ${!n.read ? 'text-indigo-600' : 'text-slate-600'}`}>{n.message}</p>
                  <span className="text-[10px] text-slate-400">{new Date(n.createdAt).toLocaleDateString()}</span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
};
