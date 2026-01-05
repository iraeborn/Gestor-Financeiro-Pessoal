
import React, { useState, useEffect, useRef } from 'react';
import { MessageSquare, Send, Paperclip, Mic, User, ArrowLeft, Loader2, Volume2, Clock, Circle } from 'lucide-react';
import { User as UserType, ChatMessage, Member } from '../types';
import { getFamilyMembers } from '../services/storageService';
import { Socket } from 'socket.io-client';

interface ChatViewProps {
    currentUser: UserType;
    socket: Socket | null;
}

const NOTIFICATION_SOUND = 'data:audio/mp3;base64,//uQxAAAAANIAAAAAExBTUUzLjEwMKqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq//uQxAAAAANIAAAAAExBTUUzLjEwMKqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq//uQxAAAAANIAAAAAExBTUUzLjEwMKqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq//uQxAAAAANIAAAAAExBTUUzLjEwMKqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq//uQxAAAAANIAAAAAExBTUUzLjEwMKqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq//uQxAAAAANIAAAAAExBTUUzLjEwMKqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq//uQxAAAAANIAAAAAExBTUUzLjEwMKqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq';

const ChatView: React.FC<ChatViewProps> = ({ currentUser, socket }) => {
    const [members, setMembers] = useState<Member[]>([]);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [selectedUser, setSelectedUser] = useState<Member | null>(null);
    const [input, setInput] = useState('');
    const [isListView, setIsListView] = useState(true);
    const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());
    
    const scrollRef = useRef<HTMLDivElement>(null);
    const audioRef = useRef<HTMLAudioElement>(new Audio(NOTIFICATION_SOUND));

    // Carrega membros e histórico apenas uma vez ou quando a família mudar
    useEffect(() => {
        getFamilyMembers().then(setMembers);
        
        const loadHistory = async () => {
            const token = localStorage.getItem('token');
            try {
                const r = await fetch(`/api/chat/history?familyId=${currentUser.familyId}`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (r.ok) {
                    const data = await r.json();
                    // Mescla com as mensagens que podem ter chegado via Socket enquanto o fetch ocorria
                    setMessages(prev => {
                        const existingIds = new Set(prev.map(m => m.id));
                        const newHistory = data.filter((m: any) => !existingIds.has(m.id));
                        return [...prev, ...newHistory].sort((a, b) => 
                            new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
                        );
                    });
                }
            } catch (e) {
                console.error("Erro ao carregar histórico:", e);
            }
        };

        loadHistory();
    }, [currentUser.familyId]);

    // Gerencia ouvintes do Socket
    useEffect(() => {
        if (!socket) return;

        const handleNewMessage = (msg: ChatMessage) => {
            console.log("📩 [CHAT] Nova mensagem recebida via Socket:", msg);
            setMessages(prev => {
                // Evita duplicidade
                if (prev.some(m => m.id === msg.id)) return prev;
                return [...prev, msg];
            });
            
            // Som de notificação se não for minha
            if (msg.senderId !== currentUser.id) {
                try {
                    audioRef.current.currentTime = 0;
                    audioRef.current.play().catch(() => {});
                } catch (e) {}
            }
        };

        const handleOnlineList = (userIds: string[]) => {
            setOnlineUsers(new Set(userIds));
        };

        const handleUserStatus = (data: { userId: string, status: 'ONLINE' | 'OFFLINE' }) => {
            setOnlineUsers(prev => {
                const next = new Set(prev);
                if (data.status === 'ONLINE') next.add(data.userId);
                else next.delete(data.userId);
                return next;
            });
        };

        socket.on('NEW_MESSAGE', handleNewMessage);
        socket.on('ONLINE_LIST', handleOnlineList);
        socket.on('USER_STATUS', handleUserStatus);
        
        // Solicita status atual
        socket.emit('REQUEST_ONLINE_USERS', currentUser.familyId);

        return () => {
            socket.off('NEW_MESSAGE', handleNewMessage);
            socket.off('ONLINE_LIST', handleOnlineList);
            socket.off('USER_STATUS', handleUserStatus);
        };
    }, [socket, currentUser.familyId, currentUser.id]);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages, isListView, selectedUser]);

    const handleSelectChat = (member: Member | null) => {
        setSelectedUser(member);
        setIsListView(false);
    };

    const handleSend = (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim() || !socket) return;
        
        const newMsg: Partial<ChatMessage> = {
            senderId: currentUser.id,
            senderName: currentUser.name,
            familyId: currentUser.familyId,
            content: input.trim(),
            type: 'TEXT',
            receiverId: selectedUser?.id || null 
        };
        
        socket.emit('SEND_MESSAGE', newMsg);
        setInput('');
    };

    const filteredMessages = messages.filter(m => {
        if (!selectedUser) {
            return !m.receiverId; // Canal Geral
        } else {
            // Conversa Privada (Eu mandei pra ele OU Ele mandou pra mim)
            return (m.senderId === currentUser.id && m.receiverId === selectedUser.id) ||
                   (m.senderId === selectedUser.id && m.receiverId === currentUser.id);
        }
    });

    return (
        <div className="flex h-[calc(100vh-140px)] bg-white rounded-[2rem] shadow-xl border border-gray-100 overflow-hidden relative">
            {/* Sidebar List */}
            <div className={`w-full md:w-80 border-r border-gray-50 flex flex-col bg-slate-50/50 absolute md:relative inset-0 z-20 transition-transform duration-300 ${isListView ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
                <div className="p-6 border-b border-gray-50 flex justify-between items-center bg-white/50 backdrop-blur-sm">
                    <h2 className="font-black text-xs uppercase tracking-widest text-indigo-600">Mensagens</h2>
                    <div className="flex items-center gap-1.5 bg-indigo-50 px-2 py-1 rounded-full">
                        <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse"></div>
                        <span className="text-[10px] font-black text-indigo-600 uppercase">{onlineUsers.size}</span>
                    </div>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-2">
                    <button 
                        onClick={() => handleSelectChat(null)}
                        className={`w-full flex items-center gap-4 p-4 rounded-2xl transition-all border ${selectedUser === null && !isListView ? 'bg-white border-indigo-200 shadow-md scale-[1.02]' : 'bg-transparent border-transparent hover:bg-gray-100'}`}
                    >
                        <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-indigo-600 to-indigo-700 flex items-center justify-center text-white shadow-lg shrink-0"><MessageSquare className="w-5 h-5"/></div>
                        <div className="text-left overflow-hidden">
                            <p className="font-bold text-gray-800 text-sm">Time Principal</p>
                            <p className="text-[10px] text-indigo-500 font-bold uppercase truncate">Geral da Organização</p>
                        </div>
                    </button>
                    
                    <div className="pt-6 pb-2 px-2"><p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Contatos</p></div>
                    
                    {members.filter(m => m.id !== currentUser.id).map(m => {
                        const isOnline = onlineUsers.has(m.id);
                        return (
                            <button 
                                key={m.id}
                                onClick={() => handleSelectChat(m)}
                                className={`w-full flex items-center gap-4 p-4 rounded-2xl transition-all border ${selectedUser?.id === m.id ? 'bg-white border-indigo-200 shadow-md scale-[1.02]' : 'bg-transparent border-transparent hover:bg-gray-100'}`}
                            >
                                <div className="relative shrink-0">
                                    <div className={`w-11 h-11 rounded-full bg-gradient-to-br ${isOnline ? 'from-emerald-400 to-emerald-600' : 'from-gray-200 to-gray-300'} flex items-center justify-center font-bold text-white shadow-sm`}>
                                        {m.name?.charAt(0).toUpperCase()}
                                    </div>
                                    <div className={`absolute bottom-0 right-0 w-3.5 h-3.5 border-2 border-slate-50 rounded-full shadow-sm ${isOnline ? 'bg-emerald-500' : 'bg-gray-400'}`}></div>
                                </div>
                                <div className="text-left truncate">
                                    <p className="font-bold text-gray-800 text-sm truncate">{m.name}</p>
                                    <p className={`text-[10px] font-black uppercase tracking-tight ${isOnline ? 'text-emerald-500' : 'text-gray-400'}`}>
                                        {isOnline ? 'Online' : 'Offline'}
                                    </p>
                                </div>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Chat Area */}
            <div className={`flex-1 flex flex-col absolute md:relative inset-0 z-30 bg-white transition-transform duration-300 ${!isListView ? 'translate-x-0' : 'translate-x-full md:translate-x-0'}`}>
                <div className="p-4 md:p-6 border-b border-gray-100 flex items-center justify-between shrink-0 bg-white/80 backdrop-blur-md">
                    <div className="flex items-center gap-3">
                        <button onClick={() => setIsListView(true)} className="md:hidden p-2 text-gray-400 hover:text-indigo-600"><ArrowLeft className="w-5 h-5"/></button>
                        <div className={`w-11 h-11 rounded-2xl flex items-center justify-center relative shadow-sm ${selectedUser ? 'bg-slate-100 text-slate-600' : 'bg-indigo-50 text-indigo-600'}`}>
                            {selectedUser ? <User className="w-5 h-5"/> : <MessageSquare className="w-5 h-5"/>}
                            {selectedUser && (
                                <div className={`absolute -top-1 -right-1 w-4 h-4 border-2 border-white rounded-full shadow-sm ${onlineUsers.has(selectedUser.id) ? 'bg-emerald-500' : 'bg-gray-400'}`}></div>
                            )}
                        </div>
                        <div>
                            <h3 className="font-black text-gray-800 tracking-tight">{selectedUser ? selectedUser.name : 'Time Principal'}</h3>
                            <p className="text-[10px] font-black uppercase tracking-tighter flex items-center gap-1">
                                {selectedUser 
                                    ? (onlineUsers.has(selectedUser.id) ? <span className="text-emerald-500">Online Agora</span> : <span className="text-gray-400">Offline</span>)
                                    : <span className="text-indigo-500">Chat Coletivo</span>
                                }
                            </p>
                        </div>
                    </div>
                    {!socket && <div className="flex items-center gap-1.5 bg-rose-50 px-3 py-1 rounded-full"><div className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-ping"></div><span className="text-[10px] text-rose-600 font-black">Reconectando...</span></div>}
                </div>

                <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 md:p-10 space-y-4 bg-slate-50/40 scroll-smooth">
                    {filteredMessages.length === 0 && (
                        <div className="flex flex-col items-center justify-center h-full text-gray-300">
                            <MessageSquare className="w-12 h-12 mb-2 opacity-20"/>
                            <p className="text-xs font-bold uppercase tracking-widest">Nenhuma mensagem ainda</p>
                        </div>
                    )}
                    {filteredMessages.map(msg => {
                        const isMine = msg.senderId === currentUser.id;
                        return (
                            <div key={msg.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'} animate-fade-in`}>
                                <div className={`flex flex-col ${isMine ? 'items-end' : 'items-start'} max-w-[85%] md:max-w-[70%]`}>
                                    {!isMine && <span className="text-[9px] font-black text-indigo-400 uppercase mb-1 ml-2 tracking-tighter">{msg.senderName}</span>}
                                    <div className={`p-4 rounded-[1.5rem] text-sm shadow-sm ${isMine ? 'bg-indigo-600 text-white rounded-tr-none' : 'bg-white text-gray-800 rounded-tl-none border border-gray-100'}`}>
                                        {msg.content}
                                    </div>
                                    <div className="flex items-center gap-1 mt-1 px-2">
                                        <Clock className="w-2.5 h-2.5 text-gray-300" />
                                        <span className="text-[8px] font-bold text-gray-300">{new Date(msg.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>

                <div className="p-4 md:p-6 bg-white border-t border-gray-100">
                    <form onSubmit={handleSend} className="flex items-center gap-2 md:gap-4 bg-gray-50 p-2 rounded-[2rem] border border-gray-100 focus-within:border-indigo-300 focus-within:ring-2 focus-within:ring-indigo-100 transition-all">
                        <button type="button" className="p-3 text-gray-400 hover:text-indigo-600 hover:bg-white rounded-full transition-all shrink-0"><Paperclip className="w-5 h-5"/></button>
                        <input 
                            type="text" 
                            value={input}
                            onChange={e => setInput(e.target.value)}
                            placeholder={selectedUser ? `Mensagem para ${selectedUser.name.split(' ')[0]}...` : "Mensagem para o grupo..."}
                            className="flex-1 bg-transparent border-none outline-none font-medium text-sm text-gray-700 px-2"
                        />
                        <button type="submit" disabled={!input.trim() || !socket} className="p-3 bg-indigo-600 text-white rounded-full hover:bg-indigo-700 shadow-lg disabled:opacity-50 transition-all active:scale-90">
                            <Send className="w-5 h-5"/>
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default ChatView;
