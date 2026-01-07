
import { localDb } from './localDb';

export interface SyncItem {
    id: string;
    action: 'SAVE' | 'DELETE';
    store: string;
    payload: any;
    timestamp: number;
}

class SyncService {
    private isSyncing = false;
    private syncListeners: ((status: 'syncing' | 'online' | 'offline') => void)[] = [];
    private syncPromise: Promise<void> | null = null;

    onStatusChange(callback: (status: 'syncing' | 'online' | 'offline') => void) {
        this.syncListeners.push(callback);
    }

    private notify(status: 'syncing' | 'online' | 'offline') {
        this.syncListeners.forEach(cb => cb(status));
    }

    async enqueue(action: 'SAVE' | 'DELETE', store: string, payload: any) {
        const syncItem: SyncItem = {
            id: payload.id || crypto.randomUUID(),
            action,
            store,
            payload,
            timestamp: Date.now()
        };
        await localDb.put('sync_queue', syncItem);
        this.triggerSync();
    }

    /**
     * Mapeia a loja local para o endpoint especializado no backend.
     */
    private getEndpoint(store: string): string {
        const map: Record<string, string> = {
            'transactions': '/api/transactions/sync',
            'contacts': '/api/contacts/sync',
            'accounts': '/api/accounts/sync',
            'opticalRxs': '/api/optical-rxs/sync',
            'commercialOrders': '/api/orders/sync',
            'goals': '/api/goals/sync',
            // Itens menores ainda usam o fallback até serem refatorados
            'categories': '/api/sync/process',
            'branches': '/api/sync/process',
            'serviceItems': '/api/sync/process',
            'serviceOrders': '/api/sync/process',
            'salespeople': '/api/sync/process',
            'laboratories': '/api/sync/process',
            'salespersonSchedules': '/api/sync/process',
            'serviceClients': '/api/sync/process'
        };
        return map[store] || '/api/sync/process';
    }

    async triggerSync(): Promise<void> {
        if (this.syncPromise) return this.syncPromise;
        if (!navigator.onLine) { this.notify('offline'); return; }

        this.syncPromise = (async () => {
            const queue = await localDb.getAll<SyncItem>('sync_queue');
            if (queue.length === 0) {
                this.syncPromise = null;
                this.notify('online');
                return;
            }

            this.isSyncing = true;
            this.notify('syncing');

            const token = localStorage.getItem('token');
            try {
                const sortedQueue = queue.sort((a, b) => a.timestamp - b.timestamp);

                for (const item of sortedQueue) {
                    try {
                        const url = this.getEndpoint(item.store);
                        const response = await fetch(url, {
                            method: 'POST',
                            headers: { 
                                'Content-Type': 'application/json',
                                'Authorization': `Bearer ${token}`
                            },
                            body: JSON.stringify(item)
                        });

                        if (response.ok) {
                            await localDb.delete('sync_queue', item.id);
                        } else {
                            const errorData = await response.json();
                            console.error(`[SYNC] Erro no servidor (${url}) para ${item.store}:`, errorData.error);
                            break; 
                        }
                    } catch (fetchErr) {
                        console.error(`[SYNC] Erro de rede ao processar ${item.store}:`, fetchErr);
                        break;
                    }
                }
            } catch (e) {
                console.error("Sync batch process failed:", e);
            } finally {
                this.isSyncing = false;
                this.syncPromise = null;
                this.notify(navigator.onLine ? 'online' : 'offline');
            }
        })();

        return this.syncPromise;
    }

    async pullFromServer() {
        if (!navigator.onLine) return;
        const token = localStorage.getItem('token');
        try {
            const response = await fetch(`/api/initial-data`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!response.ok) throw new Error("Erro ao puxar dados do servidor");
            const data = await response.json();
            
            const storesToClear = [
                'accounts', 'transactions', 'contacts', 'serviceClients', 
                'serviceItems', 'serviceAppointments', 'goals', 'categories', 
                'branches', 'costCenters', 'departments', 'projects', 
                'serviceOrders', 'commercialOrders', 'contracts', 'invoices', 
                'opticalRxs', 'companyProfile', 'salespeople', 'laboratories', 'salespersonSchedules'
            ];

            await Promise.all(storesToClear.map(async (storeName) => {
                try { await localDb.clearStore(storeName); } catch (e) { console.warn(`Could not clear store ${storeName}`); }
            }));

            for (const [storeName, items] of Object.entries(data)) {
                if (Array.isArray(items)) {
                    for (const item of items) { await localDb.put(storeName, item); }
                } else if (items) { await localDb.put(storeName, items); }
            }
            console.log("✅ [SYNC] Banco local sincronizado.");
        } catch (e) {
            console.error("❌ [SYNC] Falha na sincronização:", e);
            throw e;
        }
    }
}

export const syncService = new SyncService();
