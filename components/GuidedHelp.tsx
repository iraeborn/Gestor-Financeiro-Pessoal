
import React, { useState, useEffect, createContext, useContext, useMemo } from 'react';
import { ViewMode, HelpStep } from '../types';
import { X, ChevronRight, ChevronLeft, CheckCircle2, PlayCircle, Info, Glasses, HelpCircle } from 'lucide-react';

interface HelpContextType {
    activeGuide: string | null;
    currentStep: number;
    isTrackerVisible: boolean;
    setIsTrackerVisible: (visible: boolean) => void;
    startGuide: (guideId: string) => void;
    nextStep: () => void;
    prevStep: () => void;
    closeGuide: () => void;
    isStepCompleted: (stepId: string) => boolean;
    markStepComplete: (stepId: string) => void;
}

const HelpContext = createContext<HelpContextType | undefined>(undefined);

const OPTICAL_STEPS: HelpStep[] = [
    { id: 'STEP_RX', targetId: 'btn-new-rx', title: '1. Receita RX', content: 'Registre aqui a prescrição técnica do paciente.', view: 'OPTICAL_RX', position: 'bottom' },
    { id: 'STEP_SALE', targetId: 'btn-new-sale', title: '2. Gerar Venda', content: 'Crie orçamentos e vincule armações e lentes.', view: 'SRV_SALES', position: 'bottom' },
    { id: 'STEP_LAB', targetId: 'btn-new-os', title: '3. Laboratório', content: 'Envie para o laboratório gerar a Ordem de Serviço.', view: 'SRV_OS', position: 'bottom' }
];

export const HelpProvider: React.FC<{ children: React.ReactNode, currentView: ViewMode, onChangeView: (v: ViewMode) => void }> = ({ children, currentView, onChangeView }) => {
    const [activeGuide, setActiveGuide] = useState<string | null>(null);
    // Alterado para começar como falso (fechado) por padrão
    const [isTrackerVisible, setIsTrackerVisible] = useState(() => localStorage.getItem('help_tracker_visible') === 'true');
    const [currentStepIdx, setCurrentStepIdx] = useState(0);
    const [completedSteps, setCompletedSteps] = useState<string[]>(() => JSON.parse(localStorage.getItem('help_completed_steps') || '[]'));

    useEffect(() => {
        localStorage.setItem('help_completed_steps', JSON.stringify(completedSteps));
        localStorage.setItem('help_tracker_visible', String(isTrackerVisible));
    }, [completedSteps, isTrackerVisible]);

    const startGuide = (guideId: string) => {
        setActiveGuide(guideId);
        setIsTrackerVisible(true);
        setCurrentStepIdx(0);
        const first = OPTICAL_STEPS[0];
        if (currentView !== first.view) onChangeView(first.view);
    };

    const nextStep = () => {
        if (currentStepIdx < OPTICAL_STEPS.length - 1) {
            const nextIdx = currentStepIdx + 1;
            setCurrentStepIdx(nextIdx);
            const next = OPTICAL_STEPS[nextIdx];
            if (currentView !== next.view) onChangeView(next.view);
        } else {
            closeGuide();
        }
    };

    const closeGuide = () => { setActiveGuide(null); setCurrentStepIdx(0); };
    const markStepComplete = (id: string) => !completedSteps.includes(id) && setCompletedSteps([...completedSteps, id]);

    return (
        <HelpContext.Provider value={{ 
            activeGuide, currentStep: currentStepIdx, isTrackerVisible, setIsTrackerVisible,
            startGuide, nextStep, prevStep: () => {}, closeGuide, isStepCompleted: (id) => completedSteps.includes(id), markStepComplete 
        }}>
            {children}
            <HelpOverlay currentStep={OPTICAL_STEPS[currentStepIdx]} isActive={!!activeGuide} />
            <JourneyTracker steps={OPTICAL_STEPS} />
        </HelpContext.Provider>
    );
};

export const useHelp = () => {
    const context = useContext(HelpContext);
    if (!context) throw new Error('useHelp must be used within HelpProvider');
    return context;
};

const HelpOverlay: React.FC<{ currentStep: HelpStep, isActive: boolean }> = ({ currentStep, isActive }) => {
    const { nextStep, closeGuide, currentStep: idx } = useHelp();
    const [targetRect, setTargetRect] = useState<DOMRect | null>(null);

    useEffect(() => {
        if (isActive) {
            const el = document.getElementById(currentStep.targetId);
            if (el) setTargetRect(el.getBoundingClientRect());
        }
    }, [isActive, currentStep]);

    if (!isActive || !targetRect) return null;

    return (
        <div className="fixed inset-0 z-[200] pointer-events-none">
            <div className="absolute border-4 border-indigo-500 rounded-xl shadow-[0_0_0_9999px_rgba(0,0,0,0.5)] animate-pulse"
                 style={{ top: targetRect.top - 8, left: targetRect.left - 8, width: targetRect.width + 16, height: targetRect.height + 16 }} />
            <div className="absolute bg-white rounded-2xl shadow-2xl p-6 w-80 pointer-events-auto border border-indigo-100 animate-scale-up"
                 style={{ top: targetRect.bottom + 20, left: targetRect.left }}>
                <div className="flex justify-between items-start mb-4">
                    <h4 className="font-bold text-gray-900 text-sm">{currentStep.title}</h4>
                    <button onClick={closeGuide} className="text-gray-400 hover:text-gray-600"><X className="w-4 h-4"/></button>
                </div>
                <p className="text-xs text-gray-600 leading-relaxed mb-6">{currentStep.content}</p>
                <button onClick={nextStep} className="w-full bg-indigo-600 text-white py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-2">
                    Próximo <ChevronRight className="w-4 h-4"/>
                </button>
            </div>
        </div>
    );
};

const JourneyTracker: React.FC<{ steps: HelpStep[] }> = ({ steps }) => {
    const { startGuide, isStepCompleted, isTrackerVisible, setIsTrackerVisible } = useHelp();
    const [isOpen, setIsOpen] = useState(false);

    if (!isTrackerVisible) return null;

    const completed = steps.filter(s => isStepCompleted(s.id)).length;
    const progress = (completed / steps.length) * 100;

    return (
        <div className="fixed bottom-24 right-6 md:bottom-6 z-[150] flex flex-col items-end gap-3">
            {isOpen && (
                <div className="bg-white rounded-3xl shadow-2xl border border-indigo-100 p-6 w-72 animate-slide-in-bottom pointer-events-auto">
                    <div className="flex justify-between items-center mb-4">
                        <h4 className="font-black text-xs text-gray-900 uppercase tracking-widest flex items-center gap-2"><Glasses className="w-4 h-4 text-indigo-600"/> Guia Gestor</h4>
                        <button onClick={() => setIsOpen(false)} className="text-gray-400"><X className="w-4 h-4"/></button>
                    </div>
                    <div className="space-y-3 mb-6">
                        {steps.map(s => (
                            <div key={s.id} className="flex items-center gap-2 text-xs font-medium text-gray-600">
                                <div className={`w-4 h-4 rounded-full border ${isStepCompleted(s.id) ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-gray-200'}`}>
                                    {isStepCompleted(s.id) && <CheckCircle2 className="w-full h-full p-0.5"/>}
                                </div>
                                <span className={isStepCompleted(s.id) ? 'line-through opacity-50' : ''}>{s.title}</span>
                            </div>
                        ))}
                    </div>
                    <button onClick={() => { startGuide('OPTICAL'); setIsOpen(false); }} className="w-full bg-indigo-50 text-indigo-700 py-3 rounded-2xl text-xs font-black uppercase hover:bg-indigo-100 flex items-center justify-center gap-2 transition-all">
                        <PlayCircle className="w-4 h-4"/> Iniciar Guia
                    </button>
                    <button onClick={() => setIsTrackerVisible(false)} className="w-full text-center mt-4 text-[9px] font-black text-gray-400 uppercase hover:text-rose-500">Ocultar Guia</button>
                </div>
            )}
            <button onClick={() => setIsOpen(!isOpen)} className="bg-white p-2 pr-4 rounded-full shadow-xl border border-indigo-50 flex items-center gap-3 pointer-events-auto group">
                <div className="w-10 h-10 bg-indigo-600 rounded-full flex items-center justify-center text-white shadow-lg"><Info className="w-5 h-5"/></div>
                <div className="text-left">
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-tighter">Progresso</p>
                    <div className="flex items-center gap-2">
                        <div className="h-1.5 w-16 bg-gray-100 rounded-full"><div className="h-full bg-emerald-500" style={{ width: `${progress}%` }}></div></div>
                        <span className="text-[9px] font-black text-emerald-600">{Math.round(progress)}%</span>
                    </div>
                </div>
            </button>
        </div>
    );
};
