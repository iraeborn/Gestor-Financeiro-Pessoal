
export enum TransactionType {
  INCOME = 'INCOME',
  EXPENSE = 'EXPENSE',
  TRANSFER = 'TRANSFER'
}

export enum TransactionStatus {
  PENDING = 'PENDING',
  PAID = 'PAID',
  OVERDUE = 'OVERDUE'
}

export enum TransactionClassification {
  STANDARD = 'STANDARD',           // Operação Comum
  ADVANCE = 'ADVANCE',             // Adiantamento (Fornecedor/Funcionário)
  CASH_REPLENISHMENT = 'REPLENISH',// Suprimento de Caixa
  INTER_BRANCH = 'INTER_BRANCH'    // Transferência entre Filiais
}

export enum AccountType {
  WALLET = 'WALLET',
  BANK = 'BANK',
  CARD = 'CARD',
  INVESTMENT = 'INVESTMENT',
  MEAL_VOUCHER = 'MEAL_VOUCHER'
}

export type RecurrenceFrequency = 'WEEKLY' | 'MONTHLY' | 'YEARLY';

export interface WhatsappConfig {
  enabled: boolean;
  phoneNumber: string; // Ex: 5566997193196
  notifyDueToday: boolean;
  notifyDueTomorrow: boolean;
  notifyOverdue: boolean;
}

export interface AppSettings {
  includeCreditCardsInTotal: boolean;
  activeModules?: {
      odonto?: boolean;
      physio?: boolean;
      consulting?: boolean;
  };
  whatsapp?: WhatsappConfig;
}

export enum UserRole {
  USER = 'USER',
  ADMIN = 'ADMIN'
}

export enum EntityType {
  PERSONAL = 'PF', // Pessoa Física
  BUSINESS = 'PJ'  // Pessoa Jurídica
}

export enum SubscriptionPlan {
  MONTHLY = 'MONTHLY',
  YEARLY = 'YEARLY',
  TRIAL = 'TRIAL'
}

export enum SubscriptionStatus {
  ACTIVE = 'ACTIVE',
  TRIALING = 'TRIALING',
  CANCELED = 'CANCELED',
  EXPIRED = 'EXPIRED'
}

export interface Workspace {
  id: string; // family_id
  name: string; // Nome do dono da conta ou da empresa
  role: 'ADMIN' | 'MEMBER';
  entityType: EntityType;
  isCurrent: boolean;
  permissions?: string[]; // Lista de permissões (ex: 'FIN_VIEW', 'ODONTO_AGENDA_EDIT')
}

export interface User {
  id: string;
  name: string;
  email: string;
  googleId?: string;
  familyId?: string;
  settings?: AppSettings;
  // SaaS Fields
  role?: UserRole; // App Level Role (Not Workspace Role)
  entityType?: EntityType; // Tipo da conta ATUAL
  plan?: SubscriptionPlan;
  status?: SubscriptionStatus;
  trialEndsAt?: string;
  createdAt?: string;
  workspaces?: Workspace[]; // Lista de contas acessíveis
}

export interface Member {
    id: string;
    name: string;
    email: string;
    role: 'ADMIN' | 'MEMBER';
    permissions: string[];
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface Invite {
  code: string;
  expiresAt: string;
}

export interface Account {
  id: string;
  name: string;
  type: AccountType;
  balance: number;
  userId?: string;
  // Campos específicos para Cartão de Crédito
  creditLimit?: number;
  closingDay?: number; // Melhor dia de compra
  dueDay?: number;     // Dia do vencimento
}

export interface Contact {
  id: string;
  name: string;
  userId?: string;
  // Extended Fields (Centralized Info)
  email?: string;
  phone?: string;
  document?: string; // CPF/CNPJ
  pixKey?: string;
}

export interface Category {
  id: string;
  name: string;
  type?: TransactionType; // Opcional, para sugerir apenas em receitas ou despesas
  userId?: string;
}

// --- PJ Specific Interfaces ---
export enum TaxRegime {
    MEI = 'MEI',
    SIMPLES = 'SIMPLES',
    PRESUMIDO = 'PRESUMIDO',
    REAL = 'REAL'
}

export interface CompanyProfile {
  id: string;
  tradeName: string; // Nome Fantasia
  legalName: string; // Razão Social
  cnpj: string;
  userId?: string;
  
  // Dados Tributários
  taxRegime?: TaxRegime;
  cnae?: string; // Código Principal
  secondaryCnaes?: string; // Lista formatada de CNAEs secundários
  
  // Endereço e Contato
  zipCode?: string;
  street?: string;
  number?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
  phone?: string;
  email?: string;

  // Indicadores
  hasEmployees?: boolean;
  issuesInvoices?: boolean;
}

export interface Branch {
  id: string;
  name: string;
  code?: string;
  userId?: string;
}

export interface CostCenter {
  id: string;
  name: string;
  code?: string;
  userId?: string;
}

export interface Department {
  id: string;
  name: string;
  userId?: string;
}

export interface Project {
  id: string;
  name: string;
  userId?: string;
}

export interface Transaction {
  id: string;
  description: string;
  amount: number;
  type: TransactionType;
  category: string;
  date: string;
  status: TransactionStatus;
  accountId: string;
  isRecurring: boolean;
  recurrenceFrequency?: RecurrenceFrequency;
  recurrenceEndDate?: string;
  userId?: string;
  destinationAccountId?: string;
  interestRate?: number;
  contactId?: string;
  goalId?: string; // Link to FinancialGoal (Aporte)
  // PJ Fields
  branchId?: string;
  destinationBranchId?: string; // Para transferências entre filiais
  costCenterId?: string;
  departmentId?: string;
  projectId?: string;
  classification?: TransactionClassification;
  // Audit Fields
  createdByName?: string;
  updatedByName?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface FinancialGoal {
  id: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  deadline: string;
  userId?: string;
}

export interface ChangeDiff {
  old: any;
  new: any;
}

export interface AuditLog {
  id: number;
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'RESTORE' | 'REVERT';
  entity: string; // 'transaction', 'account', etc.
  entityId: string;
  details?: string; // Nome ou descrição resumida do item
  timestamp: string;
  userId: string;
  userName: string;
  isDeleted: boolean; // Se o registro atual está deletado (para saber se exibe botão restaurar)
  previousState?: any; // JSON com o estado anterior
  changes?: Record<string, ChangeDiff>; // JSON com o diff das alterações
}

// --- GENERIC SERVICE MODULE TYPES ---

export interface ServiceClient {
    id: string;
    contactId: string; // Link to core Contacts table
    contactName?: string; // Resolved name
    // Fields passed during creation but stored in Contacts table
    contactEmail?: string;
    contactPhone?: string;
    
    // Module Specific (Clinical Data)
    notes?: string; // Anamnese, Histórico, Prontuário, etc.
    birthDate?: string;
    insurance?: string; // Convênio
    allergies?: string;
    medications?: string;
    
    moduleTag: string; // 'ODONTO', 'PHYSIO', etc. (MANDATORY for filtering)
    createdAt?: string;
}

export interface ServiceItem {
    id: string;
    name: string; // Nome do procedimento/serviço
    code?: string;
    defaultPrice: number;
    moduleTag: string; // 'ODONTO', 'PHYSIO'
}

export interface ServiceAppointment {
    id: string;
    clientId: string; 
    clientName?: string; 
    serviceId?: string; 
    serviceName?: string; 
    date: string; // YYYY-MM-DD HH:mm
    status: 'SCHEDULED' | 'COMPLETED' | 'CANCELED';
    notes?: string;
    transactionId?: string; 
    moduleTag: string; // 'ODONTO', 'PHYSIO'
}

export interface AppState {
  accounts: Account[];
  transactions: Transaction[];
  goals: FinancialGoal[];
  contacts: Contact[]; 
  categories: Category[];
  // PJ Data
  companyProfile?: CompanyProfile | null;
  branches: Branch[];
  costCenters: CostCenter[];
  departments: Department[];
  projects: Project[];
  // Generic Module Data
  serviceClients?: ServiceClient[];
  serviceItems?: ServiceItem[];
  serviceAppointments?: ServiceAppointment[];
}

// Updated ViewMode to support Module Hierarchies
export type ViewMode = 
  // Financeiro (Padrão)
  | 'FIN_DASHBOARD' 
  | 'FIN_TRANSACTIONS' 
  | 'FIN_CALENDAR' 
  | 'FIN_CARDS'
  | 'FIN_ACCOUNTS' // Novo: Lista de Contas
  | 'FIN_REPORTS' 
  | 'FIN_ADVISOR'
  | 'FIN_CATEGORIES'
  | 'FIN_CONTACTS' 
  | 'FIN_GOALS' // Novo: Metas
  // Odonto
  | 'ODONTO_AGENDA'
  | 'ODONTO_PATIENTS'
  | 'ODONTO_PROCEDURES'
  // Gestão / Sistema
  | 'SYS_CONTACTS' 
  | 'SYS_LOGS'
  | 'SYS_SETTINGS'
  | 'SYS_ACCESS';

declare global {
  interface Window {
    google: any;
    GOOGLE_CLIENT_ID?: string;
  }
}
