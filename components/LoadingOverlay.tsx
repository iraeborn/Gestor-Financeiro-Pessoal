
import React from 'react';
import { Loader2 } from 'lucide-react';

interface LoadingOverlayProps {
    isVisible: boolean;
    message?: string;
}

const LoadingOverlay: React.FC<LoadingOverlayProps> = ({ isVisible, message = "Processando informações..." }) => {
    if (!isVisible) return null;

    return (
        <div className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-white/40 backdrop-blur-[2px] animate-fade-in">
            <div className="bg-white p-8 rounded-[2rem] shadow-2xl border border-slate-100 flex flex-col items-center gap-4 scale-110">
                <div className="relative">
                    <div className="w-12 h-12 border-4 border-indigo-100 rounded-full"></div>
                    <Loader2 className="w-12 h-12 text-indigo-600 animate-spin absolute top-0 left-0" />
                </div>
                <div className="text-center">
                    <p className="text-slate-800 font-black text-sm uppercase tracking-widest">{message}</p>
                    <p className="text-slate-400 text-[10px] font-bold mt-1 uppercase">Sincronizando com a nuvem</p>
                </div>
            </div>
        </div>
    );
};

export default LoadingOverlay;
