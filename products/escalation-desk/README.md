# Relay

面向 SaaS 客服主管、CSM 和值班工程师的客户升级决策台。

它把工单、Slack、通话记录和日志压成可执行的升级事件，并围绕真实处置流程提供：

- 大客户升级队列与优先级筛选
- SLA 倒计时、状态推进和完整时间线
- 多来源规则匹配、证据完整度、来源冲突与待确认项
- 跨团队处置清单和责任人跟踪
- 可编辑、复制的客户状态更新
- 新建案件、补充来源与 JSON 留档
- 可下钻的运营报告：履约漏斗、周期表现、风险客户、升级原因与团队负载
- 管理摘要复制、报告导出和 7/30/90 天周期联动
- 无 API 时使用本地规则分析来源内容，联动更新判断、事实、行动项和客户回复
- 独立客户组合与客户档案，包含健康信号、联系人、续约和关联升级
- 处置手册执行前可选择目标案件并预览新增或跳过的动作
- 批量导入文本、日志、CSV、JSON 和 Slack ZIP 聊天导出，预览去重后写入案件

数据保存在浏览器本地的版本化工作区中。客户、联系人、案件、运营事件、班次、手册和复盘使用 ID 关联；运营报告全部从这些记录实时派生。旧版案件、手册运行次数和值班设置会自动迁移到 `relay-workspace-state-v2`。

本产品由 `app.toml` 托管，服务从 `$PORT` 读取端口并绑定 `0.0.0.0`。

## 导入接口

`POST /api/import/preview` 接受 `multipart/form-data`，文件字段名为 `files`，可重复提交多个文件。接口解析并返回标准化来源，不会直接修改案件。

```bash
curl -F 'files=@chat.csv' -F 'files=@slack-export.zip' /api/import/preview
```

支持 `.txt`、`.log`、`.md`、`.csv`、`.json`、`.zip`。单次请求最多 20 个文件、20 MB 和 500 条消息；ZIP 解压后最多 30 MB。`GET /api/import/formats` 可读取当前限制。

## 设计参考

- [Twenty](https://github.com/twentyhq/twenty)：业务总览、数据表格与单记录详情的信息架构
- [Midday](https://github.com/midday-ai/midday)：柔和灰白层次、留白与侧栏组织
- [Chatwoot](https://github.com/chatwoot/chatwoot)：客服事件队列与状态筛选

数据模型参考 Twenty 的 Company/Person 关系和 Chatwoot 的 Account/Contact/Conversation 关系，采用独立实体与 ID 关联，不复制跨页面状态。

界面使用本地打包的 [Lucide](https://github.com/lucide-icons/lucide) 图标。
