'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Camera, CheckCircle, Upload, Shield, User, CreditCard, Car, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';

const steps = [
  { id: 1, label: 'Selfie', icon: User, description: 'Toma una selfie clara con buena iluminacion' },
  { id: 2, label: 'Cedula Frente', icon: CreditCard, description: 'Fotografa el frente de tu cedula de identidad' },
  { id: 3, label: 'Cedula Atras', icon: CreditCard, description: 'Fotografa el reverso de tu cedula de identidad' },
  { id: 4, label: 'Licencia Frente', icon: CreditCard, description: 'Fotografa el frente de tu licencia de conducir' },
  { id: 5, label: 'Licencia Atras', icon: CreditCard, description: 'Fotografa el reverso de tu licencia de conducir' },
  { id: 6, label: 'Vehiculo', icon: Car, description: 'Fotografa tu vehiculo: frente, lateral y atras' },
];

const vehicleSubPhotos = [
  { id: 'front', label: 'Frente del vehiculo' },
  { id: 'side', label: 'Lateral del vehiculo' },
  { id: 'back', label: 'Atras del vehiculo' },
];

export default function DriverVerification() {
  const [currentStep, setCurrentStep] = useState(1);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [vehiclePhotos, setVehiclePhotos] = useState<Set<string>>(new Set());
  const [currentVehiclePhoto, setCurrentVehiclePhoto] = useState(0);

  const handleCapture = (step: number) => {
    if (step === 6 && !isVehicleComplete()) {
      setVehiclePhotos(prev => new Set([...prev, vehicleSubPhotos[currentVehiclePhoto].id]));
      if (currentVehiclePhoto < vehicleSubPhotos.length - 1) {
        setCurrentVehiclePhoto(prev => prev + 1);
        toast.success(`${vehicleSubPhotos[currentVehiclePhoto].label} capturada`);
      } else {
        setCompletedSteps(prev => new Set([...prev, 6]));
        toast.success('Fotos del vehiculo completadas');
        setIsSubmitted(true);
      }
      return;
    }

    setCompletedSteps(prev => new Set([...prev, step]));
    toast.success(`${steps[step - 1].label} capturado correctamente`);

    if (step < 6) {
      setTimeout(() => setCurrentStep(step + 1), 500);
    } else {
      setIsSubmitted(true);
    }
  };

  const isVehicleComplete = () => vehiclePhotos.size >= vehicleSubPhotos.length;

  const handleSubmit = () => {
    toast.success('Documentos enviados para revision. Recibiras respuesta en 24-48 horas.');
  };

  if (isSubmitted) {
    return (
      <div className="p-4 space-y-6">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-xl font-bold text-white">Verificacion</h1>
          <p className="text-sm text-gray-400 mt-1">Estado de tu verificacion</p>
        </motion.div>

        {/* Progress - all complete */}
        <div className="flex items-center gap-1.5">
          {steps.map(s => (
            <div key={s.id} className="h-1.5 flex-1 rounded-full bg-emerald-500" />
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 }}
          className="glass-strong rounded-2xl p-8 text-center space-y-4"
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 200, delay: 0.3 }}
          >
            <CheckCircle className="w-20 h-20 text-emerald-400 mx-auto" />
          </motion.div>
          <h2 className="text-xl font-bold text-white">Enviado para Revision</h2>
          <p className="text-sm text-gray-400">
            Todos tus documentos han sido recibidos correctamente.
          </p>
          <p className="text-sm text-gray-400">
            El proceso de verificacion toma entre <span className="text-cyan-400 font-medium">24-48 horas</span>.
          </p>

          <div className="glass rounded-xl p-4 flex items-center gap-3 mt-4">
            <Shield className="w-6 h-6 text-amber-400 shrink-0" />
            <div className="text-left">
              <p className="text-sm font-medium text-amber-400">Pendiente de revision</p>
              <p className="text-xs text-gray-500">Te notificaremos cuando tu cuenta este verificada</p>
            </div>
          </div>

          {/* Completed items */}
          <div className="space-y-2 mt-4">
            {steps.map((step) => (
              <div key={step.id} className="flex items-center gap-2 text-left">
                <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                <span className="text-xs text-gray-400">{step.label}</span>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    );
  }

  const currentStepData = steps[currentStep - 1];

  return (
    <div className="p-4 space-y-6">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-xl font-bold text-white">Verificacion</h1>
        <p className="text-sm text-gray-400 mt-1">Paso {currentStep} de {steps.length}</p>
      </motion.div>

      {/* Progress Bar */}
      <div className="space-y-2">
        <div className="flex items-center gap-1.5">
          {steps.map(s => (
            <div
              key={s.id}
              className={`h-1.5 flex-1 rounded-full transition-all ${
                completedSteps.has(s.id) ? 'bg-emerald-500' : s.id === currentStep ? 'bg-cyan-500' : 'bg-white/10'
              }`}
            />
          ))}
        </div>
        <div className="flex justify-between">
          {steps.map(s => (
            <span
              key={s.id}
              className={`text-[9px] ${
                completedSteps.has(s.id) ? 'text-emerald-400' : s.id === currentStep ? 'text-cyan-400' : 'text-gray-600'
              }`}
            >
              {s.label}
            </span>
          ))}
        </div>
      </div>

      {/* Step Content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentStep === 6 ? `vehicle-${currentVehiclePhoto}` : currentStep}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.25 }}
          className="glass-strong rounded-2xl p-6 text-center space-y-4"
        >
          {/* Step Icon */}
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-600 to-cyan-500 flex items-center justify-center mx-auto">
            <currentStepData.icon className="w-8 h-8 text-white" />
          </div>

          {/* Step Title */}
          {currentStep === 6 ? (
            <>
              <h3 className="text-lg font-semibold text-white">
                {vehicleSubPhotos[currentVehiclePhoto].label}
              </h3>
              <p className="text-sm text-gray-400">{vehicleSubPhotos[currentVehiclePhoto].label} en buena iluminacion</p>
            </>
          ) : (
            <>
              <h3 className="text-lg font-semibold text-white">{currentStepData.label}</h3>
              <p className="text-sm text-gray-400">{currentStepData.description}</p>
            </>
          )}

          {/* Vehicle photo indicator */}
          {currentStep === 6 && (
            <div className="flex items-center justify-center gap-2">
              {vehicleSubPhotos.map((photo, i) => (
                <div
                  key={photo.id}
                  className={`w-2.5 h-2.5 rounded-full transition-colors ${
                    vehiclePhotos.has(photo.id) ? 'bg-emerald-500' : i === currentVehiclePhoto ? 'bg-cyan-500' : 'bg-white/20'
                  }`}
                />
              ))}
            </div>
          )}

          {/* Camera Upload Area */}
          <div
            className="w-56 h-56 mx-auto border-2 border-dashed border-white/20 rounded-2xl flex flex-col items-center justify-center gap-3 hover:border-cyan-500/50 transition-colors cursor-pointer group"
            onClick={() => handleCapture(currentStep)}
          >
            <div className="w-14 h-14 rounded-full bg-cyan-500/10 flex items-center justify-center group-hover:bg-cyan-500/20 transition-colors">
              <Camera className="w-7 h-7 text-cyan-400" />
            </div>
            <span className="text-xs text-gray-500 group-hover:text-gray-400 transition-colors">Tocar para capturar</span>
            <Upload className="w-4 h-4 text-gray-600" />
          </div>

          {/* Back Button (for vehicle sub-photos) */}
          {currentStep === 6 && currentVehiclePhoto > 0 && (
            <button
              onClick={(e) => { e.stopPropagation(); setCurrentVehiclePhoto(prev => prev - 1); }}
              className="text-xs text-gray-400 hover:text-white flex items-center gap-1 mx-auto"
            >
              <ArrowLeft className="w-3 h-3" /> Foto anterior
            </button>
          )}
        </motion.div>
      </AnimatePresence>

      {/* Step Navigation */}
      <div className="flex gap-3">
        {currentStep > 1 && !completedSteps.has(currentStep) && (
          <button
            onClick={() => {
              if (currentStep === 6 && currentVehiclePhoto > 0) {
                setCurrentVehiclePhoto(0);
                return;
              }
              setCurrentStep(prev => prev - 1);
            }}
            className="flex-1 border border-white/10 text-gray-300 py-3 rounded-xl flex items-center justify-center gap-2 hover:bg-white/5"
          >
            <ArrowLeft className="w-4 h-4" /> Atras
          </button>
        )}
        {completedSteps.has(currentStep) && currentStep < 6 && (
          <button
            onClick={() => setCurrentStep(prev => prev + 1)}
            className="flex-1 btn-neon text-white font-medium py-3 rounded-xl flex items-center justify-center gap-2"
          >
            Siguiente
          </button>
        )}
      </div>

      {/* Tips */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="glass rounded-2xl p-4 border border-cyan-500/20"
      >
        <div className="flex items-center gap-2 mb-2">
          <Shield className="w-4 h-4 text-cyan-400" />
          <span className="text-sm font-semibold text-white">Consejos</span>
        </div>
        <ul className="space-y-1.5">
          <li className="text-xs text-gray-400 flex items-start gap-2">
            <span className="text-cyan-400 mt-0.5">&#8226;</span>
            Usa buena iluminacion y evita reflejos
          </li>
          <li className="text-xs text-gray-400 flex items-start gap-2">
            <span className="text-cyan-400 mt-0.5">&#8226;</span>
            Asegurate que todos los textos sean legibles
          </li>
          <li className="text-xs text-gray-400 flex items-start gap-2">
            <span className="text-cyan-400 mt-0.5">&#8226;</span>
            Los documentos no deben estar vencidos
          </li>
          <li className="text-xs text-gray-400 flex items-start gap-2">
            <span className="text-cyan-400 mt-0.5">&#8226;</span>
            Las fotos del vehiculo deben mostrar la placa claramente
          </li>
        </ul>
      </motion.div>
    </div>
  );
}
