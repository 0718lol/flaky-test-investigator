<div align="center">
  <img src="client/public/logo-dark.svg" alt="漫程" height="88" />

  # 漫程

  **填写旅行偏好，自动生成可以继续编辑的逐日行程。**
</div>

漫程（Mancheng）是一款面向普通游客的自托管 AI 旅行规划应用。它将目的地、日期、人数、预算、兴趣和旅行节奏整理成逐日计划，并保留地图、预算、预订、行李清单、多人协作与旅行记录等完整能力。

## 主要功能

- AI 自动生成逐日旅行计划，生成前填写简单表单即可
- 生成结果先预览、再确认保存，保存后可继续手动编辑
- 自动创建旅行日期、地点与日程安排，并补充地图坐标
- 互动地图、路线规划和地点搜索
- 预算、预订、住宿、行李清单、待办事项与文件管理
- 多用户实时协作、公开分享、PWA 与移动端适配
- 支持 OpenAI、Anthropic 及 OpenAI 兼容的云端模型接口

## Docker 部署

需要 Docker 与 Docker Compose。

```bash
git clone <your-repository-url> mancheng
cd mancheng
ENCRYPTION_KEY="$(openssl rand -hex 32)" docker compose up --build -d
```

服务默认监听 `3000` 端口。首次启动后使用管理员账户进入：

```text
管理后台 → Add-ons → AI Parsing
```

启用后选择云端服务商，填写模型名称和 API Key。API Key 会加密保存，不应写入代码或提交到仓库。

数据与上传文件分别保存在仓库目录下的 `data/` 和 `uploads/`，升级或重建容器时不会丢失。

## 本地开发

需要 Node.js 24 和 npm。

```bash
npm ci
npm run build
npm run dev
```

常用检查：

```bash
npm run lint
npm run test
npm run build
```

## 项目来源

漫程是基于 [TREK](https://github.com/liketrek/TREK) 开发的独立分支，不是 TREK 官方发行版，也不受其维护者背书。

本仓库保留了原项目的版权、许可证和第三方归属文件：

- [LICENSE](LICENSE)：GNU Affero General Public License v3.0
- [NOTICE.md](NOTICE.md)：第三方数据与组件归属
- [TRADEMARKS.md](TRADEMARKS.md)：TREK 名称与 Logo 的商标政策
- [README-TREK.md](README-TREK.md)：上游项目原始说明

如果你修改后通过网络向其他用户提供服务，AGPL-3.0 要求向这些用户提供对应版本的完整源代码。
