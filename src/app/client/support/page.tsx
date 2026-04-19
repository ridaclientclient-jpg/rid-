'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { MessageCircle, Phone, Mail, ChevronRight, Shield, HelpCircle, FileText, AlertTriangle, Send, Loader2, ChevronDown, ChevronUp } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/authStore';
import { toast } from 'sonner';
import SupportChat from '@/components/SupportChat';

const faqs = [
  {
    q: 'Como cambio mi destino durante un viaje?',
    a: 'Una vez iniciado el viaje, no es posible cambiar el destino directamente desde la app. Puedes cancelar el viaje y crear uno nuevo con la direccion correcta, o contactar al conductor para que te lleve a un punto cercano.',
  },
  {
    q: 'Como solicito un reembolso?',
    a: 'Ve a tu historial de viajes, selecciona el viaje con el problema y usa la opcion "Reportar". Describe la situacion y nuestro equipo revisara tu caso para procesar el reembolso correspondiente dentro de 48 horas.',
  },
  {
    q: 'Como funciona el boton SOS?',
    a: 'El boton SOS esta disponible durante viajes activos. Al presionarlo, se notifica automaticamente a nuestro equipo de seguridad y se registran tus coordenadas de GPS. Las autoridades seran contactadas si es necesario.',
  },
  {
    q: 'Reportar un problema con el conductor',
    a: 'Puedes reportar un problema desde la pantalla del viaje activo usando el boton de reporte, o despues del viaje desde tu historial. Describe lo sucedido con el mayor detalle posible. Todos los reportes son revisados por nuestro equipo.',
  },
  {
    q: 'Como agrego un lugar frecuente?',
    a: 'En la pantalla de inicio, en la seccion "Lugares Frecuentes", toca el boton "Agregar". Elige un nombre e icono para tu lugar, busca la direccion y guardalo. Los lugares frecuentes aparecen automaticamente al pedir un viaje.',
  },
  {
    q: 'Mi viaje tarda mucho, que puedo hacer?',
    a: 'Puedes ver la ubicacion del conductor en tiempo real desde la pantalla del viaje. Si el conductor no llega en 10 minutos despues de la confirmacion, puedes cancelar sin penalidad o reportar la situacion a soporte.',
  },
];

export default function ClientSupport() {
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
        description: `[Soporte Cliente] ${subject}\n\n${message}`,
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
    <div className="p-4 space-y-4">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-xl font-bold text-white">Soporte</h1>
        <p className="text-sm text-gray-400 mt-1">Estamos aqui para ayudarte 24/7</p>
      </motion.div>

      {/* Quick Actions */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="grid grid-cols-3 gap-2">
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
        transition={{ delay: 0.1 }}
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
                  <ChevronUp className="w-3 h-3 text-gray-500 shrink-0" />
                ) : (
                  <ChevronDown className="w-3 h-3 text-gray-500 shrink-0" />
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
        transition={{ delay: 0.15 }}
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
            className="w-full bg-white/10 border border-white/15 rounded-xl px-4 py-3 text-white text-sm placeholder:text-gray-500 focus:outline-none focus:border-cyan-500/50"
          />
        </div>
        <div>
          <label className="text-xs text-gray-400 font-medium mb-1.5 block">Mensaje</label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Explica en detalle lo que sucedio..."
            rows={4}
            className="w-full bg-white/10 border border-white/15 rounded-xl px-4 py-3 text-white text-sm placeholder:text-gray-500 focus:outline-none focus:border-cyan-500/50 resize-none"
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

      {/* Chat en Vivo */}
      <SupportChat source="cliente" isOpen={chatOpen} onClose={() => setChatOpen(false)} />
    </div>
  );
}
