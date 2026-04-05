// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title TrustGateEscrow
 * @notice Decentralized Escrow & Arbitration Protocol on 0G Chain
 * @dev Manages escrow creation, funding, evidence submission, AI-assisted arbitration,
 *      multi-arbitrator voting, and trust-score-weighted fund distribution.
 *
 * Key features:
 * - Escrow lifecycle: Created → Funded → Evidence → Disputed → Resolved → Released/Refunded
 * - Evidence anchoring: Store 0G Storage merkle roots as on-chain evidence
 * - Hybrid arbitration: AI verdict hash (off-chain via 0G Compute) + 3-arbitrator majority vote
 * - Trust scores: Successful disputes build arbitrator reputation (voterWeight multiplier)
 * - Pull-payment pattern: Prevents reentrancy on fund withdrawals
 * - Fee model: 1% arbitration fee on escrow amount, distributed to winning arbitrators
 */

contract TrustGateEscrow {
    // ============================================================
    // Types
    // ============================================================

    enum EscrowStatus {
        Created,    // 0: Escrow created, awaiting funding
        Funded,     // 1: Buyer deposited funds
        Evidence,   // 2: Evidence submission phase
        Disputed,   // 3: Dispute raised, arbitration in progress
        Resolved,   // 4: Arbitration completed, funds claimable
        Released,   // 5: Funds released to seller (no dispute)
        Refunded    // 6: Funds refunded to buyer (timeout or arbitration)
    }

    /// @notice Represents an escrow agreement between buyer and seller
    struct Escrow {
        address buyer;
        address seller;
        uint256 amount;        // Total escrow amount (in wei)
        uint256 fee;           // Arbitration fee (1% of amount)
        uint256 createdAt;
        uint256 deadline;      // Evidence deadline (block timestamp)
        EscrowStatus status;
        string description;
    }

    /// @notice Represents evidence submitted for an escrow dispute
    struct Evidence {
        uint256 escrowId;
        address submitter;
        bytes32 rootHash;      // 0G Storage merkle root
        string filename;
        string description;
        uint256 timestamp;
    }

    /// @notice Represents arbitration state for a disputed escrow
    struct Arbitration {
        uint256 escrowId;
        bytes32 aiVerdictHash; // Hash of the AI analysis result (off-chain)
        uint256 totalVoters;
        uint256 votesForBuyer;
        bool resolved;
        bool buyerWins;
    }

    // ============================================================
    // Constants
    // ============================================================

    uint256 public constant FEE_PERCENTAGE = 100;        // 1% = 100/10000
    uint256 public constant FEE_DENOMINATOR = 10000;
    uint256 public constant MIN_VOTERS = 3;              // Minimum arbitrators for voting
    uint256 public constant MAX_VOTERS = 10;             // Maximum arbitrators per dispute
    uint256 public constant DEFAULT_DEADLINE_EXTENSION = 7 days; // Default evidence deadline

    // ============================================================
    // State
    // ============================================================

    address public owner;

    uint256 public escrowCount;
    uint256 public evidenceCount;

    // Core mappings
    mapping(uint256 => Escrow) public escrows;
    mapping(uint256 => Evidence) public evidence;
    mapping(uint256 => Arbitration) public arbitrations;

    // Index mappings
    mapping(address => uint256[]) public buyerEscrows;   // buyer => [escrowId, ...]
    mapping(address => uint256[]) public sellerEscrows;  // seller => [escrowId, ...]
    mapping(uint256 => uint256[]) public escrowEvidence;  // escrowId => [evidenceId, ...]

    // Arbitration tracking
    mapping(uint256 => mapping(address => bool)) public hasVoted;     // escrowId => voter => voted
    mapping(uint256 => mapping(address => bool)) public voterChoice;  // escrowId => voter => voteForBuyer
    mapping(uint256 => address[]) public escrowVoters;                 // escrowId => [voter, ...]

    // Trust scores for arbitrators (0-100)
    mapping(address => uint256) public trustScores;
    mapping(address => uint256) public disputeCount;   // Total disputes participated
    mapping(address => uint256) public correctVotes;   // Votes aligned with final outcome

    // Pull-payment balances
    mapping(address => uint256) public pendingWithdrawals;

    // ============================================================
    // Events
    // ============================================================

    event EscrowCreated(
        uint256 indexed escrowId,
        address indexed buyer,
        address indexed seller,
        uint256 amount,
        string description
    );

    event EscrowFunded(
        uint256 indexed escrowId,
        uint256 amount
    );

    event EvidenceSubmitted(
        uint256 indexed escrowId,
        uint256 indexed evidenceId,
        address indexed submitter,
        bytes32 rootHash,
        string filename
    );

    event DisputeRaised(
        uint256 indexed escrowId,
        address indexed initiator
    );

    event VoteCast(
        uint256 indexed escrowId,
        address indexed voter,
        bool voteForBuyer,
        uint256 weight
    );

    event AIVerdictRecorded(
        uint256 indexed escrowId,
        bytes32 aiVerdictHash
    );

    event EscrowResolved(
        uint256 indexed escrowId,
        bool buyerWins,
        uint256 votesForBuyer,
        uint256 totalVoters
    );

    event EscrowReleased(
        uint256 indexed escrowId,
        uint256 amount
    );

    event EscrowRefunded(
        uint256 indexed escrowId,
        uint256 amount
    );

    event Withdrawn(
        address indexed recipient,
        uint256 amount
    );

    // ============================================================
    // Errors
    // ============================================================

    error EscrowNotFound(uint256 escrowId);
    error EvidenceNotFound(uint256 evidenceId);
    error NotBuyer(uint256 escrowId, address caller);
    error NotSeller(uint256 escrowId, address caller);
    error InvalidStatus(uint256 escrowId, EscrowStatus expected, EscrowStatus actual);
    error InvalidAddress();
    error InvalidAmount();
    error ZeroAmount();
    error EmptyDescription();
    error DeadlineTooShort();
    error AlreadyVoted(uint256 escrowId, address voter);
    error NotArbitratorEligible(uint256 escrowId, address voter);
    error ArbitrationNotReady(uint256 escrowId);
    error AlreadyResolved(uint256 escrowId);
    error NoFundsToClaim(uint256 escrowId);
    error InsufficientBalance();
    error NotOwner(address caller);
    error MaxVotersReached(uint256 escrowId, uint256 currentVoters);
    error AIVerdictAlreadySet(uint256 escrowId);

    // ============================================================
    // Modifiers
    // ============================================================

    modifier escrowExists(uint256 escrowId) {
        if (escrowId >= escrowCount) revert EscrowNotFound(escrowId);
        _;
    }

    modifier onlyBuyer(uint256 escrowId) {
        if (escrows[escrowId].buyer != msg.sender) revert NotBuyer(escrowId, msg.sender);
        _;
    }

    modifier onlySeller(uint256 escrowId) {
        if (escrows[escrowId].seller != msg.sender) revert NotSeller(escrowId, msg.sender);
        _;
    }

    modifier onlyEscrowParty(uint256 escrowId) {
        Escrow storage e = escrows[escrowId];
        if (e.buyer != msg.sender && e.seller != msg.sender) {
            revert NotBuyer(escrowId, msg.sender);
        }
        _;
    }

    modifier inStatus(uint256 escrowId, EscrowStatus expected) {
        if (escrows[escrowId].status != expected) {
            revert InvalidStatus(escrowId, expected, escrows[escrowId].status);
        }
        _;
    }

    // ============================================================
    // Constructor
    // ============================================================

    constructor() {
        owner = msg.sender;
    }

    // ============================================================
    // Escrow Lifecycle
    // ============================================================

    /**
     * @notice Create a new escrow agreement
     * @param seller The seller's address
     * @param amount The escrow amount in wei
     * @param description Transaction description
     * @param deadlineDuration Duration for evidence submission (seconds from funding)
     * @return escrowId The ID of the created escrow
     */
    function createEscrow(
        address seller,
        uint256 amount,
        string calldata description,
        uint256 deadlineDuration
    ) external returns (uint256 escrowId) {
        if (seller == address(0) || seller == msg.sender) revert InvalidAddress();
        if (amount == 0) revert ZeroAmount();
        if (bytes(description).length == 0) revert EmptyDescription();
        if (deadlineDuration < 1 days) revert DeadlineTooShort();

        uint256 fee = (amount * FEE_PERCENTAGE) / FEE_DENOMINATOR;

        escrowId = escrowCount++;
        escrows[escrowId] = Escrow({
            buyer: msg.sender,
            seller: seller,
            amount: amount,
            fee: fee,
            createdAt: block.timestamp,
            deadline: block.timestamp + deadlineDuration,
            status: EscrowStatus.Created,
            description: description
        });

        buyerEscrows[msg.sender].push(escrowId);
        sellerEscrows[seller].push(escrowId);

        emit EscrowCreated(escrowId, msg.sender, seller, amount, description);
    }

    /**
     * @notice Fund an escrow (buyer deposits the amount + fee)
     * @param escrowId The escrow to fund
     */
    function fundEscrow(uint256 escrowId)
        external
        payable
        escrowExists(escrowId)
        onlyBuyer(escrowId)
        inStatus(escrowId, EscrowStatus.Created)
    {
        uint256 totalRequired = escrows[escrowId].amount + escrows[escrowId].fee;
        if (msg.value < totalRequired) revert InvalidAmount();

        // Refund excess
        if (msg.value > totalRequired) {
            pendingWithdrawals[msg.sender] += msg.value - totalRequired;
        }

        escrows[escrowId].status = EscrowStatus.Funded;
        // Extend deadline from funding time
        escrows[escrowId].deadline = block.timestamp + DEFAULT_DEADLINE_EXTENSION;

        emit EscrowFunded(escrowId, totalRequired);
    }

    /**
     * @notice Submit evidence for an escrow (stored on 0G Storage, root anchored on-chain)
     * @param escrowId The escrow ID
     * @param rootHash Merkle root from 0G Storage
     * @param filename Evidence file name
     * @param description Evidence description
     * @return evidenceId The ID of the submitted evidence
     */
    function submitEvidence(
        uint256 escrowId,
        bytes32 rootHash,
        string calldata filename,
        string calldata description
    )
        external
        escrowExists(escrowId)
        onlyEscrowParty(escrowId)
        returns (uint256 evidenceId)
    {
        EscrowStatus status = escrows[escrowId].status;
        if (status != EscrowStatus.Funded && status != EscrowStatus.Evidence && status != EscrowStatus.Disputed) {
            revert InvalidStatus(escrowId, EscrowStatus.Evidence, status);
        }

        if (escrows[escrowId].status == EscrowStatus.Funded) {
            escrows[escrowId].status = EscrowStatus.Evidence;
        }

        evidenceId = evidenceCount++;
        evidence[evidenceId] = Evidence({
            escrowId: escrowId,
            submitter: msg.sender,
            rootHash: rootHash,
            filename: filename,
            description: description,
            timestamp: block.timestamp
        });

        escrowEvidence[escrowId].push(evidenceId);

        emit EvidenceSubmitted(escrowId, evidenceId, msg.sender, rootHash, filename);
    }

    /**
     * @notice Raise a dispute (enters arbitration phase)
     * @param escrowId The escrow to dispute
     */
    function disputeEscrow(uint256 escrowId)
        external
        escrowExists(escrowId)
        onlyEscrowParty(escrowId)
    {
        EscrowStatus status = escrows[escrowId].status;
        if (status != EscrowStatus.Funded && status != EscrowStatus.Evidence) {
            revert InvalidStatus(escrowId, EscrowStatus.Evidence, status);
        }

        escrows[escrowId].status = EscrowStatus.Disputed;

        emit DisputeRaised(escrowId, msg.sender);
    }

    /**
     * @notice Record the AI verdict hash from off-chain 0G Compute analysis
     * @dev Anyone can record the AI verdict hash; the actual verdict is verified off-chain
     * @param escrowId The disputed escrow
     * @param aiVerdictHash Keccak256 hash of the AI verdict JSON
     */
    function recordAIVerdict(
        uint256 escrowId,
        bytes32 aiVerdictHash
    )
        external
        escrowExists(escrowId)
        inStatus(escrowId, EscrowStatus.Disputed)
    {
        // Prevent overwriting an existing AI verdict
        if (arbitrations[escrowId].aiVerdictHash != bytes32(0)) {
            revert AIVerdictAlreadySet(escrowId);
        }

        arbitrations[escrowId].escrowId = escrowId;
        arbitrations[escrowId].aiVerdictHash = aiVerdictHash;

        emit AIVerdictRecorded(escrowId, aiVerdictHash);
    }

    /**
     * @notice Cast a vote as an arbitrator
     * @param escrowId The disputed escrow
     * @param voteForBuyer true if voter believes buyer should win
     */
    function castVote(
        uint256 escrowId,
        bool voteForBuyer
    )
        external
        escrowExists(escrowId)
        inStatus(escrowId, EscrowStatus.Disputed)
    {
        Escrow storage e = escrows[escrowId];

        // Cannot vote on own escrow
        if (msg.sender == e.buyer || msg.sender == e.seller) {
            revert NotArbitratorEligible(escrowId, msg.sender);
        }

        // Cannot vote twice
        if (hasVoted[escrowId][msg.sender]) revert AlreadyVoted(escrowId, msg.sender);

        // Enforce maximum number of voters
        if (escrowVoters[escrowId].length >= MAX_VOTERS) {
            revert NotArbitratorEligible(escrowId, msg.sender);
        }

        // Record vote
        hasVoted[escrowId][msg.sender] = true;
        voterChoice[escrowId][msg.sender] = voteForBuyer;
        escrowVoters[escrowId].push(msg.sender);

        // Calculate vote weight based on trust score (base weight = 1)
        uint256 weight = 1;
        uint256 ts = trustScores[msg.sender];
        if (ts >= 80) weight = 3;
        else if (ts >= 60) weight = 2;
        else if (ts >= 40) weight = 1;

        Arbitration storage arb = arbitrations[escrowId];
        arb.totalVoters += weight;
        if (voteForBuyer) {
            arb.votesForBuyer += weight;
        }

        emit VoteCast(escrowId, msg.sender, voteForBuyer, weight);
    }

    /**
     * @notice Resolve a disputed escrow and distribute funds
     * @dev Can be called by anyone after MIN_VOTERS have voted
     * @param escrowId The disputed escrow to resolve
     */
    function resolveEscrow(uint256 escrowId)
        external
        escrowExists(escrowId)
        inStatus(escrowId, EscrowStatus.Disputed)
    {
        Arbitration storage arb = arbitrations[escrowId];
        if (arb.totalVoters < MIN_VOTERS) revert ArbitrationNotReady(escrowId);

        // Prevent voters from resolving their own dispute (conflict of interest)
        if (hasVoted[escrowId][msg.sender]) revert NotArbitratorEligible(escrowId, msg.sender);

        Escrow storage e = escrows[escrowId];

        // Determine winner by majority vote
        // Tie goes to seller (buyer failed to prove their case beyond reasonable doubt)
        bool buyerWins = arb.votesForBuyer * 2 > arb.totalVoters;
        arb.buyerWins = buyerWins;
        arb.resolved = true;

        e.status = EscrowStatus.Resolved;

        // Calculate distribution
        uint256 principal = e.amount;
        uint256 feePool = e.fee;

        if (buyerWins) {
            // Buyer gets principal back + portion of fee
            pendingWithdrawals[e.buyer] += principal + (feePool / 2);
        } else {
            // Seller gets principal + portion of fee
            pendingWithdrawals[e.seller] += principal + (feePool / 2);
        }

        // Reward winning arbitrators with remaining fee
        uint256 rewardPool = feePool / 2;
        uint256 winningArbitrators = 0;
        for (uint256 i = 0; i < escrowVoters[escrowId].length; i++) {
            if (voterChoice[escrowId][escrowVoters[escrowId][i]] == buyerWins) {
                winningArbitrators++;
            }
        }
        if (winningArbitrators > 0) {
            uint256 rewardPerArbitrator = rewardPool / winningArbitrators;
            for (uint256 i = 0; i < escrowVoters[escrowId].length; i++) {
                if (voterChoice[escrowId][escrowVoters[escrowId][i]] == buyerWins) {
                    pendingWithdrawals[escrowVoters[escrowId][i]] += rewardPerArbitrator;
                }
            }
        }

        // Update trust scores for all voters
        for (uint256 i = 0; i < escrowVoters[escrowId].length; i++) {
            address voter = escrowVoters[escrowId][i];
            disputeCount[voter]++;
            if (voterChoice[escrowId][voter] == buyerWins) {
                correctVotes[voter]++;
            }
            // Recalculate trust score (correctVotes / disputeCount * 100)
            if (disputeCount[voter] > 0) {
                trustScores[voter] = (correctVotes[voter] * 100) / disputeCount[voter];
            }
        }

        emit EscrowResolved(escrowId, buyerWins, arb.votesForBuyer, arb.totalVoters);
    }

    /**
     * @notice Release funds to seller (no dispute, normal completion)
     * @param escrowId The escrow to release
     */
    function releaseEscrow(uint256 escrowId)
        external
        escrowExists(escrowId)
        onlyBuyer(escrowId)
    {
        EscrowStatus status = escrows[escrowId].status;
        if (status != EscrowStatus.Funded && status != EscrowStatus.Evidence) {
            revert InvalidStatus(escrowId, EscrowStatus.Funded, status);
        }

        Escrow storage e = escrows[escrowId];
        e.status = EscrowStatus.Released;

        // Seller gets amount + fee refund (no arbitration fee charged)
        uint256 total = e.amount + e.fee;
        pendingWithdrawals[e.seller] += total;

        emit EscrowReleased(escrowId, total);
    }

    /**
     * @notice Refund buyer after deadline passes (timeout)
     * @param escrowId The expired escrow
     */
    function refundEscrow(uint256 escrowId)
        external
        escrowExists(escrowId)
    {
        Escrow storage e = escrows[escrowId];
        if (e.status != EscrowStatus.Funded && e.status != EscrowStatus.Evidence) {
            revert InvalidStatus(escrowId, EscrowStatus.Funded, e.status);
        }
        if (block.timestamp <= e.deadline) revert DeadlineTooShort();

        e.status = EscrowStatus.Refunded;

        uint256 total = e.amount + e.fee;
        pendingWithdrawals[e.buyer] += total;

        emit EscrowRefunded(escrowId, total);
    }

    /**
     * @notice Withdraw pending funds (pull-payment pattern)
     */
    function withdraw() external {
        uint256 amount = pendingWithdrawals[msg.sender];
        if (amount == 0) revert InsufficientBalance();
        pendingWithdrawals[msg.sender] = 0;

        (bool success, ) = payable(msg.sender).call{value: amount}("");
        require(success, "Transfer failed");

        emit Withdrawn(msg.sender, amount);
    }

    /**
     * @notice Get the withdrawable balance for an address
     * @param addr The address to query
     * @return The pending withdrawal amount
     */
    function getPendingWithdrawal(address addr) external view returns (uint256) {
        return pendingWithdrawals[addr];
    }

    // ============================================================
    // View Functions
    // ============================================================

    /**
     * @notice Get an escrow record
     */
    function getEscrow(uint256 escrowId) external view escrowExists(escrowId) returns (Escrow memory) {
        return escrows[escrowId];
    }

    /**
     * @notice Get escrow count
     */
    function getEscrowCount() external view returns (uint256) {
        return escrowCount;
    }

    /**
     * @notice Get escrow IDs by buyer
     */
    function getEscrowsByBuyer(address buyer) external view returns (uint256[] memory) {
        return buyerEscrows[buyer];
    }

    /**
     * @notice Get escrow IDs by seller
     */
    function getEscrowsBySeller(address seller) external view returns (uint256[] memory) {
        return sellerEscrows[seller];
    }

    /**
     * @notice Get evidence count
     */
    function getEvidenceCount() external view returns (uint256) {
        return evidenceCount;
    }

    /**
     * @notice Get an evidence record
     */
    function getEvidence(uint256 evidenceId) external view returns (Evidence memory) {
        if (evidenceId >= evidenceCount) revert EvidenceNotFound(evidenceId);
        return evidence[evidenceId];
    }

    /**
     * @notice Get evidence IDs for an escrow
     */
    function getEvidenceByEscrow(uint256 escrowId) external view returns (uint256[] memory) {
        return escrowEvidence[escrowId];
    }

    /**
     * @notice Get arbitration state for an escrow
     */
    function getArbitration(uint256 escrowId) external view returns (Arbitration memory) {
        return arbitrations[escrowId];
    }

    /**
     * @notice Get all escrow IDs (both as buyer and seller) for a user
     */
    function getUserEscrows(address user) external view returns (uint256[] memory) {
        uint256[] storage buy = buyerEscrows[user];
        uint256[] storage sell = sellerEscrows[user];
        uint256[] memory result = new uint256[](buy.length + sell.length);

        uint256 i = 0;
        for (uint256 j = 0; j < buy.length; j++) {
            result[i++] = buy[j];
        }
        for (uint256 j = 0; j < sell.length; j++) {
            result[i++] = sell[j];
        }

        return result;
    }

    /**
     * @notice Get escrow status
     */
    function getEscrowStatus(uint256 escrowId) external view escrowExists(escrowId) returns (EscrowStatus) {
        return escrows[escrowId].status;
    }

    /**
     * @notice Get voters for an escrow
     */
    function getEscrowVoters(uint256 escrowId) external view returns (address[] memory) {
        return escrowVoters[escrowId];
    }

    /**
     * @notice Get total value locked in all active escrows
     */
    function getTotalValueLocked() external view returns (uint256) {
        uint256 tvl = 0;
        for (uint256 i = 0; i < escrowCount; i++) {
            EscrowStatus s = escrows[i].status;
            if (s == EscrowStatus.Funded || s == EscrowStatus.Evidence || s == EscrowStatus.Disputed) {
                tvl += escrows[i].amount + escrows[i].fee;
            }
        }
        return tvl;
    }

    /**
     * @notice Get counts by status (batch query for dashboard)
     * @return funded Count of funded escrows
     * @return disputed Count of disputed escrows
     * @return resolved Count of resolved escrows
     * @return total Total escrows
     */
    function getEscrowStats() external view returns (
        uint256 funded,
        uint256 disputed,
        uint256 resolved,
        uint256 total
    ) {
        for (uint256 i = 0; i < escrowCount; i++) {
            EscrowStatus s = escrows[i].status;
            total++;
            if (s == EscrowStatus.Funded || s == EscrowStatus.Evidence) funded++;
            else if (s == EscrowStatus.Disputed) disputed++;
            else if (s == EscrowStatus.Resolved || s == EscrowStatus.Released || s == EscrowStatus.Refunded) resolved++;
        }
    }

    /**
     * @notice Get trust score info for an arbitrator
     */
    function getTrustInfo(address arbitrator) external view returns (
        uint256 trustScore,
        uint256 totalDisputes,
        uint256 correctVoteCount
    ) {
        return (trustScores[arbitrator], disputeCount[arbitrator], correctVotes[arbitrator]);
    }

    // ============================================================
    // Admin
    // ============================================================

    /**
     * @notice Receive ETH
     */
    receive() external payable {}
}
