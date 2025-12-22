
import React from 'react';
import { X, Bell, ShoppingBag, ArrowRight, CheckCircle, Clock } from 'lucide-react';
import { AppNotification } from '../types';

interface NotificationPanelProps {
    isOpen: boolean;
    onClose: () => void;
    notifications: AppNotification[];
    onAction: (notification: AppNotification) => void;
    onMarkAsRead: (id: string) => void;
}

const NotificationPanel: React.FC<NotificationPanelProps> = ({ isOpen, onClose, notifications, onAction, onMarkAsRead }) => {
    if (!isOpen) return null;

    const unreadCount = notifications.filter(n => !n.isRead).length;

    const formatTime = (isoString: string) => {
        const date = new Date(isoString);
        return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    };

    return (
        <div className="fixed inset-y-0 right-0 w-80 bg-white shadow-2xl z-[60] border-l border-gray-100 flex flex-col animate-slide-in-right">
            <div className="p-6 border-b border-gray-50 flex items-center justify-between bg-gray-50/50">
                <div className="flex items-center gap-3">
                    <div className="relative">
                        <Bell className="w-5 h-5 text-indigo-600" />
                        {unreadCount > 0 && (
                            <span className="absolute -top-1 -right-1 w-4 h-4 bg-rose-500 text-white text-[10px] font-black rounded-full flex items-center justify-center">
                                {unreadCount}
                            </span>
                        )}
                    </div>
                    <h2 className="font-bold text-gray-800">Notificações</h2>
                </div>
                <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full transition-colors">
                    <X className="w-4 h-4 text-gray-400" />
                </button>
            </div>

            <div className="flex-1 overflow-y-auto scrollbar-thin">
                {notifications.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full p-8 text-center">
                        <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4">
                            <Bell className="w-8 h-8 text-gray-200" />
                        </div>
                        <p className="text-sm text-gray-400 font-medium">Tudo em ordem!</p>
                        <p className="text-xs text-gray-400 mt-1">Você não possui notificações pendentes.</p>
                    </div>
                ) : (
                    <div className="divide-y divide-gray-50">
                        {notifications.sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).map(notif => (
                            <div 
                                key={notif.id} 
                                className={`p-5 transition-colors hover:bg-gray-50 group cursor-pointer ${!notif.isRead ? 'bg-indigo-50/30' : ''}`}
                                onClick={() => onMarkAsRead(notif.id)}
                            >
                                <div className="flex gap-4">
                                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${notif.type === 'SUCCESS' ? 'bg-emerald-100 text-emerald-600' : 'bg-indigo-100 text-indigo-600'}`}>
                                        {notif.entity === 'order' ? <ShoppingBag className="w-5 h-5" /> : <Bell className="w-5 h-5" />}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex justify-between items-start mb-1">
                                            <p className="text-xs font-black text-gray-400 uppercase tracking-widest">{notif.title}</p>
                                            <span className="text-[10px] text-gray-400 font-medium flex items-center gap-1">
                                                <Clock className="w-3 h-3" /> {formatTime(notif.timestamp)}
                                            </span>
                                        </div>
                                        <p className="text-sm font-bold text-gray-800 leading-snug">{notif.message}</p>
                                        
                                        {notif.entity === 'order' && (
                                            <button 
                                                onClick={(e) => { e.stopPropagation(); onAction(notif); }}
                                                className="mt-4 w-full flex items-center justify-center gap-2 py-2.5 bg-indigo-600 text-white text-[11px] font-black uppercase tracking-wider rounded-lg shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all"
                                            >
                                                Processar Agora <ArrowRight className="w-3 h-3" />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
            
            {notifications.length > 0 && (
                <div className="p-4 border-t border-gray-50 bg-gray-50/50">
                    <button 
                        onClick={() => notifications.forEach(n => onMarkAsRead(n.id))}
                        className="w-full text-center text-[10px] font-black text-gray-400 uppercase tracking-widest hover:text-indigo-600 transition-colors"
                    >
                        Marcar todas como lidas
                    </button>
                </div>
            )}
        </div>
    );
};

export default NotificationPanel;
