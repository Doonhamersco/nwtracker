"use client"

import { useEffect, useState } from "react"
import { GoalCard, type GoalWithProgress } from "@/components/goals/GoalCard"
import { GoalForm } from "@/components/goals/GoalForm"
import { Target } from "lucide-react"

export default function GoalsPage() {
  const [goals, setGoals] = useState<GoalWithProgress[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)

  async function fetchGoals() {
    try {
      setError(null)
      const res = await fetch("/api/goals")
      if (!res.ok) throw new Error("Failed to load goals")
      const data = (await res.json()) as GoalWithProgress[]
      setGoals(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
    } finally {
      setLoading(false)
    }
  }

  async function handleDelete(id: string) {
    try {
      const res = await fetch(`/api/goals/${id}`, { method: "DELETE" })
      if (!res.ok && res.status !== 204) throw new Error("Failed to delete goal")
      setGoals((prev) => prev.filter((g) => g.goal.id !== id))
    } catch (err) {
      console.error("Delete goal error:", err)
    }
  }

  useEffect(() => {
    void fetchGoals()
  }, [])

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#F1F5F9]">Goals</h1>
          <p className="mt-1 text-sm text-[#94A3B8]">
            Track progress toward your financial targets
          </p>
        </div>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="bg-[#22c55e] text-white rounded-lg px-4 py-2 text-sm hover:bg-[#16a34a] transition-colors"
          >
            + New Goal
          </button>
        )}
      </div>

      {/* New goal form */}
      {showForm && (
        <div className="rounded-2xl border border-[#222222] bg-[#111111] p-5">
          <h2 className="mb-4 text-base font-semibold text-[#F1F5F9]">
            Create New Goal
          </h2>
          <GoalForm
            onSuccess={() => {
              setShowForm(false)
              void fetchGoals()
            }}
            onCancel={() => setShowForm(false)}
          />
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-48 animate-pulse rounded-2xl bg-[#111111]" />
          ))}
        </div>
      )}

      {/* Error */}
      {!loading && error && (
        <div className="rounded-2xl border border-[#EF4444]/40 bg-[#EF4444]/10 p-4 text-sm text-[#EF4444]">
          {error}
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && goals.length === 0 && !showForm && (
        <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-[#222222] bg-[#111111] py-16 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#22c55e]/20">
            <Target className="text-[#22c55e]" size={28} />
          </div>
          <div>
            <p className="font-semibold text-[#F1F5F9]">Set your first goal</p>
            <p className="mt-1 text-sm text-[#94A3B8]">
              Create a financial goal to start tracking your progress.
            </p>
          </div>
          <button
            onClick={() => setShowForm(true)}
            className="bg-[#22c55e] text-white rounded-lg px-4 py-2 text-sm hover:bg-[#16a34a] transition-colors"
          >
            Create Goal
          </button>
        </div>
      )}

      {/* Goals grid */}
      {!loading && !error && goals.length > 0 && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {goals.map((item) => (
            <GoalCard
              key={item.goal.id}
              item={item}
              onDelete={() => handleDelete(item.goal.id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
