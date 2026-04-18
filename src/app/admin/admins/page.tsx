'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Shield, ShieldCheck, Plus, Trash2, UserCheck, UserX,
  Mail, AlertTriangle, Loader2, X, Crown, Users
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuthStore } from '@/store/authStore';

interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: string;
  is_active: boolean;
  created_at: string;
}

export default function AdminManagementPage() {
  const { user: currentUser, session } = useAuthStore();
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showRemoveModal, setShowRemoveModal] = useState(false);
  const [selectedAdmin, setSelectedAdmin] = useState<AdminUser | null>(null);
  const [createForm, setCreateForm] = useState({ name: '', email: '', password: '' });
  const [creating, setCreating] = useState(false);
  const [removing, setRemoving] = useState(false);

  const fetchAdmins = useCallback(async () => {
    try {
      const res = await fetch('/api/admins', {
        headers: { Authorization: `Bearer ${session?.access_token}` }
      });
      const data = await res.json();
      if (res.ok) {
        setAdmins(data.admins || []);
      } else {
        toast.error(data.error || 'Error al cargar administradores');
      }
    } catch {
      toast.error('Error de conexion');
    } finally {
      setLoading(false);
    }
  }, [session]);

  useEffect(() => {
    fetchAdmins();
  }, [fetchAdmins]);

  const handleCreate = async () => {
    if (!createForm.name || !createForm.email || !createForm.password) {
      toast.error('Todos los campos son requeridos');
      return;
    }
    if (createForm.password.length < 6) {
      toast.error('La contrasena debe tener al menos 6 caracteres');
      return;
    }

    setCreating(true);
    try {
      const res = await fetch('/api/admins', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token}`
        },
        body: JSON.stringify(createForm),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(data.message || 'Administrador creado exitosamente');
        setShowCreateModal(false);
        setCreateForm({ name: '', email: '', password: '' });
        fetchAdmins();
      } else {
        toast.error(data.error || 'Error al crear administrador');
      }
    } catch {
      toast.error('Error de conexion');
    } finally {
      setCreating(false);
    }
  };

  const handleRemove = async () => {
    if (!selectedAdmin) return;
    setRemoving(true);
    try {
      const res = await fetch('/api/admins', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token}`
        },
        body: JSON.stringify({ userId: selectedAdmin.id }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(data.message || 'Acceso removido exitosamente');
        setShowRemoveModal(false);
        setSelectedAdmin(null);
        fetchAdmins();
      } else {
        toast.error(data.error || 'Error al remover administrador');
      }
    } catch {
      toast.error('Error de conexion');
    } finally {
      setRemoving(false);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('es-CR', {
      day: '2-digit', month: '2-digit', year: 'numeric'
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <ShieldCheck className="w-8 h-8 text-purple-400" />
            Administradores
          </h1>
          <p className="text-gray-400 mt-1">
            Gestiona quienes tienen acceso al panel de administracion
          </p>
        </div>
        <motion.button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-purple-500/20 text-purple-400 text-sm font-medium hover:bg-purple-500/30 transition-colors"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          <Plus className="w-4 h-4" />
          Crear Administrador
        </motion.button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <motion.div
          className="glass rounded-2xl p-5"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-blue-600 to-cyan-500 flex items-center justify-center">
              <Users className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{admins.length}</p>
              <p className="text-sm text-gray-400">Total Admins</p>
            </div>
          </div>
        </motion.div>
        <motion.div
          className="glass rounded-2xl p-5"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-purple-600 to-pink-500 flex items-center justify-center">
              <Crown className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">
                {admins.filter(a => a.role === 'super_admin').length}
              </p>
              <p className="text-sm text-gray-400">Super Admins</p>
            </div>
          </div>
        </motion.div>
        <motion.div
          className="glass rounded-2xl p-5"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-emerald-600 to-green-500 flex items-center justify-center">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">
                {admins.filter(a => a.role === 'admin').length}
              </p>
              <p className="text-sm text-gray-400">Admins</p>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Admin List */}
      <div className="glass rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-white/5">
          <h2 className="text-lg font-semibold text-white">Lista de Administradores</h2>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-cyan-400" />
          </div>
        ) : admins.length === 0 ? (
          <div className="text-center py-12">
            <Users className="w-10 h-10 text-gray-600 mx-auto mb-3" />
            <p className="text-gray-500">No hay administradores</p>
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {admins.map((admin, i) => (
              <motion.div
                key={admin.id}
                className="flex items-center justify-between px-5 py-4 hover:bg-white/5 transition-colors"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
              >
                <div className="flex items-center gap-4 min-w-0">
                  {/* Avatar */}
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                    admin.role === 'super_admin'
                      ? 'bg-gradient-to-br from-purple-600 to-pink-500'
                      : 'bg-gradient-to-br from-blue-600 to-cyan-500'
                  }`}>
                    {admin.role === 'super_admin' ? (
                      <Crown className="w-5 h-5 text-white" />
                    ) : (
                      <Shield className="w-5 h-5 text-white" />
                    )}
                  </div>

                  {/* Info */}
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-white truncate">
                        {admin.name}
                      </p>
                      {admin.id === currentUser?.id && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/10 text-gray-400">Tú</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <Mail className="w-3 h-3 text-gray-500 flex-shrink-0" />
                      <p className="text-xs text-gray-400 truncate">{admin.email}</p>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 flex-shrink-0 ml-4">
                  {/* Role Badge */}
                  {admin.role === 'super_admin' ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-purple-500/20 text-purple-400 border border-purple-500/30">
                      <Crown className="w-3 h-3" />
                      Super Admin
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
                      <Shield className="w-3 h-3" />
                      Admin
                    </span>
                  )}

                  {/* Date */}
                  <span className="text-xs text-gray-500 hidden sm:block">
                    {formatDate(admin.created_at)}
                  </span>

                  {/* Remove Button (only for regular admins, not yourself) */}
                  {admin.role !== 'super_admin' && admin.id !== currentUser?.id && (
                    <motion.button
                      onClick={() => {
                        setSelectedAdmin(admin);
                        setShowRemoveModal(true);
                      }}
                      className="p-2 rounded-lg text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      title="Remover acceso"
                    >
                      <Trash2 className="w-4 h-4" />
                    </motion.button>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Info box */}
      <div className="glass rounded-2xl p-5">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-gray-400 space-y-1">
            <p className="text-white font-medium">Informacion importante</p>
            <p>Como Super Admin, solo TÚ puedes crear y eliminar cuentas de administrador. Los administradores regulares no ven esta seccion.</p>
            <p>Al remover un administrador, su cuenta se convierte a usuario cliente. Sus datos no se eliminan.</p>
          </div>
        </div>
      </div>

      {/* ═══════ CREATE MODAL ═══════ */}
      <AnimatePresence>
        {showCreateModal && (
          <motion.div
            className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowCreateModal(false)}
          >
            <motion.div
              className="glass-strong rounded-2xl p-6 w-full max-w-md"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                  <UserCheck className="w-5 h-5 text-cyan-400" />
                  Nuevo Administrador
                </h3>
                <button onClick={() => setShowCreateModal(false)} className="text-gray-400 hover:text-white">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-xs font-medium text-gray-400 uppercase">Nombre completo</label>
                  <input
                    type="text"
                    value={createForm.name}
                    onChange={e => setCreateForm({ ...createForm, name: e.target.value })}
                    className="mt-1.5 w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 focus:border-cyan-500 text-white placeholder:text-gray-600 outline-none transition-all"
                    placeholder="Juan Perez"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-400 uppercase">Correo electronico</label>
                  <input
                    type="email"
                    value={createForm.email}
                    onChange={e => setCreateForm({ ...createForm, email: e.target.value })}
                    className="mt-1.5 w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 focus:border-cyan-500 text-white placeholder:text-gray-600 outline-none transition-all"
                    placeholder="juan@empresa.com"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-400 uppercase">Contrasena</label>
                  <input
                    type="password"
                    value={createForm.password}
                    onChange={e => setCreateForm({ ...createForm, password: e.target.value })}
                    className="mt-1.5 w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 focus:border-cyan-500 text-white placeholder:text-gray-600 outline-none transition-all"
                    placeholder="Minimo 6 caracteres"
                  />
                </div>

                <div className="bg-cyan-500/5 border border-cyan-500/20 rounded-xl p-3">
                  <p className="text-xs text-cyan-400/80">
                    Se creara con rol de Administrador. Podra ver todo el panel pero NO podra crear ni eliminar otros administradores.
                  </p>
                </div>

                <button
                  onClick={handleCreate}
                  disabled={creating}
                  className="w-full py-3 rounded-xl btn-neon text-white font-semibold text-sm disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {creating ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Creando...
                    </>
                  ) : (
                    <>
                      <UserCheck className="w-4 h-4" />
                      Crear Administrador
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══════ REMOVE CONFIRMATION MODAL ═══════ */}
      <AnimatePresence>
        {showRemoveModal && selectedAdmin && (
          <motion.div
            className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowRemoveModal(false)}
          >
            <motion.div
              className="glass-strong rounded-2xl p-6 w-full max-w-md"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={e => e.stopPropagation()}
            >
              <div className="text-center">
                <div className="w-14 h-14 rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-4">
                  <AlertTriangle className="w-7 h-7 text-red-400" />
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">
                  Remover Acceso
                </h3>
                <p className="text-sm text-gray-400 mb-6">
                  Estás seguro de remover el acceso de administrador a{' '}
                  <span className="text-white font-medium">{selectedAdmin.name}</span>?
                  <br />
                  <span className="text-xs text-gray-500">{selectedAdmin.email}</span>
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowRemoveModal(false)}
                    className="flex-1 py-2.5 rounded-xl bg-white/5 text-gray-300 text-sm font-medium hover:bg-white/10 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleRemove}
                    disabled={removing}
                    className="flex-1 py-2.5 rounded-xl bg-red-500/20 text-red-400 text-sm font-medium hover:bg-red-500/30 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {removing ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Removiendo...
                      </>
                    ) : (
                      <>
                        <UserX className="w-4 h-4" />
                        Remover
                      </>
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
