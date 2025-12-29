
import React, { useState } from 'react';
import { ToothState } from '../types';
import { Baby, User } from 'lucide-react';

interface OdontogramProps {
  states: ToothState[];
  onToothClick: (tooth: number) => void;
}

const Odontogram: React.FC<OdontogramProps> = ({ states, onToothClick }) => {
  const [view, setView] = useState<'ADULT' | 'KIDS'>('ADULT');

  // FDI Notation
  const adultTeethUpper = [18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28];
  const adultTeethLower = [48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38];
  
  const kidsTeethUpper = [55, 54, 53, 52, 51, 61, 62, 63, 64, 65];
  const kidsTeethLower = [85, 84, 83, 82, 81, 71, 72, 73, 74, 75];

  const getConditionColor = (tooth: number) => {
    const state = states.find(s => s.tooth === tooth);
    switch (state?.condition) {
      case 'CAVITY': return 'bg-rose-500 text-white border-rose-600';
      case 'FILLING': return 'bg-blue-500 text-white border-blue-600';
      case 'MISSING': return 'bg-slate-200 text-slate-400 border-slate-300 opacity-50';
      case 'CROWN': return 'bg-amber-400 text-amber-900 border-amber-500';
      case 'ENDO': return 'bg-purple-500 text-white border-purple-600';
      case 'IMPLANT': return 'bg-indigo-600 text-white border-indigo-700';
      default: return 'bg-white text-slate-600 border-slate-200 hover:border-sky-400 hover:bg-sky-50';
    }
  };

  const renderTooth = (tooth: number) => (
    <button
      key={tooth}
      type="button"
      onClick={() => onToothClick(tooth)}
      className={`w-9 h-12 border-2 rounded-lg flex flex-col items-center justify-center transition-all shadow-sm group relative ${getConditionColor(tooth)}`}
    >
      <span className="text-[10px] font-black">{tooth}</span>
      <div className="w-4 h-4 mt-1 border border-current rounded-sm opacity-30 group-hover:opacity-100"></div>
    </button>
  );

  return (
    <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100 space-y-8 overflow-x-auto relative">
      <div className="absolute top-4 left-4 flex bg-white rounded-xl p-1 shadow-sm border border-slate-100">
          <button 
            onClick={() => setView('ADULT')}
            className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase flex items-center gap-2 transition-all ${view === 'ADULT' ? 'bg-sky-600 text-white' : 'text-slate-400 hover:bg-slate-50'}`}
          >
              <User className="w-3 h-3" /> Adulto
          </button>
          <button 
            onClick={() => setView('KIDS')}
            className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase flex items-center gap-2 transition-all ${view === 'KIDS' ? 'bg-sky-600 text-white' : 'text-slate-400 hover:bg-slate-50'}`}
          >
              <Baby className="w-3 h-3" /> Infantil
          </button>
      </div>

      <div className="flex flex-col items-center gap-2 pt-8">
        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Arcada Superior</span>
        <div className="flex gap-1.5">
            {view === 'ADULT' ? adultTeethUpper.map(renderTooth) : kidsTeethUpper.map(renderTooth)}
        </div>
      </div>
      
      <div className="h-px bg-slate-200 w-full"></div>

      <div className="flex flex-col items-center gap-2">
        <div className="flex gap-1.5">
            {view === 'ADULT' ? adultTeethLower.map(renderTooth) : kidsTeethLower.map(renderTooth)}
        </div>
        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Arcada Inferior</span>
      </div>

      <div className="pt-4 flex flex-wrap justify-center gap-4 border-t border-slate-200">
        {[
          { label: 'Cárie', color: 'bg-rose-500' },
          { label: 'Restauração', color: 'bg-blue-500' },
          { label: 'Ausente', color: 'bg-slate-200' },
          { label: 'Coroa', color: 'bg-amber-400' },
          { label: 'Canal', color: 'bg-purple-500' },
          { label: 'Implante', color: 'bg-indigo-600' },
        ].map(leg => (
          <div key={leg.label} className="flex items-center gap-2">
            <div className={`w-3 h-3 rounded-sm ${leg.color}`}></div>
            <span className="text-[10px] font-bold text-slate-500 uppercase">{leg.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Odontogram;
