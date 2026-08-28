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
- 把调查数据写进本地 JSON 文件，便于持续迭代

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

## 迭代建议

下一步最有价值的升级是：

1. 接入 pytest / Jest / Go test 的更细粒度事件流
2. 保存失败样本仓库，做历史 flaky 复发识别
3. 增加变量单因素实验和自动最小化命令
4. 把报告同步到 GitHub PR 评论
