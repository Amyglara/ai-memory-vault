import { expect } from 'chai';
import { ethers } from 'hardhat';
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';

describe('MemoryVault', function () {
  // We define a fixture to reuse the same setup in every test.
  async function deployVaultFixture() {
    const [owner, other, third] = await ethers.getSigners();

    const MemoryVault = await ethers.getContractFactory('MemoryVault');
    const vault = await MemoryVault.deploy();
    await vault.waitForDeployment();

    return { vault, owner, other, third };
  }

  describe('File Anchoring', function () {
    it('Should anchor a file with valid data', async function () {
      const { vault, owner } = await loadFixture(deployVaultFixture);

      const rootHash = ethers.keccak256(ethers.toUtf8Bytes('test-file-content'));
      const tx = await vault.anchorFile(
        rootHash,
        'test.pdf',
        1024,
        'application/pdf'
      );

      await expect(tx)
        .to.emit(vault, 'FileAnchored')
        .withArgs(0, rootHash, owner.address, 'test.pdf');

      const file = await vault.getFile(0);
      expect(file.rootHash).to.equal(rootHash);
      expect(file.owner).to.equal(owner.address);
      expect(file.filename).to.equal('test.pdf');
      expect(file.fileSize).to.equal(1024);
      expect(file.contentType).to.equal('application/pdf');
      expect(file.timestamp).to.be.gt(0);
    });

    it('Should increment fileCount', async function () {
      const { vault } = await loadFixture(deployVaultFixture);

      expect(await vault.getFileCount()).to.equal(0);

      const rootHash = ethers.keccak256(ethers.toUtf8Bytes('file-1'));
      await vault.anchorFile(rootHash, 'file1.txt', 100, 'text/plain');

      expect(await vault.getFileCount()).to.equal(1);
    });

    it('Should track files by owner', async function () {
      const { vault, owner, other } = await loadFixture(deployVaultFixture);

      await vault.anchorFile(ethers.keccak256(ethers.toUtf8Bytes('a')), 'a.txt', 10, 'text/plain');
      await vault.anchorFile(ethers.keccak256(ethers.toUtf8Bytes('b')), 'b.txt', 20, 'text/plain');

      await vault.connect(other).anchorFile(
        ethers.keccak256(ethers.toUtf8Bytes('c')),
        'c.txt',
        30,
        'text/plain'
      );

      const ownerFiles = await vault.getFilesByOwner(owner.address);
      expect(ownerFiles).to.deep.equal([0n, 1n]);

      const otherFiles = await vault.getFilesByOwner(other.address);
      expect(otherFiles).to.deep.equal([2n]);
    });

    it('Should reject duplicate root hashes', async function () {
      const { vault } = await loadFixture(deployVaultFixture);

      const rootHash = ethers.keccak256(ethers.toUtf8Bytes('unique-content'));
      await vault.anchorFile(rootHash, 'first.txt', 100, 'text/plain');

      await expect(
        vault.anchorFile(rootHash, 'second.txt', 200, 'text/plain')
      ).to.be.revertedWithCustomError(vault, 'RootAlreadyRegistered');
    });

    it('Should reject empty root hash', async function () {
      const { vault } = await loadFixture(deployVaultFixture);

      await expect(
        vault.anchorFile(ethers.ZeroHash, 'test.txt', 100, 'text/plain')
      ).to.be.revertedWithCustomError(vault, 'InvalidRootHash');
    });

    it('Should reject empty filename', async function () {
      const { vault } = await loadFixture(deployVaultFixture);

      await expect(
        vault.anchorFile(ethers.keccak256(ethers.toUtf8Bytes('x')), '', 100, 'text/plain')
      ).to.be.revertedWithCustomError(vault, 'EmptyFilename');
    });

    it('Should allow owner to update file metadata', async function () {
      const { vault } = await loadFixture(deployVaultFixture);

      const rootHash = ethers.keccak256(ethers.toUtf8Bytes('update-test'));
      await vault.anchorFile(rootHash, 'old.txt', 100, 'text/plain');
      await vault.updateFileMetadata(0, 'new-name.txt', 'text/markdown');

      const file = await vault.getFile(0);
      expect(file.filename).to.equal('new-name.txt');
      expect(file.contentType).to.equal('text/markdown');
    });

    it('Should reject non-owner metadata update', async function () {
      const { vault, other } = await loadFixture(deployVaultFixture);

      await vault.anchorFile(ethers.keccak256(ethers.toUtf8Bytes('x')), 'test.txt', 100, 'text/plain');

      await expect(
        vault.connect(other).updateFileMetadata(0, 'hacked.txt', 'text/plain')
      ).to.be.revertedWithCustomError(vault, 'NotFileOwner');
    });
  });

  describe('Agent Identity', function () {
    it('Should register an agent', async function () {
      const { vault, owner } = await loadFixture(deployVaultFixture);

      const memoryRoot = ethers.keccak256(ethers.toUtf8Bytes('agent-memory'));
      const tx = await vault.registerAgent('Test Agent', 'A test AI agent', memoryRoot);

      await expect(tx)
        .to.emit(vault, 'AgentRegistered')
        .withArgs(0, owner.address, 'Test Agent');

      const agent = await vault.getAgent(0);
      expect(agent.owner).to.equal(owner.address);
      expect(agent.name).to.equal('Test Agent');
      expect(agent.description).to.equal('A test AI agent');
      expect(agent.memoryRoot).to.equal(memoryRoot);
      expect(agent.active).to.be.true;
      expect(agent.fileCount).to.equal(0);
    });

    it('Should reject empty agent name', async function () {
      const { vault } = await loadFixture(deployVaultFixture);

      await expect(
        vault.registerAgent('', 'desc', ethers.ZeroHash)
      ).to.be.revertedWithCustomError(vault, 'EmptyAgentName');
    });

    it('Should allow owner to update agent', async function () {
      const { vault } = await loadFixture(deployVaultFixture);

      await vault.registerAgent('Old Name', 'old desc', ethers.ZeroHash);
      const newRoot = ethers.keccak256(ethers.toUtf8Bytes('new-memory'));
      await vault.updateAgent(0, 'New Name', 'new desc', newRoot);

      const agent = await vault.getAgent(0);
      expect(agent.name).to.equal('New Name');
      expect(agent.description).to.equal('new desc');
      expect(agent.memoryRoot).to.equal(newRoot);
    });

    it('Should allow owner to deactivate agent', async function () {
      const { vault } = await loadFixture(deployVaultFixture);

      await vault.registerAgent('Agent', 'desc', ethers.ZeroHash);
      await vault.deactivateAgent(0);

      const agent = await vault.getAgent(0);
      expect(agent.active).to.be.false;
    });

    it('Should reject update on deactivated agent', async function () {
      const { vault } = await loadFixture(deployVaultFixture);

      await vault.registerAgent('Agent', 'desc', ethers.ZeroHash);
      await vault.deactivateAgent(0);

      await expect(
        vault.updateAgent(0, 'New', 'desc', ethers.ZeroHash)
      ).to.be.revertedWithCustomError(vault, 'AgentNotActive');
    });

    it('Should reject non-owner update', async function () {
      const { vault, other } = await loadFixture(deployVaultFixture);

      await vault.registerAgent('Agent', 'desc', ethers.ZeroHash);

      await expect(
        vault.connect(other).updateAgent(0, 'Hacked', 'desc', ethers.ZeroHash)
      ).to.be.revertedWithCustomError(vault, 'NotAgentOwner');
    });
  });

  describe('File-Agent Linking', function () {
    it('Should link a file to an agent', async function () {
      const { vault } = await loadFixture(deployVaultFixture);

      const fileRoot = ethers.keccak256(ethers.toUtf8Bytes('file-data'));
      await vault.anchorFile(fileRoot, 'knowledge.txt', 2048, 'text/plain');
      await vault.registerAgent('Agent', 'desc', ethers.ZeroHash);

      await vault.linkFileToAgent(0, 0);

      const agentFiles = await vault.getAgentFiles(0);
      expect(agentFiles).to.deep.equal([0n]);

      const linkedAgent = await vault.getFileAgent(0);
      expect(linkedAgent).to.equal(0);

      const agent = await vault.getAgent(0);
      expect(agent.fileCount).to.equal(1);
    });

    it('Should reject linking to deactivated agent', async function () {
      const { vault } = await loadFixture(deployVaultFixture);

      await vault.anchorFile(ethers.keccak256(ethers.toUtf8Bytes('x')), 'f.txt', 10, 'text/plain');
      await vault.registerAgent('Agent', 'desc', ethers.ZeroHash);
      await vault.deactivateAgent(0);

      await expect(
        vault.linkFileToAgent(0, 0)
      ).to.be.revertedWithCustomError(vault, 'AgentNotActive');
    });

    it('Should reject linking already-linked file', async function () {
      const { vault } = await loadFixture(deployVaultFixture);

      await vault.anchorFile(ethers.keccak256(ethers.toUtf8Bytes('x')), 'f.txt', 10, 'text/plain');
      await vault.registerAgent('Agent', 'desc', ethers.ZeroHash);
      await vault.linkFileToAgent(0, 0);

      await expect(
        vault.linkFileToAgent(0, 0)
      ).to.be.revertedWithCustomError(vault, 'FileAlreadyLinked');
    });

    it('Should reject linking by non-file-owner', async function () {
      const { vault, other } = await loadFixture(deployVaultFixture);

      await vault.anchorFile(ethers.keccak256(ethers.toUtf8Bytes('x')), 'f.txt', 10, 'text/plain');
      await vault.connect(other).registerAgent('Agent', 'desc', ethers.ZeroHash);

      await expect(
        vault.connect(other).linkFileToAgent(0, 0)
      ).to.be.revertedWithCustomError(vault, 'NotFileOwner');
    });
  });

  describe('Edge Cases', function () {
    it('Should revert for non-existent file', async function () {
      const { vault } = await loadFixture(deployVaultFixture);

      await expect(vault.getFile(999)).to.be.revertedWithCustomError(vault, 'FileNotFound');
    });

    it('Should revert for non-existent agent', async function () {
      const { vault } = await loadFixture(deployVaultFixture);

      await expect(vault.getAgent(999)).to.be.revertedWithCustomError(vault, 'AgentNotFound');
    });
  });
});
