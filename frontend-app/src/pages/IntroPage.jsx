export default function IntroPage({ onEnterDemo }) {
  return (
    <div style={styles.container}>
      {/* Hero */}
      <div style={styles.hero}>
        <div style={styles.badge}>Avalanche Fuji Testnet · Solidity · Web3</div>
        <h1 style={styles.title}>GirlsVault</h1>
        <p style={styles.subtitle}>透明资助偏远地区女童的链上公益协议</p>
      </div>

      {/* 问题 */}
      <div style={styles.section}>
        <h2 style={styles.sectionTitle}>传统公益的问题</h2>
        <div style={styles.cardRow}>
          {[
            { icon: "🔒", title: "资金不透明", desc: "捐款经多层机构转手，到达女童手中的金额无法核实" },
            { icon: "⚠️", title: "挪用风险高", desc: "中间机构完全控制资金，缺乏约束机制" },
            { icon: "🌍", title: "跨境摩擦大", desc: "国际捐款手续费高、到账慢，部分地区金融封锁" },
          ].map((item) => (
            <div key={item.title} style={styles.card}>
              <div style={styles.cardIcon}>{item.icon}</div>
              <div style={styles.cardTitle}>{item.title}</div>
              <div style={styles.cardDesc}>{item.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* 解决方案 */}
      <div style={{ ...styles.section, background: "rgba(139,92,246,0.08)", borderRadius: 16, padding: "32px 24px" }}>
        <h2 style={styles.sectionTitle}>GirlsVault 如何解决</h2>
        <div style={styles.stepRow}>
          {[
            { step: "01", title: "智能合约锁仓", desc: "捐款直接进入合约，不流入任何机构账户，非满足条件不释放" },
            { step: "02", title: "里程碑多签验证", desc: "本地志愿者 2-of-3 多签确认，合约自动释放对应比例资金" },
            { step: "03", title: "全程链上可查", desc: "每笔捐款、每次验证、每次释放，任何人可在区块链浏览器验证" },
          ].map((item) => (
            <div key={item.step} style={styles.step}>
              <div style={styles.stepNum}>{item.step}</div>
              <div style={styles.stepTitle}>{item.title}</div>
              <div style={styles.stepDesc}>{item.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* 用途标签 */}
      <div style={styles.section}>
        <h2 style={styles.sectionTitle}>专款专用标签</h2>
        <div style={styles.tagRow}>
          {["📚 教育", "🍱 餐食", "🏥 医疗", "📦 物资", "🚌 交通"].map((t) => (
            <span key={t} style={styles.tag}>{t}</span>
          ))}
        </div>
        <p style={styles.tagDesc}>捐款人选择用途标签，资金进入对应子池，专款专用</p>
      </div>

      {/* CTA */}
      <div style={styles.ctaSection}>
        <button style={styles.ctaButton} onClick={onEnterDemo}>
          查看链上演示 →
        </button>
        <p style={styles.ctaNote}>基于 Avalanche 测试网的真实合约交互演示</p>
      </div>
    </div>
  );
}

const styles = {
  container: {
    maxWidth: 900,
    margin: "0 auto",
    padding: "40px 24px 80px",
    fontFamily: "'Inter', -apple-system, sans-serif",
    color: "#f1f1f1",
  },
  hero: {
    textAlign: "center",
    padding: "60px 0 48px",
  },
  badge: {
    display: "inline-block",
    background: "rgba(139,92,246,0.2)",
    border: "1px solid rgba(139,92,246,0.4)",
    color: "#c4b5fd",
    padding: "6px 16px",
    borderRadius: 20,
    fontSize: 13,
    marginBottom: 24,
  },
  title: {
    fontSize: 72,
    fontWeight: 800,
    margin: "0 0 16px",
    background: "linear-gradient(135deg, #c4b5fd, #f9a8d4)",
    WebkitBackgroundClip: "text",
    WebkitTextFillColor: "transparent",
  },
  subtitle: {
    fontSize: 22,
    color: "#9ca3af",
    margin: 0,
  },
  section: {
    marginBottom: 48,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: 700,
    marginBottom: 24,
    color: "#e5e7eb",
  },
  cardRow: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: 16,
  },
  card: {
    background: "#1f1f2e",
    border: "1px solid #2d2d3d",
    borderRadius: 12,
    padding: "24px 20px",
  },
  cardIcon: { fontSize: 28, marginBottom: 12 },
  cardTitle: { fontWeight: 700, marginBottom: 8, color: "#e5e7eb" },
  cardDesc: { fontSize: 14, color: "#9ca3af", lineHeight: 1.6 },
  stepRow: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: 24,
  },
  step: { textAlign: "center" },
  stepNum: {
    fontSize: 36,
    fontWeight: 800,
    color: "#8b5cf6",
    marginBottom: 12,
  },
  stepTitle: { fontWeight: 700, marginBottom: 8, color: "#e5e7eb" },
  stepDesc: { fontSize: 14, color: "#9ca3af", lineHeight: 1.6 },
  tagRow: {
    display: "flex",
    gap: 12,
    flexWrap: "wrap",
    marginBottom: 12,
  },
  tag: {
    background: "#1f1f2e",
    border: "1px solid #3d3d5c",
    borderRadius: 20,
    padding: "8px 20px",
    fontSize: 15,
  },
  tagDesc: { color: "#9ca3af", fontSize: 14, margin: 0 },
  ctaSection: {
    textAlign: "center",
    marginTop: 64,
  },
  ctaButton: {
    background: "linear-gradient(135deg, #8b5cf6, #ec4899)",
    color: "#fff",
    border: "none",
    borderRadius: 12,
    padding: "16px 48px",
    fontSize: 18,
    fontWeight: 700,
    cursor: "pointer",
    marginBottom: 12,
  },
  ctaNote: {
    color: "#6b7280",
    fontSize: 13,
    margin: 0,
  },
};
