"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
    ShieldCheck, 
    ExternalLink, 
    Lock, 
    CheckCircle2, 
    Calendar, 
    Info, 
    Globe,
    Clock
} from "lucide-react";
import { getSharedProofById, SharedProofConfig } from "@/lib/proofService";
import { getReceiptsByWallet, Receipt } from "@/lib/receiptService";
import { CONTRACTS, PRIVATE_SAVINGS_POOL_ABI } from "@/lib/contracts";
import { createPublicClient, http } from "viem";
import { arbitrumSepolia } from "viem/chains";
import Link from "next/link";

const publicClient = createPublicClient({
    chain: arbitrumSepolia,
    transport: http()
});

export default function VerifyProofPage() {
    const params = useParams();
    const id = params.id as string;

    const [proofConfig, setProofConfig] = useState<SharedProofConfig | null>(null);
    const [receipts, setReceipts] = useState<Receipt[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [vaultDetails, setVaultDetails] = useState<Record<string, any>>({});

    useEffect(() => {
        const loadProofData = async () => {
            try {
                setIsLoading(true);
                const config = await getSharedProofById(id);
                if (!config) {
                    setError("This proof link is invalid or has expired.");
                    return;
                }
                setProofConfig(config);

                const allReceipts = await getReceiptsByWallet(config.walletAddress, CONTRACTS.arbitrumSepolia.VaultFactory);

                const filtered = allReceipts.filter(r => {
                    const inTimeRange = r.timestamp >= config.startDate && r.timestamp <= config.endDate;
                    const isAllowed = config.allowedVaults.includes(r.vaultAddress || "");
                    return inTimeRange && isAllowed;
                });

                setReceipts(filtered);

                const uniqueVaults = Array.from(new Set(filtered.map(r => r.vaultAddress))).filter(Boolean) as string[];
                const details: Record<string, any> = {};
                
                await Promise.all(uniqueVaults.map(async (vaultIdStr) => {
                    try {
                        const vaultDetails = await publicClient.readContract({
                            address: CONTRACTS.arbitrumSepolia.VaultFactory,
                            abi: PRIVATE_SAVINGS_POOL_ABI,
                            functionName: 'getVaultDetails',
                            args: [config.walletAddress as `0x${string}`, BigInt(vaultIdStr)]
                        });
                        details[vaultIdStr] = {
                            unlockTimestamp: Number(vaultDetails[0]) * 1000,
                        };
                    } catch (e) {
                        console.error(`Error fetching on-chain data for ${vaultIdStr}:`, e);
                    }
                }));
                setVaultDetails(details);

            } catch (err) {
                console.error("Error loading proof:", err);
                setError("Failed to load proof data. Please try again later.");
            } finally {
                setIsLoading(false);
            }
        };

        if (id) loadProofData();
    }, [id]);

    if (isLoading) {
        return (
            <div className="min-h-screen bg-black flex flex-col items-center justify-center p-6 text-center">
                <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mb-6 animate-pulse">
                    <ShieldCheck className="w-10 h-10 text-primary" />
                </div>
                <h2 className="text-xl font-bold text-white mb-2">Verifying Financial Record...</h2>
                <p className="text-gray-500 text-sm">Connecting to Arbitrum Blockchain</p>
            </div>
        );
    }

    if (error || !proofConfig) {
        return (
            <div className="min-h-screen bg-black flex flex-col items-center justify-center p-6 text-center">
                <Card className="max-w-md p-8 bg-zinc-900/40 border-zinc-800">
                    <Info className="w-16 h-16 text-red-500 mx-auto mb-4" />
                    <h2 className="text-2xl font-bold text-white mb-2">Access Denied</h2>
                    <p className="text-gray-400 mb-6">{error || "This document is no longer available."}</p>
                    <Link href="/">
                        <Button className="bg-primary hover:bg-primary/90 text-white">Back to Savique</Button>
                    </Link>
                </Card>
            </div>
        );
    }

    const vaultRecords = Array.from(new Set(receipts.map(r => r.vaultAddress))).filter(Boolean) as string[];

    return (
        <div className="min-h-screen bg-[#050505] text-white p-4 md:p-12 selection:bg-primary selection:text-white overflow-x-hidden">
            <div className="max-w-6xl mx-auto space-y-12">
                
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-8">
                    <div className="space-y-4">
                        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-[10px] font-black uppercase tracking-[0.2em]">
                            <ShieldCheck className="w-3.5 h-3.5" />
                            Verified On-Chain
                        </div>
                        <h1 className="text-4xl md:text-5xl font-black tracking-tighter">
                            Financial Statement
                        </h1>
                        <div className="flex flex-wrap items-center gap-6 text-gray-400 text-xs">
                            <div className="flex items-center gap-2">
                                <Globe className="w-3.5 h-3.5 text-primary" />
                                <span>Network: Arbitrum One</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <Clock className="w-3.5 h-3.5 text-primary" />
                                <span>Statement Date: {new Date(proofConfig.createdAt).toLocaleDateString()}</span>
                            </div>
                        </div>
                    </div>

                    <Card className="bg-zinc-950 border-zinc-800/50 p-6 flex flex-col items-start justify-center rounded-2xl md:min-w-[200px]">
                        <p className="text-[10px] uppercase font-bold text-gray-500 mb-2 tracking-widest">Verified Owner</p>
                        <p className="font-mono text-sm text-primary">
                            {proofConfig.walletAddress.slice(0, 8)}...{proofConfig.walletAddress.slice(-6)}
                        </p>
                    </Card>
                </div>

                {/* Main Table Container with horizontal scroll on mobile */}
                <Card className="bg-zinc-900/20 border-zinc-800/50 backdrop-blur-sm rounded-[2.5rem] overflow-hidden">
                    <div className="overflow-x-auto scrollbar-hide">
                        <table className="w-full text-left border-collapse min-w-[800px]">
                            <thead>
                                <tr className="border-b border-white/5 bg-white/[0.02]">
                                    <th className="px-8 py-6 text-[10px] uppercase font-black tracking-widest text-gray-500">Purpose</th>
                                    <th className="px-8 py-6 text-[10px] uppercase font-black tracking-widest text-gray-500">Amount</th>
                                    <th className="px-8 py-6 text-[10px] uppercase font-black tracking-widest text-gray-500">Start Date</th>
                                    <th className="px-8 py-6 text-[10px] uppercase font-black tracking-widest text-gray-500">Expiry Date</th>
                                    <th className="px-8 py-6 text-[10px] uppercase font-black tracking-widest text-gray-500">Status</th>
                                    <th className="px-8 py-6 text-[10px] uppercase font-black tracking-widest text-gray-500 text-right">Verification</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {vaultRecords.map((addr) => {
                                    const vaultReceipts = receipts.filter(r => r.vaultAddress === addr);
                                    const primaryReceipt = vaultReceipts[0];
                                    const withdrawalReceipt = vaultReceipts.find(r => r.type === 'completed' || r.type === 'breaked');
                                    const amounts = vaultReceipts.map(r => parseFloat(r.amount)).filter(a => !isNaN(a));
                                    const maxAmount = amounts.length > 0 ? Math.max(...amounts) : 0;
                                    const details = vaultDetails[addr] || {};
                                    const isWithdrawn = !!withdrawalReceipt;

                                    return (
                                        <tr key={addr} className="hover:bg-white/[0.02] transition-colors group">
                                            <td className="px-8 py-8 whitespace-nowrap">
                                                <div className="flex items-center gap-4">
                                                    <div className="w-10 h-10 rounded-xl bg-zinc-800/50 flex items-center justify-center text-zinc-500 group-hover:text-primary transition-all group-hover:bg-primary/10 border border-white/5 group-hover:border-primary/20">
                                                        <Lock className="w-4 h-4" />
                                                    </div>
                                                    <span className="font-bold text-white text-sm">
                                                        {primaryReceipt.purpose || "Savings Vault"}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-8 py-8 whitespace-nowrap">
                                                <div className="flex items-baseline gap-1.5">
                                                    <span className="text-lg font-black text-white">{maxAmount.toLocaleString()}</span>
                                                    <span className="text-[10px] font-black text-primary uppercase tracking-tighter">USDC</span>
                                                </div>
                                                <p className="text-[9px] text-gray-600 font-bold uppercase tracking-widest mt-1">On-Chain Asset</p>
                                            </td>
                                            <td className="px-8 py-8 whitespace-nowrap text-sm text-gray-400 font-medium">
                                                {new Date(primaryReceipt.timestamp).toLocaleDateString()}
                                            </td>
                                            <td className="px-8 py-8 whitespace-nowrap">
                                                {details.unlockTimestamp ? (
                                                    <div className="flex items-center gap-2 text-sm text-gray-400 font-medium">
                                                        <Calendar className="w-3.5 h-3.5 text-primary/50" />
                                                        {new Date(details.unlockTimestamp).toLocaleDateString()}
                                                    </div>
                                                ) : (
                                                    <span className="text-gray-600 text-[10px] font-black uppercase tracking-widest animate-pulse">Syncing...</span>
                                                )}
                                            </td>
                                            <td className="px-8 py-8 whitespace-nowrap">
                                                {isWithdrawn ? (
                                                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/5 text-blue-400 border border-blue-500/10 text-[10px] font-black uppercase tracking-[0.1em]">
                                                        <div className="w-1 h-1 rounded-full bg-blue-400" />
                                                        Withdrawn
                                                    </div>
                                                ) : (
                                                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/5 text-primary border border-primary/10 text-[10px] font-black uppercase tracking-[0.1em]">
                                                        <div className="w-1 h-1 rounded-full bg-primary" />
                                                        Active
                                                    </div>
                                                )}
                                            </td>
                                            <td className="px-8 py-8 whitespace-nowrap text-right">
                                                <Button 
                                                    size="sm" 
                                                    variant="ghost" 
                                                    className="h-10 px-5 gap-2 text-primary hover:bg-primary/10 hover:text-primary font-bold text-xs rounded-xl border border-transparent hover:border-primary/20 transition-all"
                                                    onClick={() => window.open(`https://sepolia.arbiscan.io/address/${CONTRACTS.arbitrumSepolia.VaultFactory}`, '_blank')}
                                                >
                                                    Explore Pool
                                                    <ExternalLink className="w-3.5 h-3.5" />
                                                </Button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </Card>

                {/* Footer Badges */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {[
                        { icon: ShieldCheck, title: "Immutable Proof", desc: "Data is cryptographically verified and pulled directly from Arbitrum." },
                        { icon: Globe, title: "Public Audit", desc: "Anyone can independently audit these records using explorer links." },
                        { icon: Clock, title: "Security Gated", desc: "Smart contracts ensure funds are time-locked and immutable." }
                    ].map((item, i) => (
                        <div key={i} className="p-8 rounded-[2rem] bg-zinc-900/40 border border-white/5 space-y-4 hover:border-primary/20 transition-colors group">
                            <item.icon className="w-8 h-8 text-primary group-hover:scale-110 transition-transform" />
                            <h4 className="font-bold text-white tracking-tight">{item.title}</h4>
                            <p className="text-xs text-gray-500 leading-relaxed font-medium">
                                {item.desc}
                            </p>
                        </div>
                    ))}
                </div>
            </div>
            
            <style jsx global>{`
                .scrollbar-hide::-webkit-scrollbar { display: none; }
                .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
            `}</style>
        </div>
    );
}
