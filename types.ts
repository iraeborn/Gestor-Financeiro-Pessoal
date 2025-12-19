
export enum EntityType {
  PERSONAL = 'PF',
  BUSINESS = 'PJ'
}

export enum SubscriptionPlan {
  MONTHLY = 'MONTHLY',
  YEARLY = 'YEARLY',
  TRIAL = 'TRIAL'
}

export enum TaxRegime {
  MEI = 'MEI',
  SIMPLES = 'SIMPLES',
  PRESUMIDO = 'PRESUMIDO',
  REAL = 'REAL'
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

export type ViewMode = 
  | 'FIN_DASHBOARD' | 'FIN_TRANSACTIONS' | 'FIN_CALENDAR' | 'FIN_ACCOUNTS' | 'FIN_CARDS' | 'FIN_GOALS' | 'FIN_REPORTS' | 'FIN_ADVISOR' | 'FIN_CATEGORIES' | 'FIN_CONTACTS'
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
  role: string;
  entityType: EntityType;
  plan: SubscriptionPlan;
  status: string;
  trialEndsAt?: string; // or Date
  googleId?: string;
  workspaces?: Workspace[];
}

export interface Workspace {
  id: string;
  name: string;
  role: string;
  entityType: EntityType;
  permissions: string[];
  ownerSettings?: AppSettings;
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
  name: string;
  fantasyName?: string;
  type: 'PF' | 'PJ';
  email?: string;
  phone?: string;
  document?: string; // CPF/CNPJ
  ie?: string;
  im?: string;
  pixKey?: string;
  zipCode?: string;
  street?: string;
  number?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
  isDefaulter?: boolean;
  isBlocked?: boolean;
  creditLimit?: number;
  defaultPaymentMethod?: string;
  defaultPaymentTerm?: number;
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
  date: string; // YYYY-MM-DD
  status: TransactionStatus;
  accountId: string;
  destinationAccountId?: string;
  isRecurring?: boolean;
  recurrenceFrequency?: RecurrenceFrequency;
  recurrenceEndDate?: string;
  interestRate?: number;
  contactId?: string;
  goalId?: string;
  receiptUrls?: string[];
  // PJ fields
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
  city: string;
  state: string;
  hasEmployees: boolean;
  issuesInvoices: boolean;
  zipCode?: string;
  street?: string;
  number?: string;
  neighborhood?: string;
  phone?: string;
  email?: string;
  secondaryCnaes?: string;
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
  moduleTag: string; // 'ODONTO', 'GENERAL', etc
}

export interface ServiceItem {
    id: string;
    name: string; 
    code?: string; // SKU or Internal Code
    type: 'SERVICE' | 'PRODUCT'; // Default SERVICE
    isComposite?: boolean; // NEW: If true, price is sum of items
    defaultPrice: number; // Selling Price
    costPrice?: number;   // Cost Price (For Margin)
    unit?: string;        // UN, KG, L, HOUR, SESSION
    defaultDuration?: number; // In minutes
    description?: string;
    moduleTag: string;
    imageUrl?: string;
    brand?: string;
    items?: OSItem[]; // Composição
}

export interface ServiceAppointment {
  id: string;
  clientId: string;
  clientName?: string;
  serviceId?: string;
  serviceName?: string;
  date: string; // ISO datetime
  status: 'SCHEDULED' | 'COMPLETED' | 'CANCELED';
  notes?: string;
  transactionId?: string;
  moduleTag: string;
}

// Service & Sales Module
export type OSStatus = 
    | 'ABERTA' | 'APROVADA' | 'AGENDADA' | 'EM_EXECUCAO' 
    | 'PAUSADA' | 'AGUARDANDO_CLIENTE' | 'AGUARDANDO_MATERIAL' 
    | 'FINALIZADA' | 'CANCELADA';

export type OSType = 'PREVENTIVA' | 'CORRETIVA' | 'INSTALACAO' | 'MANUTENCAO' | 'CONSULTORIA' | 'EMERGENCIAL';
export type OSOrigin = 'MANUAL' | 'ORCAMENTO' | 'VENDA' | 'CONTRATO';
export type OSPriority = 'BAIXA' | 'MEDIA' | 'ALTA' | 'URGENTE';

export interface OSItem {
    id: string;
    serviceItemId?: string;
    code?: string;
    description: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
    technician?: string;
    estimatedDuration?: number; // minutes
    realDuration?: number; // minutes
    isBillable: boolean;
}

export interface ServiceOrder {
  id: string;
  number?: number;
  title: string;
  description?: string;
  contactId?: string;
  contactName?: string;
  
  type: OSType;
  origin: OSOrigin;
  priority: OSPriority;
  status: OSStatus;
  
  openedAt: string; // ISO DateTime
  startDate?: string;
  endDate?: string;
  
  items: OSItem[];
  totalAmount: number;
}

export interface OrderItem {
    id: string;
    serviceItemId?: string;
    description: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
    costPrice?: number;
}

export interface CommercialOrder {
  id: string;
  type: 'SALE' | 'PURCHASE';
  description: string;
  contactId?: string;
  contactName?: string;
  amount: number;
  grossAmount?: number;
  discountAmount?: number;
  taxAmount?: number;
  items?: OrderItem[];
  date: string;
  status: 'DRAFT' | 'APPROVED' | 'CONFIRMED' | 'CANCELED' | 'ON_HOLD' | 'REJECTED';
  transactionId?: string;
  accessToken?: string;
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
  issue_date: string; // compatibility with db
  status: 'ISSUED' | 'CANCELED';
  contactId?: string;
  contactName?: string;
  fileUrl?: string;
}

/**
 * Collaboration Member interface.
 */
export interface Member {
  id: string;
  name: string;
  email: string;
  role: string;
  entityType: EntityType;
  permissions: string[];
}

/**
 * Audit Log entry interface.
 */
export interface AuditLog {
  id: number;
  userId: string;
  userName: string;
  action: string;
  entity: string;
  entityId: string;
  details: string;
  timestamp: string;
  previousState?: any;
  changes?: Record<string, { old: any; new: any }>;
  isDeleted?: boolean;
}

/**
 * Notification Log entry interface.
 */
export interface NotificationLog {
  id: number;
  userId: string;
  userName: string;
  channel: 'EMAIL' | 'WHATSAPP';
  recipient: string;
  subject?: string;
  content: string;
  status: 'SENT' | 'FAILED';
  createdAt: string;
}

export interface AppState {
  accounts: Account[];
  transactions: Transaction[];
  goals: FinancialGoal[];
  contacts: Contact[];
  categories: Category[];
  companyProfile?: CompanyProfile | null;
  branches: Branch[];
  costCenters: CostCenter[];
  departments: Department[];
  projects: Project[];
  serviceClients: ServiceClient[];
  serviceItems: ServiceItem[];
  serviceAppointments: ServiceAppointment[];
  serviceOrders: ServiceOrder[];
  commercialOrders: CommercialOrder[];
  contracts: Contract[];
  invoices: Invoice[];
}

export const ROLE_DEFINITIONS = [
    {
        id: 'ADMIN',
        label: 'Administrador',
        description: 'Acesso total a todas as funcionalidades e configurações.',
        defaultPermissions: []
    },
    {
        id: 'MEMBER',
        label: 'Membro Padrão',
        description: 'Acesso às finanças do dia a dia, mas sem configurações críticas.',
        defaultPermissions: ['FIN_DASHBOARD', 'FIN_TRANSACTIONS', 'FIN_CALENDAR', 'FIN_ACCOUNTS', 'FIN_CARDS', 'FIN_GOALS', 'FIN_REPORTS', 'FIN_CATEGORIES', 'FIN_CONTACTS']
    },
    {
        id: 'ACCOUNTANT',
        label: 'Contador / Auditor',
        description: 'Visualização de relatórios, extratos e logs para contabilidade.',
        defaultPermissions: ['FIN_REPORTS', 'FIN_TRANSACTIONS', 'SYS_LOGS', 'FIN_DASHBOARD', 'FIN_ADVISOR']
    },
    {
        id: 'DENTIST',
        label: 'Dentista / Profissional',
        description: 'Acesso focado na agenda e pacientes (Requer Módulo Odonto).',
        requiredModule: 'odonto',
        defaultPermissions: ['ODONTO_AGENDA', 'ODONTO_PATIENTS', 'ODONTO_PROCEDURES', 'FIN_CONTACTS']
    },
    {
        id: 'SALES',
        label: 'Vendedor',
        description: 'Acesso a vendas, clientes e emissão de notas (Requer Módulo Serviços).',
        requiredModule: 'services',
        defaultPermissions: ['SRV_SALES', 'SRV_CLIENTS', 'SRV_OS', 'SRV_NF', 'FIN_CONTACTS']
    },
    {
        id: 'OPERATOR',
        label: 'Operador Financeiro',
        description: 'Lançamentos de contas a pagar/receber e ordens de serviço.',
        defaultPermissions: ['FIN_TRANSACTIONS', 'SRV_OS', 'FIN_CALENDAR', 'SRV_PURCHASES']
    }
];
