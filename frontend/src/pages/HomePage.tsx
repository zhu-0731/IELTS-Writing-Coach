import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getProfile, type ProfileData } from '../api/client'

export default function HomePage() {
  const navigate = useNavigate()
  const [profile, setProfile] = useState<ProfileData | null>(null)

  useEffect(() => {
    getProfile().then(setProfile).catch(() => {})
  }, [])

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      {/* 欢迎区 */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-slate-800">今日学习</h1>
          <p className="text-sm text-slate-500 mt-1">
            开始写作，完成诊断，积累专属模板
          </p>
        </div>
        <button
          onClick={() => navigate('/workspace')}
          className="px-5 py-2.5 bg-blue-500 text-white text-sm font-medium rounded-xl hover:bg-blue-600 transition-colors"
        >
          开始写作 →
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {/* 今日建议练习 */}
        <div className="md:col-span-2 bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xs font-medium bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full">今日建议</span>
          </div>
          <h2 className="text-base font-semibold text-slate-800 mb-1">
            完成初次设置后，这里会根据你的诊断记录生成练习建议
          </h2>
          <p className="text-sm text-slate-500">
            写完第一篇作文并诊断后，系统会分析你的主要问题并推荐针对性练习。
          </p>
          <button
            onClick={() => navigate('/workspace')}
            className="mt-4 text-sm text-blue-500 hover:text-blue-600 font-medium"
          >
            去写第一篇作文 →
          </button>
        </div>

        {/* 个人设置摘要 */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
          <h2 className="text-sm font-semibold text-slate-700 mb-3">个人设置</h2>
          {profile ? (
            <div className="space-y-2 text-sm text-slate-600">
              <div className="flex justify-between">
                <span className="text-slate-400">目标分数</span>
                <span className="font-medium">{profile.target_band}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">练习类型</span>
                <span className="font-medium">
                  {profile.main_task === 'task1' ? 'Task 1' : profile.main_task === 'task2' ? 'Task 2' : '两种'}
                </span>
              </div>
              <div className="mt-3 pt-3 border-t border-slate-100">
                <span className="text-slate-400 text-xs">主要弱点</span>
                <p className="mt-1 text-xs text-slate-700">{profile.main_problem}</p>
              </div>
            </div>
          ) : (
            <p className="text-sm text-slate-400">加载中…</p>
          )}
          <button
            onClick={() => navigate('/settings')}
            className="mt-4 text-xs text-slate-400 hover:text-slate-600"
          >
            修改设置
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* 新生成模板 */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
          <h2 className="text-sm font-semibold text-slate-700 mb-3">新生成模板</h2>
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center mb-3">
              <span className="text-slate-400 text-lg">📋</span>
            </div>
            <p className="text-sm text-slate-400">诊断后会在这里生成句型骨架、搭配词块和逻辑模板</p>
            <button
              onClick={() => navigate('/templates')}
              className="mt-3 text-xs text-blue-500 hover:text-blue-600"
            >
              查看我的模板库 →
            </button>
          </div>
        </div>

        {/* 最近高频问题 */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
          <h2 className="text-sm font-semibold text-slate-700 mb-3">最近高频问题</h2>
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center mb-3">
              <span className="text-slate-400 text-lg">📊</span>
            </div>
            <p className="text-sm text-slate-400">完成多篇作文诊断后，这里会统计你的高频失分点</p>
            <button
              onClick={() => navigate('/history')}
              className="mt-3 text-xs text-blue-500 hover:text-blue-600"
            >
              查看历史记录 →
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
