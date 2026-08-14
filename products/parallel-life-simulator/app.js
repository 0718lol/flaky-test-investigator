'use strict';

const STORAGE_KEY = 'forked-life-workspace-v2';
const LEGACY_KEY = 'future-life-state';
const WINDOW_SIZE = 5;

const DIMENSIONS = [
  {key: 'body', label: '身体'},
  {key: 'spirit', label: '精神'},
  {key: 'relationship', label: '关系'},
  {key: 'career', label: '事业'},
  {key: 'money', label: '金钱'},
  {key: 'pursuit', label: '追求'},
  {key: 'worldviewChange', label: '观念弹性'},
];

const DEFAULT_DIMENSIONS = {
  body: 68,
  spirit: 74,
  relationship: 62,
  career: 71,
  money: 56,
  pursuit: 79,
  worldviewChange: 48,
};

const BASE_EVENTS = [
  {title: '决定先留下', tag: '起点', sceneKind: 'reflection', sceneTitle: '人生从此刻显影', copy: '她把当下的工作、关系和身体状态，作为一次诚实的记录。', detail: '生活没有突然发生戏剧性的改变，但一些轻微的偏航感已经出现。', relation: '稳定', delta: {body: 2, spirit: -1, career: 1, money: 1}},
  {title: '学会保留余地', tag: '工作', sceneKind: 'career', sceneTitle: '她开始给未来留白', copy: '稳定不再意味着把所有可能性都关上。', detail: '她没有马上换工作，而是固定留出时间学习与尝试。选择增加了，疲惫也随之增加。', relation: '稳定', delta: {body: -2, spirit: 2, career: 4, money: 2}},
  {title: '一次没有出发的旅行', tag: '关系', sceneKind: 'relationship', sceneTitle: '没有发生的事也会留下痕迹', copy: '计划被现实打断，却让一次重要的谈话发生了。', detail: '被取消的计划让彼此对城市、家庭和时间的期待变得具体。', relation: '坦诚', delta: {spirit: 1, relationship: 5, money: 1}},
  {title: '新机会浮出水面', tag: '选择', sceneKind: 'career', sceneTitle: '一个机会开始发光', copy: '一封邮件把她带到原本没有想过的方向。', detail: '新的邀请没有显著提高收入，但工作内容更接近她真正关心的事情。', relation: '稳定', delta: {spirit: 2, career: 6, money: 2, pursuit: 3}},
  {title: '离开熟悉的轨道', tag: '临界点', sceneKind: 'travel', sceneTitle: '一个决定开始改变方向', copy: '她把稳定重新理解成一种可以被选择的东西。', detail: '她先用一段可承受的实验确认方向，而不是让一个冲动替自己决定全部未来。', relation: '稳定', delta: {body: -3, spirit: 4, career: 5, money: -2, pursuit: 5}},
  {title: '共同生活的练习', tag: '关系', sceneKind: 'relationship', sceneTitle: '家变成一项共同决定', copy: '新的默契正在形成，旧的习惯也在发出声响。', detail: '共同生活让抽象的承诺变成每天需要协商的时间、空间和责任。', relation: '靠近', delta: {relationship: 7, money: 1, spirit: 1}},
  {title: '第一次重启', tag: '改写点', sceneKind: 'reflection', sceneTitle: '她允许自己重新开始', copy: '一次失败没有被解释成失败的人生。', detail: '没有达到预期的尝试仍然留下了能力、关系和更准确的自我判断。', relation: '靠近', delta: {spirit: 5, career: 2, money: -2, worldviewChange: 4}},
  {title: '远方的邀请', tag: '迁移', sceneKind: 'travel', sceneTitle: '远方变成一个具体地址', copy: '离开第一次被理解成建设，而不是逃离。', detail: '新的城市带来机会，也要求她重新建立日常与支持网络。', relation: '协商', delta: {body: -2, spirit: 2, career: 4, money: -3, worldviewChange: 5}},
  {title: '更慢的上升', tag: '节奏', sceneKind: 'health', sceneTitle: '生活不再追赶别人', copy: '变慢以后，她终于听见自己的声音。', detail: '她没有更快地成功，却开始更准确地分配注意力。', relation: '清醒', delta: {body: 5, spirit: 6, career: 3, pursuit: 4}},
  {title: '一项长期承诺', tag: '价值', sceneKind: 'career', sceneTitle: '她选择留下某种影响', copy: '未来第一次像一件可以长期照料的事。', detail: '经验被整理成方法，影响力不再只是结果，而是每天的细小选择。', relation: '稳定', delta: {career: 6, money: 4, pursuit: 5}},
  {title: '身体发来提醒', tag: '健康', sceneKind: 'health', sceneTitle: '身体也拥有发言权', copy: '休息从奖励变成了生活的一部分。', detail: '一次健康提醒让她重新安排节奏，持续前进需要新的方式。', relation: '稳定', delta: {body: -8, spirit: -2, career: -1, worldviewChange: 3}},
  {title: '旧愿望回来了', tag: '内在', sceneKind: 'reflection', sceneTitle: '被搁置的愿望重新出现', copy: '有些愿望没有消失，只是在等待合适的语言。', detail: '现在的她拥有更多能力，也更清楚重新接近这个愿望意味着什么。', relation: '亲密', delta: {spirit: 5, pursuit: 7, worldviewChange: 4}},
  {title: '分享一张桌子', tag: '日常', sceneKind: 'relationship', sceneTitle: '人生的尺度变小了', copy: '一个普通的晚上也可以成为值得记住的节点。', detail: '她开始珍惜可重复的日常：吃饭、散步、照顾家人，以及不必被证明的事情。', relation: '亲密', delta: {body: 3, spirit: 5, relationship: 7}},
  {title: '再一次选择未知', tag: '探索', sceneKind: 'travel', sceneTitle: '未知不再让她后退', copy: '她知道代价，却还是愿意走近一点。', detail: '风险被拆成可以观察和承受的部分，未知不再等同于失控。', relation: '亲密', delta: {spirit: 3, career: 5, money: 2, worldviewChange: 5}},
  {title: '她留下的东西', tag: '回望', sceneKind: 'reflection', sceneTitle: '影响开始脱离她本人', copy: '曾经做过的选择，在别人身上继续生长。', detail: '真正留下的不只是职位和数字，还有被认真对待过的人与问题。', relation: '开阔', delta: {spirit: 5, relationship: 3, career: 4, pursuit: 4}},
  {title: '仍然在路上', tag: '开放', sceneKind: 'travel', sceneTitle: '这不是结局', copy: '未来没有被封存，她仍然可以重新出发。', detail: '生命没有被压缩成一条结论，重要的是继续观察和选择的能力。', relation: '开阔', delta: {body: 2, spirit: 5, relationship: 2, career: 2, money: 2, worldviewChange: 5}},
];

const SCENARIOS = {
  '接受新的机会': {
    sceneKind: 'career', relation: ['稳定', '协商', '清醒', '稳定'],
    titles: ['接受新的机会', '陌生的工作节奏', '能力开始被看见', '代价逐渐浮出水面', '重新谈判边界', '一次主动转向', '建立自己的方法', '关系重新校准', '收获更大的选择权', '把经验交给后来者', '下一次远行'],
    tags: ['改写', '工作', '能力', '边界', '转向', '方法'],
    copy: ['她把机会当作一次试验，而不是必须证明的答案。', '新的节奏让她更快成长，也更快看见自己的边界。', '选择权与责任一起增加，她开始重新安排时间。'],
    delta: {body: -3, spirit: 2, relationship: -1, career: 7, money: 4, pursuit: 4, worldviewChange: 3},
  },
  '把关系放在第一位': {
    sceneKind: 'relationship', relation: ['靠近', '坦诚', '亲密', '协商'],
    titles: ['把关系放在第一位', '重新安排共同生活', '一次坦诚的协商', '为彼此留下时间', '家庭进入计划', '一起面对不确定', '更具体的承诺', '关系重新生长', '一张共同的地图', '照顾日常的重量', '仍然一起向前'],
    tags: ['改写', '共同生活', '协商', '家庭', '靠近', '承诺'],
    copy: ['她把一个重要的人放回生活的中心，其他安排开始重新排序。', '抽象的承诺变成可以重复的日常安排。', '两个人开始共同承受不确定，也保留各自的方向。'],
    delta: {body: 1, spirit: 3, relationship: 8, career: -2, money: -1, pursuit: 1, worldviewChange: 3},
  },
  '优先照顾身体与节奏': {
    sceneKind: 'health', relation: ['稳定', '清醒', '靠近', '开阔'],
    titles: ['优先照顾身体与节奏', '重新安排一周', '身体开始恢复', '把休息写进计划', '降低不必要的消耗', '找到可持续的速度', '生活回到手里', '重新选择投入', '更长久的耐心', '分享一种节奏', '慢慢变得稳定'],
    tags: ['改写', '节奏', '恢复', '边界', '日常', '健康'],
    copy: ['她没有把身体当作达成目标的工具，而是把它放回生活本身。', '休息不再只能发生在意外之后。', '她找到一种不靠透支也能持续的速度。'],
    delta: {body: 8, spirit: 6, relationship: 2, career: -1, money: -1, pursuit: 3, worldviewChange: 4},
  },
  '维持现状，继续观察': {
    sceneKind: 'reflection', relation: ['稳定', '坦诚', '清醒', '开阔'],
    titles: ['维持现状，继续观察', '把问题记录下来', '一次小范围试探', '仍然没有急着决定', '答案开始变清楚', '保留改变的余地', '重新定义稳定', '一个温和的转向', '生活出现缝隙', '她知道自己要什么', '继续保持开放'],
    tags: ['改写', '观察', '试探', '记录', '等待', '开放'],
    copy: ['她暂时不急着改变，让真实发生的事情先提供更多信息。', '一次小范围试探让可能性从想象变成了经验。', '答案没有突然出现，只是在观察里变得清楚。'],
    delta: {body: 1, spirit: 2, relationship: 1, career: 1, money: 1, pursuit: 2, worldviewChange: 4},
  },
};

const LONG_TERM_TITLES = {
  career: ['成果开始沉淀', '新的责任进入生活', '重新确认工作的意义', '为下一阶段留出空间', '选择权回到手中'],
  relationship: ['共同生活经受时间检验', '彼此再次校准方向', '日常形成新的默契', '为各自保留空间', '关系进入下一阶段'],
  health: ['节奏经受现实检验', '新的责任需要被安放', '身体与目标再次协商', '可持续成为日常', '继续照顾长期生活'],
  travel: ['陌生逐渐成为日常', '新的关系网络形成', '再次确认留下的理由', '远方有了生活的重量', '下一段路仍然开放'],
  reflection: ['观察开始形成答案', '旧问题换了一种问法', '生活出现新的证据', '再次校准真正的需要', '未来仍然保持开放'],
};

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[character]));
const clone = (value) => JSON.parse(JSON.stringify(value));
const clamp = (value) => Math.max(0, Math.min(100, Math.round(Number(value) || 0)));
const uid = (prefix) => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
const now = () => new Date().toISOString();

function formatDate(value) {
  if (!value) return '刚刚';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString('zh-CN', {month: '2-digit', day: '2-digit'});
}

function normalizeDimensions(input = {}) {
  return Object.fromEntries(DIMENSIONS.map(({key}) => [key, clamp(input[key] ?? DEFAULT_DIMENSIONS[key])]));
}

function deriveNodeDimensions(personDimensions, previous, delta = {}) {
  const base = previous || personDimensions;
  return Object.fromEntries(DIMENSIONS.map(({key}) => {
    const current = Number(base[key] ?? 60);
    const change = Number(delta[key] || 0);
    const room = change >= 0
      ? Math.max(.15, Math.min(1, (100 - current) / 45))
      : Math.max(.2, Math.min(1, current / 45));
    return [key, clamp(current + change * room)];
  }));
}

function normalizeNode(node, person, index) {
  const dimensions = normalizeDimensions(node.dimensions || {
    ...person.dimensions,
    body: node.energy ?? person.dimensions.body,
    spirit: node.energy ?? person.dimensions.spirit,
    relationship: typeof node.relation === 'number' ? node.relation : person.dimensions.relationship,
  });
  return {
    id: node.id || uid('node'),
    year: Number(node.year) || 2026 + index,
    title: node.title || '继续观察',
    tag: node.tag || '开放',
    sceneKind: node.sceneKind || inferSceneKind(node.tag),
    sceneCode: node.sceneCode || node.scene || `YEAR ${String(index + 1).padStart(2, '0')}`,
    sceneTitle: node.sceneTitle || node.title || '未来仍然打开',
    copy: node.copy || '新的事情正在发生。',
    detail: node.detail || '这是一段仍在展开的生活。',
    relation: node.relation || '稳定',
    dimensions,
  };
}

function inferSceneKind(tag = '') {
  if (/关系|日常|家庭/.test(tag)) return 'relationship';
  if (/健康|节奏|恢复/.test(tag)) return 'health';
  if (/迁移|探索|远方/.test(tag)) return 'travel';
  if (/工作|价值|机会|事业/.test(tag)) return 'career';
  return 'reflection';
}

function buildInitialNodes(person, startYear = 2026, horizon = 15) {
  let dimensions = normalizeDimensions(person.dimensions);
  return Array.from({length: horizon + 1}, (_, index) => {
    const event = BASE_EVENTS[index] || {
      title: index % 5 === 0 ? '进入新的五年' : '继续调整方向',
      tag: index % 5 === 0 ? '阶段' : '开放',
      sceneKind: index % 2 ? 'reflection' : 'travel',
      sceneTitle: '未来仍在展开',
      copy: '生活没有停在原地，新的关系和选择继续出现。',
      detail: '这段未来仍然会受到真实经历和下一次选择的影响。',
      relation: '开放',
      delta: {spirit: 2, worldviewChange: 2},
    };
    dimensions = deriveNodeDimensions(person.dimensions, dimensions, event.delta);
    return {
      id: uid('node'),
      year: startYear + index,
      title: event.title,
      tag: event.tag,
      sceneKind: event.sceneKind,
      sceneCode: `OBSERVING / ${String(index + 1).padStart(2, '0')}`,
      sceneTitle: event.sceneTitle,
      copy: event.copy,
      detail: `${person.name}${event.detail}`,
      relation: event.relation,
      dimensions: clone(dimensions),
    };
  });
}

function makeVersion(person, name = '初始推演', startYear = 2026, horizon = 15) {
  const nodes = buildInitialNodes(person, startYear, horizon);
  return {id: uid('version'), name, createdAt: now(), nodes, selectedIndex: Math.min(4, nodes.length - 1)};
}

function makePerson(input) {
  const person = {
    id: input.id || uid('person'),
    kind: input.kind || 'self',
    name: input.name || '未命名人物',
    pronoun: input.pronoun || '她',
    age: String(input.age || '29'),
    city: input.city || '未设定',
    job: input.job || '自由职业',
    living: input.living || '未设定',
    pursuit: input.pursuit || '尚未明确',
    worldview: input.worldview || '保持开放',
    reality: input.reality || 'balanced',
    dimensions: normalizeDimensions(input.dimensions),
    inferred: input.inferred || {},
    versions: [],
    activeVersionId: null,
    history: input.history || [],
    createdAt: input.createdAt || now(),
  };
  const version = makeVersion(person);
  person.versions = [version];
  person.activeVersionId = version.id;
  person.history.unshift({id: uid('history'), timestamp: now(), title: '初始推演已建立', meta: `${version.nodes.length} 个年度节点`});
  return person;
}

function createDefaultState() {
  const lin = makePerson({
    kind: 'self', name: '林默', pronoun: '她', age: 29, city: '上海', job: '产品经理',
    living: '独居，与伴侣保持稳定关系',
    pursuit: '做出真正有用的东西，同时保留自己的生活',
    worldview: '在稳定中寻找变化',
    dimensions: DEFAULT_DIMENSIONS,
  });
  const zhou = makePerson({
    kind: 'character', name: '周予安', pronoun: '他', age: 34, city: '成都', job: '建筑师',
    living: '与家人同城，保持独立生活',
    pursuit: '建立自己的工作室，做能够长期留下的空间',
    worldview: '谨慎地冒险',
    dimensions: {body: 72, spirit: 66, relationship: 70, career: 64, money: 59, pursuit: 83, worldviewChange: 55},
  });
  return {schemaVersion: 2, activePersonId: lin.id, view: 'people', people: [lin, zhou]};
}

function normalizePerson(person) {
  const normalized = {
    ...person,
    id: person.id || uid('person'),
    kind: person.kind || 'self',
    pronoun: person.pronoun || '她',
    reality: person.reality || 'balanced',
    dimensions: normalizeDimensions(person.dimensions),
    history: Array.isArray(person.history) ? person.history : [],
  };
  normalized.versions = (Array.isArray(person.versions) ? person.versions : []).map((version) => ({
    ...version,
    id: version.id || uid('version'),
    createdAt: version.createdAt || now(),
    nodes: (version.nodes || []).map((node, index) => normalizeNode(node, normalized, index)),
    selectedIndex: Math.max(0, Math.min(Number(version.selectedIndex ?? version.selected ?? 0), Math.max(0, (version.nodes || []).length - 1))),
  }));
  if (!normalized.versions.length) normalized.versions = [makeVersion(normalized)];
  normalized.versions.forEach((version) => {
    if (!version.nodes.length) {
      version.nodes = buildInitialNodes(normalized);
      version.selectedIndex = Math.min(4, version.nodes.length - 1);
    }
  });
  normalized.activeVersionId = normalized.versions.some((version) => version.id === person.activeVersionId)
    ? person.activeVersionId
    : normalized.versions[0].id;
  return normalized;
}

function migrateLegacy(legacy) {
  const legacyPerson = legacy.person || {};
  const person = {
    id: uid('person'),
    kind: 'self',
    name: legacyPerson.name || '林默',
    pronoun: legacyPerson.pronoun || '她',
    age: String(legacyPerson.age || '29'),
    city: legacyPerson.city || '未设定',
    job: legacyPerson.job || '自由职业',
    living: legacyPerson.living || '未设定',
    pursuit: legacyPerson.pursuit || '尚未明确',
    worldview: legacyPerson.worldview || '保持开放',
    reality: 'balanced',
    dimensions: normalizeDimensions(legacyPerson.dimensions),
    inferred: legacyPerson.inferred || {},
    versions: [],
    activeVersionId: null,
    history: (legacy.history || []).map((entry) => ({id: uid('history'), timestamp: now(), ...entry})),
    createdAt: now(),
  };
  const legacyVersions = Array.isArray(legacy.versions) && legacy.versions.length
    ? legacy.versions
    : [{name: '初始推演', nodes: legacy.nodes || [], selected: legacy.selected || 0, active: true}];
  person.versions = legacyVersions.map((version) => ({
    id: uid('version'),
    name: version.name || '未命名版本',
    createdAt: now(),
    nodes: (version.nodes || legacy.nodes || []).map((node, index) => normalizeNode(node, person, index)),
    selectedIndex: Number(version.selected ?? legacy.selected ?? 0),
  }));
  const activeIndex = Math.max(0, legacyVersions.findIndex((version) => version.active));
  person.activeVersionId = person.versions[activeIndex]?.id || person.versions[0].id;
  return {schemaVersion: 2, activePersonId: person.id, view: 'people', people: [normalizePerson(person)]};
}

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (saved?.schemaVersion === 2 && Array.isArray(saved.people)) {
      const people = saved.people.map(normalizePerson);
      return {...saved, people, activePersonId: people.some((person) => person.id === saved.activePersonId) ? saved.activePersonId : people[0]?.id, view: 'people'};
    }
  } catch (_) {}
  try {
    const legacy = JSON.parse(localStorage.getItem(LEGACY_KEY));
    if (legacy?.person || legacy?.nodes) return migrateLegacy(legacy);
  } catch (_) {}
  return createDefaultState();
}

let state = loadState();
const ui = {
  view: state.view || 'people',
  draft: null,
  windowStart: 0,
  modal: null,
  compareA: null,
  compareB: null,
};

function activePerson() {
  return state.people.find((person) => person.id === state.activePersonId) || state.people[0] || null;
}

function activeVersion(person = activePerson()) {
  if (!person) return null;
  return person.versions.find((version) => version.id === person.activeVersionId) || person.versions[0] || null;
}

function currentNodes() {
  return ui.draft?.personId === activePerson()?.id ? ui.draft.nodes : activeVersion()?.nodes || [];
}

function currentSelectedIndex() {
  return ui.draft?.personId === activePerson()?.id ? ui.draft.selectedIndex : activeVersion()?.selectedIndex || 0;
}

function persist() {
  state.view = ui.view;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function addHistory(person, title, meta) {
  person.history.unshift({id: uid('history'), timestamp: now(), title, meta});
  person.history = person.history.slice(0, 40);
}

function render() {
  const person = activePerson();
  $$('.nav-item').forEach((button) => button.classList.toggle('active', button.dataset.nav === ui.view));
  renderRailPerson(person);
  const main = $('#mainContent');
  if (ui.view === 'profile') main.innerHTML = renderProfile(person);
  else if (ui.view === 'simulate') main.innerHTML = renderSimulator(person);
  else if (ui.view === 'compare') main.innerHTML = renderCompare(person);
  else main.innerHTML = renderPeople();
  main.focus({preventScroll: true});
}

function renderRailPerson(person) {
  const target = $('#railPerson');
  if (!person) {
    target.innerHTML = '';
    return;
  }
  target.innerHTML = `<button type="button" data-nav="profile"><span class="mini-avatar">${esc(person.name.slice(0, 1))}</span><span><strong>${esc(person.name)}</strong><small>${esc(person.city)} · ${esc(person.job)}</small></span></button>`;
}

function viewHeader(kicker, title, subtitle, actions = '') {
  return `<header class="view-header"><div><div class="eyebrow">${esc(kicker)}</div><h1>${esc(title)}</h1><p>${esc(subtitle)}</p></div><div class="header-actions">${actions}</div></header>`;
}

function renderPeople() {
  const totalVersions = state.people.reduce((sum, person) => sum + person.versions.length, 0);
  const totalNodes = state.people.reduce((sum, person) => sum + person.versions.reduce((count, version) => count + version.nodes.length, 0), 0);
  const activities = state.people.flatMap((person) => person.history.map((entry) => ({...entry, personName: person.name})))
    .sort((a, b) => String(b.timestamp).localeCompare(String(a.timestamp))).slice(0, 6);
  return `<section class="view people-view">
    ${viewHeader('PERSON SPACE / LOCAL', '人物空间', '人物、画像与已经保存的未来版本', `<button class="button primary" type="button" data-action="new-person">创建人物</button>`)}
    <div class="stats-band">
      <div class="stat"><span>人物</span><strong>${state.people.length}</strong><small>自我与观察人物</small></div>
      <div class="stat"><span>推演版本</span><strong>${totalVersions}</strong><small>已保存路径</small></div>
      <div class="stat"><span>年度节点</span><strong>${totalNodes}</strong><small>所有版本合计</small></div>
      <div class="stat"><span>存储</span><strong>LOCAL</strong><small>当前设备</small></div>
    </div>
    <div class="section-heading"><h2>人物</h2><span>${state.people.length} 个观察对象</span></div>
    <div class="people-grid">
      ${state.people.map(renderPersonCard).join('')}
      <button class="add-person" type="button" data-action="new-person"><span>＋</span><strong>创建人物</strong></button>
    </div>
    <section class="recent-strip">
      <div class="section-heading"><h2>最近记录</h2><span>本地历史</span></div>
      <div class="activity-list">${activities.length ? activities.map((entry) => `<div class="activity"><time>${formatDate(entry.timestamp)}</time><p>${esc(entry.title)}</p><small>${esc(entry.personName)} · ${esc(entry.meta || '')}</small></div>`).join('') : '<div class="activity"><time>--</time><p>还没有保存记录</p><small></small></div>'}</div>
    </section>
  </section>`;
}

function renderPersonCard(person) {
  const version = activeVersion(person);
  return `<button class="person-card" type="button" data-action="open-person" data-person="${esc(person.id)}">
    <div class="person-card-head"><span class="avatar">${esc(person.name.slice(0, 1))}</span><div><h3>${esc(person.name)}</h3><div class="identity">${esc(person.age)} 岁 · ${esc(person.city)} · ${esc(person.job)}</div></div></div>
    <p class="pursuit">${esc(person.pursuit)}</p>
    <div class="person-card-foot"><span>${person.kind === 'self' ? '自我探索' : '观察人物'}</span><span><strong>${person.versions.length}</strong> 个版本 · 至 ${version?.nodes.at(-1)?.year || '--'}</span></div>
  </button>`;
}

function renderProfile(person) {
  if (!person) return renderNoPerson();
  const version = activeVersion(person);
  const identity = [
    ['身份', person.job], ['城市', person.city], ['年龄', `${person.age} 岁`],
    ['生活关系', person.living], ['目前看法', person.worldview], ['现实强度', person.reality === 'grounded' ? '更现实' : person.reality === 'gentle' ? '克制' : '平衡'],
  ];
  const actions = `<button class="button" type="button" data-action="edit-person">编辑画像</button><button class="button primary" type="button" data-nav="simulate">进入推演</button>`;
  return `<section class="view profile-view">
    ${viewHeader('PERSON PROFILE', `${person.name}的人物档案`, '基础画像影响之后的新推演，不改写已经保存的版本', actions)}
    <div class="profile-layout">
      <aside class="portrait-panel">
        <div class="eyebrow">${person.kind === 'self' ? 'SELF / EXPLORATION' : 'CHARACTER / OBSERVER'}</div>
        <div class="avatar">${esc(person.name.slice(0, 1))}</div>
        <h2>${esc(person.name)}</h2>
        <div class="portrait-meta">${esc(person.age)} 岁 · ${esc(person.city)}<br>${esc(person.job)}</div>
        <div class="portrait-pursuit">${esc(person.pursuit)}</div>
        <div class="version-count">${person.versions.length} 个已保存版本 · 当前 ${esc(version?.name || '--')}</div>
      </aside>
      <div class="profile-content">
        <section class="profile-band"><h2>生活上下文</h2><div class="identity-table">${identity.map(([label, value]) => `<div class="identity-cell"><span>${esc(label)}</span><strong>${esc(value)}</strong></div>`).join('')}</div></section>
        <section class="profile-band"><div class="section-heading"><h2>起始画像</h2><span>0–100</span></div><div class="dimension-list">${DIMENSIONS.map(({key, label}) => renderDimension(label, person.dimensions[key])).join('')}</div></section>
        <section class="profile-band"><div class="section-heading"><h2>推演版本</h2><button class="button quiet" type="button" data-nav="compare">版本对照</button></div><div class="version-table">${person.versions.map((item) => `<div class="version-table-row"><strong>${esc(item.name)}</strong><span>${item.nodes[0]?.year || '--'}—${item.nodes.at(-1)?.year || '--'}</span><small>${formatDate(item.createdAt)}</small><button class="button quiet" type="button" data-action="open-version" data-version="${esc(item.id)}">打开</button></div>`).join('')}</div></section>
      </div>
    </div>
  </section>`;
}

function renderDimension(label, value) {
  return `<div class="dimension-row"><span>${esc(label)}</span><div class="bar"><i style="width:${clamp(value)}%"></i></div><strong>${clamp(value)}</strong></div>`;
}

function ensureWindow(selected, length) {
  const maxStart = Math.max(0, length - WINDOW_SIZE);
  if (selected < ui.windowStart) ui.windowStart = selected;
  if (selected >= ui.windowStart + WINDOW_SIZE) ui.windowStart = selected - WINDOW_SIZE + 1;
  ui.windowStart = Math.max(0, Math.min(ui.windowStart, maxStart));
}

function renderSimulator(person) {
  if (!person) return renderNoPerson();
  const version = activeVersion(person);
  const nodes = currentNodes();
  const selectedIndex = Math.max(0, Math.min(currentSelectedIndex(), nodes.length - 1));
  ensureWindow(selectedIndex, nodes.length);
  const selected = nodes[selectedIndex];
  const visible = nodes.slice(ui.windowStart, ui.windowStart + WINDOW_SIZE);
  const windowEnd = ui.windowStart + visible.length - 1;
  const draft = ui.draft?.personId === person.id ? ui.draft : null;
  const actions = `${draft ? '<button class="button danger" type="button" data-action="discard-draft">放弃改写</button>' : ''}<button class="button" type="button" data-action="simulation-settings">推演设置</button><button class="button" type="button" data-action="extend-five">继续五年</button><button class="button primary" type="button" data-action="save-version" ${draft ? '' : 'disabled'}>保存新版本</button>`;
  return `<section class="view simulate-view">
    ${viewHeader('LIFE SIMULATION', `${person.name}的时间推演`, `${version?.name || '当前版本'}${draft ? ' · 未保存改写' : ''}`, actions)}
    <div class="sim-layout">
      <section class="sim-main">
        <div class="sim-toolbar"><h2>五年窗口 <span>完整轨迹 ${nodes[0]?.year || '--'}—${nodes.at(-1)?.year || '--'}</span></h2><div class="window-controls"><button class="icon-button" type="button" data-action="window-prev" aria-label="前五年">‹</button><span>${visible[0]?.year || '--'}—${visible.at(-1)?.year || '--'}</span><button class="icon-button" type="button" data-action="window-next" aria-label="后五年">›</button></div></div>
        <div class="life-overview"><div class="overview-track" style="--node-count:${nodes.length}">${nodes.map((node, index) => `<button class="overview-dot ${index >= ui.windowStart && index <= windowEnd ? 'in-window' : ''} ${index === selectedIndex ? 'selected' : ''}" type="button" data-action="select-node" data-index="${index}" aria-label="${node.year} ${esc(node.title)}"></button>`).join('')}</div></div>
        <div class="timeline-window">${visible.map((node, offset) => `<button class="year-node ${ui.windowStart + offset === selectedIndex ? 'selected' : ''}" type="button" data-action="select-node" data-index="${ui.windowStart + offset}"><time>${node.year}</time><strong>${esc(node.title)}</strong><span>${esc(node.tag)}</span></button>`).join('')}</div>
        ${renderSelectedNode(selected, selectedIndex)}
      </section>
      <aside class="sim-side">
        <section><div class="side-head"><h2>当前人物</h2><button class="text-action" type="button" data-nav="profile">档案</button></div><div class="side-body"><div class="current-person"><span class="mini-avatar">${esc(person.name.slice(0, 1))}</span><div><strong>${esc(person.name)}</strong><small>${esc(person.city)} · ${esc(person.job)}</small></div></div></div></section>
        ${draft ? `<section><div class="side-head"><h2>未保存改写</h2></div><div class="side-body"><div class="draft-state">从 ${nodes[draft.startIndex]?.year || '--'} 年开始，${draft.changedCount} 个节点已经重新推演。</div></div></section>` : ''}
        <section><div class="side-head"><h2>已保存版本</h2><button class="text-action" type="button" data-nav="compare">对照</button></div><div class="side-body"><div class="side-version-list">${person.versions.map((item) => `<button class="side-version ${item.id === person.activeVersionId ? 'active' : ''}" type="button" data-action="open-version" data-version="${esc(item.id)}"><strong>${esc(item.name)}</strong><small>${item.nodes[0]?.year || '--'}—${item.nodes.at(-1)?.year || '--'} · ${formatDate(item.createdAt)}</small></button>`).join('')}</div></div></section>
      </aside>
    </div>
  </section>`;
}

function renderSelectedNode(node, index) {
  if (!node) return '';
  const signals = DIMENSIONS.slice(0, 5).map(({key, label}) => `<div class="node-signal"><span>${label}</span><strong>${node.dimensions[key]}</strong><div class="bar"><i style="width:${node.dimensions[key]}%"></i></div></div>`).join('');
  return `<div class="scene-stage" data-scene="${esc(node.sceneKind)}"><div class="scene-content"><div class="scene-code">${esc(node.sceneCode)}</div><h3>${esc(node.sceneTitle)}</h3><p>${esc(node.copy)}</p></div></div>
    <div class="node-detail"><div class="node-detail-head"><div><time>${node.year} · 全年</time><h2>${esc(node.title)}</h2></div><div class="eyebrow">NODE ${String(index + 1).padStart(2, '0')}</div></div><p class="node-detail-copy">${esc(node.detail)}</p><div class="node-signals">${signals}</div><div class="node-actions"><button class="button primary" type="button" data-action="rewrite-node">改写这个节点</button></div></div>`;
}

function renderCompare(person) {
  if (!person) return renderNoPerson();
  if (person.versions.length < 2) {
    return `<section class="view compare-view">${viewHeader('VERSION COMPARE', `${person.name}的版本对照`, '已保存版本之间的变化')}<div class="empty-state"><div><strong>还没有第二个版本</strong><p>从任意时间节点改写并保存后，版本会出现在这里。</p><button class="button primary" type="button" data-nav="simulate">进入推演</button></div></div></section>`;
  }
  const a = person.versions.find((version) => version.id === ui.compareA) || person.versions[0];
  const b = person.versions.find((version) => version.id === ui.compareB && version.id !== a.id) || person.versions.find((version) => version.id !== a.id);
  ui.compareA = a.id;
  ui.compareB = b.id;
  const lastA = a.nodes.at(-1);
  const lastB = b.nodes.at(-1);
  const years = [...new Set([...a.nodes.map((node) => node.year), ...b.nodes.map((node) => node.year)])].sort((x, y) => x - y);
  const options = (selected) => person.versions.map((version) => `<option value="${esc(version.id)}" ${version.id === selected ? 'selected' : ''}>${esc(version.name)}</option>`).join('');
  return `<section class="view compare-view">
    ${viewHeader('VERSION COMPARE', `${person.name}的版本对照`, '同一年份、不同选择', `<button class="button" type="button" data-nav="simulate">返回推演</button>`)}
    <div class="compare-controls"><div class="field"><label>版本 A</label><select id="compareA" data-action="compare-select">${options(a.id)}</select></div><div class="versus">VS</div><div class="field"><label>版本 B</label><select id="compareB" data-action="compare-select">${options(b.id)}</select></div></div>
    <div class="compare-summary">${renderCompareColumn(a, lastA)}${renderCompareColumn(b, lastB)}</div>
    <div class="compare-timeline">${years.map((year) => { const nodeA = a.nodes.find((node) => node.year === year); const nodeB = b.nodes.find((node) => node.year === year); const changed = nodeA?.title !== nodeB?.title; return `<div class="compare-row"><time>${year}</time><div class="compare-event ${changed ? 'changed' : ''}">${esc(nodeA?.title || '—')}</div><div class="compare-event ${changed ? 'changed' : ''}">${esc(nodeB?.title || '—')}</div></div>`; }).join('')}</div>
  </section>`;
}

function renderCompareColumn(version, node) {
  return `<section class="compare-column"><h2>${esc(version.name)}</h2><p>${version.nodes[0]?.year || '--'}—${version.nodes.at(-1)?.year || '--'} · ${version.nodes.length} 个节点</p><div class="compare-metrics">${DIMENSIONS.slice(0, 5).map(({key, label}) => `<div class="compare-metric"><span>${label}</span><strong>${node?.dimensions[key] ?? '--'}</strong></div>`).join('')}</div></section>`;
}

function renderNoPerson() {
  return `<section class="view">${viewHeader('PERSON SPACE', '还没有人物', '创建人物后开始推演')}<div class="empty-state"><div><strong>创建第一个人物</strong><p>人物画像将成为之后推演的起点。</p><button class="button primary" type="button" data-action="new-person">创建人物</button></div></div></section>`;
}

function navigate(view) {
  if (!['people', 'profile', 'simulate', 'compare'].includes(view)) return;
  if (!activePerson() && view !== 'people') view = 'people';
  ui.view = view;
  state.view = view;
  persist();
  render();
}

function selectPerson(personId, nextView = 'profile') {
  if (ui.draft && ui.draft.personId !== personId && !window.confirm('当前人物有未保存改写，切换人物会放弃它。继续吗？')) return;
  ui.draft = null;
  state.activePersonId = personId;
  ui.windowStart = 0;
  persist();
  navigate(nextView);
}

function selectNode(index) {
  const nodes = currentNodes();
  index = Math.max(0, Math.min(Number(index), nodes.length - 1));
  if (ui.draft) ui.draft.selectedIndex = index;
  else if (activeVersion()) {
    activeVersion().selectedIndex = index;
    persist();
  }
  ensureWindow(index, nodes.length);
  render();
}

function switchVersion(versionId) {
  const person = activePerson();
  if (!person) return;
  if (ui.draft && !window.confirm('当前有未保存改写，切换版本会放弃它。继续吗？')) return;
  ui.draft = null;
  person.activeVersionId = versionId;
  ui.windowStart = 0;
  persist();
  navigate('simulate');
}

function rebuildFuture(nodes, startIndex, choice, range, versionName, person) {
  const profile = SCENARIOS[choice] || SCENARIOS['维持现状，继续观察'];
  const strength = Math.max(.35, Number(range || 55) / 55);
  const reality = person.reality === 'grounded'
    ? {positive: .85, negative: 1.2}
    : person.reality === 'gentle'
      ? {positive: .75, negative: .75}
      : {positive: 1, negative: 1};
  const rebuilt = nodes.slice(0, startIndex).map(clone);
  for (let index = startIndex; index < nodes.length; index += 1) {
    const node = nodes[index];
    const offset = index - startIndex;
    const multiplier = Math.max(.08, Math.exp(-offset / 3.6)) * strength;
    const delta = Object.fromEntries(DIMENSIONS.map(({key}) => {
      const effect = profile.delta[key] || 0;
      return [key, effect * multiplier * (effect >= 0 ? reality.positive : reality.negative)];
    }));
    const baseDimensions = rebuilt.at(-1)?.dimensions || person.dimensions;
    const dimensions = deriveNodeDimensions(person.dimensions, baseDimensions, delta);
    const longTermTitles = LONG_TERM_TITLES[profile.sceneKind] || LONG_TERM_TITLES.reflection;
    const title = offset === 0 ? choice : profile.titles[offset] || longTermTitles[(offset - profile.titles.length) % longTermTitles.length];
    const copy = profile.copy[offset % profile.copy.length];
    rebuilt.push({
      ...clone(node),
      id: uid('node'),
      title,
      tag: profile.tags[offset % profile.tags.length],
      sceneKind: profile.sceneKind,
      sceneCode: `REWRITE / ${String(offset + 1).padStart(2, '0')}`,
      sceneTitle: offset === 0 ? versionName : title,
      copy,
      detail: offset === 0
        ? `${person.name}从这一年开始选择了“${choice}”。接下来的 ${nodes.length - startIndex} 个节点因此重新排列。`
        : `${copy}${person.pronoun}仍然需要根据真实发生的事情校准方向。`,
      relation: profile.relation[offset % profile.relation.length],
      dimensions,
    });
  }
  return rebuilt;
}

function openRewriteModal() {
  const person = activePerson();
  const nodes = currentNodes();
  const index = currentSelectedIndex();
  const node = nodes[index];
  if (!person || !node) return;
  openModal({
    type: 'rewrite',
    kicker: `REWRITE / ${node.year}`,
    title: '改写这个节点',
    confirm: '确认改写',
    body: `<div class="rewrite-context"><span>${node.year} · 当前节点</span><strong>${esc(node.title)}</strong></div>
      <div class="field"><label>保存后的版本名称</label><input id="rewriteName" value="另一种可能" placeholder="例如：先去远方"></div>
      <div class="field"><label>关键选择</label><select id="rewriteChoice">${Object.keys(SCENARIOS).map((choice) => `<option>${esc(choice)}</option>`).join('')}</select></div>
      <div class="range-field"><label>变化幅度</label><div class="range-line"><input id="rewriteRange" type="range" min="20" max="90" value="55"><output id="rewriteRangeValue">55</output></div><small>影响后续节点的状态变化幅度</small></div>`,
  });
  $('#rewriteRange').addEventListener('input', (event) => { $('#rewriteRangeValue').textContent = event.target.value; });
}

function applyRewrite() {
  const person = activePerson();
  const version = activeVersion(person);
  if (!person || !version) return;
  const source = currentNodes();
  const startIndex = currentSelectedIndex();
  const name = $('#rewriteName').value.trim() || '未命名改写';
  const choice = $('#rewriteChoice').value;
  const range = Number($('#rewriteRange').value);
  const nodes = rebuildFuture(source, startIndex, choice, range, name, person);
  ui.draft = {personId: person.id, baseVersionId: version.id, name, choice, range, startIndex, changedCount: nodes.length - startIndex, selectedIndex: startIndex, nodes};
  closeModal();
  render();
  showToast(`已从 ${nodes[startIndex].year} 年开始重新推演`);
}

function saveDraftVersion() {
  const person = activePerson();
  if (!person || !ui.draft || ui.draft.personId !== person.id) return;
  const version = {id: uid('version'), name: ui.draft.name, createdAt: now(), nodes: clone(ui.draft.nodes), selectedIndex: ui.draft.selectedIndex};
  person.versions.unshift(version);
  person.activeVersionId = version.id;
  addHistory(person, `已保存「${version.name}」`, `${version.nodes.length} 个年度节点 · 新版本`);
  ui.draft = null;
  persist();
  render();
  showToast('新版本已保存');
}

function discardDraft() {
  if (!ui.draft) return;
  ui.draft = null;
  render();
  showToast('已放弃未保存改写');
}

function extendFiveYears() {
  const person = activePerson();
  const version = activeVersion(person);
  if (!person || !version) return;
  const source = clone(currentNodes());
  let dimensions = source.at(-1)?.dimensions || person.dimensions;
  for (let offset = 1; offset <= 5; offset += 1) {
    const index = source.length;
    const event = BASE_EVENTS[index] || BASE_EVENTS[(index % 5) + 8];
    dimensions = deriveNodeDimensions(person.dimensions, dimensions, event.delta || {spirit: 2, worldviewChange: 2});
    source.push({id: uid('node'), year: source.at(-1).year + 1, title: event.title, tag: offset === 5 ? '阶段' : event.tag, sceneKind: event.sceneKind, sceneCode: `NEXT FIVE / ${String(offset).padStart(2, '0')}`, sceneTitle: event.sceneTitle, copy: event.copy, detail: `${person.name}${event.detail}`, relation: event.relation, dimensions: clone(dimensions)});
  }
  const name = `延伸至 ${source.at(-1).year}`;
  ui.draft = {personId: person.id, baseVersionId: version.id, name, choice: '继续五年', range: 50, startIndex: source.length - 5, changedCount: 5, selectedIndex: source.length - 5, nodes: source};
  ui.windowStart = Math.max(0, source.length - WINDOW_SIZE);
  render();
  showToast('新的五年已生成，保存后成为版本');
}

function openPersonModal(personId = null) {
  const existing = state.people.find((person) => person.id === personId);
  const person = existing || {
    kind: 'character', name: '', pronoun: '她', age: '29', city: '', job: '', living: '', pursuit: '', worldview: '', reality: 'balanced', dimensions: DEFAULT_DIMENSIONS, inferred: {},
  };
  const dimensionFields = DIMENSIONS.map(({key, label}) => `<div class="range-field"><label>${label}</label><div class="range-line"><input id="person-${key}" data-person-dimension="${key}" data-source="${person.inferred?.[key] ? 'inferred' : 'manual'}" type="range" min="0" max="100" value="${person.dimensions[key]}"><output id="person-${key}-value">${person.dimensions[key]}</output></div><small>${person.inferred?.[key] ? '系统估计，可修改' : '用户设定'}</small></div>`).join('');
  openModal({
    type: 'person',
    personId,
    wide: true,
    kicker: existing ? 'EDIT PROFILE' : 'NEW PERSON',
    title: existing ? '编辑人物画像' : '创建一个人物',
    confirm: existing ? '保存画像' : '创建人物',
    body: `<div class="person-form">
      <aside class="person-form-preview"><div class="eyebrow">LIFE PROFILE</div><div class="avatar" id="personPreviewAvatar">${esc((person.name || '未').slice(0, 1))}</div><h3 id="personPreviewName">${esc(person.name || '未命名人物')}</h3><p id="personPreviewMeta">${esc(person.age)} 岁 · ${esc(person.city || '未设定')}<br>${esc(person.job || '未设定')}</p><p>画像只影响之后的新推演，已经保存的版本保持原样。</p></aside>
      <div class="person-form-content">
        <section class="form-section"><div class="form-section-head"><strong>人物信息</strong></div><div class="field-grid">
          <div class="field"><label>人物类型</label><select id="personKind"><option value="self" ${person.kind === 'self' ? 'selected' : ''}>自我探索</option><option value="character" ${person.kind !== 'self' ? 'selected' : ''}>观察人物</option></select></div>
          <div class="field"><label>姓名</label><input id="personName" value="${esc(person.name)}" placeholder="例如：周予安"></div>
          <div class="field"><label>称谓</label><select id="personPronoun"><option ${person.pronoun === '她' ? 'selected' : ''}>她</option><option ${person.pronoun === '他' ? 'selected' : ''}>他</option><option ${person.pronoun === 'TA' ? 'selected' : ''}>TA</option></select></div>
          <div class="field"><label>年龄</label><input id="personAge" type="number" min="0" max="120" value="${esc(person.age)}"></div>
          <div class="field"><label>所在城市</label><input id="personCity" value="${esc(person.city)}" placeholder="例如：成都"></div>
          <div class="field"><label>当前身份</label><input id="personJob" value="${esc(person.job)}" placeholder="例如：建筑师"></div>
          <div class="field"><label>生活关系</label><input id="personLiving" value="${esc(person.living)}" placeholder="例如：独居，与家人同城"></div>
          <div class="field"><label>现实强度</label><select id="personReality"><option value="gentle" ${person.reality === 'gentle' ? 'selected' : ''}>克制</option><option value="balanced" ${person.reality === 'balanced' ? 'selected' : ''}>平衡</option><option value="grounded" ${person.reality === 'grounded' ? 'selected' : ''}>更现实</option></select></div>
        </div></section>
        <section class="form-section"><div class="form-section-head"><strong>起始画像</strong><button type="button" id="estimatePerson">按身份估计</button></div><div class="dimension-inputs">${dimensionFields}</div></section>
        <section class="form-section"><div class="field-grid"><div class="field"><label>正在追求什么</label><textarea id="personPursuit" placeholder="例如：建立自己的工作方式">${esc(person.pursuit)}</textarea></div><div class="field"><label>目前看法</label><textarea id="personWorldview" placeholder="例如：先稳定下来再冒险">${esc(person.worldview)}</textarea></div></div></section>
      </div>
    </div>`,
  });
  bindPersonModal();
}

function bindPersonModal() {
  const updatePreview = () => {
    const name = $('#personName').value.trim() || '未命名人物';
    $('#personPreviewAvatar').textContent = name.slice(0, 1);
    $('#personPreviewName').textContent = name;
    $('#personPreviewMeta').innerHTML = `${esc($('#personAge').value || '未设定')} 岁 · ${esc($('#personCity').value.trim() || '未设定')}<br>${esc($('#personJob').value.trim() || '未设定')}`;
  };
  ['personName', 'personAge', 'personCity', 'personJob'].forEach((id) => $(`#${id}`).addEventListener('input', updatePreview));
  $$('[data-person-dimension]').forEach((input) => input.addEventListener('input', () => {
    $(`#person-${input.dataset.personDimension}-value`).textContent = input.value;
    input.dataset.source = 'manual';
    input.closest('.range-field').querySelector('small').textContent = '用户设定';
  }));
  $('#estimatePerson').addEventListener('click', () => {
    const estimates = estimatePersonDimensions($('#personJob').value, $('#personKind').value);
    DIMENSIONS.forEach(({key}) => {
      const input = $(`#person-${key}`);
      input.value = estimates[key];
      input.dataset.source = 'inferred';
      $(`#person-${key}-value`).textContent = estimates[key];
      input.closest('.range-field').querySelector('small').textContent = '系统估计，可修改';
    });
    showToast('已生成一组可修改的起始估计');
  });
}

function estimatePersonDimensions(job, kind) {
  const text = String(job).toLowerCase();
  const values = {...DEFAULT_DIMENSIONS};
  if (/医生|护士|教练|运动|户外|厨师/.test(text)) { values.body = 76; values.spirit = 69; }
  if (/设计|艺术|研究|教师|作家|心理|建筑/.test(text)) { values.spirit = 78; values.pursuit = 85; }
  if (/管理|产品|创业|销售|律师/.test(text)) { values.career = 78; values.money = 64; }
  if (/自由|兼职|学生/.test(text)) { values.career = 57; values.money = 45; values.worldviewChange = 66; }
  if (kind === 'character') values.worldviewChange = clamp(values.worldviewChange + 5);
  return values;
}

function savePersonFromModal() {
  const dimensions = Object.fromEntries(DIMENSIONS.map(({key}) => [key, Number($(`#person-${key}`).value)]));
  const input = {
    kind: $('#personKind').value,
    name: $('#personName').value.trim() || '未命名人物',
    pronoun: $('#personPronoun').value,
    age: $('#personAge').value || '29',
    city: $('#personCity').value.trim() || '未设定',
    job: $('#personJob').value.trim() || '自由职业',
    living: $('#personLiving').value.trim() || '未设定',
    pursuit: $('#personPursuit').value.trim() || '尚未明确',
    worldview: $('#personWorldview').value.trim() || '保持开放',
    reality: $('#personReality').value,
    dimensions,
    inferred: Object.fromEntries(DIMENSIONS.map(({key}) => [key, $(`#person-${key}`).dataset.source === 'inferred'])),
  };
  const existing = state.people.find((person) => person.id === ui.modal.personId);
  if (existing) {
    Object.assign(existing, input, {dimensions: normalizeDimensions(dimensions)});
    addHistory(existing, '人物画像已更新', '仅影响之后的新推演');
    state.activePersonId = existing.id;
  } else {
    const person = makePerson(input);
    state.people.unshift(person);
    state.activePersonId = person.id;
    ui.view = 'profile';
  }
  persist();
  closeModal();
  render();
  showToast(existing ? '人物画像已保存' : '人物已创建');
}

function openSimulationSettings() {
  const nodes = currentNodes();
  const person = activePerson();
  openModal({
    type: 'settings', kicker: 'SIMULATION SETTINGS', title: '推演设置', confirm: '应用设置',
    body: `<div class="field"><label>推演起始年</label><input id="settingStart" type="number" value="${nodes[0]?.year || 2026}"></div><div class="field"><label>完整观察跨度</label><select id="settingHorizon"><option value="10" ${nodes.length === 11 ? 'selected' : ''}>10 年</option><option value="15" ${nodes.length === 16 ? 'selected' : ''}>15 年</option><option value="20" ${nodes.length === 21 ? 'selected' : ''}>20 年</option></select></div><div class="field"><label>现实强度</label><select id="settingReality"><option value="gentle" ${person.reality === 'gentle' ? 'selected' : ''}>克制</option><option value="balanced" ${person.reality === 'balanced' ? 'selected' : ''}>平衡</option><option value="grounded" ${person.reality === 'grounded' ? 'selected' : ''}>更现实</option></select></div>`,
  });
}

function applySimulationSettings() {
  const person = activePerson();
  const version = activeVersion(person);
  if (!person || !version) return;
  const startYear = Number($('#settingStart').value) || 2026;
  const horizon = Number($('#settingHorizon').value) || 15;
  person.reality = $('#settingReality').value;
  const existing = currentNodes();
  const targetLength = horizon + 1;
  const nodes = existing.slice(0, targetLength).map((node, index) => ({...clone(node), year: startYear + index}));
  let dimensions = nodes.at(-1)?.dimensions || person.dimensions;
  while (nodes.length < targetLength) {
    const index = nodes.length;
    const event = BASE_EVENTS[index] || BASE_EVENTS[(index % 5) + 8];
    dimensions = deriveNodeDimensions(person.dimensions, dimensions, event.delta || {spirit: 2, worldviewChange: 2});
    nodes.push({
      id: uid('node'),
      year: startYear + index,
      title: event.title,
      tag: event.tag,
      sceneKind: event.sceneKind,
      sceneCode: `HORIZON / ${String(index + 1).padStart(2, '0')}`,
      sceneTitle: event.sceneTitle,
      copy: event.copy,
      detail: `${person.name}${event.detail}`,
      relation: event.relation,
      dimensions: clone(dimensions),
    });
  }
  const name = `${startYear}—${startYear + horizon} 推演`;
  ui.draft = {personId: person.id, baseVersionId: version.id, name, choice: '推演设置', range: 50, startIndex: 0, changedCount: nodes.length, selectedIndex: Math.min(currentSelectedIndex(), nodes.length - 1), nodes};
  closeModal();
  render();
  showToast('设置已应用，保存后生成新版本');
}

function openModal(config) {
  ui.modal = config;
  const modal = $('#modal');
  $('.modal', modal).classList.toggle('wide', Boolean(config.wide));
  $('#modalKicker').textContent = config.kicker || 'EDIT';
  $('#modalTitle').textContent = config.title || '编辑';
  $('#modalBody').innerHTML = config.body || '';
  $('#confirmModal').textContent = config.confirm || '确认';
  modal.classList.add('open');
  modal.setAttribute('aria-hidden', 'false');
  document.body.classList.add('modal-open');
  setTimeout(() => $('#modalBody input, #modalBody select, #confirmModal')?.focus(), 0);
}

function closeModal() {
  $('#modal').classList.remove('open');
  $('#modal').setAttribute('aria-hidden', 'true');
  document.body.classList.remove('modal-open');
  ui.modal = null;
}

function confirmModal() {
  if (!ui.modal) return;
  if (ui.modal.type === 'rewrite') applyRewrite();
  else if (ui.modal.type === 'person') savePersonFromModal();
  else if (ui.modal.type === 'settings') applySimulationSettings();
}

function exportBackup() {
  const data = JSON.stringify({...state, exportedAt: now()}, null, 2);
  const blob = new Blob([data], {type: 'application/json'});
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `岔路人生-备份-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  showToast('备份已导出');
}

async function importBackup(file) {
  try {
    const parsed = JSON.parse(await file.text());
    if (parsed?.schemaVersion !== 2 || !Array.isArray(parsed.people)) throw new Error('invalid');
    const people = parsed.people.map(normalizePerson);
    if (!people.length) throw new Error('empty');
    state = {...parsed, people, activePersonId: people.some((person) => person.id === parsed.activePersonId) ? parsed.activePersonId : people[0].id, view: 'people'};
    ui.view = 'people';
    ui.draft = null;
    persist();
    render();
    showToast('备份已导入');
  } catch (_) {
    showToast('无法读取这份备份');
  }
}

function showToast(message) {
  const toast = $('#toast');
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove('show'), 2200);
}

document.addEventListener('click', (event) => {
  const nav = event.target.closest('[data-nav]');
  if (nav) {
    navigate(nav.dataset.nav);
    return;
  }
  const action = event.target.closest('[data-action]');
  if (!action) return;
  const type = action.dataset.action;
  if (type === 'new-person') openPersonModal();
  else if (type === 'edit-person') openPersonModal(activePerson()?.id);
  else if (type === 'open-person') selectPerson(action.dataset.person);
  else if (type === 'open-version') switchVersion(action.dataset.version);
  else if (type === 'select-node') selectNode(action.dataset.index);
  else if (type === 'rewrite-node') openRewriteModal();
  else if (type === 'save-version') saveDraftVersion();
  else if (type === 'discard-draft') discardDraft();
  else if (type === 'simulation-settings') openSimulationSettings();
  else if (type === 'extend-five') extendFiveYears();
  else if (type === 'window-prev') { ui.windowStart = Math.max(0, ui.windowStart - WINDOW_SIZE); render(); }
  else if (type === 'window-next') { ui.windowStart = Math.min(Math.max(0, currentNodes().length - WINDOW_SIZE), ui.windowStart + WINDOW_SIZE); render(); }
  else if (type === 'export') exportBackup();
  else if (type === 'import') $('#importFile').click();
});

document.addEventListener('change', (event) => {
  if (event.target.id === 'compareA') { ui.compareA = event.target.value; if (ui.compareB === ui.compareA) ui.compareB = activePerson().versions.find((version) => version.id !== ui.compareA)?.id; render(); }
  if (event.target.id === 'compareB') { ui.compareB = event.target.value; if (ui.compareA === ui.compareB) ui.compareA = activePerson().versions.find((version) => version.id !== ui.compareB)?.id; render(); }
});

$('#closeModal').addEventListener('click', closeModal);
$('#cancelModal').addEventListener('click', closeModal);
$('#confirmModal').addEventListener('click', confirmModal);
$('#modal').addEventListener('click', (event) => { if (event.target.id === 'modal') closeModal(); });
$('#importFile').addEventListener('change', (event) => { const [file] = event.target.files; if (file) importBackup(file); event.target.value = ''; });
document.addEventListener('keydown', (event) => { if (event.key === 'Escape' && $('#modal').classList.contains('open')) closeModal(); });

render();
