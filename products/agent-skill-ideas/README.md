# Flaky Test Investigator

Flaky Test Investigator 是一个面向 CI / QA / 开发团队的偶发失败调查工作台。它把“偶尔红一次”变成可重复的实验：记录运行上下文，扰动可疑变量，比较通过与失败样本，最后输出最小复现命令和下一步建议。

## 产品目标

- 在 2-3 个实验变量内缩小 flaky 的复现范围
- 保留每次运行的顺序、seed、并发度、环境和堆栈证据
- 让调查结果可以交接、回归和接入 PR / CI

## 快速开始

产品由 ASteam 托管，目录内的 `app.toml` 会自动读取 `$PORT` 并绑定 `0.0.0.0`。打开产品后：

1. 在左侧选择调查案例，或点击“新建调查”。
2. 在“调查概览”中确认测试命令、重复次数、并发度和随机种子。
3. 打开“顺序扰动”和“环境快照”，点击“开始复现”。
4. 查看复现矩阵，比较失败样本的顺序、seed、并发和环境。
5. 根据“嫌疑变量排行”选择下一轮最小实验。
6. 在调查笔记记录假设，完成后到“报告”复制或下载 Markdown。

当前浏览器版本使用本地模拟 runner 来验证完整交互闭环；调查笔记写入 localStorage，运行数据可以导出 JSON。

## 页面说明

### 调查概览

- 复现率：失败次数 / 总运行次数
- 失败信号：按堆栈归并的异常模式
- 复现矩阵：每个样本的变量组合和结果
- 嫌疑变量：按相关性排序，并给出证据摘要
- 环境快照：Python、pytest、时区、CPU 等复现上下文
- 调查笔记：记录假设、排除项和下一步

### 运行记录

按时间查看所有运行，可导出为 JSON 交给 CI、Issue 或数据分析脚本。

### 报告与证据

生成包含结论、嫌疑变量、最小复现命令和下一步的 Markdown 报告，适合贴到 PR 或事故复盘。

## 建议的调查方法

先跑一组 baseline，再一次只改变一个变量。常见顺序是：

1. 固定 seed，比较并发度 1 / 2 / 4。
2. 固定并发度，打开和关闭顺序扰动。
3. 固定以上变量，比较冷缓存 / 热缓存和时区。
4. 将最稳定复现的组合缩减成最小命令，再回到代码检查共享 fixture、全局状态和外部依赖。

不要把“重复跑 100 次”当作结论。重复只能证明现象，变量对照才有助于定位原因。

## 接入真实 runner

前端的实验配置和展示区域已拆开，可将 `app.js` 中的 `startRun` 替换为后端任务：

- `POST /api/investigations/:id/runs`：提交 `repeats`、`concurrency`、`seed`、`orderPerturbation`、`captureEnvironment`
- `GET /api/runs/:id/events`：用 SSE 推送进度、样本、失败堆栈和环境快照
- `GET /api/investigations/:id/report`：返回复现率、变量相关性和最小复现命令
- `POST /api/investigations/:id/snapshots`：保存依赖锁、环境变量白名单和 git SHA

建议 runner 输出统一事件格式：

```json
{"type":"sample","run":18,"status":"failed","seed":42,"order":["auth","capture","refund"],"concurrency":4,"duration_ms":2840}
```

## 后续迭代

- 接入 pytest / Jest / Go test 的真实执行器
- 支持 CI 日志拖拽解析和失败堆栈归并
- 增加变量单因素实验和二分搜索
- 保存失败样本仓库，检测老 flaky 在新 PR 中复发
- GitHub App：自动评论复现矩阵、最小命令和风险变化

