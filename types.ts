
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

export interface AppSettings {
  includeCreditCardsInTotal: boolean;
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

export interface User {
  id: string;
  name: string;
  email: string;
  googleId?: string;
  familyId?: string;
  settings?: AppSettings;
  // SaaS Fields
  role?: UserRole;
  entityType?: EntityType;
  plan?: SubscriptionPlan;
  status?: SubscriptionStatus;
  trialEndsAt?: string;
  createdAt?: string;
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
}

export interface Category {
  id: string;
  name: string;
  type?: TransactionType; // Opcional, para sugerir apenas em receitas ou despesas
  userId?: string;
}

// --- PJ Specific Interfaces ---
export interface CompanyProfile {
  id: string;
  tradeName: string; // Nome Fantasia
  legalName: string; // Razão Social
  cnpj: string;
  userId?: string;
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
}

export type ViewMode = 'DASHBOARD' | 'TRANSACTIONS' | 'REPORTS' | 'ADVISOR' | 'CALENDAR' | 'SETTINGS' | 'CONTACTS' | 'CARDS' | 'LOGS';

declare global {
  interface Window {
    google: any;
    GOOGLE_CLIENT_ID?: string;
  }
}
