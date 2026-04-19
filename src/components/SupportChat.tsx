'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/authStore';
import { ArrowLeft, Send, Loader2, MessageCircle, Headphones, Mail } from 'lucide-react';
import { toast } from 'sonner';

type SourceType = 'cliente' | 'conductor' | 'courier' | 'marketplace';

interface SupportChatProps {
  source: SourceType;
  isOpen: boolean;
  onClose: () => void;
}

interface ChatMessage {
  id: string;
  chat_id: string;
  sender_type: 'user' | 'admin';
  message: string;
  created_at: string;
}

export default function SupportChat({ source, isOpen, onClose }: SupportChatProps) {
  const { user } = useAuthStore();
  const [chatId, setChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const channelRef = useRef<any>(null);

  const scrollToBottom = useCallback(() => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  }, []);

  useEffect(() => {
    if (!isOpen || !user?.id) return;

    let mounted = true;

    const initChat = async () => {
      setLoading(true);
      try {
        // Buscar chat abierto existente del usuario para esta fuente
        const { data: existing, error: findErr } = await supabase
          .from('support_chats')
          .select('id')
          .eq('user_id', user?.id)
          .eq('source', source)
          .eq('status', 'open')
          .order('created_at', { ascending: false })
          .limit(1);

        if (findErr) throw findErr;

        let currentChatId: string;

        if (existing && existing.length > 0) {
          currentChatId = existing[0].id;
        } else {
          // Crear nuevo chat
          const { data: newChat, error: createErr } = await supabase
            .from('support_chats')
            .insert({
              user_id: user?.id,
              user_name: user?.name || 'Usuario',
              user_email: user?.email || '',
              source: source,
            })
            .select('id')
            .single();

          if (createErr) throw createErr;
          currentChatId = newChat.id;
        }

        if (!mounted) return;
        setChatId(currentChatId);

        // Cargar mensajes existentes
        const { data: msgs, error: msgErr } = await supabase
          .from('support_messages')
          .select('*')
          .eq('chat_id', currentChatId)
          .order('created_at', { ascending: true });

        if (msgErr) throw msgErr;
        if (!mounted) return;
        setMessages(msgs || []);

        // Suscribirse a nuevos mensajes en tiempo real
        const channel = supabase
          .channel(`support-chat-${currentChatId}`)
          .on('postgres_changes', {
            event: 'INSERT',
            schema: 'public',
            table: 'support_messages',
            filter: `chat_id=eq.${currentChatId}`,
          }, (payload) => {
            if (mounted) {
              setMessages(prev => [...prev, payload.new as ChatMessage]);
            }
          })
          .subscribe();

        channelRef.current = channel;
        scrollToBottom();
      } catch (err) {
        console.error('Error inicializando chat:', err);
        if (mounted) toast.error('Error al cargar el chat');
      } finally {
        if (mounted) setLoading(false);
      }
    };

    initChat();

    return () => {
      mounted = false;
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [isOpen, source, user?.id, scrollToBottom]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !chatId || sending) return;

    setSending(true);
    try {
      const msgText = newMessage.trim();
      const { error } = await supabase.from('support_messages').insert({
        chat_id: chatId,
        sender_type: 'user',
        sender_id: user?.id,
        message: msgText,
      });
      if (error) throw error;

      // Actualizar último mensaje en la sesión de chat
      await supabase.from('support_chats').update({
        last_message: msgText,
        last_message_at: new Date().toISOString(),
      }).eq('id', chatId);

      setNewMessage('');
    } catch (err) {
      console.error('Error enviando mensaje:', err);
      toast.error('Error al enviar mensaje');
    } finally {
      setSending(false);
    }
  };

  if (!isOpen) return null;

  const sourceLabel: Record<SourceType, string> = {
    cliente: 'Cliente',
    conductor: 'Conductor',
    courier: 'Courier',
    marketplace: 'Marketplace',
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-rida-dark flex flex-col"
      >
        {/* Header */}
        <div className="glass-strong border-b border-white/10 p-4 flex items-center gap-3 flex-shrink-0">
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center hover:bg-white/10 transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-white" />
          </button>
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center flex-shrink-0">
            <Headphones className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-sm font-bold text-white">Soporte RIDA</h2>
            <p className="text-[10px] text-emerald-400 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
              En linea
            </p>
          </div>
          <div className="text-right flex-shrink-0">
            <p className="text-[10px] text-gray-500">ridsoport@gmail.com</p>
            <p className="text-[9px] text-gray-600">{sourceLabel[source]}</p>
          </div>
        </div>

        {/* Mensajes */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center px-8">
              <div className="w-16 h-16 rounded-full bg-cyan-500/10 flex items-center justify-center mb-4">
                <MessageCircle className="w-8 h-8 text-cyan-400" />
              </div>
              <p className="text-sm font-medium text-gray-300">Chat con Soporte RIDA</p>
              <p className="text-xs text-gray-500 mt-2">
                Escribe tu mensaje y te responderemos lo antes posible.
              </p>
              <p className="text-xs text-gray-600 mt-1">
                Tambien puedes escribir a ridsoport@gmail.com
              </p>
            </div>
          ) : (
            messages.map((msg) => {
              const isUser = msg.sender_type === 'user';
              return (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[80%] rounded-2xl px-4 py-2.5 ${
                      isUser
                        ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-br-md'
                        : 'bg-white/10 text-gray-200 rounded-bl-md'
                    }`}
                  >
                    <p className="text-sm leading-relaxed">{msg.message}</p>
                    <p
                      className={`text-[9px] mt-1 ${
                        isUser ? 'text-white/60' : 'text-gray-500'
                      }`}
                    >
                      {new Date(msg.created_at).toLocaleTimeString('es-CR', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>
                </motion.div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="p-4 glass-strong border-t border-white/10 flex-shrink-0">
          <form onSubmit={sendMessage} className="flex items-center gap-2">
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Escribe tu mensaje..."
              className="flex-1 bg-white/10 border border-white/15 rounded-xl px-4 py-3 text-white text-sm placeholder:text-gray-500 focus:outline-none focus:border-cyan-500/50"
              autoFocus
            />
            <button
              type="submit"
              disabled={!newMessage.trim() || sending}
              className="w-12 h-12 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 flex items-center justify-center text-white hover:opacity-90 disabled:opacity-50 transition-all flex-shrink-0"
            >
              {sending ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Send className="w-5 h-5" />
              )}
            </button>
          </form>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
