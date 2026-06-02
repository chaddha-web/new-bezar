import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { executeLedgerCredit, processDifferentialMatching } from '@/lib/mlm';

export async function POST(request) {
  try {
    // 1. Verify cron authorization (API secret check)
    const authHeader = request.headers.get('authorization');
    if (!process.env.CRON_SECRET) {
      return NextResponse.json({ error: 'CRON_SECRET is missing on server. Halting.' }, { status: 500 });
    }
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Fetch all active MLM Nodes
    const activeNodesRes = await query(
      `SELECT node_id, investment_amount_usd, accelerator_mode, node_status 
       FROM mlm_nodes 
       WHERE node_status = 'ACTIVE'`
    );

    const results = [];

    for (const node of activeNodesRes.rows) {
      const userId = node.node_id;
      const investmentUsd = Number(node.investment_amount_usd);
      const isFastForward = node.accelerator_mode === 'FAST_FORWARD';

      // 3. Dynamic Fast Forward Auto-Upgrade Verification
      // Upgrade immediately if >= 3 direct frontline child nodes have >= investment than parent
      const upgradeRes = await query(
        `SELECT COUNT(*) FROM mlm_nodes 
         WHERE parent_id = $1 AND investment_amount_usd >= $2 AND node_status = 'ACTIVE'`,
        [userId, investmentUsd]
      );

      const activeReferrals = Number(upgradeRes.rows[0].count);
      let activeAccelerator = node.accelerator_mode;

      if (!isFastForward && activeReferrals >= 3) {
        await query(
          "UPDATE mlm_nodes SET accelerator_mode = 'FAST_FORWARD' WHERE node_id = $1",
          [userId]
        );
        activeAccelerator = 'FAST_FORWARD';
        console.log(`[MLM Auto Upgrade] Upgraded node ${userId} to FAST_FORWARD.`);
      }

      // 4. Retrieve Today's User Engagement/Telemetry Data
      const telemetryRes = await query(
        `SELECT audio_duration_seconds, video_completed 
         FROM daily_engagement 
         WHERE user_id = $1 AND date = CURRENT_DATE`,
        [userId]
      );

      let audioDuration = 0;
      let videoCompleted = false;

      if (telemetryRes.rows.length > 0) {
        audioDuration = Number(telemetryRes.rows[0].audio_duration_seconds);
        videoCompleted = telemetryRes.rows[0].video_completed;
      }

      // 5. Evaluate Yield Percentage Criteria (funnel yield constraints)
      let yieldPercentage = 0.0;

      if (activeAccelerator === 'FAST_FORWARD') {
        if (videoCompleted) {
          yieldPercentage = 0.010; // 1.0% Yield
        } else if (audioDuration >= 600) {
          yieldPercentage = 0.005; // 0.5% Yield (flat - no multiplier)
        } else {
          yieldPercentage = 0.005; // 0.5% Yield
        }
      } else {
        // STANDARD MODE
        if (videoCompleted) {
          yieldPercentage = 0.008; // 0.8% Yield
        } else if (audioDuration >= 600) {
          yieldPercentage = 0.005; // 0.5% Yield
        } else {
          yieldPercentage = 0.003; // 0.3% Yield
        }
      }

      const yieldPayoutUsd = investmentUsd * yieldPercentage;

      if (yieldPayoutUsd > 0) {
        // 6. Execute Personal Wallet Credit with capping loops (Dual-Currency)
        const creditRes = await executeLedgerCredit({
          nodeId: userId,
          amountUsd: yieldPayoutUsd,
          type: 'YIELD',
          description: `Daily passive behavior yield at ${(yieldPercentage * 100).toFixed(1)}%`
        });

        // 7. Calculate and distribute differential upline matching delta commissions
        if (creditRes.success) {
          await processDifferentialMatching(userId, yieldPayoutUsd);
          results.push({
            userId,
            investmentUsd,
            yieldPayoutUsd,
            percentage: yieldPercentage,
            status: 'PROCESSED'
          });
        } else {
          results.push({
            userId,
            status: 'SKIPPED',
            reason: creditRes.message
          });
        }
      }
    }

    return NextResponse.json({
      success: true,
      processedCount: results.length,
      metrics: results
    });

  } catch (error) {
    console.error('[Daily Cron Error] Failed executing daily yield sweep:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
