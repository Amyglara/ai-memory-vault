import { ethers } from 'hardhat';
import * as fs from 'fs';
import * as path from 'path';

async function main() {
  console.log('========================================');
  console.log('  TrustGate Escrow - Contract Deployment');
  console.log('========================================\n');

  // Get deployer info
  const [deployer] = await ethers.getSigners();
  const balance = await ethers.provider.getBalance(deployer.address);

  console.log(`Deployer: ${deployer.address}`);
  console.log(`Balance: ${ethers.formatEther(balance)} 0G\n`);

  if (balance === 0n) {
    console.error('ERROR: Deployer has no balance. Fund from https://faucet.0g.ai');
    process.exit(1);
  }

  // Get network info
  const network = await ethers.provider.getNetwork();
  console.log(`Network: Chain ID ${Number(network.chainId)}`);
  console.log(`RPC: ${network.name === 'homestead' ? '0G Testnet' : network.name}\n`);

  // Deploy TrustGateEscrow
  console.log('Deploying TrustGateEscrow...');
  const TrustGateEscrow = await ethers.getContractFactory('TrustGateEscrow');
  const escrow = await TrustGateEscrow.deploy();
  await escrow.waitForDeployment();

  const escrowAddress = await escrow.getAddress();
  console.log(`\n✅ TrustGateEscrow deployed at: ${escrowAddress}`);

  // Wait for a few blocks to ensure contract is indexed
  console.log('\nWaiting for block confirmations...');
  await escrow.deploymentTransaction()?.wait(3);

  // Generate deployment info
  const deploymentInfo = {
    network: Number(network.chainId) === 16602 ? 'galileo-testnet' : 'mainnet',
    chainId: Number(network.chainId),
    contractName: 'TrustGateEscrow',
    contractAddress: escrowAddress,
    deployer: deployer.address,
    deployerBalance: ethers.formatEther(balance),
    timestamp: new Date().toISOString(),
    txHash: escrow.deploymentTransaction()?.hash,
    explorer: {
      contract: `https://chainscan-galileo.0g.ai/address/${escrowAddress}`,
      tx: escrow.deploymentTransaction()?.hash
        ? `https://chainscan-galileo.0g.ai/tx/${escrow.deploymentTransaction()?.hash}`
        : '',
    },
    blockExplorer: Number(network.chainId) === 16602
      ? 'https://chainscan-galileo.0g.ai'
      : 'https://chainscan.0g.ai',
  };

  // Save deployment info to file
  const deployDir = path.resolve(__dirname, '../deployments');
  if (!fs.existsSync(deployDir)) {
    fs.mkdirSync(deployDir, { recursive: true });
  }

  const networkName = Number(network.chainId) === 16602 ? 'testnet' : 'mainnet';
  const deployFile = path.join(deployDir, `trustgate-${networkName}.json`);
  fs.writeFileSync(deployFile, JSON.stringify(deploymentInfo, null, 2));

  // Also update the latest symlink
  const latestFile = path.join(deployDir, 'trustgate-latest.json');
  fs.writeFileSync(latestFile, JSON.stringify(deploymentInfo, null, 2));

  console.log('\n========================================');
  console.log('  Deployment Summary');
  console.log('========================================');
  console.log(`Contract:    TrustGateEscrow`);
  console.log(`Address:     ${escrowAddress}`);
  console.log(`Deployer:    ${deployer.address}`);
  console.log(`Network:     ${networkName} (Chain ${Number(network.chainId)})`);
  console.log(`Explorer:    ${deploymentInfo.explorer.contract}`);
  console.log(`\nDeployment saved to: ${deployFile}`);
  console.log('\nVerify contract with:');
  console.log(`  npx hardhat verify --network 0g-${networkName} ${escrowAddress}`);
}

main().catch((error) => {
  console.error('Deployment failed:', error);
  process.exitCode = 1;
});
