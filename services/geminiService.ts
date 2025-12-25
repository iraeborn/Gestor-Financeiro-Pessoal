
import { GoogleGenAI } from "@google/genai";
import { AppState, TransactionType, TransactionStatus } from "../types";

const formatCurrency = (val: number) => 
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

const getSystemContext = (state: AppState) => {
  const balance = state.accounts.reduce((acc, a) => acc + a.balance, 0);
  const overdueCount = state.transactions.filter(t => t.status === TransactionStatus.OVERDUE).length;
  const pendingIncome = state.transactions.filter(t => t.type === TransactionType.INCOME && t.status === TransactionStatus.PENDING).reduce((acc, t) => acc + t.amount, 0);
  const pendingExpense = state.transactions.filter(t => t.type === TransactionType.EXPENSE && t.status === TransactionStatus.PENDING).reduce((acc, t) => acc + t.amount, 0);

  return {
    saldo_atual: formatCurrency(balance),
    contas_vencidas: overdueCount,
    entradas_previstas: formatCurrency(pendingIncome),
    saidas_previstas: formatCurrency(pendingExpense),
    metas_ativas: state.goals.map(g => `${g.name} (${Math.round((g.currentAmount/g.targetAmount)*100)}%)`),
    categorias_gastos: state.transactions.filter(t => t.type === TransactionType.EXPENSE).slice(0, 20).map(t => `${t.category}: ${formatCurrency(t.amount)}`)
  };
};

export const getDiagnosticByType = async (state: AppState, type: 'HEALTH' | 'RISK' | 'INVEST' | 'SUMMARY'): Promise<string> => {
  if (!process.env.API_KEY || process.env.API_KEY === "__API_KEY__") return "IA não configurada.";

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const data = getSystemContext(state);

  const prompts = {
    SUMMARY: `Aja como um Gestor Financeiro Pessoal Sênior. Dê um diagnóstico estratégico. DADOS: ${JSON.stringify(data)}.`,
    HEALTH: `Analise profundamente a SAÚDE FINANCEIRA baseada nos dados: ${JSON.stringify(data)}.`,
    RISK: `FOCO EM RISCOS: contas vencidas e projeção de caixa. DADOS: ${JSON.stringify(data)}.`,
    INVEST: `FOCO EM CRESCIMENTO: onde economizar? DADOS: ${JSON.stringify(data)}.`
  };

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompts[type] || prompts.SUMMARY,
    });
    return response.text || "Sem resposta da IA.";
  } catch (e) {
    return "Erro ao consultar consultor inteligente.";
  }
};

export const getManagerDiagnostic = async (state: AppState): Promise<string> => {
    return getDiagnosticByType(state, 'SUMMARY');
};

export const analyzeFinances = async (state: AppState, userPrompt?: string): Promise<string> => {
  if (!process.env.API_KEY || process.env.API_KEY === "__API_KEY__") return "IA não configurada.";
  
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const context = `Contexto: Saldo R$ ${state.accounts.reduce((acc, a) => acc + a.balance, 0).toFixed(2)}, ${state.goals.length} metas ativas.`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: userPrompt ? `${context}\nPergunta: ${userPrompt}` : `${context}\nDê uma dica financeira rápida.`,
      config: {
        systemInstruction: "Você é o SmartAdvisor, consultor financeiro integrado ao FinManager.",
      }
    });
    return response.text || "Estou pronto para ajudar.";
  } catch (e) {
      return "Erro na consultoria IA.";
  }
};
