import { db } from './firebase';
import {
    collection,
    addDoc,
    query,
    where,
    getDocs,
    orderBy,
    Timestamp
} from 'firebase/firestore';

export interface Receipt {
    id?: string;
    walletAddress: string;
    vaultAddress?: string; // Optional for backward compatibility
    factoryAddress?: string; // For network filtering
    txHash: string;
    timestamp: number;
    purpose: string;
    amount: string;
    verified: boolean;
    type: 'created' | 'breaked' | 'completed';
    penalty?: string;
    vaultId?: number;
}

const RECEIPTS_COLLECTION = 'receipts';

// List of all factory versions used on Arbitrum Sepolia to prevent "disappearing" savings
const KNOWN_FACTORIES = [
    "0x25333E809be8E9101491518abd52Ac1133137c30", // Original
    "0x9818512cce53c0b6E5838b32385887E81B5e7faE7", // V2
    "0xf8225e6bE64CDf091B92d3C250F4FbfbC92a308d", // V2.1 Broken
    "0xB11E956f8388261d08B4202411965D187B2A3Fa2", // V2.1 Final
    "0x2895B27A2Df83A471519bB6690528049421F7C04", // V2.2 Corrected Treasury
    "0x3AE07d625Eab21b1383686d410EC2AF818B0E744", // V2.3 Final Treasury
    "0x985289945199859f519962a4d3A849c95B4468f9", // V2
    "0x71941de02D2566e900B1EE5bAd6AF1bEE1f110d9", // V3 (NFT)
    "0xD799d10fAECfa3D9FdBe5b7c940bb176d931A5f0", // V4 (On-Chain NFT)
    "0xC78178AbdFC385E6dD1E4e8304545741e44B92d3", // V5 (Fixed JSON)
    "0x0484780F5aA1EbD7bD7e6C4c72ADFDA2c0c9D57A", // V6 (OpenZeppelin Standard)
    "0x85856bFecBe6d46863e2B11A22c1aD58B74A2Ab1"  // V7 (Tiered Rewards)
].map(a => a.toLowerCase());

function isSameNetwork(fact1: string, fact2: string) {
    if (fact1.toLowerCase() === fact2.toLowerCase()) return true;
    if (KNOWN_FACTORIES.includes(fact1.toLowerCase()) && KNOWN_FACTORIES.includes(fact2.toLowerCase())) return true;
    return false;
}

/**
 * Save a receipt to Firestore
 */
export async function saveReceipt(receipt: Omit<Receipt, 'id'>): Promise<string> {
    try {
        const docRef = await addDoc(collection(db, RECEIPTS_COLLECTION), {
            ...receipt,
            createdAt: Timestamp.now()
        });
        console.log('[Firebase] Receipt saved with ID:', docRef.id);
        return docRef.id;
    } catch (error) {
        console.error('[Firebase] Error saving receipt:', error);
        throw error;
    }
}

/**
 * Update an existing receipt in Firestore
 */
export async function updateReceipt(id: string, updates: Partial<Receipt>): Promise<void> {
    try {
        const { updateDoc, doc } = await import('firebase/firestore');
        const docRef = doc(db, RECEIPTS_COLLECTION, id);
        await updateDoc(docRef, { ...updates });
        console.log('[Firebase] Receipt updated:', id);
    } catch (error) {
        console.error('[Firebase] Error updating receipt:', error);
        throw error;
    }
}

/**
 * Get all receipts for a specific wallet address
 */
export async function getReceiptsByWallet(walletAddress: string, factoryAddress?: string): Promise<Receipt[]> {
    try {
        const receiptsRef = collection(db, RECEIPTS_COLLECTION);
        const q = query(
            receiptsRef,
            where('walletAddress', '==', walletAddress.toLowerCase())
        );

        const querySnapshot = await getDocs(q);
        const receipts: Receipt[] = [];

        querySnapshot.forEach((doc) => {
            const data = doc.data() as Receipt & { factoryAddress?: string };
            
            if (factoryAddress) {
                // Strict check: If a factory filter is active:
                // 1. If it has a factoryAddress, it MUST match.
                // 2. If it has NO factoryAddress (Legacy Network), skip it.
                // Check if it belongs to any of our known factories for this network
                if (data.factoryAddress) {
                    if (isSameNetwork(data.factoryAddress, factoryAddress)) {
                        receipts.push({ id: doc.id, ...data });
                    }
                }
                // (Legacy records without factoryAddress are ignored)
            } else {
                receipts.push({ id: doc.id, ...data });
            }
        });

        // Client-side sort by timestamp desc
        return receipts.sort((a, b) => b.timestamp - a.timestamp);
    } catch (error) {
        console.error('[Firebase] Error loading receipts:', error);
        throw error;
    }
}

/**
 * Get all receipts for a specific vault address
 */
export async function getReceiptsByVault(vaultAddress: string): Promise<Receipt[]> {
    try {
        const receiptsRef = collection(db, RECEIPTS_COLLECTION);
        const q = query(
            receiptsRef,
            where('vaultAddress', '==', vaultAddress.toLowerCase()),
            orderBy('timestamp', 'desc')
        );

        const querySnapshot = await getDocs(q);
        const receipts: Receipt[] = [];

        querySnapshot.forEach((doc) => {
            receipts.push({
                id: doc.id,
                ...doc.data()
            } as Receipt);
        });

        return receipts;
    } catch (error) {
        console.error('[Firebase] Error loading receipts by vault:', error);
        throw error;
    }
}

/**
 * Migrate receipts from localStorage to Firestore
 */
export async function migrateLocalStorageToFirestore(walletAddress: string): Promise<number> {
    try {
        let migratedCount = 0;

        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key?.startsWith('receipt_')) {
                const data = localStorage.getItem(key);
                if (data) {
                    try {
                        const parsed = JSON.parse(data);

                        // Only migrate if it belongs to this wallet or has no wallet address
                        if (!parsed.walletAddress || parsed.walletAddress.toLowerCase() === walletAddress.toLowerCase()) {
                            await saveReceipt({
                                walletAddress: walletAddress.toLowerCase(),
                                txHash: parsed.txHash,
                                timestamp: parsed.timestamp,
                                purpose: parsed.purpose,
                                amount: parsed.amount,
                                verified: parsed.verified || false,
                                type: parsed.type || 'created',
                                penalty: parsed.penalty
                            });

                            migratedCount++;
                            console.log('[Firebase] Migrated receipt:', parsed.purpose);
                        }
                    } catch (e) {
                        console.error('[Firebase] Error migrating receipt:', e);
                    }
                }
            }
        }

        console.log(`[Firebase] Migration complete: ${migratedCount} receipts migrated`);
        return migratedCount;
    } catch (error) {
        console.error('[Firebase] Migration error:', error);
        throw error;
    }
}

// --- Vault Persistence ---
const VAULTS_COLLECTION = 'user_vaults';

export interface SavedVault {
    vaultAddress: string;
    owner: string;
    factoryAddress: string;
    createdAt: number;
    purpose?: string;
    targetAmount?: string; // New: Sinking Fund Goal
    beneficiary?: string; // Emergency Beneficiary
    vaultId?: number; // Support for NFT Vault IDs
}

import { ensureUserExists } from './userService';

export async function saveVault(data: SavedVault): Promise<string> {
    try {
        const normalizedAddress = data.vaultAddress.toLowerCase();
        const ownerAddress = data.owner.toLowerCase();

        // Ensure user record exists for this wallet
        await ensureUserExists(ownerAddress);

        const vaultsRef = collection(db, VAULTS_COLLECTION);
        const q = query(vaultsRef, where('vaultAddress', '==', normalizedAddress));
        const snapshot = await getDocs(q);

        if (!snapshot.empty) {
            const docId = snapshot.docs[0].id;
            const { updateDoc, doc } = await import('firebase/firestore');
            const docRef = doc(db, VAULTS_COLLECTION, docId);

            // Update existing vault with new data (like targetAmount)
            await updateDoc(docRef, {
                ...data,
                vaultAddress: normalizedAddress,
                updatedAt: Timestamp.now()
            });
            console.log("Vault updated:", normalizedAddress);
            return docId;
        }

        const docRef = await addDoc(vaultsRef, {
            ...data,
            vaultAddress: normalizedAddress,
            createdAt: Timestamp.now()
        });
        console.log('[Firebase] Vault saved:', normalizedAddress);
        return docRef.id;
    } catch (error) {
        console.error('Error saving vault:', error);
        throw error;
    }
}

export async function getUserVaultsFromDb(ownerAddress: string, factoryAddress?: string): Promise<string[]> {
    try {
        const vaultsRef = collection(db, VAULTS_COLLECTION);
        // Simple query without multiple wheres to avoid index error
        const q = query(
            vaultsRef,
            where('owner', '==', ownerAddress.toLowerCase())
        );

        const querySnapshot = await getDocs(q);
        const vaults: any[] = [];
        querySnapshot.forEach((doc) => {
            const data = doc.data();
            // Strict check: Only show vaults for the active network
            // Performance optimization: Allow all known factories for the current network
            if (factoryAddress) {
                const vaultFactory = data.factoryAddress?.toLowerCase() || '';
                if (!isSameNetwork(vaultFactory, factoryAddress)) {
                    return;
                }
            }
            if (data.vaultAddress) {
                let created = data.createdAt;
                if (created && typeof created.toMillis === 'function') {
                    created = created.toMillis();
                }
                vaults.push({
                    address: data.vaultAddress,
                    createdAt: created || 0
                });
            }
        });

        // Client-side sort by createdAt desc
        return vaults
            .sort((a, b) => b.createdAt - a.createdAt)
            .map(v => v.address);
    } catch (error) {
        console.error('Error fetching vaults from DB:', error);
        const vaultsRef = collection(db, VAULTS_COLLECTION);
        // If index is missing, fallback to owner only and filter manually
        if (error instanceof Error && error.message.includes('index')) {
            const fallbackQ = query(vaultsRef, where('owner', '==', ownerAddress.toLowerCase()));
            const snapshot = await getDocs(fallbackQ);
            return snapshot.docs
                .map(doc => doc.data() as SavedVault)
                .filter(data => !factoryAddress || data.factoryAddress?.toLowerCase() === factoryAddress.toLowerCase())
                .map(data => data.vaultAddress);
        }
        return [];
    }
}

export async function getVaultByAddress(vaultAddress: string): Promise<SavedVault | null> {
    try {
        const vaultsRef = collection(db, VAULTS_COLLECTION);
        const q = query(vaultsRef, where('vaultAddress', '==', vaultAddress.toLowerCase()));
        const snapshot = await getDocs(q);

        if (snapshot.empty) return null;

        const data = snapshot.docs[0].data();
        let createdDay = data.createdAt;
        if (createdDay && typeof createdDay.toMillis === 'function') {
            createdDay = createdDay.toMillis();
        }

        return {
            vaultAddress: data.vaultAddress,
            owner: data.owner,
            factoryAddress: data.factoryAddress,
            createdAt: createdDay || Date.now(),
            purpose: data.purpose,
            targetAmount: data.targetAmount // Retrieve target
        };
    } catch (error) {
        console.error('Error fetching vault by address:', error);
        return null;
    }
}

/**
 * Get ALL vaults for Admin Dashboard
 */
export async function getAllVaults(factoryAddress?: string): Promise<SavedVault[]> {
    try {
        const vaultsRef = collection(db, VAULTS_COLLECTION);
        
        // Simple query without multiple wheres to avoid index error
        const querySnapshot = await getDocs(vaultsRef);
        const vaults: SavedVault[] = [];

        querySnapshot.forEach((doc) => {
            const data = doc.data();
            
            // Strict check: Only show vaults for the active network
            if (factoryAddress) {
                const vaultFactory = data.factoryAddress?.toLowerCase() || '';
                if (!isSameNetwork(vaultFactory, factoryAddress)) {
                    return;
                }
            }

            let created = data.createdAt;
            if (created && typeof created.toMillis === 'function') {
                created = created.toMillis();
            }

            vaults.push({
                vaultAddress: data.vaultAddress,
                owner: data.owner,
                factoryAddress: data.factoryAddress,
                createdAt: created || Date.now(),
                purpose: data.purpose
            });
        });

        // Client-side sort
        return vaults.sort((a, b) => b.createdAt - a.createdAt);
    } catch (error) {
        console.error('[Admin] Error fetching all vaults:', error);
        return [];
    }
}

/**
 * Get ALL receipts for Admin Metrics
 */
export async function getAllReceipts(factoryAddress?: string): Promise<Receipt[]> {
    try {
        const receiptsRef = collection(db, RECEIPTS_COLLECTION);
        let q = query(receiptsRef, orderBy('timestamp', 'desc'));

        const querySnapshot = await getDocs(q);
        const receipts: Receipt[] = [];

        querySnapshot.forEach((doc) => {
            const data = doc.data() as Receipt & { factoryAddress?: string };
            
            if (factoryAddress) {
                // Strict check: Skip anything that doesn't match the active factory network
                if (data.factoryAddress && isSameNetwork(data.factoryAddress, factoryAddress)) {
                    receipts.push({ id: doc.id, ...data });
                }
            } else {
                receipts.push({ id: doc.id, ...data });
            }
        });

        return receipts;
    } catch (error) {
        console.error('[Admin] Error fetching all receipts:', error);
        return [];
    }
}


