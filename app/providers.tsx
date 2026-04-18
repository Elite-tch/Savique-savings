"use client";

import '@rainbow-me/rainbowkit/styles.css';
import {
    connectorsForWallets,
    RainbowKitProvider,
    darkTheme,
} from '@rainbow-me/rainbowkit';
import {
    rainbowWallet,
    metaMaskWallet,
    coinbaseWallet,
    walletConnectWallet,
    bifrostWallet,
    ledgerWallet,
} from '@rainbow-me/rainbowkit/wallets';
import { WagmiProvider, createConfig } from 'wagmi';
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { http } from "viem";
import { Toaster } from "sonner";
import { AutoDisconnect } from "@/components/AutoDisconnect";
import { arbitrum, arbitrumSepolia } from "viem/chains";

const projectId = 'd76edd2ec72490269459a792d70e84fc';

const connectors = connectorsForWallets(
    [
        {
            groupName: 'Arbitrum Ecosystem',
            wallets: [
                bifrostWallet,
                walletConnectWallet,
                metaMaskWallet,
            ],
        },
        {
            groupName: 'Others',
            wallets: [
                ledgerWallet,
                coinbaseWallet,
                rainbowWallet,
            ],
        },
    ],
    {
        appName: 'Savique',
        projectId,
    }
);

export const wagmiConfig = createConfig({
    connectors,
    chains: [arbitrumSepolia, arbitrum],
    transports: {
        [arbitrumSepolia.id]: http(undefined, {
            batch: true,
            timeout: 60_000,
            retryCount: 5,
            retryDelay: 2000,
        }),
        [arbitrum.id]: http(undefined, {
            batch: true,
            timeout: 60_000,
            retryCount: 5,
            retryDelay: 2000,
        }),
    },
    ssr: true,
});

const queryClient = new QueryClient();

export default function Providers({ children }: { children: React.ReactNode }) {
    return (
        <WagmiProvider config={wagmiConfig}>
            <QueryClientProvider client={queryClient}>
                <RainbowKitProvider
                    theme={darkTheme({
                        accentColor: '#E62058',
                        accentColorForeground: 'white',
                        borderRadius: 'large',
                        fontStack: 'system',
                        overlayBlur: 'small',
                    })}
                >
                    <>
                        <AutoDisconnect />
                        {children}
                        <Toaster position="top-right" theme="dark" richColors closeButton />
                    </>
                </RainbowKitProvider>
            </QueryClientProvider>
        </WagmiProvider>
    );
}
