
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
  branchId?: string;
  stockQuantity?: number;
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
