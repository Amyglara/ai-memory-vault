const { ethers } = require('ethers');
const { Blob: ZgBlob, FixedPriceFlow__factory, getMarketContract, calculatePrice } = require('@0glabs/0g-ts-sdk');

(async () => {
  const MAIN_PK = '0x0a3e2088ccaef58416561d94bf30e3571d79be0cee61592f8197c5870e466e70';
  const provider = new ethers.JsonRpcProvider('https://evmrpc-testnet.0g.ai');
  const wallet = new ethers.Wallet(MAIN_PK, provider);

  const content = 'TrustGate test';
  const file = new File([Buffer.from(content)], 'test.txt', { type: 'text/plain' });
  const blob = new ZgBlob(file);

  const [tree, treeErr] = await blob.merkleTree();
  if (treeErr || !tree) throw new Error('Merkle failed');
  const rootHash = tree.rootHash();

  const [submission, subErr] = await blob.createSubmission('0x');
  if (subErr || !submission) throw new Error('Submission failed');

  const flowAddr = '0x22E03a6A89B950F1c82ec5e74F8eCa321a105296';
  const flow = FixedPriceFlow__factory.connect(flowAddr, wallet);
  const marketAddr = await flow.market();
  const market = getMarketContract(marketAddr, provider);
  const pricePerSector = await market.pricePerSector();
  const fee = calculatePrice(submission, pricePerSector);

  // Use populateTransaction to get the raw tx data
  const txData = await flow.submit.populateTransaction(submission, { value: fee });
  console.log('TX data (first 100 chars):', txData.data?.slice(0, 100));
  console.log('TX value:', txData.value?.toString());

  // Try sending with gas limit override
  console.log('Sending with gasLimit override...');
  try {
    const tx = await wallet.sendTransaction({
      to: flowAddr,
      data: txData.data,
      value: txData.value,
      gasLimit: 500000,
    });
    console.log('TX sent:', tx.hash);
    const receipt = await tx.wait();
    console.log('TX confirmed! Block:', receipt.blockNumber, 'Status:', receipt.status);
    console.log('Final balance:', ethers.formatEther(await provider.getBalance(wallet.address)), 'OG');
  } catch(e) {
    console.error('Send failed:', e.message.slice(0, 300));
    
    // Check if the receipt exists
    if (e.receipt) {
      console.log('Receipt status:', e.receipt.status);
    }
  }
})().catch(e => { console.error('UNCAUGHT:', e.message); process.exit(1); });
