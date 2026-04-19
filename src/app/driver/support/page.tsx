'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/authStore';
import { toast } from 'sonner';
import SupportChat from '@/components/SupportChat';
import {
  ArrowLeft, MessageCircle, Phone, Mail, AlertTriangle,
  Send, Loader2, HelpCircle, ChevronDown, ChevronUp, Headphones
} from 'lucide-react';

const faqs = [
  {
    q: 'Como inicio mi turno de conduccion?',
    a: 'Desde la pantalla de inicio, presiona el boton "Conectarse" para cambiar tu estado a en linea. Apareceras en el mapa y comenzaras a recibir solicitudes de viaje automaticamente.',
  },
  {
    q: 'Que hago si un pasajero no se presenta?',
    a: 'Espera al menos 5 minutos en el punto de recogida. Si el pasajero no aparece, puedes cancelar el viaje sin penalidad seleccionando "Pasajero no presente" como motivo.',
  },
  {
    q: 'Como reclamo por un viaje pagado incorrectamente?',
    a: 'Ve a tu historial de viajes, selecciona el viaje con el problema y usa la opcion de reportar. Nuestro equipo revisara el caso y realizara el ajuste correspondiente dentro de 48 horas.',
  },
  {
    q: 'Puedo rechazar solicitudes de viaje?',
    a: 'Si, puedes rechazar viajes sin penalidad siempre que no excedas 3 cancelaciones en 24 horas. Sin embargo, demasiados rechazos pueden afectar tu calificacion y la prioridad de asignacion.',
  },
  {
    q: 'Como actualizo mis documentos de verificacion?',
    a: 'Desde tu perfil, ve a la seccion "Documentos" donde podras subir fotos actualizadas de tu licencia, tarjeta de circulacion y cualquier otro documento requerido.',
  },
  {
    q: 'Que pasa si se me descarga el telefono durante un viaje?',
    a: 'La aplicacion intentara reconectar automaticamente. Si el viaje estaba en curso, el sistema mantendra el registro. Si no puedes reconectar, contacta a soporte inmediatamente para reportar la situacion.',
  },
];

export default function DriverSupport() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [sending, setSending] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [message, setMessage] = useState('');
  const [subject, setSubject] = useState('');
  const [chatOpen, setChatOpen] = useState(false);

  const handleSubmit = async () => {
    if (!subject.trim() || !message.trim()) {
      toast.error('Asunto y mensaje son obligatorios');
      return;
    }
    setSending(true);
    try {
      const { error } = await supabase.from('reports').insert({
        user_id: user?.id,
        type: 'complaint',
        description: `[Soporte Conductor] ${subject}\n\n${message}`,
      });
      if (error) throw error;
      toast.success('Mensaje enviado. Te responderemos pronto.');
      setSubject('');
      setMessage('');
    } catch (err) {
      console.error('Error sending support:', err);
      toast.error('Error al enviar mensaje');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="min-h-screen bg-rida-dark">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-rida-dark/80 backdrop-blur-xl border-b border-white/5">
        <div className="flex items-center gap-3 p-4">
          <button onClick={() => router.back()} className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center">
            <ArrowLeft className="w-5 h-5 text-white" />
          </button>
          <h1 className="text-lg font-bold text-white">Soporte</h1>
          <Headphones className="w-5 h-5 text-cyan-400 ml-auto" />
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Quick Actions */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid grid-cols-3 gap-2"
        >
          <button
            onClick={() => toast.info('Llamada al soporte (proximamente)')}
            className="glass rounded-xl p-3 flex flex-col items-center gap-2 hover:bg-white/5 transition-colors"
          >
            <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center">
              <Phone className="w-5 h-5 text-emerald-400" />
            </div>
            <span className="text-[10px] text-gray-400">Llamar</span>
          </button>
          <button
            onClick={() => setChatOpen(true)}
            className="glass rounded-xl p-3 flex flex-col items-center gap-2 hover:bg-white/5 transition-colors"
          >
            <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center">
              <MessageCircle className="w-5 h-5 text-blue-400" />
            </div>
            <span className="text-[10px] text-gray-400">Chat</span>
          </button>
          <button
            onClick={() => window.open('mailto:ridsoport@gmail.com', '_blank')}
            className="glass rounded-xl p-3 flex flex-col items-center gap-2 hover:bg-white/5 transition-colors"
          >
            <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center">
              <Mail className="w-5 h-5 text-amber-400" />
            </div>
            <span className="text-[10px] text-gray-400">Email</span>
          </button>
        </motion.div>

        {/* FAQ Section */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="glass rounded-2xl p-4"
        >
          <div className="flex items-center gap-2 mb-3">
            <HelpCircle className="w-4 h-4 text-cyan-400" />
            <h2 className="text-sm font-semibold text-white">Preguntas Frecuentes</h2>
          </div>
          <div className="space-y-2">
            {faqs.map((faq, i) => (
              <div key={i} className="border border-white/5 rounded-xl overflow-hidden">
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full p-3 flex items-center gap-2 text-left"
                >
                  <span className="flex-1 text-xs text-gray-300">{faq.q}</span>
                  {openFaq === i ? (
                    <ChevronUp className="w-3 h-3 text-gray-500 flex-shrink-0" />
                  ) : (
                    <ChevronDown className="w-3 h-3 text-gray-500 flex-shrink-0" />
                  )}
                </button>
                {openFaq === i && (
                  <div className="px-3 pb-3">
                    <p className="text-[11px] text-gray-400 leading-relaxed">{faq.a}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </motion.div>

        {/* Contact Form */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="glass rounded-2xl p-4 space-y-3"
        >
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle className="w-4 h-4 text-amber-400" />
            <h2 className="text-sm font-semibold text-white">Reportar un Problema</h2>
          </div>
          <div>
            <label className="text-xs text-gray-400 font-medium mb-1.5 block">Asunto</label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Describe tu problema brevemente"
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-cyan-500/50"
            />
          </div>
          <div>
            <label className="text-xs text-gray-400 font-medium mb-1.5 block">Mensaje</label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Explica en detalle lo que sucedio..."
              rows={4}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-cyan-500/50 resize-none"
            />
          </div>
          <button
            onClick={handleSubmit}
            disabled={sending}
            className="w-full bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-semibold py-3 rounded-xl flex items-center justify-center gap-2 hover:opacity-90 disabled:opacity-50"
          >
            {sending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
            {sending ? 'Enviando...' : 'Enviar Mensaje'}
          </button>
        </motion.div>
      </div>

      {/* Chat en Vivo */}
      <SupportChat source="conductor" isOpen={chatOpen} onClose={() => setChatOpen(false)} />
    </div>
  );
}
