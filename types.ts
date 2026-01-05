
export type OpticalDeliveryStatus = 'LAB_PENDENTE' | 'LAB_ENVIADO' | 'LAB_PRODUCAO' | 'LAB_PRONTO' | 'LAB_RECEBIDO' | 'ENTREGUE_CLIENTE';

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
  | 'FIN_DASHBOARD' | 'FIN_TRANSACTIONS' | 'FIN_CALENDAR' | 'FIN_ACCOUNTS' | 'FIN_CARDS' | 'FIN_GOALS' | 'FIN_REPORTS' | 'FIN_ADVISOR' | 'FIN_CATEGORIES' | 'FIN_CONTACTS' | 'FIN_CONTACT_EDITOR'
  | 'SRV_OS' | 'SRV_OS_EDITOR' | 'SRV_SALES' | 'SRV_SALE_EDITOR' | 'SRV_PURCHASES' | 'SRV_CATALOG' | 'SRV_CONTRACTS' | 'SRV_NF' | 'SRV_CLIENTS' | 'SRV_BRANCH_SCHEDULE'
  | 'OPTICAL_RX' | 'OPTICAL_RX_EDITOR' | 'OPTICAL_SALES' | 'OPTICAL_LAB' | 'OPTICAL_LABS_MGMT'
  | 'ODONTO_AGENDA' | 'ODONTO_PATIENTS' | 'ODONTO_PROCEDURES'
  | 'DIAG_HUB' | 'DIAG_HEALTH' | 'DIAG_RISK' | 'DIAG_INVEST'
  | 'SYS_CONTACTS' | 'SYS_ACCESS' | 'SYS_LOGS' | 'SYS_SETTINGS' | 'SYS_BRANCHES' | 'SYS_CHAT' | 'SYS_SALESPEOPLE' | 'SYS_HELP' | 'SYS_SALES_SCHEDULE';

export interface AppSettings {
  includeCreditCardsInTotal: boolean;
  maxDiscountPct?: number; // Novo: Limite de negociação
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

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  receiverId?: string; // Se nulo, é chat da família/grupo
  familyId: string;
  content: string;
  type: 'TEXT' | 'IMAGE' | 'AUDIO' | 'FILE';
  attachmentUrl?: string;
  createdAt: string;
  isRead?: boolean;
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

export interface Salesperson {
    id: string;
    userId: string;
    name?: string;
    email?: string;
    branchId: string;
    branchName?: string;
    commissionRate: number;
    familyId: string;
}

export interface SalespersonSchedule {
    id: string;
    salespersonId: string;
    salespersonName?: string;
    branchId: string;
    branchName?: string;
    date: string;
    shift: 'FULL' | 'MORNING' | 'AFTERNOON';
    notes?: string;
    familyId: string;
}

export interface Laboratory {
    id: string;
    name: string;
    contactPerson?: string;
    email?: string;
    phone?: string;
    address?: string;
    notes?: string;
    familyId: string;
}

export interface Contact {
  id: string;
  name: string;
  type: 'PF' | 'PJ';
  email?: string;
  phone?: string;
  document?: string;
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
  opticalNotes?: string;
  brandPreference?: string;
  lastConsultationDate?: string;
  yearsOfUse?: number;
  opticalCategory?: 'NORMAL' | 'PREMIUM' | 'KIDS' | 'SPORT';
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
  contactId?: string;
  receiptUrls?: string[];
  createdByName?: string;
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
  userId?: string;
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
  current_amount?: number;
  deadline: string;
}

export interface CompanyProfile {
  id: string;
  familyId?: string;
  tradeName: string;
  legalName: string;
  cnpj: string;
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

export interface Branch { 
    id: string; 
    name: string; 
    code?: string; 
    city?: string; 
    address?: string;
    phone?: string;
    color?: string;
    isActive: boolean;
}
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
  salespeople: Salesperson[];
  salespersonSchedules: SalespersonSchedule[];
  laboratories: Laboratory[];
  companyProfile?: CompanyProfile | null;
}

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
      label: 'Administrador Proprietário',
      description: 'Acesso irrestrito a todos os módulos, configurações financeiras e gestão de equipe.',
      defaultPermissions: []
  },
  {
      id: 'FIN_MANAGER',
      label: 'Gerente Administrativo',
      description: 'Foco total em gestão financeira, contas bancárias, relatórios e auditoria.',
      defaultPermissions: ['FIN_DASHBOARD', 'FIN_TRANSACTIONS', 'FIN_ACCOUNTS', 'FIN_CARDS', 'FIN_REPORTS', 'FIN_GOALS', 'FIN_CATEGORIES', 'FIN_CONTACTS', 'SYS_LOGS', 'SYS_CHAT']
  },
  {
      id: 'SALES_OPTICAL',
      label: 'Vendedor de Ótica',
      description: 'Acesso a vendas, receitas RX, catálogo de produtos e agenda de exames.',
      requiredModule: 'optical',
      defaultPermissions: ['FIN_DASHBOARD', 'SRV_SALES', 'OPTICAL_RX', 'SRV_CATALOG', 'FIN_CONTACTS', 'SRV_BRANCH_SCHEDULE', 'SYS_CHAT', 'OPTICAL_LABS_MGMT']
  },
  {
      id: 'LAB_TECHNICIAN',
      label: 'Técnico de Laboratório',
      description: 'Acesso restrito a Ordens de Serviço (Laboratório) e Receitas RX.',
      requiredModule: 'services',
      defaultPermissions: ['FIN_DASHBOARD', 'SRV_OS', 'OPTICAL_RX', 'SYS_CHAT', 'OPTICAL_LABS_MGMT']
  },
  {
      id: 'DENTIST',
      label: 'Dentista / Clínico',
      description: 'Acesso a agenda clínica e prontuários odontológicos.',
      requiredModule: 'odonto',
      defaultPermissions: ['FIN_DASHBOARD', 'ODONTO_AGENDA', 'ODONTO_PATIENTS', 'FIN_CONTACTS', 'SYS_CHAT']
  }
];

export interface OpticalRx {
  id: string;
  contactId: string;
  contactName?: string;
  professionalName?: string;
  rxDate: string;
  expirationDate?: string;
  status: 'PENDING' | 'APPROVED' | 'CANCELLED'; // Novo campo
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
  branchId?: string;
  
  // Laboratory Fields
  laboratoryId?: string;
  labStatus?: OpticalDeliveryStatus;
  labSentDate?: string;
  labReturnDate?: string;
}

export interface ToothState {
  tooth: number;
  condition: 'HEALTHY' | 'CAVITY' | 'FILLING' | 'MISSING' | 'CROWN' | 'ENDO' | 'IMPLANT';
  notes?: string;
}

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

export interface Prescription {
  id: string;
  date: string;
  medications: string;
}

export interface TreatmentItem {
  id: string;
  serviceId: string;
  serviceName?: string;
  teeth?: number[];
  value: number;
}

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
  technician?: string;
  realDuration?: number;
  cost_price?: number;
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
  endDate?: string;
  description?: string;
  startDate?: string;
  assigneeId?: string;
  assigneeName?: string;
  rxId?: string;
  branchId?: string;
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
  grossAmount?: number;
  discountAmount?: number;
  taxAmount?: number;
  transactionId?: string;
  assigneeId?: string;
  assigneeName?: string;
  rxId?: string;
  branchId?: string;
}

export interface Contract {
  id: string;
  title: string;
  contactId?: string;
  contactName?: string;
  value: number;
  startDate: string;
  status: string;
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
  clinicalNotes?: string;
  notes?: string;
  isLocked?: boolean;
  branchId?: string;
}

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

export interface AuthResponse {
  token: string;
  user: User;
}

export interface AuditLog {
  id: number;
  userId: string;
  action: string;
  entity: string;
  entityId: string;
  details: string;
  timestamp: string;
  previousState?: any;
  changes?: any;
  familyId: string;
  userName?: string;
  isDeleted?: boolean;
}

export interface NotificationLog {
  id: number;
  status: string;
  channel: string;
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
  type: string;
  entity?: string;
  timestamp: string;
  isRead: boolean;
}
