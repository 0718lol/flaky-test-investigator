const minute = 60 * 1000;
const now = Date.now();

const seedCases = [
  {
    id: "ESC-1842",
    customer: "Apex Health",
    title: "EU 区续费支付失败，财务团队已介入",
    subtitle: "续费窗口将在今天关闭，客户要求在下一次董事会前确认付款路径。",
    priority: "P1",
    status: "mitigating",
    risk: "$240k ARR",
    owner: "林岚",
    impact: "EU / 3 个租户",
    deadline: now + 42 * minute,
    slaTotal: 90 * minute,
    confidence: 78,
    diagnosis: "故障高度集中在 4.18 发布后的 EU 支付 webhook。第三次重试耗尽后，支付状态没有回写到续费订单；目前没有证据表明账单核心服务或其他区域受影响。",
    facts: [
      "错误首次出现于 16:31 UTC，与 4.18 发布完成时间相差 4 分钟。",
      "US 区同类订单正常，影响范围可以收敛到 EU webhook worker。",
      "客户的卡没有被扣款，可安全提供备用付款链接。",
    ],
    reply: "Apex 团队，你们好。我们已将问题收敛到 EU 区支付回调链路，确认不会产生重复扣款，也不会影响本次续费权益。工程团队正在处理回调重试，并同步准备备用付款路径。我们会在 17:15 UTC 前提供下一次进展。",
    actions: [
      { id: "a1", text: "冻结支付链路的非必要发布", owner: "周启", due: "立即", done: true },
      { id: "a2", text: "在 EU sandbox 重放失败 webhook", owner: "周启", due: "17:05", done: false },
      { id: "a3", text: "向客户发送状态更新并确认备用付款方式", owner: "林岚", due: "17:15", done: false },
      { id: "a4", text: "核对受影响订单，排除重复扣款", owner: "唐茜", due: "17:20", done: false },
    ],
    people: [
      { name: "林岚", role: "升级负责人", initials: "LL", online: true },
      { name: "周启", role: "支付值班工程师", initials: "ZQ", online: true },
      { name: "唐茜", role: "客户成功经理", initials: "TQ", online: true },
    ],
    evidence: ["错误时间与发布窗口吻合", "区域对照排除核心账单服务", "三条来源指向同一重试链路"],
    sources: [
      { type: "Zendesk 工单", time: "16:40", text: "客户 CFO 正在追问能否先付款、后恢复系统，续费窗口今天关闭。", impact: "客户压力上升，必须提供备用支付路径。" },
      { type: "Slack", time: "16:43", text: "#payments：EU webhook delivery spike 后，重试在第三次全部耗尽。", impact: "故障范围收敛到 webhook worker。" },
      { type: "值班通话", time: "16:48", text: "CSM 已承诺 17:15 UTC 前更新，客户法务在等待状态说明。", impact: "已形成明确外部承诺。" },
      { type: "生产日志", time: "16:52", text: "payment.eu.callback timeout；US worker success；started after deploy 4.18。", impact: "根因假设有时间线与区域对照支撑。" },
    ],
    timeline: [
      { time: "16:56", title: "规则分析完成首次归因", detail: "合并 4 条来源，将范围收敛到 EU 支付 webhook。" },
      { time: "16:50", title: "林岚接管升级事件", detail: "设定 17:15 UTC 客户更新时间。" },
      { time: "16:40", title: "工单触发大客户升级", detail: "检测到续费风险和 CFO 介入。" },
    ],
  },
  {
    id: "ESC-1837",
    customer: "Northstar Bio",
    title: "安全审查缺少字段权限与数据保留说明",
    subtitle: "采购希望今天一次性收到完整答复包，合同签署被暂时挂起。",
    priority: "P2",
    status: "waiting",
    risk: "$600k 新签",
    owner: "唐茜",
    impact: "采购与法务",
    deadline: now + 3.4 * 60 * minute,
    slaTotal: 8 * 60 * minute,
    confidence: 84,
    diagnosis: "阻塞点不是安全问卷本身，而是字段级权限边界、子处理器清单和数据删除路径未被组织成统一口径。现有资料已覆盖约 80%，剩余内容可由安全负责人一次补齐。",
    facts: ["采购明确接受先发简版、当天补完整附件。", "权限矩阵已有答案，缺少面向客户的边界说明。", "法务要求数据保留期限与删除路径保持一致。"],
    reply: "Northstar 团队，你们好。权限边界、数据流向和子处理器说明已完成内部复核，我们会在今天 18:00 前发送完整安全答复包。采购可先使用随信附上的简版答案继续内部流转。",
    actions: [
      { id: "b1", text: "安全负责人复核字段级权限边界", owner: "韩舟", due: "15:30", done: true },
      { id: "b2", text: "补齐子处理器与数据保留附件", owner: "韩舟", due: "17:00", done: true },
      { id: "b3", text: "向采购发送整包材料", owner: "唐茜", due: "18:00", done: false },
    ],
    people: [
      { name: "唐茜", role: "客户成功经理", initials: "TQ", online: true },
      { name: "韩舟", role: "安全负责人", initials: "HZ", online: true },
      { name: "魏然", role: "企业销售", initials: "WR", online: false },
    ],
    evidence: ["问卷未答项与权限矩阵可映射", "法务备注定义了措辞边界", "客户邮件确认今天可继续流转"],
    sources: [
      { type: "安全问卷", time: "09:20", text: "客户询问字段级权限、审计日志与第三方处理器披露。", impact: "三个未答项阻塞采购审批。" },
      { type: "法务备注", time: "09:38", text: "合同必须明确数据保留期限和删除路径。", impact: "对外答复需要与合同口径一致。" },
      { type: "Slack", time: "09:54", text: "客户愿意继续推进，但希望安全包一次通过。", impact: "应集中由一个 owner 对外回答。" },
    ],
    timeline: [
      { time: "14:42", title: "安全附件进入复核", detail: "字段权限与数据保留说明已补齐。" },
      { time: "10:10", title: "规则分析拆解安全问卷", detail: "识别出 3 个真正阻塞采购的未答项。" },
      { time: "09:20", title: "销售提交升级", detail: "签约流程因安全审查暂停。" },
    ],
  },
  {
    id: "ESC-1829",
    customer: "Orbit Logistics",
    title: "上线前一晚 SSO 签名验证失败",
    subtitle: "客户明早进行全员发布，当前只有单租户 staging 环境受影响。",
    priority: "P1",
    status: "investigating",
    risk: "$180k 上线收入",
    owner: "周启",
    impact: "单租户 / SSO",
    deadline: now + 96 * minute,
    slaTotal: 3 * 60 * minute,
    confidence: 73,
    diagnosis: "现象更符合 IdP 元数据过期后未轮换，而不是 SSO 服务整体故障。签名验证只在该租户失败，重新导入元数据是当前最小且可逆的恢复动作。",
    facts: ["其他租户 SSO 正常，平台服务未出现错误峰值。", "失败日志明确包含 metadata expired。", "客户 staging 可用于无风险验证。"],
    reply: "Orbit 团队，你们好。我们已确认断点与本租户的 IdP 元数据轮换有关，不是 SSO 服务整体不可用。平台工程师正在 staging 验证新元数据，确认后再协助切换生产，明早上线计划暂不需要调整。下一次更新会在 23:00 前发出。",
    actions: [
      { id: "c1", text: "导出并核对当前 IdP 元数据", owner: "周启", due: "22:15", done: true },
      { id: "c2", text: "在 staging 导入新元数据并验证回调", owner: "周启", due: "22:40", done: false },
      { id: "c3", text: "与客户确认生产切换窗口", owner: "林岚", due: "23:00", done: false },
    ],
    people: [
      { name: "周启", role: "平台值班工程师", initials: "ZQ", online: true },
      { name: "林岚", role: "升级负责人", initials: "LL", online: true },
      { name: "沈越", role: "实施经理", initials: "SY", online: true },
    ],
    evidence: ["租户对照排除平台级故障", "日志直接命中元数据过期", "staging 提供可逆验证路径"],
    sources: [
      { type: "实施会议", time: "21:10", text: "客户明早发布，SSO 不通会影响全员上线。", impact: "恢复窗口不足 12 小时。" },
      { type: "生产日志", time: "21:18", text: "IdP metadata expired; callback signature validation failed。", impact: "提供了可验证的根因假设。" },
      { type: "Slack", time: "21:25", text: "问题仅影响该租户，其他集成正常。", impact: "排除平台级故障。" },
      { type: "客户邮件", time: "21:31", text: "今晚需要恢复方案，否则发布会将改期。", impact: "明确了客户决策时点。" },
    ],
    timeline: [
      { time: "21:43", title: "规则分析生成最小恢复路径", detail: "建议先在 staging 轮换元数据，再切生产。" },
      { time: "21:31", title: "收到客户上线风险邮件", detail: "客户要求今晚给出恢复方案。" },
      { time: "21:10", title: "实施经理发起升级", detail: "SSO 签名验证失败。" },
    ],
  },
];

const statusLabels = {
  investigating: "调查中",
  mitigating: "处置中",
  waiting: "待客户",
  monitoring: "观察中",
  resolved: "已解决",
};

const storageKey = "escalation-desk-state-v3";
const legacyStorageKey = "escalation-desk-state-v2";
const platformStorageKey = "relay-platform-state-v1";

const defaultRetroRecords = [
  { id: "r1", date: "08-19", title: "EU 支付 webhook 重试耗尽", owner: "周启", status: "待跟进", actions: 4, caseId: "ESC-1842" },
  { id: "r2", date: "08-14", title: "权限材料多处口径不一致", owner: "韩舟", status: "进行中", actions: 3, caseId: "ESC-1837" },
  { id: "r3", date: "08-08", title: "SSO 元数据轮换缺少预警", owner: "沈越", status: "已完成", actions: 5, caseId: "ESC-1829" },
];

const defaultAccounts = [
  { id: "acct-apex", name: "Apex Health", initials: "AH", tier: "战略客户", industry: "医疗科技", region: "欧洲", value: 240000, valueLabel: "$240k ARR", renewalDays: 12, csm: "唐茜", health: "critical", healthScore: 61, stage: "续约中", products: ["Billing", "Analytics"], contacts: [{ name: "Maya Chen", role: "CFO" }, { name: "Elias Ford", role: "支付负责人" }], signals: ["续费窗口将在 12 天内关闭", "财务团队已介入支付故障", "近 30 天出现 2 次升级"], nextSteps: ["确认备用付款路径", "完成 EU 支付故障复盘"], activity: ["今天 · CFO 请求明确付款路径", "3 天前 · 续约方案进入法务复核"], linkedCaseIds: ["ESC-1842"] },
  { id: "acct-northstar", name: "Northstar Bio", initials: "NB", tier: "战略客户", industry: "生命科学", region: "北美", value: 600000, valueLabel: "$600k 新签", renewalDays: 28, csm: "唐茜", health: "watch", healthScore: 67, stage: "采购中", products: ["Enterprise", "Audit Log"], contacts: [{ name: "Olivia Park", role: "采购负责人" }, { name: "Noah Reed", role: "安全负责人" }], signals: ["合同等待安全答复包", "字段权限口径尚未统一", "采购要求本周完成审批"], nextSteps: ["发送完整安全附件", "安排安全与法务联合答疑"], activity: ["今天 · 采购暂停合同流转", "5 天前 · 完成技术评估"], linkedCaseIds: ["ESC-1837"] },
  { id: "acct-orbit", name: "Orbit Logistics", initials: "OL", tier: "重点客户", industry: "物流", region: "亚太", value: 180000, valueLabel: "$180k 上线收入", renewalDays: 41, csm: "沈越", health: "watch", healthScore: 72, stage: "上线中", products: ["SSO", "Workflow"], contacts: [{ name: "Ava Lim", role: "实施负责人" }, { name: "Ken Ito", role: "IT 负责人" }], signals: ["明早进行全员上线", "SSO 元数据轮换失败", "当前只有 staging 可验证"], nextSteps: ["完成 staging 签名验证", "确认生产切换窗口"], activity: ["今天 · 上线计划进入风险状态", "2 天前 · 完成用户导入"], linkedCaseIds: ["ESC-1829"] },
  { id: "acct-vertex", name: "Vertex Retail", initials: "VR", tier: "重点客户", industry: "零售", region: "北美", value: 320000, valueLabel: "$320k ARR", renewalDays: 67, csm: "林岚", health: "stable", healthScore: 86, stage: "扩展中", products: ["Commerce", "Analytics"], contacts: [{ name: "Liam Brooks", role: "运营副总裁" }], signals: ["门店活跃度连续 6 周增长", "正在评估 120 个新增席位"], nextSteps: ["提交席位扩展报价"], activity: ["2 天前 · 完成季度业务复盘"], linkedCaseIds: [] },
  { id: "acct-cobalt", name: "Cobalt Finance", initials: "CF", tier: "战略客户", industry: "金融服务", region: "欧洲", value: 450000, valueLabel: "$450k ARR", renewalDays: 83, csm: "唐茜", health: "stable", healthScore: 89, stage: "稳定运营", products: ["Enterprise", "Compliance"], contacts: [{ name: "Sofia Klein", role: "合规负责人" }], signals: ["审计材料已通过年度复核", "核心团队周活跃率 91%"], nextSteps: ["确认下一年度合规范围"], activity: ["1 周前 · 完成审计材料更新"], linkedCaseIds: [] },
  { id: "acct-atlas", name: "Atlas Energy", initials: "AE", tier: "重点客户", industry: "能源", region: "北美", value: 275000, valueLabel: "$275k ARR", renewalDays: 104, csm: "林岚", health: "stable", healthScore: 81, stage: "稳定运营", products: ["Workflow", "Data Export"], contacts: [{ name: "Ethan Cole", role: "数字化负责人" }], signals: ["自动化流程使用量提升 18%", "无未关闭升级事件"], nextSteps: ["评估数据导出扩容"], activity: ["9 天前 · 发布新的现场工作流"], linkedCaseIds: [] },
  { id: "acct-lumina", name: "Lumina Media", initials: "LM", tier: "成长客户", industry: "媒体", region: "亚太", value: 160000, valueLabel: "$160k ARR", renewalDays: 21, csm: "沈越", health: "stable", healthScore: 84, stage: "续约中", products: ["Analytics"], contacts: [{ name: "Zoe Tan", role: "数据负责人" }], signals: ["续约意向已确认", "报表使用率高于同组 24%"], nextSteps: ["发送续约订单"], activity: ["昨天 · 确认续约席位"], linkedCaseIds: [] },
  { id: "acct-harbor", name: "Harbor Systems", initials: "HS", tier: "重点客户", industry: "软件", region: "欧洲", value: 390000, valueLabel: "$390k ARR", renewalDays: 55, csm: "唐茜", health: "watch", healthScore: 74, stage: "采用提升", products: ["Enterprise", "SSO"], contacts: [{ name: "Mila Rossi", role: "客户平台负责人" }], signals: ["管理员周活跃率下降 13%", "两个团队尚未完成 SSO 迁移"], nextSteps: ["安排管理员采用度工作坊", "确认 SSO 迁移计划"], activity: ["4 天前 · 识别到活跃度下降"], linkedCaseIds: [] },
];

const platformState = (() => {
  try {
    const saved = JSON.parse(localStorage.getItem(platformStorageKey));
    return {
      handoffNote: saved?.handoffNote || "支付事件正在处置，下一次客户更新由林岚在 17:15 UTC 发出。",
      retroRecords: Array.isArray(saved?.retroRecords) ? saved.retroRecords : defaultRetroRecords,
      retroDone: new Set(Array.isArray(saved?.retroDone) ? saved.retroDone : []),
      customPlaybooks: Array.isArray(saved?.customPlaybooks) ? saved.customPlaybooks : [],
      playbookRuns: saved?.playbookRuns && typeof saved.playbookRuns === "object" ? saved.playbookRuns : {},
      currentShift: saved?.currentShift || "林岚",
    };
  } catch {
    return { handoffNote: "支付事件正在处置，下一次客户更新由林岚在 17:15 UTC 发出。", retroRecords: defaultRetroRecords, retroDone: new Set(), customPlaybooks: [], playbookRuns: {}, currentShift: "林岚" };
  }
})();

function savePlatformState() {
  localStorage.setItem(platformStorageKey, JSON.stringify({
    handoffNote: platformState.handoffNote,
    retroRecords: platformState.retroRecords,
    retroDone: [...platformState.retroDone],
    customPlaybooks: platformState.customPlaybooks,
    playbookRuns: platformState.playbookRuns,
    currentShift: platformState.currentShift,
  }));
}

function restoreState() {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) || localStorage.getItem(legacyStorageKey));
    if (saved?.cases?.length) {
      saved.cases.forEach((item, index) => {
        if (item.deadlineOffset) item.deadline = Date.now() + item.deadlineOffset;
        else if (!item.deadline) item.deadline = Date.now() + (index + 1) * 75 * minute;
      });
      return { cases: saved.cases, selectedId: saved.selectedId || saved.cases[0].id };
    }
  } catch {}
  return { cases: seedCases, selectedId: seedCases[0].id };
}

const restored = restoreState();
const state = {
  cases: restored.cases,
  selectedId: restored.selectedId,
  filter: "all",
  search: "",
  tab: "brief",
  analyzing: false,
  view: "escalations",
  moduleDetail: null,
  reportPeriod: "30d",
  retroDone: platformState.retroDone,
};

const elements = {
  app: document.getElementById("app"),
  caseList: document.getElementById("caseList"),
  activeCount: document.getElementById("activeCount"),
  sidebarCount: document.getElementById("sidebarCount"),
  caseSearch: document.getElementById("caseSearch"),
  queueFilters: document.getElementById("queueFilters"),
  caseId: document.getElementById("caseId"),
  caseCustomer: document.getElementById("caseCustomer"),
  priorityChip: document.getElementById("priorityChip"),
  healthChip: document.getElementById("healthChip"),
  caseTitle: document.getElementById("caseTitle"),
  caseSubtitle: document.getElementById("caseSubtitle"),
  statusSelect: document.getElementById("statusSelect"),
  riskValue: document.getElementById("riskValue"),
  ownerValue: document.getElementById("ownerValue"),
  impactValue: document.getElementById("impactValue"),
  nextUpdateValue: document.getElementById("nextUpdateValue"),
  sourceTabCount: document.getElementById("sourceTabCount"),
  caseTabs: document.getElementById("caseTabs"),
  tabPanel: document.getElementById("tabPanel"),
  slaState: document.getElementById("slaState"),
  slaClock: document.getElementById("slaClock"),
  slaProgress: document.getElementById("slaProgress"),
  slaLabel: document.getElementById("slaLabel"),
  drawerClock: document.getElementById("drawerClock"),
  peopleList: document.getElementById("peopleList"),
  evidenceList: document.getElementById("evidenceList"),
  evidenceCount: document.getElementById("evidenceCount"),
  newCaseDialog: document.getElementById("newCaseDialog"),
  newCaseForm: document.getElementById("newCaseForm"),
  sourceDialog: document.getElementById("sourceDialog"),
  sourceForm: document.getElementById("sourceForm"),
  playbookDialog: document.getElementById("playbookDialog"),
  playbookForm: document.getElementById("playbookForm"),
  runPlaybookDialog: document.getElementById("runPlaybookDialog"),
  runPlaybookForm: document.getElementById("runPlaybookForm"),
  playbookCaseSelect: document.getElementById("playbookCaseSelect"),
  playbookRunPreview: document.getElementById("playbookRunPreview"),
  retroDialog: document.getElementById("retroDialog"),
  retroForm: document.getElementById("retroForm"),
  retroCaseSelect: document.getElementById("retroCaseSelect"),
  contextDrawer: document.getElementById("contextDrawer"),
  drawerBackdrop: document.getElementById("drawerBackdrop"),
  modulePane: document.getElementById("modulePane"),
  toast: document.getElementById("toast"),
};

function currentCase() {
  return state.cases.find((item) => item.id === state.selectedId) || state.cases[0];
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function localTime(date) {
  return new Intl.DateTimeFormat("zh-CN", { hour: "2-digit", minute: "2-digit", hour12: false }).format(date);
}

function saveState() {
  const cases = state.cases.map((item) => ({
    ...item,
    deadlineOffset: item.deadline - Date.now(),
  }));
  localStorage.setItem(storageKey, JSON.stringify({ cases, selectedId: state.selectedId }));
}

let toastTimer;
function showToast(message) {
  elements.toast.textContent = message;
  elements.toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => elements.toast.classList.remove("show"), 2200);
}

function filteredCases() {
  const query = state.search.trim().toLowerCase();
  return state.cases.filter((item) => {
    const matchesQuery = !query || `${item.id} ${item.customer} ${item.title} ${item.owner}`.toLowerCase().includes(query);
    const matchesFilter = state.filter === "all"
      || (state.filter === "urgent" && item.priority === "P1")
      || (state.filter === "waiting" && item.status === "waiting");
    return matchesQuery && matchesFilter;
  });
}

function renderQueue() {
  const cases = filteredCases();
  const activeCases = state.cases.filter((item) => item.status !== "resolved").length;
  elements.activeCount.textContent = String(activeCases);
  elements.sidebarCount.textContent = String(activeCases);
  elements.caseList.innerHTML = cases.length
    ? cases.map((item) => `
      <button class="case-item" type="button" data-case-id="${escapeHtml(item.id)}" aria-current="${item.id === state.selectedId}">
        <div class="case-main">
          <div class="case-main-top"><span class="priority-mini ${item.priority.toLowerCase()}">${escapeHtml(item.priority)}</span><span>${escapeHtml(item.customer)}</span><span>·</span><span>${escapeHtml(item.id)}</span></div>
          <h3>${escapeHtml(item.title)}</h3>
        </div>
        <div class="case-risk"><strong>${escapeHtml(item.risk)}</strong><span>${escapeHtml(item.impact)}</span></div>
        <div class="case-owner"><span class="case-owner-avatar">${escapeHtml(item.owner.slice(-1))}</span><div><strong>${escapeHtml(item.owner)}</strong><span>事件负责人</span></div></div>
        <div class="case-state"><strong class="state-pill ${item.status}">${escapeHtml(statusLabels[item.status])}</strong><span>${item.actions.filter((action) => action.done).length}/${item.actions.length} 动作</span></div>
        <div class="case-deadline"><strong>${item.status === "resolved" ? "已完成" : localTime(new Date(item.deadline))}</strong><span>下次更新</span></div>
      </button>
    `).join("")
    : '<div class="queue-empty">没有符合条件的升级事件</div>';

  elements.caseList.querySelectorAll("[data-case-id]").forEach((button) => {
    button.addEventListener("click", () => {
      state.selectedId = button.dataset.caseId;
      state.tab = "brief";
      elements.app.classList.add("mobile-detail");
      render();
    });
  });
}

function renderHeader(item) {
  elements.caseId.textContent = item.id;
  elements.caseCustomer.textContent = item.customer;
  elements.priorityChip.textContent = item.priority;
  elements.priorityChip.dataset.priority = item.priority;
  elements.healthChip.textContent = statusLabels[item.status];
  elements.caseTitle.textContent = item.title;
  elements.caseSubtitle.textContent = item.subtitle;
  elements.statusSelect.value = item.status;
  elements.riskValue.textContent = item.risk;
  elements.ownerValue.textContent = item.owner;
  elements.impactValue.textContent = item.impact;
  elements.nextUpdateValue.textContent = item.status === "resolved" ? "已完成" : localTime(new Date(item.deadline));
  elements.sourceTabCount.textContent = String(item.sources.length);
}

function renderBrief(item) {
  const completed = item.actions.filter((action) => action.done).length;
  elements.tabPanel.innerHTML = `
    <div class="analysis-state ${state.analyzing ? "processing" : ""}">
      <div>
        <strong>${state.analyzing ? "正在重新分析现场信息…" : `本地规则已完成归因 · 可信度 ${item.confidence}%`}</strong>
        <p>${state.analyzing ? "正在核对新增来源与当前结论是否冲突。" : `基于 ${item.sources.length} 条来源，最近更新于 ${escapeHtml(item.timeline[0]?.time || "刚刚")}。`}</p>
      </div>
      <button class="button secondary" id="reanalyzeButton" type="button" ${state.analyzing ? "disabled" : ""}>${state.analyzing ? "分析中" : "重新分析"}</button>
    </div>

    <div class="brief-grid">
      <div class="work-stack">
        <section class="work-section">
          <div class="section-title"><h3>当前判断</h3><span>建议人工确认后对外发送</span></div>
          <div class="diagnosis">
            <p>${escapeHtml(item.diagnosis)}</p>
            <div class="confidence-row">
              <span>归因可信度</span>
              <div><strong>${item.confidence}%</strong><div class="confidence-meter"><span style="width:${item.confidence}%"></span></div></div>
            </div>
          </div>
          <ul class="fact-list">${item.facts.map((fact) => `<li>${escapeHtml(fact)}</li>`).join("")}</ul>
        </section>

        <section class="work-section">
          <div class="section-title"><h3>处置清单</h3><span>${completed} / ${item.actions.length} 已完成</span></div>
          <div class="action-checklist">
            ${item.actions.map((action) => `
              <div class="action-row ${action.done ? "done" : ""}">
                <input id="${escapeHtml(action.id)}" data-action-id="${escapeHtml(action.id)}" type="checkbox" ${action.done ? "checked" : ""} />
                <label for="${escapeHtml(action.id)}">${escapeHtml(action.text)}</label>
                <span>${escapeHtml(action.owner)} · ${escapeHtml(action.due)}</span>
              </div>
            `).join("")}
          </div>
        </section>
      </div>

      <div class="work-stack">
        <section class="work-section">
          <div class="section-title"><h3>客户更新</h3><span id="replyLength">${item.reply.length} 字</span></div>
          <textarea class="reply-editor" id="replyEditor" aria-label="客户更新内容">${escapeHtml(item.reply)}</textarea>
          <div class="editor-foot"><span>已统一事实、影响与下次更新时间</span><button class="button primary" id="copyReply" type="button">复制更新</button></div>
        </section>

        <section class="work-section">
          <div class="section-title"><h3>责任分工</h3><span>${item.people.length} 人在线协作</span></div>
          ${item.people.slice(0, 3).map((person) => `
            <div class="owner-card"><span class="owner-avatar">${escapeHtml(person.initials)}</span><div><strong>${escapeHtml(person.name)}</strong><small>${escapeHtml(person.role)}</small></div><span>${person.online ? "在线" : "离线"}</span></div>
          `).join("")}
        </section>
      </div>
    </div>
  `;

  document.getElementById("reanalyzeButton").addEventListener("click", reanalyze);
  elements.tabPanel.querySelectorAll("[data-action-id]").forEach((input) => {
    input.addEventListener("change", () => toggleAction(input.dataset.actionId, input.checked));
  });
  const editor = document.getElementById("replyEditor");
  editor.addEventListener("input", () => {
    item.reply = editor.value;
    document.getElementById("replyLength").textContent = `${editor.value.length} 字`;
    saveState();
  });
  document.getElementById("copyReply").addEventListener("click", () => copyText(editor.value, "客户更新已复制"));
}

function renderSources(item) {
  elements.tabPanel.innerHTML = `
    <div class="source-toolbar">
      <div><h3>现场来源</h3><p>按原始时间保留，结论可追溯到每一条证据。</p></div>
      <button class="button primary" id="addSourceButton" type="button"><b>＋</b> 添加来源</button>
    </div>
    <div class="source-list">
      ${item.sources.map((source, index) => `
        <article class="source-item">
          <div class="source-meta"><div><span class="source-type">${escapeHtml(source.type)}</span><span class="source-time">${escapeHtml(source.time)}</span></div><span class="source-tag">来源 ${index + 1}</span></div>
          <p>${escapeHtml(source.text)}</p>
          <div class="source-impact">规则提取：${escapeHtml(source.impact)}</div>
        </article>
      `).join("")}
    </div>
  `;
  document.getElementById("addSourceButton").addEventListener("click", openSourceDialog);
}

function renderTimeline(item) {
  elements.tabPanel.innerHTML = `
    <div class="source-toolbar"><div><h3>案件时间线</h3><p>状态、人员、规则分析和对外承诺统一留痕。</p></div></div>
    <div class="timeline-panel">
      ${item.timeline.map((event) => `
        <div class="timeline-item"><span class="timeline-time">${escapeHtml(event.time)}</span><span class="timeline-mark"></span><div class="timeline-content"><strong>${escapeHtml(event.title)}</strong><p>${escapeHtml(event.detail)}</p></div></div>
      `).join("")}
    </div>
  `;
}

function renderContext(item) {
  elements.peopleList.innerHTML = item.people.map((person) => `
    <div class="person-row"><span class="person-avatar">${escapeHtml(person.initials)}</span><div><strong>${escapeHtml(person.name)}</strong><span>${escapeHtml(person.role)}</span></div><i style="opacity:${person.online ? 1 : 0.2}"></i></div>
  `).join("");
  elements.evidenceCount.textContent = `${item.evidence.length} 条`;
  elements.evidenceList.innerHTML = item.evidence.map((evidence) => `<div class="evidence-item"><b>✓</b><span>${escapeHtml(evidence)}</span></div>`).join("");
  updateClock();
}

function renderTabs() {
  elements.caseTabs.querySelectorAll("[data-tab]").forEach((button) => {
    button.setAttribute("aria-selected", String(button.dataset.tab === state.tab));
  });
}

function render() {
  const item = currentCase();
  if (!item) return;
  renderQueue();
  renderHeader(item);
  renderTabs();
  renderContext(item);
  if (state.tab === "brief") renderBrief(item);
  if (state.tab === "sources") renderSources(item);
  if (state.tab === "timeline") renderTimeline(item);
}

const moduleCopy = {
  customers: { eyebrow: "Accounts", title: "客户", description: "集中查看关键客户的商业风险、健康度与当前升级事件。" },
  oncall: { eyebrow: "Coverage", title: "值班安排", description: "明确当前响应人、交接窗口和本周覆盖情况。" },
  playbooks: { eyebrow: "Playbooks", title: "处置手册", description: "将高频升级场景沉淀为可执行、可复用的处置步骤。" },
  reports: { eyebrow: "Operations", title: "运营报告", description: "定位失控环节、风险客户与团队负载，并直接进入需要处理的事件。" },
  retros: { eyebrow: "Reviews", title: "复盘记录", description: "跟踪根因、改进项和跨团队责任，避免同类事件重复发生。" },
};

function moduleHead(view, action = "") {
  const copy = moduleCopy[view];
  return `<header class="module-head module-head-${view}"><div><span class="page-eyebrow">${copy.eyebrow}</span><h1>${copy.title}</h1><p>${copy.description}</p></div>${action}</header>`;
}

function portfolioAccounts() {
  const knownNames = new Set(defaultAccounts.map((account) => account.name));
  const enriched = defaultAccounts.map((account) => ({
    ...account,
    linkedCaseIds: [...new Set([...account.linkedCaseIds, ...state.cases.filter((item) => item.customer === account.name).map((item) => item.id)])],
  }));
  const generated = state.cases.filter((item) => !knownNames.has(item.customer)).map((item) => ({
    id: `acct-${item.id.toLowerCase()}`,
    name: item.customer,
    initials: item.customer.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase(),
    tier: item.priority === "P1" ? "战略客户" : "重点客户",
    industry: "待补充",
    region: "待补充",
    value: Number(String(item.risk).replace(/[^0-9.]/g, "")) * (String(item.risk).toLowerCase().includes("k") ? 1000 : 1),
    valueLabel: item.risk,
    renewalDays: 90,
    csm: item.owner,
    health: item.priority === "P1" ? "critical" : "watch",
    healthScore: item.priority === "P1" ? 58 : 70,
    stage: "升级处理中",
    products: ["待补充"],
    contacts: [{ name: "待补充联系人", role: "客户项目负责人" }],
    signals: [item.title, item.subtitle],
    nextSteps: item.actions.filter((action) => !action.done).slice(0, 2).map((action) => action.text),
    activity: [`今天 · 创建升级事件 ${item.id}`],
    linkedCaseIds: [item.id],
  }));
  return [...enriched, ...generated];
}

function renderCustomers() {
  const query = state.search.trim().toLowerCase();
  const healthLabels = { critical: "需干预", watch: "观察", stable: "稳定" };
  const healthOrder = { critical: 0, watch: 1, stable: 2 };
  const portfolio = portfolioAccounts();
  const selected = portfolio.find((account) => account.id === state.moduleDetail);
  if (selected) {
    const linkedCases = state.cases.filter((item) => selected.linkedCaseIds.includes(item.id));
    return `${moduleHead("customers", '<button class="button quiet" type="button" data-module-action="back-accounts"><i data-lucide="arrow-left"></i>客户组合</button>')}
      <section class="account-profile">
        <div class="account-profile-main"><span class="account-profile-logo">${selected.initials}</span><div><span class="page-eyebrow">${selected.tier} · ${selected.industry}</span><h2>${selected.name}</h2><p>${selected.region} · ${selected.stage} · ${selected.products.join(" / ")}</p></div></div>
        <div class="account-health ${selected.health}"><span>客户健康度</span><strong>${selected.healthScore}<small>/100</small></strong><div><i style="width:${selected.healthScore}%"></i></div><small>${healthLabels[selected.health]}</small></div>
      </section>
      <section class="account-facts"><article><span>商业价值</span><strong>${selected.valueLabel}</strong><small>${selected.tier}</small></article><article><span>续约窗口</span><strong>${selected.renewalDays} 天</strong><small>${selected.stage}</small></article><article><span>客户负责人</span><strong>${selected.csm}</strong><small>最近跟进：今天</small></article><article><span>当前升级</span><strong>${linkedCases.filter((item) => item.status !== "resolved").length}</strong><small>${linkedCases.length ? linkedCases.map((item) => item.priority).join(" / ") : "暂无风险事件"}</small></article></section>
      <div class="account-detail-grid">
        <section class="module-surface account-signals"><div class="module-section-head"><div><h2>风险与机会信号</h2><p>健康度判断可追溯到具体信号</p></div><span>${selected.signals.length} 条</span></div><div>${selected.signals.map((signal, index) => `<article><i data-lucide="${selected.health === "stable" ? "trending-up" : index === 0 ? "circle-alert" : "activity"}"></i><span><strong>${signal}</strong><small>${index === 0 ? "高权重信号" : "已纳入健康度"}</small></span></article>`).join("")}</div></section>
        <section class="module-surface account-plan"><div class="module-section-head"><div><h2>下一步计划</h2><p>客户负责人需要推进的动作</p></div></div><div>${selected.nextSteps.map((step, index) => `<article><span>${index + 1}</span><div><strong>${step}</strong><small>${index ? "本周完成" : "下一次客户沟通前"}</small></div></article>`).join("")}</div></section>
      </div>
      <div class="account-detail-grid secondary">
        <section class="module-surface account-events"><div class="module-section-head"><div><h2>关联升级事件</h2><p>从客户关系直接进入处置现场</p></div><span>${linkedCases.length} 起</span></div><div>${linkedCases.map((item) => `<button type="button" data-module-action="open-case" data-case-id="${item.id}"><span class="priority-mini ${item.priority.toLowerCase()}">${item.priority}</span><span><strong>${item.title}</strong><small>${item.id} · ${statusLabels[item.status]} · ${item.actions.filter((action) => !action.done).length} 项待完成</small></span><strong>${item.risk}</strong><i data-lucide="arrow-right"></i></button>`).join("") || '<div class="account-empty"><i data-lucide="circle-check"></i><span><strong>没有未关闭的升级事件</strong><small>当前客户关系处于正常跟进状态</small></span></div>'}</div></section>
        <section class="module-surface account-people"><div class="module-section-head"><div><h2>关键联系人</h2><p>决策人与项目负责人</p></div></div><div>${selected.contacts.map((contact) => `<article><span>${contact.name.split(" ").map((part) => part[0]).join("").slice(0, 2)}</span><div><strong>${contact.name}</strong><small>${contact.role}</small></div><button class="row-action" type="button" data-module-action="copy-contact" data-contact="${contact.name} · ${contact.role}" aria-label="复制 ${contact.name}"><i data-lucide="copy"></i></button></article>`).join("")}</div><div class="account-activity"><span>最近动态</span>${selected.activity.map((entry) => `<p>${entry}</p>`).join("")}</div></section>
      </div>`;
  }

  const accounts = portfolio.filter((item) => !query || `${item.name} ${item.csm} ${item.industry} ${item.region} ${item.signals.join(" ")}`.toLowerCase().includes(query)).sort((a, b) => healthOrder[a.health] - healthOrder[b.health] || a.renewalDays - b.renewalDays);
  const riskyAccounts = portfolio.filter((account) => account.health !== "stable");
  const riskValue = riskyAccounts.reduce((total, account) => total + account.value, 0);
  const riskValueLabel = riskValue >= 1000000 ? `$${(riskValue / 1000000).toFixed(2)}m` : `$${Math.round(riskValue / 1000)}k`;
  return `${moduleHead("customers", '<button class="button quiet" type="button" data-module-action="export-accounts"><i data-lucide="download"></i>导出客户</button>')}
    <section class="module-stat-strip">
      <article><span>关键客户</span><strong>${portfolio.length}</strong><small>未来 90 天续约 ${portfolio.filter((account) => account.renewalDays <= 90).length} 家</small></article>
      <article><span>需要关注</span><strong>${riskyAccounts.length}</strong><small>其中需干预 ${riskyAccounts.filter((account) => account.health === "critical").length} 家</small></article>
      <article><span>风险价值</span><strong>${riskValueLabel}</strong><small>来自健康度异常客户</small></article>
    </section>
    <section class="module-surface">
      <div class="module-section-head"><div><h2>客户组合</h2><p>按健康度和续约窗口排序</p></div><span>${accounts.length} 个匹配结果</span></div>
      <div class="data-table account-table">
        <div class="data-row data-head"><span>客户</span><span>健康度</span><span>商业价值</span><span>客户负责人</span><span>续约窗口</span><span></span></div>
        ${accounts.map((item) => `<div class="data-row">
          <div class="account-name"><b>${item.initials}</b><span><strong>${item.name}</strong><small>${item.industry} · ${item.stage}</small></span></div>
          <span><i class="health-dot ${item.health === "critical" ? "risk" : item.health === "watch" ? "watch" : ""}"></i>${healthLabels[item.health]} · ${item.healthScore}</span>
          <span><strong>${item.valueLabel}</strong></span><span>${item.csm}</span><span>${item.renewalDays} 天</span>
          <button class="row-action" type="button" data-module-action="open-account" data-account-id="${item.id}" aria-label="查看 ${item.name}"><i data-lucide="arrow-right"></i></button>
        </div>`).join("") || '<div class="queue-empty">没有匹配的客户</div>'}
      </div>
    </section>`;
}

function renderOncall() {
  const shifts = [
    ["今天", "林岚", "升级负责人", "周启", "技术值班", "09:00 - 18:00"],
    ["周六", "唐茜", "升级负责人", "韩舟", "安全支持", "10:00 - 18:00"],
    ["周日", "林岚", "升级负责人", "沈越", "平台支持", "10:00 - 18:00"],
    ["周一", "唐茜", "升级负责人", "周启", "技术值班", "09:00 - 18:00"],
  ];
  return `${moduleHead("oncall", '<button class="button quiet" type="button" data-module-action="copy-handoff"><i data-lucide="copy"></i>复制交接摘要</button>')}
    <section class="oncall-now">
      <div><span class="live-label"><i></i>当前班次</span><h2>${platformState.currentShift} 正在负责升级响应</h2><p>技术值班：周启 · 下次交接 18:00 · 当前 ${state.cases.filter((item) => item.status !== "resolved").length} 起处理中</p><label class="handoff-label" for="handoffNote">交接备注</label><textarea id="handoffNote" class="handoff-note" rows="3">${escapeHtml(platformState.handoffNote)}</textarea><button class="button solid handoff-save" type="button" data-module-action="save-handoff"><i data-lucide="save"></i>保存交接</button></div>
      <div class="oncall-people"><span>岚</span><span>启</span><button type="button" data-module-action="take-shift">接管当前班次</button><button type="button" data-module-action="open-roster">查看联系方式</button></div>
    </section>
    <section class="module-surface">
      <div class="module-section-head"><div><h2>本周覆盖</h2><p>主负责人和专业支持双人覆盖</p></div><span>UTC+8</span></div>
      <div class="shift-list">${shifts.map((shift, index) => `<article class="shift-row ${index === 0 ? "current" : ""}">
        <div><strong>${shift[0]}</strong><small>${shift[5]}</small></div>
        <div class="shift-person"><span>${shift[1].slice(-1)}</span><div><strong>${shift[1]}</strong><small>${shift[2]}</small></div></div>
        <div class="shift-person"><span>${shift[3].slice(-1)}</span><div><strong>${shift[3]}</strong><small>${shift[4]}</small></div></div>
        <span class="coverage-state">${index === 0 ? "值班中" : "已排班"}</span>
      </article>`).join("")}</div>
    </section>`;
}

let playbooks = [
  { id: "payment", icon: "credit-card", title: "支付与续费故障", desc: "支付失败、重复扣款和续费窗口风险", runs: platformState.playbookRuns.payment ?? 18, updated: "2 天前", steps: ["确认扣款状态与影响订单", "冻结非必要发布并建立回滚点", "准备备用付款路径", "按承诺窗口更新客户"] },
  { id: "security", icon: "shield-check", title: "安全审查阻塞", desc: "问卷、字段权限与数据保留口径", runs: platformState.playbookRuns.security ?? 12, updated: "5 天前", steps: ["拆分真正阻塞采购的未答项", "核对权限与法务口径", "指定单一对外负责人", "发送完整答复包"] },
  { id: "sso", icon: "key-round", title: "SSO 上线故障", desc: "元数据、证书和签名验证失败", runs: platformState.playbookRuns.sso ?? 9, updated: "1 周前", steps: ["确认租户级与平台级影响", "检查 IdP 元数据有效期", "在 staging 执行可逆验证", "确定生产切换窗口"] },
  { id: "outage", icon: "server-crash", title: "区域服务不可用", desc: "区域故障、降级与大面积客户沟通", runs: platformState.playbookRuns.outage ?? 7, updated: "2 周前", steps: ["建立统一事件指挥频道", "确认影响区域与核心路径", "发布首轮客户说明", "每 30 分钟同步进展"] },
  ...platformState.customPlaybooks,
];

function renderPlaybooks() {
  const query = state.search.trim().toLowerCase();
  const visible = playbooks.filter((item) => !query || `${item.title} ${item.desc}`.toLowerCase().includes(query));
  const selected = playbooks.find((item) => item.id === state.moduleDetail) || visible[0] || playbooks[0];
  return `${moduleHead("playbooks", '<button class="button solid" type="button" data-module-action="new-playbook"><i data-lucide="plus"></i>新建手册</button>')}
    <div class="playbook-layout"><section class="module-surface playbook-list">
      <div class="module-section-head"><div><h2>已发布手册</h2><p>${visible.length} 个匹配结果</p></div></div>
      ${visible.map((item) => `<button class="playbook-item ${selected.id === item.id ? "active" : ""}" type="button" data-module-action="open-playbook" data-playbook-id="${item.id}">
        <span><i data-lucide="${item.icon}"></i></span><div><strong>${item.title}</strong><small>${item.desc}</small><em>运行 ${item.runs} 次 · 更新于 ${item.updated}</em></div><i data-lucide="chevron-right"></i>
      </button>`).join("") || '<div class="queue-empty">没有匹配的处置手册</div>'}
    </section><section class="module-surface playbook-detail">
      <span class="page-eyebrow">Published workflow</span><h2>${selected.title}</h2><p>${selected.desc}</p>
      <div class="playbook-steps">${selected.steps.map((step, index) => `<div><b>${index + 1}</b><span><strong>${step}</strong><small>${index < 2 ? "建议在首次响应内完成" : "纳入后续承诺跟踪"}</small></span></div>`).join("")}</div>
      <div class="playbook-run-block"><span>默认目标事件</span><strong>${currentCase().id} · ${currentCase().customer}</strong><small>执行前可改选目标，并预览新增与跳过的动作。</small><button class="button primary" type="button" data-module-action="prepare-playbook" data-playbook-id="${selected.id}"><i data-lucide="play"></i>预览并套用</button></div>
    </section></div>`;
}

const reportSnapshots = {
  "7d": {
    label: "近 7 天",
    range: "8 月 18 日 - 8 月 24 日",
    total: 22,
    metrics: [["首次响应中位数", "21", "m", "较上期慢 3m", "watch"], ["SLA 达标率", "96", "%", "高于目标 4%", "good"], ["平均解决时长", "11", "h", "较上期缩短 3h", "good"], ["承诺逾期", "5", "", "其中 2 起未关闭", "bad"]],
    funnel: [["进入升级", 22, 100], ["30 分钟内响应", 21, 95], ["按时兑现承诺", 17, 77], ["SLA 内解决", 16, 73]],
    trend: [["周一", 5, 92, 88], ["周二", 2, 100, 100], ["周三", 4, 95, 82], ["周四", 3, 97, 91], ["周五", 6, 93, 76], ["周末", 2, 100, 100]],
    reasons: [["产品故障", 36, 18, "$420k"], ["集成配置", 27, 11, "$180k"], ["安全与合规", 23, 8, "$600k"], ["商业流程", 14, 5, "$240k"]],
  },
  "30d": {
    label: "近 30 天",
    range: "7 月 26 日 - 8 月 24 日",
    total: 76,
    metrics: [["首次响应中位数", "18", "m", "较上期快 4m", "good"], ["SLA 达标率", "94", "%", "高于目标 2%", "good"], ["平均解决时长", "14", "h", "较上期缩短 1.8h", "good"], ["承诺逾期", "8", "", "3 起需要复盘", "bad"]],
    funnel: [["进入升级", 76, 100], ["30 分钟内响应", 71, 93], ["按时兑现承诺", 64, 84], ["SLA 内解决", 59, 78]],
    trend: [["第 1 周", 16, 91, 82], ["第 2 周", 19, 94, 86], ["第 3 周", 18, 96, 89], ["本周", 23, 94, 84]],
    reasons: [["产品故障", 38, 16, "$1.1m"], ["集成配置", 27, 12, "$640k"], ["安全与合规", 21, 7, "$920k"], ["商业流程", 14, 4, "$480k"]],
  },
  "90d": {
    label: "近 90 天",
    range: "5 月 27 日 - 8 月 24 日",
    total: 214,
    metrics: [["首次响应中位数", "24", "m", "较上期慢 2m", "watch"], ["SLA 达标率", "92", "%", "达到团队目标", "good"], ["平均解决时长", "17", "h", "较上期缩短 2h", "good"], ["承诺逾期", "12", "", "重复原因占 42%", "bad"]],
    funnel: [["进入升级", 214, 100], ["30 分钟内响应", 196, 92], ["按时兑现承诺", 176, 82], ["SLA 内解决", 160, 75]],
    trend: [["6 月", 68, 90, 80], ["7 月", 70, 92, 83], ["8 月", 76, 94, 84]],
    reasons: [["产品故障", 41, 17, "$2.8m"], ["集成配置", 25, 10, "$1.6m"], ["安全与合规", 19, 8, "$2.1m"], ["商业流程", 15, 5, "$1.2m"]],
  },
};

const reportRiskMeta = {
  "ESC-1842": { signal: "续费窗口今天关闭，CFO 已介入", promise: "42 分钟", promiseState: "临近", tone: "critical" },
  "ESC-1837": { signal: "合同签署等待完整安全答复包", promise: "3.4 小时", promiseState: "待客户", tone: "watch" },
  "ESC-1829": { signal: "明早全员上线，SSO 尚未恢复", promise: "96 分钟", promiseState: "处置中", tone: "watch" },
};

const reportOwners = [
  { name: "林岚", role: "升级负责人", active: 7, response: "16m", sla: 97, load: 88, status: "接近上限" },
  { name: "唐茜", role: "客户成功", active: 5, response: "19m", sla: 95, load: 64, status: "正常" },
  { name: "周启", role: "技术值班", active: 4, response: "22m", sla: 92, load: 72, status: "正常" },
  { name: "韩舟", role: "安全支持", active: 3, response: "28m", sla: 89, load: 46, status: "需关注" },
];

function currentReportSnapshot() {
  return reportSnapshots[state.reportPeriod];
}

function reportSummaryText(snapshot) {
  return `Relay ${snapshot.label}运营摘要（${snapshot.range}）：共 ${snapshot.total} 起升级，SLA 达标率 ${snapshot.metrics[1][1]}%，首次响应中位数 ${snapshot.metrics[0][1]} 分钟，承诺逾期 ${snapshot.metrics[3][1]} 起。当前优先处理 Apex Health 的续费支付事件，并跟进 Northstar Bio 的安全答复包。`;
}

function renderReports() {
  const snapshot = currentReportSnapshot();
  const query = state.search.trim().toLowerCase();
  const riskRows = state.cases.filter((item) => !query || `${item.id} ${item.customer} ${item.owner} ${item.title}`.toLowerCase().includes(query));
  const ownerRows = reportOwners.filter((item) => !query || `${item.name} ${item.role}`.toLowerCase().includes(query));
  const periodControl = `<div class="period-control">${Object.entries({ "7d": "7 天", "30d": "30 天", "90d": "90 天" }).map(([id, label]) => `<button type="button" data-module-action="report-period" data-period="${id}" aria-pressed="${state.reportPeriod === id}">${label}</button>`).join("")}</div>`;
  return `${moduleHead("reports", `<div class="report-head-actions"><button class="button quiet" type="button" data-module-action="copy-report"><i data-lucide="copy"></i>复制摘要</button><button class="button quiet" type="button" data-module-action="export-report"><i data-lucide="download"></i>导出</button>${periodControl}</div>`)}
    <section class="report-briefing">
      <div class="report-briefing-head"><div><span class="page-eyebrow">需要处理</span><h2>本周期运营结论</h2></div><span>${snapshot.range} · 刚刚更新</span></div>
      <div class="report-signals">
        <button type="button" data-module-action="open-case" data-case-id="ESC-1842"><i class="signal-icon critical" data-lucide="clock-alert"></i><span><b>承诺风险</b><strong>2 个客户更新将在 60 分钟内到期</strong><small>Apex Health 的续费窗口最紧迫</small></span><i data-lucide="arrow-up-right"></i></button>
        <button type="button" data-module-action="open-case" data-case-id="ESC-1837"><i class="signal-icon watch" data-lucide="circle-pause"></i><span><b>等待阻塞</b><strong>安全答复已让合同停滞 3.4 小时</strong><small>阻塞集中在统一对外口径</small></span><i data-lucide="arrow-up-right"></i></button>
        <button type="button" data-module-action="open-retros"><i class="signal-icon neutral" data-lucide="repeat-2"></i><span><b>重复问题</b><strong>3 项复盘动作仍未关闭</strong><small>支付重试与 SSO 预警再次出现</small></span><i data-lucide="arrow-up-right"></i></button>
      </div>
    </section>

    <section class="module-stat-strip report-stats">${snapshot.metrics.map(([label, value, unit, delta, tone]) => `<article><span>${label}</span><strong>${value}<small>${unit}</small></strong><small class="metric-delta ${tone}">${delta}</small></article>`).join("")}</section>

    <div class="report-analysis-grid">
      <section class="module-surface report-funnel"><div class="module-section-head"><div><h2>履约漏斗</h2><p>从进入升级到在 SLA 内解决，定位流失环节</p></div><span>${snapshot.label}</span></div><div class="funnel-list">${snapshot.funnel.map(([label, count, percent], index) => `<div><span><b>${label}</b><small>${index ? `较上一步流失 ${snapshot.funnel[index - 1][1] - count} 起` : `${count} 起升级`}</small></span><div><i style="width:${percent}%"></i></div><strong>${percent}%</strong></div>`).join("")}</div><footer><i data-lucide="circle-alert"></i><span><strong>主要损失发生在承诺兑现</strong><small>30 分钟内响应后仍有 ${snapshot.funnel[1][1] - snapshot.funnel[2][1]} 起未按承诺更新时间同步客户</small></span></footer></section>
      <section class="module-surface performance-panel"><div class="module-section-head"><div><h2>周期表现</h2><p>事件量、SLA 与客户承诺兑现率并排比较</p></div><span>目标 SLA 92%</span></div><div class="performance-table"><div class="performance-row performance-head"><span>周期</span><span>事件量</span><span>SLA</span><span>承诺兑现</span></div>${snapshot.trend.map(([label, volume, sla, promise]) => `<div class="performance-row"><strong>${label}</strong><span class="volume-cell"><i style="width:${Math.max(12, Math.min(100, volume / Math.max(...snapshot.trend.map((entry) => entry[1])) * 100))}%"></i><b>${volume}</b></span><span class="rate-cell ${sla < 92 ? "below" : ""}"><b>${sla}%</b><i style="width:${sla}%"></i></span><span class="rate-cell ${promise < 85 ? "below" : ""}"><b>${promise}%</b><i style="width:${promise}%"></i></span></div>`).join("")}</div></section>
    </div>

    <div class="report-detail-grid">
      <section class="module-surface risk-queue" id="reportRiskQueue"><div class="module-section-head"><div><h2>风险客户队列</h2><p>按商业风险和下一次外部承诺排序</p></div><span>${riskRows.length} 个当前事件</span></div><div class="risk-table"><div class="risk-row risk-head"><span>客户与信号</span><span>商业风险</span><span>下一承诺</span><span>负责人</span><span></span></div>${riskRows.map((item) => { const meta = reportRiskMeta[item.id] || { signal: item.title, promise: localTime(new Date(item.deadline)), promiseState: statusLabels[item.status], tone: "watch" }; return `<div class="risk-row"><span class="risk-account"><b>${escapeHtml(item.customer)}</b><small>${escapeHtml(meta.signal)}</small></span><strong>${escapeHtml(item.risk)}</strong><span class="promise-cell ${meta.tone}"><b>${escapeHtml(meta.promise)}</b><small>${escapeHtml(meta.promiseState)}</small></span><span>${escapeHtml(item.owner)}</span><button class="row-action" type="button" data-module-action="open-case" data-case-id="${escapeHtml(item.id)}" aria-label="打开 ${escapeHtml(item.id)}"><i data-lucide="arrow-right"></i></button></div>`; }).join("") || '<div class="queue-empty">没有匹配的风险客户</div>'}</div></section>
      <section class="module-surface reason-panel"><div class="module-section-head"><div><h2>升级原因</h2><p>占比、逾期率与风险金额</p></div></div><div class="reason-matrix"><div class="reason-row reason-head"><span>原因</span><span>占比</span><span>逾期</span><span>风险</span></div>${snapshot.reasons.map(([label, share, breach, arr]) => `<div class="reason-row"><strong>${label}</strong><span><i style="width:${share}%"></i><b>${share}%</b></span><em class="${breach >= 15 ? "bad" : ""}">${breach}%</em><small>${arr}</small></div>`).join("")}</div></section>
    </div>

    <section class="module-surface owner-load"><div class="module-section-head"><div><h2>团队负载</h2><p>识别响应瓶颈与单点压力</p></div><button class="text-action" type="button" data-module-action="open-oncall">调整值班安排<i data-lucide="arrow-right"></i></button></div><div class="owner-load-table"><div class="owner-load-row owner-load-head"><span>成员</span><span>处理中</span><span>响应中位数</span><span>SLA</span><span>负载</span><span>状态</span></div>${ownerRows.map((owner) => `<div class="owner-load-row"><div><span class="owner-avatar">${owner.name.slice(-1)}</span><span><strong>${owner.name}</strong><small>${owner.role}</small></span></div><strong>${owner.active}</strong><span>${owner.response}</span><span>${owner.sla}%</span><span class="load-cell"><i><b style="width:${owner.load}%"></b></i><em>${owner.load}%</em></span><span class="load-status ${owner.status === "接近上限" ? "bad" : owner.status === "需关注" ? "watch" : ""}">${owner.status}</span></div>`).join("") || '<div class="queue-empty">没有匹配的团队成员</div>'}</div></section>`;
}

function renderRetros() {
  const query = state.search.trim().toLowerCase();
  const visible = platformState.retroRecords.filter((item) => !query || `${item.title} ${item.owner} ${item.caseId}`.toLowerCase().includes(query));
  return `${moduleHead("retros", '<button class="button solid" type="button" data-module-action="new-retro"><i data-lucide="plus"></i>发起复盘</button>')}
    <section class="retro-summary"><div><strong>3</strong><span>待关闭改进项</span></div><div><strong>86%</strong><span>按期完成率</span></div><p><i data-lucide="trending-down"></i>重复升级较上月下降 12%</p></section>
    <section class="module-surface"><div class="module-section-head"><div><h2>最近复盘</h2><p>根因和改进动作统一跟踪</p></div><span>${visible.length} 条记录</span></div><div class="retro-list">${visible.map((item) => `<article>
      <label><input type="checkbox" data-retro-id="${item.id}" ${state.retroDone.has(item.id) ? "checked" : ""}><span></span></label><time>${item.date}</time><div><strong>${item.title}</strong><small>${item.caseId} · 负责人 ${item.owner} · ${item.actions} 项改进动作</small></div><span class="state-pill ${item.status === "已完成" || state.retroDone.has(item.id) ? "resolved" : item.status === "待跟进" ? "waiting" : ""}">${state.retroDone.has(item.id) ? "已完成" : item.status}</span><button class="row-action" type="button" data-module-action="open-case" data-case-id="${item.caseId}"><i data-lucide="arrow-right"></i></button>
    </article>`).join("") || '<div class="queue-empty">没有匹配的复盘记录</div>'}</div></section>`;
}

function renderModule() {
  if (state.view === "escalations") return;
  const renderers = { customers: renderCustomers, oncall: renderOncall, playbooks: renderPlaybooks, reports: renderReports, retros: renderRetros };
  elements.modulePane.innerHTML = renderers[state.view]();
  window.lucide?.createIcons();
}

function switchView(view) {
  state.view = view;
  state.moduleDetail = null;
  setContextDrawer(false);
  elements.app.classList.toggle("module-active", view !== "escalations");
  elements.app.classList.remove("mobile-detail");
  document.querySelectorAll("[data-view]").forEach((button) => button.classList.toggle("active", button.dataset.view === view));
  const placeholders = { escalations: "搜索客户、事件或负责人", customers: "搜索客户或负责人", oncall: "搜索值班成员", playbooks: "搜索处置场景", reports: "搜索风险客户或团队成员", retros: "搜索复盘或负责人" };
  elements.caseSearch.placeholder = placeholders[view];
  state.search = "";
  elements.caseSearch.value = "";
  if (view === "escalations") renderQueue();
  else renderModule();
}

function openRetroDialog() {
  elements.retroCaseSelect.innerHTML = state.cases.map((item) => `<option value="${escapeHtml(item.id)}" ${item.id === state.selectedId ? "selected" : ""}>${escapeHtml(item.id)} · ${escapeHtml(item.customer)}</option>`).join("");
  elements.retroDialog.showModal();
}

function playbookDelta(playbook, target) {
  const existing = new Set(target.actions.map((entry) => entry.text));
  return playbook.steps.map((step) => ({ step, exists: existing.has(step) }));
}

function renderPlaybookRunPreview() {
  const playbook = playbooks.find((item) => item.id === elements.runPlaybookForm.elements.playbookId.value);
  const target = state.cases.find((item) => item.id === elements.playbookCaseSelect.value);
  if (!playbook || !target) return;
  const delta = playbookDelta(playbook, target);
  const addedCount = delta.filter((item) => !item.exists).length;
  const confirmButton = elements.runPlaybookForm.querySelector('button[type="submit"]:not([value])');
  confirmButton.disabled = addedCount === 0;
  confirmButton.textContent = addedCount ? `确认加入 ${addedCount} 项` : "没有可新增动作";
  elements.playbookRunPreview.innerHTML = `
    <div class="run-preview-head"><div><span>执行预览</span><strong>${playbook.title}</strong></div><span>${addedCount} 项新增 · ${delta.length - addedCount} 项跳过</span></div>
    <div class="run-target-summary"><span class="priority-mini ${target.priority.toLowerCase()}">${target.priority}</span><div><strong>${target.id} · ${target.customer}</strong><small>${target.title}</small></div></div>
    <div class="run-step-list">${delta.map((item, index) => `<div class="${item.exists ? "exists" : ""}"><span>${index + 1}</span><strong>${item.step}</strong><small>${item.exists ? "案件中已存在，将跳过" : "将新增到处置清单"}</small></div>`).join("")}</div>`;
}

function openPlaybookRunDialog(playbookId) {
  const playbook = playbooks.find((item) => item.id === playbookId);
  if (!playbook) return;
  elements.runPlaybookForm.elements.playbookId.value = playbook.id;
  elements.playbookCaseSelect.innerHTML = state.cases.map((item) => `<option value="${escapeHtml(item.id)}" ${item.id === state.selectedId ? "selected" : ""}>${escapeHtml(item.id)} · ${escapeHtml(item.customer)} · ${escapeHtml(statusLabels[item.status])}</option>`).join("");
  renderPlaybookRunPreview();
  elements.runPlaybookDialog.showModal();
  window.lucide?.createIcons();
}

function toggleAction(actionId, done) {
  const item = currentCase();
  const action = item.actions.find((entry) => entry.id === actionId);
  if (!action) return;
  action.done = done;
  item.timeline.unshift({
    time: localTime(new Date()),
    title: done ? "处置动作已完成" : "处置动作重新打开",
    detail: action.text,
  });
  saveState();
  render();
  showToast(done ? "已完成一项处置动作" : "处置动作已重新打开");
}

const localAnalysisProfiles = [
  { id: "payment", label: "支付与续费", terms: ["支付", "付款", "扣款", "账单", "webhook", "回调", "续费"], actions: [["核对扣款状态与受影响订单", "周启", "首轮响应"], ["重放失败回调并保留回滚点", "周启", "45 分钟"], ["确认备用付款路径并更新客户", "唐茜", "下一承诺"]] },
  { id: "security", label: "安全与合规", terms: ["安全", "权限", "审计", "合规", "数据保留", "问卷", "子处理器"], actions: [["列出真正阻塞审批的未答项", "韩舟", "首轮响应"], ["统一安全、法务与产品口径", "韩舟", "60 分钟"], ["由单一负责人发送完整答复包", "唐茜", "下一承诺"]] },
  { id: "sso", label: "SSO 与身份", terms: ["sso", "idp", "metadata", "元数据", "签名", "证书", "登录"], actions: [["确认租户级与平台级影响范围", "周启", "首轮响应"], ["在 staging 验证元数据或证书轮换", "周启", "45 分钟"], ["与客户确认生产切换窗口", "林岚", "下一承诺"]] },
  { id: "outage", label: "服务可用性", terms: ["不可用", "故障", "宕机", "超时", "延迟", "500", "区域", "服务中断"], actions: [["建立统一事件指挥与信息口径", "林岚", "立即"], ["确认受影响区域和核心请求路径", "周启", "30 分钟"], ["按固定节奏同步客户与内部团队", "林岚", "下一承诺"]] },
];

function localProfileFor(text) {
  const normalized = text.toLowerCase();
  const scored = localAnalysisProfiles.map((profile) => ({
    profile,
    hits: profile.terms.filter((term) => normalized.includes(term.toLowerCase())),
  })).sort((a, b) => b.hits.length - a.hits.length);
  return scored[0].hits.length ? scored[0] : { profile: { id: "general", label: "通用升级", terms: [], actions: [["确认首个异常时间与影响对象", "周启", "首轮响应"], ["建立可验证的恢复或绕行方案", "周启", "60 分钟"], ["按承诺窗口同步客户", "林岚", "下一承诺"]] }, hits: [] };
}

function detectAnalysisScope(item, text) {
  const regions = ["EU", "US", "APAC"].filter((region) => {
    const pattern = new RegExp(`(?:${region}).{0,18}(?:失败|异常|影响|超时|不可用|也出现)|(?:失败|异常|影响|超时|不可用).{0,18}(?:${region})`, "i");
    return pattern.test(text);
  });
  const baseline = ["EU", "US", "APAC"].filter((region) => String(item.impact).toUpperCase().includes(region));
  const combined = [...new Set([...baseline, ...regions])];
  if (combined.length) return { label: `${combined.join("、")} / ${combined.length > 1 ? "多区域" : "待核实对象"}`, expanded: combined.length > Math.max(1, baseline.length) };
  if (/全部租户|所有租户|全量用户/.test(text)) return { label: "全量租户", expanded: true };
  if (/单租户|仅.*租户|只有.*租户/.test(text)) return { label: "单租户", expanded: false };
  return { label: item.impact && item.impact !== "待确认" ? item.impact : "影响范围待核实", expanded: false };
}

function sourceImpactFor(text, profile) {
  const normalized = text.toLowerCase();
  if (profile.id === "payment" && /webhook|回调|重试/.test(normalized)) return "支持支付回调或重试链路假设。";
  if (profile.id === "security" && /权限|保留|法务|问卷/.test(normalized)) return "补充了审批阻塞项和对外口径边界。";
  if (profile.id === "sso" && /metadata|元数据|签名|证书/.test(normalized)) return "提供了身份配置失效的可验证信号。";
  if (profile.id === "outage" && /区域|不可用|延迟|超时|500/.test(normalized)) return "用于判断可用性影响范围和故障级别。";
  if (/续费|上线|合同|cfo|法务|董事会/.test(normalized)) return "明确了客户决策时点和商业风险。";
  return `补充了${profile.label}场景的现场上下文。`;
}

function applyLocalAnalysis(item, replaceDraftActions = false) {
  const sourceText = item.sources.map((source) => `${source.type} ${source.text}`).join("\n");
  const combinedText = `${item.title}\n${item.subtitle}\n${sourceText}`;
  const { profile, hits } = localProfileFor(combinedText);
  const scope = detectAnalysisScope(item, combinedText);
  const sourceTypes = [...new Set(item.sources.map((source) => source.type))];
  const urgency = ["续费", "上线", "合同", "CFO", "法务", "董事会"].filter((term) => combinedText.toLowerCase().includes(term.toLowerCase()));
  const times = [...combinedText.matchAll(/(?:[01]?\d|2[0-3]):[0-5]\d(?:\s*UTC)?/gi)].map((match) => match[0]);
  const nextCommitment = times.at(-1) || localTime(new Date(item.deadline));
  const latestSource = item.sources.at(-1);
  const hitText = hits.length ? hits.slice(0, 4).join("、") : "现场描述";

  const diagnosisByProfile = {
    payment: `当前信息命中${hitText}，最可能的断点位于支付回调、重试或订单状态回写链路。影响范围为${scope.label}。${scope.expanded ? "新增来源表明范围较先前扩大，需要重新核对区域隔离。" : "暂未发现影响继续扩大的证据。"}`,
    security: `阻塞集中在${hitText}相关材料，而不是产品可用性。影响范围为${scope.label}。应先统一安全、法务和产品口径，再由一个负责人对外发送完整答复。`,
    sso: `现象与${hitText}配置失效高度相关。影响范围为${scope.label}。当前最小可逆路径是在 staging 完成轮换验证，再进入生产切换。`,
    outage: `多条来源指向${hitText}相关的服务可用性问题。影响范围为${scope.label}。应先建立统一指挥和区域对照，再决定回滚、降级或绕行。`,
    general: `已归并 ${item.sources.length} 条来源，但尚未命中高置信场景规则。当前影响范围为${scope.label}，需要先验证首个异常时间、受影响对象和最小恢复路径。`,
  };
  item.diagnosis = diagnosisByProfile[profile.id];
  item.facts = [
    `已合并 ${item.sources.length} 条来源，覆盖${sourceTypes.join("、") || "现场描述"}。`,
    `当前影响范围：${scope.label}${scope.expanded ? "，较先前记录有所扩大" : ""}。`,
    urgency.length ? `检测到商业时点：${urgency.slice(0, 3).join("、")}；下一承诺 ${nextCommitment}。` : `尚未提取到明确商业时点；下一承诺 ${nextCommitment}。`,
    latestSource ? `最近来源“${latestSource.type}”补充：${latestSource.text.slice(0, 52)}${latestSource.text.length > 52 ? "…" : ""}` : "等待补充现场来源。",
  ];
  item.evidence = [
    `${profile.label}规则命中：${hitText}`,
    `${sourceTypes.length} 类来源相互补充`,
    scope.expanded ? "检测到影响范围扩大的新信号" : "未检测到范围扩大的明确信号",
  ];
  item.impact = scope.label;
  item.confidence = Math.min(94, 58 + Math.min(20, item.sources.length * 4) + Math.min(12, hits.length * 2) + (sourceTypes.length > 1 ? 4 : 0));
  item.subtitle = `本地规则分析命中“${profile.label}”，已更新判断、事实和处置建议。`;
  item.sources.forEach((source) => { source.impact = sourceImpactFor(source.text, profile); });

  if (replaceDraftActions) item.actions = item.actions.filter((action) => !String(action.id).startsWith("n"));
  const existing = new Set(item.actions.map((action) => action.text));
  const added = profile.actions.filter(([text]) => !existing.has(text)).map(([text, owner, due], index) => ({
    id: `ai-${profile.id}-${Date.now()}-${index}`,
    text,
    owner: owner === "林岚" || owner === "唐茜" ? item.owner : owner,
    due,
    done: false,
  }));
  item.actions.push(...added);
  item.reply = `${item.customer} 团队，你们好。我们已合并 ${item.sources.length} 条现场信息，当前判断属于${profile.label}场景，影响范围为${scope.label}。团队正在${profile.actions[0][0]}，并同步准备可逆的恢复路径。我们会在 ${nextCommitment} 前提供下一次明确更新。`;
  return { profile, scope, added };
}

function reanalyze() {
  if (state.analyzing) return;
  const target = currentCase();
  state.analyzing = true;
  renderBrief(target);
  setTimeout(() => {
    const result = applyLocalAnalysis(target);
    target.timeline.unshift({ time: localTime(new Date()), title: "本地分析已更新判断", detail: `命中${result.profile.label}规则；影响范围：${result.scope.label}；新增 ${result.added.length} 个动作。` });
    state.analyzing = false;
    saveState();
    if (state.selectedId === target.id && state.view === "escalations") render();
    else renderQueue();
    showToast(`分析完成：命中${result.profile.label}，更新 ${result.added.length} 个动作`);
  }, 1100);
}

function addTimeline(title, detail) {
  currentCase().timeline.unshift({ time: localTime(new Date()), title, detail });
}

async function copyText(text, successMessage) {
  try {
    if (typeof window.asteam?.rpc === "function") {
      await window.asteam.rpc("clipboard.writeText", { text });
    } else if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
    } else {
      throw new Error("Clipboard API unavailable");
    }
  } catch {
    const input = document.createElement("textarea");
    input.value = text;
    input.style.position = "fixed";
    input.style.opacity = "0";
    document.body.appendChild(input);
    input.select();
    document.execCommand("copy");
    input.remove();
  }
  showToast(successMessage);
}

function updateClock() {
  const item = currentCase();
  if (!item) return;
  if (item.status === "resolved") {
    elements.slaClock.textContent = "已完成";
    elements.drawerClock.textContent = "已完成";
    elements.slaState.textContent = "已关闭";
    elements.slaProgress.style.width = "100%";
    elements.slaProgress.classList.remove("danger");
    elements.slaLabel.textContent = "案件已完成处置";
    return;
  }
  const remaining = Math.max(0, item.deadline - Date.now());
  const hours = Math.floor(remaining / (60 * minute));
  const minutes = Math.floor((remaining % (60 * minute)) / minute);
  const seconds = Math.floor((remaining % minute) / 1000);
  elements.slaClock.textContent = [hours, minutes, seconds].map((value) => String(value).padStart(2, "0")).join(":");
  elements.drawerClock.textContent = elements.slaClock.textContent;
  const percent = Math.max(0, Math.min(100, (remaining / item.slaTotal) * 100));
  elements.slaProgress.style.width = `${percent}%`;
  elements.slaProgress.classList.toggle("danger", percent < 25);
  elements.slaState.textContent = remaining ? "剩余" : "已超时";
  elements.slaLabel.textContent = `下次更新截止 ${localTime(new Date(item.deadline))}`;
}

function openSourceDialog() {
  const timeInput = elements.sourceForm.elements.time;
  timeInput.value = localTime(new Date());
  elements.sourceDialog.showModal();
}

function exportCurrentCase() {
  const item = currentCase();
  const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), case: item }, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${item.id.toLowerCase()}-record.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  showToast("案件记录已导出");
}

function setContextDrawer(open) {
  elements.contextDrawer.classList.toggle("open", open);
  elements.contextDrawer.setAttribute("aria-hidden", String(!open));
  elements.contextDrawer.inert = !open;
  elements.drawerBackdrop.classList.toggle("open", open);
}

elements.queueFilters.addEventListener("click", (event) => {
  const button = event.target.closest("[data-filter]");
  if (!button) return;
  state.filter = button.dataset.filter;
  elements.queueFilters.querySelectorAll("button").forEach((item) => item.setAttribute("aria-pressed", String(item === button)));
  renderQueue();
});

elements.caseSearch.addEventListener("input", () => {
  state.search = elements.caseSearch.value;
  if (state.view === "escalations") renderQueue();
  else renderModule();
});

elements.caseTabs.addEventListener("click", (event) => {
  const button = event.target.closest("[data-tab]");
  if (!button) return;
  state.tab = button.dataset.tab;
  render();
});

elements.statusSelect.addEventListener("change", () => {
  const item = currentCase();
  item.status = elements.statusSelect.value;
  addTimeline("案件状态已更新", `状态变更为“${statusLabels[item.status]}”。`);
  saveState();
  render();
  showToast(`案件已进入“${statusLabels[item.status]}”`);
});

document.getElementById("newCaseButton").addEventListener("click", () => elements.newCaseDialog.showModal());
document.getElementById("exportCase").addEventListener("click", exportCurrentCase);
document.getElementById("contextToggle").addEventListener("click", () => setContextDrawer(true));
document.getElementById("closeContext").addEventListener("click", () => setContextDrawer(false));
elements.drawerBackdrop.addEventListener("click", () => setContextDrawer(false));
document.getElementById("caseBackButton").addEventListener("click", () => elements.app.classList.remove("mobile-detail"));
document.getElementById("queueRefresh").addEventListener("click", () => {
  renderQueue();
  showToast("队列已刷新");
});

document.getElementById("sendUpdateButton").addEventListener("click", () => {
  state.tab = "brief";
  render();
  document.getElementById("replyEditor")?.focus();
  showToast("客户更新已准备好，请确认后复制");
});

document.getElementById("addStakeholder").addEventListener("click", () => {
  const item = currentCase();
  if (item.people.some((person) => person.name === "赵衡")) {
    showToast("赵衡已在协作成员中");
    return;
  }
  item.people.push({ name: "赵衡", role: "产品支持", initials: "ZH", online: true });
  addTimeline("协作成员已加入", "赵衡 · 产品支持");
  saveState();
  renderContext(item);
  showToast("已添加产品支持赵衡");
});

document.querySelectorAll("[data-view]").forEach((button) => {
  button.addEventListener("click", () => switchView(button.dataset.view));
});

document.querySelector(".product-glyph").addEventListener("click", () => {
  state.filter = "all";
  switchView("escalations");
});

elements.modulePane.addEventListener("click", (event) => {
  const action = event.target.closest("[data-module-action]");
  if (!action) return;
  const type = action.dataset.moduleAction;
  if (type === "open-account") {
    state.moduleDetail = action.dataset.accountId;
    renderModule();
  }
  if (type === "back-accounts") {
    state.moduleDetail = null;
    renderModule();
  }
  if (type === "copy-contact") copyText(action.dataset.contact, "联系人信息已复制");
  if (type === "open-case") {
    state.selectedId = action.dataset.caseId;
    switchView("escalations");
    elements.app.classList.add("mobile-detail");
    state.tab = "brief";
    render();
  }
  if (type === "open-playbook") {
    state.moduleDetail = action.dataset.playbookId;
    renderModule();
  }
  if (type === "prepare-playbook") openPlaybookRunDialog(action.dataset.playbookId);
  if (type === "report-period") {
    state.reportPeriod = action.dataset.period;
    renderModule();
  }
  if (type === "copy-report") {
    copyText(reportSummaryText(currentReportSnapshot()), "运营摘要已复制");
  }
  if (type === "export-report") {
    const snapshot = currentReportSnapshot();
    const data = {
      exportedAt: new Date().toISOString(),
      period: snapshot.label,
      range: snapshot.range,
      summary: reportSummaryText(snapshot),
      metrics: snapshot.metrics.map(([label, value, unit, delta]) => ({ label, value: `${value}${unit}`, delta })),
      funnel: snapshot.funnel.map(([stage, count, rate]) => ({ stage, count, rate })),
      risks: state.cases.map(({ id, customer, title, risk, owner, status }) => ({ id, customer, title, risk, owner, status: statusLabels[status] })),
      team: reportOwners,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `relay-operations-${state.reportPeriod}.json`;
    link.click();
    URL.revokeObjectURL(link.href);
    showToast(`${snapshot.label}运营报告已导出`);
  }
  if (type === "open-retros") switchView("retros");
  if (type === "open-oncall") switchView("oncall");
  if (type === "copy-handoff") {
    copyText(`当前值班：${platformState.currentShift}（升级负责人）、周启（技术值班）。处理中 ${state.cases.filter((item) => item.status !== "resolved").length} 起。备注：${platformState.handoffNote}`, "交接摘要已复制");
  }
  if (type === "save-handoff") {
    const note = document.getElementById("handoffNote");
    platformState.handoffNote = note?.value.trim() || platformState.handoffNote;
    savePlatformState();
    showToast("交接备注已保存");
  }
  if (type === "take-shift") {
    platformState.currentShift = platformState.currentShift === "林岚" ? "唐茜" : "林岚";
    platformState.handoffNote = `${platformState.currentShift} 已接管当前班次，请在 18:00 前完成交接。`;
    savePlatformState();
    renderModule();
    showToast(`${platformState.currentShift} 已接管当前班次`);
  }
  if (type === "open-roster") showToast("林岚 138-0000-0126 · 周启 138-0000-0188");
  if (type === "export-accounts") {
    const data = portfolioAccounts().map(({ id, name, tier, industry, region, valueLabel, renewalDays, csm, health, healthScore, stage, linkedCaseIds }) => ({ id, name, tier, industry, region, value: valueLabel, renewalDays, csm, health, healthScore, stage, linkedCaseIds }));
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "relay-key-accounts.json";
    link.click();
    URL.revokeObjectURL(link.href);
    showToast("客户组合已导出");
  }
  if (type === "new-playbook") elements.playbookDialog.showModal();
  if (type === "new-retro") openRetroDialog();
});

elements.modulePane.addEventListener("change", (event) => {
  const input = event.target.closest("[data-retro-id]");
  if (!input) return;
  if (input.checked) state.retroDone.add(input.dataset.retroId);
  else state.retroDone.delete(input.dataset.retroId);
  savePlatformState();
  renderModule();
  showToast(input.checked ? "改进项已标记完成" : "改进项已重新打开");
});

function toggleFloatingMenu(menu, trigger) {
  const open = menu.hidden;
  [document.getElementById("workspaceMenu"), document.getElementById("profileMenu"), document.getElementById("notificationMenu")].forEach((item) => {
    if (item !== menu) item.hidden = true;
  });
  menu.hidden = !open;
  trigger.setAttribute("aria-expanded", String(open));
}

const workspaceMenu = document.getElementById("workspaceMenu");
const profileMenu = document.getElementById("profileMenu");
const notificationMenu = document.getElementById("notificationMenu");
document.getElementById("workspaceSwitcher").addEventListener("click", (event) => {
  event.stopPropagation();
  toggleFloatingMenu(workspaceMenu, event.currentTarget);
});
document.getElementById("profileButton").addEventListener("click", (event) => {
  event.stopPropagation();
  toggleFloatingMenu(profileMenu, event.currentTarget);
});
document.getElementById("notificationButton").addEventListener("click", (event) => {
  event.stopPropagation();
  toggleFloatingMenu(notificationMenu, event.currentTarget);
});
workspaceMenu.addEventListener("click", (event) => {
  const button = event.target.closest("[data-workspace]");
  if (!button) return;
  const sandbox = button.dataset.workspace === "sandbox";
  document.querySelector(".workspace-switcher strong").textContent = sandbox ? "演练空间" : "Acme Cloud";
  document.querySelector(".workspace-switcher small").textContent = sandbox ? "模拟环境" : "客户运营团队";
  workspaceMenu.hidden = true;
  switchView("escalations");
  showToast(sandbox ? "已切换到演练空间" : "已切换到 Acme Cloud");
});
profileMenu.addEventListener("click", (event) => {
  const button = event.target.closest("[data-profile-action]");
  if (!button) return;
  if (button.dataset.profileAction === "availability") {
    const label = button.querySelector("small");
    label.textContent = label.textContent === "当前在线" ? "暂时离开" : "当前在线";
    showToast(`值班状态已设为${label.textContent}`);
  } else showToast("通知偏好：应用内、邮件、值班电话已开启");
});
notificationMenu.addEventListener("click", (event) => {
  const read = event.target.closest("[data-notification-action]");
  const notice = event.target.closest("[data-case-id]");
  if (read) {
    document.querySelector("#notificationButton > span").hidden = true;
    notificationMenu.querySelectorAll(".notice-dot").forEach((dot) => dot.classList.remove("notice-dot"));
    showToast("通知已全部标记为已读");
  }
  if (notice) {
    state.selectedId = notice.dataset.caseId;
    notificationMenu.hidden = true;
    switchView("escalations");
    elements.app.classList.add("mobile-detail");
    render();
  }
});
document.addEventListener("click", (event) => {
  if (!event.target.closest(".sidebar-menu, .notification-menu, #workspaceSwitcher, #profileButton, #notificationButton")) {
    workspaceMenu.hidden = true;
    profileMenu.hidden = true;
    notificationMenu.hidden = true;
  }
});

elements.newCaseForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const submitter = event.submitter;
  if (submitter?.value === "cancel") {
    elements.newCaseDialog.close();
    return;
  }
  const data = new FormData(elements.newCaseForm);
  const idNumber = Math.max(...state.cases.map((item) => Number(item.id.split("-")[1]) || 0)) + 1;
  const customer = data.get("customer").trim();
  const notes = data.get("notes").trim();
  const owner = data.get("owner");
  const item = {
    id: `ESC-${idNumber}`,
    customer,
    title: notes.split(/[。！!\n]/)[0].slice(0, 42) || `${customer} 新升级事件`,
    subtitle: "现场信息已收录，等待本地规则完成首次归因与处置编排。",
    priority: data.get("priority"),
    status: "investigating",
    risk: data.get("risk").trim(),
    owner,
    impact: "待确认",
    deadline: Date.now() + 60 * minute,
    slaTotal: 60 * minute,
    confidence: 61,
    diagnosis: "首次分析正在核对现场描述中的时间线、影响范围和外部承诺。当前建议先确认受影响对象，再安排单一工程负责人复现。",
    facts: ["客户已明确提出升级诉求。", "商业风险已记录并进入跟踪。", "原始现场信息已保留，可继续补充来源。"],
    reply: `${customer} 团队，你们好。我们已将该问题升级并安排专人处理，目前正在确认影响范围与恢复路径。我们会在一小时内提供下一次明确更新。`,
    actions: [
      { id: `n${idNumber}-1`, text: "确认影响范围与首个异常时间", owner, due: "20 分钟", done: false },
      { id: `n${idNumber}-2`, text: "指定工程负责人并完成首次复现", owner: "周启", due: "40 分钟", done: false },
      { id: `n${idNumber}-3`, text: "向客户发送首次状态更新", owner, due: "60 分钟", done: false },
    ],
    people: [
      { name: owner, role: "升级负责人", initials: owner.slice(-2).toUpperCase(), online: true },
      { name: "周启", role: "值班工程师", initials: "ZQ", online: true },
    ],
    evidence: ["客户描述包含明确业务风险", "原始上下文已保留", "下一次更新窗口已建立"],
    sources: [{ type: "现场描述", time: localTime(new Date()), text: notes, impact: "待首次分析确认。" }],
    timeline: [{ time: localTime(new Date()), title: "升级事件已创建", detail: `${owner} 接管，本地规则开始首次分析。` }],
  };
  state.cases.unshift(item);
  state.selectedId = item.id;
  state.filter = "all";
  state.search = "";
  elements.caseSearch.value = "";
  elements.queueFilters.querySelectorAll("button").forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.filter === "all")));
  elements.newCaseDialog.close();
  elements.newCaseForm.reset();
  state.analyzing = true;
  switchView("escalations");
  elements.app.classList.add("mobile-detail");
  saveState();
  render();
  setTimeout(() => {
    const result = applyLocalAnalysis(item, true);
    item.timeline.unshift({ time: localTime(new Date()), title: "本地规则完成首次归因", detail: `命中${result.profile.label}规则，生成判断、事实、${result.added.length} 个动作和客户更新。` });
    state.analyzing = false;
    saveState();
    render();
    showToast(`新升级事件已创建，命中${result.profile.label}规则`);
  }, 1200);
});

elements.sourceForm.addEventListener("submit", (event) => {
  event.preventDefault();
  if (event.submitter?.value === "cancel") {
    elements.sourceDialog.close();
    return;
  }
  const data = new FormData(elements.sourceForm);
  const item = currentCase();
  item.sources.push({
    type: data.get("type"),
    time: data.get("time"),
    text: data.get("text").trim(),
    impact: "新来源已加入判断范围，等待重新分析。",
  });
  item.evidence.push(`新增${data.get("type")}已纳入核对`);
  addTimeline("新增现场来源", `${data.get("type")}已加入案件。`);
  elements.sourceDialog.close();
  elements.sourceForm.reset();
  state.tab = "brief";
  saveState();
  render();
  reanalyze();
});

elements.playbookCaseSelect.addEventListener("change", renderPlaybookRunPreview);

elements.runPlaybookForm.addEventListener("submit", (event) => {
  event.preventDefault();
  if (event.submitter?.value === "cancel") {
    elements.runPlaybookDialog.close();
    return;
  }
  const playbook = playbooks.find((item) => item.id === elements.runPlaybookForm.elements.playbookId.value);
  const target = state.cases.find((item) => item.id === elements.playbookCaseSelect.value);
  if (!playbook || !target) return;
  const added = playbookDelta(playbook, target).filter((item) => !item.exists).map((item, index) => ({
    id: `pb-${playbook.id}-${Date.now()}-${index}`,
    text: item.step,
    owner: target.owner,
    due: index < 2 ? "首轮响应" : "后续跟进",
    done: false,
  }));
  if (!added.length) {
    showToast("目标案件已包含手册中的全部动作");
    return;
  }
  target.actions.push(...added);
  target.timeline.unshift({ time: localTime(new Date()), title: "已套用处置手册", detail: `${playbook.title} · 新增 ${added.length} 个动作，跳过 ${playbook.steps.length - added.length} 个重复动作。` });
  playbook.runs += 1;
  platformState.playbookRuns[playbook.id] = playbook.runs;
  state.selectedId = target.id;
  saveState();
  savePlatformState();
  state.tab = "brief";
  elements.runPlaybookDialog.close();
  switchView("escalations");
  elements.app.classList.add("mobile-detail");
  render();
  showToast(`“${playbook.title}”已加入 ${target.id}，新增 ${added.length} 个动作`);
});

elements.playbookForm.addEventListener("submit", (event) => {
  event.preventDefault();
  if (event.submitter?.value === "cancel") {
    elements.playbookDialog.close();
    return;
  }
  const data = new FormData(elements.playbookForm);
  const title = data.get("title").trim();
  const steps = data.get("steps").split("\n").map((step) => step.trim()).filter(Boolean);
  const item = {
    id: `custom-${Date.now()}`,
    icon: "list-checks",
    title,
    desc: data.get("description").trim(),
    runs: 0,
    updated: "刚刚",
    steps,
  };
  platformState.customPlaybooks.push(item);
  playbooks.push(item);
  savePlatformState();
  elements.playbookDialog.close();
  elements.playbookForm.reset();
  state.moduleDetail = item.id;
  renderModule();
  showToast(`手册“${title}”已发布`);
});

elements.retroForm.addEventListener("submit", (event) => {
  event.preventDefault();
  if (event.submitter?.value === "cancel") {
    elements.retroDialog.close();
    return;
  }
  const data = new FormData(elements.retroForm);
  const item = {
    id: `r-${Date.now()}`,
    date: new Intl.DateTimeFormat("zh-CN", { month: "2-digit", day: "2-digit" }).format(new Date()).replace("/", "-"),
    title: data.get("title").trim(),
    owner: data.get("owner"),
    status: "进行中",
    actions: 1,
    caseId: data.get("caseId"),
    firstAction: data.get("action").trim(),
  };
  platformState.retroRecords.unshift(item);
  platformState.retroDone.delete(item.id);
  savePlatformState();
  const linked = state.cases.find((entry) => entry.id === item.caseId);
  linked?.timeline.unshift({ time: localTime(new Date()), title: "已发起复盘", detail: `${item.title} · 改进项：${item.firstAction}` });
  saveState();
  elements.retroDialog.close();
  elements.retroForm.reset();
  renderModule();
  showToast(`复盘“${item.title}”已创建`);
});

document.addEventListener("keydown", (event) => {
  if (event.key === "/" && !["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement.tagName)) {
    event.preventDefault();
    elements.caseSearch.focus();
  }
  if (event.key === "Escape") {
    setContextDrawer(false);
    if (elements.newCaseDialog.open) elements.newCaseDialog.close();
    if (elements.sourceDialog.open) elements.sourceDialog.close();
    if (elements.playbookDialog.open) elements.playbookDialog.close();
    if (elements.runPlaybookDialog.open) elements.runPlaybookDialog.close();
    if (elements.retroDialog.open) elements.retroDialog.close();
  }
});

setInterval(updateClock, 1000);
render();
window.lucide?.createIcons();
