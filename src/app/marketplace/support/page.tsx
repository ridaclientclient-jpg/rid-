'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/authStore';
import { toast } from 'sonner';
import SupportChat from '@/components/SupportChat';
import {
  MessageCircle, Phone, Mail, AlertTriangle,
  Send, Loader2, HelpCircle, ChevronDown, ChevronUp
} from 'lucide-react';

const faqs = [
  {
    q: 'Como agrego un nuevo producto?',
    a: 'Desde el menu lateral, ve a "Productos" y presiona el boton "Agregar Producto". Completa todos los campos incluyendo nombre, descripcion, precio, categoria y sube una foto del producto.',
  },
  {
    q: 'Como gestiono mis pedidos?',
    a: 'En la seccion "Pedidos" puedes ver todos los pedidos recibidos, pendientes, en proceso y completados. Puedes actualizar el estado de cada pedido manualmente.',
  },
  {
    q: 'Como importo productos por CSV?',
    a: 'Ve a "CSV Import" en el menu lateral. Descarga la plantilla de ejemplo, llena tus productos y sube el archivo. El sistema creara los productos automaticamente.',
  },
  {
    q: 'Como reclamo por un problema con un pedido?',
    a: 'Usa el formulario de "Reportar un Problema" abajo. Describe el asunto y el detalle del problema. El equipo de soporte revisara tu caso y te respondera en maximo 24 horas.',
  },
  {
    q: 'Puedo tener multiples tiendas?',
    a: 'Actualmente cada vendedor tiene una sola tienda asociada a su cuenta. Si necesitas gestionar multiples tiendas, contacta a soporte para evaluar tu caso.',
  },
  {
    q: 'Como cambio mi categoria de productos?',
    a: 'En "Categorias" puedes crear, editar y eliminar las categorias de tus productos. Los productos asociados se actualizaran automaticamente.',
  },
];

export default function MarketplaceSupport() {
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
        description: `[Soporte Marketplace] ${subject}\n\n${message}`,
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
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Soporte</h1>
        <p className="text-gray-400 mt-1">Estamos aqui para ayudarte 24/7</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <motion.button
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          onClick={() => toast.info('Llamada al soporte (proximamente)')}
          className="glass rounded-2xl p-5 flex items-center gap-4 hover:bg-white/5 transition-colors text-left"
        >
          <div className="w-12 h-12 rounded-xl bg-emerald-500/20 flex items-center justify-center">
            <Phone className="w-6 h-6 text-emerald-400" />
          </div>
          <div>
            <p className="text-sm font-semibold text-white">Llamar</p>
            <p className="text-xs text-gray-500">Respuesta inmediata</p>
          </div>
        </motion.button>
        <motion.button
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          onClick={() => setChatOpen(true)}
          className="glass rounded-2xl p-5 flex items-center gap-4 hover:bg-white/5 transition-colors text-left"
        >
          <div className="w-12 h-12 rounded-xl bg-blue-500/20 flex items-center justify-center">
            <MessageCircle className="w-6 h-6 text-blue-400" />
          </div>
          <div>
            <p className="text-sm font-semibold text-white">Chat en vivo</p>
            <p className="text-xs text-gray-500">Respuesta inmediata</p>
          </div>
        </motion.button>
        <motion.button
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          onClick={() => window.open('mailto:ridsoport@gmail.com', '_blank')}
          className="glass rounded-2xl p-5 flex items-center gap-4 hover:bg-white/5 transition-colors text-left"
        >
          <div className="w-12 h-12 rounded-xl bg-amber-500/20 flex items-center justify-center">
            <Mail className="w-6 h-6 text-amber-400" />
          </div>
          <div>
            <p className="text-sm font-semibold text-white">Email</p>
            <p className="text-xs text-gray-500">soporte@ridasupreme.com</p>
          </div>
        </motion.button>
      </div>

      {/* FAQ Section */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="glass rounded-2xl p-5"
      >
        <div className="flex items-center gap-2 mb-4">
          <HelpCircle className="w-5 h-5 text-cyan-400" />
          <h2 className="text-base font-semibold text-white">Preguntas Frecuentes</h2>
        </div>
        <div className="space-y-2">
          {faqs.map((faq, i) => (
            <div key={i} className="border border-white/5 rounded-xl overflow-hidden">
              <button
                onClick={() => setOpenFaq(openFaq === i ? null : i)}
                className="w-full p-3.5 flex items-center gap-3 text-left hover:bg-white/5 transition-colors"
              >
                <span className="flex-1 text-sm text-gray-300">{faq.q}</span>
                {openFaq === i ? (
                  <ChevronUp className="w-4 h-4 text-gray-500 shrink-0" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-gray-500 shrink-0" />
                )}
              </button>
              {openFaq === i && (
                <div className="px-3.5 pb-3.5">
                  <p className="text-sm text-gray-400 leading-relaxed">{faq.a}</p>
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
        transition={{ delay: 0.2 }}
        className="glass rounded-2xl p-5 space-y-4"
      >
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-amber-400" />
          <h2 className="text-base font-semibold text-white">Reportar un Problema</h2>
        </div>
        <div>
          <label className="text-sm text-gray-400 font-medium mb-1.5 block">Asunto</label>
          <input
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Describe tu problema brevemente"
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm placeholder:text-gray-600 focus:outline-none focus:border-cyan-500/50"
          />
        </div>
        <div>
          <label className="text-sm text-gray-400 font-medium mb-1.5 block">Mensaje</label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Explica en detalle lo que sucedio..."
            rows={5}
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm placeholder:text-gray-600 focus:outline-none focus:border-cyan-500/50 resize-none"
          />
        </div>
        <button
          onClick={handleSubmit}
          disabled={sending}
          className="w-full bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-semibold py-3.5 rounded-xl flex items-center justify-center gap-2 hover:opacity-90 disabled:opacity-50 text-sm"
        >
          {sending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
          {sending ? 'Enviando...' : 'Enviar Mensaje'}
        </button>
      </motion.div>

      {/* Chat en Vivo */}
      <SupportChat source="marketplace" isOpen={chatOpen} onClose={() => setChatOpen(false)} />
    </div>
  );
}
