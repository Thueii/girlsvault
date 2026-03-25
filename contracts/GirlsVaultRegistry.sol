// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./GirlsVaultProject.sol";

contract GirlsVaultRegistry {

    address public admin;
    address[] public projects;

    event ProjectCreated(
        address indexed projectAddress,
        string name,
        address indexed creator
    );

    modifier onlyAdmin() {
        require(msg.sender == admin, "Not admin");
        _;
    }

    constructor() {
        admin = msg.sender;
    }

    // 创建新公益项目，部署独立合约
    function createProject(
        string memory _name,
        string memory _description,
        address _beneficiary,
        address[] memory _validators,
        uint256 _requiredSignatures,
        uint256 _targetAmount
    ) external returns (address) {
        GirlsVaultProject project = new GirlsVaultProject(
            _name,
            _description,
            _beneficiary,
            _validators,
            _requiredSignatures,
            _targetAmount,
            msg.sender
        );
        projects.push(address(project));
        emit ProjectCreated(address(project), _name, msg.sender);
        return address(project);
    }

    function getProjects() external view returns (address[] memory) {
        return projects;
    }

    function getProjectCount() external view returns (uint256) {
        return projects.length;
    }
}
