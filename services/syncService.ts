
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

    async triggerSync() {
        if (this.isSyncing || !navigator.onLine) {
            this.notify(navigator.onLine ? 'online' : 'offline');
            return;
        }

        const queue = await localDb.getAll<SyncItem>('sync_queue');
        if (queue.length === 0) return;

        this.isSyncing = true;
        this.notify('syncing');

        const token = localStorage.getItem('token');
        try {
            for (const item of queue) {
                const response = await fetch(`/api/sync/process`, {
                    method: 'POST',
                    headers: { 
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify(item)
                });

                if (response.ok) {
                    await localDb.delete('sync_queue', item.id);
                }
            }
        } catch (e) {
            console.error("Sync failed, will retry later", e);
        } finally {
            this.isSyncing = false;
            this.notify(navigator.onLine ? 'online' : 'offline');
        }
    }

    // Puxa dados novos do servidor para o local
    async pullFromServer() {
        if (!navigator.onLine) return;
        const token = localStorage.getItem('token');
        try {
            const response = await fetch(`/api/initial-data`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await response.json();
            
            // CRÍTICO: Limpa stores locais antes de repopular para evitar dados conflitantes de outras contas/sessões
            const storesToClear = [
                'accounts', 'transactions', 'contacts', 'serviceClients', 
                'serviceItems', 'serviceAppointments', 'goals', 'categories', 
                'branches', 'costCenters', 'departments', 'projects', 
                'serviceOrders', 'commercialOrders', 'contracts', 'invoices', 
                'opticalRxs', 'companyProfile'
            ];

            for (const storeName of storesToClear) {
                try {
                    await localDb.clearStore(storeName);
                } catch (e) {
                    console.warn(`Could not clear store ${storeName}`);
                }
            }

            // Atualiza cada store localmente com os dados frescos do servidor
            for (const [storeName, items] of Object.entries(data)) {
                if (Array.isArray(items)) {
                    for (const item of items) {
                        await localDb.put(storeName, item);
                    }
                } else if (items) {
                   await localDb.put(storeName, items);
                }
            }
        } catch (e) {
            console.error("Failed to pull data", e);
        }
    }
}

export const syncService = new SyncService();
