'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  DollarSign, TrendingUp, Zap, Save, Info, Percent,
  Calculator, Wallet, TrendingDown, RefreshCw
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';

type ZoneRideCount = { zone: string; count: number };

export default function PricingPage() {
  const [basePrice, setBasePrice] = useState(1500);
  const [pricePerKm, setPricePerKm] = useState(500);
  const [pricePerMin, setPricePerMin] = useState(50);
  const [commission, setCommission] = useState(15);
  const [baseFee, setBaseFee] = useState(200);
  const [surgeEnabled, setSurgeEnabled] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Commission stats
  const [totalCommission, setTotalCommission] = useState(0);
  const [totalDriverEarnings, setTotalDriverEarnings] = useState(0);
  const [totalRidesCompleted, setTotalRidesCompleted] = useState(0);
  const [statsLoading, setStatsLoading] = useState(true);

  // Real zone ride data
  const [zoneRideCounts, setZoneRideCounts] = useState<ZoneRideCount[]>([]);
  const [zoneDataLoading, setZoneDataLoading] = useState(true);

  const formatColones = (val: number) => `₡${Math.round(val).toLocaleString()}`;

  // ── Load settings from DB on mount ──────────────────────────────

  const loadSettings = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data: settings, error } = await supabase
        .from('settings')
        .select('key, value');

      if (!error && settings) {
        const get = (key: string, fallback: number) =>
          Number(settings.find((s: any) => s.key === key)?.value ?? fallback);

        setBasePrice(get('base_price', 1500));
        setPricePerKm(get('price_per_km', 500));
        setPricePerMin(get('price_per_min', 50));
        setSurgeEnabled(get('surge_enabled', 1) === 1);
        setCommission(get('commission_percentage', 15));
        setBaseFee(get('base_fee', 200));
      }
    } catch (err) {
      console.error('Error loading settings:', err);
    }
    setIsLoading(false);
  }, []);

  const loadStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const { data: rides, error } = await supabase
        .from('rides')
        .select('price, commission, driver_earnings')
        .eq('status', 'completed');

      if (!error && rides) {
        setTotalRidesCompleted(rides.length);
        setTotalCommission(rides.reduce((sum, r) => sum + (Number(r.commission) || 0), 0));
        setTotalDriverEarnings(rides.reduce((sum, r) => sum + (Number(r.driver_earnings) || 0), 0));
      }
    } catch (err) {
      console.error('Error loading commission stats:', err);
    }
    setStatsLoading(false);
  }, []);

  const loadZoneData = useCallback(async () => {
    setZoneDataLoading(true);
    try {
      const { data, error } = await supabase
        .from('rides')
        .select('origin_zone')
        .not('origin_zone', 'is', null);

      if (!error && data) {
        const counts: Record<string, number> = {};
        data.forEach((r: any) => {
          const zone = r.origin_zone;
          if (zone) {
            counts[zone] = (counts[zone] || 0) + 1;
          }
        });
        const sorted = Object.entries(counts)
          .map(([zone, count]) => ({ zone, count }))
          .sort((a, b) => b.count - a.count);
        setZoneRideCounts(sorted);
      }
    } catch (err) {
      console.error('Error loading zone data:', err);
    }
    setZoneDataLoading(false);
  }, []);

  useEffect(() => {
    loadSettings();
    loadStats();
    loadZoneData();
  }, [loadSettings, loadStats, loadZoneData]);

  // ── Calculate estimates ─────────────────────────────────────────

  const estimatedFare = (km: number, min: number) => {
    // Surge is applied externally based on real demand; estimates use base rate (1.0x) only
    return Math.round(basePrice + km * pricePerKm + min * pricePerMin);
  };

  const estimatedCommission = (km: number, min: number) => {
    const fare = estimatedFare(km, min);
    return Math.round(fare * commission / 100) + baseFee;
  };

  const estimatedDriverEarning = (km: number, min: number) => {
    const fare = estimatedFare(km, min);
    const comm = estimatedCommission(km, min);
    return Math.max(0, fare - comm);
  };

  // ── Save settings to DB ─────────────────────────────────────────

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const settingsData = [
        { key: 'base_price', value: String(basePrice) },
        { key: 'price_per_km', value: String(pricePerKm) },
        { key: 'price_per_min', value: String(pricePerMin) },
        { key: 'surge_enabled', value: surgeEnabled ? '1' : '0' },
        { key: 'commission_percentage', value: String(commission) },
        { key: 'base_fee', value: String(baseFee) },
      ];

      // Upsert each setting individually
      for (const setting of settingsData) {
        await supabase
          .from('settings')
          .upsert(setting, { onConflict: 'key' });
      }

      toast.success('Configuracion guardada correctamente', {
        description: `Comision: ${commission}% + ₡${baseFee} de cuota fija`,
      });
    } catch (err) {
      console.error('Error saving settings:', err);
      toast.error('Error al guardar la configuracion');
    }
    setIsSaving(false);
  };

  // ── Render ──────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-white">Configuracion de Precios</h1>
        <p className="text-gray-400 mt-1">Ajusta las tarifas y comisiones del sistema</p>
      </div>

      {/* Commission Stats Banner */}
      <motion.div
        className="grid grid-cols-1 sm:grid-cols-3 gap-4"
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="glass rounded-2xl p-4 border border-amber-500/20">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/15 flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <p className="text-[11px] text-gray-500 uppercase tracking-wider">Comision Total</p>
              <p className="text-lg font-bold text-amber-400">
                {statsLoading ? '...' : formatColones(totalCommission)}
              </p>
            </div>
          </div>
        </div>
        <div className="glass rounded-2xl p-4 border border-emerald-500/20">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/15 flex items-center justify-center">
              <Wallet className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <p className="text-[11px] text-gray-500 uppercase tracking-wider">Ganancias Conductores</p>
              <p className="text-lg font-bold text-emerald-400">
                {statsLoading ? '...' : formatColones(totalDriverEarnings)}
              </p>
            </div>
          </div>
        </div>
        <div className="glass rounded-2xl p-4 border border-cyan-500/20">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/15 flex items-center justify-center">
              <Calculator className="w-5 h-5 text-cyan-400" />
            </div>
            <div>
              <p className="text-[11px] text-gray-500 uppercase tracking-wider">Viajes Completados</p>
              <p className="text-lg font-bold text-cyan-400">
                {statsLoading ? '...' : totalRidesCompleted.toLocaleString()}
              </p>
            </div>
          </div>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Pricing Controls */}
        <div className="xl:col-span-2 space-y-4">
          {/* Base Price */}
          <motion.div
            className="glass rounded-2xl p-6"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                  <DollarSign className="w-5 h-5 text-cyan-400" />
                  Precio Base
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">Tarifa minima por iniciar un viaje</p>
              </div>
              <div className="text-2xl font-bold text-cyan-400">{formatColones(basePrice)}</div>
            </div>
            <input
              type="range"
              min={500}
              max={5000}
              step={100}
              value={basePrice}
              onChange={(e) => setBasePrice(Number(e.target.value))}
              className="w-full h-2 bg-white/10 rounded-full appearance-none cursor-pointer accent-cyan-500"
            />
            <div className="flex justify-between mt-2 text-xs text-gray-500">
              <span>₡500</span>
              <span>₡5,000</span>
            </div>
          </motion.div>

          {/* Price per KM */}
          <motion.div
            className="glass rounded-2xl p-6"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-cyan-400" />
                  Precio por Kilometro
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">Costo adicional por cada KM recorrido</p>
              </div>
              <div className="text-2xl font-bold text-cyan-400">{formatColones(pricePerKm)}</div>
            </div>
            <input
              type="range"
              min={100}
              max={2000}
              step={50}
              value={pricePerKm}
              onChange={(e) => setPricePerKm(Number(e.target.value))}
              className="w-full h-2 bg-white/10 rounded-full appearance-none cursor-pointer accent-cyan-500"
            />
            <div className="flex justify-between mt-2 text-xs text-gray-500">
              <span>₡100</span>
              <span>₡2,000</span>
            </div>
          </motion.div>

          {/* Price per Minute */}
          <motion.div
            className="glass rounded-2xl p-6"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                  <DollarSign className="w-5 h-5 text-cyan-400" />
                  Precio por Minuto
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">Costo por minuto de espera o trafico</p>
              </div>
              <div className="text-2xl font-bold text-cyan-400">{formatColones(pricePerMin)}</div>
            </div>
            <input
              type="range"
              min={10}
              max={200}
              step={10}
              value={pricePerMin}
              onChange={(e) => setPricePerMin(Number(e.target.value))}
              className="w-full h-2 bg-white/10 rounded-full appearance-none cursor-pointer accent-cyan-500"
            />
            <div className="flex justify-between mt-2 text-xs text-gray-500">
              <span>₡10</span>
              <span>₡200</span>
            </div>
          </motion.div>

          {/* ── Commission Section ──────────────────────────────────── */}
          <motion.div
            className="glass rounded-2xl p-6 border border-amber-500/20"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <div className="flex items-center gap-2 mb-4">
              <Percent className="w-5 h-5 text-amber-400" />
              <h3 className="text-lg font-semibold text-white">Comision de RIDA</h3>
            </div>
            <p className="text-xs text-gray-500 mb-5">Porcentaje + cuota fija que retiene la plataforma por cada viaje completado. El conductor recibe el resto.</p>

            {/* Commission Percentage */}
            <div className="mb-5">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-sm font-medium text-gray-300">Porcentaje de comision</p>
                  <p className="text-[10px] text-gray-600">Se aplica sobre el precio total del viaje</p>
                </div>
                <div className="text-2xl font-bold text-amber-400">{commission}%</div>
              </div>
              <input
                type="range"
                min={5}
                max={40}
                step={1}
                value={commission}
                onChange={(e) => setCommission(Number(e.target.value))}
                className="w-full h-2 bg-white/10 rounded-full appearance-none cursor-pointer accent-amber-500"
              />
              <div className="flex justify-between mt-2 text-xs text-gray-500">
                <span>5%</span>
                <span>40%</span>
              </div>
            </div>

            {/* Base Fee */}
            <div className="mb-5">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-sm font-medium text-gray-300">Cuota fija por viaje</p>
                  <p className="text-[10px] text-gray-600">Se suma al porcentaje (costo operacional)</p>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-xs text-gray-500">₡</span>
                  <input
                    type="number"
                    min={0}
                    max={2000}
                    step={50}
                    value={baseFee}
                    onChange={(e) => setBaseFee(Math.max(0, Number(e.target.value)))}
                    className="w-24 bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-right text-base font-bold text-amber-400 focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>
              <input
                type="range"
                min={0}
                max={2000}
                step={50}
                value={baseFee}
                onChange={(e) => setBaseFee(Number(e.target.value))}
                className="w-full h-2 bg-white/10 rounded-full appearance-none cursor-pointer accent-amber-500"
              />
              <div className="flex justify-between mt-2 text-xs text-gray-500">
                <span>₡0</span>
                <span>₡2,000</span>
              </div>
            </div>

            {/* Commission Formula */}
            <div className="bg-amber-500/5 border border-amber-500/15 rounded-xl p-4">
              <p className="text-xs font-medium text-amber-400 mb-2 flex items-center gap-1.5">
                <Calculator className="w-3.5 h-3.5" />
                Formula de comision
              </p>
              <div className="text-xs text-gray-400 space-y-1">
                <p><span className="text-gray-300">Comision</span> = (Precio del viaje x {commission}%) + ₡{baseFee}</p>
                <p><span className="text-gray-300">Ganancia conductor</span> = Precio del viaje - Comision</p>
              </div>
            </div>
          </motion.div>

          {/* Surge Toggle */}
          <motion.div
            className="glass rounded-2xl p-6"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-amber-400" />
                  Precios Dinamicos (Surge)
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">Activar multiplicadores de precio por alta demanda</p>
              </div>
              <button
                type="button"
                onClick={() => setSurgeEnabled(!surgeEnabled)}
                className={`relative w-14 h-7 rounded-full transition-colors duration-300 ${
                  surgeEnabled ? 'bg-cyan-500' : 'bg-white/10'
                }`}
              >
                <motion.div
                  className="absolute top-0.5 w-6 h-6 rounded-full bg-white shadow-md"
                  animate={{ left: surgeEnabled ? 'calc(100% - 26px)' : '2px' }}
                  transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                />
              </button>
            </div>
          </motion.div>

          {/* Save Button */}
          <motion.button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="w-full py-3.5 rounded-xl btn-neon text-white font-semibold text-sm disabled:opacity-50 flex items-center justify-center gap-2"
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
          >
            {isSaving ? (
              <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Guardando...</>
            ) : (
              <><Save className="w-4 h-4" /> Guardar Cambios</>
            )}
          </motion.button>
        </div>

        {/* Right Panel */}
        <div className="space-y-4">
          {/* Real Demand by Zone */}
          <motion.div
            className="glass rounded-2xl p-5"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <h3 className="text-lg font-semibold text-white mb-1 flex items-center gap-2">
              <Zap className="w-5 h-5 text-amber-400" />
              Demanda por Zona
            </h3>
            <p className="text-xs text-gray-500 mb-1">Viajes agrupados por zona de origen</p>
            <p className="text-[10px] text-cyan-400/70 mb-4">El mapa de demanda se basa en datos reales de viajes</p>

            {zoneDataLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="w-4 h-4 border-2 border-white/20 border-t-cyan-400 rounded-full animate-spin" />
              </div>
            ) : zoneRideCounts.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-xs text-gray-500">No hay datos de viajes por zona aun.</p>
                <p className="text-[10px] text-gray-600 mt-1">Los datos apareceran cuando se completen viajes.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {zoneRideCounts.map((z) => {
                  const maxCount = zoneRideCounts[0]?.count || 1;
                  const pct = Math.round((z.count / maxCount) * 100);
                  let barColor = 'bg-emerald-500';
                  if (pct >= 75) barColor = 'bg-red-500';
                  else if (pct >= 50) barColor = 'bg-orange-500';
                  else if (pct >= 25) barColor = 'bg-amber-500';

                  return (
                    <div key={z.zone} className="flex items-center gap-3">
                      <span className="text-[11px] text-gray-400 w-24 truncate" title={z.zone}>{z.zone}</span>
                      <div className="flex-1 h-3 rounded-full bg-white/5 overflow-hidden">
                        <motion.div
                          className={`h-full rounded-full ${barColor}`}
                          initial={{ width: 0 }}
                          animate={{ width: `${pct}%` }}
                          transition={{ duration: 0.5, delay: 0.1 }}
                        />
                      </div>
                      <span className="text-[11px] font-semibold text-gray-300 w-8 text-right">{z.count}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </motion.div>

          {/* Fare Estimates with Commission Breakdown */}
          <motion.div
            className="glass rounded-2xl p-5"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <h3 className="text-lg font-semibold text-white mb-1 flex items-center gap-2">
              <Info className="w-5 h-5 text-cyan-400" />
              Desglose por Viaje
            </h3>
            <p className="text-xs text-gray-500 mb-4">Comision y ganancia estimada con la configuracion actual</p>
            <div className="space-y-3">
              {[
                { label: 'Corto', km: 5, min: 10 },
                { label: 'Medio', km: 10, min: 22 },
                { label: 'Largo', km: 20, min: 40 },
                { label: 'Aeropuerto', km: 25, min: 35 },
              ].map((est) => {
                const fare = estimatedFare(est.km, est.min);
                const comm = estimatedCommission(est.km, est.min);
                const driver = estimatedDriverEarning(est.km, est.min);
                const driverPct = fare > 0 ? Math.round((driver / fare) * 100) : 0;

                return (
                  <div key={est.label} className="bg-white/5 rounded-xl p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs font-medium text-gray-300">{est.label}</p>
                        <p className="text-[10px] text-gray-600">{est.km} km / {est.min} min</p>
                      </div>
                      <p className="text-sm font-bold text-white">{formatColones(fare)}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-2 rounded-full bg-white/10 overflow-hidden">
                        <div
                          className="h-full bg-amber-500 rounded-full"
                          style={{ width: `${Math.round(((comm / fare) * 100) || 0)}%` }}
                        />
                      </div>
                      <div className="h-2 w-px bg-white/10" />
                      <div className="flex-1 h-2 rounded-full bg-white/10 overflow-hidden">
                        <div
                          className="h-full bg-emerald-500 rounded-full"
                          style={{ width: `${driverPct}%` }}
                        />
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="text-amber-400 flex items-center gap-1">
                        <TrendingDown className="w-3 h-3" /> RIDA: {formatColones(comm)}
                      </span>
                      <span className="text-emerald-400 flex items-center gap-1">
                        <Wallet className="w-3 h-3" /> Conductor: {formatColones(driver)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>

          {/* Refresh Stats */}
          <motion.button
            type="button"
            onClick={loadStats}
            className="w-full glass rounded-xl p-3 text-xs text-gray-400 hover:text-white hover:bg-white/5 transition-colors flex items-center justify-center gap-2"
            whileTap={{ scale: 0.98 }}
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Actualizar estadisticas
          </motion.button>
        </div>
      </div>
    </div>
  );
}
