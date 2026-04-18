"use client";

import { useState, useEffect } from "react";
import { CONTRACTS } from "@/lib/contracts";

const STORAGE_KEY_USDC = "savique_usdc_address_v11";
const STORAGE_KEY_FACTORY = "savique_factory_address_v11";

export function useContractAddresses() {
    const [usdtAddress, setUsdtAddress] = useState<`0x${string}`>(CONTRACTS.arbitrumSepolia.USDCToken);
    const [factoryAddress, setFactoryAddress] = useState<`0x${string}`>(CONTRACTS.arbitrumSepolia.VaultFactory);
    const [isLoaded, setIsLoaded] = useState(false);

    useEffect(() => {
        const storedUSDC = localStorage.getItem(STORAGE_KEY_USDC);
        const storedFactory = localStorage.getItem(STORAGE_KEY_FACTORY);

        if (storedUSDC && storedUSDC.startsWith("0x")) {
            setUsdtAddress(storedUSDC as `0x${string}`);
        }
        if (storedFactory && storedFactory.startsWith("0x")) {
            setFactoryAddress(storedFactory as `0x${string}`);
        }
        setIsLoaded(true);
    }, []);

    const updateUsdtAddress = (addr: string) => {
        if (!addr.startsWith("0x")) return;
        setUsdtAddress(addr as `0x${string}`);
        localStorage.setItem(STORAGE_KEY_USDC, addr);
        window.location.reload(); // Simple way to propagate changes to all components nicely
    };

    const updateFactoryAddress = (addr: string) => {
        if (!addr.startsWith("0x")) return;
        setFactoryAddress(addr as `0x${string}`);
        localStorage.setItem(STORAGE_KEY_FACTORY, addr);
        window.location.reload();
    };

    const resetDefaults = () => {
        setUsdtAddress(CONTRACTS.arbitrumSepolia.USDCToken);
        setFactoryAddress(CONTRACTS.arbitrumSepolia.VaultFactory);
        localStorage.removeItem(STORAGE_KEY_USDC);
        localStorage.removeItem(STORAGE_KEY_FACTORY);
        window.location.reload();
    };

    return {
        usdtAddress,
        factoryAddress,
        updateUsdtAddress,
        updateFactoryAddress,
        resetDefaults,
        isLoaded
    };
}
