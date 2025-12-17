
import { GoogleGenAI } from "@google/genai";
import { AppState, TransactionType, TransactionStatus } from "../types";

const formatCurrency = (val: number) => 
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

export const analyzeFinances = async (data: AppState, userContext?: string): Promise<string> => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) return "Configuração de IA pendente.";

  // Initialize GenAI with API key from environment
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  const currentRealBalance = data.accounts.reduce((acc, curr) => acc + curr.balance, 0);
  const pendingIncome = data.transactions
    .filter(t => t.type === TransactionType.INCOME && t.status !== TransactionStatus.PAID)
    .reduce((acc, t) => acc + t.amount, 0);
  const pendingExpenses = data.transactions
    .filter(t => t.type === TransactionType.EXPENSE && t.status !== TransactionStatus.PAID)
    .reduce((acc, t) => acc + t.amount, 0);

  const summary = {
    totalReal: formatCurrency(currentRealBalance),
    totalProjetado: formatCurrency(currentRealBalance + pendingIncome - pendingExpenses),
    contasAtrasadas: data.transactions.filter(t => t.status === TransactionStatus.OVERDUE).length,
    topCategorias: data.transactions.filter(t => t.type === TransactionType.EXPENSE).slice(0, 10),
    metas: data.goals
  };

  const prompt = `
    Persona: Você é um Gestor Financeiro Pessoal de elite (estilo Coach Financeiro Pragmático).
    Seu papel é organizar, analisar e IMPROVISAR soluções para a vida do usuário.

    DADOS ATUAIS:
    ${JSON.stringify(summary, null, 2)}

    ${userContext ? `PERGUNTA DO USUÁRIO: "${userContext}"` : "FAÇA UM DIAGNÓSTICO GERAL PROATIVO."}

    REGRAS DE RESPOSTA:
    1. Seja extremamente direto. Use Markdown.
    2. Identifique 1 PERIGO (ex: conta vencida, saldo projetado negativo).
    3. Identifique 1 OPORTUNIDADE (ex: sobras para investir em metas).
    4. Dê 3 PASSOS DE AÇÃO imediatos.
    5. No final, dê uma nota de 0 a 10 para a saúde financeira atual.

    Tom de voz: Profissional, encorajador, mas sem rodeios.
  `;

  try {
    // Fix: Updated to recommended model and simplified contents parameter
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });
    // Fix: Access response text property directly
    return response.text || "Sem diagnóstico disponível.";
  } catch (error) {
    console.error(error);
    return "Erro ao conectar com o cérebro do Gestor.";
  }
};
