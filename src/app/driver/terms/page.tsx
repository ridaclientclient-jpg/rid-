'use client';

import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft, FileText, CheckCircle, ChevronDown, ChevronUp
} from 'lucide-react';
import { useState } from 'react';

const termsSections = [
  {
    title: '1. Terminos del Servicio',
    content: `Al registrarte como conductor en RIDA SUPREME, aceptas proporcionar un servicio de transporte seguro y profesional. Te comprometes a mantener tu vehiculo en buenas condiciones, cumplir con todas las leyes de transito vigentes, y tratar a todos los pasajeros con respeto y cortesia. RIDA SUPREME se reserva el derecho de desactivar tu cuenta si se detecta un incumplimiento reiterado de estos terminos. Como conductor, eres responsable de tu propia seguridad y la de tus pasajeros durante cada viaje.`,
  },
  {
    title: '2. Requisitos del Conductor',
    content: `Para operar como conductor en la plataforma, debes cumplir con los siguientes requisitos: ser mayor de 18 anos, poseer una licencia de conducir vigente, tener un vehiculo asegurado y con revision tecnica al dia, y aprobar el proceso de verificacion de documentos. RIDA SUPREME verifica periodicamente el cumplimiento de estos requisitos y puede solicitar la actualizacion de documentos en cualquier momento. La falta de documentacion vigente puede resultar en la suspension temporal de la cuenta.`,
  },
  {
    title: '3. Tarifas y Pagos',
    content: `Las tarifas de cada viaje son calculadas automaticamente por la plataforma basandose en la distancia, duracion estimada, demanda y tipo de servicio. RIDA SUPREMEcobra una comision sobre cada viaje completado, la cual se detalla en tu panel de ganancias. Los pagos se procesan de forma segura a traves de la billetera integrada en la aplicacion. Puedes solicitar retiros de tus ganancias acumuladas segun los limites y horarios establecidos por la plataforma.`,
  },
  {
    title: '4. Cancelaciones y Penalidades',
    content: `Las cancelaciones excesivas por parte del conductor pueden resultar en reduccion de tu calificacion, menor prioridad en la asignacion de viajes, o suspension temporal de la cuenta. Se considera cancelacion excesiva mas de 3 cancelaciones en un periodo de 24 horas. Las cancelaciones por razones de seguridad, emergencias, o comportamiento inapropiado del pasajero no seran penalizadas. Debes reportar estos incidentes a traves del sistema de soporte.`,
  },
  {
    title: '5. Privacidad y Datos',
    content: `RIDAA SUPREME protege tus datos personales conforme a nuestra Politica de Privacidad. Tu ubicacion se comparte con pasajeros unicamente durante los viajes activos para seguridad de ambas partes. No compartimos tu informacion personal con terceros sin tu consentimiento expreso. Tienes derecho a solicitar la eliminacion de tus datos personales en cualquier momento, sujeto a las obligaciones legales de retencion de informacion.`,
  },
  {
    title: '6. Seguro y Seguridad',
    content: `RIDAA SUPREME proporciona cobertura de seguro durante cada viaje activo para proteger tanto al conductor como al pasajero en caso de accidente. Esta cobertura aplica unicamente cuando el viaje esta en curso o cuando te diriges a recoger a un pasajero. En caso de emergencia, utiliza el boton SOS disponible en la aplicacion para contactar inmediatamente a los servicios de emergencia y al equipo de soporte de RIDA SUPREME.`,
  },
  {
    title: '7. Calificacion y Revision',
    content: `Tanto conductores como pasajeros pueden calificarse mutuamente despues de cada viaje. Tu calificacion promedio afecta directamente la cantidad y calidad de viajes que recibes. Una calificacion promedio inferior a 4.5 puede resultar en una revision de tu cuenta y posibles medidas correctivas. Si consideras que una calificacion es injusta, puedes apelar a traves del soporte tecnico dentro de los 7 dias siguientes al viaje.`,
  },
];

export default function DriverTerms() {
  const router = useRouter();
  const [openSections, setOpenSections] = useState<Set<number>>(new Set([0]));

  const toggleSection = (index: number) => {
    setOpenSections(prev => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  return (
    <div className="min-h-screen bg-rida-dark">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-rida-dark/80 backdrop-blur-xl border-b border-white/5">
        <div className="flex items-center gap-3 p-4">
          <button onClick={() => router.back()} className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center">
            <ArrowLeft className="w-5 h-5 text-white" />
          </button>
          <h1 className="text-lg font-bold text-white">Terminos y Condiciones</h1>
        </div>
      </div>

      <div className="p-4 space-y-3">
        {/* Intro */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass rounded-2xl p-4 text-center"
        >
          <div className="w-14 h-14 rounded-full bg-purple-500/10 flex items-center justify-center mx-auto mb-3">
            <FileText className="w-7 h-7 text-purple-400" />
          </div>
          <h2 className="text-sm font-bold text-white">Condiciones para Conductores</h2>
          <p className="text-[11px] text-gray-500 mt-1">Ultima actualizacion: Abril 2025</p>
        </motion.div>

        {/* Sections */}
        {termsSections.map((section, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.03 }}
            className="glass rounded-xl overflow-hidden"
          >
            <button
              onClick={() => toggleSection(i)}
              className="w-full p-4 flex items-center gap-3 text-left"
            >
              <div className="flex-1">
                <h3 className="text-sm font-medium text-white">{section.title}</h3>
              </div>
              {openSections.has(i) ? (
                <ChevronUp className="w-4 h-4 text-gray-500" />
              ) : (
                <ChevronDown className="w-4 h-4 text-gray-500" />
              )}
            </button>
            {openSections.has(i) && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                className="px-4 pb-4"
              >
                <p className="text-xs text-gray-400 leading-relaxed">{section.content}</p>
              </motion.div>
            )}
          </motion.div>
        ))}

        {/* Acceptance Note */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="glass rounded-xl p-4 border border-cyan-500/20 mt-4"
        >
          <div className="flex items-start gap-3">
            <CheckCircle className="w-5 h-5 text-cyan-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-medium text-white">Aceptacion automatica</p>
              <p className="text-[11px] text-gray-500 mt-1">
                Al usar RIDA SUPREME como conductor, aceptas estos terminos y condiciones. Puedes consultar esta seccion en cualquier momento desde tu perfil.
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
