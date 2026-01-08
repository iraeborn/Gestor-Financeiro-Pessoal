
export * from './auth';
export * from './finance';
export * from './operations';
export * from './health';
export * from './system';

import { Account, Transaction, FinancialGoal, Category } from './finance';
import { Branch, CostCenter, Department, Project, ServiceItem, ServiceOrder, CommercialOrder, Contract, StockTransfer, Salesperson, SalespersonSchedule, Invoice } from './operations';
import { ServiceClient, ServiceAppointment, OpticalRx, Laboratory } from './health';
import { CompanyProfile } from './system';
import { Contact } from './contact'; // Se houver um contact.ts, ou mova para finance

export interface AppState {
  accounts: Account[];
  transactions: Transaction[];
  contacts: Contact[]; // Changed from any[] to Contact[]
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
  salespeople: Salesperson[]; // Changed from any[] to Salesperson[]
  salespersonSchedules: SalespersonSchedule[]; // Changed from any[] to SalespersonSchedule[]
  laboratories: Laboratory[];
  companyProfile?: CompanyProfile | null;
  stockTransfers: StockTransfer[];
}