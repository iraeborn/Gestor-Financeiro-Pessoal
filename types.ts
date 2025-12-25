
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
  | 'DIAG_HUB' | 'DIAG_HEALTH' | 'DIAG_RISK' | 'DIAG_INVEST'
  | 'SYS_CONTACTS' | 'SYS_ACCESS' | 'SYS_LOGS' | 'SYS_SETTINGS';

export interface AppSettings {
  includeCreditCardsInTotal: boolean;
  activeModules?: {
    odonto?: boolean;
    services?: boolean;
    intelligence?: boolean;
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
    notifyDueTomorrow: boolean;
    notifyOverdue: boolean;
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

export interface AuthResponse {
  token: string;
  user: User;
}

export interface Workspace {
  id: string;
  name: string;
  role: string;
  entityType: EntityType;
  permissions: string[];
  ownerSettings?: AppSettings;
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
  current_amount: number; // Snake case adjustment from DB
  currentAmount?: number; // Camel case for frontend
  deadline: string;
}

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
    code?: string;
    type: 'SERVICE' | 'PRODUCT';
    isComposite?: boolean;
    defaultPrice: number;
    costPrice?: number;
    unit?: string;
    defaultDuration?: number;
    description?: string;
    moduleTag: string;
    imageUrl?: string;
    brand?: string;
    items?: OSItem[];
}

export interface ServiceAppointment {
  id: string;
  clientId: string;
  clientName?: string;
  serviceId?: string;
  serviceName?: string;
  date: string;
  status: 'SCHEDULED' | 'COMPLETED' | 'CANCELED';
  notes?: string;
  transactionId?: string;
  moduleTag: string;
}

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
    estimatedDuration?: number;
    realDuration?: number;
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
  openedAt: string;
  startDate?: string;
  endDate?: string;
  items: OSItem[];
  totalAmount: number;
  assigneeId?: string;
  assigneeName?: string;
}

export interface CommercialOrder {
  id: string;
  type: 'SALE' | 'PURCHASE';
  description: string;
  contact_id?: string; // DB Mapping
  contactId?: string;
  contactName?: string;
  amount: number;
  grossAmount?: number;
  discountAmount?: number;
  taxAmount?: number;
  items?: OSItem[];
  date: string;
  status: 'DRAFT' | 'APPROVED' | 'CONFIRMED' | 'CANCELED' | 'ON_HOLD' | 'REJECTED';
  transactionId?: string;
  accessToken?: string;
  assigneeId?: string;
  assigneeName?: string;
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
  issue_date: string;
  status: 'ISSUED' | 'CANCELED';
  contactId?: string;
  contactName?: string;
  description?: string;
  items?: OSItem[];
  fileUrl?: string;
  orderId?: string;
  serviceOrderId?: string;
}

export interface AppNotification {
    id: string;
    title: string;
    message: string;
    type: 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR';
    entity: 'order' | 'os' | 'system';
    entityId: string;
    timestamp: string;
    isRead: boolean;
    data?: any;
}

export interface Member {
  id: string;
  name: string;
  email: string;
  role: string;
  entityType: EntityType;
  permissions: string[];
}

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

// Kanban Component Props
export interface KanbanItem {
    id: string;
    title: string;
    subtitle?: string;
    status: string;
    priority?: OSPriority;
    amount?: number;
    date?: string;
    tags?: string[];
    assigneeName?: string;
    raw?: any; // Objeto original
}

export interface KanbanColumnConfig {
    id: string;
    label: string;
    color: string; // Tailwind class
    borderColor: string;
}

/**
 * Interface for pre-configured roles used in invite and access management
 */
export interface RoleDefinition {
    id: string;
    label: string;
    description: string;
    defaultPermissions: string[];
    requiredModule?: string;
}

/**
 * Pre-defined role templates for quick setup of new members
 */
export const ROLE_DEFINITIONS: RoleDefinition[] = [
    {
        id: 'ADMIN',
        label: 'Administrador',
        description: 'Acesso total ao sistema e gestão de equipe.',
        defaultPermissions: [] // Admins usually get everything logic-wise
    },
    {
        id: 'MEMBER',
        label: 'Membro Padrão',
        description: 'Acesso às funções financeiras básicas.',
        defaultPermissions: ['FIN_DASHBOARD', 'FIN_TRANSACTIONS', 'FIN_CALENDAR']
    },
    {
        id: 'ACCOUNTANT',
        label: 'Contador',
        description: 'Foco em relatórios, lançamentos e notas fiscais.',
        defaultPermissions: ['FIN_DASHBOARD', 'FIN_TRANSACTIONS', 'FIN_REPORTS', 'SRV_NF']
    },
    {
        id: 'SALES',
        label: 'Vendedor',
        description: 'Gestão de vendas, orçamentos e clientes.',
        defaultPermissions: ['FIN_DASHBOARD', 'SRV_SALES', 'SRV_CLIENTS', 'SRV_CATALOG'],
        requiredModule: 'services'
    },
    {
        id: 'OPERATIONAL',
        label: 'Operacional',
        description: 'Gestão de ordens de serviço e execução.',
        defaultPermissions: ['FIN_DASHBOARD', 'SRV_OS', 'SRV_CLIENTS'],
        requiredModule: 'services'
    },
    {
        id: 'DENTIST',
        label: 'Dentista / Profissional',
        description: 'Agenda clínica e procedimentos.',
        defaultPermissions: ['FIN_DASHBOARD', 'ODONTO_AGENDA', 'ODONTO_PATIENTS', 'ODONTO_PROCEDURES'],
        requiredModule: 'odonto'
    }
];
