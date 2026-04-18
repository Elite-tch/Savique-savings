"use client";

import { useState, useEffect, useMemo } from "react";
import { Card } from "@/components/ui/card";
import {
    Trophy,
    Medal,
    Crown,
    Zap,
    Flame,
    ShieldCheck,
    Award,
    Search,
    Sparkles,
    History
} from "lucide-react";
import { motion } from "framer-motion";
import { useReadContracts, useReadContract, useAccount } from "wagmi";
import { VAULT_ABI, CONTRACTS, ERC20_ABI } from "@/lib/contracts";
import { getAllVaults, SavedVault, getAllReceipts, Receipt } from "@/lib/receiptService";
import { formatUnits } from "viem";
import { Input } from "@/components/ui/input";
import { Wallet } from "lucide-react";

interface UserStats {
    address: string;
    totalTVL: number;     // Lifetime Cumulative Savings ($)
    currentTVL: number;   // Current Balance in Active Vaults ($)
    savingsCount: number; // Count of Savings Plans Created
    rank: number;
    rankLabel: string;
    rankColor: string;
    badgeIcon: any;
}

const BADGE_LEVELS = [
    { minTotal: 50000, label: "Legendary Saver", color: "text-purple-400", tier: "Ultimate Whale", icon: Crown },
    { minTotal: 10000, label: "Elite Accumulator", color: "text-yellow-400", tier: "Elite", icon: Award },
    { minTotal: 2500, label: "Savique Pro", color: "text-blue-400", tier: "Saver", icon: ShieldCheck },
    { minTotal: 500, label: "Disciplined", color: "text-green-400", tier: "Pro", icon: Medal },
    { minTotal: 0, label: "Novice", color: "text-gray-400", tier: "Novice", icon: Zap },
];

const getAvatarGradient = (address: string) => {
    if (!address) return "linear-gradient(135deg, #27272a, #09090b)";
    const s = address.toLowerCase();
    const h1 = s.substring(2, 8);
    const h2 = s.substring(s.length - 6);
    const angle = parseInt(s.substring(3, 5), 16) % 360;
    return `linear-gradient(${angle}deg, #${h1}, #${h2})`;
};

export default function LeaderboardPage() {
    const [savingsData, setSavingsData] = useState<SavedVault[]>([]);
    const [receiptsData, setReceiptsData] = useState<Receipt[]>([]);
    const [dbLoading, setDbLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");

    // Fetch Decimals for formatting
    const { data: decimalsResult } = useReadContract({
        address: CONTRACTS.arbitrumSepolia.USDCToken,
        abi: ERC20_ABI,
        functionName: 'decimals',
    });
    const decimals = Number(decimalsResult) || 18;

    useEffect(() => {
        async function fetchInitialData() {
            setDbLoading(true);
            try {
                const [vData, rData] = await Promise.all([
                    getAllVaults(CONTRACTS.arbitrumSepolia.VaultFactory),
                    getAllReceipts(CONTRACTS.arbitrumSepolia.VaultFactory)
                ]);
                setSavingsData(vData);
                setReceiptsData(rData);
            } catch (e) {
                console.error("DB Fetch Error:", e);
            } finally {
                setDbLoading(false);
            }
        }
        fetchInitialData();
    }, []);

    const contracts = useMemo(() => {
        const calls: any[] = [];
        savingsData.forEach(s => {
            if (s.vaultAddress?.startsWith('0x')) {
                calls.push({ address: s.vaultAddress as `0x${string}`, abi: VAULT_ABI, functionName: 'totalAssets' });
            }
        });
        return calls;
    }, [savingsData]);

    const { data: results, isLoading: chainLoading } = useReadContracts({
        contracts,
        query: {
            enabled: savingsData.length > 0,
            refetchInterval: 30000
        }
    });

    const loading = dbLoading || (savingsData.length > 0 && chainLoading);

    const allUsersStats = useMemo(() => {
        if (!savingsData.length && !receiptsData.length) return [];

        const userMap: Record<string, {
            currentTVL: number;
            totalTVL: number;
            totalCount: number;
        }> = {};

        // 1. Process Current TVL (Active Balances)
        savingsData.forEach((s, i) => {
            const owner = s.owner.toLowerCase();
            // Filter: Only EVM (0x) wallets
            if (!owner.startsWith('0x')) return;

            if (!userMap[owner]) userMap[owner] = { currentTVL: 0, totalTVL: 0, totalCount: 0 };
            userMap[owner].totalCount++;

            if (results && results[i]) {
                const assetRes = results[i];
                const assets = assetRes?.status === 'success' ? parseFloat(formatUnits(assetRes.result as bigint, decimals)) : 0;
                userMap[owner].currentTVL += assets;
            }
        });

        // 2. Process Total TVL (Lifetime Journey)
        receiptsData.forEach(r => {
            const owner = r.walletAddress.toLowerCase();
            if (!owner.startsWith('0x')) return; // Filter: Only EVM wallets

            if (r.type === 'created') {
                const amount = parseFloat(r.amount) || 0;
                if (!userMap[owner]) {
                    userMap[owner] = { currentTVL: 0, totalTVL: amount, totalCount: 0 };
                } else {
                    userMap[owner].totalTVL += amount;
                }
            }
        });

        const statsList: UserStats[] = Object.entries(userMap).map(([address, data]) => {
            return {
                address,
                totalTVL: data.totalTVL,
                currentTVL: data.currentTVL,
                savingsCount: data.totalCount,
                rank: 0, rankLabel: "", rankColor: "", badgeIcon: null
            };
        });

        // RANK BY TOTAL TVL (Journey)
        const sorted = statsList.sort((a, b) => b.totalTVL - a.totalTVL);

        return sorted.map((stat, index) => {
            const rank = index + 1;
            const level = BADGE_LEVELS.find(lvl => stat.totalTVL >= lvl.minTotal) || BADGE_LEVELS[BADGE_LEVELS.length - 1];
            return { ...stat, rank, rankLabel: level.tier, rankColor: level.color, badgeIcon: level.icon };
        });
    }, [savingsData, results, receiptsData, decimals]);

    const filteredStats = useMemo(() => {
        const list = searchQuery
            ? allUsersStats.filter(s => s.address.toLowerCase().includes(searchQuery.toLowerCase()))
            : allUsersStats;

        return list.slice(0, 20); // Limit to Top 20
    }, [allUsersStats, searchQuery]);

    const { isConnected } = useAccount();

    if (!isConnected) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <Card className="p-12 text-center max-w-md bg-white/5 border-white/10">
                    <Wallet className="w-16 h-16 text-gray-500 mx-auto mb-4" />
                    <h2 className="text-2xl font-bold text-white mb-2">Connect Your Wallet</h2>
                    <p className="text-gray-400">Please connect your wallet to view your dashboard and manage your savings.</p>
                </Card>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="space-y-10 animate-pulse p-4">
                <div className="h-10 w-48 bg-white/5 rounded-lg" />
                <div className="h-96 bg-white/5 rounded-[2.5rem]" />
            </div>
        );
    }

    return (
        <div className="space-y-8 text-zinc-100 p-2 md:p-6 pb-20">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row justify-between items-end md:items-center gap-6">
                <div className="space-y-1">
                    <h2 className="text-3xl font-bold tracking-tight text-white flex items-center gap-3">
                        <Trophy className="w-8 h-8 text-primary" /> Savique Legends
                    </h2>
                    <p className="text-zinc-500 text-sm italic">Ranked by Lifetime Savings Journey.</p>
                </div>
                <div className="relative w-full md:w-72">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                    <Input
                        placeholder="Search EVM Player..."
                        className="pl-9 h-11 bg-zinc-900 border-zinc-800 text-white rounded-xl focus:border-primary/50 transition-all text-sm shadow-inner"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
            </div>

            {/* Main Standings Table */}
            <div className="w-full overflow-hidden">
                <Card className="bg-zinc-900/20 border-zinc-800/40 rounded-[2rem] shadow-none overflow-hidden">
                    <div className="overflow-x-auto no-scrollbar">
                        <table className="w-full text-left text-sm min-w-[900px]">
                            <thead>
                                <tr className="text-zinc-500 text-[11px] uppercase tracking-[0.1em] border-b border-white/5">
                                    <th className="px-8 py-5 font-black whitespace-nowrap">Place</th>
                                    <th className="px-8 py-5 font-black whitespace-nowrap">Player Address</th>
                                    <th className="px-8 py-5 font-black text-center whitespace-nowrap">Current TVL</th>
                                    <th className="px-8 py-5 font-black text-center whitespace-nowrap">Total TVL</th>
                                    <th className="px-8 py-5 font-black text-right whitespace-nowrap">Rank</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {filteredStats.map((user, i) => (
                                    <motion.tr
                                        key={user.address}
                                        initial={{ opacity: 0, y: 5 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: i * 0.02 }}
                                        className="hover:bg-white/[0.03] transition-colors group cursor-default"
                                    >
                                        <td className="px-8 py-4 font-black">
                                            <div className="flex items-center gap-2">
                                                <span className={`${i < 3 ? 'text-primary' : 'text-zinc-500'}`}>
                                                    {user.rank.toString().padStart(2, '0')}
                                                </span>
                                                {i === 0 && <Crown className="w-3 h-3 text-primary animate-pulse ml-1" />}
                                            </div>
                                        </td>
                                        <td className="px-8 py-4 whitespace-nowrap">
                                            <div className="flex items-center gap-4">
                                                <div
                                                    className="w-10 h-10 rounded-full border-2 border-zinc-800 shadow-xl group-hover:scale-110 transition-transform duration-300"
                                                    style={{ background: getAvatarGradient(user.address) }}
                                                />
                                                <div className="flex flex-col">
                                                    <span className="font-bold text-zinc-300 font-mono tracking-tight group-hover:text-white transition-colors">
                                                        {user.address.slice(0, 10)}...{user.address.slice(-8)}
                                                    </span>
                                                    <span className="text-[9px] text-zinc-500 uppercase tracking-tighter">
                                                        {user.savingsCount} SAVINGS PLANS
                                                    </span>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-8 py-4 text-center whitespace-nowrap">
                                            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/5 text-primary border border-primary/20 font-bold hover:bg-primary/10 transition-all">
                                                ${user.currentTVL.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                            </div>
                                        </td>
                                        <td className="px-8 py-4 text-center whitespace-nowrap">
                                            <div className="flex flex-col items-center">
                                                <span className="text-lg font-bold text-white tracking-tight">
                                                    ${user.totalTVL.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-8 py-4 text-right">
                                            <div className="flex items-center justify-end gap-3 whitespace-nowrap">
                                                <user.badgeIcon className={`w-4 h-4 ${user.rankColor}`} />
                                                <span className={`text-[11px] font-black uppercase tracking-widest ${user.rankColor}`}>{user.rankLabel}</span>
                                            </div>
                                        </td>
                                    </motion.tr>
                                ))}
                            </tbody>
                        </table>
                        {filteredStats.length === 0 && (
                            <div className="py-20 text-center space-y-4">
                                <Search className="w-12 h-12 text-zinc-800 mx-auto" />
                                <p className="text-zinc-500 font-medium italic">No EVM legendary savers found.</p>
                            </div>
                        )}
                    </div>
                </Card>
            </div>

            {/* Bottom Status Feed */}
            <div className="bg-gradient-to-r from-zinc-900/0 via-zinc-900 to-zinc-900/0 py-6 text-center">
                <p className="text-zinc-500 text-xs font-medium uppercase tracking-[0.2em] flex items-center justify-center gap-3">
                    <Sparkles className="w-4 h-4 text-primary" /> Every on-chain deposit strengthens your legend status.
                </p>
            </div>
        </div>
    );
}
