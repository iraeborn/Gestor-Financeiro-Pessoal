
export type OpticalDeliveryStatus = 'LAB_PENDENTE' | 'LAB_RECEBIDO' | 'CONFERIDO' | 'PRONTO_ENTREGA' | 'ENTREGUE' | 'NAO_ENTREGUE';

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

export type OSStatus = 'ABERTA' | 'APROVADA' | 'AGENDADA' | 'EM_EXECUCAO' | 'PAUSADA' | 'FINALIZADA' | 'PRONTA' | 'ENTREGUE';
export type OSType = 'MANUTENCAO' | 'INSTALACAO' | 'REPARO' | 'MONTAGEM_OTICA' | 'OUTRO';
export type OSOrigin = 'MANUAL' | 'EXTERNO' | 'ORCAMENTO' | 'VENDA_OTICA';
export type OSPriority = 'BAIXA' | 'MEDIA' | 'ALTA' | 'URGENTE';

export type ViewMode = 
  | 'FIN_DASHBOARD' | 'FIN_TRANSACTIONS' | 'FIN_CALENDAR' | 'FIN_ACCOUNTS' | 'FIN_CARDS' | 'FIN_GOALS' | 'FIN_REPORTS' | 'FIN_ADVISOR' | 'FIN_CATEGORIES' | 'FIN_CONTACTS'
  | 'SRV_OS' | 'SRV_SALES' | 'SRV_PURCHASES' | 'SRV_CATALOG' | 'SRV_CONTRACTS' | 'SRV_NF' | 'SRV_CLIENTS'
  | 'OPTICAL_RX' | 'OPTICAL_RX_EDITOR' | 'OPTICAL_SALES' | 'OPTICAL_LAB'
  | 'ODONTO_AGENDA' | 'ODONTO_PATIENTS' | 'ODONTO_PROCEDURES'
  | 'DIAG_HUB' | 'DIAG_HEALTH' | 'DIAG_RISK' | 'DIAG_INVEST'
  | 'SYS_CONTACTS' | 'SYS_ACCESS' | 'SYS_LOGS' | 'SYS_SETTINGS';

export interface AppSettings {
  includeCreditCardsInTotal: boolean;
  activeModules?: {
    odonto?: boolean;
    services?: boolean;
    optical?: boolean;
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
}

export interface OpticalRx {
  id: string;
  contactId: string;
  contactName?: string;
  professionalName?: string;
  rxDate: string;
  expirationDate?: string;
  sphereOdLonge?: number;
  cylOdLonge?: number;
  axisOdLonge?: number;
  sphereOdPerto?: number;
  cylOdPerto?: number;
  axisOdPerto?: number;
  sphereOeLonge?: number;
  cylOeLonge?: number;
  axisOeLonge?: number;
  sphereOePerto?: number;
  cylOePerto?: number;
  axisOePerto?: number;
  addition?: number;
  dnpOd?: number;
  dnpOe?: number;
  heightOd?: number;
  heightOe?: number;
  imageUrl?: string;
  observations?: string;
}

export interface ToothState {
  tooth: number;
  condition: 'HEALTHY' | 'CAVITY' | 'FILLING' | 'MISSING' | 'CROWN' | 'ENDO' | 'IMPLANT';
  notes?: string;
}

// Added missing Anamnesis type for ServiceModule
export interface Anamnesis {
  heartProblem?: boolean;
  hypertension?: boolean;
  diabetes?: boolean;
  allergy?: boolean;
  anestheticAllergy?: boolean;
  bleedingProblem?: boolean;
  isPregnant?: boolean;
  bisphosphonates?: boolean;
  medications?: string;
  notes?: string;
}

// Added missing Prescription type
export interface Prescription {
  id: string;
  date: string;
  medications: string;
}

// Added missing TreatmentItem type
export interface TreatmentItem {
  id: string;
  serviceId: string;
  serviceName?: string;
  teeth?: number[];
  value: number;
}

// Added missing TreatmentProcedure type
export interface TreatmentProcedure {
  id: string;
  planId: string;
  serviceId: string;
  serviceName: string;
  value: number;
  discount: number;
  netValue: number;
  status: 'PLANNED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  teeth: number[];
  category?: string;
}

// Added missing TreatmentPlan type
export interface TreatmentPlan {
  id: string;
  clientId: string;
  title: string;
  status: 'OPEN' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  createdAt: string;
  procedures: TreatmentProcedure[];
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
  moduleTag: string;
  odontogram?: ToothState[];
  // Added missing clinical data fields
  anamnesis?: Anamnesis;
  prescriptions?: Prescription[];
  attachments?: string[];
  treatmentPlans?: TreatmentPlan[];
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
  // Added missing catalog fields
  brand?: string;
  description?: string;
  imageUrl?: string;
  unit?: string;
}

export interface OSItem {
  id: string;
  serviceItemId?: string;
  code?: string;
  description: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  isBillable?: boolean;
  estimatedDuration?: number;
  // Added technician and cost tracking fields
  technician?: string;
  realDuration?: number;
  costPrice?: number;
}

export interface ServiceOrder {
  id: string;
  number?: number;
  title: string;
  contactId?: string;
  contactName?: string;
  status: OSStatus;
  totalAmount: number;
  openedAt: string;
  type: OSType;
  origin: OSOrigin;
  priority: OSPriority;
  items: OSItem[];
  moduleTag?: string;
  // Added deadline and assignment fields
  endDate?: string;
  description?: string;
  startDate?: string;
  assigneeId?: string;
  assigneeName?: string;
  rxId?: string;
}

export interface CommercialOrder {
  id: string;
  type: 'SALE' | 'PURCHASE';
  description: string;
  contactId?: string;
  contactName?: string;
  amount: number;
  items: OSItem[];
  date: string;
  status: string;
  moduleTag?: string;
  // Added pricing breakdown and assignment fields
  grossAmount?: number;
  discountAmount?: number;
  taxAmount?: number;
  transactionId?: string;
  assigneeId?: string;
  assigneeName?: string;
  rxId?: string;
}

export interface Contract {
  id: string;
  title: string;
  contactId?: string;
  contactName?: string;
  value: number;
  startDate: string;
  status: string;
  // Added end date and billing configuration
  endDate?: string;
  billingDay?: number;
}

export interface Invoice {
  id: string;
  number: string;
  amount: number;
  issueDate: string;
  status: string;
  contactName?: string;
  // Added fiscal and link fields
  series?: string;
  type?: string;
  contactId?: string;
  description?: string;
  items?: OSItem[];
  fileUrl?: string;
  orderId?: string;
  serviceOrderId?: string;
  issue_date?: string;
}

export interface ServiceAppointment {
  id: string;
  clientId: string;
  clientName?: string;
  treatmentItems?: TreatmentItem[];
  date: string;
  status: 'SCHEDULED' | 'COMPLETED' | 'CANCELED';
  moduleTag: string;
  // Added clinical notes and locking
  clinicalNotes?: string;
  notes?: string;
  isLocked?: boolean;
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
  googleId?: string;
  workspaces?: Member[];
  status?: string;
}

export interface Member {
  id: string;
  name: string;
  email: string;
  role: 'ADMIN' | 'MEMBER';
  permissions?: string[] | string;
  ownerSettings?: AppSettings;
}

export interface Contact {
  id: string;
  name: string;
  type: 'PF' | 'PJ';
  email?: string;
  phone?: string;
  document?: string;
  // Added secondary and address fields
  fantasyName?: string;
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
  // Added credit card specific fields
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
  contactId?: string;
  receiptUrls?: string[];
  createdByName?: string;
  // Added missing fields for transfers, recurrence and PJ classification
  destinationAccountId?: string;
  isRecurring?: boolean;
  recurrenceFrequency?: RecurrenceFrequency;
  recurrenceEndDate?: string;
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
  // Added snake_case version for server-side compatibility
  current_amount?: number;
  deadline: string;
}

export interface CompanyProfile {
  id: string;
  tradeName: string;
  legalName: string;
  cnpj: string;
  // Added profile details for PJ settings
  taxRegime?: TaxRegime;
  cnae?: string;
  secondaryCnaes?: string;
  zipCode?: string;
  street?: string;
  number?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
  phone?: string;
  email?: string;
  hasEmployees?: boolean;
  issuesInvoices?: boolean;
}

// Added Branch, CostCenter, Department, Project missing interfaces
export interface Branch { id: string; name: string; code?: string; }
export interface CostCenter { id: string; name: string; code?: string; }
export interface Department { id: string; name: string; }
export interface Project { id: string; name: string; }

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
  opticalRxs: OpticalRx[];
  companyProfile?: CompanyProfile | null;
}

// Added AuthResponse interface
export interface AuthResponse {
  token: string;
  user: User;
}

// Added AuditLog interface
export interface AuditLog {
  id: number;
  userId: string;
  userName?: string;
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'RESTORE' | 'REVERT' | 'JOIN';
  entity: string;
  entityId: string;
  details: string;
  timestamp: string;
  previousState?: any;
  changes?: any;
  isDeleted?: boolean;
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

// Alias AppNotification to NotificationLog to fix storageService error
export type NotificationLog = AppNotification;

export interface RoleDefinition {
  id: string;
  label: string;
  description: string;
  defaultPermissions: string[];
  requiredModule?: 'odonto' | 'services' | 'intelligence' | 'optical';
}

export const ROLE_DEFINITIONS: RoleDefinition[] = [
  {
      id: 'ADMIN',
      label: 'Administrador',
      description: 'Acesso total ao sistema.',
      defaultPermissions: []
  },
  {
      id: 'FIN_MANAGER',
      label: 'Gerente Financeiro',
      description: 'Gestão completa de contas.',
      defaultPermissions: ['FIN_DASHBOARD', 'FIN_TRANSACTIONS', 'FIN_ACCOUNTS', 'FIN_REPORTS']
  },
  {
      id: 'SALES_REP',
      label: 'Vendedor',
      description: 'Foco em orçamentos e vendas.',
      requiredModule: 'services',
      defaultPermissions: ['FIN_DASHBOARD', 'SRV_SALES', 'SRV_CLIENTS']
  }
];

export interface HelpStep {
  id: string;
  targetId: string;
  title: string;
  content: string;
  view: ViewMode;
  position: 'top' | 'bottom' | 'left' | 'right';
}

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
