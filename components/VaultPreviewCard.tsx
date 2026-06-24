"use client";

import { Card } from "@/components/ui/card";
import Link from "next/link";
import { motion } from "framer-motion";
import { useReadContract } from "wagmi";
import { PRIVATE_SAVINGS_POOL_ABI, ERC20_ABI, CONTRACTS } from "@/lib/contracts";
import { formatUnits } from "viem";
import { useEffect, useState, useMemo } from "react";
import { getVaultByAddress, getReceiptsByVault, SavedVault } from "@/lib/receiptService";
import { Progress } from "@/components/ui/progress";
import { useAccount } from "wagmi";

export function VaultPreviewCard({ address: vaultIdStr, index }: { address: string; index: number }) {
    const { address: userAddress } = useAccount();
    const poolAddress = CONTRACTS.arbitrumSepolia.VaultFactory;

    const isLegacy = vaultIdStr.startsWith('0x');

    const { data: vaultDetails } = useReadContract({
        address: poolAddress,
        abi: PRIVATE_SAVINGS_POOL_ABI,
        functionName: "getVaultDetails",
        args: [userAddress as `0x${string}`, isLegacy ? BigInt(0) : BigInt(vaultIdStr)],
        query: { enabled: !!userAddress && !isLegacy }
    });

    const [vaultData, setVaultData] = useState<SavedVault | null>(null);

    const purpose = isLegacy ? vaultData?.purpose : vaultDetails?.[2];
    const unlockTimeResult = isLegacy ? null : vaultDetails?.[0];

    const [historicalAmount, setHistoricalAmount] = useState<string | null>(null);

    useEffect(() => {
        const fetchVault = async () => {
            const data = await getVaultByAddress(vaultIdStr);
            setVaultData(data);
        };
        fetchVault();
    }, [vaultIdStr]);

    // For preview, we display the targetAmount or hide the balance
    // since FHE requires a permit to decrypt the actual balance.
    useEffect(() => {
        if (unlockTimeResult) {
            const matured = Date.now() >= Number(unlockTimeResult) * 1000;
            if (matured) {
                getReceiptsByVault(vaultIdStr).then(receipts => {
                    const withdrawal = receipts.find(r => r.type === 'completed' || r.type === 'breaked');
                    if (withdrawal) {
                        setHistoricalAmount(withdrawal.amount);
                    }
                });
            }
        }
    }, [unlockTimeResult, vaultIdStr]);

    const displayBalance = historicalAmount || vaultData?.currentTotal?.toString() || "Private";

    const progressValue = useMemo(() => {
        if (!vaultData?.targetAmount) return 0;
        const current = historicalAmount ? parseFloat(historicalAmount) : parseFloat(vaultData.currentTotal?.toString() || "0");
        const target = parseFloat(vaultData.targetAmount);
        if (target === 0) return 100;
        return Math.min(100, (current / target) * 100);
    }, [vaultData, historicalAmount]);
    const unlockDate = unlockTimeResult ? new Date(Number(unlockTimeResult) * 1000) : new Date();
    const isLocked = new Date() < unlockDate;

    return (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.1 }} className="h-full">
            <Link href={`/dashboard/savings/${vaultIdStr}`} className="h-full block">
                <Card className="bg-zinc-900/40 border-zinc-800/50 hover:border-zinc-700 transition-all cursor-pointer group p-8 h-full flex flex-col">
                    <div className="flex justify-between items-start mb-4">
                        <h3 className="text-lg font-bold text-white truncate">{purpose || "Loading..."}</h3>
                        <div className={`px-2 py-1 rounded text-xs font-medium shrink-0 ${isLocked 
                            ? 'bg-orange-500/10 text-orange-400' 
                            : progressValue >= 100 
                                ? 'bg-green-500/10 text-green-400' 
                                : 'bg-primary/10 text-primary'}`}>
                            {isLocked ? 'Active' : progressValue >= 100 ? 'Completed' : 'Expired'}
                        </div>
                    </div>
                    <div className="space-y-4 mt-auto">
                        <div className="flex justify-between text-sm">
                            <span className="text-gray-400">Balance:</span>
                            <span className="text-white font-medium">{displayBalance === "Private" ? displayBalance : `$${parseFloat(displayBalance).toFixed(2)}`}</span>
                        </div>

                        {vaultData?.targetAmount && parseFloat(vaultData.targetAmount) > 0 && (
                            <div className="space-y-1.5 pt-1">
                                <div className="flex justify-between text-[10px] uppercase tracking-wider font-bold">
                                    <span className="text-gray-500">Progress</span>
                                    <span className="text-primary">{progressValue.toFixed(0)}%</span>
                                </div>
                                <Progress value={progressValue} className="h-1.5 bg-white/5" />
                            </div>
                        )}

                        <div className="flex justify-between text-sm pt-1">
                            <span className="text-gray-400">
                                {isLocked ? "Target Date:" : progressValue >= 100 ? "Completed on:" : "Expired on:"}
                            </span>
                            <span className="text-white font-medium">{unlockDate.toLocaleDateString()}</span>
                        </div>
                    </div>
                </Card>
            </Link>
        </motion.div>
    );
}
