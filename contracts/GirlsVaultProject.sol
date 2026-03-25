// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract GirlsVaultProject {

    enum Tag { EDUCATION, FOOD, MEDICAL, SUPPLIES, TRANSPORT }
    enum MilestoneStatus { PENDING, VERIFIED, RELEASED }

    struct Milestone {
        string description;
        uint256 releasePercent;
        MilestoneStatus status;
        uint256 proofCount;
        mapping(address => bool) hasProved;
        mapping(address => bytes32) proofs;
    }

    string public name;
    string public description;
    address public beneficiary;
    address public projectOwner;
    uint256 public requiredSignatures;
    uint256 public targetAmount;   // 募集目标金额
    uint256 public totalDonated;
    uint256 public totalReleased;

    mapping(address => bool) public isValidator;
    mapping(Tag => uint256) public tagBalances;
    Milestone[] public milestones;

    event Donated(address indexed donor, uint256 amount, Tag tag);
    event MilestoneAdded(uint256 indexed milestoneId, string description, uint256 releasePercent);
    event ProofSubmitted(uint256 indexed milestoneId, address indexed validator, bytes32 proofHash);
    event MilestoneVerified(uint256 indexed milestoneId);
    event FundsReleased(uint256 indexed milestoneId, address beneficiary, uint256 amount);

    modifier onlyValidator() {
        require(isValidator[msg.sender], "Not a validator");
        _;
    }

    modifier onlyOwner() {
        require(msg.sender == projectOwner, "Not owner");
        _;
    }

    constructor(
        string memory _name,
        string memory _description,
        address _beneficiary,
        address[] memory _validators,
        uint256 _requiredSignatures,
        uint256 _targetAmount,
        address _projectOwner
    ) {
        require(_beneficiary != address(0), "Invalid beneficiary");
        require(_validators.length >= _requiredSignatures, "Not enough validators");
        require(_requiredSignatures > 0, "Required signatures must > 0");
        require(_targetAmount > 0, "Target amount must > 0");

        name = _name;
        description = _description;
        beneficiary = _beneficiary;
        requiredSignatures = _requiredSignatures;
        targetAmount = _targetAmount;
        projectOwner = _projectOwner;

        for (uint256 i = 0; i < _validators.length; i++) {
            isValidator[_validators[i]] = true;
        }
    }

    function addMilestone(string memory _description, uint256 _releasePercent) external onlyOwner {
        uint256 id = milestones.length;
        milestones.push();
        Milestone storage m = milestones[id];
        m.description = _description;
        m.releasePercent = _releasePercent;
        m.status = MilestoneStatus.PENDING;
        emit MilestoneAdded(id, _description, _releasePercent);
    }

    function donate(Tag _tag) external payable {
        require(msg.value > 0, "Amount must > 0");
        require(totalDonated + msg.value <= targetAmount, "Exceeds target amount");
        tagBalances[_tag] += msg.value;
        totalDonated += msg.value;
        emit Donated(msg.sender, msg.value, _tag);
    }

    function submitProof(uint256 _milestoneId, bytes32 _proofHash) external onlyValidator {
        require(_milestoneId < milestones.length, "Invalid milestone");
        Milestone storage m = milestones[_milestoneId];
        require(m.status == MilestoneStatus.PENDING, "Not pending");
        require(!m.hasProved[msg.sender], "Already submitted");
        uint256 cumulativePercent = 0;
        for (uint256 i = 0; i <= _milestoneId; i++) {
            cumulativePercent += milestones[i].releasePercent;
        }
        require(totalDonated >= (targetAmount * cumulativePercent) / 10000, "Funding insufficient for milestone");

        m.hasProved[msg.sender] = true;
        m.proofs[msg.sender] = _proofHash;
        m.proofCount++;

        emit ProofSubmitted(_milestoneId, msg.sender, _proofHash);

        if (m.proofCount >= requiredSignatures) {
            m.status = MilestoneStatus.VERIFIED;
            emit MilestoneVerified(_milestoneId);
            _releaseFunds(_milestoneId);
        }
    }

    function _releaseFunds(uint256 _milestoneId) internal {
        Milestone storage m = milestones[_milestoneId];
        require(m.status == MilestoneStatus.VERIFIED, "Not verified");

        uint256 amount = (targetAmount * m.releasePercent) / 10000;
        require(address(this).balance >= amount, "Insufficient balance");

        m.status = MilestoneStatus.RELEASED;
        totalReleased += amount;

        (bool success, ) = beneficiary.call{value: amount}("");
        require(success, "Transfer failed");

        emit FundsReleased(_milestoneId, beneficiary, amount);
    }

    function getMilestoneCount() external view returns (uint256) { return milestones.length; }
    function getTagBalance(Tag _tag) external view returns (uint256) { return tagBalances[_tag]; }
    function getBalance() external view returns (uint256) { return address(this).balance; }
    function isFundingComplete() external view returns (bool) { return totalDonated >= targetAmount; }
    function hasSubmittedProof(uint256 _milestoneId, address _validator) external view returns (bool) {
        require(_milestoneId < milestones.length, "Invalid milestone");
        return milestones[_milestoneId].hasProved[_validator];
    }

    function getMilestoneInfo(uint256 _milestoneId) external view returns (
        string memory desc, uint256 releasePercent, MilestoneStatus status, uint256 proofCount
    ) {
        require(_milestoneId < milestones.length, "Invalid milestone");
        Milestone storage m = milestones[_milestoneId];
        return (m.description, m.releasePercent, m.status, m.proofCount);
    }

    receive() external payable {}
}
