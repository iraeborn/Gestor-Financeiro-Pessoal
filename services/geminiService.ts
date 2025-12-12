
import { GoogleGenAI } from "@google/genai";
import { AppState, TransactionType, TransactionStatus } from "../types";

// Helper to format currency
const formatCurrency = (val: number) => 
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

export const analyzeFinances = async (data: AppState): Promise<string> => {
  if (!process.env.API_KEY) {
    return "API Key não encontrada. Por favor, configure a variável de ambiente API_KEY.";
  }

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  // Prepare data for the AI
  const currentRealBalance = data.accounts.reduce((acc, curr) => acc + curr.balance, 0);
  
  const pendingIncome = data.transactions
    .filter(t => t.type === TransactionType.INCOME && t.status === TransactionStatus.PENDING)
    .reduce((acc, t) => acc + t.amount, 0);

  const pendingExpenses = data.transactions
    .filter(t => t.type === TransactionType.EXPENSE && t.status === TransactionStatus.PENDING)
    .reduce((acc, t) => acc + t.amount, 0);

  const projectedBalance = currentRealBalance + pendingIncome - pendingExpenses;

  const summary = {
    visaoReal: {
      saldoAtual: formatCurrency(currentRealBalance),
      detalheContas: data.accounts.map(a => `${a.name} (${a.type}): ${formatCurrency(a.balance)}`)
    },
    visaoProjetada: {
      saldoFuturoEstimado: formatCurrency(projectedBalance),
      receitasPendentes: formatCurrency(pendingIncome),
      despesasPendentes: formatCurrency(pendingExpenses)
    },
    transacoesRecentes: data.transactions.slice(0, 15).map(t => ({
      data: t.date,
      desc: t.description,
      valor: t.amount,
      tipo: t.type,
      status: t.status,
      cat: t.category
    })),
    metas: data.goals.map(g => `${g.name}: ${formatCurrency(g.currentAmount)} / ${formatCurrency(g.targetAmount)}`)
  };

  const prompt = `
    Atue como um Gestor Financeiro Pessoal Completo. 
    Seu objetivo é organizar, analisar e melhorar minha vida financeira de forma clara, objetiva e prática.
    
    Analise os dados financeiros abaixo (JSON):
    ${JSON.stringify(summary, null, 2)}

    Diretrizes de Resposta (Estilo: Direto, sem enrolação, "curto e grosso" mas educado):
    
    1. **Diagnóstico Geral (Visão Dupla)**:
       - Compare a "Visão Real" (hoje) com a "Visão Projetada" (futuro).
       - Diga claramente se o usuário vai ficar no negativo ou se está tranquilo.

    2. **Análise de Contas e Prazos**:
       - Identifique contas a pagar próximas que podem comprometer o saldo.
       - Aponte gastos recorrentes que parecem altos ou desnecessários.

    3. **Plano de Ação (3 Passos)**:
       - Dê 3 ordens práticas para a semana (Ex: "Pague a conta X agora", "Corte gastos em Y", "Invista Z").

    4. **Oportunidades**:
       - Sugira onde economizar ou se há sobras para investir nas Metas listadas.

    Formato: Use Markdown. Use tópicos. Negrite valores importantes.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });
    return response.text || "Não foi possível gerar a análise no momento.";
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "Erro ao conectar com o consultor inteligente. Verifique sua conexão ou tente novamente mais tarde.";
  }
};

export const extractReceiptData = async (base64Image: string): Promise<any> => {
    if (!process.env.API_KEY) {
        throw new Error("API Key não encontrada.");
    }

    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

    // Remove data URL prefix if present (e.g., "data:image/jpeg;base64,")
    const cleanBase64 = base64Image.replace(/^data:image\/\w+;base64,/, "");

    const prompt = `
        Analise a imagem desta nota fiscal/recibo. Extraia os seguintes dados e retorne APENAS um JSON válido, sem markdown:
        {
            "amount": number (valor total, use ponto para decimal),
            "date": string (data no formato YYYY-MM-DD, se não encontrar use a data de hoje),
            "description": string (nome do estabelecimento ou descrição resumida),
            "category": string (sugira uma categoria curta ex: Alimentação, Transporte, Saúde, Mercado)
        }
    `;

    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: [
                {
                    parts: [
                        { text: prompt },
                        { inlineData: { mimeType: "image/jpeg", data: cleanBase64 } }
                    ]
                }
            ],
            config: {
                responseMimeType: "application/json"
            }
        });

        const text = response.text;
        if (!text) throw new Error("Sem resposta da IA");
        
        return JSON.parse(text);
    } catch (error) {
        console.error("Erro ao ler nota fiscal:", error);
        throw new Error("Não foi possível ler os dados da imagem.");
    }
};
