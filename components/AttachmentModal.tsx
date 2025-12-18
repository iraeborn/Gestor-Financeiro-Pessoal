
import React, { useRef, useState } from 'react';
import { X, FilePlus, Trash2, Download, Eye, FileText, Loader2, CloudUpload } from 'lucide-react';
import { useAlert } from './AlertSystem';

interface AttachmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  urls: string[];
  onAdd: (files: FileList) => Promise<void>; // Agora é uma Promise
  onRemove: (index: number) => void;
  title?: string;
}

const AttachmentModal: React.FC<AttachmentModalProps> = ({ isOpen, onClose, urls, onAdd, onRemove, title }) => {
  const { showAlert } = useAlert();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);

  if (!isOpen) return null;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setIsUploading(true);
      try {
        await onAdd(e.target.files);
      } catch (err) {
        showAlert("Erro ao subir arquivos para a nuvem.", "error");
      } finally {
        setIsUploading(false);
      }
    }
  };

  const handleDownload = (url: string, index: number) => {
      const link = document.createElement('a');
      link.href = url;
      link.target = '_blank';
      link.download = `anexo-${index + 1}-${title?.replace(/\s+/g, '-').toLowerCase() || 'comprovante'}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[70] flex items-center justify-center p-4">
      <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-lg overflow-hidden animate-scale-up border border-slate-100 flex flex-col max-h-[85vh]">
        
        {/* Header */}
        <div className="px-8 py-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
            <div>
                <h2 className="text-lg font-black text-slate-800">{title || 'Comprovantes e Anexos'}</h2>
                <p className="text-[10px] text-slate-400 uppercase font-bold tracking-widest mt-1">
                    {isUploading ? 'Sincronizando com a Nuvem...' : `Total: ${urls.length} arquivo(s)`}
                </p>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-white rounded-full transition-all text-slate-400">
                <X className="w-5 h-5" />
            </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-8 space-y-4">
            {urls.length === 0 && !isUploading ? (
                <div className="py-12 text-center">
                    <CloudUpload className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                    <p className="text-slate-500 font-medium">Nenhum anexo encontrado.</p>
                    <p className="text-xs text-slate-400 mt-1">Sua movimentação será salva no Google Cloud Storage.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 gap-3">
                    {urls.map((url, idx) => {
                        const isImage = url.includes('image') || url.startsWith('blob:') || url.match(/\.(jpg|jpeg|png|gif|webp)$/i);
                        return (
                            <div key={idx} className="group flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-2xl hover:border-indigo-200 transition-all">
                                <div className="flex items-center gap-4 overflow-hidden">
                                    <div className="w-12 h-12 rounded-xl bg-white border border-slate-100 flex items-center justify-center overflow-hidden shrink-0">
                                        {isImage ? (
                                            <img src={url} alt="Preview" className="w-full h-full object-cover" />
                                        ) : (
                                            <FileText className="w-6 h-6 text-indigo-500" />
                                        )}
                                    </div>
                                    <div className="overflow-hidden">
                                        <p className="text-sm font-bold text-slate-700 truncate">Arquivo #{idx + 1}</p>
                                        <p className="text-[10px] text-indigo-500 uppercase font-black tracking-tighter">Google Cloud Storage</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <a href={url} target="_blank" rel="noreferrer" className="p-2 text-indigo-600 hover:bg-white rounded-xl transition-colors" title="Visualizar">
                                        <Eye className="w-4 h-4" />
                                    </a>
                                    <button onClick={() => handleDownload(url, idx)} className="p-2 text-emerald-600 hover:bg-white rounded-xl transition-colors" title="Baixar">
                                        <Download className="w-4 h-4" />
                                    </button>
                                    <button onClick={() => onRemove(idx)} className="p-2 text-rose-500 hover:bg-white rounded-xl transition-colors" title="Remover">
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                    {isUploading && (
                        <div className="flex items-center justify-center gap-3 p-4 bg-indigo-50 border border-indigo-100 rounded-2xl animate-pulse">
                            <Loader2 className="w-5 h-5 text-indigo-600 animate-spin" />
                            <span className="text-xs font-bold text-indigo-700 uppercase">Enviando arquivos...</span>
                        </div>
                    )}
                </div>
            )}
        </div>

        {/* Footer */}
        <div className="p-8 border-t border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row gap-4">
            <input 
                type="file" 
                multiple 
                className="hidden" 
                ref={fileInputRef} 
                onChange={handleFileChange}
                accept="image/*,application/pdf"
            />
            <button 
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="flex-1 flex items-center justify-center gap-2 py-4 bg-white border-2 border-indigo-600 text-indigo-600 rounded-2xl font-black text-sm hover:bg-indigo-50 transition-all shadow-sm disabled:opacity-50"
            >
                {isUploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <FilePlus className="w-5 h-5" />}
                Adicionar Arquivos
            </button>
            <button 
                onClick={onClose}
                disabled={isUploading}
                className="sm:w-32 py-4 bg-slate-900 text-white rounded-2xl font-black text-sm hover:bg-black transition-all shadow-xl disabled:opacity-50"
            >
                Concluir
            </button>
        </div>
      </div>
    </div>
  );
};

export default AttachmentModal;
