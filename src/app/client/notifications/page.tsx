'use client';

import { useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Bell, CheckCheck, Info, AlertTriangle, MapPin, Wallet, Shield, Settings, Loader2 } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { useNotificationStore } from '@/store/notificationStore';
import { toast } from 'sonner';

function getNotifIcon(type: string) {
  switch (type) {
    case 'ride':
      return <MapPin className="w-4 h-4 text-cyan-400" />;
    case 'payment':
      return <Wallet className="w-4 h-4 text-emerald-400" />;
    case 'sos':
      return <Shield className="w-4 h-4 text-red-400" />;
    case 'warning':
      return <AlertTriangle className="w-4 h-4 text-amber-400" />;
    case 'system':
      return <Settings className="w-4 h-4 text-gray-400" />;
    default:
      return <Info className="w-4 h-4 text-blue-400" />;
  }
}

function getNotifColor(type: string) {
  switch (type) {
    case 'ride':
      return 'bg-cyan-500/20';
    case 'payment':
      return 'bg-emerald-500/20';
    case 'sos':
      return 'bg-red-500/20';
    case 'warning':
      return 'bg-amber-500/20';
    default:
      return 'bg-white/5';
  }
}

function formatTime(dateStr: string) {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return 'Ahora';
  if (minutes < 60) return `Hace ${minutes}m`;
  if (hours < 24) return `Hace ${hours}h`;
  if (days === 1) return 'Ayer';
  if (days < 7) return `Hace ${days}d`;
  return date.toLocaleDateString('es-CR', { day: 'numeric', month: 'short' });
}

export default function ClientNotifications() {
  const { user } = useAuthStore();
  const {
    notifications, unreadCount, isLoading,
    fetchNotifications, markAsRead, markAllAsRead, subscribeToNotifications,
  } = useNotificationStore();

  const loadNotifications = useCallback(async () => {
    if (!user?.id) return;
    await fetchNotifications(user.id);
  }, [user?.id, fetchNotifications]);

  useEffect(() => {
    loadNotifications();
    if (!user?.id) return;
    const unsub = subscribeToNotifications(user.id);
    return unsub;
  }, [user?.id, loadNotifications, subscribeToNotifications]);

  const handleMarkAllRead = async () => {
    if (!user?.id) return;
    await markAllAsRead(user.id);
    toast.success('Todas las notificaciones marcadas como leidas');
  };

  const handleMarkRead = async (id: string) => {
    await markAsRead(id);
  };

  if (isLoading) {
    return (
      <div className="p-4 flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-4 space-y-5">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Notificaciones</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            {unreadCount > 0 ? `${unreadCount} sin leer` : 'Todo al dia'}
          </p>
        </div>
        {unreadCount > 0 && (
          <button
            onClick={handleMarkAllRead}
            className="flex items-center gap-1.5 text-xs text-cyan-400 hover:text-cyan-300 bg-cyan-500/10 px-3 py-1.5 rounded-lg"
          >
            <CheckCheck className="w-3.5 h-3.5" />
            Leer todo
          </button>
        )}
      </motion.div>

      {/* Notification list */}
      <div className="space-y-2">
        {notifications.length > 0 ? (
          notifications.map((notif, i) => (
            <motion.div
              key={notif.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
              onClick={() => { if (!notif.is_read) handleMarkRead(notif.id); }}
              className={`glass rounded-xl p-3 flex items-start gap-3 cursor-pointer transition-all hover:bg-white/5 ${
                !notif.is_read ? 'border border-cyan-500/20' : ''
              }`}
            >
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 ${getNotifColor(notif.type)}`}>
                {getNotifIcon(notif.type)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <p className={`text-sm ${!notif.is_read ? 'text-white font-medium' : 'text-gray-300'}`}>
                    {notif.title}
                  </p>
                  {!notif.is_read && (
                    <div className="w-2 h-2 rounded-full bg-cyan-400 flex-shrink-0 mt-1.5" />
                  )}
                </div>
                <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{notif.message}</p>
                <p className="text-[10px] text-gray-600 mt-1">{formatTime(notif.created_at)}</p>
              </div>
            </motion.div>
          ))
        ) : (
          <div className="glass rounded-xl p-8 text-center">
            <Bell className="w-10 h-10 text-gray-600 mx-auto mb-3" />
            <p className="text-sm text-gray-400">Sin notificaciones</p>
            <p className="text-xs text-gray-600 mt-1">Las alertas de viajes y pagos apareceran aqui</p>
          </div>
        )}
      </div>
    </div>
  );
}
