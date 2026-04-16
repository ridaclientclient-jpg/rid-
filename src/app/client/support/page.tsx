'use client';
import { motion } from 'framer-motion';
import { MessageCircle, Phone, Mail, ChevronRight, Shield, HelpCircle, FileText, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

export default function ClientSupport() {
  return (
    <div className="p-4 space-y-6">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-xl font-bold text-white">Soporte</h1>
        <p className="text-sm text-gray-400 mt-1">Estamos aqui para ayudarte 24/7</p>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="space-y-2">
        {[
          { icon: MessageCircle, label: 'Chat en vivo', desc: 'Respuesta inmediata', color: 'text-cyan-400 bg-cyan-500/20', action: () => toast.success('Conectando con soporte...') },
          { icon: Phone, label: 'Llamar', desc: '+506 2200-0000', color: 'text-emerald-400 bg-emerald-500/20', action: () => toast.info('Llamando...') },
          { icon: Mail, label: 'Email', desc: 'soporte@rida.com', color: 'text-blue-400 bg-blue-500/20', action: () => toast.info('Abriendo email...') },
        ].map((item, i) => (
          <button key={i} onClick={item.action} className="w-full glass rounded-xl p-4 flex items-center gap-3 hover:bg-white/5">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${item.color}`}>
              <item.icon className="w-5 h-5" />
            </div>
            <div className="flex-1 text-left">
              <p className="text-sm font-medium text-white">{item.label}</p>
              <p className="text-xs text-gray-500">{item.desc}</p>
            </div>
            <ChevronRight className="w-4 h-4 text-gray-600" />
          </button>
        ))}
      </motion.div>

      <div>
        <h3 className="text-sm font-semibold text-gray-400 mb-3">Preguntas Frecuentes</h3>
        <div className="space-y-2">
          {[
            { icon: HelpCircle, q: 'Como cambio mi destino durante un viaje?' },
            { icon: FileText, q: 'Como solicito un reembolso?' },
            { icon: Shield, q: 'Como funciona el boton SOS?' },
            { icon: AlertTriangle, q: 'Reportar un problema con el conductor' },
          ].map((item, i) => (
            <button key={i} onClick={() => toast.info(item.q)} className="w-full glass rounded-xl p-3 text-left hover:bg-white/5">
              <div className="flex items-center gap-2">
                <item.icon className="w-4 h-4 text-cyan-400" />
                <span className="text-sm text-gray-300">{item.q}</span>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
