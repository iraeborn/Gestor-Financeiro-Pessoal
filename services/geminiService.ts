
import { GoogleGenAI } from "@google/genai";
import { AppState, TransactionType, TransactionStatus } from "../types";

const formatCurrency = (val: number) => 
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

export const getManagerDiagnostic = async (state: AppState): Promise<string> => {
  // Fix: Initialize GoogleGenAI with process.env.API_KEY directly as per guidelines.
  // Assume process.env.API_KEY is pre-configured, valid, and accessible.
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const balance = state.accounts.reduce((acc, a) => acc + a.balance, 0);
  const overdueCount = state.transactions.filter(t => t.status === TransactionStatus.OVERDUE).length;
  const pendingIncome = state.transactions.filter(t => t.type === TransactionType.INCOME && t.status === TransactionStatus.PENDING).reduce((acc, t) => acc + t.amount, 0);
  const pendingExpense = state.transactions.filter(t => t.type === TransactionType.EXPENSE && t.status === TransactionStatus.PENDING).reduce((acc, t) => acc + t.amount, 0);

  const summary = {
    saldo_atual: formatCurrency(balance),
    contas_vencidas: overdueCount,
    entradas_previstas: formatCurrency(pendingIncome),
    saidas_previstas: formatCurrency(pendingExpense),
    metas_ativas: state.goals.map(g => `${g.name} (${Math.round((g.currentAmount/g.targetAmount)*100)}%)`)
  };

  const prompt = `
    Aja como um Gestor Financeiro Pessoal (CFO de Elite).
    Sua missão é dar um diagnóstico seco, preciso e estratégico para o usuário.

    DADOS DO CLIENTE:
    ${JSON.stringify(summary, null, 2)}

    ESTRUTURA DA RESPOSTA (Markdown):
    1. **Saúde Geral**: Score de 0 a 100 baseado nos dados.
    2. **Alerta de Risco**: Identifique o perigo imediato (se houver).
    3. **Sugestão de Lucro**: Onde o usuário pode economizar ou investir para melhorar este mês.

    Linguagem: Profissional, direta, encorajadora mas realista.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });
    // Uso direto da propriedade .text conforme as regras da SDK
    return response.text || "O Gestor está processando os dados...";
  } catch (e) {
    console.error("Gemini Error:", e);
    return "Ocorreu um erro ao consultar o cérebro financeiro. Verifique a conexão.";
  }
};

export const analyzeFinances = async (state: AppState, userPrompt?: string): Promise<string> => {
  // Fix: Initialize GoogleGenAI with process.env.API_KEY directly as per guidelines.
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

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
    // Uso direto da propriedade .text conforme as regras da SDK
    return response.text || "Estou pronto para analisar suas contas.";
  } catch (e) {
      console.error("Gemini Advisor Error:", e);
      return "Houve um erro na consultoria inteligente.";
  }
};
