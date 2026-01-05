
import React, { useState, useEffect, useRef } from 'react';
import { MessageSquare, X, Send, User, ChevronUp, ChevronDown, Circle } from 'lucide-react';
import { User as UserType, ChatMessage } from '../types';
import { Socket } from 'socket.io-client';

const NOTIFICATION_SOUND = 'data:audio/mp3;base64,//uQxAAAAANIAAAAAExBTUUzLjEwMKqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq//uQxAAAAANIAAAAAExBTUUzLjEwMKqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq//uQxAAAAANIAAAAAExBTUUzLjEwMKqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq//uQxAAAAANIAAAAAExBTUUzLjEwMKqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq//uQxAAAAANIAAAAAExBTUUzLjEwMKqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq//uQxAAAAANIAAAAAExBTUUzLjEwMKqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq//uQxAAAAANIAAAAAExBTUUzLjEwMKqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq';

interface ChatFloatingProps {
    currentUser: UserType;
    socket: Socket | null;
}

const ChatFloating: React.FC<ChatFloatingProps> = ({ currentUser, socket }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [input, setInput] = useState('');
    const [unreadCount, setUnreadCount] = useState(0);
    const [onlineCount, setOnlineCount] = useState(0);
    
    const scrollRef = useRef<HTMLDivElement>(null);
    const audioRef = useRef<HTMLAudioElement>(new Audio(NOTIFICATION_SOUND));

    // Ref para rastrear se o modal está aberto (usado no listener de mensagens)
    const isOpenRef = useRef(isOpen);
    useEffect(() => { isOpenRef.current = isOpen; }, [isOpen]);

    // Carrega histórico e inicializa Socket
    useEffect(() => {
        if (!socket) return;

        const token = localStorage.getItem('token');
        fetch(`/api/chat/history?familyId=${currentUser.familyId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        })
        .then(r => r.ok ? r.json() : [])
        .then(data => setMessages(prev => {
            const existingIds = new Set(prev.map(m => m.id));
            const filtered = data.filter((m: any) => !existingIds.has(m.id));
            return [...prev, ...filtered].sort((a,b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
        }));

        const handleNewMessage = (msg: ChatMessage) => {
            setMessages(prev => {
                if (prev.some(m => m.id === msg.id)) return prev;
                return [...prev, msg];
            });
            
            // Gerencia notificações se o modal estiver fechado
            if (!isOpenRef.current && msg.senderId !== currentUser.id) {
                setUnreadCount(c => c + 1);
                try {
                    audioRef.current.currentTime = 0;
                    audioRef.current.play().catch(() => {});
                } catch (e) {}
            }
        };

        const handleOnlineList = (userIds: string[]) => {
            setOnlineCount(userIds.length);
        };

        socket.on('NEW_MESSAGE', handleNewMessage);
        socket.on('ONLINE_LIST', handleOnlineList);
        socket.on('USER_STATUS', () => socket.emit('REQUEST_ONLINE_USERS', currentUser.familyId));
        
        socket.emit('REQUEST_ONLINE_USERS', currentUser.familyId);

        return () => { 
            socket.off('NEW_MESSAGE', handleNewMessage);
            socket.off('ONLINE_LIST', handleOnlineList);
        };
    }, [socket, currentUser.familyId, currentUser.id]);

    useEffect(() => {
        if (scrollRef.current && isOpen) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages, isOpen]);

    const handleSend = (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim() || !socket) return;

        const newMsg: Partial<ChatMessage> = {
            senderId: currentUser.id,
            senderName: currentUser.name,
            familyId: currentUser.familyId,
            content: input.trim(),
            type: 'TEXT',
            receiverId: null
        };

        socket.emit('SEND_MESSAGE', newMsg);
        setInput('');
    };

    const toggleChat = () => {
        setIsOpen(!isOpen);
        if (!isOpen) setUnreadCount(0);
    };

    return (
        <div className="fixed bottom-6 right-6 z-[100] flex flex-col items-end gap-3 pointer-events-none sm:mb-0 mb-16">
            {isOpen && (
                <div className="w-[calc(100vw-48px)] sm:w-80 h-[450px] bg-white rounded-3xl shadow-2xl border border-gray-100 flex flex-col pointer-events-auto animate-slide-in-bottom overflow-hidden">
                    <div className="p-4 bg-indigo-600 text-white flex justify-between items-center shadow-lg shrink-0">
                        <div className="flex items-center gap-2">
                            <MessageSquare className="w-4 h-4" />
                            <div className="flex flex-col">
                                <span className="text-[10px] font-black uppercase tracking-widest leading-none">Chat Organização</span>
                                <span className="text-[8px] font-bold text-indigo-200 uppercase mt-0.5">{onlineCount} online</span>
                            </div>
                        </div>
                        <button onClick={toggleChat} className="p-1 hover:bg-white/10 rounded-lg transition-colors"><ChevronDown className="w-4 h-4"/></button>
                    </div>

                    <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/50 scrollbar-none">
                        {messages.filter(m => !m.receiverId).map(msg => (
                            <div key={msg.id} className={`flex flex-col ${msg.senderId === currentUser.id ? 'items-end' : 'items-start'} animate-fade-in`}>
                                {msg.senderId !== currentUser.id && <span className="text-[9px] font-black text-indigo-400 uppercase ml-1 mb-1 tracking-tighter">{msg.senderName}</span>}
                                <div className={`max-w-[85%] p-3 rounded-2xl text-xs shadow-sm ${msg.senderId === currentUser.id ? 'bg-indigo-600 text-white rounded-tr-none' : 'bg-white text-gray-800 rounded-tl-none border border-gray-100'}`}>
                                    {msg.content}
                                </div>
                                <span className="text-[8px] text-gray-300 mt-1 px-1">{new Date(msg.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                            </div>
                        ))}
                    </div>

                    <form onSubmit={handleSend} className="p-3 bg-white border-t border-gray-100 flex gap-2 shrink-0">
                        <input 
                            type="text" 
                            value={input}
                            onChange={e => setInput(e.target.value)}
                            placeholder="Mensagem coletiva..."
                            className="flex-1 bg-gray-50 border-none rounded-xl px-4 py-2 text-xs focus:ring-1 focus:ring-indigo-500 outline-none"
                        />
                        <button type="submit" className="p-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all active:scale-90"><Send className="w-4 h-4"/></button>
                    </form>
                </div>
            )}

            <button 
                onClick={toggleChat}
                className={`w-14 h-14 rounded-full flex items-center justify-center text-white shadow-2xl transition-all hover:scale-110 active:scale-95 pointer-events-auto relative ${isOpen ? 'bg-rose-500 rotate-90 shadow-rose-200' : 'bg-indigo-600 shadow-indigo-200'}`}
            >
                {isOpen ? <X className="w-6 h-6" /> : <MessageSquare className="w-6 h-6" />}
                {!isOpen && unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 bg-rose-500 text-white text-[10px] font-black w-6 h-6 rounded-full flex items-center justify-center border-2 border-white animate-bounce">
                        {unreadCount}
                    </span>
                )}
            </button>
        </div>
    );
};

export default ChatFloating;
