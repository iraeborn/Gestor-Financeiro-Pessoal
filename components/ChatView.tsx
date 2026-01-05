
import React, { useState, useEffect, useRef } from 'react';
import { MessageSquare, Send, Paperclip, Mic, User, ArrowLeft, Loader2, Volume2, Clock } from 'lucide-react';
import { User as UserType, ChatMessage, Member } from '../types';
import { getFamilyMembers } from '../services/storageService';
import { Socket } from 'socket.io-client';

interface ChatViewProps {
    currentUser: UserType;
    socket: Socket | null;
}

const ChatView: React.FC<ChatViewProps> = ({ currentUser, socket }) => {
    const [members, setMembers] = useState<Member[]>([]);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [selectedUser, setSelectedUser] = useState<Member | null>(null);
    const [input, setInput] = useState('');
    const [isListView, setIsListView] = useState(true);
    const [isUploading, setIsUploading] = useState(false);
    
    const scrollRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        getFamilyMembers().then(setMembers);
        
        fetch(`/api/chat/history?familyId=${currentUser.familyId}`)
            .then(r => r.json())
            .then(data => setMessages(data))
            .catch(console.error);

        if (socket) {
            const handleNewMessage = (msg: ChatMessage) => {
                setMessages(prev => {
                    if (prev.find(m => m.id === msg.id)) return prev;
                    return [...prev, msg];
                });
            };
            socket.on('NEW_MESSAGE', handleNewMessage);
            return () => { socket.off('NEW_MESSAGE', handleNewMessage); };
        }
    }, [socket, currentUser.familyId]);

    useEffect(() => {
        if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
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
            receiverId: selectedUser?.id // undefined se selectedUser for null
        };
        
        socket.emit('SEND_MESSAGE', newMsg);
        setInput('');
    };

    const filteredMessages = messages.filter(m => {
        if (!selectedUser) return !m.receiverId; 
        return (m.senderId === currentUser.id && m.receiverId === selectedUser.id) ||
               (m.senderId === selectedUser.id && m.receiverId === currentUser.id);
    });

    return (
        <div className="flex h-[calc(100vh-140px)] bg-white rounded-[2rem] shadow-xl border border-gray-100 overflow-hidden relative">
            {/* Sidebar Mobile Responsive */}
            <div className={`w-full md:w-80 border-r border-gray-50 flex flex-col bg-slate-50/50 absolute md:relative inset-0 z-20 transition-transform duration-300 ${isListView ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
                <div className="p-6 border-b border-gray-50">
                    <h2 className="font-black text-xs uppercase tracking-widest text-indigo-600">Mensagens</h2>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-2">
                    <button 
                        onClick={() => handleSelectChat(null)}
                        className={`w-full flex items-center gap-4 p-4 rounded-2xl transition-all border ${selectedUser === null && !isListView ? 'bg-white border-indigo-200 shadow-md' : 'bg-transparent border-transparent hover:bg-gray-100'}`}
                    >
                        <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-lg shrink-0"><MessageSquare className="w-5 h-5"/></div>
                        <div className="text-left"><p className="font-bold text-gray-800 text-sm">Time Principal</p><p className="text-[10px] text-indigo-500 font-bold uppercase">Grupo</p></div>
                    </button>
                    
                    <div className="pt-4 pb-2 px-2"><p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Colaboradores</p></div>
                    
                    {members.filter(m => m.id !== currentUser.id).map(m => (
                        <button 
                            key={m.id}
                            onClick={() => handleSelectChat(m)}
                            className={`w-full flex items-center gap-4 p-4 rounded-2xl transition-all border ${selectedUser?.id === m.id ? 'bg-white border-indigo-200 shadow-md' : 'bg-transparent border-transparent hover:bg-gray-100'}`}
                        >
                            <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center font-bold text-gray-500 shrink-0">{m.name?.charAt(0)}</div>
                            <div className="text-left truncate"><p className="font-bold text-gray-800 text-sm truncate">{m.name}</p></div>
                        </button>
                    ))}
                </div>
            </div>

            {/* Chat Area */}
            <div className={`flex-1 flex flex-col absolute md:relative inset-0 z-30 bg-white transition-transform duration-300 ${!isListView ? 'translate-x-0' : 'translate-x-full md:translate-x-0'}`}>
                <div className="p-4 md:p-6 border-b border-gray-100 flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-3">
                        <button onClick={() => setIsListView(true)} className="md:hidden p-2 text-gray-400 hover:text-indigo-600"><ArrowLeft className="w-5 h-5"/></button>
                        <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${selectedUser ? 'bg-slate-100 text-slate-600' : 'bg-indigo-50 text-indigo-600'}`}>
                            {selectedUser ? <User className="w-5 h-5"/> : <MessageSquare className="w-5 h-5"/>}
                        </div>
                        <h3 className="font-black text-gray-800 tracking-tight">{selectedUser ? selectedUser.name : 'Time Principal'}</h3>
                    </div>
                    {!socket && <span className="text-[10px] text-rose-500 font-bold uppercase animate-pulse">Desconectado</span>}
                </div>

                <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 md:p-10 space-y-4 bg-slate-50/30 scroll-smooth">
                    {filteredMessages.map(msg => {
                        const isMine = msg.senderId === currentUser.id;
                        return (
                            <div key={msg.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                                <div className={`flex flex-col ${isMine ? 'items-end' : 'items-start'} max-w-[85%] md:max-w-[70%]`}>
                                    {!isMine && <span className="text-[10px] font-black text-gray-400 uppercase mb-1 ml-2">{msg.senderName}</span>}
                                    <div className={`p-4 rounded-[1.5rem] text-sm shadow-sm ${isMine ? 'bg-indigo-600 text-white rounded-tr-none' : 'bg-white text-gray-800 rounded-tl-none border border-gray-100'}`}>
                                        {msg.content}
                                    </div>
                                    <span className="text-[9px] font-bold text-gray-300 mt-1 px-2">{new Date(msg.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                                </div>
                            </div>
                        );
                    })}
                </div>

                <div className="p-4 md:p-6 bg-white border-t border-gray-100">
                    <form onSubmit={handleSend} className="flex items-center gap-2 md:gap-4 bg-gray-50 p-2 rounded-[2rem] border border-gray-100">
                        <input type="file" ref={fileInputRef} className="hidden" />
                        <button type="button" onClick={() => fileInputRef.current?.click()} className="p-3 text-gray-400 hover:text-indigo-600 shrink-0"><Paperclip className="w-5 h-5"/></button>
                        <input 
                            type="text" 
                            value={input}
                            onChange={e => setInput(e.target.value)}
                            placeholder={socket ? "Escreva sua mensagem..." : "Conectando ao servidor..."}
                            disabled={!socket}
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
