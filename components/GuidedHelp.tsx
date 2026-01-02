
import React, { useState, useEffect, createContext, useContext } from 'react';
import { ViewMode, HelpStep } from '../types';
import { X, ChevronRight, ChevronLeft, CheckCircle2, PlayCircle, Info, Glasses, ShoppingBag, Wrench, PackageCheck, UserCheck } from 'lucide-react';

interface HelpContextType {
    activeGuide: string | null;
    currentStep: number;
    startGuide: (guideId: string) => void;
    nextStep: () => void;
    prevStep: () => void;
    closeGuide: () => void;
    isStepCompleted: (stepId: string) => boolean;
    markStepComplete: (stepId: string) => void;
}

const HelpContext = createContext<HelpContextType | undefined>(undefined);

const OPTICAL_STEPS: HelpStep[] = [
    {
        id: 'STEP_RX',
        targetId: 'btn-new-rx',
        title: '1. Registro da Receita',
        content: 'O fluxo começa aqui. Registre os dados do exame de vista e a prescrição oftalmológica do cliente.',
        view: 'OPTICAL_RX',
        position: 'bottom'
    },
    {
        id: 'STEP_SALE',
        targetId: 'btn-new-sale',
        title: '2. Gerar Venda',
        content: 'Com a receita em mãos, vincule a armação e as lentes. Aqui você também emite a nota fiscal e define o pagamento.',
        view: 'OPTICAL_SALES',
        position: 'bottom'
    },
    {
        id: 'STEP_LAB',
        targetId: 'btn-new-os',
        title: '3. Ordem p/ Laboratório',
        content: 'Transforme a venda em uma Ordem de Serviço. Envie os detalhes técnicos para o laboratório via WhatsApp ou E-mail.',
        view: 'OPTICAL_LAB',
        position: 'bottom'
    },
    {
        id: 'STEP_CHECK',
        targetId: 'tab-conference',
        title: '4. Conferência Técnica',
        content: 'Ao receber os óculos, utilize a lista de conferência para validar se o grau e a armação estão corretos.',
        view: 'OPTICAL_LAB',
        position: 'right'
    },
    {
        id: 'STEP_DELIVERY',
        targetId: 'btn-register-delivery',
        title: '5. Entrega e Satisfação',
        content: 'No ato da entrega, registre se o cliente ficou satisfeito ou se há necessidade de ajustes.',
        view: 'OPTICAL_LAB',
        position: 'top'
    }
];

export const HelpProvider: React.FC<{ children: React.ReactNode, currentView: ViewMode, onChangeView: (v: ViewMode) => void }> = ({ children, currentView, onChangeView }) => {
    const [activeGuide, setActiveGuide] = useState<string | null>(null);
    const [currentStepIdx, setCurrentStepIdx] = useState(0);
    const [completedSteps, setCompletedSteps] = useState<string[]>(() => {
        const saved = localStorage.getItem('help_completed_steps');
        return saved ? JSON.parse(saved) : [];
    });

    useEffect(() => {
        localStorage.setItem('help_completed_steps', JSON.stringify(completedSteps));
    }, [completedSteps]);

    const startGuide = (guideId: string) => {
        setActiveGuide(guideId);
        setCurrentStepIdx(0);
        const firstStep = OPTICAL_STEPS[0];
        if (currentView !== firstStep.view) onChangeView(firstStep.view);
    };

    const nextStep = () => {
        if (currentStepIdx < OPTICAL_STEPS.length - 1) {
            const nextIdx = currentStepIdx + 1;
            setCurrentStepIdx(nextIdx);
            const nextStepObj = OPTICAL_STEPS[nextIdx];
            if (currentView !== nextStepObj.view) onChangeView(nextStepObj.view);
        } else {
            closeGuide();
        }
    };

    const prevStep = () => {
        if (currentStepIdx > 0) {
            const prevIdx = currentStepIdx - 1;
            setCurrentStepIdx(prevIdx);
            const prevStepObj = OPTICAL_STEPS[prevIdx];
            if (currentView !== prevStepObj.view) onChangeView(prevStepObj.view);
        }
    };

    const closeGuide = () => {
        setActiveGuide(null);
        setCurrentStepIdx(0);
    };

    const isStepCompleted = (stepId: string) => completedSteps.includes(stepId);
    const markStepComplete = (stepId: string) => {
        if (!completedSteps.includes(stepId)) {
            setCompletedSteps([...completedSteps, stepId]);
        }
    };

    return (
        <HelpContext.Provider value={{ activeGuide, currentStep: currentStepIdx, startGuide, nextStep, prevStep, closeGuide, isStepCompleted, markStepComplete }}>
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
    const { nextStep, prevStep, closeGuide, currentStep: idx } = useHelp();
    const [targetRect, setTargetRect] = useState<DOMRect | null>(null);

    useEffect(() => {
        if (isActive) {
            const timer = setTimeout(() => {
                const el = document.getElementById(currentStep.targetId);
                if (el) setTargetRect(el.getBoundingClientRect());
                else setTargetRect(null);
            }, 500); // Espera a view carregar
            return () => clearTimeout(timer);
        }
    }, [isActive, currentStep]);

    if (!isActive) return null;

    return (
        <div className="fixed inset-0 z-[200] pointer-events-none">
            {/* Highlight Spotlight */}
            {targetRect && (
                <div 
                    className="absolute border-4 border-indigo-500 rounded-xl shadow-[0_0_0_9999px_rgba(0,0,0,0.5)] animate-pulse transition-all duration-500"
                    style={{
                        top: targetRect.top - 8,
                        left: targetRect.left - 8,
                        width: targetRect.width + 16,
                        height: targetRect.height + 16,
                        pointerEvents: 'none'
                    }}
                />
            )}

            {/* Help Bubble */}
            <div 
                className="absolute bg-white rounded-2xl shadow-2xl p-6 w-80 pointer-events-auto border border-indigo-100 animate-scale-up"
                style={{
                    top: targetRect ? targetRect.bottom + 20 : '50%',
                    left: targetRect ? targetRect.left : '50%',
                    transform: targetRect ? 'none' : 'translate(-50%, -50%)'
                }}
            >
                <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white text-xs font-black">
                            {idx + 1}
                        </div>
                        <h4 className="font-bold text-gray-900 text-sm">{currentStep.title}</h4>
                    </div>
                    <button onClick={closeGuide} className="text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
                </div>
                <p className="text-xs text-gray-600 leading-relaxed mb-6">
                    {currentStep.content}
                </p>
                <div className="flex justify-between items-center">
                    <button 
                        onClick={prevStep} 
                        disabled={idx === 0}
                        className="text-[10px] font-bold text-gray-400 uppercase tracking-widest hover:text-gray-600 disabled:opacity-0"
                    >
                        Anterior
                    </button>
                    <button 
                        onClick={nextStep}
                        className="bg-indigo-600 text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 hover:bg-indigo-700 shadow-lg shadow-indigo-100"
                    >
                        {idx === 4 ? 'Concluir Tutorial' : 'Próximo Passo'}
                        <ChevronRight className="w-4 h-4" />
                    </button>
                </div>
            </div>
        </div>
    );
};

const JourneyTracker: React.FC<{ steps: HelpStep[] }> = ({ steps }) => {
    const { startGuide, isStepCompleted, activeGuide } = useHelp();
    const [isOpen, setIsOpen] = useState(false);

    if (activeGuide) return null;

    const completedCount = steps.filter(s => isStepCompleted(s.id)).length;
    const progress = (completedCount / steps.length) * 100;

    return (
        <div className="fixed bottom-6 right-6 z-[150] flex flex-col items-end gap-3">
            {isOpen && (
                <div className="bg-white rounded-3xl shadow-2xl border border-indigo-100 p-6 w-72 animate-slide-in-bottom">
                    <div className="flex justify-between items-center mb-4">
                        <h4 className="font-black text-xs text-gray-900 uppercase tracking-widest flex items-center gap-2">
                            <Glasses className="w-4 h-4 text-indigo-600" />
                            Jornada da Ótica
                        </h4>
                        <button onClick={() => setIsOpen(false)} className="text-gray-400 hover:text-gray-600"><X className="w-4 h-4"/></button>
                    </div>
                    
                    <div className="space-y-4 mb-6">
                        {steps.map((step, i) => (
                            <div key={step.id} className="flex items-start gap-3">
                                <div className={`mt-0.5 shrink-0 w-5 h-5 rounded-full flex items-center justify-center border ${isStepCompleted(step.id) ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-gray-200 text-gray-300'}`}>
                                    {isStepCompleted(step.id) ? <CheckCircle2 className="w-3 h-3" /> : <span className="text-[10px] font-bold">{i+1}</span>}
                                </div>
                                <span className={`text-xs font-medium ${isStepCompleted(step.id) ? 'text-gray-500 line-through' : 'text-gray-700'}`}>{step.title}</span>
                            </div>
                        ))}
                    </div>

                    <button 
                        onClick={() => { startGuide('OPTICAL_FLOW'); setIsOpen(false); }}
                        className="w-full bg-indigo-50 text-indigo-700 py-3 rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-indigo-100 flex items-center justify-center gap-2 transition-all"
                    >
                        <PlayCircle className="w-4 h-4" /> Iniciar Ajuda Guiada
                    </button>
                </div>
            )}
            
            <button 
                onClick={() => setIsOpen(!isOpen)}
                className="group relative flex items-center gap-3 bg-white p-2 pr-4 rounded-full shadow-xl border border-indigo-50 hover:border-indigo-200 transition-all overflow-hidden"
            >
                <div className="w-10 h-10 bg-indigo-600 rounded-full flex items-center justify-center text-white shadow-lg">
                    <Info className="w-5 h-5" />
                </div>
                <div className="text-left">
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-tighter">Guia do Gestor</p>
                    <div className="flex items-center gap-2">
                        <div className="h-1.5 w-16 bg-gray-100 rounded-full overflow-hidden">
                            <div className="h-full bg-emerald-500 transition-all duration-1000" style={{ width: `${progress}%` }}></div>
                        </div>
                        <span className="text-[9px] font-black text-emerald-600">{Math.round(progress)}%</span>
                    </div>
                </div>
            </button>
        </div>
    );
};
