
import { GoogleGenAI } from "@google/genai";
import { AppState, TransactionType, TransactionStatus } from "../types";

const formatCurrency = (val: number) => 
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

const getSystemContext = (state: AppState) => {
  const accounts = state.accounts || [];
  const transactions = state.transactions || [];

  // 1. Saldo em Caixa (Real/Disponível)
  const saldoReal = accounts.reduce((acc, a) => acc + a.balance, 0);

  // 2 & 3. Entradas e Saídas Liquidadas (Mês Atual)
  const now = new Date();
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
  
  const entradasLiquidadas = transactions
    .filter(t => t.type === TransactionType.INCOME && t.status === TransactionStatus.PAID && t.date >= firstDay)
    .reduce((acc, t) => acc + t.amount, 0);

  const saidasLiquidadas = transactions
    .filter(t => t.type === TransactionType.EXPENSE && t.status === TransactionStatus.PAID && t.date >= firstDay)
    .reduce((acc, t) => acc + t.amount, 0);

  // 5 & 6. Contas a Receber e Pagar (Pendentes)
  const aReceber = transactions
    .filter(t => t.type === TransactionType.INCOME && t.status === TransactionStatus.PENDING)
    .reduce((acc, t) => acc + t.amount, 0);

  const aPagar = transactions
    .filter(t => t.type === TransactionType.EXPENSE && t.status === TransactionStatus.PENDING)
    .reduce((acc, t) => acc + t.amount, 0);

  // 7. Saldo Projetado
  const saldoProjetado = saldoReal + aReceber - aPagar;

  // 8 & 9. Médias (Últimos 3 meses)
  const threeMonthsAgo = new Date();
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
  const tmaStr = threeMonthsAgo.toISOString().split('T')[0];
  
  const totalHistoricoEntradas = transactions
    .filter(t => t.type === TransactionType.INCOME && t.status === TransactionStatus.PAID && t.date >= tmaStr)
    .reduce((acc, t) => acc + t.amount, 0);
  
  const receitaMedia = totalHistoricoEntradas / 3;

  return {
    indicadores_chave: {
        saldo_em_caixa: formatCurrency(saldoReal),
        entradas_mes: formatCurrency(entradasLiquidadas),
        saidas_mes: formatCurrency(saidasLiquidadas),
        resultado_periodo: formatCurrency(entradasLiquidadas - saidasLiquidadas),
        contas_a_receber_total: formatCurrency(aReceber),
        contas_a_pagar_total: formatCurrency(aPagar),
        saldo_projetado_final: formatCurrency(saldoProjetado),
        receita_media_trimestral: formatCurrency(receitaMedia)
    },
    metas: state.goals.map(g => `${g.name}: ${Math.round(((g.currentAmount || 0)/g.targetAmount)*100)}% concluída`)
  };
};

export const getDiagnosticByType = async (state: AppState, type: 'HEALTH' | 'RISK' | 'INVEST' | 'SUMMARY'): Promise<string> => {
  if (!process.env.API_KEY || process.env.API_KEY === "__API_KEY__") return "IA não configurada.";

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const data = getSystemContext(state);

  const prompts = {
    SUMMARY: `Aja como meu GESTOR FINANCEIRO PESSOAL SENIOR. Analise meus 11 indicadores: ${JSON.stringify(data)}. Seja direto, crítico e estratégico. Foque no Saldo Projetado e no Ponto de Equilíbrio.`,
    HEALTH: `Analise a SAÚDE DO CAIXA. Como está meu fluxo de entradas vs saídas reais? Dados: ${JSON.stringify(data)}.`,
    RISK: `ALERTA DE RISCO: Analise contas a pagar pendentes e o risco de saldo negativo projetado. Dados: ${JSON.stringify(data)}.`,
    INVEST: `ESTRATÉGIA DE CRESCIMENTO: Com base na minha receita média, onde posso cortar para investir? Dados: ${JSON.stringify(data)}.`
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
  const data = getSystemContext(state);

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: userPrompt ? `Contexto Financeiro: ${JSON.stringify(data.indicadores_chave)}\nPergunta: ${userPrompt}` : `Contexto: ${JSON.stringify(data.indicadores_chave)}\nDê uma diretriz estratégica para melhorar meu resultado este mês.`,
      config: {
        systemInstruction: "Você é o Gestor Senior de Finanças. Sua missão é garantir a liquidez e o lucro. Nunca ignore contas em atraso.",
      }
    });
    return response.text || "Estou monitorando suas contas.";
  } catch (e) {
      return "Erro na consultoria IA.";
  }
};
