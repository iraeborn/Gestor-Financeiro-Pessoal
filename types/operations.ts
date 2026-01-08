import { OSPriority, OSStatus, OSType, OSOrigin } from './enums_legacy';

export type { OSStatus, OSType, OSOrigin, OSPriority };

export type PaymentMethod = 'CARD' | 'BOLETO' | 'PIX' | 'CASH';

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

export interface Salesperson {
    id: string;
    userId: string;
    name: string;
    email: string;
    familyId: string;
    branchId: string;
    branchName?: string;
    commissionRate: number;
}

export interface SalespersonSchedule {
    id: string;
    salespersonId: string;
    salespersonName?: string;
    date: string;
    shift: 'FULL' | 'MORNING' | 'AFTERNOON';
    notes?: string;
    branchId: string;
    branchName?: string;
    familyId: string;
}

export type TransferStatus = 'PENDING' | 'IN_TRANSIT' | 'COMPLETED' | 'CANCELLED';

export interface StockTransfer {
    id: string;
    serviceItemId: string;
    serviceItemName?: string;
    fromBranchId: string;
    fromBranchName?: string;
    toBranchId: string;
    toBranchName?: string;
    quantity: number;
    date: string;
    notes?: string;
    familyId: string;
    status: TransferStatus;
    invoiceRef?: string; // Referência para futura NF de transferência
    userId?: string;
}

export interface VariationAttribute {
    name: string; 
    values: string[]; 
}

export interface ProductSKU {
    id: string;
    sku: string;
    attributes: Record<string, string>; 
    price?: number;
    costPrice?: number;
    stockQuantity: number;
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
  unit?: string;
}

export interface ServiceItem {
  id: string;
  name: string; 
  code?: string;
  type: 'SERVICE' | 'PRODUCT';
  category?: string;
  categories?: string[];
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
  branchId?: string; // Filial onde o item "mora" originalmente (Matriz na compra)
  stockQuantity: number;
  warrantyEnabled?: boolean;
  warrantyDays?: number;
  isFreeAllowed?: boolean;
  autoGenerateOS?: boolean;
  variationAttributes?: VariationAttribute[];
  skus?: ProductSKU[];
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
  accountId?: string; 
  assigneeId?: string;
  assigneeName?: string;
  rxId?: string;
  branchId?: string;
  paymentMethod?: PaymentMethod;
  installments?: number;
}

// Fix: Added missing Contract interface
export interface Contract {
    id: string;
    contactId: string;
    contactName?: string;
    title: string;
    content: string;
    status: 'DRAFT' | 'SIGNED' | 'EXPIRED' | 'CANCELLED';
    startDate: string;
    endDate?: string;
    value: number;
    familyId: string;
    deleted_at?: string;
}

// Fix: Added missing Invoice interface
export interface Invoice {
    id: string;
    orderId: string;
    contactId: string;
    contactName?: string;
    number: string;
    series: string;
    type: 'ISS' | 'ICMS';
    amount: number;
    date: string;
    xmlUrl?: string;
    pdfUrl?: string;
    status: 'ISSUED' | 'CANCELLED';
    familyId: string;
    deleted_at?: string;
}

// Fix: Added missing Kanban types
export interface KanbanColumnConfig {
    id: string;
    label: string;
    color: string;
    borderColor?: string;
}

export interface KanbanItem {
    id: string;
    title: string;
    subtitle?: string;
    status: string;
    amount?: number;
    date?: string;
    priority?: OSPriority;
    assigneeName?: string;
    raw?: any;
}
