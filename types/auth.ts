
export enum EntityType {
  PERSONAL = 'PF',
  BUSINESS = 'PJ'
}

export enum SubscriptionPlan {
  MONTHLY = 'MONTHLY',
  YEARLY = 'YEARLY',
  TRIAL = 'TRIAL'
}

export interface User {
  id: string;
  name: string;
  email: string;
  familyId: string;
  settings?: any; // Importado de system.ts circularmente se necessário, ou mantido como any
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
  ownerSettings?: any;
  contactId?: string;
}

export interface AuthResponse {
  token: string;
  user: User;
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
    description: 'Acesso básico ao financeiro e operacional.',
    defaultPermissions: ['FIN_DASHBOARD', 'FIN_TRANSACTIONS', 'SRV_CATALOG', 'SRV_SALES', 'FIN_CONTACTS', 'SYS_CHAT', 'SYS_HELP'] 
  },
  { 
    id: 'SALES_OPTICAL', 
    label: 'Vendedor Ótica', 
    description: 'Focado em Receitas RX e Vendas Óticas.',
    requiredModule: 'optical',
    defaultPermissions: ['FIN_DASHBOARD', 'OPTICAL_RX', 'SRV_SALES', 'FIN_CONTACTS', 'SYS_CHAT', 'SYS_HELP']
  },
  { 
    id: 'CLINICAL_ODONTO', 
    label: 'Dentista / Clínico', 
    description: 'Acesso a prontuários e agenda clínica.',
    requiredModule: 'odonto',
    defaultPermissions: ['FIN_DASHBOARD', 'ODONTO_AGENDA', 'ODONTO_PATIENTS', 'SRV_CATALOG', 'SYS_CHAT', 'SYS_HELP']
  }
];
