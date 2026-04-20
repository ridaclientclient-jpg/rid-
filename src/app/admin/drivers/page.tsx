'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, Car, Star, CheckCircle2, XCircle, Clock,
  Eye, MoreHorizontal, AlertTriangle, Loader2,
  User, CreditCard, FileCheck, X, ZoomIn, ShieldCheck, ShieldX,
  Send, ChevronRight,
} from 'lucide-react';
import { supabase, type Driver, type Profile, type Vehicle, type Document } from '@/lib/supabase';
import { useAuthStore } from '@/store/authStore';
import { toast } from 'sonner';

/* ─── Types ────────────────────────────────────────────────── */
type DriverStatus = 'pending' | 'verified' | 'rejected' | 'online' | 'offline' | 'suspended' | 'busy';
type DocStatus = 'pending' | 'approved' | 'rejected';

interface DriverData {
  id: string;
  userId: string;
  name: string;
  phone: string;
  vehicle: string;
  plate: string;
  rating: number;
  totalRides: number;
  status: DriverStatus;
  joined: string;
  avatar: string;
  earnings: string;
  documents: Record<string, DocStatus>; // keyed by doc type
  docCount: number;
  totalDocs: number;
}

/* ─── Document type definitions ───────────────────────────── */
const DOCUMENT_TYPES = [
  { type: 'selfie', label: 'Selfie', icon: User },
  { type: 'id_front', label: 'Cedula Frente', icon: CreditCard },
  { type: 'id_back', label: 'Cedula Reverso', icon: CreditCard },
  { type: 'license_front', label: 'Licencia Frente', icon: CreditCard },
  { type: 'license_back', label: 'Licencia Reverso', icon: CreditCard },
  { type: 'vehicle_front', label: 'Vehiculo Frente', icon: Car },
  { type: 'vehicle_side', label: 'Vehiculo Lateral', icon: Car },
  { type: 'vehicle_back', label: 'Vehiculo Atras', icon: Car },
  { type: 'vehicle_interior', label: 'Interior Vehiculo', icon: Car },
  { type: 'circulacion', label: 'Circulacion Vehicular', icon: FileCheck },
  { type: 'marchamo', label: 'Marchamo', icon: FileCheck },
];

/* ─── Configs ──────────────────────────────────────────────── */
const statusConfig: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  pending: { label: 'Pendiente', color: 'bg-amber-500/20 text-amber-400 border-amber-500/30', icon: Clock },
  verified: { label: 'Verificado', color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30', icon: CheckCircle2 },
  rejected: { label: 'Rechazado', color: 'bg-red-500/20 text-red-400 border-red-500/30', icon: XCircle },
  online: { label: 'En linea', color: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30', icon: CheckCircle2 },
  offline: { label: 'Desconectado', color: 'bg-gray-500/20 text-gray-400 border-gray-500/30', icon: Clock },
  suspended: { label: 'Suspendido', color: 'bg-red-500/20 text-red-400 border-red-500/30', icon: XCircle },
  busy: { label: 'Ocupado', color: 'bg-amber-500/20 text-amber-400 border-amber-500/30', icon: Clock },
};

const docStatusConfig: Record<DocStatus, { label: string; color: string; icon: React.ElementType }> = {
  pending: { label: 'Pendiente', color: 'text-amber-400', icon: Clock },
  approved: { label: 'Aprobado', color: 'text-emerald-400', icon: CheckCircle2 },
  rejected: { label: 'Rechazado', color: 'text-red-400', icon: XCircle },
};

const docStatusBg: Record<DocStatus, string> = {
  pending: 'bg-amber-500/10 border-amber-500/20',
  approved: 'bg-emerald-500/10 border-emerald-500/20',
  rejected: 'bg-red-500/10 border-red-500/20',
};

const filterTabs = ['Todos', 'Pendientes', 'Verificados', 'Rechazados', 'En linea', 'Desconectados'] as const;

/* ─── Helpers ──────────────────────────────────────────────── */
function getInitials(name: string): string {
  return name
    .split(' ')
    .map((w) => w.charAt(0))
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

function formatEarnings(amount: number): string {
  if (amount >= 1000000) return `₡${(amount / 1000000).toFixed(2)}M`;
  if (amount >= 1000) return `₡${(amount / 1000).toFixed(0)}k`;
  return `₡${amount.toLocaleString()}`;
}

/* ═══════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════════════ */
export default function DriversPage() {
  const adminUser = useAuthStore((s) => s.user);

  const [drivers, setDrivers] = useState<DriverData[]>([]);
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState<string>('Todos');
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  /* ─── Detail Modal State ──────────────────────────────── */
  const [selectedDriver, setSelectedDriver] = useState<DriverData | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [driverDocs, setDriverDocs] = useState<Document[]>([]);
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});

  /* ─── Document Review Modal State ─────────────────────── */
  const [reviewDriver, setReviewDriver] = useState<DriverData | null>(null);
  const [reviewDocs, setReviewDocs] = useState<Document[]>([]);
  const [reviewUrls, setReviewUrls] = useState<Record<string, string>>({});
  const [reviewLoading, setReviewLoading] = useState(false);
  const [reviewActions, setReviewActions] = useState<Record<string, 'approve' | 'reject'>>({});
  const [reviewReasons, setReviewReasons] = useState<Record<string, string>>({});
  const [reviewComment, setReviewComment] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);

  /* ─── Full-size Image Viewer ──────────────────────────── */
  const [viewerUrl, setViewerUrl] = useState<string | null>(null);
  const [viewerLabel, setViewerLabel] = useState('');

  /* ═════════════════════════════════════════════════════════
     FETCH DRIVERS (with documents)
     ═════════════════════════════════════════════════════════ */
  const fetchDrivers = useCallback(async () => {
    setLoading(true);
    try {
      const { data: driverRecords, error } = await supabase
        .from('drivers')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) {
        console.error('Error fetching drivers:', error.message);
        toast.error('Error al cargar conductores');
        setLoading(false);
        return;
      }

      if (!driverRecords || driverRecords.length === 0) {
        setDrivers([]);
        setLoading(false);
        return;
      }

      const userIds = driverRecords.map((d) => d.user_id).filter(Boolean);
      const driverIds = driverRecords.map((d) => d.id).filter(Boolean);

      /* Batch fetch profiles */
      const profileMap: Record<string, Profile> = {};
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('*')
          .in('id', userIds);
        if (profiles) profiles.forEach((p) => { profileMap[p.id] = p; });
      }

      /* Batch fetch vehicles */
      const vehicleMap: Record<string, Vehicle> = {};
      if (driverIds.length > 0) {
        const { data: vehicles } = await supabase
          .from('vehicles')
          .select('*')
          .in('driver_id', driverIds);
        if (vehicles) vehicles.forEach((v) => { vehicleMap[v.driver_id] = v; });
      }

      /* Batch fetch ALL documents for these users */
      const docsMap: Record<string, Document[]> = {};
      if (userIds.length > 0) {
        const { data: allDocs } = await supabase
          .from('documents')
          .select('*')
          .in('user_id', userIds);
        if (allDocs) {
          allDocs.forEach((doc) => {
            if (!docsMap[doc.user_id]) docsMap[doc.user_id] = [];
            docsMap[doc.user_id].push(doc);
          });
        }
      }

      /* Map to DriverData */
      const mapped: DriverData[] = driverRecords.map((d) => {
        const profile = profileMap[d.user_id || ''];
        const vehicle = vehicleMap[d.id || ''];
        const userDocs = docsMap[d.user_id || ''] || [];
        const status = d.status || 'offline';
        const isVerified = d.is_verified || false;

        /* Build per-document-type status map */
        const docStatusMap: Record<string, DocStatus> = {};
        let docCount = 0;
        userDocs.forEach((doc) => {
          docStatusMap[doc.type] = doc.status as DocStatus;
          docCount++;
        });

        /* If driver is verified and no docs found, show all as approved (legacy) */
        if (isVerified && docCount === 0) {
          DOCUMENT_TYPES.forEach((dt) => { docStatusMap[dt.type] = 'approved'; });
        }

        return {
          id: d.id,
          userId: d.user_id,
          name: profile?.name || 'Desconocido',
          phone: profile?.phone || 'N/A',
          vehicle: vehicle ? `${vehicle.model} ${vehicle.year || ''}`.trim() : 'Sin vehiculo',
          plate: vehicle?.plate || '-',
          rating: d.rating || 0,
          totalRides: d.total_rides || 0,
          status: status as DriverStatus,
          joined: d.created_at || '',
          avatar: getInitials(profile?.name || 'D'),
          earnings: formatEarnings(d.total_earnings || 0),
          documents: docStatusMap,
          docCount,
          totalDocs: DOCUMENT_TYPES.length,
        };
      });

      setDrivers(mapped);
    } catch (err) {
      console.error('Error fetching drivers:', err);
      toast.error('Error al cargar conductores');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDrivers();
  }, [fetchDrivers]);

  /* ═════════════════════════════════════════════════════════
     FILTER
     ═════════════════════════════════════════════════════════ */
  const filteredDrivers = drivers.filter((d) => {
    const matchSearch =
      d.name.toLowerCase().includes(search.toLowerCase()) ||
      d.plate.toLowerCase().includes(search.toLowerCase());
    let matchFilter = true;
    switch (activeFilter) {
      case 'Pendientes': matchFilter = d.status === 'pending'; break;
      case 'Verificados': matchFilter = d.status === 'verified' || d.status === 'online'; break;
      case 'Rechazados': matchFilter = d.status === 'rejected'; break;
      case 'En linea': matchFilter = d.status === 'online'; break;
      case 'Desconectados': matchFilter = d.status === 'offline'; break;
    }
    return matchSearch && matchFilter;
  });

  /* ═════════════════════════════════════════════════════════
     SIGNED URLs HELPER
     ═════════════════════════════════════════════════════════ */
  const loadSignedUrls = async (docs: Document[]): Promise<Record<string, string>> => {
    const urls: Record<string, string> = {};
    for (const doc of docs) {
      try {
        const { data } = await supabase.storage
          .from('documents')
          .createSignedUrl(doc.url, 3600);
        if (data?.signedUrl) urls[doc.type] = data.signedUrl;
      } catch (err) {
        console.warn('Error getting signed URL for', doc.type);
      }
    }
    return urls;
  };

  /* ═════════════════════════════════════════════════════════
     OPEN DETAIL MODAL
     ═════════════════════════════════════════════════════════ */
  const openDetail = async (driver: DriverData) => {
    setSelectedDriver(driver);
    setOpenMenu(null);
    setDetailLoading(true);
    setSignedUrls({});

    try {
      const { data: docs } = await supabase
        .from('documents')
        .select('*')
        .eq('user_id', driver.userId)
        .order('created_at', { ascending: true });

      const docsList = docs || [];
      setDriverDocs(docsList);

      if (docsList.length > 0) {
        const urls = await loadSignedUrls(docsList);
        setSignedUrls(urls);
      }
    } catch (err) {
      console.error('Error loading driver documents:', err);
    } finally {
      setDetailLoading(false);
    }
  };

  /* ═════════════════════════════════════════════════════════
     OPEN DOCUMENT REVIEW MODAL
     ═════════════════════════════════════════════════════════ */
  const openReview = async (driver: DriverData) => {
    setReviewDriver(driver);
    setOpenMenu(null);
    setReviewLoading(true);
    setReviewActions({});
    setReviewReasons({});
    setReviewComment('');
    setReviewUrls({});

    try {
      const { data: docs } = await supabase
        .from('documents')
        .select('*')
        .eq('user_id', driver.userId)
        .order('created_at', { ascending: true });

      const docsList = docs || [];
      setReviewDocs(docsList);

      if (docsList.length > 0) {
        const urls = await loadSignedUrls(docsList);
        setReviewUrls(urls);
      }
    } catch (err) {
      console.error('Error loading review documents:', err);
    } finally {
      setReviewLoading(false);
    }
  };

  /* ═════════════════════════════════════════════════════════
     SET REVIEW ACTION (approve/reject per document)
     ═════════════════════════════════════════════════════════ */
  const setAction = (docType: string, action: 'approve' | 'reject') => {
    setReviewActions((prev) => ({ ...prev, [docType]: action }));
    if (action === 'approve') {
      setReviewReasons((prev) => {
        const next = { ...prev };
        delete next[docType];
        return next;
      });
    }
  };

  /* ═════════════════════════════════════════════════════════
     SUBMIT REVIEW
     ═════════════════════════════════════════════════════════ */
  const submitReview = async () => {
    if (!reviewDriver || !adminUser) return;

    const actionsCount = Object.keys(reviewActions).length;
    if (actionsCount === 0) {
      toast.error('Debes aprobar o rechazar al menos un documento');
      return;
    }

    setSubmittingReview(true);
    try {
      /* 1. Update each document status */
      let allApproved = true;
      const rejectedDocs: string[] = [];

      for (const [docType, action] of Object.entries(reviewActions)) {
        const doc = reviewDocs.find((d) => d.type === docType);
        if (!doc) continue;

        const newStatus = action === 'approve' ? 'approved' : 'rejected';
        const reason = action === 'reject' ? reviewReasons[docType] || 'No especificado' : null;

        const { error } = await supabase
          .from('documents')
          .update({
            status: newStatus,
            reviewed_by: adminUser.id,
            reviewed_at: new Date().toISOString(),
            rejection_reason: reason,
          })
          .eq('id', doc.id);

        if (error) {
          console.error('Error updating doc', docType, ':', error.message);
        }

        if (action === 'rejected') {
          allApproved = false;
          const label = DOCUMENT_TYPES.find((dt) => dt.type === docType)?.label || docType;
          rejectedDocs.push(label + (reason ? ` (${reason})` : ''));
        }
      }

      /* 2. Check if ALL documents are now approved */
      const { data: allDocsNow } = await supabase
        .from('documents')
        .select('status')
        .eq('user_id', reviewDriver.userId);

      const anyPending = allDocsNow?.some((d) => d.status === 'pending') || false;
      const anyRejected = allDocsNow?.some((d) => d.status === 'rejected') || false;

      if (!anyPending && !anyRejected) {
        /* ALL approved → verify driver */
        await supabase
          .from('drivers')
          .update({ is_verified: true, status: 'verified' })
          .eq('id', reviewDriver.id);

        /* Notification to driver */
        await supabase.from('app_notifications').insert({
          user_id: reviewDriver.userId,
          title: 'Cuenta verificada',
          message: 'Felicidades! Todos tus documentos han sido aprobados. Ya puedes comenzar a recibir viajes.',
          type: 'verification',
          is_read: false,
        });

        toast.success(`Conductor ${reviewDriver.name} verificado correctamente`);
      } else {
        /* Some rejected or still pending */
        if (anyRejected) {
          await supabase
            .from('drivers')
            .update({ status: 'pending' })
            .eq('id', reviewDriver.id);

          /* Notification to driver with details */
          const missingText = rejectedDocs.join(', ');
          await supabase.from('app_notifications').insert({
            user_id: reviewDriver.userId,
            title: 'Documentos pendientes de revision',
            message: `Algunos documentos necesitan correcciones: ${missingText}. Por favor actualiza los documentos rechazados para continuar.`,
            type: 'verification',
            is_read: false,
          });

          toast.warning(`Se notifico a ${reviewDriver.name} sobre documentos por corregir`);
        } else {
          toast.info('Revision guardada. Quedan documentos pendientes por revisar.');
        }
      }

      /* Add general comment as notification if provided */
      if (reviewComment.trim()) {
        await supabase.from('app_notifications').insert({
          user_id: reviewDriver.userId,
          title: 'Comentario del administrador',
          message: reviewComment.trim(),
          type: 'system',
          is_read: false,
        });
      }

      /* Close modal and refresh */
      setReviewDriver(null);
      fetchDrivers();
    } catch (err: any) {
      console.error('Submit review error:', err);
      toast.error('Error al enviar revision');
    } finally {
      setSubmittingReview(false);
    }
  };

  /* ═════════════════════════════════════════════════════════
     QUICK ACTIONS (dropdown)
     ═════════════════════════════════════════════════════════ */
  const quickApprove = async (driverId: string, driverName: string) => {
    try {
      const { error } = await supabase
        .from('drivers')
        .update({ is_verified: true, status: 'verified' })
        .eq('id', driverId);
      if (error) {
        toast.error('Error al aprobar conductor');
        return;
      }
      toast.success(`Conductor ${driverName} aprobado`);
      fetchDrivers();
    } catch (err) {
      toast.error('Error al aprobar conductor');
    }
    setOpenMenu(null);
  };

  const quickReject = async (driverId: string, driverName: string) => {
    try {
      const { error } = await supabase
        .from('drivers')
        .update({ status: 'rejected' })
        .eq('id', driverId);
      if (error) {
        toast.error('Error al rechazar conductor');
        return;
      }
      toast.success(`Conductor ${driverName} rechazado`);
      fetchDrivers();
    } catch (err) {
      toast.error('Error al rechazar conductor');
    }
    setOpenMenu(null);
  };

  /* ═════════════════════════════════════════════════════════
     DOCUMENT STATUS SUMMARY FOR CARD
     ═════════════════════════════════════════════════════════ */
  const getDocSummary = (driver: DriverData) => {
    const docs = driver.documents;
    const approved = Object.values(docs).filter((s) => s === 'approved').length;
    const rejected = Object.values(docs).filter((s) => s === 'rejected').length;
    const pending = Object.values(docs).filter((s) => s === 'pending').length;
    return { approved, rejected, pending, total: driver.docCount };
  };

  /* ═════════════════════════════════════════════════════════
     RENDER
     ═════════════════════════════════════════════════════════ */
  return (
    <div className="space-y-6">
      {/* ─── Header ──────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white">Conductores</h1>
          <p className="text-gray-400 mt-1">
            {loading ? 'Cargando...' : `${drivers.length} conductores registrados`}
          </p>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <span className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
            <span className="text-cyan-400">{drivers.filter((d) => d.status === 'online').length} en linea</span>
          </span>
          <span className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-amber-400" />
            <span className="text-amber-400">{drivers.filter((d) => d.status === 'pending').length} pendientes</span>
          </span>
        </div>
      </div>

      {/* ─── Search & Filters ───────────────────────────── */}
      <div className="glass rounded-2xl p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            placeholder="Buscar por nombre o placa..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white/5 border border-white/10 focus:border-cyan-500 text-white placeholder:text-gray-600 outline-none text-sm transition-all"
          />
        </div>
        <div className="flex gap-2 mt-3 overflow-x-auto pb-1">
          {filterTabs.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveFilter(tab)}
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

      {/* ─── Driver Cards ───────────────────────────────── */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <AnimatePresence mode="popLayout">
              {filteredDrivers.map((driver, i) => {
                const cfg = statusConfig[driver.status] || statusConfig.offline;
                const DriverIcon = cfg.icon;
                const summary = getDocSummary(driver);

                return (
                  <motion.div
                    key={driver.id}
                    layout
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -15 }}
                    transition={{ delay: i * 0.05 }}
                    className="glass rounded-2xl p-5 hover:bg-white/[0.07] transition-all group"
                  >
                    <div className="flex items-start gap-4">
                      {/* Avatar */}
                      <div className="relative">
                        <div
                          className={`w-12 h-12 rounded-xl flex items-center justify-center text-sm font-bold ${
                            driver.status === 'rejected'
                              ? 'bg-red-500/20 text-red-400'
                              : driver.status === 'online'
                              ? 'bg-gradient-to-br from-cyan-600 to-emerald-500 text-white'
                              : driver.status === 'pending'
                              ? 'bg-amber-500/20 text-amber-400'
                              : 'bg-white/10 text-gray-400'
                          }`}
                        >
                          {driver.avatar}
                        </div>
                        {driver.status === 'online' && (
                          <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-emerald-400 border-2 border-[#0a0e1a]" />
                        )}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-sm font-semibold text-white">{driver.name}</h3>
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium border ${cfg.color}`}
                          >
                            <DriverIcon className="w-3 h-3" />
                            {cfg.label}
                          </span>
                        </div>
                        <p className="text-xs text-gray-400 mt-1">
                          {driver.vehicle} &bull; {driver.plate}
                        </p>
                        <div className="flex items-center gap-3 mt-2 text-xs">
                          <span className="flex items-center gap-1 text-amber-400">
                            <Star className="w-3 h-3 fill-amber-400" /> {driver.rating.toFixed(1)}
                          </span>
                          <span className="text-gray-500">{driver.totalRides} viajes</span>
                          <span className="text-emerald-400 font-medium">{driver.earnings}</span>
                        </div>

                        {/* Document summary badges */}
                        <div className="flex items-center gap-2 mt-3 flex-wrap">
                          {driver.docCount > 0 ? (
                            <>
                              <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                                {summary.approved} aprobados
                              </span>
                              {summary.rejected > 0 && (
                                <span className="text-[10px] text-red-400 bg-red-500/10 px-2 py-0.5 rounded-full">
                                  {summary.rejected} rechazados
                                </span>
                              )}
                              {summary.pending > 0 && (
                                <span className="text-[10px] text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full">
                                  {summary.pending} pendientes
                                </span>
                              )}
                              <span className="text-[10px] text-gray-500">
                                ({summary.total} documentos)
                              </span>
                            </>
                          ) : (
                            <span className="text-[10px] text-gray-500 flex items-center gap-1">
                              <AlertTriangle className="w-3 h-3" /> Sin documentos
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Actions Menu */}
                      <div className="relative flex-shrink-0">
                        <button
                          onClick={() => setOpenMenu(openMenu === driver.id ? null : driver.id)}
                          className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 transition-all"
                        >
                          <MoreHorizontal className="w-4 h-4" />
                        </button>
                        <AnimatePresence>
                          {openMenu === driver.id && (
                            <motion.div
                              initial={{ opacity: 0, y: -5, scale: 0.95 }}
                              animate={{ opacity: 1, y: 0, scale: 1 }}
                              exit={{ opacity: 0, y: -5, scale: 0.95 }}
                              className="absolute right-0 top-10 w-52 glass-strong rounded-xl py-1.5 z-20 shadow-xl"
                            >
                              <button
                                onClick={() => openDetail(driver)}
                                className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-gray-300 hover:text-white hover:bg-white/5 transition-colors"
                              >
                                <Eye className="w-4 h-4 text-cyan-400" /> Ver detalles
                              </button>

                              <button
                                onClick={() => openReview(driver)}
                                className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-gray-300 hover:text-white hover:bg-white/5 transition-colors"
                              >
                                <FileCheck className="w-4 h-4 text-blue-400" /> Documentos
                                <ChevronRight className="w-3 h-3 ml-auto" />
                              </button>

                              <div className="h-px bg-white/10 my-1" />

                              {(driver.status === 'pending' || driver.status === 'rejected') && (
                                <button
                                  onClick={() => quickApprove(driver.id, driver.name)}
                                  className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-emerald-400 hover:bg-emerald-500/10 transition-colors"
                                >
                                  <ShieldCheck className="w-4 h-4" /> Aprobar rapido
                                </button>
                              )}
                              {(driver.status === 'pending' || driver.status === 'verified' || driver.status === 'online') && (
                                <button
                                  onClick={() => quickReject(driver.id, driver.name)}
                                  className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-red-400 hover:bg-red-500/10 transition-colors"
                                >
                                  <ShieldX className="w-4 h-4" /> Rechazar
                                </button>
                              )}
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>

          {filteredDrivers.length === 0 && (
            <div className="text-center py-16 text-gray-500">
              <Car className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No se encontraron conductores</p>
            </div>
          )}
        </>
      )}

      {/* ═══════════════════════════════════════════════════════
          DETAIL MODAL
          ═══════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {selectedDriver && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setSelectedDriver(null)}
          >
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.95 }}
              className="glass-strong rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="sticky top-0 glass-strong rounded-t-2xl p-5 border-b border-white/10 flex items-center justify-between z-10">
                <h2 className="text-lg font-bold text-white">Detalle del Conductor</h2>
                <button
                  onClick={() => setSelectedDriver(null)}
                  className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-gray-400 hover:text-white"
                >
                  <XCircle className="w-5 h-5" />
                </button>
              </div>

              <div className="p-5 space-y-5">
                {detailLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-6 h-6 text-cyan-400 animate-spin" />
                  </div>
                ) : (
                  <>
                    {/* Driver Info */}
                    <div className="flex items-center gap-4">
                      <div
                        className={`w-16 h-16 rounded-2xl flex items-center justify-center text-xl font-bold ${
                          selectedDriver.status === 'rejected'
                            ? 'bg-red-500/20 text-red-400'
                            : selectedDriver.status === 'online'
                            ? 'bg-gradient-to-br from-cyan-600 to-emerald-500 text-white'
                            : selectedDriver.status === 'pending'
                            ? 'bg-amber-500/20 text-amber-400'
                            : 'bg-white/10 text-gray-400'
                        }`}
                      >
                        {selectedDriver.avatar}
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-white">{selectedDriver.name}</h3>
                        <p className="text-sm text-gray-400">{selectedDriver.phone}</p>
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium border mt-1 ${
                            (statusConfig[selectedDriver.status] || statusConfig.offline).color
                          }`}
                        >
                          {(statusConfig[selectedDriver.status] || statusConfig.offline).label}
                        </span>
                      </div>
                    </div>

                    {/* Info Grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      <div className="bg-white/5 rounded-xl p-3">
                        <p className="text-xs text-gray-500">Vehiculo</p>
                        <p className="text-sm text-white mt-0.5">{selectedDriver.vehicle}</p>
                      </div>
                      <div className="bg-white/5 rounded-xl p-3">
                        <p className="text-xs text-gray-500">Placa</p>
                        <p className="text-sm text-white mt-0.5">{selectedDriver.plate}</p>
                      </div>
                      <div className="bg-white/5 rounded-xl p-3">
                        <p className="text-xs text-gray-500">Calificacion</p>
                        <p className="text-sm text-amber-400 mt-0.5 flex items-center gap-1">
                          <Star className="w-3.5 h-3.5 fill-amber-400" /> {selectedDriver.rating.toFixed(1)}
                        </p>
                      </div>
                      <div className="bg-white/5 rounded-xl p-3">
                        <p className="text-xs text-gray-500">Total Viajes</p>
                        <p className="text-sm text-white mt-0.5">{selectedDriver.totalRides}</p>
                      </div>
                      <div className="bg-white/5 rounded-xl p-3">
                        <p className="text-xs text-gray-500">Ganancias</p>
                        <p className="text-sm text-emerald-400 mt-0.5">{selectedDriver.earnings}</p>
                      </div>
                      <div className="bg-white/5 rounded-xl p-3">
                        <p className="text-xs text-gray-500">Registro</p>
                        <p className="text-sm text-white mt-0.5">
                          {selectedDriver.joined
                            ? new Date(selectedDriver.joined).toLocaleDateString('es-CR', {
                                day: '2-digit',
                                month: 'short',
                                year: 'numeric',
                              })
                            : 'N/A'}
                        </p>
                      </div>
                    </div>

                    {/* Documents Section */}
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="text-sm font-medium text-gray-300">
                          Documentos ({driverDocs.length})
                        </h4>
                        <button
                          onClick={() => {
                            setSelectedDriver(null);
                            openReview(selectedDriver);
                          }}
                          className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1"
                        >
                          <FileCheck className="w-3.5 h-3.5" /> Revision completa
                        </button>
                      </div>

                      {driverDocs.length === 0 ? (
                        <div className="bg-white/5 rounded-xl p-6 text-center">
                          <AlertTriangle className="w-8 h-8 text-amber-400 mx-auto mb-2" />
                          <p className="text-sm text-gray-400">Este conductor no ha subido documentos</p>
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                          {driverDocs.map((doc) => {
                            const typeInfo = DOCUMENT_TYPES.find((dt) => dt.type === doc.type);
                            const status = docStatusConfig[doc.status as DocStatus] || docStatusConfig.pending;
                            const StatusIcon = status.icon;
                            const imgUrl = signedUrls[doc.type];

                            return (
                              <div
                                key={doc.id}
                                className={`rounded-xl overflow-hidden border ${docStatusBg[doc.status as DocStatus] || docStatusBg.pending}`}
                              >
                                {/* Thumbnail */}
                                <div
                                  className="aspect-square bg-black/30 relative cursor-pointer"
                                  onClick={() => {
                                    if (imgUrl) {
                                      setViewerUrl(imgUrl);
                                      setViewerLabel(typeInfo?.label || doc.type);
                                    }
                                  }}
                                >
                                  {imgUrl ? (
                                    <img
                                      src={imgUrl}
                                      alt={typeInfo?.label || doc.type}
                                      className="w-full h-full object-cover"
                                    />
                                  ) : (
                                    <div className="w-full h-full flex items-center justify-center text-gray-600">
                                      <CreditCard className="w-8 h-8" />
                                    </div>
                                  )}
                                  <div className="absolute bottom-1 right-1">
                                    <ZoomIn className="w-4 h-4 text-white/60" />
                                  </div>
                                </div>
                                {/* Label + Status */}
                                <div className="p-2 flex items-center justify-between">
                                  <span className="text-[10px] text-gray-400 truncate">
                                    {typeInfo?.label || doc.type}
                                  </span>
                                  <span className={`flex items-center gap-1 text-[10px] font-medium ${status.color}`}>
                                    <StatusIcon className="w-3 h-3" /> {status.label}
                                  </span>
                                </div>
                                {/* Rejection reason */}
                                {doc.status === 'rejected' && doc.rejection_reason && (
                                  <div className="px-2 pb-2">
                                    <p className="text-[9px] text-red-400/80 truncate">
                                      {doc.rejection_reason}
                                    </p>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══════════════════════════════════════════════════════
          DOCUMENT REVIEW MODAL
          ═══════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {reviewDriver && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => !submittingReview && setReviewDriver(null)}
          >
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.95 }}
              className="glass-strong rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="sticky top-0 glass-strong rounded-t-2xl p-5 border-b border-white/10 flex items-center justify-between z-10">
                <div>
                  <h2 className="text-lg font-bold text-white">Revision de Documentos</h2>
                  <p className="text-xs text-gray-400 mt-0.5">{reviewDriver.name}</p>
                </div>
                <button
                  onClick={() => setReviewDriver(null)}
                  className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-gray-400 hover:text-white"
                  disabled={submittingReview}
                >
                  <XCircle className="w-5 h-5" />
                </button>
              </div>

              <div className="p-5 space-y-5">
                {reviewLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-6 h-6 text-cyan-400 animate-spin" />
                  </div>
                ) : reviewDocs.length === 0 ? (
                  <div className="bg-white/5 rounded-xl p-6 text-center">
                    <AlertTriangle className="w-8 h-8 text-amber-400 mx-auto mb-2" />
                    <p className="text-sm text-gray-400">Este conductor no ha subido documentos</p>
                  </div>
                ) : (
                  <>
                    {/* Documents grid for review */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {reviewDocs.map((doc) => {
                        const typeInfo = DOCUMENT_TYPES.find((dt) => dt.type === doc.type);
                        const action = reviewActions[doc.type];
                        const imgUrl = reviewUrls[doc.type];
                        const isRejected = action === 'reject';
                        const isApproved = action === 'approve';

                        return (
                          <div
                            key={doc.id}
                            className={`rounded-xl overflow-hidden border transition-all ${
                              isApproved
                                ? 'border-emerald-500/40 bg-emerald-500/5'
                                : isRejected
                                ? 'border-red-500/40 bg-red-500/5'
                                : 'border-white/10 bg-white/[0.02]'
                            }`}
                          >
                            <div className="flex gap-3 p-3">
                              {/* Thumbnail */}
                              <div
                                className="w-24 h-24 sm:w-28 sm:h-28 rounded-lg overflow-hidden bg-black/30 flex-shrink-0 cursor-pointer relative"
                                onClick={() => {
                                  if (imgUrl) {
                                    setViewerUrl(imgUrl);
                                    setViewerLabel(typeInfo?.label || doc.type);
                                  }
                                }}
                              >
                                {imgUrl ? (
                                  <img
                                    src={imgUrl}
                                    alt={typeInfo?.label || doc.type}
                                    className="w-full h-full object-cover"
                                  />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center text-gray-600">
                                    <CreditCard className="w-6 h-6" />
                                  </div>
                                )}
                                <div className="absolute bottom-1 right-1">
                                  <ZoomIn className="w-3.5 h-3.5 text-white/60" />
                                </div>
                              </div>

                              {/* Info + Actions */}
                              <div className="flex-1 flex flex-col min-w-0">
                                <p className="text-sm font-medium text-white truncate">
                                  {typeInfo?.label || doc.type}
                                </p>
                                <p className="text-[10px] text-gray-500 mt-0.5">
                                  Estado: {docStatusConfig[doc.status as DocStatus]?.label || 'Pendiente'}
                                </p>
                                {doc.rejection_reason && (
                                  <p className="text-[10px] text-red-400 mt-0.5 truncate">
                                    Rechazo anterior: {doc.rejection_reason}
                                  </p>
                                )}

                                {/* Action Buttons */}
                                <div className="flex gap-2 mt-auto pt-2">
                                  <button
                                    onClick={() => setAction(doc.type, 'approve')}
                                    className={`flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg text-xs font-medium transition-all ${
                                      isApproved
                                        ? 'bg-emerald-500 text-white'
                                        : 'bg-white/5 text-gray-400 hover:bg-emerald-500/10 hover:text-emerald-400'
                                    }`}
                                  >
                                    <CheckCircle2 className="w-3.5 h-3.5" /> Aprobar
                                  </button>
                                  <button
                                    onClick={() => setAction(doc.type, 'reject')}
                                    className={`flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg text-xs font-medium transition-all ${
                                      isRejected
                                        ? 'bg-red-500 text-white'
                                        : 'bg-white/5 text-gray-400 hover:bg-red-500/10 hover:text-red-400'
                                    }`}
                                  >
                                    <XCircle className="w-3.5 h-3.5" /> Rechazar
                                  </button>
                                </div>

                                {/* Rejection reason input */}
                                {isRejected && (
                                  <input
                                    type="text"
                                    placeholder="Motivo del rechazo..."
                                    value={reviewReasons[doc.type] || ''}
                                    onChange={(e) =>
                                      setReviewReasons((prev) => ({
                                        ...prev,
                                        [doc.type]: e.target.value,
                                      }))
                                    }
                                    className="mt-2 w-full px-2 py-1.5 rounded-lg bg-white/5 border border-red-500/20 text-xs text-white placeholder:text-gray-600 outline-none focus:border-red-500/40"
                                  />
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Comment for driver */}
                    <div className="space-y-2">
                      <label className="text-xs text-gray-400">Comentario para el conductor (opcional):</label>
                      <textarea
                        value={reviewComment}
                        onChange={(e) => setReviewComment(e.target.value)}
                        placeholder="Escribe un comentario o instruccion para el conductor..."
                        rows={2}
                        className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-sm text-white placeholder:text-gray-600 outline-none focus:border-cyan-500/40 resize-none"
                      />
                    </div>

                    {/* Submit Buttons */}
                    <div className="flex gap-3 pt-2">
                      <button
                        onClick={() => setReviewDriver(null)}
                        className="flex-1 border border-white/10 text-gray-300 py-3 rounded-xl text-sm font-medium hover:bg-white/5 transition-all"
                        disabled={submittingReview}
                      >
                        Cancelar
                      </button>
                      <button
                        onClick={submitReview}
                        className="flex-1 flex items-center justify-center gap-2 bg-cyan-500 hover:bg-cyan-600 text-white py-3 rounded-xl text-sm font-medium transition-all disabled:opacity-50"
                        disabled={submittingReview || Object.keys(reviewActions).length === 0}
                      >
                        {submittingReview ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Send className="w-4 h-4" />
                        )}
                        Enviar Revision
                      </button>
                    </div>
                  </>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══════════════════════════════════════════════════════
          FULL-SIZE IMAGE VIEWER
          ═══════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {viewerUrl && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/90 backdrop-blur-sm z-[60] flex items-center justify-center p-4"
            onClick={() => setViewerUrl(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="relative max-w-3xl max-h-[90vh] w-full"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm text-gray-300 font-medium">{viewerLabel}</p>
                <button
                  onClick={() => setViewerUrl(null)}
                  className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center text-gray-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <img
                src={viewerUrl}
                alt={viewerLabel}
                className="w-full h-auto max-h-[80vh] object-contain rounded-2xl"
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
