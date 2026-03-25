import { ethers } from "ethers";
import deployed from "./deployed.json";

export const REGISTRY_ADDRESS = deployed.registryAddress;

export const REGISTRY_ABI = [
  "function createProject(string,string,address,address[],uint256,uint256) returns (address)",
  "function getProjects() view returns (address[])",
  "function getProjectCount() view returns (uint256)",
];

export const PROJECT_ABI = [
  "function name() view returns (string)",
  "function description() view returns (string)",
  "function beneficiary() view returns (address)",
  "function totalDonated() view returns (uint256)",
  "function totalReleased() view returns (uint256)",
  "function getBalance() view returns (uint256)",
  "function targetAmount() view returns (uint256)",
  "function isFundingComplete() view returns (bool)",
  "function getMilestoneCount() view returns (uint256)",
  "function getMilestoneInfo(uint256) view returns (string desc, uint256 releasePercent, uint8 status, uint256 proofCount)",
  "function getTagBalance(uint8) view returns (uint256)",
  "function donate(uint8) payable",
  "function addMilestone(string,uint256)",
  "function submitProof(uint256,bytes32)",
  "function requiredSignatures() view returns (uint256)",
  "function isValidator(address) view returns (bool)",
  "function hasSubmittedProof(uint256,address) view returns (bool)",
  "event Donated(address indexed donor, uint256 amount, uint8 tag)",
  "event FundsReleased(uint256 indexed milestoneId, address beneficiary, uint256 amount)",
  "event ProofSubmitted(uint256 indexed milestoneId, address indexed validator, bytes32 proofHash)",
];

export const TAGS = ["教育", "餐食", "医疗", "物资", "交通"];

export const TAG_DETAILS = [
  { icon: "📚", name: "教育", desc: "教材、文具、学费补贴" },
  { icon: "🍱", name: "餐食", desc: "每日营养餐、课间加餐" },
  { icon: "🏥", name: "医疗", desc: "基础医疗、卫生用品" },
  { icon: "📦", name: "物资", desc: "校服、书包、生活用品" },
  { icon: "🚌", name: "交通", desc: "上学交通补贴" },
];

export const MILESTONE_STATUS = ["等待验证", "已验证", "已释放"];

export async function getProvider() {
  if (!window.ethereum) throw new Error("请先安装 MetaMask");
  await window.ethereum.request({ method: "eth_requestAccounts" });
  return new ethers.BrowserProvider(window.ethereum);
}
