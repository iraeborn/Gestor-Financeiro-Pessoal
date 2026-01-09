
export enum TaxRegime {
  MEI = 'MEI',
  SIMPLES = 'SIMPLES',
  PRESUMIDO = 'PRESUMIDO',
  REAL = 'REAL'
}

export type ViewMode = 
  | 'FIN_DASHBOARD' | 'FIN_TRANSACTIONS' | 'FIN_CALENDAR' | 'FIN_ACCOUNTS' | 'FIN_CARDS' | 'FIN_GOALS' | 'FIN_REPORTS' | 'FIN_ADVISOR' | 'FIN_CATEGORIES' | 'FIN_CONTACTS' | 'FIN_CONTACT_EDITOR' | 'FIN_TRANSACTION_EDITOR'
  | 'SRV_OS' | 'SRV_OS_EDITOR' | 'SRV_SALES' | 'SRV_SALE_EDITOR' | 'SRV_PURCHASES' | 'SRV_CATALOG' | 'SRV_CATALOG_ITEM_EDITOR' | 'SRV_CONTRACTS' | 'SRV_NF' | 'SRV_CLIENTS' | 'SRV_BRANCH_SCHEDULE'
  | 'OPTICAL_RX' | 'OPTICAL_RX_EDITOR' | 'OPTICAL_SALES' | 'OPTICAL_LAB' | 'OPTICAL_LABS_MGMT' | 'OPTICAL_LAB_DETAILS'
  | 'ODONTO_AGENDA' | 'ODONTO_PATIENTS' | 'ODONTO_PROCEDURES'
  | 'DIAG_HUB' | 'DIAG_HEALTH' | 'DIAG_RISK' | 'DIAG_INVEST'
  | 'SYS_CONTACTS' | 'SYS_ACCESS' | 'SYS_LOGS' | 'SYS_SETTINGS' | 'SYS_BRANCHES' | 'SYS_CHAT' | 'SYS_SALESPEOPLE' | 'SYS_HELP' | 'SYS_SALES_SCHEDULE' | 'SYS_BRANCH_DETAILS';

export interface AppSettings {
  includeCreditCardsInTotal: boolean;
  aiMonitoringEnabled?: boolean; // Controle mestre de IA
  maxDiscountPct?: number; 
  defaultAccountId?: string; 
  installmentRules?: {
    creditCard: { defaultInstallments: number; interestRate: number };
    boleto: { maxInstallments: number };
  };
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

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  receiverId?: string;
  familyId: string;
  content: string;
  type: 'TEXT' | 'IMAGE' | 'FILE';
  createdAt: string | Date;
  attachmentUrl?: string;
}

export interface HelpStep {
  id: string;
  targetId: string;
  title: string;
  content: string;
  view: ViewMode;
  position: 'top' | 'bottom' | 'left' | 'right';
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
