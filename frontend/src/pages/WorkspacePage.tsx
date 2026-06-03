export default function WorkspacePage() {
  return (
    <div className="flex-1 flex items-center justify-center text-center px-4 py-20">
      <div>
        <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <span className="text-3xl">✍️</span>
        </div>
        <h2 className="text-xl font-semibold text-slate-800 mb-2">写作工作台</h2>
        <p className="text-sm text-slate-500 max-w-sm">
          第二阶段实现：三栏布局（题目区 · 写作区 · AI 侧边栏），
          包含字数统计、计时器、保存草稿和可收回 AI 侧边栏。
        </p>
        <div className="mt-4 inline-block bg-slate-100 text-slate-500 text-xs px-3 py-1.5 rounded-full">
          即将推出 · Phase 2
        </div>
      </div>
    </div>
  )
}
