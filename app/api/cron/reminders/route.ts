import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { collection, getDocs } from 'firebase/firestore';
import { sendNotificationEmail, EmailType } from '@/lib/emailService';
import { getUserProfile } from '@/lib/userService';
import { createPublicClient, http } from 'viem';
import { arbitrumSepolia } from 'viem/chains';
import { PRIVATE_SAVINGS_POOL_ABI, CONTRACTS } from '@/lib/contracts';
import { getUserVaultsFromDb } from '@/lib/receiptService';

// Secret key to protect the cron endpoint (set in Vercel env vars)
const CRON_SECRET = process.env.CRON_SECRET;

// Create public client for reading blockchain data
const publicClient = createPublicClient({
    chain: arbitrumSepolia,
    transport: http()
});

/**
 * Daily Cron Job for Sending Reminders
 * 
 * Schedule: Run daily at 9:00 AM WAT (8:00 AM UTC)
 * Vercel Cron: "0 8 * * *"
 * 
 * Sends:
 * 1. MATURITY_COUNTDOWN - 7, 3, 1 days before unlock
 * 2. GOAL_REMINDER - Every Monday for active savings with 7+ days remaining
 */
export async function GET(req: NextRequest) {
    try {
        // Verify cron secret (for security in production)
        const authHeader = req.headers.get('authorization');
        if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
            console.warn('[CronReminders] Unauthorized access attempt');
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const now = Date.now();
        const today = new Date();
        const dayOfWeek = today.getDay(); // 0 = Sunday, 1 = Monday, etc.

        // Track sent emails
        const stats = {
            usersChecked: 0,
            vaultsChecked: 0,
            maturityCountdown: 0,
            goalReminder: 0,
            errors: 0
        };

        console.log('[CronReminders] Starting daily reminder check at', today.toISOString());

        // Get all user profiles with vaults
        const profilesRef = collection(db, 'userProfiles');
        const profilesSnapshot = await getDocs(profilesRef);

        // Process each user
        for (const profileDoc of profilesSnapshot.docs) {
            try {
                const profile = profileDoc.data();
                const walletAddress = profileDoc.id;

                // Skip users without email or those who opted out
                if (!profile.email || !profile.notificationPreferences?.maturityWarnings) {
                    continue;
                }

                stats.usersChecked++;

                // Get user's vaults from factory contract
                let vaults: string[] = [];
                try {
                    const count = await publicClient.readContract({
                        address: CONTRACTS.arbitrumSepolia.VaultFactory,
                        abi: PRIVATE_SAVINGS_POOL_ABI,
                        functionName: 'userVaultCount',
                        args: [walletAddress as `0x${string}`]
                    });
                    
                    for(let i = 0; i < Number(count); i++) {
                        vaults.push(i.toString());
                    }
                } catch (e) {
                    console.warn(`[CronReminders] Failed to get vaults for ${walletAddress.slice(0, 10)}:`, e);
                    continue;
                }

                if (!vaults || vaults.length === 0) {
                    continue;
                }

                // Check each vault
                for (const vaultId of vaults) {
                    try {
                        stats.vaultsChecked++;

                        // Get vault data from blockchain
                        const vaultDetails = await publicClient.readContract({
                            address: CONTRACTS.arbitrumSepolia.VaultFactory,
                            abi: PRIVATE_SAVINGS_POOL_ABI,
                            functionName: 'getVaultDetails',
                            args: [walletAddress as `0x${string}`, BigInt(vaultId)]
                        });

                        const unlockTimestamp = Number(vaultDetails[0]) * 1000;
                        const purpose = vaultDetails[2];
                        const isActive = vaultDetails[3];

                        // Skip if already unlocked or inactive
                        if (unlockTimestamp <= now || !isActive) {
                            continue;
                        }

                        // Calculate days remaining
                        const daysRemaining = Math.ceil((unlockTimestamp - now) / (24 * 60 * 60 * 1000));
                        const unlockDateStr = new Date(unlockTimestamp).toLocaleDateString('en-US', {
                            weekday: 'long',
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric'
                        });

                        // Send MATURITY_COUNTDOWN for 7, 3, 1 days remaining
                        if ([7, 3, 1].includes(daysRemaining)) {
                            await sendNotificationEmail('MATURITY_COUNTDOWN', {
                                userEmail: profile.email,
                                purpose: purpose as string || 'Your Savings',
                                amount: "Private", // FHE hides balance without permit
                                unlockDate: unlockDateStr,
                                daysRemaining: daysRemaining
                            });
                            stats.maturityCountdown++;
                            console.log(`[CronReminders] Sent MATURITY_COUNTDOWN: ${profile.email} - ${daysRemaining} days left for "${purpose}"`);
                        }

                        // Send GOAL_REMINDER every Monday for savings with 7+ days remaining  
                        if (dayOfWeek === 1 && daysRemaining > 7) {
                            await sendNotificationEmail('GOAL_REMINDER', {
                                userEmail: profile.email,
                                purpose: purpose as string || 'Your Savings',
                                currentBalance: "Private",
                                amount: "Private",
                                unlockDate: unlockDateStr,
                                daysRemaining: daysRemaining
                            });
                            stats.goalReminder++;
                            console.log(`[CronReminders] Sent GOAL_REMINDER: ${profile.email} for "${purpose}"`);
                        }

                        // Small delay to avoid rate limiting
                        await new Promise(resolve => setTimeout(resolve, 100));

                    } catch (vaultError) {
                        console.warn(`[CronReminders] Error processing vault ${vaultId}:`, vaultError);
                        stats.errors++;
                    }
                }

            } catch (userError) {
                console.error(`[CronReminders] Error processing user:`, userError);
                stats.errors++;
            }
        }

        console.log('[CronReminders] Completed:', stats);

        return NextResponse.json({
            success: true,
            timestamp: new Date().toISOString(),
            stats
        });

    } catch (error: any) {
        console.error('[CronReminders] Fatal error:', error);
        return NextResponse.json({
            success: false,
            error: error.message
        }, { status: 500 });
    }
}

// POST for manual testing
export async function POST(req: NextRequest) {
    return GET(req);
}
