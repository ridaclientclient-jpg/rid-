'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  DollarSign, TrendingUp, Zap, Save, Info
} from 'lucide-react';
import { toast } from 'sonner';

const surgeZones = [
  [0, 0, 1, 0, 0, 0, 1, 0],
  [0, 1, 2, 1, 0, 1, 2, 0],
  [0, 1, 3, 2, 1, 2, 3, 1],
  [1, 2, 3, 4, 2, 3, 4, 2],
  [0, 1, 2, 3, 2, 2, 3, 1],
  [0, 0, 1, 2, 1, 1, 2, 0],
  [0, 0, 0, 1, 0, 0, 1, 0],
  [0, 0, 0, 0, 0, 0, 0, 0],
];

function getZoneColor(value: number) {
  switch (value) {
    case 0: return 'bg-white/5 border-white/5';
    case 1: return 'bg-emerald-500/30 border-emerald-500/20';
    case 2: return 'bg-amber-500/40 border-amber-500/20';
    case 3: return 'bg-orange-500/50 border-orange-500/20';
    case 4: return 'bg-red-500/60 border-red-500/20';
    default: return 'bg-white/5 border-white/5';
  }
}

function getZoneLabel(value: number) {
  switch (value) {
    case 0: return 'Sin demanda';
    case 1: return 'Normal';
    case 2: return '1.2x';
    case 3: return '1.5x';
    case 4: return '2x+';
    default: return '';
  }
}

export default function PricingPage() {
  const [basePrice, setBasePrice] = useState(1500);
  const [pricePerKm, setPricePerKm] = useState(500);
  const [pricePerMin, setPricePerMin] = useState(50);
  const [commission, setCommission] = useState(15);
  const [surgeEnabled, setSurgeEnabled] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const formatColones = (val: number) => `₡${val.toLocaleString()}`;

  const estimatedFare = (km: number, min: number) => {
    let surge = 1;
    if (surgeEnabled) surge = 1 + Math.random() * 0.5;
    return Math.round((basePrice + km * pricePerKm + min * pricePerMin) * (1 + commission / 100) * surge);
  };

  const handleSave = async () => {
    setIsSaving(true);
    await new Promise((resolve) => setTimeout(resolve, 1200));
    setIsSaving(false);
    toast.success('Configuración de precios actualizada correctamente');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-white">Configuración de Precios</h1>
        <p className="text-gray-400 mt-1">Ajusta las tarifas y comisiones del sistema</p>
      </div>

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
                <p className="text-xs text-gray-500 mt-0.5">Tarifa mínima por iniciar un viaje</p>
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
                  Precio por Kilómetro
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
                <p className="text-xs text-gray-500 mt-0.5">Costo por minuto de espera o tráfico</p>
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

          {/* Commission */}
          <motion.div
            className="glass rounded-2xl p-6"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                  <Zap className="w-5 h-5 text-cyan-400" />
                  Comisión de RIDA
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">Porcentaje que retiene la plataforma</p>
              </div>
              <div className="text-2xl font-bold text-cyan-400">{commission}%</div>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              step={1}
              value={commission}
              onChange={(e) => setCommission(Number(e.target.value))}
              className="w-full h-2 bg-white/10 rounded-full appearance-none cursor-pointer accent-cyan-500"
            />
            <div className="flex justify-between mt-2 text-xs text-gray-500">
              <span>0%</span>
              <span>100%</span>
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
                  Precios Dinámicos (Surge)
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">Activar multiplicadores de precio por alta demanda</p>
              </div>
              <button
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
          {/* Surge Zone Heatmap */}
          <motion.div
            className="glass rounded-2xl p-5"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <h3 className="text-lg font-semibold text-white mb-1 flex items-center gap-2">
              <Zap className="w-5 h-5 text-amber-400" />
              Zonas de Surge
            </h3>
            <p className="text-xs text-gray-500 mb-4">Mapa de demanda actual</p>

            <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${surgeZones[0].length}, 1fr)` }}>
              {surgeZones.map((row, ri) =>
                row.map((val, ci) => (
                  <motion.div
                    key={`${ri}-${ci}`}
                    className={`aspect-square rounded-md border ${getZoneColor(val)} flex items-center justify-center cursor-pointer transition-colors`}
                    initial={{ opacity: 0, scale: 0 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.4 + (ri * surgeZones[0].length + ci) * 0.01 }}
                    whileHover={{ scale: 1.15, zIndex: 10 }}
                    title={getZoneLabel(val)}
                  >
                    {val > 0 && <span className="text-[8px] font-bold text-white/80">{getZoneLabel(val)}</span>}
                  </motion.div>
                ))
              )}
            </div>

            <div className="flex flex-wrap gap-2 mt-4">
              <span className="flex items-center gap-1.5 text-[10px] text-gray-400"><span className="w-3 h-3 rounded bg-emerald-500/30" /> Normal</span>
              <span className="flex items-center gap-1.5 text-[10px] text-gray-400"><span className="w-3 h-3 rounded bg-amber-500/40" /> 1.2x</span>
              <span className="flex items-center gap-1.5 text-[10px] text-gray-400"><span className="w-3 h-3 rounded bg-orange-500/50" /> 1.5x</span>
              <span className="flex items-center gap-1.5 text-[10px] text-gray-400"><span className="w-3 h-3 rounded bg-red-500/60" /> 2x+</span>
            </div>
          </motion.div>

          {/* Fare Estimates */}
          <motion.div
            className="glass rounded-2xl p-5"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <h3 className="text-lg font-semibold text-white mb-1 flex items-center gap-2">
              <Info className="w-5 h-5 text-cyan-400" />
              Tarifas Estimadas
            </h3>
            <p className="text-xs text-gray-500 mb-4">Cálculos con la configuración actual</p>
            <div className="space-y-3">
              {[
                { label: 'Corto (5 km, 10 min)', km: 5, min: 10 },
                { label: 'Medio (10 km, 22 min)', km: 10, min: 22 },
                { label: 'Largo (20 km, 40 min)', km: 20, min: 40 },
                { label: 'Airport (25 km, 35 min)', km: 25, min: 35 },
              ].map((est) => (
                <div key={est.label} className="bg-white/5 rounded-xl p-3 flex items-center justify-between">
                  <div>
                    <p className="text-xs text-gray-400">{est.label}</p>
                    <p className="text-[10px] text-gray-600">{est.km} km • {est.min} min</p>
                  </div>
                  <p className="text-sm font-bold text-emerald-400">{formatColones(estimatedFare(est.km, est.min))}</p>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
