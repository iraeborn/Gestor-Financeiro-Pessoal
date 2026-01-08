
export type OpticalDeliveryStatus = 'LAB_PENDENTE' | 'LAB_ENVIADO' | 'LAB_PRODUCAO' | 'LAB_PRONTO' | 'LAB_RECEBIDO' | 'ENTREGUE_CLIENTE';
export type LabCommPreference = 'WHATSAPP' | 'EMAIL' | 'PORTAL' | 'MANUAL';
export type LensType = 'MONOFOCAL' | 'BIFOCAL' | 'MULTIFOCAL' | 'OCUPACIONAL';

export interface ToothState {
  tooth: number;
  condition: 'CAVITY' | 'FILLING' | 'MISSING' | 'CROWN' | 'ENDO' | 'IMPLANT';
}

export interface Anamnesis {
  heartProblem: boolean;
  hypertension: boolean;
  diabetes: boolean;
  allergy: boolean;
  anestheticAllergy: boolean;
  bleedingProblem: boolean;
  isPregnant: boolean;
  bisphosphonates: boolean;
  medications?: string;
  notes?: string;
}

export interface Prescription {
  id: string;
  date: string;
  medications: string;
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
  status: 'OPEN' | 'COMPLETED' | 'CANCELLED';
  createdAt: string;
  procedures: TreatmentProcedure[];
}

export interface TreatmentItem {
  id: string;
  serviceId: string;
  serviceName?: string;
  teeth: number[];
  value: number;
}

export interface ServiceClient {
  id: string;
  contactId: string;
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  birthDate?: string;
  insurance?: string;
  notes?: string;
  allergies?: string;
  medications?: string;
  moduleTag: string;
  odontogram: ToothState[];
  anamnesis: Anamnesis;
  prescriptions: Prescription[];
  attachments: string[];
  treatmentPlans: TreatmentPlan[];
  birth_date?: string; 
  contact_name?: string; 
  contact_email?: string; 
  contact_phone?: string; 
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

export interface OpticalRx {
  id: string;
  rxNumber: string;
  contactId: string;
  contactName?: string;
  branchId?: string;
  rxDate: string;
  expirationDate?: string;
  professionalName?: string;
  professionalReg?: string;
  sphereOdLonge?: number;
  cylOdLonge?: number;
  axisOdLonge?: number;
  prismaOdLonge?: number;
  baseOdLonge?: string;
  sphereOeLonge?: number;
  cylOeLonge?: number;
  axisOeLonge?: number;
  prismaOeLonge?: number;
  baseOeLonge?: string;
  addition?: number;
  dnpOd?: number;
  dnpOe?: number;
  heightOd?: number;
  heightOe?: number;
  lensType?: LensType;
  lensMaterial?: string;
  lensTreatments?: string;
  usageInstructions?: string;
  laboratoryId?: string;
  observations?: string;
  status: 'PENDING' | 'APPROVED' | 'SOLD' | 'CANCELLED';
  labStatus?: OpticalDeliveryStatus;
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
    preferredCommunication?: LabCommPreference;
}
