

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

export type OSStatus = 'ABERTA' | 'APROVADA' | 'AGENDADA' | 'EM_EXECUCAO' | 'PAUSADA' | 'FINALIZADA';
export type OSType = 'MANUTENCAO' | 'INSTALACAO' | 'REPARO' | 'OUTRO';
export type OSOrigin = 'MANUAL' | 'EXTERNO' | 'ORCAMENTO';
export type OSPriority = 'BAIXA' | 'MEDIA' | 'ALTA' | 'URGENTE';

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

export interface ToothState {
  tooth: number;
  condition: 'HEALTHY' | 'CAVITY' | 'FILLING' | 'MISSING' | 'CROWN' | 'ENDO' | 'IMPLANT';
  notes?: string;
  isDeciduous?: boolean; // Se dente de leite
}

export interface Anamnesis {
  heartProblem: boolean;
  hypertension: boolean;
  diabetes: boolean;
  allergy: boolean;
  anestheticAllergy: boolean; // Crítico
  bleedingProblem: boolean;
  isPregnant: boolean;
  bisphosphonates: boolean; // Importante para cirurgias
  medications: string;
  notes: string;
}

export interface Prescription {
  id: string;
  date: string;
  content: string;
  type: 'RECEITA' | 'ATESTADO' | 'ORIENTACAO';
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
  googleId?: string;
  workspaces?: Member[];
}

export interface Member {
  id: string;
  name: string;
  email: string;
  role: 'ADMIN' | 'MEMBER';
  permissions?: string[] | string;
  entityType?: EntityType;
  ownerSettings?: AppSettings;
}

export interface Contact {
  id: string;
  name: string;
  fantasyName?: string;
  type: 'PF' | 'PJ';
  email?: string;
  phone?: string;
  document?: string;
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

export interface Account {
  id: string;
  name: string;
  type: AccountType;
  balance: number;
  creditLimit?: number;
  closingDay?: number;
  dueDay?: number;
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
  contactId?: string;
  isRecurring?: boolean;
  recurrenceFrequency?: RecurrenceFrequency;
  recurrenceEndDate?: string;
  receiptUrls?: string[];
  createdByName?: string;
  interestRate?: number;
  goalId?: string;
  branchId?: string;
  costCenterId?: string;
  departmentId?: string;
  projectId?: string;
  classification?: TransactionClassification;
}

export interface Category {
  id: string;
  name: string;
  type: TransactionType;
}

export interface FinancialGoal {
  id: string;
  name: string;
  targetAmount: number;
  currentAmount?: number;
  current_amount?: number; // DB compatibility
  deadline: string;
}

export interface CompanyProfile {
  id: string;
  tradeName: string;
  legalName: string;
  cnpj: string;
  taxRegime: TaxRegime;
  cnae?: string;
  secondaryCnaes?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  street?: string;
  number?: string;
  neighborhood?: string;
  phone?: string;
  email?: string;
  hasEmployees?: boolean;
  issuesInvoices?: boolean;
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
  insuranceNumber?: string;
  allergies?: string;
  legalGuardianName?: string;
  legalGuardianPhone?: string;
  moduleTag: string;
  attachments?: string[];
  odontogram?: ToothState[];
  anamnesis?: Anamnesis;
  prescriptions?: Prescription[];
}

export interface ServiceItem {
  id: string;
  name: string; 
  code?: string;
  type: 'SERVICE' | 'PRODUCT';
  defaultPrice: number;
  moduleTag: string;
  costPrice?: number;
  defaultDuration?: number;
  isComposite?: boolean;
  items?: OSItem[];
  brand?: string;
  unit?: string;
  description?: string;
  imageUrl?: string;
}

export interface OSItem {
  id: string;
  serviceItemId?: string;
  code?: string;
  description: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  estimatedDuration?: number;
  realDuration?: number;
  isBillable?: boolean;
  technician?: string;
  costPrice?: number;
  isFromCatalog?: boolean;
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
  clinicalNotes?: string;
  moduleTag: string;
  attachments?: string[];
  isLocked?: boolean; // Impedir edição legal
}

/** 
 * Fix: Added missing interfaces before AppState
 */
export interface ServiceOrder {
  id: string;
  number?: string;
  title: string;
  description: string;
  contactId?: string;
  contactName?: string;
  status: OSStatus;
  totalAmount: number;
  startDate?: string;
  endDate?: string;
  items: OSItem[];
  type: OSType;
  origin: OSOrigin;
  priority: OSPriority;
  openedAt: string;
  assigneeId?: string;
  assigneeName?: string;
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
  items: OSItem[];
  date: string;
  status: string;
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
  status: string;
  billingDay?: number;
}

export interface Invoice {
  id: string;
  number: string;
  series: string;
  type: string;
  amount: number;
  issueDate: string;
  status: string;
  contactId?: string;
  contactName?: string;
  description?: string;
  items: OSItem[];
  fileUrl?: string;
  orderId?: string;
  serviceOrderId?: string;
}

export interface AppState {
  accounts: Account[];
  transactions: Transaction[];
  contacts: Contact[];
  serviceClients: ServiceClient[];
  serviceItems: ServiceItem[];
  serviceAppointments: ServiceAppointment[];
  goals: FinancialGoal[];
  categories: Category[];
  branches: Branch[];
  costCenters: CostCenter[];
  departments: Department[];
  projects: Project[];
  serviceOrders: ServiceOrder[];
  commercialOrders: CommercialOrder[];
  contracts: Contract[];
  invoices: Invoice[];
  companyProfile?: CompanyProfile | null;
}

/**
 * Fix: Added missing exported members for storageService and others
 */
export interface AuthResponse {
  token: string;
  user: User;
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
  changes?: any;
  isDeleted?: boolean;
}

export interface NotificationLog {
  id: number;
  status: 'SENT' | 'FAILED';
  channel: 'EMAIL' | 'WHATSAPP';
  recipient: string;
  subject: string;
  content: string;
  userName: string;
  createdAt: string;
}

export interface AppNotification {
    id: string;
    title: string;
    message: string;
    timestamp: string;
    type: 'INFO' | 'SUCCESS' | 'WARNING';
    isRead: boolean;
    entity?: string;
    entityId?: string;
}

export interface RoleDefinition {
  id: string;
  label: string;
  description: string;
  defaultPermissions: string[];
  requiredModule?: 'odonto' | 'services' | 'intelligence';
}

export const ROLE_DEFINITIONS: RoleDefinition[] = [
  {
      id: 'ADMIN',
      label: 'Administrador',
      description: 'Acesso total ao sistema e gestão de equipe.',
      defaultPermissions: []
  },
  {
      id: 'FIN_MANAGER',
      label: 'Gerente Financeiro',
      description: 'Gestão completa de contas, lançamentos e relatórios.',
      defaultPermissions: ['FIN_DASHBOARD', 'FIN_TRANSACTIONS', 'FIN_CALENDAR', 'FIN_ACCOUNTS', 'FIN_CARDS', 'FIN_GOALS', 'FIN_REPORTS', 'FIN_CATEGORIES', 'FIN_CONTACTS']
  },
  {
      id: 'SALES_REP',
      label: 'Vendedor / Comercial',
      description: 'Foco em orçamentos, vendas e catálogo de itens.',
      requiredModule: 'services',
      defaultPermissions: ['FIN_DASHBOARD', 'SRV_SALES', 'SRV_CATALOG', 'SRV_CLIENTS', 'FIN_CONTACTS']
  },
  {
      id: 'TECH_OPERATOR',
      label: 'Técnico Operacional',
      description: 'Gestão de ordens de serviço e execução técnica.',
      requiredModule: 'services',
      defaultPermissions: ['FIN_DASHBOARD', 'SRV_OS', 'SRV_CATALOG', 'SRV_CLIENTS']
  },
  {
      id: 'ODONTO_DOC',
      label: 'Dentista / Clínico',
      description: 'Acesso total ao prontuário, agenda e procedimentos.',
      requiredModule: 'odonto',
      defaultPermissions: ['FIN_DASHBOARD', 'ODONTO_AGENDA', 'ODONTO_PATIENTS', 'ODONTO_PROCEDURES']
  }
];

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
  raw?: any;
}

export interface KanbanColumnConfig {
  id: string;
  label: string;
  color: string;
  borderColor: string;
}
