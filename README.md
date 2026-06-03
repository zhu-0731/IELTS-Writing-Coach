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

### ✅ UI 设计系统重构

- 统一设计 token（颜色 / 圆角 / 阴影），通过 Tailwind v4 `@theme` 生成工具类（bg-canvas / text-ink / rounded-card 等）
- 所有用户可见字符串抽离至 `src/i18n/zh-CN.ts`，组件通过 `copy.xxx` 访问，JSX 中无硬编码文案
- 基础 UI 组件库：Button（4 种变体）/ Card / Badge / EmptyState / Tabs
- 写作工作台重构：题目区卡片化 + 写作要求 / 编辑器白卡片边界 / AI 侧边栏 empty state / 状态栏与操作区分离
- 所有页面统一视觉风格，无"Phase X 实现"类开发占位文案

### ✅ 第二阶段：写作工作台核心

- 三栏布局：题目区（280px）/ 写作区（自适应）/ AI 侧边栏（可收起 56px ↔ 展开 360px）
- Task 1 / Task 2 切换，含题型下拉和题目输入
- 写作编辑器：字数实时统计 + 达标进度条（Task1: 150词 / Task2: 250词）
- 计时器：首次输入自动启动，可手动暂停/继续
- 自动保存（1.5s 防抖）+ 手动保存草稿，持久化到 SQLite
- AI 侧边栏三 Tab UI 壳（AI 提示 / 我不知道写什么 / 我不会用英文说），内容 Phase 3 实现
- 诊断全文按钮 + Modal 占位，内容 Phase 4 实现

### ⬜ 第三阶段：AI 侧边栏三个功能

AI 提示（资源检索）/ Idea Coach / Expression Coach

### ⬜ 第四阶段：诊断全文 + 主页学习闭环

结构化诊断 / 掌握度更新 / 语言资源沉淀 / 主页个性化数据

### ⬜ 第五阶段：我的模板 + 历史记录 + 完善

模板页 / 历史记录页 / 图片上传 / Markdown 导出

### ⬜ 第六阶段：细节打磨
- 设置页新增一个修改个人基本信息按钮，支持修改问卷内容，或补充其他个人偏好。
- 界面过于拥挤，调整风格，设置恰当的边距和间距，提升整体的视觉体验。