'use strict';

const api = {
  state: () => fetch('/api/state').then(r => r.json()),
  createInvestigation: payload => fetch('/api/investigations', {
    method: 'POST',
    headers: {'content-type': 'application/json'},
    body: JSON.stringify(payload),
  }).then(r => r.json()),
  updateInvestigation: (id, payload) => fetch(`/api/investigations/${id}`, {
    method: 'PATCH',
    headers: {'content-type': 'application/json'},
    body: JSON.stringify(payload),
  }).then(r => r.json()),
  runInvestigation: (id, payload) => fetch(`/api/investigations/${id}/runs`, {
    method: 'POST',
    headers: {'content-type': 'application/json'},
    body: JSON.stringify(payload),
  }).then(r => r.json()),
  job: id => fetch(`/api/jobs/${id}`).then(r => r.json()),
  cancelJob: id => fetch(`/api/jobs/${id}/cancel`, {method: 'POST'}).then(r => r.json()),
  report: id => fetch(`/api/investigations/${id}/report`).then(r => r.json()),
};

const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const fmtPct = n => `${(n * 100).toFixed(1)}%`;

const state = {
  investigations: [],
  runs: [],
  selectedId: null,
  view: 'lab',
  job: null,
  loading: false,
  report: '',
};

function toast(message) {
  const el = $('#toast');
  el.textContent = message;
  el.classList.add('show');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => el.classList.remove('show'), 1800);
}

function selectedInvestigation() {
  return state.investigations.find(item => item.id === state.selectedId) || state.investigations[0] || null;
}

function runsFor(inv) {
  return state.runs.filter(run => run.investigation_id === inv.id);
}

function updateControls(inv) {
  if (!inv) return;
  $('#commandText').textContent = inv.command || 'pytest -q';
  $('#notes').value = inv.notes || '';
  $('#cwdInput').value = inv.cwd || '';
  $('#caseTitle').textContent = inv.title;
  $('#crumbTitle').textContent = inv.title;
  $('#caseMeta').textContent = `${inv.repo} · ${inv.framework} · ${runsFor(inv).length} 次运行`;
}

function renderCases() {
  $('#caseCount').textContent = state.investigations.length;
  $('#caseList').innerHTML = state.investigations.map(inv => {
    const active = inv.id === state.selectedId ? 'active' : '';
    return `<button class="case-item ${active}" data-case="${inv.id}">
      <i class="case-dot"></i>
      <div><b>${inv.title}</b><small>${inv.repo} · ${inv.framework}</small></div>
    </button>`;
  }).join('');
}

function renderSignals(inv) {
  const runs = runsFor(inv);
  const failedRuns = runs.filter(r => r.status === 'failed');
  const signals = (inv.signals || []).slice(0, 2).map(item => [item.signal, item.count]);
  if (!signals.length) signals.push(['暂无失败信号', 0]);
  const latestFailure = failedRuns[0];
  $('#sampleLog').textContent = latestFailure
    ? [latestFailure.started_at, latestFailure.stderr || latestFailure.stdout || latestFailure.signal || ''].filter(Boolean).join('\n')
    : '等待后端运行样本…';
  $('#signalList').innerHTML = signals.map(([signal, count], index) => {
    const icon = index === 0 ? '!' : '◷';
    const tone = index === 0 ? 'red' : 'amber';
    return `<div class="signal">
      <div class="signal-icon ${tone}">${icon}</div>
      <div><b>${signal}</b><small>按失败指纹聚合 · ${count} 个样本</small></div>
      <span class="signal-count">×${count}</span>
    </div>`;
  }).join('');
}

function renderMatrix(inv) {
  const runs = runsFor(inv).slice().reverse().slice(0, 12);
  $('#matrixBody').innerHTML = runs.map(run => `
    <tr>
      <td>${run.id.slice(0, 8)}</td>
      <td>${run.order}</td>
      <td>${run.seed}</td>
      <td>${run.concurrency}</td>
      <td>${run.env?.timezone || 'UTC'}</td>
      <td><span class="result ${run.status === 'failed' ? 'fail' : 'pass'}">${run.status === 'failed' ? '失败' : '通过'}</span></td>
      <td>${(run.duration_ms / 1000).toFixed(2)}s</td>
    </tr>
  `).join('') || '<tr><td colspan="7">暂无运行</td></tr>';
  $('#loadMoreBtn').textContent = runsFor(inv).length > runs.length ? `查看全部 ${runsFor(inv).length} 次运行` : '暂无更多运行';
}

function renderSuspects(inv) {
  const suspects = inv.suspects || [];
  $('#suspects').innerHTML = suspects.length ? suspects.map(item => `
    <div class="suspect">
      <div class="suspect-head"><b>${item.name}</b><span>${item.score.toFixed(2)}</span></div>
      <div class="bar"><i style="width:${Math.max(8, item.score * 100)}%"></i></div>
      <small>${item.evidence}${item.confidence ? ` · 95% 区间 ${(item.confidence[0] * 100).toFixed(0)}–${(item.confidence[1] * 100).toFixed(0)}%` : ''}</small>
    </div>
  `).join('') : '<div class="empty-state">需要更多失败样本来排序嫌疑变量。</div>';
}

function renderRuns(inv) {
  const runs = runsFor(inv).slice().reverse();
  $('#runList').innerHTML = `
    <div class="run-row header"><span>RUN</span><span>配置</span><span>结果</span><span>耗时</span><span>时间</span></div>
    ${runs.map(run => `
      <div class="run-row clickable" data-run="${run.id}" tabindex="0">
        <span>${run.id.slice(0, 8)}</span>
        <span>${run.order} · c=${run.concurrency} · seed=${run.seed}</span>
        <span class="${run.status === 'failed' ? 'fail' : 'pass'}">${run.status === 'failed' ? '失败' : '通过'}</span>
        <span>${(run.duration_ms / 1000).toFixed(2)}s</span>
        <span>${run.started_at || ''}</span>
      </div>
    `).join('')}
  `;
}

function renderReport(inv) {
  $('#reportTitle').textContent = `${inv.title} / 复现报告`;
  $('#reportBody').innerHTML = state.report
    ? `<pre>${state.report.replace(/[&<>]/g, s => ({'&':'&amp;','<':'&lt;','>':'&gt;'}[s]))}</pre>`
    : '<div class="empty-state">点击“生成报告”后展示 Markdown 结果。</div>';
}

function renderMetrics(inv) {
  const runs = runsFor(inv);
  const failures = runs.filter(r => r.status === 'failed');
  $('#totalRuns').textContent = runs.length;
  $('#runCount').textContent = runs.length;
  $('#failRuns').textContent = failures.length;
  $('#reproRate').textContent = runs.length ? fmtPct(failures.length / runs.length) : '0.0%';
  $('#confidence').textContent = inv.suspects?.[0]?.score?.toFixed(2) || '0.00';
  $('#reportMeta').textContent = `${runs.length} 次运行 · ${failures.length} 次失败`;
}

function renderEnvironment(inv) {
  $('#envGrid').innerHTML = `
    <span>Python <b>3.12</b></span>
    <span>Framework <b>${inv.framework}</b></span>
    <span>Timezone <b>UTC</b></span>
    <span>Workspace <b>${inv.cwd || '/workspace'}</b></span>
  `;
}

function render() {
  const inv = selectedInvestigation();
  if (inv) updateControls(inv);
  renderCases();
  if (inv) {
    renderMetrics(inv);
    renderSignals(inv);
    renderMatrix(inv);
    renderSuspects(inv);
    renderRuns(inv);
    renderEnvironment(inv);
    renderReport(inv);
  }
  $$('.tab, .nav-item').forEach(node => node.classList.toggle('active', node.dataset.view === state.view));
  $('#labView').classList.toggle('hidden', state.view !== 'lab');
  $('#runsView').classList.toggle('hidden', state.view !== 'runs');
  $('#reportsView').classList.toggle('hidden', state.view !== 'reports');
  $('#runProgress').classList.toggle('hidden', !state.job || state.job.status !== 'running');
  const progressLine = $('#runProgress .progress-line');
  if (progressLine && !$('#cancelRunBtn')) {
    const button = document.createElement('button');
    button.className = 'text-btn'; button.id = 'cancelRunBtn'; button.type = 'button'; button.textContent = '取消实验';
    progressLine.appendChild(button);
    button.onclick = async () => {
      if (!state.job || state.job.status !== 'running') return;
      button.disabled = true; button.textContent = '取消中…';
      await api.cancelJob(state.job.id); toast('已请求取消实验');
    };
  }
  if (state.job && state.job.status === 'running') {
    $('#progressText').textContent = `${state.job.progress} / ${state.job.total}`;
    $('#progressBar').style.width = `${(state.job.progress / state.job.total) * 100}%`;
  }
}

async function loadState() {
  const payload = await api.state();
  state.investigations = payload.investigations || [];
  state.runs = payload.runs || [];
  if (!state.selectedId && state.investigations[0]) state.selectedId = state.investigations[0].id;
  if (!state.selectedId && !state.investigations.length) {
    const created = await api.createInvestigation({
      title: 'checkout race',
      repo: 'demo-workspace',
      framework: 'pytest-compatible',
      command: 'python3 examples/flaky_case.py',
      cwd: '/workspace/products/agent-skill-ideas',
    });
    state.selectedId = created.investigation.id;
    return loadState();
  }
  const report = await api.report(state.selectedId);
  state.report = report.markdown || '';
  render();
}

async function refreshJob(jobId) {
  const job = await api.job(jobId);
  state.job = job;
  render();
  if (job.status === 'running') {
    setTimeout(() => refreshJob(jobId), 700);
  } else {
    await loadState();
    if (job.status === 'complete') toast('实验完成，数据已写入本地仓库');
    else toast(job.error || '实验失败');
  }
}

async function startRun() {
  const inv = selectedInvestigation();
  if (!inv || state.loading) return;
  state.loading = true;
  $('#startRunBtn').disabled = true;
  $('#runProgress').classList.remove('hidden');
  try {
    const payload = {
      repeats: Number($('#repeatInput').value || 12),
      concurrency: Number($('#concurrencyInput').value || 4),
      seed_mode: $('#seedInput').value,
      seed: Number($('#seedValue').value || 42),
      order_perturbation: $('#orderToggle').checked,
      capture_environment: $('#envToggle').checked,
      cwd: $('#cwdInput').value,
      command: $('#commandText').textContent,
    };
    const res = await api.runInvestigation(inv.id, payload);
    state.job = {status: 'running', progress: 0, total: payload.repeats};
    render();
    await refreshJob(res.job_id);
  } catch (err) {
    toast(err.message || '无法启动实验');
  } finally {
    state.loading = false;
    $('#startRunBtn').disabled = false;
  }
}

function markdownTextFor(inv) {
  const runs = runsFor(inv);
  const failures = runs.filter(r => r.status === 'failed');
  const suspects = inv.suspects || [];
  return [
    `# ${inv.title} / 复现报告`,
    '',
    '## 结论',
    `- 总运行: ${runs.length}`,
    `- 失败次数: ${failures.length}`,
    `- 复现率: ${runs.length ? fmtPct(failures.length / runs.length) : '0.0%'}`,
    '',
    '## 嫌疑变量',
    ...(suspects.length ? suspects.map(item => `- ${item.name} (${item.score.toFixed(2)})`) : ['- 暂无']),
    '',
    '## 最小复现命令',
    '```bash',
    `${inv.command}`,
    '```',
    '',
    '## 备注',
    inv.notes || '',
  ].join('\n');
}

function bind() {
  const setView = view => {
    state.view = view;
    render();
  };

  // Bind navigation directly so it remains usable even if an API request fails.
  $$('.tab[data-view], .nav-item[data-view]').forEach(node => {
    node.addEventListener('click', event => {
      event.preventDefault();
      setView(node.dataset.view);
    });
  });

  document.body.addEventListener('click', async event => {
    const runButton = event.target.closest('[data-run]');
    if (runButton) {
      const run = state.runs.find(item => item.id === runButton.dataset.run);
      if (run) openRunDialog(run);
      return;
    }
    const caseButton = event.target.closest('[data-case]');
    if (caseButton) {
      state.selectedId = caseButton.dataset.case;
      const report = await api.report(state.selectedId);
      state.report = report.markdown || '';
      render();
      return;
    }
    const viewButton = event.target.closest('[data-view]');
    if (viewButton) {
      setView(viewButton.dataset.view);
    }
  });

  $('#runBtn').onclick = () => { state.view = 'lab'; startRun(); };
  $('#startRunBtn').onclick = startRun;
  $('#loadMoreBtn').onclick = () => toast('当前视图已展示最近样本，运行记录里可看全部。');
  $('#snapshotBtn').onclick = () => toast('环境快照由后端记录在每次运行里。');
  $('#copyReportBtn').onclick = async () => {
    const inv = selectedInvestigation();
    await navigator.clipboard.writeText(markdownTextFor(inv));
    toast('报告已复制');
  };
  $('#downloadReportBtn').onclick = async () => {
    const inv = selectedInvestigation();
    const blob = new Blob([markdownTextFor(inv)], {type: 'text/markdown'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${inv.title}-report.md`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 400);
  };
  $('#exportRunsBtn').onclick = () => {
    const inv = selectedInvestigation();
    const blob = new Blob([JSON.stringify(runsFor(inv), null, 2)], {type: 'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${inv.title}-runs.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 400);
  };
  $('#saveNoteBtn').onclick = async () => {
    const inv = selectedInvestigation();
    await api.updateInvestigation(inv.id, {notes: $('#notes').value, cwd: $('#cwdInput').value, command: $('#commandText').textContent});
    toast('调查笔记已保存');
    await loadState();
  };
  $('#editCommand').onclick = async () => {
    const inv = selectedInvestigation();
    const command = prompt('编辑测试命令', inv.command);
    if (!command) return;
    await api.updateInvestigation(inv.id, {command});
    toast('测试命令已更新');
    await loadState();
  };
  if ($('#editCwdBtn')) $('#editCwdBtn').onclick = async () => {
    const inv = selectedInvestigation();
    const cwd = prompt('编辑工作目录', inv.cwd || '/workspace');
    if (!cwd) return;
    await api.updateInvestigation(inv.id, {cwd});
    toast('工作目录已更新');
    await loadState();
  };
  $('#newCaseBtn').onclick = async () => {
    const title = prompt('调查名称', 'new flaky case');
    if (!title) return;
    const created = await api.createInvestigation({
      title,
      repo: 'local-workspace',
      framework: 'pytest',
      command: 'python3 examples/flaky_case.py',
      cwd: '/workspace/products/agent-skill-ideas',
    });
    state.selectedId = created.investigation.id;
    toast('已创建调查');
    await loadState();
  };
  $('#addCaseBtn').onclick = $('#newCaseBtn').onclick;
  $('#generateReportBtn').onclick = async () => {
    const inv = selectedInvestigation();
    const res = await api.report(inv.id);
    state.report = res.markdown || '';
    state.view = 'reports';
    render();
  };
  $('#closeRunDialog').onclick = () => $('#runDialog').close();
}

function openRunDialog(run) {
  $('#dialogTitle').textContent = `${run.id.slice(0, 8)} · ${run.status === 'failed' ? '失败' : '通过'}`;
  const tests = run.tests || [];
  const esc = value => String(value || '').replace(/[&<>]/g, s => ({'&':'&amp;','<':'&lt;','>':'&gt;'}[s]));
  const classification = run.classification || {};
  $('#dialogBody').innerHTML = `<div class="evidence-grid"><span>Seed <b>${esc(run.seed)}</b></span><span>并发 <b>${esc(run.concurrency)}</b></span><span>失败分类 <b>${esc(classification.label || '待分类')}</b></span><span>指纹 <b>${esc(run.fingerprint || '—')}</b></span></div>
    ${tests.length ? `<h3>测试结果</h3><div class="test-results">${tests.map(test => `<div><span class="${test.status === 'failed' ? 'fail' : 'pass'}">${test.status}</span><b>${esc(test.classname ? `${test.classname}::${test.name}` : test.name)}</b><small>${esc(test.message)}</small></div>`).join('')}</div>` : ''}
    <h3>输出</h3><pre>${esc([run.stdout, run.stderr].filter(Boolean).join('\n')) || '无输出'}</pre>`;
  $('#runDialog').showModal();
}

async function init() {
  bind();
  await loadState();
  if (localStorage.ftiNote) $('#notes').value = localStorage.ftiNote;
  $('#notes').addEventListener('input', () => {
    localStorage.ftiNote = $('#notes').value;
  });
}

init().catch(err => {
  console.error(err);
  toast('初始化失败');
});
