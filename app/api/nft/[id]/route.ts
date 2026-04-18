import { NextRequest, NextResponse } from "next/server";
import { createPublicClient, http, formatUnits } from "viem";
import { arbitrumSepolia } from "viem/chains";
import { CONTRACTS } from "@/lib/contracts";

const publicClient = createPublicClient({
    chain: arbitrumSepolia,
    transport: http(),
});

const VAULT_ABI = [
    { name: "purpose", type: "function", inputs: [], outputs: [{ type: "string" }] },
    { name: "totalAssets", type: "function", inputs: [], outputs: [{ type: "uint256" }] },
    { name: "unlockTimestamp", type: "function", inputs: [], outputs: [{ type: "uint256" }] },
    { name: "vaultId", type: "function", inputs: [], outputs: [{ type: "uint256" }] },
] as const;

const FACTORY_ABI = [
    { name: "vaultById", type: "function", inputs: [{ type: "uint256" }], outputs: [{ type: "address" }] },
] as const;

export async function GET(
    req: NextRequest,
    { params }: { params: { id: string } }
) {
    const tokenId = params.id;

    try {
        // 1. Get Vault Address from Factory
        const vaultAddress = await publicClient.readContract({
            address: CONTRACTS.arbitrumSepolia.VaultFactory,
            abi: FACTORY_ABI,
            functionName: "vaultById",
            args: [BigInt(tokenId)],
        });

        if (!vaultAddress || vaultAddress === "0x0000000000000000000000000000000000000000") {
            return NextResponse.json({ error: "Vault not found" }, { status: 404 });
        }

        // 2. Fetch Vault State
        const [purpose, balance] = await Promise.all([
            publicClient.readContract({
                address: vaultAddress as `0x${string}`,
                abi: VAULT_ABI,
                functionName: "purpose",
            }),
            publicClient.readContract({
                address: vaultAddress as `0x${string}`,
                abi: VAULT_ABI,
                functionName: "totalAssets",
            }),
        ]);

        const formattedBalance = parseFloat(formatUnits(balance as bigint, 6)).toFixed(2);

        // 3. Generate a beautiful dynamic SVG
        const svg = `
            <svg width="500" height="500" viewBox="0 0 500 500" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect width="500" height="500" rx="30" fill="#0D0D0D"/>
                <rect x="25" y="25" width="450" height="450" rx="20" stroke="url(#paint0_linear)" stroke-width="2"/>
                
                <text x="50%" y="100" dominant-baseline="middle" text-anchor="middle" fill="white" font-family="Arial" font-size="24" font-weight="bold">SAVIQUE VAULT #${tokenId}</text>
                
                <text x="50%" y="220" dominant-baseline="middle" text-anchor="middle" fill="#FF1E56" font-family="Arial" font-size="40" font-weight="black">${purpose.toUpperCase()}</text>
                
                <rect x="100" y="280" width="300" height="80" rx="15" fill="#1A1A1A"/>
                <text x="50%" y="315" dominant-baseline="middle" text-anchor="middle" fill="#888" font-family="Arial" font-size="14">CURRENT BALANCE</text>
                <text x="50%" y="340" dominant-baseline="middle" text-anchor="middle" fill="white" font-family="Arial" font-size="28" font-weight="bold">${formattedBalance} USDC</text>
                
                <text x="50%" y="450" dominant-baseline="middle" text-anchor="middle" fill="#444" font-family="Arial" font-size="12">ARBITRUM SEPOLIA | SAVIQUE PROTOCOL V3</text>
                
                <defs>
                    <linearGradient id="paint0_linear" x1="0" y1="0" x2="500" y2="500" gradientUnits="userSpaceOnUse">
                        <stop stop-color="#FF1E56"/>
                        <stop offset="1" stop-color="#8000FF"/>
                    </linearGradient>
                </defs>
            </svg>
        `.trim();

        const base64Svg = Buffer.from(svg).toString("base64");
        const imageUri = `data:image/svg+xml;base64,${base64Svg}`;

        // 4. Return Metadata
        return NextResponse.json({
            name: `Savique Vault #${tokenId}: ${purpose}`,
            description: `This NFT represents a secure savings vault on the Savique Protocol. Purpose: ${purpose}. The holder of this NFT owns the assets inside the vault.`,
            image: imageUri,
            attributes: [
                { trait_type: "Purpose", value: purpose },
                { trait_type: "Balance", value: `${formattedBalance} USDC` },
                { trait_type: "Vault ID", value: tokenId },
            ],
        });
    } catch (error) {
        console.error("NFT Metadata error:", error);
        return NextResponse.json({ error: "Failed to fetch metadata" }, { status: 500 });
    }
}
