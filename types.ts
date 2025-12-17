
export enum EntityType {
  PERSONAL = 'PF',
  BUSINESS = 'PJ'
}

export enum SubscriptionPlan {
  MONTHLY = 'MONTHLY',
  YEARLY = 'YEARLY',
  TRIAL = 'TRIAL'
}

export enum TransactionType {
  INCOME = 'INCOME',
  EXPENSE = 'EXPENSE',
  TRANSFER = 'TRANSFER'
}

export enum TransactionStatus {
  PAID = 'PAID',
  PENDING = 'PENDING',
  OVERDUE = 'OVERDUE'
}

export enum AccountType {
  WALLET = 'WALLET',
  BANK = 'BANK',
  CARD = 'CARD',
  INVESTMENT = 'INVESTMENT',
  MEAL_VOUCHER = 'MEAL_VOUCHER'
}

export enum RecurrenceFrequency {
  WEEKLY = 'WEEKLY',
  MONTHLY = 'MONTHLY',
  YEARLY = 'YEARLY'
}

export enum TransactionClassification {
  STANDARD = 'STANDARD',
  ADVANCE = 'ADVANCE',
  CASH_REPLENISHMENT = 'CASH_REPLENISHMENT',
  INTER_BRANCH = 'INTER_BRANCH'
}

export enum TaxRegime {
  MEI = 'MEI',
  SIMPLES = 'SIMPLES',
  PRESUMIDO = 'PRESUMIDO',
  REAL = 'REAL'
}

export type ViewMode = 
  | 'FIN_DASHBOARD' | 'FIN_TRANSACTIONS' | 'FIN_CALENDAR' | 'FIN_ACCOUNTS' 
  | 'FIN_CARDS' | 'FIN_GOALS' | 'FIN_REPORTS' | 'FIN_ADVISOR' | 'FIN_CATEGORIES' 
  | 'FIN_CONTACTS' 
  | 'SRV_OS' | 'SRV_SALES' | 'SRV_PURCHASES' | 'SRV_CATALOG' | 'SRV_CONTRACTS' | 'SRV_NF' | 'SRV_CLIENTS'
  | 'ODONTO_AGENDA' | 'ODONTO_PATIENTS' | 'ODONTO_PROCEDURES'
  | 'SYS_CONTACTS' | 'SYS_ACCESS' | 'SYS_LOGS' | 'SYS_SETTINGS';

export interface AppSettings {
  includeCreditCardsInTotal: boolean;
  activeModules?: {
    odonto?: boolean;
    services?: boolean;
    [key: string]: boolean | undefined;
  };
  whatsapp?: {
    enabled: boolean;
    phoneNumber: string;
    notifyDueToday: boolean;
    notifyDueTomorrow: boolean;
    notifyOverdue: boolean;
  };
  email?: {
    enabled: boolean;
    email: string;
    notifyDueToday: boolean;
    notifyWeeklyReport: boolean;
  };
}

export interface User {
  id: string;
  name: string;
  email: string;
  familyId: string;
  settings?: AppSettings;
  role: 'ADMIN' | 'USER' | string;
  entityType: EntityType; // PF or PJ
  plan?: SubscriptionPlan;
  status?: string;
  trialEndsAt?: string | Date;
  workspaces?: any[];
  googleId?: string;
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

export interface Category {
  id: string;
  name: string;
  type: TransactionType;
}

export interface Contact {
  id: string;
  name: string;
  fantasyName?: string;
  type: 'PF' | 'PJ' | string;
  email?: string;
  phone?: string;
  document?: string;
  ie?: string; // Inscricao Estadual
  im?: string; // Inscricao Municipal
  pixKey?: string;
  
  // Address
  zipCode?: string;
  street?: string;
  number?: string;
  neighborhood?: string;
  city?: string;
  state?: string;

  // Financial
  isDefaulter?: boolean;
  isBlocked?: boolean;
  creditLimit?: number;
  defaultPaymentMethod?: string;
  defaultPaymentTerm?: number;
}

export interface Transaction {
  id: string;
  description: string;
  amount: number;
  type: TransactionType;
  category: string;
  date: string; // ISO Date string YYYY-MM-DD
  status: TransactionStatus;
  accountId: string;
  destinationAccountId?: string; // For transfers
  
  isRecurring: boolean;
  recurrenceFrequency?: RecurrenceFrequency;
  recurrenceEndDate?: string;
  
  interestRate?: number;
  contactId?: string;
  goalId?: string; // Linked goal
  
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

// PJ Entities
export interface CompanyProfile {
  id: string;
  tradeName: string;
  legalName: string;
  cnpj: string;
  taxRegime: TaxRegime;
  cnae: string;
  secondaryCnaes?: string;
  
  zipCode: string;
  street: string;
  number: string;
  neighborhood: string;
  city: string;
  state: string;
  
  phone: string;
  email: string;
  
  hasEmployees: boolean;
  issuesInvoices: boolean;
}

export interface Branch {
  id: string;
  name: string;
  code?: string;
}

export interface CostCenter {
  id: string;
  name: string;
  code?: string;
}

export interface Department {
  id: string;
  name: string;
}

export interface Project {
  id: string;
  name: string;
}

// Modules
export interface ServiceClient {
    id: string;
    contactId?: string;
    contactName?: string;
    contactEmail?: string;
    contactPhone?: string;
    notes?: string;
    birthDate?: string;
    insurance?: string;
    allergies?: string;
    medications?: string;
    moduleTag: string;
}

export interface ServiceItem {
    id: string;
    name: string; 
    code?: string; // SKU or Internal Code
    type: 'SERVICE' | 'PRODUCT'; // Default SERVICE
    defaultPrice: number; // Selling Price
    costPrice?: number;   // Cost Price (For Margin)
    unit?: string;        // UN, KG, L, HOUR, SESSION
    description?: string;
    moduleTag: string;
    imageUrl?: string;
}

export interface ServiceAppointment {
    id: string;
    clientId: string;
    clientName?: string;
    serviceId?: string;
    serviceName?: string;
    date: string; // ISO Datetime
    status: 'SCHEDULED' | 'COMPLETED' | 'CANCELED';
    notes?: string;
    transactionId?: string;
    moduleTag?: string;
}

export interface ServiceOrder {
    id: string;
    number?: number;
    title: string;
    description?: string;
    contactId: string;
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
    contactId: string;
    contactName?: string;
    amount: number;
    date: string;
    status: 'DRAFT' | 'CONFIRMED' | 'CANCELED';
    transactionId?: string;
}

export interface Contract {
    id: string;
    title: string;
    contactId: string;
    contactName?: string;
    value: number;
    startDate: string;
    endDate?: string;
    status: 'ACTIVE' | 'EXPIRED' | 'CANCELED';
    billingDay?: number;
}

export interface Invoice {
    id: string;
    number: string;
    series?: string;
    type: 'ISS' | 'ICMS';
    amount: number;
    issueDate: string;
    status: 'ISSUED' | 'CANCELED' | 'PAID';
    contactId: string;
    contactName?: string;
    fileUrl?: string;
}

// System
export interface AuditLog {
    id: number;
    userId: string;
    userName?: string;
    action: 'CREATE' | 'UPDATE' | 'DELETE' | 'RESTORE' | 'REVERT';
    entity: string;
    entityId: string;
    details: string;
    timestamp: string;
    previousState?: any;
    changes?: Record<string, { old: any, new: any }>;
    isDeleted?: boolean;
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

export interface Member {
    id: string;
    name: string;
    email: string;
    role: 'ADMIN' | 'MEMBER' | string;
    entityType?: EntityType;
    permissions?: string[];
}

export interface AppState {
    accounts: Account[];
    transactions: Transaction[];
    goals: FinancialGoal[];
    contacts: Contact[];
    categories: Category[];
    
    // PJ
    companyProfile?: CompanyProfile | null;
    branches: Branch[];
    costCenters: CostCenter[];
    departments: Department[];
    projects: Project[];

    // Modules
    serviceClients: ServiceClient[];
    serviceItems: ServiceItem[];
    serviceAppointments: ServiceAppointment[];
    
    // Service Module
    serviceOrders: ServiceOrder[];
    commercialOrders: CommercialOrder[];
    contracts: Contract[];
    invoices: Invoice[];
}

export const ROLE_DEFINITIONS = [
    { 
        id: 'ADMIN', 
        label: 'Administrador', 
        description: 'Acesso total ao sistema.',
        defaultPermissions: [] 
    },
    { 
        id: 'MEMBER', 
        label: 'Membro Familiar', 
        description: 'Visualiza e edita lançamentos, contas e metas.',
        defaultPermissions: ['FIN_DASHBOARD', 'FIN_TRANSACTIONS', 'FIN_CALENDAR', 'FIN_ACCOUNTS', 'FIN_CARDS', 'FIN_GOALS', 'FIN_REPORTS', 'FIN_CATEGORIES', 'FIN_CONTACTS'] 
    },
    { 
        id: 'ACCOUNTANT', 
        label: 'Contador / Auditor', 
        description: 'Acesso a relatórios e extratos para conferência.',
        defaultPermissions: ['FIN_REPORTS', 'FIN_TRANSACTIONS', 'SYS_LOGS', 'FIN_DASHBOARD'] 
    },
    { 
        id: 'DENTIST', 
        label: 'Dentista / Profissional', 
        description: 'Acesso à agenda e pacientes (Módulo Odonto).',
        requiredModule: 'odonto',
        defaultPermissions: ['ODONTO_AGENDA', 'ODONTO_PATIENTS', 'ODONTO_PROCEDURES', 'FIN_CONTACTS'] 
    },
    { 
        id: 'SALES', 
        label: 'Vendedor', 
        description: 'Acesso a vendas, clientes e emissão de OS.',
        requiredModule: 'services',
        defaultPermissions: ['SRV_SALES', 'SRV_CLIENTS', 'SRV_OS', 'SRV_NF', 'FIN_CONTACTS'] 
    },
    { 
        id: 'OPERATOR', 
        label: 'Operacional', 
        description: 'Lançamento de despesas e execução de serviços.',
        defaultPermissions: ['FIN_TRANSACTIONS', 'SRV_OS', 'FIN_CALENDAR', 'SRV_PURCHASES'] 
    }
];
