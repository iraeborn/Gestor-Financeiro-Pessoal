
export interface Contact {
  id: string;
  externalId?: string;
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
  complement?: string;
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
