import { query } from './db';

/**
 * 1. Synchronous Capping Validation Interceptor (on_ledger_credit)
 * Logs transaction to ledger and updates user node balances with strict 2.5x ceiling.
 */
export async function executeLedgerCredit({ nodeId, amount, type, referenceNodeId = null, description = '' }) {
  if (amount <= 0) return { success: false, message: 'Invalid credit amount' };

  try {
    // Begin database transaction for safe atomic updates
    await query('BEGIN');

    // Retrieve active MLM node credentials
    const nodeRes = await query(
      'SELECT investment_amount_inr, accumulated_earnings_inr, wallet_balance_inr, node_status FROM mlm_nodes WHERE node_id = $1 FOR UPDATE',
      [nodeId]
    );

    if (nodeRes.rows.length === 0) {
      await query('ROLLBACK');
      return { success: false, message: 'MLM Node not found' };
    }

    const node = nodeRes.rows[0];
    const maxCap = Number(node.investment_amount_inr) * 2.5;
    const currentAccumulated = Number(node.accumulated_earnings_inr);
    const currentWallet = Number(node.wallet_balance_inr);

    if (node.node_status === 'EXPIRED' || currentAccumulated >= maxCap) {
      await query('ROLLBACK');
      return { success: false, message: 'REJECT: Node is EXPIRED. Direct volume to spill over.' };
    }

    let finalCredit = Number(amount);
    let expired = false;

    // Check if pending credit exceeds the 2.5x multiplier cap
    if (currentAccumulated + finalCredit >= maxCap) {
      finalCredit = maxCap - currentAccumulated;
      expired = true;
    }

    // Update Node Balances
    const newAccumulated = currentAccumulated + finalCredit;
    const newWallet = currentWallet + finalCredit;
    const newStatus = expired ? 'EXPIRED' : 'ACTIVE';

    await query(
      `UPDATE mlm_nodes 
       SET accumulated_earnings_inr = $1, wallet_balance_inr = $2, node_status = $3 
       WHERE node_id = $4`,
      [newAccumulated, newWallet, newStatus, nodeId]
    );

    // Record Entry in Ledger
    await query(
      `INSERT INTO wallet_ledger (node_id, amount, transaction_type, reference_node_id, description)
       VALUES ($1, $2, $3, $4, $5)`,
      [nodeId, finalCredit, type, referenceNodeId, description]
    );

    await query('COMMIT');
    return { success: true, credited: finalCredit, expired };
  } catch (error) {
    await query('ROLLBACK');
    console.error('[MLM Ledger Error] Transaction aborted:', error);
    throw error;
  }
}

/**
 * 2. Dynamic 50:30:20 Qualifying Volume & Rank Resolver
 * Computes QV dynamically by sorting downwards legs.
 */
export async function getQualifyingVolume(nodeId, targetGV) {
  // 1. Fetch direct sponsored child nodes
  const childrenRes = await query(
    'SELECT node_id, investment_amount_inr FROM mlm_nodes WHERE parent_id = $1',
    [nodeId]
  );

  const legs = [];

  for (const child of childrenRes.rows) {
    // Compute total accumulated downward group volume recursively
    const gv = await getGroupVolume(child.node_id);
    legs.push(gv);
  }

  // Sort descending to isolate strong, second, and supplementary branches
  legs.sort((a, b) => b - a);

  const lStrong = legs[0] || 0;
  const lSecond = legs[1] || 0;
  
  // Aggregate all other remaining legs into V_supp
  const vSupp = legs.slice(2).reduce((sum, val) => sum + val, 0);

  // 50:30:20 Cap Filter
  const qv = Math.min(lStrong, targetGV * 0.50) + 
             Math.min(lSecond, targetGV * 0.30) + 
             vSupp;

  return qv;
}

// Recursive helper to get entire Group Volume for a sublineage node
export async function getGroupVolume(nodeId) {
  const nodeRes = await query('SELECT investment_amount_inr FROM mlm_nodes WHERE node_id = $1', [nodeId]);
  if (nodeRes.rows.length === 0) return 0;

  const currentInvestment = Number(nodeRes.rows[0].investment_amount_inr);

  const childrenRes = await query('SELECT node_id FROM mlm_nodes WHERE parent_id = $1', [nodeId]);
  let childSum = 0;
  for (const child of childrenRes.rows) {
    childSum += await getGroupVolume(child.node_id);
  }

  return currentInvestment + childSum;
}

/**
 * Resolves current dynamic rank based on Group Volume calculations.
 */
export async function resolveRank(nodeId) {
  const totalGV = await getGroupVolume(nodeId);

  // Rank Targets
  const ranks = [
    { rank: 'R7', target: 47000000, match: 0.25 },
    { rank: 'R6', target: 14100000, match: 0.20 },
    { rank: 'R5', target: 3760000,  match: 0.16 },
    { rank: 'R4', target: 940000,   match: 0.12 },
    { rank: 'R3', target: 282000,   match: 0.08 },
    { rank: 'R2', target: 94000,    match: 0.05 },
    { rank: 'R1', target: 9400,     match: 0.00 },
  ];

  for (const r of ranks) {
    if (totalGV >= r.target) {
      const qv = await getQualifyingVolume(nodeId, r.target);
      // Check 50:30:20 distribution targets for R2 and above
      if (r.rank === 'R1') {
        return r;
      }
      
      const strongTarget = r.target * 0.50;
      const secondTarget = r.target * 0.30;
      const suppTarget = r.target * 0.20;

      // Check if QV meets or exceeds target
      if (qv >= r.target) {
        return r;
      }
    }
  }

  return { rank: 'R1', target: 9400, match: 0.00 };
}

/**
 * 3. Upward Differential Payout Algorithm
 * Recursively climbs the upline tree distributing differential matching percentages.
 */
export async function processDifferentialMatching(downstreamUserId, dailyYield) {
  let currentUplineRes = await query('SELECT parent_id FROM mlm_nodes WHERE node_id = $1', [downstreamUserId]);
  if (currentUplineRes.rows.length === 0 || !currentUplineRes.rows[0].parent_id) return;

  let currentParentId = currentUplineRes.rows[0].parent_id;
  let maxPayoutPercentage = 0.0;

  while (currentParentId) {
    const parentRank = await resolveRank(currentParentId);
    const parentMatch = parentRank.match;

    if (parentMatch > maxPayoutPercentage) {
      const payoutDelta = parentMatch - maxPayoutPercentage;
      const commissionValue = Number(dailyYield) * payoutDelta;

      await executeLedgerCredit({
        nodeId: currentParentId,
        amount: commissionValue,
        type: 'MATCHING_COMMISSION',
        referenceNodeId: downstreamUserId,
        description: `Differential match commission at rank ${parentRank.rank} (${payoutDelta * 100}% delta)`
      });

      maxPayoutPercentage = parentMatch;
    } else if (parentMatch === 0.25 && maxPayoutPercentage === 0.25) {
      // Peer Match Override Triggered (1.5% override match)
      const commissionValue = Number(dailyYield) * 0.015;
      await executeLedgerCredit({
        nodeId: currentParentId,
        amount: commissionValue,
        type: 'PEER_MATCH_OVERRIDE',
        referenceNodeId: downstreamUserId,
        description: 'Mogul Peer Match Override Commission (1.5% flat)'
      });
    }

    // Stop traversing if delta is maxed out
    if (maxPayoutPercentage >= 0.25) break;

    // Move upward
    const nextParentRes = await query('SELECT parent_id FROM mlm_nodes WHERE node_id = $1', [currentParentId]);
    currentParentId = nextParentRes.rows.length > 0 ? nextParentRes.rows[0].parent_id : null;
  }
}
