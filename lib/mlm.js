import { query } from './db';

// Fixed conversion rate: 1 USD = 94 INR
const USD_TO_INR = 94.00;

/**
 * 1. Dual-Currency Capping Interceptor (on_ledger_credit)
 * Logs transaction to ledger and updates user node balances with strict 2.5x ceiling.
 */
export async function executeLedgerCredit({ nodeId, amountUsd, type, referenceNodeId = null, description = '' }) {
  if (amountUsd <= 0) return { success: false, message: 'Invalid credit amount' };

  const creditUsd = Number(amountUsd);
  const creditInr = creditUsd * USD_TO_INR; // Fixed system conversion

  try {
    await query('BEGIN');

    // Retrieve active MLM node credentials
    const nodeRes = await query(
      `SELECT investment_amount_usd, accumulated_earnings_usd, wallet_balance_usd, wallet_balance_inr, node_status 
       FROM mlm_nodes WHERE node_id = $1 FOR UPDATE`,
      [nodeId]
    );

    if (nodeRes.rows.length === 0) {
      await query('ROLLBACK');
      return { success: false, message: 'MLM Node not found' };
    }

    const node = nodeRes.rows[0];
    const maxCapUsd = Number(node.investment_amount_usd) * 2.5;
    const currentAccumulatedUsd = Number(node.accumulated_earnings_usd);
    
    const walletUsd = Number(node.wallet_balance_usd);
    const walletInr = Number(node.wallet_balance_inr);

    if (node.node_status === 'EXPIRED' || currentAccumulatedUsd >= maxCapUsd) {
      await query('ROLLBACK');
      return { success: false, message: 'REJECT: Node is EXPIRED. Direct volume to spill over.' };
    }

    let finalCreditUsd = creditUsd;
    let expired = false;

    // Check if pending credit exceeds the 2.5x multiplier cap
    if (currentAccumulatedUsd + finalCreditUsd >= maxCapUsd) {
      finalCreditUsd = maxCapUsd - currentAccumulatedUsd;
      expired = true;
    }

    const finalCreditInr = finalCreditUsd * USD_TO_INR;

    // Update Node Balances (Synchronous Dual-Currency Writes)
    const newAccumulatedUsd = currentAccumulatedUsd + finalCreditUsd;
    const newAccumulatedInr = newAccumulatedUsd * USD_TO_INR;
    
    const newWalletUsd = walletUsd + finalCreditUsd;
    const newWalletInr = walletInr + finalCreditInr;
    
    const newStatus = expired ? 'EXPIRED' : 'ACTIVE';

    await query(
      `UPDATE mlm_nodes 
       SET accumulated_earnings_usd = $1, accumulated_earnings_inr = $2, 
           wallet_balance_usd = $3, wallet_balance_inr = $4, 
           node_status = $5 
       WHERE node_id = $6`,
      [newAccumulatedUsd, newAccumulatedInr, newWalletUsd, newWalletInr, newStatus, nodeId]
    );

    // Record Entry in Ledger
    await query(
      `INSERT INTO wallet_ledger (node_id, amount_usd, amount_inr, transaction_type, reference_node_id, description)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [nodeId, finalCreditUsd, finalCreditInr, type, referenceNodeId, description]
    );

    await query('COMMIT');
    return { success: true, creditedUsd: finalCreditUsd, creditedInr: finalCreditInr, expired };
  } catch (error) {
    await query('ROLLBACK');
    console.error('[MLM Ledger Error] Transaction aborted:', error);
    throw error;
  }
}

/**
 * 2. Dynamic 50:30:20 Qualifying Volume & Rank Resolver
 * Computes QV in USD dynamically by sorting downwards legs.
 */
export async function getQualifyingVolume(nodeId, targetGvUsd) {
  // Fetch direct sponsored child nodes
  const childrenRes = await query(
    'SELECT node_id FROM mlm_nodes WHERE parent_id = $1',
    [nodeId]
  );

  const legs = [];

  for (const child of childrenRes.rows) {
    // Compute total accumulated downward group volume recursively in USD
    const gvUsd = await getGroupVolumeUsd(child.node_id);
    legs.push(gvUsd);
  }

  // Sort descending to isolate strong, second, and supplementary branches
  legs.sort((a, b) => b - a);

  const lStrong = legs[0] || 0;
  const lSecond = legs[1] || 0;
  
  // Aggregate all other remaining legs into V_supp
  const vSupp = legs.slice(2).reduce((sum, val) => sum + val, 0);

  // 50:30:20 Cap Filter
  const qvUsd = Math.min(lStrong, targetGvUsd * 0.50) + 
                Math.min(lSecond, targetGvUsd * 0.30) + 
                vSupp;

  return qvUsd;
}

// Recursive helper to get entire Group Volume for a sublineage node in USD
export async function getGroupVolumeUsd(nodeId) {
  const nodeRes = await query('SELECT investment_amount_usd FROM mlm_nodes WHERE node_id = $1', [nodeId]);
  if (nodeRes.rows.length === 0) return 0;

  const currentInvestment = Number(nodeRes.rows[0].investment_amount_usd);

  const childrenRes = await query('SELECT node_id FROM mlm_nodes WHERE parent_id = $1', [nodeId]);
  let childSum = 0;
  for (const child of childrenRes.rows) {
    childSum += await getGroupVolumeUsd(child.node_id);
  }

  return currentInvestment + childSum;
}

/**
 * Resolves current dynamic rank based on Group Volume (USD) calculations.
 */
export async function resolveRank(nodeId) {
  const totalGvUsd = await getGroupVolumeUsd(nodeId);

  // Rank Targets (Dual-Currency Mapping, Resolved via USD targets)
  const ranks = [
    { rank: 'R7', targetUsd: 500000, match: 0.25 },
    { rank: 'R6', targetUsd: 150000, match: 0.20 },
    { rank: 'R5', targetUsd: 40000,  match: 0.16 },
    { rank: 'R4', targetUsd: 10000,  match: 0.12 },
    { rank: 'R3', targetUsd: 3000,   match: 0.08 },
    { rank: 'R2', targetUsd: 1000,   match: 0.05 },
    { rank: 'R1', targetUsd: 100,    match: 0.00 },
  ];

  for (const r of ranks) {
    if (totalGvUsd >= r.targetUsd) {
      const qvUsd = await getQualifyingVolume(nodeId, r.targetUsd);
      
      if (r.rank === 'R1') {
        return r;
      }
      
      // Check if QV meets or exceeds target
      if (qvUsd >= r.targetUsd) {
        return r;
      }
    }
  }

  return { rank: 'R1', targetUsd: 100, match: 0.00 };
}

/**
 * 3. Upward Differential Payout Algorithm
 * Recursively climbs the upline tree distributing differential matching percentages.
 */
export async function processDifferentialMatching(downstreamUserId, dailyYieldUsd) {
  let currentUplineRes = await query('SELECT parent_id FROM mlm_nodes WHERE node_id = $1', [downstreamUserId]);
  if (currentUplineRes.rows.length === 0 || !currentUplineRes.rows[0].parent_id) return;

  let currentParentId = currentUplineRes.rows[0].parent_id;
  let maxPayoutPercentage = 0.0;

  while (currentParentId) {
    const parentRank = await resolveRank(currentParentId);
    const parentMatch = parentRank.match;

    if (parentMatch > maxPayoutPercentage) {
      const payoutDelta = parentMatch - maxPayoutPercentage;
      const commissionValueUsd = Number(dailyYieldUsd) * payoutDelta;

      await executeLedgerCredit({
        nodeId: currentParentId,
        amountUsd: commissionValueUsd,
        type: 'MATCHING_COMMISSION',
        referenceNodeId: downstreamUserId,
        description: `Differential match commission at rank ${parentRank.rank} (${payoutDelta * 100}% delta)`
      });

      maxPayoutPercentage = parentMatch;
    } else if (parentMatch === 0.25 && maxPayoutPercentage === 0.25) {
      // Peer Match Override Triggered (1.5% Mogul Generation Match override)
      const commissionValueUsd = Number(dailyYieldUsd) * 0.015;
      await executeLedgerCredit({
        nodeId: currentParentId,
        amountUsd: commissionValueUsd,
        type: 'PEER_MATCH_OVERRIDE',
        referenceNodeId: downstreamUserId,
        description: 'Mogul Peer Match Override Commission (1.5% flat match)'
      });
    }

    // Stop traversing if delta is maxed out
    if (maxPayoutPercentage >= 0.25) break;

    // Move upward
    const nextParentRes = await query('SELECT parent_id FROM mlm_nodes WHERE node_id = $1', [currentParentId]);
    currentParentId = nextParentRes.rows.length > 0 ? nextParentRes.rows[0].parent_id : null;
  }
}
