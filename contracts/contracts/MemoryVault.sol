// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title MemoryVault
 * @notice Decentralized AI Agent Memory Vault on 0G Chain
 * @dev Manages file anchoring (merkle roots) and AI agent identity registration
 *
 * Features:
 * - File anchoring: Store merkle root hashes of files stored on 0G Storage
 * - Agent registration: Register AI agent identities with associated memory roots
 * - Access control: Only file owners can update metadata; only agents can update their profiles
 * - Enumerable patterns: Query files and agents by index
 */
contract MemoryVault {
    // ============================================================
    // Types
    // ============================================================

    /// @notice Represents an anchored file on 0G Storage
    struct FileRecord {
        bytes32 rootHash;      // Merkle root hash from 0G Storage
        address owner;         // Address that anchored this file
        uint256 timestamp;     // Block timestamp when anchored
        string filename;       // Human-readable filename
        uint256 fileSize;      // File size in bytes
        string contentType;    // MIME type (e.g., "application/pdf")
    }

    /// @notice Represents a registered AI agent identity
    struct AgentRecord {
        address owner;         // Wallet address of the agent owner
        string name;           // Agent display name
        string description;    // Agent description / purpose
        bytes32 memoryRoot;    // Merkle root of the agent's memory/knowledge base
        uint256 registeredAt;  // Block timestamp when registered
        uint256 fileCount;     // Number of files linked to this agent
        bool active;           // Whether the agent is active
    }

    // ============================================================
    // State
    // ============================================================

    uint256 public fileCount;
    uint256 public agentCount;

    // Enumerable mappings
    mapping(uint256 => FileRecord) public files;
    mapping(uint256 => AgentRecord) public agents;

    // Index mappings for owner queries
    mapping(address => uint256[]) public ownerFiles;    // owner => [fileId, ...]
    mapping(address => uint256[]) public ownerAgents;   // owner => [agentId, ...]

    // Agent-file associations
    mapping(uint256 => uint256[]) public agentFiles;    // agentId => [fileId, ...]
    mapping(uint256 => uint256) public fileAgent;      // fileId => agentId (0 if none)
    mapping(uint256 => bool) public fileLinked;       // fileId => whether linked to any agent

    // Prevent duplicate root hashes
    mapping(bytes32 => bool) public registeredRoots;

    // ============================================================
    // Events
    // ============================================================

    event FileAnchored(
        uint256 indexed fileId,
        bytes32 indexed rootHash,
        address indexed owner,
        string filename
    );

    event AgentRegistered(
        uint256 indexed agentId,
        address indexed owner,
        string name
    );

    event AgentUpdated(
        uint256 indexed agentId,
        string name,
        bytes32 memoryRoot
    );

    event FileLinkedToAgent(
        uint256 indexed fileId,
        uint256 indexed agentId
    );

    event FileMetadataUpdated(
        uint256 indexed fileId,
        string filename,
        string contentType
    );

    event AgentDeactivated(uint256 indexed agentId);

    // ============================================================
    // Errors
    // ============================================================

    error FileNotFound(uint256 fileId);
    error AgentNotFound(uint256 agentId);
    error NotFileOwner(uint256 fileId, address caller);
    error NotAgentOwner(uint256 agentId, address caller);
    error RootAlreadyRegistered(bytes32 rootHash);
    error InvalidRootHash();
    error AgentNotActive(uint256 agentId);
    error EmptyFilename();
    error EmptyAgentName();
    error FileAlreadyLinked(uint256 fileId);

    // ============================================================
    // Modifiers
    // ============================================================

    modifier fileExists(uint256 fileId) {
        if (fileId >= fileCount) revert FileNotFound(fileId);
        _;
    }

    modifier agentExists(uint256 agentId) {
        if (agentId >= agentCount) revert AgentNotFound(agentId);
        _;
    }

    modifier onlyFileOwner(uint256 fileId) {
        if (files[fileId].owner != msg.sender) revert NotFileOwner(fileId, msg.sender);
        _;
    }

    modifier onlyAgentOwner(uint256 agentId) {
        if (agents[agentId].owner != msg.sender) revert NotAgentOwner(agentId, msg.sender);
        _;
    }

    // ============================================================
    // File Anchoring
    // ============================================================

    /**
     * @notice Anchor a file's merkle root to the blockchain
     * @param rootHash Merkle root hash from 0G Storage upload
     * @param filename Human-readable filename
     * @param fileSize File size in bytes
     * @param contentType MIME type
     * @return fileId The ID of the anchored file
     */
    function anchorFile(
        bytes32 rootHash,
        string calldata filename,
        uint256 fileSize,
        string calldata contentType
    ) external returns (uint256 fileId) {
        if (rootHash == bytes32(0)) revert InvalidRootHash();
        if (bytes(filename).length == 0) revert EmptyFilename();
        if (registeredRoots[rootHash]) revert RootAlreadyRegistered(rootHash);

        fileId = fileCount++;
        files[fileId] = FileRecord({
            rootHash: rootHash,
            owner: msg.sender,
            timestamp: block.timestamp,
            filename: filename,
            fileSize: fileSize,
            contentType: contentType
        });

        registeredRoots[rootHash] = true;
        ownerFiles[msg.sender].push(fileId);

        emit FileAnchored(fileId, rootHash, msg.sender, filename);
    }

    /**
     * @notice Update file metadata (filename, contentType)
     * @param fileId The file ID to update
     * @param filename New filename
     * @param contentType New content type
     */
    function updateFileMetadata(
        uint256 fileId,
        string calldata filename,
        string calldata contentType
    ) external fileExists(fileId) onlyFileOwner(fileId) {
        files[fileId].filename = filename;
        files[fileId].contentType = contentType;

        emit FileMetadataUpdated(fileId, filename, contentType);
    }

    /**
     * @notice Get a file record
     * @param fileId The file ID
     */
    function getFile(uint256 fileId) external view fileExists(fileId) returns (FileRecord memory) {
        return files[fileId];
    }

    /**
     * @notice Get files owned by an address
     * @param owner The owner address
     * @return fileIds Array of file IDs
     */
    function getFilesByOwner(address owner) external view returns (uint256[] memory) {
        return ownerFiles[owner];
    }

    /**
     * @notice Get file count
     */
    function getFileCount() external view returns (uint256) {
        return fileCount;
    }

    // ============================================================
    // Agent Identity
    // ============================================================

    /**
     * @notice Register a new AI agent identity
     * @param name Agent display name
     * @param description Agent description / purpose
     * @param memoryRoot Merkle root of the agent's initial knowledge base
     * @return agentId The ID of the registered agent
     */
    function registerAgent(
        string calldata name,
        string calldata description,
        bytes32 memoryRoot
    ) external returns (uint256 agentId) {
        if (bytes(name).length == 0) revert EmptyAgentName();

        agentId = agentCount++;
        agents[agentId] = AgentRecord({
            owner: msg.sender,
            name: name,
            description: description,
            memoryRoot: memoryRoot,
            registeredAt: block.timestamp,
            fileCount: 0,
            active: true
        });

        ownerAgents[msg.sender].push(agentId);

        emit AgentRegistered(agentId, msg.sender, name);
    }

    /**
     * @notice Update agent profile
     * @param agentId The agent ID to update
     * @param name New name (pass empty to keep current)
     * @param description New description (pass empty to keep current)
     * @param memoryRoot New memory root
     */
    function updateAgent(
        uint256 agentId,
        string calldata name,
        string calldata description,
        bytes32 memoryRoot
    ) external agentExists(agentId) onlyAgentOwner(agentId) {
        if (!agents[agentId].active) revert AgentNotActive(agentId);

        if (bytes(name).length > 0) {
            agents[agentId].name = name;
        }
        if (bytes(description).length > 0) {
            agents[agentId].description = description;
        }
        agents[agentId].memoryRoot = memoryRoot;

        emit AgentUpdated(agentId, agents[agentId].name, memoryRoot);
    }

    /**
     * @notice Deactivate an agent (soft delete)
     * @param agentId The agent ID to deactivate
     */
    function deactivateAgent(uint256 agentId) external agentExists(agentId) onlyAgentOwner(agentId) {
        agents[agentId].active = false;

        emit AgentDeactivated(agentId);
    }

    /**
     * @notice Get an agent record
     * @param agentId The agent ID
     */
    function getAgent(uint256 agentId) external view agentExists(agentId) returns (AgentRecord memory) {
        return agents[agentId];
    }

    /**
     * @notice Get agents owned by an address
     * @param owner The owner address
     * @return agentIds Array of agent IDs
     */
    function getAgentsByOwner(address owner) external view returns (uint256[] memory) {
        return ownerAgents[owner];
    }

    // ============================================================
    // File-Agent Linking
    // ============================================================

    /**
     * @notice Link a file to an agent's memory
     * @param fileId The file ID to link
     * @param agentId The agent ID to link to
     */
    function linkFileToAgent(
        uint256 fileId,
        uint256 agentId
    ) external fileExists(fileId) agentExists(agentId) onlyFileOwner(fileId) {
        if (!agents[agentId].active) revert AgentNotActive(agentId);
        if (fileLinked[fileId]) revert FileAlreadyLinked(fileId);

        agentFiles[agentId].push(fileId);
        fileAgent[fileId] = agentId;
        fileLinked[fileId] = true;
        agents[agentId].fileCount++;

        emit FileLinkedToAgent(fileId, agentId);
    }

    /**
     * @notice Get files linked to an agent
     * @param agentId The agent ID
     * @return fileIds Array of linked file IDs
     */
    function getAgentFiles(uint256 agentId) external view agentExists(agentId) returns (uint256[] memory) {
        return agentFiles[agentId];
    }

    /**
     * @notice Get the agent a file is linked to (0 if none)
     * @param fileId The file ID
     * @return agentId The linked agent ID
     */
    function getFileAgent(uint256 fileId) external view returns (uint256) {
        return fileAgent[fileId];
    }
}
