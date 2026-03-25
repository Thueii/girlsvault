import { useState, useCallback, useEffect, useRef } from "react";
import { ethers } from "ethers";
import {
  REGISTRY_ADDRESS, REGISTRY_ABI, PROJECT_ABI,
  TAGS, TAG_DETAILS, MILESTONE_STATUS, getProvider,
} from "../utils/contracts";

const RPC_URL = import.meta.env.VITE_RPC_URL || "http://127.0.0.1:8545";
const READ_PROVIDER = new ethers.JsonRpcProvider(RPC_URL);

// 从链上读取一个项目的完整信息（用于 allProjects 列表）
async function fetchProjectSummary(addr, provider) {
  const p = new ethers.Contract(addr, PROJECT_ABI, provider);
  const [name, desc, totalDonated, targetAmount, milestoneCount] = await Promise.all([
    p.name(), p.description(), p.totalDonated(), p.targetAmount(), p.getMilestoneCount(),
  ]);
  const msInfos = [];
  for (let i = 0; i < Number(milestoneCount); i++) {
    const info = await p.getMilestoneInfo(i);
    msInfos.push({ id: i, desc: info.desc, status: Number(info.status) });
  }
  const td = ethers.formatEther(totalDonated);
  const ta = ethers.formatEther(targetAmount);
  const progress = Number(totalDonated) / Number(targetAmount) * 100;
  const isCompleted = progress >= 100 && msInfos.length > 0 && msInfos.every(m => m.status === 2);
  return { address: addr, name, description: desc, totalDonated: td, targetAmount: ta, progress, milestones: msInfos, isCompleted };
}

export default function DemoPage({ onBack }) {
  const [account, setAccount] = useState("");
  const [signer, setSigner] = useState(null);
  const [isValidator, setIsValidator] = useState(false);
  const [allProjects, setAllProjects] = useState([]);
  const [projectAddress, setProjectAddress] = useState("");
  const [project, setProject] = useState(null);
  const [projectName, setProjectName] = useState("");
  const [projectDesc, setProjectDescState] = useState("");
  const [status, setStatus] = useState({});
  const [milestones, setMilestones] = useState([]);
  const [tagBalances, setTagBalances] = useState([]);
  const [loading, setLoading] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [requiredSigsOnChain, setRequiredSigsOnChain] = useState(2);
  const [beneficiaryAddr2, setBeneficiaryAddr2] = useState("");
  const [myProofs, setMyProofs] = useState({});
  const [log, setLog] = useState([]);
  const [toast, setToast] = useState(null);

  // Admin 浮窗
  const [adminOpen, setAdminOpen] = useState(false);
  const [adminTab, setAdminTab] = useState("create");
  const [step1Done, setStep1Done] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [beneficiaryAddr, setBeneficiaryAddr] = useState("");
  const [validatorAddrs, setValidatorAddrs] = useState("");
  const [requiredSigs, setRequiredSigs] = useState(2);
  const [targetAmountEth, setTargetAmountEth] = useState("");
  const [milestoneForm, setMilestoneForm] = useState([
    { desc: "女童入学注册确认", percent: 30 },
    { desc: "学期中期物资发放确认", percent: 30 },
    { desc: "学期结束出勤确认", percent: 40 },
  ]);

  const [donateTag, setDonateTag] = useState(1);
  const [donateAmount, setDonateAmount] = useState("0.5");
  const [proofMilestone, setProofMilestone] = useState(0);
  const [proofText, setProofText] = useState("ipfs://QmProof_registration_doc");

  const showToast = (msg, type = "error") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  const addLog = (msg) => setLog((prev) => [...prev, { msg, time: new Date().toLocaleTimeString() }]);

  useEffect(() => { loadProjectsReadOnly(); }, []);

  const loadProjectsReadOnly = async () => {
    try {
      const reg = new ethers.Contract(REGISTRY_ADDRESS, REGISTRY_ABI, READ_PROVIDER);
      const projects = await reg.getProjects();
      const list = await Promise.all(projects.map(addr => fetchProjectSummary(addr, READ_PROVIDER)));
      setAllProjects(list);
      if (list.length > 0) await loadProject(list[0].address, null);
    } catch (e) {}
  };

  const connectWallet = async () => {
    try {
      const provider = await getProvider();
      const s = await provider.getSigner();
      const addr = await s.getAddress();
      setSigner(s);
      setAccount(addr);
      setBeneficiaryAddr(addr);

      const reg = new ethers.Contract(REGISTRY_ADDRESS, REGISTRY_ABI, s);
      const projects = await reg.getProjects();
      const list = await Promise.all(projects.map(a => fetchProjectSummary(a, s)));
      setAllProjects(list);

      if (list.length > 0) {
        await loadProject(list[0].address, s);
      } else {
        showToast("暂无项目，请点击左下角「项目发起」创建", "info");
        setAdminOpen(true);
      }
    } catch (e) {
      showToast(e.message);
    }
  };

  const disconnectWallet = () => {
    setAccount(""); setSigner(null); setIsValidator(false);
    setStep1Done(false); setMyProofs({});
    addLog("已断开钱包连接");
    loadProjectsReadOnly();
  };

  const loadProject = async (addr, s) => {
    const provider = s || READ_PROVIDER;
    const proj = new ethers.Contract(addr, PROJECT_ABI, provider);
    setProjectAddress(addr);
    setProject(proj);
    const [name, desc, bene, reqSigs] = await Promise.all([
      proj.name(), proj.description(), proj.beneficiary(), proj.requiredSignatures(),
    ]);
    setProjectName(name);
    setProjectDescState(desc);
    setBeneficiaryAddr2(bene);
    setRequiredSigsOnChain(Number(reqSigs));
    await refreshStatus(proj);
    if (s) {
      const userAddr = await s.getAddress();
      const validatorCheck = await proj.isValidator(userAddr);
      setIsValidator(validatorCheck);
      await fetchMyProofs(proj, userAddr);
    }
  };

  const refreshStatus = useCallback(async (proj) => {
    if (!proj) return;
    try {
      const [totalDonated, totalReleased, balance, milestoneCount, target] = await Promise.all([
        proj.totalDonated(), proj.totalReleased(), proj.getBalance(),
        proj.getMilestoneCount(), proj.targetAmount(),
      ]);
      setStatus({
        totalDonated: ethers.formatEther(totalDonated),
        totalReleased: ethers.formatEther(totalReleased),
        balance: ethers.formatEther(balance),
        targetAmount: ethers.formatEther(target),
        progress: Number(totalDonated) / Number(target) * 100,
      });
      const ms = [];
      for (let i = 0; i < Number(milestoneCount); i++) {
        const info = await proj.getMilestoneInfo(i);
        ms.push({ id: i, desc: info.desc, releasePercent: Number(info.releasePercent) / 100, status: Number(info.status), proofCount: Number(info.proofCount) });
      }
      setMilestones(ms);
      const tagBals = await Promise.all(TAGS.map((_, i) => proj.getTagBalance(i)));
      setTagBalances(tagBals.map((b) => ethers.formatEther(b)));
    } catch (e) {}
  }, []);

  const fetchMyProofs = async (proj, userAddr) => {
    if (!proj || !userAddr) return;
    try {
      const count = await proj.getMilestoneCount();
      const results = await Promise.all(
        Array.from({ length: Number(count) }, (_, i) => proj.hasSubmittedProof(i, userAddr))
      );
      const map = {};
      results.forEach((submitted, i) => { map[i] = submitted; });
      setMyProofs(map);
    } catch (e) {}
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await refreshStatus(project);
    if (account && project) await fetchMyProofs(project, account);
    setTimeout(() => setRefreshing(false), 800);
  };

  const totalPercent = milestoneForm.reduce((sum, m) => sum + Number(m.percent), 0);

  const createProject = async () => {
    if (!signer) return showToast("请先连接 MetaMask 钱包");
    const rawAddrs = validatorAddrs.split("\n").map((a) => a.trim()).filter(Boolean);
    const validators = [...new Set(rawAddrs)].filter((a) => ethers.isAddress(a));
    const invalid = rawAddrs.filter((a) => a && !ethers.isAddress(a));
    if (invalid.length > 0) return showToast(`无效地址：${invalid[0]}`);
    if (validators.length === 0) return showToast("请填入至少一个有效的志愿者地址");
    if (requiredSigs > validators.length) return showToast("最少验证人数不能超过志愿者总数");
    if (!targetAmountEth || Number(targetAmountEth) <= 0) return showToast("请填入有效的目标金额");

    setLoading("create");
    try {
      const reg = new ethers.Contract(REGISTRY_ADDRESS, REGISTRY_ABI, signer);
      const tx = await reg.createProject(newName, newDesc, beneficiaryAddr, validators, requiredSigs, ethers.parseEther(targetAmountEth));
      await tx.wait();
      const projects = await reg.getProjects();
      const newAddr = projects[projects.length - 1];
      const summary = await fetchProjectSummary(newAddr, signer);
      setAllProjects((prev) => [...prev, summary]);
      await loadProject(newAddr, signer);
      addLog(`✅ 项目「${summary.name}」创建成功，目标金额 ${targetAmountEth} AVAX`);
      setStep1Done(true);
      setAdminTab("milestone");
    } catch (e) {
      if ((e.code === 4001 || (e.message || "").includes("ACTION_REJECTED"))) return setLoading("");
      showToast(e.message);
    }
    setLoading("");
  };

  const addMilestones = async () => {
    if (!project || !signer) return showToast("请先创建项目");
    if (totalPercent !== 100) return showToast(`释放比例合计必须等于 100%，当前 ${totalPercent}%`);
    const empty = milestoneForm.filter((m) => !m.desc.trim());
    if (empty.length > 0) return showToast("里程碑描述不能为空");
    const existingCount = Number(await project.getMilestoneCount());
    if (existingCount > 0) return showToast("该项目里程碑已添加，链上数据不可修改");

    setLoading("milestone");
    try {
      const proj = new ethers.Contract(projectAddress, PROJECT_ABI, signer);
      for (const m of milestoneForm) {
        const tx = await proj.addMilestone(m.desc, Math.round(m.percent * 100));
        await tx.wait();
      }
      addLog(`✅ 里程碑配置完成（${milestoneForm.map(m => m.percent + "%").join(" / ")}）`);
      await refreshStatus(proj);
      setAdminOpen(false);
    } catch (e) {
      if ((e.code === 4001 || (e.message || "").includes("ACTION_REJECTED"))) return setLoading("");
      showToast(e.message);
    }
    setLoading("");
  };

  const donate = async () => {
    if (!signer) return showToast("请先连接 MetaMask 钱包后再捐款");
    if (status.progress >= 100) return showToast("该项目已达到募集目标，感谢您的关注！");
    setLoading("donate");
    try {
      const proj = new ethers.Contract(projectAddress, PROJECT_ABI, signer);
      const tx = await proj.donate(donateTag, { value: ethers.parseEther(donateAmount) });
      await tx.wait();
      addLog(`✅ 感谢您的爱心！${donateAmount} AVAX 已锁入合约，专项用于${TAG_DETAILS[donateTag].desc}`);
      await refreshStatus(new ethers.Contract(projectAddress, PROJECT_ABI, signer));
    } catch (e) {
      if ((e.code === 4001 || (e.message || "").includes("ACTION_REJECTED"))) return setLoading("");
      showToast(e.message.includes("Exceeds target") ? "捐款金额超出剩余目标，请减少金额" : e.message);
    }
    setLoading("");
  };

  const submitProof = async () => {
    if (!signer) return showToast("请先连接 MetaMask 钱包");
    setLoading("proof");
    try {
      const proofHash = ethers.keccak256(ethers.toUtf8Bytes(proofText));
      const proj = new ethers.Contract(projectAddress, PROJECT_ABI, signer);
      const tx = await proj.submitProof(proofMilestone, proofHash);
      await tx.wait();
      const info = await proj.getMilestoneInfo(proofMilestone);
      if (Number(info.status) === 2) {
        addLog(`🎉 M${proofMilestone} 验证完成！资金已自动释放至受益方，链上记录永久保存`);
      } else {
        addLog(`✅ M${proofMilestone} 验证已上链，感谢实地见证！当前 ${Number(info.proofCount)} / ${requiredSigsOnChain} 签名`);
      }
      await refreshStatus(new ethers.Contract(projectAddress, PROJECT_ABI, signer));
      await fetchMyProofs(new ethers.Contract(projectAddress, PROJECT_ABI, signer), account);
    } catch (e) {
      const msg = e.message || "";
      if (e.code === 4001 || msg.includes("ACTION_REJECTED")) { setLoading(""); return; }
      showToast(
        msg.includes("Not a validator") ? "您的账户不在志愿者名单中" :
        msg.includes("Already submitted") ? "您已提交过此里程碑的验证，无法重复提交" :
        msg.includes("Not pending") ? "该里程碑已完成验证，无需再次提交" :
        msg.includes("Funding insufficient") ? "当前募集进度不足，该里程碑暂未达到可验证条件" :
        "提交失败，请稍后重试"
      );
    }
    setLoading("");
  };

  const fundingDone = status.progress >= 100;
  const inProgress = allProjects.filter(p => !p.isCompleted);
  const completed = allProjects.filter(p => p.isCompleted);

  // 当前选中里程碑的状态
  const selectedMilestone = milestones.find(m => m.id === proofMilestone);
  const alreadySubmitted = myProofs[proofMilestone] || false;
  const milestoneNotPending = selectedMilestone && selectedMilestone.status !== 0;
  // 募集门槛：累计到当前里程碑的释放比例之和
  const cumulativePct = milestones
    .filter(m => m.id <= proofMilestone)
    .reduce((sum, m) => sum + m.releasePercent, 0);
  const requiredFunding = Number(status.targetAmount || 0) * cumulativePct / 100;
  const fundingMetForMilestone = Number(status.totalDonated || 0) >= requiredFunding;

  return (
    <div style={s.page}>
      {toast && (
        <div style={{ ...s.toast, background: toast.type === "info" ? "#1d4ed8" : "#dc2626" }}>
          {toast.type === "info" ? "ℹ️" : "⚠️"} {toast.msg}
        </div>
      )}

      {/* 顶栏 */}
      <div style={s.topbar}>
        <button style={s.backBtn} onClick={onBack}>← 返回介绍</button>
        <div style={s.topTitle}>GirlsVault · 链上演示</div>
        {account && (
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={s.account}>{account.slice(0, 6)}...{account.slice(-4)}</div>
            <button style={s.switchBtn} onClick={disconnectWallet}>切换账户</button>
          </div>
        )}
      </div>

      {/* ===== 未登录：欢迎页 ===== */}
      {!account && (
        <div style={s.welcomeWrap}>
          <div style={s.hero}>
            <div style={s.heroTag}>区块链公益平台</div>
            <div style={s.heroTitle}>让每一笔善款都看得见</div>
            <div style={s.heroSub}>透明 · 可追溯 · 无中间人 · 里程碑式资金释放</div>
            <button style={s.heroBtn} onClick={connectWallet}>连接钱包参与</button>
          </div>

          {inProgress.length > 0 && (
            <div style={s.welcomeSection}>
              <div style={s.welcomeSectionTitle}>🌱 正在进行的项目</div>
              <AutoScrollRow items={inProgress} renderItem={(p, i) => <WelcomeCard key={i} p={p} />} />
            </div>
          )}

          {completed.length > 0 && (
            <div style={s.welcomeSection}>
              <div style={{ ...s.welcomeSectionTitle, color: "#6b7280" }}>✅ 已完成的项目</div>
              <AutoScrollRow items={completed} renderItem={(p, i) => <WelcomeCard key={i} p={p} done />} />
            </div>
          )}

          {allProjects.length === 0 && (
            <div style={{ textAlign: "center", color: "#4b5563", padding: "60px 0" }}>
              暂无项目数据，请先启动 Hardhat 节点并运行 setup.js
            </div>
          )}
        </div>
      )}

      {/* ===== 已登录：操作看板 ===== */}
      {account && (
        <div style={s.body}>
          {/* 项目切换 */}
          {allProjects.length > 1 && (
            <div style={s.projectSwitcher}>
              {inProgress.length > 0 && (
                <>
                  <span style={{ color: "#9ca3af", fontSize: 13, marginRight: 4 }}>进行中：</span>
                  {inProgress.map((p) => (
                    <button key={p.address}
                      style={{ ...s.projectBtn, ...(p.address === projectAddress ? s.projectBtnActive : {}) }}
                      onClick={() => loadProject(p.address, signer)}>{p.name}</button>
                  ))}
                </>
              )}
              {completed.length > 0 && (
                <>
                  <span style={{ color: "#4b5563", fontSize: 13, marginLeft: 8, marginRight: 4 }}>已完成：</span>
                  {completed.map((p) => (
                    <button key={p.address}
                      style={{ ...s.projectBtn, ...(p.address === projectAddress ? s.projectBtnActive : {}), opacity: 0.6 }}
                      onClick={() => loadProject(p.address, signer)}>{p.name}</button>
                  ))}
                </>
              )}
            </div>
          )}

          <div style={s.grid}>
            {/* 左列 */}
            <div style={s.col}>
              <div style={s.card}>
                <div style={s.cardTitle}>📊 资金状态看板</div>
                {projectAddress && (
                  <>
                    <div style={{ fontSize: 15, fontWeight: 700, color: "#e5e7eb", marginBottom: 4 }}>{projectName}</div>
                    {projectDesc && <div style={{ fontSize: 13, color: "#9ca3af", marginBottom: 8 }}>{projectDesc}</div>}
                    <div style={{ fontSize: 11, color: "#4b5563", marginBottom: 10, fontFamily: "monospace" }}>{projectAddress.slice(0, 10)}...{projectAddress.slice(-6)}</div>
                    {beneficiaryAddr2 && (
                      <div style={{ background: "#0f0f1a", border: "1px solid #2d2d3d", borderRadius: 8, padding: "8px 12px", marginBottom: 14 }}>
                        <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 4 }}>受益方地址</div>
                        <div style={{ fontSize: 12, color: "#34d399", fontFamily: "monospace" }}>
                          {beneficiaryAddr2.slice(0, 8)}...{beneficiaryAddr2.slice(-6)}
                        </div>
                      </div>
                    )}
                  </>
                )}

                {status.targetAmount && (
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 6 }}>
                      <span style={{ color: "#9ca3af" }}>募集进度</span>
                      <span style={{ color: fundingDone ? "#10b981" : "#c4b5fd", fontWeight: 700 }}>
                        {Number(status.totalDonated).toFixed(3)} / {Number(status.targetAmount).toFixed(1)} AVAX
                        {fundingDone && " ✓ 已达标"}
                      </span>
                    </div>
                    <div style={s.progressBg}>
                      <div style={{ ...s.progressFill, width: `${Math.min(status.progress || 0, 100)}%` }} />
                    </div>
                    <div style={{ textAlign: "right", fontSize: 12, color: "#6b7280", marginTop: 4 }}>
                      {Math.min(Math.round(status.progress || 0), 100)}%
                    </div>
                  </div>
                )}

                <div style={s.statRow}>
                  <StatBox label="总捐款" value={status.totalDonated || "0"} color="#8b5cf6" />
                  <StatBox label="已释放" value={status.totalReleased || "0"} color="#10b981" />
                  <StatBox label="锁仓中" value={status.balance || "0"} color="#f59e0b" />
                </div>

                {tagBalances.some((b) => Number(b) > 0) && (
                  <div style={{ borderTop: "1px solid #2d2d3d", paddingTop: 12, marginTop: 8 }}>
                    <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 8 }}>专项资金分布</div>
                    {TAG_DETAILS.map((t, i) => Number(tagBalances[i]) > 0 && (
                      <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 4 }}>
                        <span style={{ color: "#9ca3af" }}>{t.icon} {t.name}</span>
                        <span style={{ color: "#c4b5fd" }}>{Number(tagBalances[i]).toFixed(3)} AVAX</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div style={s.card}>
                <div style={s.cardTitle}>🏁 里程碑进度</div>
                {milestones.length === 0 ? (
                  <div style={s.empty}>加载里程碑数据中...</div>
                ) : milestones.map((m) => (
                  <div key={m.id} style={s.mRow}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={s.mId}>M{m.id}</div>
                      <div>
                        <div style={{ fontSize: 14, color: "#e5e7eb", marginBottom: 3 }}>{m.desc}</div>
                        <div style={{ fontSize: 12, color: "#6b7280" }}>释放 {m.releasePercent}% · 验证 {m.proofCount}/{requiredSigsOnChain}</div>
                      </div>
                    </div>
                    <div style={{ ...s.badge, background: ["#1f2937", "#1d4ed8", "#065f46"][m.status] }}>
                      {MILESTONE_STATUS[m.status]}
                    </div>
                  </div>
                ))}
                <button style={{ ...s.refreshBtn, opacity: refreshing ? 0.6 : 1 }} onClick={handleRefresh} disabled={refreshing}>
                  {refreshing ? "刷新中..." : "刷新状态"}
                </button>
              </div>
            </div>

            {/* 右列 */}
            <div style={s.col}>
              <div style={s.card}>
                <div style={s.cardTitle}>
                  💰 捐款（Donor）
                  {fundingDone && <span style={{ marginLeft: 8, fontSize: 12, color: "#10b981" }}>募集已完成</span>}
                </div>
                <label style={s.label}>选择用途标签（专款专用）</label>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 14 }}>
                  {TAG_DETAILS.map((t, i) => (
                    <button key={i} style={{ ...s.tagCard, ...(donateTag === i ? s.tagCardActive : {}), opacity: fundingDone ? 0.5 : 1 }}
                      onClick={() => !fundingDone && setDonateTag(i)}>
                      <div style={{ fontSize: 20, marginBottom: 4 }}>{t.icon}</div>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{t.name}</div>
                      <div style={{ fontSize: 11, color: donateTag === i ? "#c4b5fd" : "#6b7280", marginTop: 2 }}>{t.desc}</div>
                    </button>
                  ))}
                </div>
                <label style={s.label}>捐款金额（AVAX）</label>
                <input style={s.input} type="number" value={donateAmount} step="0.1" min="0.01"
                  onChange={(e) => setDonateAmount(e.target.value)} disabled={fundingDone} />
                <button style={{ ...s.btn, background: fundingDone ? "#374151" : "#8b5cf6", opacity: loading === "donate" ? 0.6 : 1 }}
                  onClick={donate} disabled={loading === "donate" || fundingDone}>
                  {loading === "donate" ? "处理中..." : fundingDone ? "募集已完成" : `捐款给${TAG_DETAILS[donateTag].name}专项`}
                </button>
              </div>

              {/* 验证面板（仅 validator 显示） */}
              {account && isValidator && (
                <div style={s.card}>
                  <div style={s.cardTitle}>🔍 提交验证（Validator）</div>
                  <label style={s.label}>选择里程碑</label>
                  <select style={s.input} value={proofMilestone} onChange={(e) => setProofMilestone(Number(e.target.value))}>
                    {milestones.map((m) => (
                      <option key={m.id} value={m.id}>
                        M{m.id} - {m.desc}
                        {m.status !== 0 ? "（已完成）" : myProofs[m.id] ? "（已提交）" : ""}
                      </option>
                    ))}
                  </select>
                  <label style={s.label}>证明文件链接（将被哈希后上链）</label>
                  <input style={s.input} value={proofText} onChange={(e) => setProofText(e.target.value)} placeholder="ipfs://Qm..." />
                  {alreadySubmitted ? (
                    <button style={{ ...s.btn, background: "#1f2937", color: "#6b7280", cursor: "not-allowed" }} disabled>
                      ✓ 已提交此里程碑的验证
                    </button>
                  ) : milestoneNotPending ? (
                    <button style={{ ...s.btn, background: "#1f2937", color: "#6b7280", cursor: "not-allowed" }} disabled>
                      该里程碑已{selectedMilestone?.status === 2 ? "释放" : "完成验证"}
                    </button>
                  ) : !fundingMetForMilestone ? (
                    <button style={{ ...s.btn, background: "#1f2937", color: "#6b7280", cursor: "not-allowed" }} disabled>
                      募集未达标（需 {requiredFunding.toFixed(2)} AVAX，当前 {Number(status.totalDonated || 0).toFixed(2)} AVAX）
                    </button>
                  ) : (
                    <button style={{ ...s.btn, background: "#059669", opacity: loading === "proof" ? 0.6 : 1 }}
                      onClick={submitProof} disabled={loading === "proof"}>
                      {loading === "proof" ? "提交中..." : "提交验证"}
                    </button>
                  )}
                </div>
              )}

              <div style={s.card}>
                <div style={s.cardTitle}>📜 操作记录</div>
                <div style={s.logBox}>
                  {log.length === 0 ? <div style={s.empty}>成功的操作记录将显示在此</div> : (
                    [...log].reverse().map((l, i) => (
                      <div key={i} style={{ fontSize: 13, lineHeight: 1.6, color: "#34d399" }}>
                        <span style={{ color: "#4b5563", marginRight: 8, fontSize: 11 }}>{l.time}</span>{l.msg}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 项目发起浮动按钮 */}
      <div style={s.fab} onClick={() => account ? setAdminOpen(true) : showToast("请先连接 MetaMask 钱包")}
        onMouseEnter={(e) => { e.currentTarget.style.transform = "scale(1.08)"; e.currentTarget.style.boxShadow = "0 0 24px rgba(139,92,246,0.6)"; }}
        onMouseLeave={(e) => { e.currentTarget.style.transform = "scale(1)"; e.currentTarget.style.boxShadow = "0 4px 20px rgba(139,92,246,0.3)"; }}>
        🚀 <span style={{ fontSize: 13, fontWeight: 600 }}>项目发起</span>
      </div>

      {/* 项目发起弹窗 */}
      {adminOpen && (
        <div style={s.modalOverlay} onClick={() => setAdminOpen(false)}>
          <div style={s.modal} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <div style={{ fontWeight: 700, fontSize: 18 }}>🚀 项目发起</div>
              <button style={{ background: "transparent", border: "none", color: "#9ca3af", fontSize: 20, cursor: "pointer" }} onClick={() => setAdminOpen(false)}>✕</button>
            </div>

            <div style={s.tabRow}>
              <button style={{ ...s.tab, ...(adminTab === "create" ? s.tabActive : {}) }} onClick={() => setAdminTab("create")}>
                {step1Done ? "✅" : "①"} 创建项目
              </button>
              <button style={{ ...s.tab, ...(adminTab === "milestone" ? s.tabActive : {}), opacity: step1Done ? 1 : 0.4, cursor: step1Done ? "pointer" : "not-allowed" }}
                onClick={() => step1Done && setAdminTab("milestone")}>
                ② 添加里程碑
              </button>
            </div>

            {adminTab === "create" && (
              <div style={s.formGrid}>
                <div>
                  <label style={s.label}>项目名称</label>
                  <input style={s.input} value={newName} placeholder="例：云南女童教育项目" onChange={(e) => setNewName(e.target.value)} />
                  <label style={s.label}>项目描述</label>
                  <input style={s.input} value={newDesc} placeholder="简要描述项目内容和目标" onChange={(e) => setNewDesc(e.target.value)} />
                  <label style={s.label}>受益方地址</label>
                  <input style={s.input} value={beneficiaryAddr} onChange={(e) => setBeneficiaryAddr(e.target.value)} placeholder="0x..." />
                  <label style={s.label}>募集目标金额（AVAX）</label>
                  <input style={s.input} type="number" value={targetAmountEth} min="0.01" step="0.1" placeholder="例：2.0" onChange={(e) => setTargetAmountEth(e.target.value)} />
                </div>
                <div>
                  <label style={s.label}>志愿者地址（每行一个）</label>
                  <textarea style={{ ...s.input, height: 90, resize: "vertical" }} value={validatorAddrs} onChange={(e) => setValidatorAddrs(e.target.value)} placeholder={"0xValidator1...\n0xValidator2...\n0xValidator3..."} />
                  <label style={s.label}>最少验证人数（M-of-N）</label>
                  <input style={s.input} type="number" value={requiredSigs} min={1} onChange={(e) => setRequiredSigs(Number(e.target.value))} />
                  <button style={{ ...s.btn, background: "#7c3aed", opacity: loading === "create" ? 0.6 : 1 }} onClick={createProject} disabled={loading === "create"}>
                    {loading === "create" ? "创建中..." : "部署项目合约"}
                  </button>
                </div>
              </div>
            )}

            {adminTab === "milestone" && (
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                  <span style={{ color: "#9ca3af", fontSize: 14 }}>
                    配置里程碑
                    <span style={{ marginLeft: 10, color: totalPercent === 100 ? "#10b981" : "#f87171", fontWeight: 700 }}>
                      合计 {totalPercent}% {totalPercent === 100 ? "✓" : "（需等于 100%）"}
                    </span>
                  </span>
                  <button style={s.addRowBtn} onClick={() => setMilestoneForm((p) => [...p, { desc: "", percent: 0 }])}>+ 添加</button>
                </div>
                {milestoneForm.map((m, i) => (
                  <div key={i} style={s.mFormRow}>
                    <div style={s.mIdBadge}>M{i}</div>
                    <input style={{ ...s.input, flex: 1, marginBottom: 0 }} value={m.desc} onChange={(e) => setMilestoneForm((p) => p.map((x, j) => j === i ? { ...x, desc: e.target.value } : x))} placeholder="里程碑描述" />
                    <input style={{ ...s.input, width: 65, marginBottom: 0, textAlign: "center" }} type="number" value={m.percent} min={0} max={100} onChange={(e) => setMilestoneForm((p) => p.map((x, j) => j === i ? { ...x, percent: Number(e.target.value) } : x))} />
                    <span style={{ color: "#9ca3af", fontSize: 13 }}>%</span>
                    {milestoneForm.length > 1 && <button style={s.removeBtn} onClick={() => setMilestoneForm((p) => p.filter((_, j) => j !== i))}>✕</button>}
                  </div>
                ))}
                <p style={{ color: "#f59e0b", fontSize: 13, margin: "12px 0 8px" }}>⚠️ 里程碑上链后不可修改</p>
                <button style={{ ...s.btn, background: "#059669", opacity: (loading === "milestone" || totalPercent !== 100) ? 0.6 : 1 }}
                  onClick={addMilestones} disabled={loading === "milestone" || totalPercent !== 100}>
                  {loading === "milestone" ? "上链中..." : "确认并上链里程碑"}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function AutoScrollRow({ items, renderItem }) {
  const ref = useRef(null);
  const paused = useRef(false);
  const pos = useRef(0);

  useEffect(() => {
    const el = ref.current;
    if (!el || items.length === 0) return;
    // 项目少时三份保证能无缝循环
    const copies = items.length < 4 ? 3 : 2;
    pos.current = 0;
    let id;
    const tick = () => {
      if (!paused.current) {
        pos.current += 0.5;
        const unit = el.scrollWidth / copies;
        if (pos.current >= unit) pos.current -= unit;
        el.scrollLeft = pos.current;
      }
      id = requestAnimationFrame(tick);
    };
    id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  }, [items.length]);

  const copies = items.length < 4 ? 3 : 2;
  const repeated = Array.from({ length: copies }, (_, ci) =>
    items.map((item, i) => renderItem(item, `${ci}-${i}`))
  );

  return (
    <div
      ref={ref}
      style={{ display: "flex", gap: 16, overflow: "hidden", paddingBottom: 12 }}
      onMouseEnter={() => { paused.current = true; }}
      onMouseLeave={() => { paused.current = false; }}
    >
      {repeated}
    </div>
  );
}

function WelcomeCard({ p, done }) {
  return (
    <div style={{ ...s.welcomeCard, opacity: done ? 0.7 : 1 }}>
      {done && <div style={s.doneBadge}>已完成</div>}
      <div style={{ fontSize: 15, fontWeight: 700, color: "#e5e7eb", marginBottom: 6 }}>{p.name}</div>
      <div style={{ fontSize: 12, color: "#9ca3af", marginBottom: 14, lineHeight: 1.6, minHeight: 36 }}>{p.description}</div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 5 }}>
        <span style={{ color: "#9ca3af" }}>募集进度</span>
        <span style={{ color: done ? "#10b981" : "#c4b5fd" }}>{Number(p.totalDonated).toFixed(2)} / {Number(p.targetAmount).toFixed(1)} AVAX</span>
      </div>
      <div style={s.progressBg}>
        <div style={{ ...s.progressFill, width: `${Math.min(p.progress, 100)}%` }} />
      </div>
      <div style={{ textAlign: "right", fontSize: 11, color: "#6b7280", marginTop: 3, marginBottom: 14 }}>{Math.min(Math.round(p.progress), 100)}%</div>
      <div style={{ borderTop: "1px solid #2d2d3d", paddingTop: 10 }}>
        {p.milestones.map((m, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6, fontSize: 12 }}>
            <div style={{ width: 7, height: 7, borderRadius: "50%", background: ["#374151", "#1d4ed8", "#059669"][m.status], flexShrink: 0 }} />
            <span style={{ color: "#9ca3af", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.desc}</span>
            <span style={{ color: ["#4b5563", "#60a5fa", "#34d399"][m.status], fontSize: 11, flexShrink: 0 }}>{MILESTONE_STATUS[m.status]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function StatBox({ label, value, color }) {
  return (
    <div style={{ textAlign: "center", flex: 1 }}>
      <div style={{ fontSize: 24, fontWeight: 800, color }}>{Number(value).toFixed(3)}</div>
      <div style={{ fontSize: 11, color: "#6b7280" }}>AVAX</div>
      <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 3 }}>{label}</div>
    </div>
  );
}

const s = {
  page: { minHeight: "100vh", background: "#0f0f1a", color: "#f1f1f1", fontFamily: "'Inter', -apple-system, sans-serif", overflowX: "hidden" },
  toast: { position: "fixed", top: 20, left: "50%", transform: "translateX(-50%)", padding: "12px 24px", borderRadius: 10, color: "#fff", fontSize: 14, fontWeight: 600, zIndex: 1000, boxShadow: "0 4px 20px rgba(0,0,0,0.4)", maxWidth: 420, textAlign: "center" },
  topbar: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 24px", borderBottom: "1px solid #1f1f2e", flexWrap: "wrap", gap: 8 },
  backBtn: { background: "transparent", border: "1px solid #374151", color: "#9ca3af", padding: "8px 16px", borderRadius: 8, cursor: "pointer", fontSize: 14 },
  topTitle: { fontWeight: 700, fontSize: 18 },
  connectBtn: { background: "#8b5cf6", color: "#fff", border: "none", padding: "8px 20px", borderRadius: 8, cursor: "pointer", fontWeight: 600 },
  account: { background: "#1f1f2e", border: "1px solid #374151", padding: "8px 16px", borderRadius: 8, fontSize: 14, color: "#34d399" },
  switchBtn: { background: "transparent", border: "1px solid #374151", color: "#9ca3af", padding: "8px 14px", borderRadius: 8, cursor: "pointer", fontSize: 13 },

  // 欢迎页
  welcomeWrap: { maxWidth: 1100, margin: "0 auto", padding: "0 24px 80px" },
  hero: { textAlign: "center", padding: "80px 20px 64px" },
  heroTag: { fontSize: 12, color: "#8b5cf6", letterSpacing: 3, marginBottom: 20, textTransform: "uppercase", fontWeight: 600 },
  heroTitle: { fontSize: 44, fontWeight: 800, color: "#e5e7eb", marginBottom: 14, lineHeight: 1.15 },
  heroSub: { fontSize: 16, color: "#6b7280", marginBottom: 40, letterSpacing: 1 },
  heroBtn: { background: "linear-gradient(135deg, #7c3aed, #8b5cf6)", color: "#fff", border: "none", padding: "14px 40px", borderRadius: 12, fontSize: 16, fontWeight: 700, cursor: "pointer", boxShadow: "0 4px 20px rgba(139,92,246,0.4)" },
  welcomeSection: { marginBottom: 52 },
  welcomeSectionTitle: { fontSize: 17, fontWeight: 700, color: "#e5e7eb", marginBottom: 20 },
  projectScroll: { display: "flex", gap: 16, overflowX: "auto", paddingBottom: 12, scrollbarWidth: "thin", scrollbarColor: "#2d2d3d transparent" },
  welcomeCard: { background: "#1a1a2e", border: "1px solid #2d2d3d", borderRadius: 14, padding: "20px", minWidth: 300, maxWidth: 320, flexShrink: 0, position: "relative" },
  doneBadge: { position: "absolute", top: 14, right: 14, background: "#064e3b", color: "#34d399", fontSize: 11, padding: "3px 10px", borderRadius: 20, fontWeight: 600 },

  // 看板
  body: { maxWidth: 1100, margin: "0 auto", padding: "20px 24px 100px", boxSizing: "border-box" },
  projectSwitcher: { display: "flex", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 8 },
  projectBtn: { background: "#2d2d3d", border: "1px solid #374151", color: "#9ca3af", padding: "6px 16px", borderRadius: 8, cursor: "pointer", fontSize: 13 },
  projectBtnActive: { background: "#4c1d95", border: "1px solid #8b5cf6", color: "#c4b5fd" },
  grid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 },
  col: { display: "flex", flexDirection: "column", gap: 16, minWidth: 0 },
  card: { background: "#1a1a2e", border: "1px solid #2d2d3d", borderRadius: 12, padding: "18px 20px" },
  cardTitle: { fontWeight: 700, fontSize: 15, marginBottom: 14, color: "#e5e7eb" },
  progressBg: { width: "100%", height: 10, background: "#2d2d3d", borderRadius: 999, overflow: "hidden" },
  progressFill: { height: "100%", borderRadius: 999, background: "linear-gradient(90deg, #8b5cf6, #ec4899, #f59e0b)", transition: "width 0.6s ease" },
  statRow: { display: "flex", gap: 12, padding: "12px 0" },
  mRow: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid #2d2d3d" },
  mId: { background: "#2d2d3d", borderRadius: 6, padding: "3px 8px", fontSize: 12, fontWeight: 700, color: "#8b5cf6", minWidth: 26, textAlign: "center" },
  badge: { fontSize: 12, padding: "3px 10px", borderRadius: 20, color: "#fff", whiteSpace: "nowrap" },
  refreshBtn: { marginTop: 12, background: "transparent", border: "1px solid #374151", color: "#9ca3af", padding: "7px 14px", borderRadius: 8, cursor: "pointer", fontSize: 13, width: "100%", transition: "opacity 0.2s" },
  tagCard: { background: "#2d2d3d", border: "1px solid #374151", color: "#9ca3af", padding: "10px 6px", borderRadius: 10, cursor: "pointer", textAlign: "center", lineHeight: 1.3, transition: "all 0.15s" },
  tagCardActive: { background: "#4c1d95", border: "1px solid #8b5cf6", color: "#e5e7eb" },
  label: { display: "block", fontSize: 13, color: "#9ca3af", marginBottom: 6 },
  input: { width: "100%", background: "#0f0f1a", border: "1px solid #374151", borderRadius: 8, padding: "9px 12px", color: "#f1f1f1", fontSize: 14, marginBottom: 12, boxSizing: "border-box" },
  btn: { width: "100%", border: "none", borderRadius: 8, padding: "11px", color: "#fff", fontWeight: 700, fontSize: 15, cursor: "pointer" },
  logBox: { maxHeight: 180, overflowY: "auto", display: "flex", flexDirection: "column", gap: 4 },
  empty: { color: "#4b5563", fontSize: 13, textAlign: "center", padding: "14px 0" },
  fab: { position: "fixed", bottom: 28, left: 24, background: "linear-gradient(135deg, #7c3aed, #8b5cf6)", color: "#fff", border: "none", borderRadius: 12, padding: "12px 20px", cursor: "pointer", display: "flex", alignItems: "center", gap: 8, fontSize: 14, fontWeight: 700, boxShadow: "0 4px 20px rgba(139,92,246,0.3)", transition: "all 0.2s", zIndex: 100 },
  modalOverlay: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 },
  modal: { background: "#1a1a2e", border: "1px solid #4c1d95", borderRadius: 16, padding: 28, width: "100%", maxWidth: 760, maxHeight: "90vh", overflowY: "auto" },
  tabRow: { display: "flex", gap: 8, marginBottom: 20 },
  tab: { background: "#2d2d3d", border: "1px solid #374151", color: "#9ca3af", padding: "8px 20px", borderRadius: 8, cursor: "pointer", fontSize: 14 },
  tabActive: { background: "#4c1d95", border: "1px solid #8b5cf6", color: "#c4b5fd" },
  formGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 },
  mFormRow: { display: "flex", alignItems: "center", gap: 8, marginBottom: 10 },
  mIdBadge: { background: "#2d2d3d", borderRadius: 6, padding: "4px 8px", fontSize: 12, fontWeight: 700, color: "#8b5cf6", minWidth: 28, textAlign: "center" },
  addRowBtn: { background: "transparent", border: "1px dashed #4c1d95", color: "#8b5cf6", padding: "6px 14px", borderRadius: 8, cursor: "pointer", fontSize: 13 },
  removeBtn: { background: "transparent", border: "1px solid #374151", color: "#6b7280", padding: "4px 8px", borderRadius: 6, cursor: "pointer", fontSize: 12 },
};
