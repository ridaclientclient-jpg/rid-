'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, Shield, ShieldOff, Eye, Users, Mail, Phone,
  ChevronDown, MoreHorizontal, Ban, CheckCircle2, XCircle,
  UserCheck, Filter
} from 'lucide-react';
import { toast } from 'sonner';

type UserRole = 'client' | 'driver' | 'admin' | 'vendor';
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

const initialUsers: UserData[] = [
  { id: '1', name: 'María García López', email: 'maria.garcia@mail.com', phone: '+506 8888 1234', role: 'client', status: 'active', joined: '2025-12-15', isVerified: true, avatar: 'MG' },
  { id: '2', name: 'Carlos Mendez Rojas', email: 'carlos.mendez@mail.com', phone: '+506 8888 2345', role: 'driver', status: 'active', joined: '2025-11-20', isVerified: true, avatar: 'CM' },
  { id: '3', name: 'Ana Rodríguez Vega', email: 'ana.rodriguez@mail.com', phone: '+506 8888 3456', role: 'driver', status: 'active', joined: '2025-10-05', isVerified: true, avatar: 'AR' },
  { id: '4', name: 'Pedro Jiménez Castro', email: 'pedro.jimenez@mail.com', phone: '+506 8888 4567', role: 'client', status: 'blocked', joined: '2025-09-18', isVerified: false, avatar: 'PJ' },
  { id: '5', name: 'Laura Sánchez Morales', email: 'laura.sanchez@mail.com', phone: '+506 8888 5678', role: 'client', status: 'active', joined: '2026-01-10', isVerified: true, avatar: 'LS' },
  { id: '6', name: 'Farmacia Central CR', email: 'farmacia@centralcr.com', phone: '+506 2222 0001', role: 'vendor', status: 'active', joined: '2025-08-22', isVerified: true, avatar: 'FC' },
  { id: '7', name: 'Roberto Vega Torres', email: 'roberto.vega@mail.com', phone: '+506 8888 6789', role: 'driver', status: 'pending', joined: '2026-04-10', isVerified: false, avatar: 'RV' },
  { id: '8', name: 'Sofia Hernández Pérez', email: 'sofia.hernandez@mail.com', phone: '+506 8888 7890', role: 'client', status: 'active', joined: '2026-03-28', isVerified: true, avatar: 'SH' },
  { id: '9', name: 'Miguel Torres Acosta', email: 'miguel.torres@mail.com', phone: '+506 8888 8901', role: 'client', status: 'active', joined: '2026-02-14', isVerified: true, avatar: 'MT' },
  { id: '10', name: 'MiniMarket Don Luis', email: 'donluis@minimarket.cr', phone: '+506 2222 0002', role: 'vendor', status: 'active', joined: '2025-07-30', isVerified: true, avatar: 'DL' },
];

const roleLabels: Record<UserRole, string> = {
  client: 'Cliente',
  driver: 'Conductor',
  admin: 'Admin',
  vendor: 'Vendedor',
};

const roleColors: Record<UserRole, string> = {
  client: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  driver: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  admin: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  vendor: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
};

const filterTabs = ['Todos', 'Clientes', 'Conductores', 'Vendedores', 'Bloqueados'] as const;

export default function UsersPage() {
  const [users, setUsers] = useState<UserData[]>(initialUsers);
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState<string>('Todos');
  const [visibleCount, setVisibleCount] = useState(6);
  const [openMenu, setOpenMenu] = useState<string | null>(null);

  const filteredUsers = users.filter((u) => {
    const matchSearch = u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase()) ||
      u.phone.includes(search);

    let matchFilter = true;
    switch (activeFilter) {
      case 'Clientes': matchFilter = u.role === 'client'; break;
      case 'Conductores': matchFilter = u.role === 'driver'; break;
      case 'Vendedores': matchFilter = u.role === 'vendor'; break;
      case 'Bloqueados': matchFilter = u.status === 'blocked'; break;
    }
    return matchSearch && matchFilter;
  });

  const displayedUsers = filteredUsers.slice(0, visibleCount);

  const toggleBlock = (userId: string) => {
    setUsers((prev) =>
      prev.map((u) => {
        if (u.id === userId) {
          const newStatus = u.status === 'blocked' ? 'active' : 'blocked';
          toast.success(newStatus === 'blocked' ? `Usuario ${u.name} bloqueado` : `Usuario ${u.name} desbloqueado`);
          return { ...u, status: newStatus };
        }
        return u;
      })
    );
    setOpenMenu(null);
  };

  const verifyUser = (userId: string) => {
    setUsers((prev) =>
      prev.map((u) => {
        if (u.id === userId) {
          toast.success(`Usuario ${u.name} verificado`);
          return { ...u, isVerified: true };
        }
        return u;
      })
    );
    setOpenMenu(null);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white">Usuarios</h1>
          <p className="text-gray-400 mt-1">{users.length} usuarios registrados</p>
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
              placeholder="Buscar por nombre, email o teléfono..."
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
                    <span className="hidden sm:flex items-center gap-1"><Phone className="w-3 h-3" /> {user.phone}</span>
                  </div>
                </div>

                {/* Role badge */}
                <span className={`px-2.5 py-1 rounded-lg text-xs font-medium border ${roleColors[user.role]} hidden sm:inline-flex`}>
                  {roleLabels[user.role]}
                </span>

                {/* Joined */}
                <span className="text-xs text-gray-500 hidden lg:block w-24 text-right">
                  {new Date(user.joined).toLocaleDateString('es-CR', { day: '2-digit', month: 'short', year: 'numeric' })}
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
            Cargar más ({filteredUsers.length - visibleCount} restantes)
          </motion.button>
        )}

        {filteredUsers.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>No se encontraron usuarios</p>
          </div>
        )}
      </div>
    </div>
  );
}
