import { ethers } from 'hardhat';
import * as fs from 'fs';
import * as path from 'path';

async function main() {
  console.log('========================================');
  console.log('  AI Memory Vault - Contract Deployment');
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

  // Deploy MemoryVault
  console.log('Deploying MemoryVault...');
  const MemoryVault = await ethers.getContractFactory('MemoryVault');
  const vault = await MemoryVault.deploy();
  await vault.waitForDeployment();

  const vaultAddress = await vault.getAddress();
  console.log(`\n✅ MemoryVault deployed at: ${vaultAddress}`);

  // Wait for a few blocks to ensure contract is indexed
  console.log('\nWaiting for block confirmations...');
  await vault.deploymentTransaction()?.wait(3);

  // Generate deployment info
  const deploymentInfo = {
    network: Number(network.chainId) === 16602 ? 'galileo-testnet' : 'mainnet',
    chainId: Number(network.chainId),
    contractName: 'MemoryVault',
    contractAddress: vaultAddress,
    deployer: deployer.address,
    deployerBalance: ethers.formatEther(balance),
    timestamp: new Date().toISOString(),
    txHash: vault.deploymentTransaction()?.hash,
    explorer: {
      contract: `https://chainscan-galileo.0g.ai/address/${vaultAddress}`,
      tx: vault.deploymentTransaction()?.hash
        ? `https://chainscan-galileo.0g.ai/tx/${vault.deploymentTransaction()?.hash}`
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
  const deployFile = path.join(deployDir, `${networkName}.json`);
  fs.writeFileSync(deployFile, JSON.stringify(deploymentInfo, null, 2));

  // Also update the latest symlink
  const latestFile = path.join(deployDir, 'latest.json');
  fs.writeFileSync(latestFile, JSON.stringify(deploymentInfo, null, 2));

  console.log('\n========================================');
  console.log('  Deployment Summary');
  console.log('========================================');
  console.log(`Contract:    MemoryVault`);
  console.log(`Address:     ${vaultAddress}`);
  console.log(`Deployer:    ${deployer.address}`);
  console.log(`Network:     ${networkName} (Chain ${Number(network.chainId)})`);
  console.log(`Explorer:    ${deploymentInfo.explorer.contract}`);
  console.log(`\nDeployment saved to: ${deployFile}`);
  console.log('\nVerify contract with:');
  console.log(`  npx hardhat verify --network 0g-${networkName} ${vaultAddress}`);
}

main().catch((error) => {
  console.error('Deployment failed:', error);
  process.exitCode = 1;
});
