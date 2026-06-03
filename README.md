# IELTS Writing Coach

本地运行的 IELTS 写作训练工具。

## 启动

**后端**（终端 1）

```powershell
cd backend
conda activate ielts
uvicorn main:app --reload
```

运行在 `http://127.0.0.1:8000`

**前端**（终端 2）

```powershell
cd frontend
npm run dev
```

打开浏览器访问 `http://localhost:5173`

## 首次使用

1. 启动前后端
2. 浏览器打开 `http://localhost:5173`，自动进入初始设置向导
3. 完成五问设置后进入主页
4. 前往「设置」页填写 API Key（支持 OpenAI 及兼容接口）

## API Key 说明

API Key 仅保存在本地 SQLite 数据库（`backend/data/ielts.db`），不会上传或提交到 git。

## 当前进度

### ✅ 第一阶段：项目基础 + 设置页 + 首次设置

- Git 仓库初始化，`.gitignore` 排除 `docs/`、`*.db`、`.venv/` 等敏感路径
- 前端：React + TypeScript + Vite + Tailwind CSS v4，基础路由
- 后端：FastAPI + SQLite，6 张数据表（user_profile / essays / language_resources / hint_usage / diagnoses / settings）
- LLM Provider 抽象层（OpenAI-compatible，支持 Ollama / vLLM 等）
- 首次设置向导（五问：目标分数 / 练习类型 / 写作卡点 / 模板偏好 / 是否允许画像更新）
- 设置页（API Key 配置，仅存本地 DB，Response 只返回末四位掩码）
- 顶部导航 + 各页面占位路由

### ⬜ 第二阶段：写作工作台核心

题目区 + 写作编辑器 + 字数计时 + 保存草稿 + AI 侧边栏 UI 壳

### ⬜ 第三阶段：AI 侧边栏三个功能

AI 提示（资源检索）/ Idea Coach / Expression Coach

### ⬜ 第四阶段：诊断全文 + 主页学习闭环

结构化诊断 / 掌握度更新 / 语言资源沉淀 / 主页个性化数据

### ⬜ 第五阶段：我的模板 + 历史记录 + 完善

模板页 / 历史记录页 / 图片上传 / Markdown 导出

### ⬜ 第六阶段：细节打磨
