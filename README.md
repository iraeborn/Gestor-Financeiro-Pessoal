
# Gestor Financeiro Pessoal

Uma aplicação completa para gestão financeira pessoal e familiar, com suporte a contas bancárias, transações recorrentes, metas, relatórios e um consultor inteligente via IA (Google Gemini).

## Funcionalidades

- **Dashboard**: Visão geral de saldo real vs. projetado.
- **Transações**: Controle de Receitas, Despesas e Transferências entre contas.
- **Contas**: Gerenciamento de múltiplas carteiras (Banco, Cartão, Investimento, Dinheiro).
- **Recorrência**: Suporte a lançamentos fixos (Semanal, Mensal, Anual).
- **Consultor IA**: Análise inteligente das finanças utilizando a API Google Gemini.
- **Família**: Colaboração em tempo real compartilhando o mesmo painel com outros membros.

## Como Rodar

### Pré-requisitos
- Node.js 18+
- PostgreSQL (ou Docker para rodar via container)
- Google Cloud Project (para Login Google e Gemini API)

### Variáveis de Ambiente (.env)

Crie um arquivo `.env` na raiz:

```env
DATABASE_URL=postgres://admin:password123@localhost:5432/financer
JWT_SECRET=sua-chave-secreta-jwt
GOOGLE_CLIENT_ID=seu-client-id-google
API_KEY=sua-chave-api-gemini
PORT=3000
```

### Rodando Localmente (Desenvolvimento)

1. Instale as dependências:
   ```bash
   npm install
   ```
2. Inicie o servidor Backend:
   ```bash
   npm run start:server
   ```
3. Em outro terminal, inicie o Frontend (Vite):
   ```bash
   npm run dev
   ```

### Rodando com Docker

1. Certifique-se de ter o Docker e Docker Compose instalados.
2. Execute:
   ```bash
   docker-compose up --build
   ```
3. Acesse `http://localhost`.

## Estrutura do Projeto

- `/server`: Backend em Node.js com Express.
- `/components`: Componentes React da UI.
- `/services`: Lógica de comunicação com API e Storage.
- `/database`: Scripts de inicialização do Banco de Dados.
