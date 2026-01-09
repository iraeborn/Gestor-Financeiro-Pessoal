import { GoogleGenAI } from "@google/genai";
import { AppState, TransactionType, TransactionStatus, AccountType } from "../types";

const formatCurrency = (val: number) => 
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

const getWealthContext = (state: AppState) => {
  const accounts = state.accounts || [];
  const transactions = state.transactions || [];

  const saldoDisponivel = accounts
    .filter(a => a.type !== AccountType.CARD)
    .reduce((acc, a) => acc + a.balance, 0);

  const dividaCartao = accounts
    .filter(a => a.type === AccountType.CARD)
    .reduce((acc, a) => acc + Math.abs(a.balance < 0 ? a.balance : 0), 0);

  const patrimonioLiquido = saldoDisponivel - dividaCartao;

  const last30Days = new Date();
  last30Days.setDate(last30Days.getDate() - 30);
  const l30Str = last30Days.toISOString().split('T')[0];

  const gastosMensais = transactions
    .filter(t => t.type === TransactionType.EXPENSE && t.status === TransactionStatus.PAID && t.date >= l30Str)
    .reduce((acc, t) => acc + t.amount, 0);

  const mesesReserva = gastosMensais > 0 ? (patrimonioLiquido / gastosMensais).toFixed(1) : '∞';

  return {
    patrimonio: {
        total_disponivel: formatCurrency(saldoDisponivel),
        divida_total_cartoes: formatCurrency(dividaCartao),
        patrimonio_liquido: formatCurrency(patrimonioLiquido),
        folego_financeiro_meses: mesesReserva
    },
    fluxo_caixa: {
        gastos_ultimos_30_dias: formatCurrency(gastosMensais),
        metas_ativas: state.goals.length
    }
  };
};

export const analyzeFinances = async (state: AppState, userPrompt?: string): Promise<string> => {
  if (!process.env.API_KEY || process.env.API_KEY === "__API_KEY__") return "IA não configurada.";
  
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const data = getWealthContext(state);

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: userPrompt 
        ? `Contexto Patrimonial: ${JSON.stringify(data)}\nPergunta do Usuário: ${userPrompt}` 
        : `Contexto Patrimonial: ${JSON.stringify(data)}\nDê um diagnóstico de elite sobre minha saúde financeira atual e um passo prático para este mês.`,
      config: {
        systemInstruction: "Você é um Gestor de Fortuna (Wealth Manager) de elite. Sua linguagem é sofisticada, direta e focada em acúmulo de patrimônio e proteção de capital. Você nunca ignora dívidas de cartão de crédito e sempre incentiva a reserva de emergência.",
      }
    });
    return response.text || "Estou processando seus dados patrimoniais.";
  } catch (e) {
      return "Erro na consultoria de elite.";
  }
};

export const getManagerDiagnostic = async (state: AppState): Promise<string> => {
    return analyzeFinances(state);
};

// Added getDiagnosticByType to fix the error in DiagnosticView.tsx
export const getDiagnosticByType = async (state: AppState, type: 'SUMMARY' | 'HEALTH' | 'RISK' | 'INVEST'): Promise<string> => {
    if (!process.env.API_KEY || process.env.API_KEY === "__API_KEY__") return "IA não configurada.";
    
    // Create a new instance right before making the call
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const data = getWealthContext(state);
    
    let prompt = "";
    const systemInstruction = "Você é um Gestor de Fortuna (Wealth Manager) de elite. Sua linguagem é sofisticada, direta e focada em acúmulo de patrimônio e proteção de capital. Você nunca ignora dívidas de cartão de crédito e sempre incentiva a reserva de emergência.";

    switch(type) {
        case 'SUMMARY':
            prompt = `Contexto Patrimonial: ${JSON.stringify(data)}\nDê um resumo executivo estratégico e seco sobre meu momento financeiro atual.`;
            break;
        case 'HEALTH':
            prompt = `Contexto Patrimonial: ${JSON.stringify(data)}\nAnalise profundamente minha saúde financeira, fluxo de caixa e fôlego de sobrevivência (meses de reserva).`;
            break;
        case 'RISK':
            prompt = `Contexto Patrimonial: ${JSON.stringify(data)}\nIdentifique riscos iminentes, ameaças de insolvência ou gargalos financeiros críticos baseados nos meus gastos e dívidas de cartão.`;
            break;
        case 'INVEST':
            prompt = `Contexto Patrimonial: ${JSON.stringify(data)}\nIdentifique onde posso economizar ou otimizar para acelerar investimentos e o crescimento do meu patrimônio líquido.`;
            break;
        default:
            prompt = `Contexto Patrimonial: ${JSON.stringify(data)}\nDê um diagnóstico estratégico geral.`;
    }

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-3-pro-preview',
            contents: prompt,
            config: {
                systemInstruction,
            }
        });
        return response.text || "Estou processando seus dados patrimoniais.";
    } catch (e) {
        console.error("IA Error:", e);
        return "Erro na consultoria especializada.";
    }
};
