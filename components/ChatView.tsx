
import React, { useState, useEffect, useRef } from 'react';
import { MessageSquare, Send, Paperclip, Mic, X, User, Image as ImageIcon, File as FileIcon, Trash2, CheckCircle, Clock, Volume2, Play, Pause, Loader2 } from 'lucide-react';
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
    const [selectedUser, setSelectedUser] = useState<Member | null>(null); // NULL = Chat em Grupo
    const [input, setInput] = useState('');
    const [isRecording, setIsRecording] = useState(false);
    const [recordingTime, setRecordingTime] = useState(0);
    const [isUploading, setIsUploading] = useState(false);
    
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const chunksRef = useRef<Blob[]>([]);
    const scrollRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        getFamilyMembers().then(setMembers);
        
        // Puxa histórico completo
        fetch(`/api/chat/history?familyId=${currentUser.familyId}`)
            .then(r => r.json())
            .then(data => setMessages(data))
            .catch(console.error);

        if (socket) {
            const handleNewMessage = (msg: ChatMessage) => setMessages(prev => [...prev, msg]);
            socket.on('NEW_MESSAGE', handleNewMessage);
            return () => { socket.off('NEW_MESSAGE', handleNewMessage); };
        }
    }, [socket, currentUser.familyId]);

    useEffect(() => {
        if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }, [messages]);

    // Lógica de Gravação de Áudio
    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const recorder = new MediaRecorder(stream);
            mediaRecorderRef.current = recorder;
            chunksRef.current = [];
            
            recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
            recorder.onstop = async () => {
                const audioBlob = new Blob(chunksRef.current, { type: 'audio/webm' });
                await sendMultimodalMessage(audioBlob, 'AUDIO');
                stream.getTracks().forEach(t => t.stop());
            };

            recorder.start();
            setIsRecording(true);
            const timer = setInterval(() => setRecordingTime(prev => prev + 1), 1000);
            (recorder as any)._timer = timer;
        } catch (e) { console.error("Erro ao gravar áudio", e); }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
            clearInterval((mediaRecorderRef.current as any)._timer);
            setRecordingTime(0);
        }
    };

    const sendMultimodalMessage = async (blob: Blob | File, type: 'IMAGE' | 'AUDIO' | 'FILE') => {
        setIsUploading(true);
        try {
            const formData = new FormData();
            formData.append('files', blob);
            
            const res = await fetch('/api/upload', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` },
                body: formData
            });
            const { urls } = await res.json();
            
            if (urls && urls.length > 0) {
                const newMsg: Partial<ChatMessage> = {
                    senderId: currentUser.id,
                    senderName: currentUser.name,
                    familyId: currentUser.familyId,
                    content: type === 'AUDIO' ? 'Áudio enviado' : (type === 'IMAGE' ? 'Imagem enviada' : 'Arquivo enviado'),
                    type,
                    attachmentUrl: urls[0],
                    receiverId: selectedUser?.id
                };
                socket?.emit('SEND_MESSAGE', newMsg);
            }
        } finally { setIsUploading(false); }
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
            receiverId: selectedUser?.id
        };
        socket.emit('SEND_MESSAGE', newMsg);
        setInput('');
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const type = file.type.startsWith('image/') ? 'IMAGE' : 'FILE';
        sendMultimodalMessage(file, type);
    };

    // Filtra mensagens baseadas no canal selecionado
    const filteredMessages = messages.filter(m => {
        if (!selectedUser) return !m.receiverId; // Chat do Grupo
        return (m.senderId === currentUser.id && m.receiverId === selectedUser.id) ||
               (m.senderId === selectedUser.id && m.receiverId === currentUser.id);
    });

    return (
        <div className="flex h-[calc(100vh-140px)] bg-white rounded-[2.5rem] shadow-xl border border-gray-100 overflow-hidden animate-fade-in">
            {/* Sidebar de Usuários */}
            <div className="w-80 border-r border-gray-50 flex flex-col bg-slate-50/50">
                <div className="p-6 border-b border-gray-50 flex items-center justify-between">
                    <h2 className="font-black text-xs uppercase tracking-widest text-indigo-600">Comunicação Interna</h2>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-2">
                    <button 
                        onClick={() => setSelectedUser(null)}
                        className={`w-full flex items-center gap-4 p-4 rounded-2xl transition-all border ${!selectedUser ? 'bg-white border-indigo-200 shadow-md shadow-indigo-50' : 'bg-transparent border-transparent hover:bg-gray-100'}`}
                    >
                        <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-lg"><MessageSquare className="w-5 h-5"/></div>
                        <div className="text-left"><p className="font-bold text-gray-800 text-sm">Chat da Equipe</p><p className="text-[10px] text-indigo-500 font-bold uppercase tracking-tighter">Todos os membros</p></div>
                    </button>
                    
                    <div className="pt-4 pb-2 px-2"><p className="text-[9px] font-black text-gray-400 uppercase tracking-[0.2em]">Membros Online</p></div>
                    
                    {members.filter(m => m.id !== currentUser.id).map(m => (
                        <button 
                            key={m.id}
                            onClick={() => setSelectedUser(m)}
                            className={`w-full flex items-center gap-4 p-4 rounded-2xl transition-all border ${selectedUser?.id === m.id ? 'bg-white border-indigo-200 shadow-md shadow-indigo-50' : 'bg-transparent border-transparent hover:bg-gray-100'}`}
                        >
                            <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center font-bold text-gray-500 shadow-inner">{m.name?.charAt(0)}</div>
                            <div className="text-left"><p className="font-bold text-gray-800 text-sm">{m.name}</p><p className="text-[10px] text-gray-400 font-medium">Ver conversa direta</p></div>
                        </button>
                    ))}
                </div>
            </div>

            {/* Área de Mensagens */}
            <div className="flex-1 flex flex-col">
                {/* Header do Chat */}
                <div className="p-6 border-b border-gray-50 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${selectedUser ? 'bg-slate-100 text-slate-600' : 'bg-indigo-50 text-indigo-600'}`}>
                            {selectedUser ? <User className="w-6 h-6"/> : <MessageSquare className="w-6 h-6"/>}
                        </div>
                        <div>
                            <h3 className="font-black text-gray-800 tracking-tight">{selectedUser ? selectedUser.name : 'Equipe Principal'}</h3>
                            <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest flex items-center gap-1"><Clock className="w-3 h-3"/> Respostas em tempo real</p>
                        </div>
                    </div>
                </div>

                {/* Feed */}
                <div ref={scrollRef} className="flex-1 overflow-y-auto p-10 space-y-6 bg-slate-50/30 scroll-smooth">
                    {filteredMessages.map(msg => {
                        const isMine = msg.senderId === currentUser.id;
                        return (
                            <div key={msg.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                                <div className={`flex flex-col ${isMine ? 'items-end' : 'items-start'} max-w-[70%]`}>
                                    {!isMine && <span className="text-[10px] font-black text-gray-400 uppercase mb-2 ml-2 tracking-widest">{msg.senderName}</span>}
                                    <div className={`p-4 rounded-[2rem] text-sm shadow-sm relative group transition-all ${isMine ? 'bg-indigo-600 text-white rounded-tr-none shadow-indigo-100' : 'bg-white text-gray-800 rounded-tl-none border border-gray-100'}`}>
                                        {msg.type === 'TEXT' && msg.content}
                                        {msg.type === 'IMAGE' && (
                                            <div className="rounded-xl overflow-hidden cursor-pointer" onClick={() => window.open(msg.attachmentUrl)}>
                                                <img src={msg.attachmentUrl} className="max-w-full h-auto" alt="Anexo" />
                                            </div>
                                        )}
                                        {msg.type === 'AUDIO' && (
                                            <div className="flex items-center gap-3 min-w-[200px] py-1">
                                                <div className={`p-2 rounded-full ${isMine ? 'bg-white/20' : 'bg-indigo-50'}`}><Volume2 className="w-5 h-5"/></div>
                                                <audio controls src={msg.attachmentUrl} className="h-8 max-w-[150px]" />
                                            </div>
                                        )}
                                        {msg.type === 'FILE' && (
                                            <a href={msg.attachmentUrl} target="_blank" className="flex items-center gap-3 p-2 bg-black/5 rounded-xl">
                                                <FileIcon className="w-5 h-5"/>
                                                <span className="font-bold underline">Ver Documento</span>
                                            </a>
                                        )}
                                    </div>
                                    <span className="text-[9px] font-bold text-gray-300 mt-2 px-2">{new Date(msg.createdAt).toLocaleString('pt-BR', {hour: '2-digit', minute:'2-digit'})}</span>
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Footer Input */}
                <div className="p-6 bg-white border-t border-gray-50">
                    {isRecording ? (
                        <div className="flex items-center justify-between bg-rose-50 p-4 rounded-[2rem] border border-rose-100 animate-pulse">
                            <div className="flex items-center gap-4">
                                <div className="w-4 h-4 bg-rose-500 rounded-full animate-ping"></div>
                                <span className="font-black text-rose-600 text-xs uppercase tracking-widest">Gravando Áudio: {recordingTime}s</span>
                            </div>
                            <button onClick={stopRecording} className="px-6 py-2 bg-rose-600 text-white rounded-xl text-[10px] font-black uppercase">Enviar Áudio</button>
                        </div>
                    ) : (
                        <form onSubmit={handleSend} className="flex items-center gap-4 bg-gray-50 p-2 rounded-[2.5rem] border border-gray-100">
                            <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileSelect} />
                            <button type="button" onClick={() => fileInputRef.current?.click()} className="p-4 text-gray-400 hover:text-indigo-600 transition-colors"><Paperclip className="w-5 h-5"/></button>
                            <input 
                                type="text" 
                                value={input}
                                onChange={e => setInput(e.target.value)}
                                placeholder="Escreva sua mensagem aqui..."
                                className="flex-1 bg-transparent border-none outline-none font-medium text-sm text-gray-700 px-2"
                            />
                            <div className="flex gap-1 pr-1">
                                <button type="button" onMouseDown={startRecording} className="p-4 text-gray-400 hover:text-rose-500 transition-colors"><Mic className="w-5 h-5"/></button>
                                <button type="submit" disabled={!input.trim() || isUploading} className="p-4 bg-indigo-600 text-white rounded-full hover:bg-indigo-700 shadow-xl shadow-indigo-100 active:scale-95 disabled:opacity-50 transition-all">
                                    {isUploading ? <Loader2 className="w-5 h-5 animate-spin"/> : <Send className="w-5 h-5"/>}
                                </button>
                            </div>
                        </form>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ChatView;
