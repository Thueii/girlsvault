// 一键 setup：部署 Registry + 创建3个演示项目 + 写入前端配置
//
// 本地:  npx hardhat run scripts/setup.js --network localhost
// Fuji:  npx hardhat run scripts/setup.js --network fuji
//
// Fuji 需在 .env 中配置（可选，不填则用部署账户地址）:
//   VALIDATOR_1=0x...
//   VALIDATOR_2=0x...
//   VALIDATOR_3=0x...
//   BENEFICIARY_1=0x...
//   BENEFICIARY_2=0x...
//   BENEFICIARY_3=0x...

const { ethers, network } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function addMilestones(project, milestones) {
  for (const [desc, pct] of milestones) {
    await (await project.addMilestone(desc, pct)).wait();
  }
}

async function main() {
  const [deployer] = await ethers.getSigners();
  const isLocalhost = network.name === "localhost" || network.name === "hardhat";

  console.log(`=== GirlsVault Setup (${network.name}) ===\n`);
  console.log("Deployer:", deployer.address);

  // 地址配置：本地用 Hardhat test accounts，链上用 env 或 deployer
  let validators, bene1, bene2, bene3;

  if (isLocalhost) {
    const signers = await ethers.getSigners();
    const [, b1, b2, b3, vA, vB, vC] = signers;
    validators = [vA.address, vB.address, vC.address];
    bene1 = b1.address;
    bene2 = b2.address;
    bene3 = b3.address;
    console.log("Validators:", validators);
  } else {
    // Fuji / Mainnet：从 env 读取，fallback 到 deployer 自身（仅演示）
    const v1 = process.env.VALIDATOR_1 || deployer.address;
    const v2 = process.env.VALIDATOR_2 || deployer.address;
    const v3 = process.env.VALIDATOR_3 || deployer.address;
    validators = [...new Set([v1, v2, v3])]; // 去重
    bene1 = process.env.BENEFICIARY_1 || deployer.address;
    bene2 = process.env.BENEFICIARY_2 || deployer.address;
    bene3 = process.env.BENEFICIARY_3 || deployer.address;
    console.log("Validators:", validators);
    console.log("⚠️  未配置 VALIDATOR_x / BENEFICIARY_x 时使用 deployer 地址，仅适合演示");
  }

  // 所需签名数：本地 2-of-3，链上只有1个validator时改为 1-of-1
  const reqSigs = Math.min(2, validators.length);

  // 1. 部署 Registry
  console.log("\n[1/4] 部署 GirlsVaultRegistry...");
  const Registry = await ethers.getContractFactory("GirlsVaultRegistry");
  const registry = await Registry.deploy();
  await registry.waitForDeployment();
  const registryAddress = await registry.getAddress();
  console.log("✅ Registry:", registryAddress);

  // 辅助：创建项目 + 里程碑
  async function createProject(name, desc, beneficiary, targetEth, milestones) {
    const tx = await registry.createProject(
      name, desc, beneficiary, validators, reqSigs, ethers.parseEther(targetEth)
    );
    await tx.wait();
    const projects = await registry.getProjects();
    const addr = projects[projects.length - 1];
    const project = await ethers.getContractAt("GirlsVaultProject", addr);
    await addMilestones(project, milestones);
    return addr;
  }

  // 2. 项目一：云南女童教育
  console.log("\n[2/4] 创建「云南女童教育项目」...");
  const p1 = await createProject(
    "云南女童教育项目",
    "为云南偏远地区女童提供餐食与教育资助，覆盖200名在校女童",
    bene1, isLocalhost ? "10" : "0.1",
    [
      ["女童入学注册确认", 3000],
      ["学期中期物资发放确认", 3000],
      ["学期结束出勤确认", 4000],
    ]
  );
  console.log("✅ 项目一:", p1);

  // 3. 项目二：四川助学
  console.log("\n[3/4] 创建「四川山区助学计划」...");
  const p2 = await createProject(
    "四川山区助学计划",
    "资助四川凉山贫困山区儿童的基础教育，提供课本、校服及营养午餐",
    bene2, isLocalhost ? "5" : "0.07",
    [
      ["学生入学资格核实", 4000],
      ["教学物资发放到位", 3000],
      ["期末考核完成确认", 3000],
    ]
  );
  console.log("✅ 项目二:", p2);

  // 4. 项目三：贵州健康
  console.log("\n[4/4] 创建「贵州女童健康守护」...");
  const p3 = await createProject(
    "贵州女童健康守护",
    "为贵州农村女童提供基础医疗检查、卫生用品及健康教育，覆盖3个村庄",
    bene3, isLocalhost ? "8" : "0.05",
    [
      ["体检及健康档案建立", 3000],
      ["卫生用品及药品发放", 4000],
      ["健康知识培训完成", 3000],
    ]
  );
  console.log("✅ 项目三:", p3);

  // 写入前端配置
  const config = {
    registryAddress,
    projectAddress: p1,
    beneficiary: bene1,
    validators,
    network: network.name,
    setupAt: new Date().toISOString(),
  };
  const outPath = path.join(__dirname, "../frontend-app/src/utils/deployed.json");
  fs.writeFileSync(outPath, JSON.stringify(config, null, 2));
  console.log("\n✅ 前端配置已写入:", outPath);
  console.log("\n=== Setup 完成 ===");
  console.log("Registry:", registryAddress);
  if (!isLocalhost) {
    console.log("\n下一步：");
    console.log("1. 前端设置 VITE_RPC_URL=https://api.avax-test.network/ext/bc/C/rpc");
    console.log("2. 部署前端（推荐 Vercel）");
    console.log("3. 在 Vercel 环境变量中配置 VITE_RPC_URL");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
