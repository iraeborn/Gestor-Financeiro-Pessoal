
import { AppState } from '../types';

const DB_NAME = 'FinManagerDB';
const DB_VERSION = 8; // Incrementado para v8 para store laboratories

export class LocalDB {
  private db: IDBDatabase | null = null;

  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = (event: any) => {
          const db = event.target.result;
          const stores = [
            'accounts', 'transactions', 'contacts', 'serviceClients', 
            'serviceItems', 'serviceAppointments', 'goals', 'categories', 
            'branches', 'costCenters', 'departments', 'projects', 
            'serviceOrders', 'commercialOrders', 'contracts', 'invoices', 
            'opticalRxs', 'sync_queue', 'companyProfile', 'salespeople', 'laboratories'
          ];

          stores.forEach(store => {
            if (!db.objectStoreNames.contains(store)) {
              db.createObjectStore(store, { keyPath: 'id' });
            }
          });
        };

        request.onsuccess = () => {
          this.db = request.result;
          resolve();
        };

        request.onerror = (e) => {
          console.error("IndexedDB Open Error:", e);
          reject(request.error);
        };
      } catch (e) {
        console.error("IndexedDB Exception:", e);
        reject(e);
      }
    });
  }

  async clearAllStores(): Promise<void> {
    const stores = [
        'accounts', 'transactions', 'contacts', 'serviceClients', 
        'serviceItems', 'serviceAppointments', 'goals', 'categories', 
        'branches', 'costCenters', 'departments', 'projects', 
        'serviceOrders', 'commercialOrders', 'contracts', 'invoices', 
        'opticalRxs', 'sync_queue', 'companyProfile', 'salespeople', 'laboratories'
    ];
    await Promise.all(stores.map(s => this.clearStore(s)));
  }

  async getAll<T>(storeName: string): Promise<T[]> {
    return new Promise((resolve) => {
      if (!this.db) return resolve([]);
      
      try {
        if (!this.db.objectStoreNames.contains(storeName)) {
            return resolve([]);
        }
        const transaction = this.db.transaction(storeName, 'readonly');
        const store = transaction.objectStore(storeName);
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => resolve([]);
      } catch (e) {
        resolve([]);
      }
    });
  }

  async put(storeName: string, data: any): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.db) return reject('DB not initialized');
      try {
        if (!this.db.objectStoreNames.contains(storeName)) {
            return reject(`Store ${storeName} não encontrado.`);
        }
        const transaction = this.db.transaction(storeName, 'readwrite');
        const store = transaction.objectStore(storeName);
        const request = store.put({ ...data, _updatedAt: Date.now() });
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      } catch (e) {
        reject(e);
      }
    });
  }

  async delete(storeName: string, id: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.db) return reject('DB not initialized');
      try {
        if (!this.db.objectStoreNames.contains(storeName)) {
            return reject(`Store ${storeName} não encontrado.`);
        }
        const transaction = this.db.transaction(storeName, 'readwrite');
        const store = transaction.objectStore(storeName);
        const request = store.delete(id);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      } catch (e) {
        reject(e);
      }
    });
  }

  async clearStore(storeName: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.db) return resolve();
      try {
        if (!this.db.objectStoreNames.contains(storeName)) return resolve();
        const transaction = this.db.transaction(storeName, 'readwrite');
        const store = transaction.objectStore(storeName);
        store.clear();
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
      } catch (e) {
        reject(e);
      }
    });
  }
}

export const localDb = new LocalDB();
