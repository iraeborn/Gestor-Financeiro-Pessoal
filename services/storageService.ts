
import { 
    AppState, Account, Transaction, FinancialGoal, User, AppSettings, 
    Contact, Category, EntityType, SubscriptionPlan, CompanyProfile, 
    Member, ServiceClient, ServiceItem, ServiceAppointment, AuditLog, 
    NotificationLog, OpticalRx, Salesperson, Laboratory, SalespersonSchedule, 
    StockTransfer, CommercialOrder, ServiceOrder, Contract, Invoice,
    Branch, CostCenter, Department, Project, InventoryEvent
} from '../types';
import { localDb } from './localDb';
import { syncService } from './syncService';

const handleResponse = async (res: Response) => {
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Server error');
    return data;
};

const getHeaders = () => ({
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${localStorage.getItem('token')}`
});

export const login = async (email: string, password: string) => {
    const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
    });
    const data = await handleResponse(res);
    localStorage.setItem('token', data.token);
    return data;
};

export const register = async (
    name: string, 
    email: string, 
    password: string, 
    entityType: EntityType, 
    plan: SubscriptionPlan, 
    pjPayload?: any
) => {
    const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password, entityType, plan, pjPayload })
    });
    const data = await handleResponse(res);
    localStorage.setItem('token', data.token);
    return data;
};

export const loginWithGoogle = async (credential: string, entityType: EntityType, pjPayload?: any) => {
    const res = await fetch('/api/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credential, entityType, pjPayload })
    });
    const data = await handleResponse(res);
    localStorage.setItem('token', data.token);
    return data;
};

export const refreshUser = async () => {
    const res = await fetch('/api/auth/me', { headers: getHeaders() });
    return handleResponse(res);
};

export const logout = () => {
    localStorage.removeItem('token');
};

export const switchContext = async (targetFamilyId: string) => {
    const res = await fetch('/api/auth/switch-context', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ targetFamilyId })
    });
    const data = await handleResponse(res);
    localStorage.setItem('token', data.token);
    return data;
};

export const updateProfile = async (data: any) => {
    const res = await fetch('/api/profile', {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify(data)
    });
    const result = await handleResponse(res);
    return result.user;
};

export const updateSettings = async (settings: AppSettings) => {
    const res = await fetch('/api/settings', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ settings })
    });
    return handleResponse(res);
};

export const consultCnpj = async (cnpj: string) => {
    const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`);
    return res.json();
};

export const getFamilyMembers = async () => {
    const res = await fetch('/api/members', { headers: getHeaders() });
    return handleResponse(res);
};

export const createInvite = async (role?: string) => {
    const res = await fetch('/api/invites', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ role })
    });
    return handleResponse(res);
};

export const joinFamily = async (code: string) => {
    const res = await fetch('/api/invites/join', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ code })
    });
    const data = await handleResponse(res);
    return data.user;
};

export const updateMemberRole = async (memberId: string, role: string, permissions: string[], contactId?: string) => {
    const res = await fetch(`/api/members/${memberId}`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify({ role, permissions, contactId })
    });
    return handleResponse(res);
};

export const removeMember = async (memberId: string) => {
    const res = await fetch(`/api/members/${memberId}`, {
        method: 'DELETE',
        headers: getHeaders()
    });
    return handleResponse(res);
};

export const getAuditLogs = async () => {
    const res = await fetch('/api/audit-logs', { headers: getHeaders() });
    return handleResponse(res);
};

export const getNotificationLogs = async () => {
    const res = await fetch('/api/notification-logs', { headers: getHeaders() });
    return handleResponse(res);
};

export const restoreRecord = async (entity: string, entityId: string) => {
    const res = await fetch('/api/audit/restore', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ entity, entityId })
    });
    return handleResponse(res);
};

export const revertLogChange = async (logId: number) => {
    const res = await fetch(`/api/audit/revert/${logId}`, {
        method: 'POST',
        headers: getHeaders()
    });
    return handleResponse(res);
};

export const getAdminStats = async () => {
    const res = await fetch('/api/admin/stats', { headers: getHeaders() });
    return handleResponse(res);
};

export const getAdminUsers = async () => {
    const res = await fetch('/api/admin/users', { headers: getHeaders() });
    return handleResponse(res);
};

export const getPublicOrder = async (token: string) => {
    const res = await fetch(`/api/public/orders/${token}`);
    return handleResponse(res);
};

export const updatePublicOrderStatus = async (token: string, status: string) => {
    const res = await fetch(`/api/public/orders/${token}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
    });
    return handleResponse(res);
};

export const loadInitialData = async () => {
    try {
        await syncService.pullFromServer();
    } catch (e) {
        console.warn("Offline: carregando apenas banco local.");
    }

    const [
        accounts, transactions, contacts, serviceClients, serviceItems,
        serviceAppointments, goals, categories, branches, costCenters,
        departments, projects, serviceOrders, commercialOrders, contracts,
        invoices, opticalRxs, companyProfile, salespeople, salespersonSchedules,
        laboratories, stockTransfers, inventoryEvents
    ] = await Promise.all([
        localDb.getAll<Account>('accounts'),
        localDb.getAll<Transaction>('transactions'),
        localDb.getAll<Contact>('contacts'),
        localDb.getAll<ServiceClient>('serviceClients'),
        localDb.getAll<ServiceItem>('serviceItems'),
        localDb.getAll<ServiceAppointment>('serviceAppointments'),
        localDb.getAll<FinancialGoal>('goals'),
        localDb.getAll<Category>('categories'),
        localDb.getAll<Branch>('branches'),
        localDb.getAll<CostCenter>('costCenters'),
        localDb.getAll<Department>('departments'),
        localDb.getAll<Project>('projects'),
        localDb.getAll<ServiceOrder>('serviceOrders'),
        localDb.getAll<CommercialOrder>('commercialOrders'),
        localDb.getAll<Contract>('contracts'),
        localDb.getAll<Invoice>('invoices'),
        localDb.getAll<OpticalRx>('opticalRxs'),
        localDb.getAll<CompanyProfile>('companyProfile'),
        localDb.getAll<Salesperson>('salespeople'),
        localDb.getAll<SalespersonSchedule>('salespersonSchedules'),
        localDb.getAll<Laboratory>('laboratories'),
        localDb.getAll<StockTransfer>('stockTransfers'),
        localDb.getAll<InventoryEvent>('inventoryEvents'),
    ]);

    return {
        accounts, transactions, contacts, serviceClients, serviceItems,
        serviceAppointments, goals, categories, branches, costCenters,
        departments, projects, serviceOrders, commercialOrders, contracts,
        invoices, opticalRxs, companyProfile: companyProfile[0] || null,
        salespeople, salespersonSchedules, laboratories, stockTransfers, inventoryEvents
    } as AppState;
};

export const api = {
    saveTransaction: async (t: Transaction, nc?: Contact, ncat?: Category) => {
        // Garante que a transação tenha um ID antes de processar
        const payload = { ...t, id: t.id || crypto.randomUUID() };
        
        if (nc) await api.saveContact(nc);
        if (ncat) await api.saveLocallyAndQueue('categories', ncat);
        
        await localDb.put('transactions', payload);
        await syncService.enqueue('SAVE', 'transactions', payload);
    },
    deleteTransaction: async (id: string) => {
        await localDb.delete('transactions', id);
        await syncService.enqueue('DELETE', 'transactions', { id });
    },
    saveAccount: async (a: Account) => {
        await localDb.put('accounts', a);
        await syncService.enqueue('SAVE', 'accounts', a);
    },
    deleteAccount: async (id: string) => {
        await localDb.delete('accounts', id);
        await syncService.enqueue('DELETE', 'accounts', { id });
    },
    saveGoal: async (g: FinancialGoal) => {
        await localDb.put('goals', g);
        await syncService.enqueue('SAVE', 'goals', g);
    },
    deleteGoal: async (id: string) => {
        await localDb.delete('goals', id);
        await syncService.enqueue('DELETE', 'goals', { id });
    },
    saveContact: async (c: Contact) => {
        await localDb.put('contacts', c);
        await syncService.enqueue('SAVE', 'contacts', c);
    },
    deleteContact: async (id: string) => {
        await localDb.delete('contacts', id);
        await syncService.enqueue('DELETE', 'contacts', { id });
    },
    saveBulkContacts: async (contacts: Contact[]) => {
        for (const c of contacts) {
            await api.saveContact(c);
        }
    },
    savePJEntity: async (type: string, data: any) => {
        let store = type === 'company' ? 'companyProfile' : type + 's';
        if (type === 'branch') store = 'branches';
        await localDb.put(store, data);
        await syncService.enqueue('SAVE', store, data);
    },
    deletePJEntity: async (type: string, id: string) => {
        let store = type + 's';
        if (type === 'branch') store = 'branches';
        await localDb.delete(store, id);
        await syncService.enqueue('DELETE', store, { id });
    },
    saveOS: async (os: ServiceOrder) => {
        await localDb.put('serviceOrders', os);
        await syncService.enqueue('SAVE', 'serviceOrders', os);
    },
    deleteOS: async (id: string) => {
        await localDb.delete('serviceOrders', id);
        await syncService.enqueue('DELETE', 'serviceOrders', { id });
    },
    saveOrder: async (order: CommercialOrder) => {
        await localDb.put('commercialOrders', order);
        await syncService.enqueue('SAVE', 'commercialOrders', order);
    },
    deleteOrder: async (id: string) => {
        await localDb.delete('commercialOrders', id);
        await syncService.enqueue('DELETE', 'commercialOrders', { id });
    },
    saveCatalogItem: async (item: ServiceItem) => {
        await localDb.put('serviceItems', item);
        await syncService.enqueue('SAVE', 'serviceItems', item);
    },
    deleteCatalogItem: async (id: string) => {
        await localDb.delete('serviceItems', id);
        await syncService.enqueue('DELETE', 'serviceItems', { id });
    },
    transferStock: async (data: any) => {
        await syncService.enqueue('TRANSFER', 'stockTransfers', data);
    },
    saveOpticalRx: async (rx: OpticalRx) => {
        await localDb.put('opticalRxs', rx);
        await syncService.enqueue('SAVE', 'opticalRxs', rx);
    },
    deleteOpticalRx: async (id: string) => {
        await localDb.delete('opticalRxs', id);
        await syncService.enqueue('DELETE', 'opticalRxs', { id });
    },
    saveLaboratory: async (lab: Laboratory) => {
        await localDb.put('laboratories', lab);
        await syncService.enqueue('SAVE', 'laboratories', lab);
    },
    deleteLaboratory: async (id: string) => {
        await localDb.delete('laboratories', id);
        await syncService.enqueue('DELETE', 'laboratories', { id });
    },
    saveSalespersonSchedule: async (s: SalespersonSchedule) => {
        await localDb.put('salespersonSchedules', s);
        await syncService.enqueue('SAVE', 'salespersonSchedules', s);
    },
    deleteSalespersonSchedule: async (id: string) => {
        await localDb.delete('salespersonSchedules', id);
        await syncService.enqueue('DELETE', 'salespersonSchedules', { id });
    },
    saveAppointment: async (a: ServiceAppointment) => {
        await localDb.put('serviceAppointments', a);
        await syncService.enqueue('SAVE', 'serviceAppointments', a);
    },
    deleteAppointment: async (id: string) => {
        await localDb.delete('serviceAppointments', id);
        await syncService.enqueue('DELETE', 'serviceAppointments', { id });
    },
    saveLocallyAndQueue: async (store: string, payload: any) => {
        await localDb.put(store, payload);
        await syncService.enqueue('SAVE', store, payload);
    },
    deleteLocallyAndQueue: async (store: string, id: string) => {
        await localDb.delete(store, id);
        await syncService.enqueue('DELETE', store, { id });
    }
};
