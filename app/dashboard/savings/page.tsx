"use client";

import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Lock, Unlock, Search, Wallet, Clock, AlertTriangle, Calendar, Eye, EyeOff, Loader2 } from "lucide-react";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { useAccount, useReadContract } from "wagmi";
import { CONTRACTS, PRIVATE_SAVINGS_POOL_ABI, ERC20_ABI } from "@/lib/contracts";
import { formatUnits } from "viem";
import { motion } from "framer-motion";
import { getReceiptsByWallet, Receipt, getUserVaultsFromDb, saveVault, getVaultByAddress, SavedVault } from "@/lib/receiptService";
import { usePublicClient } from "wagmi";
import { useFhenix } from "@/lib/fhenixContext";
import { Progress } from "@/components/ui/progress";
import { Suspense, useMemo } from "react";
import { ChevronLeft, ChevronRight, FileText, CheckCircle2, History } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";

function useCountdown(targetDate: Date) {
    const [timeLeft, setTimeLeft] = useState({
        days: 0,
        hours: 0,
        minutes: 0,
        seconds: 0,
        isExpired: false
    });

    useEffect(() => {
        const targetTime = targetDate.getTime(); // Convert to timestamp once

        const calculateTimeLeft = () => {
            const now = new Date().getTime();
            const difference = targetTime - now;

            if (difference <= 0) {
                setTimeLeft(prev => prev.isExpired ? prev : { days: 0, hours: 0, minutes: 0, seconds: 0, isExpired: true });
                return;
            }

            const days = Math.floor(difference / (1000 * 60 * 60 * 24));
            const hours = Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((difference % (1000 * 60)) / 1000);

            setTimeLeft({ days, hours, minutes, seconds, isExpired: false });
        };

        calculateTimeLeft();
        const interval = setInterval(calculateTimeLeft, 1000);

        return () => clearInterval(interval);
    }, [targetDate.getTime()]); // Use timestamp instead of Date object

    return timeLeft;
}


function CompletedVaultCard({
    vault,
    receipt,
    activeTab
}: {
    vault: SavedVault,
    receipt?: Receipt,
    activeTab: string
}) {
    const isBroken = receipt?.type === 'breaked';


    return (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <Card className="bg-zinc-900/40 border-zinc-800/50 hover:border-zinc-700 transition-all">
                <div className="p-2 space-y-4">
                    <div className="flex justify-between items-center gap-3">
                        <h3 className="text-lg font-bold text-white truncate max-w-[180px]">
                            {vault.purpose && vault.purpose.length > 20 
                                ? vault.purpose.slice(0, 17) + "..." 
                                : vault.purpose || "Savings"}
                        </h3>
                        <span className={`px-2 py-0.5 rounded-[4px] text-[10px] uppercase font-bold tracking-wider border ${isBroken
                            ? 'bg-red-500/10 text-red-500 border-red-500/20'
                            : 'bg-green-500/10 text-green-500 border-green-500/20'
                            }`}>
                            {isBroken ? 'Broken Early' : 'Withdrawal'}
                        </span>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <p className="text-[10px] text-zinc-500 uppercase font-bold mb-0.5">Withdrawn</p>
                            <div className="flex items-baseline gap-1">
                                <span className="text-xl font-bold text-white">{receipt?.amount || "0.00"}</span>
                                <span className="text-[10px] text-zinc-500">USDC</span>
                            </div>
                        </div>
                        <div className="text-right">
                            <p className="text-[10px] text-zinc-500 uppercase font-bold mb-0.5">Date</p>
                            <p className="text-xs text-white">
                                {receipt ? new Date(receipt.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'N/A'}
                            </p>
                        </div>
                    </div>

                    <div className="pt-3 border-t border-white/5 flex">
                        <Link href={`/dashboard/savings/${vault.vaultAddress}?tab=${activeTab}`} className="flex-1">
                            <Button
                                variant="ghost"
                                size="sm"
                                className="w-full h-8 text-[10px] bg-white/5 hover:bg-white/10 text-zinc-400"
                            >
                                <Eye className="w-3 h-3 mr-2" />
                                Details
                            </Button>
                        </Link>
                    </div>
                </div>
            </Card>
        </motion.div>
    );
}

// Keep the original VaultCard but update it for FHE shared pool integration
function VaultCard({ vaultId, activeTab }: { vaultId: string, activeTab: string }) {
    const { address: userAddress } = useAccount();
    const publicClient = usePublicClient();
    const { fhenixClient, isInitialized, decryptHandle } = useFhenix();

    const poolAddress = CONTRACTS.arbitrumSepolia.VaultFactory;
    const { data: decimals } = useReadContract({ address: CONTRACTS.arbitrumSepolia.USDCToken, abi: ERC20_ABI, functionName: 'decimals' });
    
    const { data: vaultDetails } = useReadContract({ 
        address: poolAddress, 
        abi: PRIVATE_SAVINGS_POOL_ABI, 
        functionName: "getVaultDetails",
        args: [userAddress as `0x${string}`, BigInt(vaultId)],
        query: { enabled: !!userAddress }
    });

    const purpose = vaultDetails?.[2];
    const unlockTimeResult = vaultDetails?.[0];

    const [privateBalance, setPrivateBalance] = useState<string>("0");
    const [creationDate, setCreationDate] = useState<Date | null>(null);
    const [vaultData, setVaultData] = useState<SavedVault | null>(null);

    // Fetch private balance via CoFHE decryption flow
    useEffect(() => {
        const fetchPrivateBalance = async () => {
            if (!isInitialized || !fhenixClient || !userAddress || !publicClient) return;
            try {
                const ctHandle = await publicClient.readContract({
                    address: poolAddress,
                    abi: PRIVATE_SAVINGS_POOL_ABI,
                    functionName: 'getEncryptedSharesHandle',
                    args: [userAddress as `0x${string}`, BigInt(vaultId)]
                });
                
                if (ctHandle !== "0x0000000000000000000000000000000000000000000000000000000000000000") {
                    const decrypted = await decryptHandle(ctHandle as `0x${string}`, poolAddress);
                    if (decrypted !== null) {
                         setPrivateBalance(formatUnits(decrypted, decimals || 18));
                    }
                }
            } catch (e) {
                console.error("Failed to read private balance:", e);
            }
        };
        fetchPrivateBalance();
    }, [isInitialized, fhenixClient, userAddress, vaultId, publicClient, decimals, poolAddress, decryptHandle]);

    const balance = privateBalance;
    const unlockDate = unlockTimeResult ? new Date(Number(unlockTimeResult) * 1000) : new Date();
    const isLocked = new Date() < unlockDate;
    const countdown = useCountdown(unlockDate);

    useEffect(() => {
        const fetchVaultData = async () => {
            // In the DB, the vault address is stored as the vaultId string
            const data = await getVaultByAddress(vaultId);
            setVaultData(data);
            if (data?.createdAt) {
                setCreationDate(new Date(data.createdAt));
            }
        };
        fetchVaultData();
    }, [vaultId]);

    const progressValue = useMemo(() => {
        if (!vaultData?.targetAmount || !privateBalance) return 0;
        const current = parseFloat(privateBalance);
        const target = parseFloat(vaultData.targetAmount);
        if (target === 0) return 100;
        return Math.min(100, (current / target) * 100);
    }, [vaultData, privateBalance]);

    // Format countdown parts
    const formatCountdown = () => {
        if (countdown.isExpired) return "Unlocked!";
        const parts = [];
        if (countdown.days > 0) parts.push(`${countdown.days}d`);
        if (countdown.hours > 0 || parts.length > 0) parts.push(`${countdown.hours}h`);
        if (countdown.minutes > 0 || parts.length > 0) parts.push(`${countdown.minutes}m`);
        parts.push(`${countdown.seconds}s`);
        return parts.join(" ");
    };

    return (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <Link href={`/dashboard/savings/${vaultId}?tab=${activeTab}`}>
                <Card className="bg-zinc-900/40 border-zinc-800/50 hover:border-zinc-700 transition-all cursor-pointer group h-full">
                    <div className="p-4 space-y-4">
                        <div className="flex justify-between items-center">
                            <div className="space-y-1">
                                <h3 className="text-xl font-bold text-white truncate max-w-[200px]">{purpose || "Loading..."}</h3>
                            </div>
                            <div className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${isLocked 
                                ? 'bg-orange-500/10 text-orange-400 border-orange-500/20' 
                                : progressValue >= 100 
                                    ? 'bg-green-500/10 text-green-500 border-green-500/20' 
                                    : 'bg-primary/10 text-primary border-primary/20' }`}>
                                {isLocked ? 'Active' : progressValue >= 100 ? 'Completed' : 'Expired'}
                            </div>
                        </div>

                        <div>
                            <div className="flex items-center gap-2 text-gray-500 text-xs mb-3">
                                <Calendar className="w-3 h-3" />
                                <span>Created: {creationDate ? creationDate.toLocaleDateString() : '...'}</span>
                            </div>

                            {isLocked ? (
                                <div className="bg-zinc-950/50 border border-white/5 rounded-xl p-3">
                                    <div className="flex justify-between items-center mb-1">
                                        <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold">Target Remaining</p>
                                        <Clock className="w-3 h-3 text-orange-500" />
                                    </div>
                                    <div className="font-mono text-lg font-bold text-white">
                                        {formatCountdown()}
                                    </div>
                                </div>
                            ) : (
                                <div className={`rounded-xl p-3 border ${progressValue >= 100 
                                    ? 'bg-green-500/5 border-green-500/10 text-green-500' 
                                    : 'bg-primary/5 border-primary/10 text-primary'}`}>
                                    <div className="flex items-center gap-2 text-xs font-bold">
                                        
                                        {progressValue >= 100 ? 'Goal Reached - Ready for Withdrawal' : 'Period Ended - Ready for Withdrawal'}
                                    </div>
                                </div>
                            )}
                        </div>

                        {vaultData?.targetAmount && parseFloat(vaultData.targetAmount) > 0 && (
                            <div className="space-y-2">
                                <div className="flex justify-between items-end">
                                    <span className="text-[10px] text-zinc-500 uppercase font-bold tracking-widest leading-none">Goal Progress</span>
                                    <span className="text-xs font-bold text-primary leading-none">{progressValue.toFixed(0)}%</span>
                                </div>
                                <Progress value={progressValue} className="h-1.5 bg-white/5 border-none" />
                            </div>
                        )}

                        <div className="pt-3 border-t border-white/5">
                            <p className="text-[10px] text-zinc-500 uppercase font-bold tracking-widest mb-1">Total Savings</p>
                            <div className="text-2xl font-bold text-white flex items-baseline gap-1">
                                {parseFloat(balance).toLocaleString()} <span className="text-[10px] font-normal text-zinc-500">USDC</span>
                            </div>
                        </div>
                    </div>
                </Card>
            </Link>
        </motion.div>
    );
}

type TabType = 'active' | 'matured' | 'completed';

export default function SavingsPage() {
    return (
        <Suspense fallback={<div className="h-40 flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>}>
            <SavingsDashboard />
        </Suspense>
    );
}

function SavingsDashboard() {
    const { address, isConnected } = useAccount();
    const publicClient = usePublicClient();
    const router = useRouter();
    const searchParams = useSearchParams();

    // URL is the source of truth for the active tab
    const activeTab = (searchParams.get('tab') as TabType) || 'active';
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage] = useState(6);
    const [isLoading, setIsLoading] = useState(true);
    const [currentTime, setCurrentTime] = useState(Date.now());
    const [rawVaults, setRawVaults] = useState<{
        vaddr: string, // now representing vaultId
        balanceResult: string,
        unlockResult: bigint
    }[]>([]);
    const [completedHistory, setCompletedHistory] = useState<{ vault: SavedVault, receipt?: Receipt }[]>([]);
    const { fhenixClient, isInitialized, decryptHandle } = useFhenix();

    // Automatically update time every 10s to move cards between tabs reactively
    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(Date.now()), 10000);
        return () => clearInterval(timer);
    }, []);

    useEffect(() => {
        const loadAndCategorizeVaults = async () => {
            if (!address || !publicClient || !isInitialized || !fhenixClient) return;
            setIsLoading(true);
            try {
                const poolAddress = CONTRACTS.arbitrumSepolia.VaultFactory;
                
                // 1. Get userVaultCount
                const vaultCountResult = await publicClient.readContract({
                    address: poolAddress,
                    abi: PRIVATE_SAVINGS_POOL_ABI,
                    functionName: "userVaultCount",
                    args: [address]
                });
                
                const count = Number(vaultCountResult);
                if (count === 0) {
                    setRawVaults([]);
                    setCompletedHistory([]);
                    return;
                }

                const uniqueAddresses = Array.from({ length: count }, (_, i) => i.toString());

                // 2. Fetch balance and status for each using CoFHE
                const results = await Promise.all(uniqueAddresses.map(async (vaultIdStr) => {
                    try {
                        const vaultId = BigInt(vaultIdStr);
                        
                        const [vaultDetails, ctHandle] = await Promise.all([
                            publicClient.readContract({
                                address: poolAddress,
                                abi: PRIVATE_SAVINGS_POOL_ABI,
                                functionName: "getVaultDetails",
                                args: [address as `0x${string}`, vaultId]
                            }),
                            publicClient.readContract({
                                address: poolAddress,
                                abi: PRIVATE_SAVINGS_POOL_ABI,
                                functionName: 'getEncryptedSharesHandle',
                                args: [address as `0x${string}`, vaultId]
                            })
                        ]);
                        
                        const isActive = vaultDetails[3];
                        if (!isActive) return null; // Ignore inactive
                        
                        let bal = 0n;
                        if (ctHandle !== "0x0000000000000000000000000000000000000000000000000000000000000000") {
                             const decrypted = await decryptHandle(ctHandle as `0x${string}`, poolAddress);
                             if (decrypted !== null) bal = decrypted;
                        }
                        
                        return { 
                            vaddr: vaultIdStr, 
                            balanceResult: formatUnits(bal as bigint, 18), // Use 18 as default for simplification, we only check if > 0
                            unlockResult: vaultDetails[0] as bigint
                        };
                    } catch (e) {
                        console.error(`Error checking vault ${vaultIdStr}:`, e);
                        return null;
                    }
                }));

                const validResults = results.filter(Boolean) as any[];
                setRawVaults(validResults);

                // 3. Identification of completed (zero balance) vaults for Withdrawal tab
                const completedAddresses = validResults
                    .filter(res => parseFloat(res.balanceResult) === 0)
                    .map(res => res.vaddr);

                // Parallel fetch metadata and receipts for completed vaults
                const [allReceipts, ...allMetadataResults] = await Promise.all([
                    getReceiptsByWallet(address, poolAddress),
                    ...completedAddresses.map(vaddr => getVaultByAddress(vaddr))
                ]);

                const indexedCompleted = completedAddresses.map((vaddr, i) => {
                    const metadata = allMetadataResults[i];
                    if (!metadata) return null;

                    const withdrawReceipt = allReceipts.find(r =>
                        r.vaultAddress?.toLowerCase() === vaddr.toLowerCase() &&
                        (r.type === 'completed' || r.type === 'breaked')
                    );

                    return { vault: metadata, receipt: withdrawReceipt };
                }).filter(Boolean);

                setCompletedHistory(indexedCompleted as any);

            } catch (error) {
                console.error("Failed to load/categorize vaults:", error);
            } finally {
                setIsLoading(false);
            }
        };

        loadAndCategorizeVaults();
    }, [address, publicClient, fhenixClient, isInitialized]);

    // Categorize vaults reactively based on current time
    const allVaultsData = useMemo(() => {
        const active: string[] = [];
        const matured: string[] = [];

        rawVaults.forEach(res => {
            const bal = parseFloat(res.balanceResult);
            const unlockTime = Number(res.unlockResult) * 1000;
            const isMatured = currentTime >= unlockTime;

            if (bal > 0) {
                if (isMatured) matured.push(res.vaddr);
                else active.push(res.vaddr);
            }
        });

        return {
            active,
            matured,
            completed: completedHistory
        };
    }, [rawVaults, completedHistory, currentTime]);

    // Pagination Logic
    const currentItems = useMemo(() => {
        const list = allVaultsData[activeTab];
        const start = (currentPage - 1) * itemsPerPage;
        return list.slice(start, start + itemsPerPage);
    }, [activeTab, allVaultsData, currentPage]);

    const totalPages = useMemo(() => {
        const list = allVaultsData[activeTab];
        return Math.ceil(list.length / itemsPerPage);
    }, [activeTab, allVaultsData]);

    const handleTabChange = (tab: TabType) => {
        // Update URL to change tab
        const params = new URLSearchParams(searchParams.toString());
        params.set('tab', tab);
        router.replace(`?${params.toString()}`, { scroll: false });
        setCurrentPage(1);
    };

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

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                <div>
                    <h1 className="text-3xl font-bold text-white tracking-tight">My Savings</h1>
                    <p className="text-zinc-500 mt-1">Track and manage your progressive capital accumulation.</p>
                </div>
                <Link href="/dashboard/create">
                    <Button className="shrink-0 bg-primary hover:bg-primary/90 text-white font-bold px-6 h-11 shadow-[0_0_20px_rgba(230,32,88,0.3)]">
                        <Plus className="w-5 h-5 mr-2" /> New Savings
                    </Button>
                </Link>
            </div>

            {/* Tabs - Responsive with scrolling */}
            <div className="flex items-center gap-1 bg-white/5 p-1 rounded-xl w-full md:w-fit border border-white/10 overflow-x-scroll no-scrollbar flex-wrap gap-4 ">
                {(['active', 'matured', 'completed'] as TabType[]).map((tab) => (
                    <button
                        key={tab}
                        onClick={() => handleTabChange(tab)}
                        className={`px-6 py-2.5 rounded-lg text-sm font-bold transition-all flex items-center gap-2 shrink-0 ${activeTab === tab
                            ? 'bg-primary text-white shadow-lg'
                            : 'text-zinc-500 hover:text-zinc-300 border-white/5 border hover:bg-white/5'
                            }`}
                    >
                        <span className="capitalize">{tab === 'completed' ? 'Withdrawal' : tab}</span>
                        <span className={`px-1.5 py-0.5 rounded text-[10px] ${activeTab === tab ? 'bg-white/20 text-white' : 'bg-white/10 text-zinc-500'
                            }`}>
                            {allVaultsData[tab].length}
                        </span>
                    </button>
                ))}
            </div>

            {/* Grid Area */}
            <div className="min-h-[400px]">
                {isLoading ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {[1, 2, 3].map((i) => (
                            <div key={i} className="h-[280px] rounded-2xl bg-white/5 animate-pulse border border-white/5" />
                        ))}
                    </div>
                ) : currentItems.length > 0 ? (
                    <>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {activeTab === 'completed'
                                ? (currentItems as { vault: SavedVault, receipt?: Receipt }[]).map((item) => (
                                    <CompletedVaultCard key={item.vault.vaultAddress} vault={item.vault} receipt={item.receipt} activeTab={activeTab} />
                                ))
                                : (currentItems as string[]).map((vaultId) => (
                                    <VaultCard key={vaultId} vaultId={vaultId} activeTab={activeTab} />
                                ))
                            }
                        </div>

                        {/* Pagination */}
                        {totalPages > 1 && (
                            <div className="flex justify-center items-center gap-4 mt-12 pb-8">
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                    disabled={currentPage === 1}
                                    className="bg-white/5 border border-white/10"
                                >
                                    <ChevronLeft className="w-4 h-4 mr-1" /> Previous
                                </Button>
                                <span className="text-zinc-500 text-sm font-medium">
                                    Page <span className="text-white">{currentPage}</span> of {totalPages}
                                </span>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                    disabled={currentPage === totalPages}
                                    className="bg-white/5 border border-white/10"
                                >
                                    Next <ChevronRight className="w-4 h-4 ml-1" />
                                </Button>
                            </div>
                        )}
                    </>
                ) : (
                    <Card className="border-dashed border-white/10 bg-transparent flex flex-col items-center justify-center p-12 text-center h-[400px]">
                        <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mb-6">
                            {activeTab === 'active' ? <Lock className="w-10 h-10 text-zinc-600" /> :
                                activeTab === 'matured' ? <Unlock className="w-10 h-10 text-zinc-600" /> :
                                    <History className="w-10 h-10 text-zinc-600" />}
                        </div>
                        <h3 className="text-xl font-bold text-white mb-2">
                            {activeTab === 'active' ? 'No Active Goals' :
                                activeTab === 'matured' ? 'No Matured Savings' :
                                    'No Completed History'}
                        </h3>
                        <p className="text-zinc-500 mb-8 max-w-sm mx-auto">
                            {activeTab === 'active' ? "You don't have any locked commitment plans yet. Create one to secure your future." :
                                activeTab === 'matured' ? "All your locks are currently active. Once a lock expires, it will appear here for withdrawal." :
                                    "You haven't fully withdrawn or broken any Savings yet. Your completed history will be archived here."}
                        </p>
                        {activeTab === 'active' && (
                            <Link href="/dashboard/create">
                                <Button className="bg-primary hover:bg-primary/90 text-white font-bold h-11 px-8">
                                    Start Your First Goal
                                </Button>
                            </Link>
                        )}
                    </Card>
                )}
            </div>
        </div>
    );
}
