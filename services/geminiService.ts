
import { GoogleGenAI } from "@google/genai";
import { AppState, TransactionType, TransactionStatus } from "../types";

const formatCurrency = (val: number) => 
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

export const analyzeFinances = async (data: AppState, userContext?: string): Promise<string> => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) return "IA não configurada. Verifique a chave API_KEY.";

  const ai = new GoogleGenAI({ apiKey });

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
    contasPendentesMes: data.transactions.filter(t => t.status === TransactionStatus.PENDING).length,
    metas: data.goals.map(g => ({ nome: g.name, progresso: `${Math.round((g.currentAmount/g.targetAmount)*100)}%` })),
  };

  const prompt = `
    Você é o "CFO Pessoal", um gestor financeiro de elite. 
    Sua missão é dar um diagnóstico preciso e sugerir ações de riqueza.

    DADOS DO USUÁRIO:
    ${JSON.stringify(summary, null, 2)}

    PERGUNTA/CONTEXTO: "${userContext || "Análise geral proativa"}"

    FORMATO DE RESPOSTA (Markdown):
    1. **Status Geral**: Uma frase sobre a saúde atual.
    2. **Alerta de Risco**: Identifique se há perigo de caixa ou metas em risco.
    3. **Oportunidade**: Onde o usuário pode economizar ou alocar melhor o saldo projetado.
    4. **Ação do Gestor**: Dê 3 passos numerados.
    5. **Nota Financeira**: 0 a 10.

    Linguagem: Direta, técnica mas acessível, encorajadora.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });
    return response.text || "O gestor está processando os dados...";
  } catch (error) {
    console.error("Gemini Error:", error);
    return "Erro ao conectar com o cérebro financeiro. Verifique sua conexão.";
  }
};
