'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import {
  ArrowLeft, Bell, BellOff, Check, Trash2,
  Loader2, Shield, AlertTriangle, Info, CheckCircle
} from 'lucide-react';

interface Notification {
  id: string;
  title: string;
  message: string;
  type: string;
  is_read: boolean;
  created_at: string;
}

export default function DriverNotifications() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');

  useEffect(() => {
    if (user?.id) fetchNotifications();
  }, [user?.id, filter]);

  const fetchNotifications = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (filter === 'unread') {
        query = query.eq('is_read', false);
      }

      const { data, error } = await query;
      if (error) throw error;
      setNotifications(data || []);
    } catch (err) {
      console.error('Error fetching notifications:', err);
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (id: string) => {
    try {
      await supabase.from('notifications').update({ is_read: true }).eq('id', id);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
    } catch (err) {
      console.error('Error marking notification:', err);
    }
  };

  const markAllRead = async () => {
    try {
      await supabase.from('notifications').update({ is_read: true }).eq('user_id', user.id);
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      toast.success('Todas las notificaciones leidas');
    } catch (err) {
      console.error('Error marking all:', err);
    }
  };

  const deleteNotification = async (id: string) => {
    try {
      await supabase.from('notifications').delete().eq('id', id);
      setNotifications(prev => prev.filter(n => n.id !== id));
      toast.success('Notificacion eliminada');
    } catch (err) {
      console.error('Error deleting:', err);
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'ride': return <Shield className="w-5 h-5 text-cyan-400" />;
      case 'payment': return <CheckCircle className="w-5 h-5 text-emerald-400" />;
      case 'warning': return <AlertTriangle className="w-5 h-5 text-amber-400" />;
      case 'sos': return <AlertTriangle className="w-5 h-5 text-red-400" />;
      default: return <Info className="w-5 h-5 text-blue-400" />;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'ride': return 'border-l-cyan-500';
      case 'payment': return 'border-l-emerald-500';
      case 'warning': return 'border-l-amber-500';
      case 'sos': return 'border-l-red-500';
      default: return 'border-l-blue-500';
    }
  };

  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Ahora';
    if (mins < 60) return `Hace ${mins}m`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `Hace ${hours}h`;
    const days = Math.floor(hours / 24);
    return `Hace ${days}d`;
  };

  const unreadCount = notifications.filter(n => !n.is_read).length;

  return (
    <div className="min-h-screen bg-rida-dark">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-rida-dark/80 backdrop-blur-xl border-b border-white/5">
        <div className="flex items-center gap-3 p-4">
          <button onClick={() => router.back()} className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center">
            <ArrowLeft className="w-5 h-5 text-white" />
          </button>
          <h1 className="text-lg font-bold text-white">Notificaciones</h1>
          {unreadCount > 0 && (
            <span className="ml-auto flex items-center gap-1 text-xs text-cyan-400 bg-cyan-500/20 px-2 py-0.5 rounded-full">
              <Bell className="w-3 h-3" /> {unreadCount} nuevas
            </span>
          )}
        </div>

        {/* Filter Tabs */}
        <div className="flex gap-2 px-4 pb-3">
          <button
            onClick={() => setFilter('all')}
            className={`px-4 py-1.5 rounded-full text-xs font-medium transition-all ${
              filter === 'all' ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30' : 'bg-white/5 text-gray-400 border border-transparent'
            }`}
          >
            Todas
          </button>
          <button
            onClick={() => setFilter('unread')}
            className={`px-4 py-1.5 rounded-full text-xs font-medium transition-all ${
              filter === 'unread' ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30' : 'bg-white/5 text-gray-400 border border-transparent'
            }`}
          >
            No leidas
          </button>
          <button
            onClick={markAllRead}
            className="ml-auto flex items-center gap-1 px-3 py-1.5 rounded-full text-xs text-gray-400 bg-white/5 hover:bg-white/10"
          >
            <Check className="w-3 h-3" /> Marcar todas
          </button>
        </div>
      </div>

      <div className="p-4 space-y-2">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
          </div>
        ) : notifications.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-16"
          >
            <BellOff className="w-12 h-12 text-gray-600 mx-auto mb-3" />
            <p className="text-gray-500 text-sm">No hay notificaciones</p>
            <p className="text-gray-600 text-xs mt-1">Las notificaciones nuevas apareceran aqui</p>
          </motion.div>
        ) : (
          notifications.map((notif, i) => (
            <motion.div
              key={notif.id}
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
              onClick={() => !notif.is_read && markAsRead(notif.id)}
              className={`glass rounded-xl p-3 border-l-2 ${getTypeColor(notif.type)} ${!notif.is_read ? 'bg-white/5' : 'opacity-60'} cursor-pointer transition-all`}
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center flex-shrink-0 mt-0.5">
                  {getIcon(notif.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-medium text-white truncate">{notif.title}</h3>
                    <span className="text-[10px] text-gray-500 flex-shrink-0">{timeAgo(notif.created_at)}</span>
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5 line-clamp-2">{notif.message}</p>
                </div>
                <div className="flex flex-col gap-1 flex-shrink-0">
                  {!notif.is_read && (
                    <div className="w-2 h-2 rounded-full bg-cyan-400" />
                  )}
                  <button
                    onClick={(e) => { e.stopPropagation(); deleteNotification(notif.id); }}
                    className="w-6 h-6 rounded-lg bg-white/5 flex items-center justify-center hover:bg-red-500/20"
                  >
                    <Trash2 className="w-3 h-3 text-gray-500" />
                  </button>
                </div>
              </div>
            </motion.div>
          ))
        )}
      </div>
    </div>
  );
}
