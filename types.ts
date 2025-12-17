
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

export interface EmailConfig {
  enabled: boolean;
  email: string;
  notifyDueToday: boolean;
  notifyWeeklyReport: boolean;
}

export interface AppSettings {
  includeCreditCardsInTotal: boolean;
  whatsapp?: WhatsappConfig;
  email?: EmailConfig;
  activeModules?: {
      odonto?: boolean;
      services?: boolean;
      // future modules
  };
}

export interface Member {
    id: string;
    name: string;
    email: string;
    role: 'ADMIN' | 'MEMBER';
    permissions?: string[];
}

export interface Workspace {
    id: string;
    name: string;
    role: string;
    entityType: EntityType;
    permissions?: string[];
    ownerSettings?: AppSettings; // Configurações herdadas do dono do workspace
}

export enum UserRole {
  ADMIN = 'ADMIN',
  USER = 'USER'
}

export enum EntityType {
  PERSONAL = 'PF',
  BUSINESS = 'PJ'
}

export enum SubscriptionPlan {
  TRIAL = 'TRIAL',
  MONTHLY = 'MONTHLY',
  YEARLY = 'YEARLY'
}

export interface User {
  id: string;
  name: string;
  email: string;
  familyId: string;
  settings?: AppSettings;
  role: UserRole | string;
  entityType: EntityType;
  plan: SubscriptionPlan;
  status: 'ACTIVE' | 'TRIALING' | 'EXPIRED';
  trialEndsAt?: string;
  googleId?: string;
  workspaces?: Workspace[];
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface Account {
  id: string;
  name: string;
  type: AccountType;
  balance: number;
  creditLimit?: number;
  closingDay?: number;
  dueDay?: number;
}

export interface Contact {
  id: string;
  name: string; // Razão Social se PJ
  fantasyName?: string; // Nome Fantasia
  type: 'PF' | 'PJ';
  email?: string;
  phone?: string;
  document?: string; // CPF ou CNPJ
  ie?: string; // Inscrição Estadual
  im?: string; // Inscrição Municipal
  pixKey?: string;
  
  // Address
  zipCode?: string;
  street?: string;
  number?: string;
  neighborhood?: string;
  city?: string;
  state?: string;

  // Financial & Flags
  isDefaulter?: boolean; // Inadimplente
  isBlocked?: boolean;   // Bloqueado para novas vendas
  creditLimit?: number;
  defaultPaymentMethod?: string; // 'PIX', 'BOLETO', 'CARD'
  defaultPaymentTerm?: number; // Dias padrão (ex: 30)
}

export interface Category {
  id: string;
  name: string;
  type: TransactionType;
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
  destinationAccountId?: string;
  isRecurring?: boolean;
  recurrenceFrequency?: RecurrenceFrequency;
  recurrenceEndDate?: string;
  interestRate?: number;
  contactId?: string;
  goalId?: string;
  // PJ Fields
  branchId?: string;
  destinationBranchId?: string;
  costCenterId?: string;
  departmentId?: string;
  projectId?: string;
  classification?: TransactionClassification;
  
  createdByName?: string;
}

export interface FinancialGoal {
  id: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  deadline: string;
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

  // Modules Data
  serviceClients: ServiceClient[];
  serviceItems: ServiceItem[];
  serviceAppointments: ServiceAppointment[];
  serviceOrders: ServiceOrder[];
  commercialOrders: CommercialOrder[];
  contracts: Contract[];
  invoices: Invoice[];
}

export type ViewMode = 
  // Finance
  'FIN_DASHBOARD' | 'FIN_TRANSACTIONS' | 'FIN_CALENDAR' | 'FIN_ACCOUNTS' | 'FIN_CARDS' | 'FIN_GOALS' | 'FIN_REPORTS' | 'FIN_CATEGORIES' | 'FIN_CONTACTS' | 'FIN_ADVISOR' |
  // System
  'SYS_CONTACTS' | 'SYS_ACCESS' | 'SYS_LOGS' | 'SYS_SETTINGS' |
  // Odonto
  'ODONTO_AGENDA' | 'ODONTO_PATIENTS' | 'ODONTO_PROCEDURES' |
  // Services & Sales
  'SRV_OS' | 'SRV_SALES' | 'SRV_PURCHASES' | 'SRV_CONTRACTS' | 'SRV_NF' | 'SRV_CLIENTS';

// --- PJ INTERFACES ---

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
    taxRegime: TaxRegime;
    cnae: string; // Atividade Principal
    secondaryCnaes?: string;
    
    // Endereço
    zipCode: string;
    street: string;
    number: string;
    neighborhood: string;
    city: string;
    state: string;
    
    // Contato
    phone: string;
    email: string;

    // Configs
    hasEmployees: boolean;
    issuesInvoices: boolean;
}

export interface Branch { id: string; name: string; code?: string; }
export interface CostCenter { id: string; name: string; code?: string; }
export interface Department { id: string; name: string; }
export interface Project { id: string; name: string; }

// --- MODULES & AUDIT ---

export interface AuditLog {
    id: number;
    userId: string;
    userName?: string;
    action: 'CREATE' | 'UPDATE' | 'DELETE' | 'RESTORE' | 'REVERT';
    entity: string;
    entityId: string;
    details: string;
    timestamp: string;
    isDeleted?: boolean;
    previousState?: any;
    changes?: Record<string, { old: any, new: any }>;
}

export interface NotificationLog {
    id: number;
    userId: string;
    userName?: string;
    channel: 'EMAIL' | 'WHATSAPP';
    recipient: string;
    subject?: string;
    content?: string;
    status: 'SENT' | 'FAILED';
    createdAt: string;
}

export interface ServiceClient {
    id: string;
    contactId: string;
    contactName?: string; // Resolved
    contactEmail?: string;
    contactPhone?: string;
    notes?: string; // Anamnese / Histórico
    birthDate?: string;
    moduleTag: string; // 'ODONTO', 'FISIO', etc.
    
    // Specifics
    insurance?: string; // Convênio
    allergies?: string;
    medications?: string;
}

export interface ServiceItem {
    id: string;
    name: string; // "Limpeza", "Consulta"
    code?: string;
    defaultPrice: number;
    moduleTag: string;
}

export interface ServiceAppointment {
    id: string;
    clientId: string;
    clientName?: string; // Resolved
    serviceId?: string;
    serviceName?: string; // Resolved
    date: string;
    status: 'SCHEDULED' | 'COMPLETED' | 'CANCELED';
    notes?: string;
    transactionId?: string; // Link to finance
    moduleTag: string;
}

// --- NEW SERVICE MODULE TYPES ---

export interface ServiceOrder {
    id: string;
    number?: number;
    title: string;
    description?: string;
    contactId?: string;
    contactName?: string;
    status: 'OPEN' | 'IN_PROGRESS' | 'DONE' | 'CANCELED';
    totalAmount: number;
    startDate?: string;
    endDate?: string;
}

export interface CommercialOrder {
    id: string;
    type: 'SALE' | 'PURCHASE';
    description: string;
    contactId?: string;
    contactName?: string;
    amount: number;
    date: string;
    status: 'DRAFT' | 'CONFIRMED' | 'CANCELED';
    transactionId?: string;
}

export interface Contract {
    id: string;
    title: string;
    contactId?: string;
    contactName?: string;
    value: number;
    startDate: string;
    endDate?: string;
    status: 'ACTIVE' | 'EXPIRED' | 'CANCELED';
    billingDay?: number;
}

export interface Invoice {
    id: string;
    number?: string;
    series?: string;
    type: 'ISS' | 'ICMS';
    amount: number;
    issueDate: string;
    status: 'ISSUED' | 'CANCELED' | 'ERROR';
    contactId?: string;
    contactName?: string;
    fileUrl?: string;
}

// --- ACCESS CONTROL ROLES ---

export interface RoleTemplate {
    id: string;
    label: string;
    description: string;
    defaultPermissions: string[];
    requiredModule?: string; // Se definido, o perfil só aparece se o módulo estiver ativo
}

export const ROLE_DEFINITIONS: RoleTemplate[] = [
    { 
        id: 'ADMIN', 
        label: 'Administrador', 
        description: 'Acesso total a todos os módulos e configurações.', 
        defaultPermissions: [] // Admin bypasses checks
    }, 
    { 
        id: 'MEMBER', 
        label: 'Membro Padrão', 
        description: 'Acesso às finanças básicas (Lançamentos, Contas, Metas).', 
        defaultPermissions: ['FIN_DASHBOARD', 'FIN_TRANSACTIONS', 'FIN_CALENDAR', 'FIN_ACCOUNTS', 'FIN_CARDS', 'FIN_GOALS', 'FIN_REPORTS', 'FIN_CATEGORIES', 'FIN_CONTACTS'] 
    },
    { 
        id: 'ACCOUNTANT', 
        label: 'Contador / Auditor', 
        description: 'Visualização de relatórios, extratos e logs de auditoria.', 
        defaultPermissions: ['FIN_REPORTS', 'FIN_TRANSACTIONS', 'SYS_LOGS', 'FIN_DASHBOARD', 'FIN_ADVISOR'] 
    },
    { 
        id: 'DENTIST', 
        label: 'Profissional Odonto', 
        description: 'Acesso focado na agenda e pacientes.', 
        defaultPermissions: ['ODONTO_AGENDA', 'ODONTO_PATIENTS', 'ODONTO_PROCEDURES', 'FIN_CONTACTS'],
        requiredModule: 'odonto'
    },
    { 
        id: 'SALES', 
        label: 'Vendedor', 
        description: 'Acesso a pedidos de venda, clientes e orçamentos.', 
        defaultPermissions: ['SRV_SALES', 'SRV_CLIENTS', 'SRV_OS', 'SRV_NF', 'FIN_CONTACTS'],
        requiredModule: 'services'
    },
    {
        id: 'OPERATOR',
        label: 'Operador Financeiro',
        description: 'Pode lançar contas e OS, sem acesso a relatórios gerenciais.',
        defaultPermissions: ['FIN_TRANSACTIONS', 'SRV_OS', 'FIN_CALENDAR', 'SRV_PURCHASES']
    }
];
