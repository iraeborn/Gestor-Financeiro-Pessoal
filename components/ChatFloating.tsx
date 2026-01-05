
import React, { useState, useEffect, useRef } from 'react';
import { MessageSquare, X, Send, User, ChevronUp, ChevronDown } from 'lucide-react';
import { User as UserType, ChatMessage } from '../types';
import { Socket } from 'socket.io-client';

interface ChatFloatingProps {
    currentUser: UserType;
    socket: Socket | null;
}

const ChatFloating: React.FC<ChatFloatingProps> = ({ currentUser, socket }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [input, setInput] = useState('');
    const [unreadCount, setUnreadCount] = useState(0);
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (socket) {
            // Puxa histórico inicial resumido
            fetch(`/api/chat/history?familyId=${currentUser.familyId}`)
                .then(r => r.json())
                .then(data => setMessages(data))
                .catch(console.error);

            const handleNewMessage = (msg: ChatMessage) => {
                setMessages(prev => [...prev, msg]);
                if (!isOpen) setUnreadCount(c => c + 1);
            };

            socket.on('NEW_MESSAGE', handleNewMessage);
            return () => { socket.off('NEW_MESSAGE', handleNewMessage); };
        }
    }, [socket, currentUser.familyId, isOpen]);

    useEffect(() => {
        if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }, [messages, isOpen]);

    const handleSend = (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim() || !socket) return;

        const newMsg: Partial<ChatMessage> = {
            senderId: currentUser.id,
            senderName: currentUser.name,
            familyId: currentUser.familyId,
            content: input.trim(),
            type: 'TEXT'
        };

        socket.emit('SEND_MESSAGE', newMsg);
        setInput('');
    };

    const toggleChat = () => {
        setIsOpen(!isOpen);
        if (!isOpen) setUnreadCount(0);
    };

    return (
        <div className="fixed bottom-6 right-6 z-[100] flex flex-col items-end gap-3 pointer-events-none">
            {isOpen && (
                <div className="w-80 h-[450px] bg-white rounded-3xl shadow-2xl border border-gray-100 flex flex-col pointer-events-auto animate-slide-in-bottom overflow-hidden">
                    {/* Header */}
                    <div className="p-4 bg-indigo-600 text-white flex justify-between items-center shadow-lg">
                        <div className="flex items-center gap-2">
                            <MessageSquare className="w-4 h-4" />
                            <span className="text-xs font-bold uppercase tracking-widest">Chat da Equipe</span>
                        </div>
                        <button onClick={toggleChat} className="p-1 hover:bg-white/10 rounded-lg transition-colors"><ChevronDown className="w-4 h-4"/></button>
                    </div>

                    {/* Messages Area */}
                    <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50 scrollbar-none">
                        {messages.map(msg => (
                            <div key={msg.id} className={`flex flex-col ${msg.senderId === currentUser.id ? 'items-end' : 'items-start'}`}>
                                {msg.senderId !== currentUser.id && <span className="text-[9px] font-black text-gray-400 uppercase ml-1 mb-1">{msg.senderName}</span>}
                                <div className={`max-w-[85%] p-3 rounded-2xl text-xs shadow-sm ${msg.senderId === currentUser.id ? 'bg-indigo-600 text-white rounded-tr-none' : 'bg-white text-gray-800 rounded-tl-none border border-gray-100'}`}>
                                    {msg.content}
                                </div>
                                <span className="text-[8px] text-gray-300 mt-1">{new Date(msg.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                            </div>
                        ))}
                    </div>

                    {/* Input Area */}
                    <form onSubmit={handleSend} className="p-3 bg-white border-t border-gray-100 flex gap-2">
                        <input 
                            type="text" 
                            value={input}
                            onChange={e => setInput(e.target.value)}
                            placeholder="Mensagem..."
                            className="flex-1 bg-gray-50 border-none rounded-xl px-4 py-2 text-xs focus:ring-1 focus:ring-indigo-500 outline-none"
                        />
                        <button type="submit" className="p-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-100"><Send className="w-4 h-4"/></button>
                    </form>
                </div>
            )}

            {/* Floating Toggle Button */}
            <button 
                onClick={toggleChat}
                className={`w-14 h-14 rounded-full flex items-center justify-center text-white shadow-2xl transition-all hover:scale-110 active:scale-95 pointer-events-auto relative ${isOpen ? 'bg-rose-500 rotate-90' : 'bg-indigo-600'}`}
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
