
import React, { useState, useEffect } from 'react';
import { FinancialGoal } from '../types';
import { Target, Plus, Trash2, Calendar, TrendingUp, DollarSign, CheckCircle, AlertTriangle, ArrowRight, Lightbulb } from 'lucide-react';
import { useAlert, useConfirm } from './AlertSystem';

interface GoalsViewProps {
  goals: FinancialGoal[];
  onSaveGoal: (g: FinancialGoal) => void;
  onDeleteGoal: (id: string) => void;
}

interface PlanResult {
    monthlySavings: number;
    monthsRemaining: number;
    isRealistic: 'YES' | 'NO' | 'MAYBE';
    suggestions: string[];
    summary: string;
}

const GoalsView: React.FC<GoalsViewProps> = ({ goals, onSaveGoal, onDeleteGoal }) => {
  const { showAlert } = useAlert();
  const { showConfirm } = useConfirm();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({
      id: '',
      name: '',
      targetAmount: '',
      currentAmount: '',
      deadline: ''
  });
  const [planResult, setPlanResult] = useState<PlanResult | null>(null);

  // Auto-calculate plan when inputs change
  useEffect(() => {
      if (formData.targetAmount && formData.deadline) {
          calculatePlan();
      } else {
          setPlanResult(null);
      }
  }, [formData.targetAmount, formData.currentAmount, formData.deadline]);

  const handleOpenModal = (goal?: FinancialGoal) => {
      if (goal) {
          setFormData({
              id: goal.id,
              name: goal.name,
              targetAmount: goal.targetAmount.toString(),
              currentAmount: goal.currentAmount.toString(),
              deadline: goal.deadline || ''
          });
      } else {
          setFormData({ id: '', name: '', targetAmount: '', currentAmount: '0', deadline: '' });
      }
      setIsModalOpen(true);
  };

  const calculatePlan = () => {
      const target = parseFloat(formData.targetAmount);
      const current = parseFloat(formData.currentAmount || '0');
      const deadlineDate = new Date(formData.deadline);
      const today = new Date();

      if (isNaN(target) || isNaN(deadlineDate.getTime())) return;

      const remainingAmount = target - current;
      if (remainingAmount <= 0) {
          setPlanResult({
              monthlySavings: 0,
              monthsRemaining: 0,
              isRealistic: 'YES',
              suggestions: ['Você já atingiu o valor!'],
              summary: 'Parabéns! Você já tem o dinheiro necessário.'
          });
          return;
      }

      // Calculate months diff
      let months = (deadlineDate.getFullYear() - today.getFullYear()) * 12;
      months -= today.getMonth();
      months += deadlineDate.getMonth();
      // Se dia do prazo for menor que dia atual, desconta um mês (pagamento já passou ou está muito perto)
      if (deadlineDate.getDate() < today.getDate()) months--;
      
      const monthsRemaining = Math.max(1, months);
      const monthlySavings = remainingAmount / monthsRemaining;

      // Realistic Check (Mock logic - in real app would check user average income)
      let isRealistic: 'YES' | 'NO' | 'MAYBE' = 'YES';
      const suggestions: string[] = [];

      if (monthlySavings > 5000) isRealistic = 'NO';
      else if (monthlySavings > 2000) isRealistic = 'MAYBE';

      if (isRealistic === 'NO') {
          suggestions.push('Estenda o prazo para reduzir a parcela mensal.');
          suggestions.push('Procure formas de renda extra para cobrir o valor.');
      } else if (isRealistic === 'MAYBE') {
          suggestions.push('Revise gastos supérfluos (streaming, delivery).');
          suggestions.push('Venda itens parados em casa.');
      } else {
          suggestions.push('Configure uma transferência automática no dia do pagamento.');
      }

      const summary = `Para juntar R$ ${remainingAmount.toLocaleString('pt-BR')} até ${deadlineDate.toLocaleDateString('pt-BR')}, você precisa guardar R$ ${monthlySavings.toLocaleString('pt-BR', {minimumFractionDigits: 2})} por mês durante ${monthsRemaining} meses.`;

      setPlanResult({
          monthlySavings,
          monthsRemaining,
          isRealistic,
          suggestions,
          summary
      });
  };

  const handleSave = (e: React.FormEvent) => {
      e.preventDefault();
      if (!formData.name || !formData.targetAmount) return;

      onSaveGoal({
          id: formData.id || crypto.randomUUID(),
          name: formData.name,
          targetAmount: parseFloat(formData.targetAmount),
          currentAmount: parseFloat(formData.currentAmount || '0'),
          deadline: formData.deadline
      });
      setIsModalOpen(false);
      showAlert("Plano salvo com sucesso!", "success");
  };

  const handleDelete = async (id: string) => {
      const confirm = await showConfirm({
          title: "Excluir Meta",
          message: "Tem certeza? O histórico de evolução será perdido.",
          variant: "danger"
      });
      if (confirm) {
          onDeleteGoal(id);
          showAlert("Meta excluída.", "success");
      }
  };

  const formatCurrency = (val: number) => 
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

  return (
    <div className="space-y-8 animate-fade-in pb-10">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Target className="w-6 h-6 text-indigo-600" />
              Metas & Objetivos
          </h1>
          <p className="text-gray-500">Planeje suas conquistas futuras com nossa calculadora inteligente.</p>
        </div>
        <button 
          onClick={() => handleOpenModal()}
          className="flex items-center gap-2 bg-indigo-600 text-white px-5 py-2.5 rounded-xl font-semibold hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200"
        >
          <Plus className="w-5 h-5" />
          Nova Meta
        </button>
      </div>

      {goals.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-2xl border border-gray-100 shadow-sm">
              <Target className="w-16 h-16 text-gray-200 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900">Nenhuma meta definida</h3>
              <p className="text-gray-500 max-w-sm mx-auto mt-2 mb-6">
                  Defina um objetivo (viagem, carro, reserva) e nós calculamos quanto você precisa guardar por mês.
              </p>
              <button onClick={() => handleOpenModal()} className="text-indigo-600 font-bold hover:underline">
                  Criar meu primeiro plano
              </button>
          </div>
      ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {goals.map(goal => {
                  const percent = Math.min(100, Math.round((goal.currentAmount / goal.targetAmount) * 100));
                  return (
                      <div key={goal.id} className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm hover:shadow-md transition-shadow group relative">
                          <div className="flex justify-between items-start mb-4">
                              <div>
                                  <h3 className="font-bold text-gray-800 text-lg">{goal.name}</h3>
                                  <p className="text-xs text-gray-500 flex items-center gap-1 mt-1">
                                      <Calendar className="w-3 h-3" /> 
                                      Meta: {new Date(goal.deadline).toLocaleDateString('pt-BR')}
                                  </p>
                              </div>
                              <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-sm border-4 ${percent >= 100 ? 'border-emerald-100 text-emerald-600' : 'border-indigo-50 text-indigo-600'}`}>
                                  {percent}%
                              </div>
                          </div>

                          <div className="space-y-2">
                              <div className="flex justify-between text-sm">
                                  <span className="text-gray-500">Guardado</span>
                                  <span className="font-bold text-gray-900">{formatCurrency(goal.currentAmount)}</span>
                              </div>
                              <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden">
                                  <div className={`h-full rounded-full transition-all duration-1000 ${percent >= 100 ? 'bg-emerald-500' : 'bg-indigo-600'}`} style={{ width: `${percent}%` }}></div>
                              </div>
                              <div className="flex justify-between text-xs text-gray-400">
                                  <span>0</span>
                                  <span>Alvo: {formatCurrency(goal.targetAmount)}</span>
                              </div>
                          </div>

                          <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity flex gap-2">
                              <button onClick={() => handleOpenModal(goal)} className="p-1.5 bg-gray-100 hover:bg-gray-200 rounded text-gray-600"><Plus className="w-4 h-4" /></button>
                              <button onClick={() => handleDelete(goal.id)} className="p-1.5 bg-rose-50 hover:bg-rose-100 rounded text-rose-600"><Trash2 className="w-4 h-4" /></button>
                          </div>
                      </div>
                  );
              })}
          </div>
      )}

      {/* Modal - O Planejador Inteligente */}
      {isModalOpen && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col md:flex-row animate-scale-up">
                  {/* Lado Esquerdo: Form */}
                  <div className="p-8 md:w-1/2 flex flex-col justify-between">
                      <div>
                          <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
                              {formData.id ? 'Editar Plano' : 'Criar Novo Plano'}
                          </h2>
                          <form id="goalForm" onSubmit={handleSave} className="space-y-4">
                              <div>
                                  <label className="block text-xs font-bold text-gray-700 mb-1">O objetivo é</label>
                                  <input 
                                      type="text" 
                                      placeholder="Ex: Viagem para a Tailândia"
                                      className="w-full border-b-2 border-gray-200 focus:border-indigo-600 outline-none py-2 text-gray-800 bg-transparent"
                                      value={formData.name}
                                      onChange={e => setFormData({...formData, name: e.target.value})}
                                      required
                                  />
                              </div>
                              <div>
                                  <label className="block text-xs font-bold text-gray-700 mb-1">O valor total necessário é (R$)</label>
                                  <input 
                                      type="number" 
                                      placeholder="15000"
                                      className="w-full border-b-2 border-gray-200 focus:border-indigo-600 outline-none py-2 text-gray-800 bg-transparent font-medium"
                                      value={formData.targetAmount}
                                      onChange={e => setFormData({...formData, targetAmount: e.target.value})}
                                      required
                                  />
                              </div>
                              <div>
                                  <label className="block text-xs font-bold text-gray-700 mb-1">Preciso atingir até</label>
                                  <input 
                                      type="date" 
                                      className="w-full border-b-2 border-gray-200 focus:border-indigo-600 outline-none py-2 text-gray-800 bg-transparent"
                                      value={formData.deadline}
                                      onChange={e => setFormData({...formData, deadline: e.target.value})}
                                      required
                                  />
                              </div>
                              <div>
                                  <label className="block text-xs font-bold text-gray-700 mb-1">Já tenho guardado (R$)</label>
                                  <input 
                                      type="number" 
                                      placeholder="0"
                                      className="w-full border-b-2 border-gray-200 focus:border-indigo-600 outline-none py-2 text-gray-800 bg-transparent"
                                      value={formData.currentAmount}
                                      onChange={e => setFormData({...formData, currentAmount: e.target.value})}
                                  />
                              </div>
                          </form>
                      </div>
                      
                      <div className="pt-6 flex gap-3">
                          <button onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-gray-500 hover:text-gray-700 text-sm font-bold">Cancelar</button>
                          <button type="submit" form="goalForm" className="flex-1 bg-indigo-600 text-white py-2 rounded-xl font-bold hover:bg-indigo-700 transition-colors shadow-lg">
                              Salvar Plano
                          </button>
                      </div>
                  </div>

                  {/* Lado Direito: O Resultado (Calculadora) */}
                  <div className="bg-slate-50 md:w-1/2 p-8 border-l border-gray-100 flex flex-col justify-center">
                      {planResult ? (
                          <div className="space-y-6 animate-fade-in">
                              <div className="text-center">
                                  <p className="text-xs text-slate-500 uppercase tracking-wider font-bold mb-2">Você precisa guardar</p>
                                  <div className="text-4xl font-extrabold text-indigo-600">
                                      {formatCurrency(planResult.monthlySavings)}
                                      <span className="text-sm text-gray-400 font-normal"> /mês</span>
                                  </div>
                              </div>

                              <div className={`p-4 rounded-xl border ${
                                  planResult.isRealistic === 'YES' ? 'bg-emerald-50 border-emerald-100 text-emerald-800' :
                                  planResult.isRealistic === 'MAYBE' ? 'bg-amber-50 border-amber-100 text-amber-800' :
                                  'bg-rose-50 border-rose-100 text-rose-800'
                              }`}>
                                  <div className="flex gap-2 items-center font-bold text-sm mb-1">
                                      {planResult.isRealistic === 'YES' ? <CheckCircle className="w-4 h-4"/> : <AlertTriangle className="w-4 h-4"/>}
                                      Análise de Viabilidade
                                  </div>
                                  <p className="text-xs opacity-90">
                                      {planResult.isRealistic === 'YES' ? 'O plano parece realista e alcançável.' :
                                       planResult.isRealistic === 'MAYBE' ? 'O valor mensal é considerável. Exige disciplina.' :
                                       'O valor é alto. Considere aumentar o prazo.'}
                                  </p>
                              </div>

                              <div>
                                  <p className="text-xs font-bold text-slate-400 uppercase mb-2 flex items-center gap-1">
                                      <Lightbulb className="w-3 h-3 text-amber-400" /> Sugestões para acelerar
                                  </p>
                                  <ul className="space-y-2">
                                      {planResult.suggestions.map((sug, idx) => (
                                          <li key={idx} className="text-xs text-slate-600 flex gap-2 items-start bg-white p-2 rounded border border-gray-200">
                                              <ArrowRight className="w-3 h-3 mt-0.5 text-indigo-400 shrink-0" />
                                              {sug}
                                          </li>
                                      ))}
                                  </ul>
                              </div>

                              <div className="pt-4 border-t border-slate-200">
                                  <p className="text-xs text-slate-500 italic text-center leading-relaxed">
                                      "{planResult.summary}"
                                  </p>
                              </div>
                          </div>
                      ) : (
                          <div className="text-center text-slate-400">
                              <Target className="w-12 h-12 mx-auto mb-4 opacity-20" />
                              <p className="text-sm">Preencha os dados ao lado para ver seu plano financeiro personalizado.</p>
                          </div>
                      )}
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

export default GoalsView;
