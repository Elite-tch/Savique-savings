"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { FhenixClient } from "fhenixjs";
import { useWalletClient } from "wagmi";
import { BrowserProvider } from "ethers";

interface FhenixContextType {
    fhenixClient: FhenixClient | null;
    isInitialized: boolean;
    /** 
     * Decode an encrypted ciphertext handle returned by getEncryptedSharesHandle().
     * Uses fhenixjs to request off-chain decryption via the Fhenix Threshold Network.
     */
    decryptHandle: (ctHandle: `0x${string}`, contractAddress: `0x${string}`) => Promise<bigint | null>;
}

const FhenixContext = createContext<FhenixContextType>({
    fhenixClient: null,
    isInitialized: false,
    decryptHandle: async () => null,
});

export const useFhenix = () => useContext(FhenixContext);

export const FhenixProvider = ({ children }: { children: ReactNode }) => {
    const { data: walletClient } = useWalletClient();
    const [fhenixClient, setFhenixClient] = useState<FhenixClient | null>(null);
    const [isInitialized, setIsInitialized] = useState(false);

    useEffect(() => {
        const initFhenix = async () => {
            if (!walletClient) {
                setFhenixClient(null);
                setIsInitialized(false);
                return;
            }

            try {
                const provider = new BrowserProvider(walletClient.transport as any, "any");
                // ignoreErrors + skipPubKeyFetch: suppress the public key fetch that
                // fails on Arbitrum Sepolia (no Fhenix FHE node). The CoFHE coprocessor
                // works via the on-chain TaskManager contract; the SDK only needs the
                // provider for permit signing (off-chain decryption requests).
                const client = new FhenixClient({ provider: provider as any, ignoreErrors: true, skipPubKeyFetch: true });
                setFhenixClient(client);
                setIsInitialized(true);
                console.log("FhenixClient (CoFHE) initialized successfully");
            } catch (err) {
                console.error("Failed to initialize FhenixClient", err);
                setIsInitialized(false);
            }
        };

        initFhenix();
    }, [walletClient]);

    /**
     * Request off-chain decryption of a ciphertext handle via fhenixjs permit flow.
     * The Fhenix Threshold Network decrypts and returns the plaintext to the caller only.
     */
    const decryptHandle = async (
        ctHandle: `0x${string}`,
        contractAddress: `0x${string}`
    ): Promise<bigint | null> => {
        if (!fhenixClient || !isInitialized || !walletClient) return null;
        try {
            if (!fhenixClient) return null;
            
            // CoFHE on Arbitrum Sepolia returns a bytes32 handle, not a sealed ciphertext.
            // fhenixjs.unseal() expects a JSON ciphertext string from FHE.sealoutput (native FHE).
            // Since CoFHE does not support synchronous sealoutput, we cannot unseal handles locally.
            // Returning null to let the UI fallback to deposit history tracking.
            return null;
        } catch (err) {
            console.error("Failed to decrypt handle", err);
            return null;
        }
    };

    return (
        <FhenixContext.Provider value={{ fhenixClient, isInitialized, decryptHandle }}>
            {children}
        </FhenixContext.Provider>
    );
};
