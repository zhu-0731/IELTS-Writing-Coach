export default function HistoryPage() {
  return (
    <div className="flex-1 flex items-center justify-center text-center px-4 py-20">
      <div>
        <div className="w-16 h-16 bg-green-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <span className="text-3xl">🗂️</span>
        </div>
        <h2 className="text-xl font-semibold text-slate-800 mb-2">历史记录</h2>
        <p className="text-sm text-slate-500 max-w-sm">
          第五阶段实现：所有作文列表，含诊断摘要、AI 提示使用情况
          和高频问题文字统计。
        </p>
        <div className="mt-4 inline-block bg-slate-100 text-slate-500 text-xs px-3 py-1.5 rounded-full">
          即将推出 · Phase 5
        </div>
      </div>
    </div>
  )
}
