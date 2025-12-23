
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
  const apiKey = process.env.API_KEY;
  if (!apiKey || apiKey === "__API_KEY__") return "IA não configurada.";

  const ai = new GoogleGenAI({ apiKey });
  const data = getSystemContext(state);

  const prompts = {
    SUMMARY: `Aja como um Gestor Financeiro Pessoal Sênior. Dê um diagnóstico seco e estratégico. DADOS: ${JSON.stringify(data)}. Responda com: 1. Saúde Geral (Score 0-100), 2. Alerta de Risco, 3. Sugestão de Lucro.`,
    HEALTH: `Analise profundamente a SAÚDE FINANCEIRA. Verifique se as receitas cobrem as despesas e se o usuário está progredindo nas metas. DADOS: ${JSON.stringify(data)}. Seja detalhado na análise de fôlego financeiro.`,
    RISK: `FOCO TOTAL EM RISCOS. Analise contas vencidas, saldo baixo e projeção de insolvência. DADOS: ${JSON.stringify(data)}. Dê alertas vermelhos se necessário e como sair do perigo imediato.`,
    INVEST: `FOCO EM CRESCIMENTO. Onde o usuário pode economizar para investir? Analise as metas e sugira aportes baseados no saldo livre. DADOS: ${JSON.stringify(data)}. Sugira mentalidade de investidor.`
  };

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompts[type] || prompts.SUMMARY,
    });
    return response.text || "Sem resposta do gestor.";
  } catch (e) {
    return "Erro ao consultar IA.";
  }
};

// Mantido por compatibilidade
export const getManagerDiagnostic = async (state: AppState): Promise<string> => {
    return getDiagnosticByType(state, 'SUMMARY');
};

export const analyzeFinances = async (state: AppState, userPrompt?: string): Promise<string> => {
  const apiKey = process.env.API_KEY;
  if (!apiKey || apiKey === "__API_KEY__") return "IA não configurada.";
  const ai = new GoogleGenAI({ apiKey });

  const context = `
    Contexto Financeiro Atual:
    - Saldo Total: R$ ${state.accounts.reduce((acc, a) => acc + a.balance, 0).toFixed(2)}
    - Objetivos: ${state.goals.map(g => g.name).join(', ')}
    - Fluxo Pendente: ${state.transactions.filter(t => t.status === TransactionStatus.PENDING).length} registros.
  `;

  const finalPrompt = userPrompt 
    ? `${context}\n\nPergunta do Usuário: "${userPrompt}"\n\nResponda como um mentor financeiro sênior.`
    : `${context}\n\nFaça uma breve análise do cenário atual e dê uma dica de ouro para o usuário.`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: finalPrompt,
      config: {
        systemInstruction: "Você é o SmartAdvisor, consultor financeiro integrado ao FinManager. Seu objetivo é ajudar o usuário a alcançar a independência financeira através de dados reais.",
      }
    });
    return response.text || "Estou pronto para analisar suas contas.";
  } catch (e) {
      return "Houve um erro na consultoria inteligente.";
  }
};
