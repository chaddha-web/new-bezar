import { query } from './db';
import Web3 from 'web3';

// Official BEP-20 Contract Addresses
export const BEP20_CONTRACTS = {
  USDT: '0x55d398326f99059ff775485246999027b3197955',
  USDC: '0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d'
};

// Standard BEP-20 ABI for transfers
const BEP20_ABI = [
  {
    "constant": false,
    "inputs": [
      { "name": "_to", "type": "address" },
      { "name": "_value", "type": "uint256" }
    ],
    "name": "transfer",
    "outputs": [{ "name": "", "type": "bool" }],
    "type": "function"
  }
];

export function generateBscDepotAddress(userId) {
  const cleanId = userId.replace(/-/g, '');
  const addressPart = cleanId.substring(0, 40);
  return `0x${addressPart.toLowerCase()}`;
}

/**
 * Real Web3 implementation to verify BEP-20 token deposit on BSC.
 */
export async function verifyBep20TokenDeposit(txHash, userDepotAddress, tokenSymbol = 'USDT') {
  try {
    const bscRpcEndpoint = process.env.BSC_RPC_URL || 'https://bsc-dataseed.binance.org/';
    const web3 = new Web3(new Web3.providers.HttpProvider(bscRpcEndpoint));
    const contractAddress = BEP20_CONTRACTS[tokenSymbol.toUpperCase()].toLowerCase();

    const tx = await web3.eth.getTransaction(txHash);
    const receipt = await web3.eth.getTransactionReceipt(txHash);

    if (!tx || !receipt) {
      return { verified: false, error: 'Transaction not found on network' };
    }
    
    if (!receipt.status) {
      return { verified: false, error: 'Transaction failed or reverted' };
    }

    if (tx.to.toLowerCase() !== contractAddress) {
      return { verified: false, error: 'Transaction was not sent to the correct token contract' };
    }

    // Method ID for transfer(address,uint256) is 0xa9059cbb
    const input = tx.input;
    if (!input.startsWith('0xa9059cbb')) {
      return { verified: false, error: 'Transaction is not a standard transfer' };
    }

    // Extract 'to' address (remove padding)
    const toAddressRaw = input.substring(10, 74);
    const toAddress = '0x' + toAddressRaw.substring(24).toLowerCase();
    
    if (toAddress !== userDepotAddress.toLowerCase()) {
      return { verified: false, error: 'Funds were not sent to the correct deposit address' };
    }

    // Extract value (assuming 18 decimals)
    const valueRaw = input.substring(74, 138);
    const valueWei = web3.utils.toBigInt('0x' + valueRaw);
    
    // Stablecoins on BSC are 18 decimals
    const valueStablecoins = Number(valueWei) / 1e18;

    return {
      verified: true,
      value: valueStablecoins,
      sender: tx.from,
      tokenSymbol,
      bscTxHash: txHash
    };
  } catch (error) {
    console.error('[Web3 Observer Error] Failed to verify BSC logs:', error);
    return { verified: false, error: error.message };
  }
}

/**
 * Real Web3 implementation to broadcast automated BEP-20 payouts using Hot Wallet.
 */
export async function executeBep20TokenPayout(payoutAddress, amountStablecoins, tokenSymbol = 'USDT') {
  try {
    const bscRpcEndpoint = process.env.BSC_RPC_URL || 'https://bsc-dataseed.binance.org/';
    const web3 = new Web3(new Web3.providers.HttpProvider(bscRpcEndpoint));
    const contractAddress = BEP20_CONTRACTS[tokenSymbol.toUpperCase()];

    // Fetch Private Key from Settings
    const pkRes = await query(`SELECT value FROM system_settings WHERE key = 'HOT_WALLET_PRIVATE_KEY'`);
    if (pkRes.rows.length === 0 || !pkRes.rows[0].value) {
      throw new Error('Hot Wallet Private Key is not configured in Admin Settings.');
    }
    const privateKey = pkRes.rows[0].value;
    const account = web3.eth.accounts.privateKeyToAccount(privateKey);
    web3.eth.accounts.wallet.add(account);

    const contract = new web3.eth.Contract(BEP20_ABI, contractAddress);
    
    // Stablecoins on BSC are 18 decimals
    const amountWei = web3.utils.toWei(amountStablecoins.toString(), 'ether');

    console.log(`[Web3 Payout] Signing BEP-20 transaction from ${account.address} to disburse ${amountStablecoins} ${tokenSymbol} to ${payoutAddress}`);

    const txObject = {
      from: account.address,
      to: contractAddress,
      data: contract.methods.transfer(payoutAddress, amountWei).encodeABI(),
      gas: 100000,
    };

    const signedTx = await web3.eth.accounts.signTransaction(txObject, privateKey);
    
    // We send signed transaction and resolve when receipt is generated
    const receipt = await web3.eth.sendSignedTransaction(signedTx.rawTransaction);

    console.log(`[Web3 Disbursed] Broadcasted transfer. TxHash: ${receipt.transactionHash}`);

    return {
      success: true,
      txHash: receipt.transactionHash,
      symbol: tokenSymbol
    };
  } catch (error) {
    console.error('[Web3 Payout Error]', error);
    throw error;
  }
}
