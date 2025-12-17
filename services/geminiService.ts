
import { GoogleGenAI } from "@google/genai";
import { AppState, TransactionType, TransactionStatus } from "../types";

const formatCurrency = (val: number) => 
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

export const getManagerDiagnostic = async (state: AppState): Promise<string> => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) return "IA aguardando chave de configuração...";

  // Sempre inicializa uma nova instância para garantir o uso da chave mais recente
  const ai = new GoogleGenAI({ apiKey });
  
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
    Aja como um Consultor Financeiro (CFO Pessoal) de alto nível.
    DADOS DO CLIENTE:
    ${JSON.stringify(summary, null, 2)}

    Sua missão:
    1. Forneça um diagnóstico seco e direto sobre a saúde financeira.
    2. Atribua um Score de 0 a 100.
    3. Identifique o maior perigo imediato.
    4. Sugira uma ação estratégica para sobrar mais dinheiro este mês.

    Formate em Markdown. Seja encorajador, mas pragmático.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });
    return response.text || "Análise concluída. Verifique os gráficos para detalhes.";
  } catch (e) {
    console.error("Gemini Error:", e);
    return "O Gestor IA está processando outros relatórios no momento. Tente novamente em alguns instantes.";
  }
};

export const analyzeFinances = async (state: AppState, userPrompt?: string): Promise<string> => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) return "Configure a API Key para conversar com o Gestor.";

  const ai = new GoogleGenAI({ apiKey });

  const context = `
    Contexto Financeiro:
    - Saldo Total: R$ ${state.accounts.reduce((acc, a) => acc + a.balance, 0).toFixed(2)}
    - Objetivos: ${state.goals.map(g => g.name).join(', ')}
    - Últimas Categorias de Gasto: ${Array.from(new Set(state.transactions.filter(t => t.type === TransactionType.EXPENSE).map(t => t.category))).join(', ')}
  `;

  const finalPrompt = userPrompt 
    ? `${context}\n\nPergunta do Usuário: "${userPrompt}"\n\nResponda como um Gestor Financeiro experiente.`
    : `${context}\n\nFaça uma breve saudação e ofereça um insight financeiro baseado nesses dados.`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: finalPrompt,
      config: {
        systemInstruction: "Você é o SmartAdvisor, o cérebro do app FinManager. Você ajuda pessoas a alcançarem a liberdade financeira com dicas baseadas em dados e psicologia econômica brasileira.",
      }
    });
    return response.text || "Estou aqui para ajudar com sua gestão financeira.";
  } catch (e) {
      return "Houve um erro na análise de consultoria.";
  }
};
