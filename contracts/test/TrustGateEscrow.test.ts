import { expect } from 'chai';
import { ethers } from 'hardhat';
import { TrustGateEscrow } from '../typechain-types';
import { SignerWithAddress } from '@nomicfoundation/hardhat-ethers/signers';

describe('TrustGateEscrow', function () {
  let escrow: TrustGateEscrow;
  let buyer: SignerWithAddress;
  let seller: SignerWithAddress;
  let arbitrator1: SignerWithAddress;
  let arbitrator2: SignerWithAddress;
  let arbitrator3: SignerWithAddress;
  let outsider: SignerWithAddress;

  const ESCROW_AMOUNT = ethers.parseEther('1.0'); // 1 ETH
  const ONE_DAY = 86400;

  beforeEach(async function () {
    [buyer, seller, arbitrator1, arbitrator2, arbitrator3, outsider] = await ethers.getSigners();

    const TrustGateEscrow = await ethers.getContractFactory('TrustGateEscrow');
    escrow = await TrustGateEscrow.deploy();
    await escrow.waitForDeployment();
  });

  describe('Deployment', function () {
    it('should set deployer as owner', async function () {
      expect(await escrow.owner()).to.equal(buyer.address);
    });

    it('should start with zero escrows', async function () {
      expect(await escrow.getEscrowCount()).to.equal(0);
    });
  });

  describe('Create Escrow', function () {
    it('should create escrow successfully', async function () {
      const tx = await escrow.connect(buyer).createEscrow(
        seller.address,
        ESCROW_AMOUNT,
        'Test transaction',
        ONE_DAY * 3
      );

      expect(await escrow.getEscrowCount()).to.equal(1);

      const e = await escrow.getEscrow(0);
      expect(e.buyer).to.equal(buyer.address);
      expect(e.seller).to.equal(seller.address);
      expect(e.amount).to.equal(ESCROW_AMOUNT);
      expect(e.status).to.equal(0); // Created
      expect(e.description).to.equal('Test transaction');

      await expect(tx).to.emit(escrow, 'EscrowCreated').withArgs(
        0, buyer.address, seller.address, ESCROW_AMOUNT, 'Test transaction'
      );
    });

    it('should revert when seller is zero address', async function () {
      await expect(
        escrow.connect(buyer).createEscrow(ethers.ZeroAddress, ESCROW_AMOUNT, 'Test', ONE_DAY * 3)
      ).to.be.revertedWithCustomError(escrow, 'InvalidAddress');
    });

    it('should revert when seller is same as buyer', async function () {
      await expect(
        escrow.connect(buyer).createEscrow(buyer.address, ESCROW_AMOUNT, 'Test', ONE_DAY * 3)
      ).to.be.revertedWithCustomError(escrow, 'InvalidAddress');
    });

    it('should revert with zero amount', async function () {
      await expect(
        escrow.connect(buyer).createEscrow(seller.address, 0, 'Test', ONE_DAY * 3)
      ).to.be.revertedWithCustomError(escrow, 'ZeroAmount');
    });

    it('should revert with empty description', async function () {
      await expect(
        escrow.connect(buyer).createEscrow(seller.address, ESCROW_AMOUNT, '', ONE_DAY * 3)
      ).to.be.revertedWithCustomError(escrow, 'EmptyDescription');
    });

    it('should revert with deadline < 1 day', async function () {
      await expect(
        escrow.connect(buyer).createEscrow(seller.address, ESCROW_AMOUNT, 'Test', 3600)
      ).to.be.revertedWithCustomError(escrow, 'DeadlineTooShort');
    });
  });

  describe('Fund Escrow', function () {
    it('should fund escrow successfully', async function () {
      await escrow.connect(buyer).createEscrow(seller.address, ESCROW_AMOUNT, 'Test', ONE_DAY * 3);

      const fee = await escrow.escrows(0).then(e => e.fee);
      const totalRequired = ESCROW_AMOUNT + fee;

      const tx = await escrow.connect(buyer).fundEscrow(0, { value: totalRequired });

      const e = await escrow.getEscrow(0);
      expect(e.status).to.equal(1); // Funded

      await expect(tx).to.emit(escrow, 'EscrowFunded').withArgs(0, totalRequired);
    });

    it('should refund excess payment', async function () {
      await escrow.connect(buyer).createEscrow(seller.address, ESCROW_AMOUNT, 'Test', ONE_DAY * 3);

      const fee = await escrow.escrows(0).then(e => e.fee);
      const totalRequired = ESCROW_AMOUNT + fee;
      const excess = ethers.parseEther('0.5');

      await escrow.connect(buyer).fundEscrow(0, { value: totalRequired + excess });

      expect(await escrow.getPendingWithdrawal(buyer.address)).to.equal(excess);
    });

    it('should revert when insufficient funds', async function () {
      await escrow.connect(buyer).createEscrow(seller.address, ESCROW_AMOUNT, 'Test', ONE_DAY * 3);

      await expect(
        escrow.connect(buyer).fundEscrow(0, { value: ethers.parseEther('0.5') })
      ).to.be.revertedWithCustomError(escrow, 'InvalidAmount');
    });

    it('should revert when not buyer', async function () {
      await escrow.connect(buyer).createEscrow(seller.address, ESCROW_AMOUNT, 'Test', ONE_DAY * 3);

      await expect(
        escrow.connect(outsider).fundEscrow(0, { value: ESCROW_AMOUNT })
      ).to.be.revertedWithCustomError(escrow, 'NotBuyer');
    });
  });

  describe('Submit Evidence', function () {
    const ROOT_HASH = ethers.ZeroHash; // placeholder

    beforeEach(async function () {
      await escrow.connect(buyer).createEscrow(seller.address, ESCROW_AMOUNT, 'Test', ONE_DAY * 3);
      const fee = await escrow.escrows(0).then(e => e.fee);
      await escrow.connect(buyer).fundEscrow(0, { value: ESCROW_AMOUNT + fee });
    });

    it('should submit evidence as buyer', async function () {
      const tx = await escrow.connect(buyer).submitEvidence(0, ROOT_HASH, 'receipt.pdf', 'Payment receipt');

      expect(await escrow.getEvidenceCount()).to.equal(1);

      const ev = await escrow.getEvidence(0);
      expect(ev.escrowId).to.equal(0);
      expect(ev.submitter).to.equal(buyer.address);
      expect(ev.rootHash).to.equal(ROOT_HASH);
      expect(ev.filename).to.equal('receipt.pdf');

      await expect(tx).to.emit(escrow, 'EvidenceSubmitted');
    });

    it('should submit evidence as seller', async function () {
      await escrow.connect(seller).submitEvidence(0, ROOT_HASH, 'delivery.png', 'Proof of delivery');
      expect(await escrow.getEvidenceCount()).to.equal(1);
    });

    it('should reject evidence from outsider', async function () {
      await expect(
        escrow.connect(outsider).submitEvidence(0, ROOT_HASH, 'fake.pdf', 'Fake evidence')
      ).to.be.revertedWithCustomError(escrow, 'NotBuyer');
    });

    it('should transition status from Funded to Evidence on first submission', async function () {
      await escrow.connect(buyer).submitEvidence(0, ROOT_HASH, 'receipt.pdf', 'Receipt');
      const e = await escrow.getEscrow(0);
      expect(e.status).to.equal(2); // Evidence
    });
  });

  describe('Dispute Escrow', function () {
    beforeEach(async function () {
      await escrow.connect(buyer).createEscrow(seller.address, ESCROW_AMOUNT, 'Test', ONE_DAY * 3);
      const fee = await escrow.escrows(0).then(e => e.fee);
      await escrow.connect(buyer).fundEscrow(0, { value: ESCROW_AMOUNT + fee });
    });

    it('should raise dispute from buyer', async function () {
      const tx = await escrow.connect(buyer).disputeEscrow(0);

      const e = await escrow.getEscrow(0);
      expect(e.status).to.equal(3); // Disputed

      await expect(tx).to.emit(escrow, 'DisputeRaised').withArgs(0, buyer.address);
    });

    it('should raise dispute from seller', async function () {
      await escrow.connect(seller).disputeEscrow(0);
      expect(await escrow.getEscrowStatus(0)).to.equal(3);
    });

    it('should reject dispute from outsider', async function () {
      await expect(
        escrow.connect(outsider).disputeEscrow(0)
      ).to.be.revertedWithCustomError(escrow, 'NotBuyer');
    });
  });

  describe('Arbitration Voting', function () {
    const AI_HASH = ethers.keccak256(ethers.toUtf8Bytes('{"buyerWins":true,"confidence":85,"reasoning":"Strong evidence"}'));

    beforeEach(async function () {
      await escrow.connect(buyer).createEscrow(seller.address, ESCROW_AMOUNT, 'Test', ONE_DAY * 3);
      const fee = await escrow.escrows(0).then(e => e.fee);
      await escrow.connect(buyer).fundEscrow(0, { value: ESCROW_AMOUNT + fee });
      await escrow.connect(buyer).disputeEscrow(0);
    });

    it('should record AI verdict', async function () {
      await escrow.recordAIVerdict(0, AI_HASH);

      const arb = await escrow.getArbitration(0);
      expect(arb.aiVerdictHash).to.equal(AI_HASH);
    });

    it('should allow arbitrator to vote for buyer', async function () {
      await escrow.connect(arbitrator1).castVote(0, true);

      const arb = await escrow.getArbitration(0);
      expect(arb.totalVoters).to.equal(1);
      expect(arb.votesForBuyer).to.equal(1);
    });

    it('should allow multiple arbitrators to vote', async function () {
      await escrow.connect(arbitrator1).castVote(0, true);
      await escrow.connect(arbitrator2).castVote(0, true);
      await escrow.connect(arbitrator3).castVote(0, false);

      const arb = await escrow.getArbitration(0);
      expect(arb.totalVoters).to.equal(3);
      expect(arb.votesForBuyer).to.equal(2);
    });

    it('should reject buyer voting on own escrow', async function () {
      await expect(
        escrow.connect(buyer).castVote(0, true)
      ).to.be.revertedWithCustomError(escrow, 'NotArbitratorEligible');
    });

    it('should reject seller voting on own escrow', async function () {
      await expect(
        escrow.connect(seller).castVote(0, false)
      ).to.be.revertedWithCustomError(escrow, 'NotArbitratorEligible');
    });

    it('should reject double voting', async function () {
      await escrow.connect(arbitrator1).castVote(0, true);
      await expect(
        escrow.connect(arbitrator1).castVote(0, false)
      ).to.be.revertedWithCustomError(escrow, 'AlreadyVoted');
    });

    it('should reject voting on non-disputed escrow', async function () {
      // Create and fund a second escrow (not disputed)
      await escrow.connect(buyer).createEscrow(seller.address, ESCROW_AMOUNT, 'Test2', ONE_DAY * 3);
      const fee2 = await escrow.escrows(1).then(e => e.fee);
      await escrow.connect(buyer).fundEscrow(1, { value: ESCROW_AMOUNT + fee2 });

      await expect(
        escrow.connect(arbitrator1).castVote(1, true)
      ).to.be.revertedWithCustomError(escrow, 'InvalidStatus');
    });
  });

  describe('Resolve Escrow', function () {
    beforeEach(async function () {
      await escrow.connect(buyer).createEscrow(seller.address, ESCROW_AMOUNT, 'Test', ONE_DAY * 3);
      const fee = await escrow.escrows(0).then(e => e.fee);
      await escrow.connect(buyer).fundEscrow(0, { value: ESCROW_AMOUNT + fee });
      await escrow.connect(buyer).disputeEscrow(0);
    });

    it('should resolve in favor of buyer (2/3 votes)', async function () {
      await escrow.connect(arbitrator1).castVote(0, true);
      await escrow.connect(arbitrator2).castVote(0, true);
      await escrow.connect(arbitrator3).castVote(0, false);

      const tx = await escrow.resolveEscrow(0);

      const arb = await escrow.getArbitration(0);
      expect(arb.resolved).to.be.true;
      expect(arb.buyerWins).to.be.true;

      const e = await escrow.getEscrow(0);
      expect(e.status).to.equal(4); // Resolved

      await expect(tx).to.emit(escrow, 'EscrowResolved');
    });

    it('should resolve in favor of seller (2/3 votes)', async function () {
      await escrow.connect(arbitrator1).castVote(0, false);
      await escrow.connect(arbitrator2).castVote(0, false);
      await escrow.connect(arbitrator3).castVote(0, true);

      await escrow.resolveEscrow(0);

      const arb = await escrow.getArbitration(0);
      expect(arb.buyerWins).to.be.false;
    });

    it('should distribute funds correctly when buyer wins', async function () {
      await escrow.connect(arbitrator1).castVote(0, true);
      await escrow.connect(arbitrator2).castVote(0, true);
      await escrow.connect(arbitrator3).castVote(0, false);

      await escrow.resolveEscrow(0);

      // Buyer should get amount + half of fee
      const buyerPending = await escrow.getPendingWithdrawal(buyer.address);
      expect(buyerPending).to.be.gt(0);

      // Seller should get 0 (buyer won)
      const sellerPending = await escrow.getPendingWithdrawal(seller.address);
      expect(sellerPending).to.equal(0);

      // Winning arbitrators should get rewards
      const arb1Pending = await escrow.getPendingWithdrawal(arbitrator1.address);
      const arb2Pending = await escrow.getPendingWithdrawal(arbitrator2.address);
      expect(arb1Pending).to.be.gt(0);
      expect(arb2Pending).to.be.gt(0);

      // Losing arbitrator gets nothing
      const arb3Pending = await escrow.getPendingWithdrawal(arbitrator3.address);
      expect(arb3Pending).to.equal(0);
    });

    it('should distribute funds correctly when seller wins', async function () {
      await escrow.connect(arbitrator1).castVote(0, false);
      await escrow.connect(arbitrator2).castVote(0, true);
      await escrow.connect(arbitrator3).castVote(0, false);

      await escrow.resolveEscrow(0);

      // Seller should get amount + half of fee
      const sellerPending = await escrow.getPendingWithdrawal(seller.address);
      expect(sellerPending).to.be.gt(0);
    });

    it('should revert when insufficient voters', async function () {
      await escrow.connect(arbitrator1).castVote(0, true);

      await expect(
        escrow.resolveEscrow(0)
      ).to.be.revertedWithCustomError(escrow, 'ArbitrationNotReady');
    });

    it('should update trust scores', async function () {
      await escrow.connect(arbitrator1).castVote(0, true);
      await escrow.connect(arbitrator2).castVote(0, true);
      await escrow.connect(arbitrator3).castVote(0, false);

      await escrow.resolveEscrow(0);

      // buyerWins = true, so arbitrator1 and arbitrator2 are correct
      const info1 = await escrow.getTrustInfo(arbitrator1.address);
      expect(info1.totalDisputes).to.equal(1);
      expect(info1.correctVoteCount).to.equal(1);
      expect(info1.trustScore).to.equal(100); // 1/1 * 100

      const info3 = await escrow.getTrustInfo(arbitrator3.address);
      expect(info3.correctVoteCount).to.equal(0);
      expect(info3.trustScore).to.equal(0);
    });
  });

  describe('Release Escrow (no dispute)', function () {
    beforeEach(async function () {
      await escrow.connect(buyer).createEscrow(seller.address, ESCROW_AMOUNT, 'Test', ONE_DAY * 3);
      const fee = await escrow.escrows(0).then(e => e.fee);
      await escrow.connect(buyer).fundEscrow(0, { value: ESCROW_AMOUNT + fee });
    });

    it('should release funds to seller', async function () {
      await escrow.connect(buyer).releaseEscrow(0);

      const e = await escrow.getEscrow(0);
      expect(e.status).to.equal(5); // Released

      const sellerPending = await escrow.getPendingWithdrawal(seller.address);
      expect(sellerPending).to.equal(ESCROW_AMOUNT + await escrow.escrows(0).then(e => e.fee));
    });

    it('should only allow buyer to release', async function () {
      await expect(
        escrow.connect(seller).releaseEscrow(0)
      ).to.be.revertedWithCustomError(escrow, 'NotBuyer');
    });
  });

  describe('Refund Escrow (timeout)', function () {
    beforeEach(async function () {
      await escrow.connect(buyer).createEscrow(seller.address, ESCROW_AMOUNT, 'Test', ONE_DAY * 3);
      const fee = await escrow.escrows(0).then(e => e.fee);
      await escrow.connect(buyer).fundEscrow(0, { value: ESCROW_AMOUNT + fee });
    });

    it('should refund after deadline', async function () {
      // Move time past deadline
      await ethers.provider.send('evm_increaseTime', [ONE_DAY * 8]);
      await ethers.provider.send('evm_mine', []);

      await escrow.refundEscrow(0);

      const e = await escrow.getEscrow(0);
      expect(e.status).to.equal(6); // Refunded

      const buyerPending = await escrow.getPendingWithdrawal(buyer.address);
      expect(buyerPending).to.equal(ESCROW_AMOUNT + await escrow.escrows(0).then(e => e.fee));
    });

    it('should revert before deadline', async function () {
      await expect(
        escrow.refundEscrow(0)
      ).to.be.revertedWithCustomError(escrow, 'DeadlineTooShort');
    });

    it('should allow anyone to trigger refund after deadline', async function () {
      await ethers.provider.send('evm_increaseTime', [ONE_DAY * 8]);
      await ethers.provider.send('evm_mine', []);

      // Even outsider can trigger refund
      await expect(
        escrow.connect(outsider).refundEscrow(0)
      ).to.not.be.reverted;
    });
  });

  describe('Withdraw', function () {
    it('should withdraw pending funds', async function () {
      await escrow.connect(buyer).createEscrow(seller.address, ESCROW_AMOUNT, 'Test', ONE_DAY * 3);
      const fee = await escrow.escrows(0).then(e => e.fee);
      await escrow.connect(buyer).fundEscrow(0, { value: ESCROW_AMOUNT + fee + ethers.parseEther('0.5') });

      // Excess should be pending
      const pendingBefore = await escrow.getPendingWithdrawal(buyer.address);
      expect(pendingBefore).to.equal(ethers.parseEther('0.5'));

      const balBefore = await ethers.provider.getBalance(buyer.address);
      const tx = await escrow.connect(buyer).withdraw();
      const receipt = await tx.wait();
      const gasUsed = receipt!.gasUsed * receipt!.gasPrice;

      const balAfter = await ethers.provider.getBalance(buyer.address);
      expect(balAfter).to.equal(balBefore + pendingBefore - gasUsed);

      expect(await escrow.getPendingWithdrawal(buyer.address)).to.equal(0);
    });

    it('should revert with zero pending', async function () {
      await expect(
        escrow.connect(buyer).withdraw()
      ).to.be.revertedWithCustomError(escrow, 'InsufficientBalance');
    });
  });

  describe('View Functions', function () {
    it('should return user escrows', async function () {
      await escrow.connect(buyer).createEscrow(seller.address, ESCROW_AMOUNT, 'Test1', ONE_DAY * 3);
      await escrow.connect(buyer).createEscrow(seller.address, ESCROW_AMOUNT, 'Test2', ONE_DAY * 3);

      const buyerEscs = await escrow.getEscrowsByBuyer(buyer.address);
      expect(buyerEscs).to.deep.equal([0n, 1n]);

      const sellerEscs = await escrow.getEscrowsBySeller(seller.address);
      expect(sellerEscs).to.deep.equal([0n, 1n]);
    });

    it('should return evidence by escrow', async function () {
      await escrow.connect(buyer).createEscrow(seller.address, ESCROW_AMOUNT, 'Test', ONE_DAY * 3);
      const fee = await escrow.escrows(0).then(e => e.fee);
      await escrow.connect(buyer).fundEscrow(0, { value: ESCROW_AMOUNT + fee });
      await escrow.connect(buyer).submitEvidence(0, ethers.ZeroHash, 'a.pdf', 'File A');
      await escrow.connect(seller).submitEvidence(0, ethers.ZeroHash, 'b.png', 'File B');

      const evIds = await escrow.getEvidenceByEscrow(0);
      expect(evIds).to.deep.equal([0n, 1n]);
    });

    it('should return escrow stats', async function () {
      await escrow.connect(buyer).createEscrow(seller.address, ESCROW_AMOUNT, 'Test1', ONE_DAY * 3);
      const fee1 = await escrow.escrows(0).then(e => e.fee);
      await escrow.connect(buyer).fundEscrow(0, { value: ESCROW_AMOUNT + fee1 });

      const stats = await escrow.getEscrowStats();
      expect(stats.total).to.equal(1);
      expect(stats.funded).to.equal(1);
      expect(stats.disputed).to.equal(0);
    });

    it('should return total value locked', async function () {
      await escrow.connect(buyer).createEscrow(seller.address, ESCROW_AMOUNT, 'Test', ONE_DAY * 3);
      const fee = await escrow.escrows(0).then(e => e.fee);
      await escrow.connect(buyer).fundEscrow(0, { value: ESCROW_AMOUNT + fee });

      const tvl = await escrow.getTotalValueLocked();
      expect(tvl).to.equal(ESCROW_AMOUNT + fee);
    });
  });

  describe('Full Lifecycle', function () {
    it('should complete a full escrow with dispute, arbitration, and withdrawal', async function () {
      // 1. Create
      await escrow.connect(buyer).createEscrow(seller.address, ESCROW_AMOUNT, 'Full test', ONE_DAY * 3);
      expect(await escrow.getEscrowCount()).to.equal(1);

      // 2. Fund
      const fee = await escrow.escrows(0).then(e => e.fee);
      await escrow.connect(buyer).fundEscrow(0, { value: ESCROW_AMOUNT + fee });
      expect(await escrow.getEscrowStatus(0)).to.equal(1); // Funded

      // 3. Submit evidence
      await escrow.connect(buyer).submitEvidence(0, ethers.ZeroHash, 'receipt.pdf', 'Receipt');
      await escrow.connect(seller).submitEvidence(0, ethers.ZeroHash, 'proof.png', 'Proof');
      expect(await escrow.getEvidenceCount()).to.equal(2);

      // 4. Dispute
      await escrow.connect(buyer).disputeEscrow(0);
      expect(await escrow.getEscrowStatus(0)).to.equal(3); // Disputed

      // 5. Vote (2:1 for buyer)
      await escrow.connect(arbitrator1).castVote(0, true);
      await escrow.connect(arbitrator2).castVote(0, true);
      await escrow.connect(arbitrator3).castVote(0, false);

      // 6. Resolve
      await escrow.resolveEscrow(0);
      expect(await escrow.getEscrowStatus(0)).to.equal(4); // Resolved

      const arb = await escrow.getArbitration(0);
      expect(arb.buyerWins).to.be.true;

      // 7. Withdraw
      const buyerPending = await escrow.getPendingWithdrawal(buyer.address);
      expect(buyerPending).to.be.gt(0);

      await expect(() => escrow.connect(buyer).withdraw()).to.changeEtherBalance(
        buyer, buyerPending
      );

      console.log('✅ Full lifecycle test passed!');
    });
  });
});
