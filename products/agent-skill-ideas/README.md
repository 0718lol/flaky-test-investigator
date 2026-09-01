# Flaky Test Investigator

Flaky Test Investigator 是一个本地可运行的 flaky 调查工作台。它不是单纯的前端演示，而是一个带后端、持久化和真实子进程 runner 的小型工程产品。

## 能做什么

- 创建和管理多个 flaky 调查
- 用受控命令执行多轮复现
- 按并发度使用受控 worker pool 真正并行启动独立子进程
- 记录 seed、并发度、顺序扰动、工作目录和环境快照
- 规范化失败日志并生成稳定的 failure fingerprint
- 用 Wilson 95% 区间辅助解释嫌疑变量，避免小样本误判
- 导出运行记录和 Markdown 报告
- 跨调查聚合失败指纹，识别同一问题是否复发
- 按并发、seed、顺序、工作目录生成失败率对比
- 导出可附在 issue/PR 中的 JSON 复现包
- 把调查数据写进本地 SQLite 文件，兼容旧版 JSON 数据迁移

## 启动

产品由 ASteam 托管。`app.toml` 会启动 `python3 app.py`，程序会读取 `$PORT` 并绑定到 `0.0.0.0`。

产品目录包含 `requirements-test.txt`。平台初始化脚本会在 `.venv` 中安装 pytest，runner 会自动将该环境加入测试进程的 `PATH`。

## 默认示例

首次打开会有一个示例调查：

- 命令：`python3 examples/flaky_case.py`
- 工作目录：`/workspace/products/agent-skill-ideas`

这个示例会根据 `FTI_SEED`、`FTI_CONCURRENCY`、`FTI_ORDER` 模拟一个不稳定失败，适合验证调查闭环。

## API

- `GET /api/state`
- `POST /api/investigations`
- `PATCH /api/investigations/:id`
- `POST /api/investigations/:id/runs`
- `GET /api/jobs/:id`
- `POST /api/jobs/:id/cancel`
- `GET /api/investigations/:id/report`
- `GET /api/investigations/:id/history` 返回跨调查失败指纹历史与复发标记
- `GET /api/investigations/:id/compare` 返回变量维度的样本数、失败数和失败率
- `GET /api/investigations/:id/repro-bundle` 导出 `fti-repro-bundle/v1` 证据包
- `GET /api/investigations/:id/ci-summary` 返回可直接写入 GitHub Actions Summary 的 Markdown 与 annotations
- `GET /api/investigations/:id/experiments` 查看单因素扫描批次
- `GET /api/investigations/:id/assist` 获取根因解释建议；未配置 `DEEPSEEK_API_KEY` 时使用本地规则，配置后才调用 DeepSeek
- `POST /api/investigations/:id/matrix-runs` 启动单因素扫描，body 示例：`{"dimension":"concurrency","values":[1,2,4,8],"repeats_per_value":3}`
- `PATCH /api/fingerprints/:fingerprint` 更新指纹状态（`active`、`fixed`、`ignored`），修复后的指纹再次出现会自动标记为 `regressed`
- `POST /api/investigations/:id/pollution-bisect`

## 运行约束

runner 只允许这些命令入口：

- `pytest`
- `python` / `python3`
- `npm`
- `npx`
- `yarn`
- `pnpm`
- `go`

命令只能在 `/workspace` 下的目录执行，默认会截断输出并设置超时，避免误伤环境。

每个样本都是独立子进程。`concurrency` 控制同时运行的 worker 数（上限 16），不会把测试代码加载进服务进程；job API 会返回 `workers`、完整 `config` 和 `completion_order`，方便审计实验是否按预期执行。

运行中的 job 可以调用取消接口。runner 会终止对应的进程组，并将 job 标记为 `cancelled`，已完成的样本仍会保留。

污染测试二分接口接收 `target`、`candidates`（测试 nodeid 数组）和可选的 `command`、`cwd`、`seed`。它会反复执行候选集合与目标测试，缩小最可能污染目标的前置测试，并返回每轮检查的输出证据。

实验室中的“单因素扫描”会打开配置对话框，选择维度、填写逗号分隔的值和每值重复次数。扫描运行会使用当前调查的命令、工作目录和环境快照设置，并在运行记录中保存为独立实验批次。

DeepSeek 是可选依赖，不影响核心实验。设置 `DEEPSEEK_API_KEY`（可选 `DEEPSEEK_MODEL`）后，调用 `/assist` 才会发送经过裁剪的失败证据；密钥不会写入代码、SQLite 或浏览器。

## 结构取舍

当前版本有意保持单服务部署。分析核心已迁移到 `analysis.py`，SQLite/JSON 迁移和写入已迁移到 `storage.py`，运行约束和 JUnit 解析已迁移到 `runner.py`，矩阵规格校验已迁移到 `experiments.py`；`app.py` 通过兼容绑定继续提供旧函数名，避免破坏现有 runner 和 API。剩余技术债是进程编排、实验 job 生命周期和 HTTP 路由仍在 `app.py`，后续再拆成 `server.py`。前端约 460 行、样式约 600 行，主要是无构建依赖的产品壳，暂不建议为了“拆文件”引入打包链。

## 迭代建议

复现包可以直接作为 CI artifact 上传，或复制到 issue/PR。它包含命令、工作目录、seed、并发度、环境快照、失败日志、指纹历史和变量对比。

下一步最有价值的升级是：

1. 接入 pytest / Jest / Go test 的更细粒度事件流
2. 接入 CI webhook，在 PR 中自动评论复现率变化
3. 增加变量单因素实验和自动最小化命令
4. 把报告同步到 GitHub PR 评论
