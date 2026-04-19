'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/authStore';
import { toast } from 'sonner';
import {
  Search, MessageCircle, Send, Loader2, Headphones,
  ArrowLeft, X, Clock, User, Phone, Mail
} from 'lucide-react';

interface SupportChatData {
  id: string;
  user_id: string;
  user_name: string;
  user_email: string;
  source: string;
  status: string;
  last_message: string;
  last_message_at: string;
  created_at: string;
}

interface ChatMessage {
  id: string;
  chat_id: string;
  sender_type: 'user' | 'admin';
  message: string;
  created_at: string;
}

const sourceConfig: Record<string, { color: string; bg: string; label: string }> = {
  cliente: { color: 'text-cyan-400', bg: 'bg-cyan-500/20', label: 'Cliente' },
  conductor: { color: 'text-blue-400', bg: 'bg-blue-500/20', label: 'Conductor' },
  courier: { color: 'text-orange-400', bg: 'bg-orange-500/20', label: 'Courier' },
  marketplace: { color: 'text-amber-400', bg: 'bg-amber-500/20', label: 'Marketplace' },
};

export default function AdminChatPage() {
  const { user: adminUser } = useAuthStore();
  const [chats, setChats] = useState<SupportChatData[]>([]);
  const [selectedChat, setSelectedChat] = useState<SupportChatData | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sendingReply, setSendingReply] = useState(false);
  const [search, setSearch] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const channelRef = useRef<any>(null);

  // Obtener todos los chats abiertos
  const fetchChats = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('support_chats')
        .select('*')
        .eq('status', 'open')
        .order('last_message_at', { ascending: false });

      if (error) throw error;
      setChats((data || []) as SupportChatData[]);
    } catch (err) {
      console.error('Error al cargar chats:', err);
      toast.error('Error al cargar chats');
    } finally {
      setLoading(false);
    }
  }, []);

  // Suscribirse a cambios en tiempo real para la lista de chats
  useEffect(() => {
    fetchChats();

    const channel = supabase
      .channel('admin-chats-list')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'support_chats' },
        () => { fetchChats(); }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'support_messages' },
        () => { fetchChats(); }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchChats]);

  // Cargar mensajes del chat seleccionado y suscribirse en tiempo real
  useEffect(() => {
    if (!selectedChat) {
      setMessages([]);
      return;
    }

    let mounted = true;

    const loadMessages = async () => {
      const { data, error } = await supabase
        .from('support_messages')
        .select('*')
        .eq('chat_id', selectedChat.id)
        .order('created_at', { ascending: true });

      if (error || !mounted) return;
      setMessages(data || []);
    };

    loadMessages();

    // Limpiar canal anterior
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
    }

    // Suscribirse a nuevos mensajes en este chat
    const channel = supabase
      .channel(`admin-chat-msgs-${selectedChat.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'support_messages',
          filter: `chat_id=eq.${selectedChat.id}`,
        },
        (payload) => {
          if (mounted) {
            setMessages((prev) => [...prev, payload.new as ChatMessage]);
          }
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      mounted = false;
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [selectedChat?.id]);

  // Auto-scroll al final cuando llegan nuevos mensajes
  useEffect(() => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  }, [messages]);

  // Enviar respuesta como admin
  const sendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedChat || sendingReply) return;

    setSendingReply(true);
    try {
      const msgText = newMessage.trim();
      const { error } = await supabase.from('support_messages').insert({
        chat_id: selectedChat.id,
        sender_type: 'admin',
        sender_id: adminUser?.id,
        message: msgText,
      });
      if (error) throw error;

      await supabase
        .from('support_chats')
        .update({
          last_message: `Admin: ${msgText}`,
          last_message_at: new Date().toISOString(),
        })
        .eq('id', selectedChat.id);

      setNewMessage('');
    } catch (err) {
      console.error('Error enviando respuesta:', err);
      toast.error('Error al enviar respuesta');
    } finally {
      setSendingReply(false);
    }
  };

  // Cerrar un chat
  const closeChat = async (chatId: string) => {
    try {
      const { error } = await supabase
        .from('support_chats')
        .update({ status: 'closed', updated_at: new Date().toISOString() })
        .eq('id', chatId);

      if (error) throw error;
      toast.success('Chat cerrado correctamente');
      setSelectedChat(null);
      fetchChats();
    } catch (err) {
      console.error('Error cerrando chat:', err);
      toast.error('Error al cerrar chat');
    }
  };

  // Filtrar chats por búsqueda
  const filteredChats = chats.filter(
    (chat) =>
      chat.user_name.toLowerCase().includes(search.toLowerCase()) ||
      chat.user_email.toLowerCase().includes(search.toLowerCase()) ||
      chat.source.toLowerCase().includes(search.toLowerCase()) ||
      (chat.last_message || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center">
            <MessageCircle className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Chat en Vivo</h1>
            <p className="text-sm text-gray-400">
              {chats.length} chat{chats.length !== 1 ? 's' : ''} activo
              {chats.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <span className="flex items-center gap-1.5 text-gray-400">
            <Mail className="w-4 h-4" />
            ridsoport@gmail.com
          </span>
        </div>
      </div>

      {/* Contenedor principal del chat */}
      <div
        className="glass rounded-2xl overflow-hidden"
        style={{ height: 'calc(100vh - 220px)', minHeight: '500px' }}
      >
        <div className="flex h-full">
          {/* Lista de chats */}
          <div
            className={`${
              selectedChat ? 'hidden md:flex' : 'flex'
            } flex-col w-full md:w-80 lg:w-96 border-r border-white/10`}
          >
            {/* Buscador */}
            <div className="p-3 border-b border-white/10">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input
                  type="text"
                  placeholder="Buscar chats..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white/5 border border-white/10 focus:border-cyan-500 text-white placeholder:text-gray-600 outline-none text-sm"
                />
              </div>
            </div>

            {/* Lista */}
            <div className="flex-1 overflow-y-auto">
              {loading ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
                </div>
              ) : filteredChats.length === 0 ? (
                <div className="text-center py-16 text-gray-500 px-4">
                  <MessageCircle className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p className="text-sm font-medium">Sin chats activos</p>
                  <p className="text-xs mt-1">
                    Los chats de clientes, conductores, couriers y vendedores apareceran aqui
                  </p>
                </div>
              ) : (
                filteredChats.map((chat) => {
                  const cfg = sourceConfig[chat.source] || sourceConfig.cliente;
                  const isSelected = selectedChat?.id === chat.id;

                  return (
                    <button
                      key={chat.id}
                      onClick={() => setSelectedChat(chat)}
                      className={`w-full flex items-center gap-3 p-4 hover:bg-white/5 transition-all border-b border-white/5 text-left ${
                        isSelected ? 'bg-cyan-500/10' : ''
                      }`}
                    >
                      <div
                        className={`w-10 h-10 rounded-full ${cfg.bg} flex items-center justify-center flex-shrink-0`}
                      >
                        <User className={`w-5 h-5 ${cfg.color}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-white truncate">
                            {chat.user_name || 'Usuario'}
                          </span>
                          <span
                            className={`text-[9px] px-1.5 py-0.5 rounded-md font-medium ${cfg.color} ${cfg.bg}`}
                          >
                            {cfg.label}
                          </span>
                        </div>
                        <p className="text-xs text-gray-500 truncate mt-0.5">
                          {chat.last_message || 'Sin mensajes'}
                        </p>
                        <p className="text-[10px] text-gray-600 mt-0.5">
                          {chat.user_email}
                        </p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        {chat.last_message_at && (
                          <p className="text-[10px] text-gray-600">
                            {new Date(chat.last_message_at).toLocaleDateString('es-CR', {
                              day: '2-digit',
                              month: 'short',
                            })}
                            {' '}
                            {new Date(chat.last_message_at).toLocaleTimeString('es-CR', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </p>
                        )}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Vista de conversación */}
          <div
            className={`${
              selectedChat ? 'flex' : 'hidden md:flex'
            } flex-col flex-1 min-w-0`}
          >
            {selectedChat ? (
              <>
                {/* Encabezado del chat */}
                <div className="p-4 border-b border-white/10 flex items-center gap-3 flex-shrink-0">
                  <button
                    onClick={() => setSelectedChat(null)}
                    className="md:hidden w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center"
                  >
                    <ArrowLeft className="w-5 h-5 text-white" />
                  </button>
                  <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0">
                    <User className="w-5 h-5 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-bold text-white truncate">
                      {selectedChat.user_name || 'Usuario'}
                    </h3>
                    <p className="text-[10px] text-gray-500 truncate">{selectedChat.user_email}</p>
                  </div>
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-md font-medium flex-shrink-0 ${
                      (sourceConfig[selectedChat.source] || sourceConfig.cliente).color
                    } ${
                      sourceConfig[selectedChat.source]?.bg || sourceConfig.cliente.bg
                    }`}
                  >
                    {(sourceConfig[selectedChat.source] || sourceConfig.cliente).label}
                  </span>
                  <button
                    onClick={() => closeChat(selectedChat.id)}
                    className="w-9 h-9 rounded-xl bg-red-500/10 flex items-center justify-center text-red-400 hover:bg-red-500/20 transition-all flex-shrink-0"
                    title="Cerrar chat"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Mensajes */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                  {messages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-center">
                      <MessageCircle className="w-12 h-12 text-gray-600 mb-3" />
                      <p className="text-sm text-gray-500">Sin mensajes aun</p>
                      <p className="text-xs text-gray-600 mt-1">
                        El usuario aun no ha enviado mensajes
                      </p>
                    </div>
                  ) : (
                    messages.map((msg) => {
                      const isAdmin = msg.sender_type === 'admin';
                      return (
                        <motion.div
                          key={msg.id}
                          initial={{ opacity: 0, y: 5 }}
                          animate={{ opacity: 1, y: 0 }}
                          className={`flex ${isAdmin ? 'justify-end' : 'justify-start'}`}
                        >
                          <div
                            className={`max-w-[75%] rounded-2xl px-4 py-2.5 ${
                              isAdmin
                                ? 'bg-gradient-to-r from-emerald-500 to-cyan-600 text-white rounded-br-md'
                                : 'bg-white/10 text-gray-200 rounded-bl-md'
                            }`}
                          >
                            <p className="text-sm leading-relaxed">{msg.message}</p>
                            <p
                              className={`text-[9px] mt-1 ${
                                isAdmin ? 'text-white/60' : 'text-gray-500'
                              }`}
                            >
                              {isAdmin ? 'Admin' : 'Usuario'} &middot;{' '}
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

                {/* Input de respuesta */}
                <div className="p-4 border-t border-white/10 flex-shrink-0">
                  <form onSubmit={sendReply} className="flex items-center gap-2">
                    <input
                      type="text"
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      placeholder="Escribe una respuesta..."
                      className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm placeholder:text-gray-600 focus:outline-none focus:border-cyan-500/50"
                      autoFocus
                    />
                    <button
                      type="submit"
                      disabled={!newMessage.trim() || sendingReply}
                      className="w-12 h-12 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 flex items-center justify-center text-white hover:opacity-90 disabled:opacity-50 transition-all flex-shrink-0"
                    >
                      {sendingReply ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : (
                        <Send className="w-5 h-5" />
                      )}
                    </button>
                  </form>
                </div>
              </>
            ) : (
              /* Estado vacío - no hay chat seleccionado */
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center px-8">
                  <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-4">
                    <Headphones className="w-10 h-10 text-gray-600" />
                  </div>
                  <p className="text-lg font-medium text-gray-400">Chat en Vivo RIDA</p>
                  <p className="text-sm text-gray-600 mt-2">
                    Selecciona un chat de la lista para responder
                  </p>
                  <p className="text-xs text-gray-600 mt-1">
                    Los mensajes de usuarios aparecen en tiempo real
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
