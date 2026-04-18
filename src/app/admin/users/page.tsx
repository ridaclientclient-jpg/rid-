'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, Shield, ShieldOff, Eye, Users, Mail, Phone,
  ChevronDown, MoreHorizontal, Ban, CheckCircle2, XCircle,
  UserCheck, Loader2,
} from 'lucide-react';
import { supabase, type Profile } from '@/lib/supabase';
import { toast } from 'sonner';

type UserRole = 'client' | 'driver' | 'admin' | 'vendor' | 'courier';
type UserStatus = 'active' | 'blocked' | 'pending';

interface UserData {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: UserRole;
  status: UserStatus;
  joined: string;
  isVerified: boolean;
  avatar: string;
}

const roleLabels: Record<UserRole, string> = {
  client: 'Cliente',
  driver: 'Conductor',
  admin: 'Admin',
  vendor: 'Vendedor',
  courier: 'Repartidor',
};

const roleColors: Record<UserRole, string> = {
  client: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  driver: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  admin: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  vendor: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  courier: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
};

const filterTabs = ['Todos', 'Clientes', 'Conductores', 'Vendedores', 'Repartidores', 'Bloqueados'] as const;

function getInitials(name: string): string {
  return name.split(' ').map(w => w.charAt(0)).slice(0, 2).join('').toUpperCase();
}

function profileToUserData(p: Profile): UserData {
  const status: UserStatus = p.is_active ? 'active' : 'blocked';
  return {
    id: p.id,
    name: p.name || 'Sin nombre',
    email: p.email || '',
    phone: p.phone || '',
    role: (p.role as UserRole) || 'client',
    status,
    joined: p.created_at || '',
    isVerified: p.is_verified || false,
    avatar: getInitials(p.name || 'U'),
  };
}

export default function UsersPage() {
  const [users, setUsers] = useState<UserData[]>([]);
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState<string>('Todos');
  const [visibleCount, setVisibleCount] = useState(6);
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) {
        console.error('Error fetching users:', error);
        toast.error('Error al cargar usuarios');
        setLoading(false);
        return;
      }

      setUsers((data || []).map(profileToUserData));
    } catch (err) {
      console.error('Error fetching users:', err);
      toast.error('Error al cargar usuarios');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const filteredUsers = users.filter((u) => {
    const matchSearch = u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase()) ||
      u.phone.includes(search);

    let matchFilter = true;
    switch (activeFilter) {
      case 'Clientes': matchFilter = u.role === 'client'; break;
      case 'Conductores': matchFilter = u.role === 'driver'; break;
      case 'Vendedores': matchFilter = u.role === 'vendor'; break;
      case 'Repartidores': matchFilter = u.role === 'courier'; break;
      case 'Bloqueados': matchFilter = u.status === 'blocked'; break;
    }
    return matchSearch && matchFilter;
  });

  const displayedUsers = filteredUsers.slice(0, visibleCount);

  const toggleBlock = async (userId: string) => {
    const user = users.find(u => u.id === userId);
    if (!user) return;

    const newActive = user.status === 'blocked';
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ is_active: newActive })
        .eq('id', userId);

      if (error) {
        toast.error('Error al actualizar usuario');
        return;
      }

      const newStatus = newActive ? 'active' : 'blocked';
      toast.success(newStatus === 'blocked' ? `Usuario ${user.name} bloqueado` : `Usuario ${user.name} desbloqueado`);
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, status: newStatus } : u));
    } catch (err) {
      console.error('Block/unblock error:', err);
      toast.error('Error al actualizar usuario');
    }
    setOpenMenu(null);
  };

  const verifyUser = async (userId: string) => {
    const user = users.find(u => u.id === userId);
    if (!user) return;

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ is_verified: true })
        .eq('id', userId);

      if (error) {
        toast.error('Error al verificar usuario');
        return;
      }

      toast.success(`Usuario ${user.name} verificado`);
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, isVerified: true } : u));
    } catch (err) {
      console.error('Verify error:', err);
      toast.error('Error al verificar usuario');
    }
    setOpenMenu(null);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white">Usuarios</h1>
          <p className="text-gray-400 mt-1">{loading ? 'Cargando...' : `${users.length} usuarios registrados`}</p>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <span className="text-gray-400">Activos:</span>
          <span className="text-emerald-400 font-semibold">{users.filter(u => u.status === 'active').length}</span>
          <span className="text-gray-600 mx-1">|</span>
          <span className="text-gray-400">Bloqueados:</span>
          <span className="text-red-400 font-semibold">{users.filter(u => u.status === 'blocked').length}</span>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="glass rounded-2xl p-4">
        <div className="flex flex-col md:flex-row gap-4">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              type="text"
              placeholder="Buscar por nombre, email o telefono..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white/5 border border-white/10 focus:border-cyan-500 text-white placeholder:text-gray-600 outline-none text-sm transition-all"
            />
          </div>
        </div>

        {/* Filter tabs */}
        <div className="flex gap-2 mt-3 overflow-x-auto pb-1">
          {filterTabs.map((tab) => (
            <button
              key={tab}
              onClick={() => { setActiveFilter(tab); setVisibleCount(6); }}
              className={`px-4 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
                activeFilter === tab
                  ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                  : 'bg-white/5 text-gray-400 hover:text-white hover:bg-white/10 border border-transparent'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* Users List */}
      <div className="space-y-2">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
          </div>
        ) : (
          <>
            <AnimatePresence mode="popLayout">
              {displayedUsers.map((user, i) => (
                <motion.div
                  key={user.id}
                  layout
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ delay: i * 0.03 }}
                  className="glass rounded-xl p-4 hover:bg-white/[0.07] transition-all group"
                >
                  <div className="flex items-center gap-4">
                    {/* Avatar */}
                    <div className={`w-11 h-11 rounded-xl flex items-center justify-center text-sm font-bold flex-shrink-0 ${
                      user.status === 'blocked' ? 'bg-red-500/20 text-red-400' : 'bg-gradient-to-br from-blue-600 to-cyan-500 text-white'
                    }`}>
                      {user.avatar}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-semibold text-white truncate">{user.name}</h3>
                        {user.isVerified && <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400 flex-shrink-0" />}
                        {user.status === 'blocked' && <XCircle className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />}
                      </div>
                      <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-500">
                        <span className="flex items-center gap-1"><Mail className="w-3 h-3" /> {user.email}</span>
                        <span className="hidden sm:flex items-center gap-1"><Phone className="w-3 h-3" /> {user.phone || 'N/A'}</span>
                      </div>
                    </div>

                    {/* Role badge */}
                    <span className={`px-2.5 py-1 rounded-lg text-xs font-medium border ${roleColors[user.role] || roleColors.client} hidden sm:inline-flex`}>
                      {roleLabels[user.role] || user.role}
                    </span>

                    {/* Joined */}
                    <span className="text-xs text-gray-500 hidden lg:block w-24 text-right">
                      {user.joined ? new Date(user.joined).toLocaleDateString('es-CR', { day: '2-digit', month: 'short', year: 'numeric' }) : 'N/A'}
                    </span>

                    {/* Actions */}
                    <div className="relative flex-shrink-0">
                      <button
                        onClick={() => setOpenMenu(openMenu === user.id ? null : user.id)}
                        className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 transition-all"
                      >
                        <MoreHorizontal className="w-4 h-4" />
                      </button>

                      <AnimatePresence>
                        {openMenu === user.id && (
                          <motion.div
                            initial={{ opacity: 0, y: -5, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: -5, scale: 0.95 }}
                            className="absolute right-0 top-10 w-48 glass-strong rounded-xl py-1.5 z-20 shadow-xl"
                          >
                            <button
                              onClick={() => { toast.info(`Viendo perfil de ${user.name}`); setOpenMenu(null); }}
                              className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-gray-300 hover:text-white hover:bg-white/5 transition-colors"
                            >
                              <Eye className="w-4 h-4 text-cyan-400" /> Ver perfil
                            </button>
                            {!user.isVerified && (
                              <button
                                onClick={() => verifyUser(user.id)}
                                className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-gray-300 hover:text-white hover:bg-white/5 transition-colors"
                              >
                                <UserCheck className="w-4 h-4 text-emerald-400" /> Verificar
                              </button>
                            )}
                            <button
                              onClick={() => toggleBlock(user.id)}
                              className={`w-full flex items-center gap-2.5 px-4 py-2 text-sm hover:bg-white/5 transition-colors ${
                                user.status === 'blocked' ? 'text-emerald-400 hover:text-emerald-300' : 'text-red-400 hover:text-red-300'
                              }`}
                            >
                              {user.status === 'blocked' ? (
                                <><Shield className="w-4 h-4" /> Desbloquear</>
                              ) : (
                                <><Ban className="w-4 h-4" /> Bloquear</>
                              )}
                            </button>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>

            {/* Load More */}
            {visibleCount < filteredUsers.length && (
              <motion.button
                onClick={() => setVisibleCount((v) => v + 4)}
                className="w-full py-3 glass rounded-xl text-sm text-cyan-400 hover:text-cyan-300 hover:bg-white/[0.07] transition-all flex items-center justify-center gap-2"
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
              >
                <ChevronDown className="w-4 h-4" />
                Cargar mas ({filteredUsers.length - visibleCount} restantes)
              </motion.button>
            )}

            {filteredUsers.length === 0 && (
              <div className="text-center py-12 text-gray-500">
                <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>No se encontraron usuarios</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
