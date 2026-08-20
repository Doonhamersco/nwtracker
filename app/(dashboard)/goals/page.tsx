"use client"

import { useEffect, useRef, useState } from "react"
import { GoalCard, type GoalWithProgress } from "@/components/goals/GoalCard"
import { GoalForm } from "@/components/goals/GoalForm"
import { Target } from "lucide-react"

type FormMode = { kind: "create" } | { kind: "edit" | "complete"; goalId: string }

export default function GoalsPage() {
  const [goals, setGoals] = useState<GoalWithProgress[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [formMode, setFormMode] = useState<FormMode | null>(null)
  const formRef = useRef<HTMLDivElement>(null)

  const editingItem =
    formMode && formMode.kind !== "create"
      ? goals.find((g) => g.goal.id === formMode.goalId) ?? null
      : null

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
      if (formMode && formMode.kind !== "create" && formMode.goalId === id) {
        setFormMode(null)
      }
    } catch (err) {
      console.error("Delete goal error:", err)
    }
  }

  useEffect(() => {
    void fetchGoals()
  }, [])

  useEffect(() => {
    if (formMode) {
      formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
    }
  }, [formMode])

  function closeFormAndRefresh() {
    setFormMode(null)
    void fetchGoals()
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-medium tracking-tight text-text">Goals</h1>
          <p className="mt-1 text-sm text-muted">
            Track progress toward your financial targets
          </p>
        </div>
        {!formMode && (
          <button
            onClick={() => setFormMode({ kind: "create" })}
            className="bg-accent text-bg-base rounded-lg px-4 py-2 text-sm hover:bg-accent-hover transition-colors"
          >
            + New Goal
          </button>
        )}
      </div>

      {formMode && (
        <div ref={formRef} className="rounded-2xl border border-border bg-bg-card p-5">
          <h2 className="mb-4 text-base font-semibold text-text">
            {formMode.kind === "create"
              ? "Create New Goal"
              : formMode.kind === "complete"
                ? "Complete Goal"
                : "Edit Goal"}
          </h2>
          <GoalForm
            key={`${formMode.kind}-${formMode.kind === "create" ? "new" : formMode.goalId}`}
            initial={
              editingItem
                ? {
                    id: editingItem.goal.id,
                    name: editingItem.goal.name,
                    description: editingItem.goal.description,
                    targetValue: editingItem.goal.targetValue,
                    targetDate: editingItem.goal.targetDate,
                    metricType: editingItem.goal.metricType,
                    linkedCategory: editingItem.goal.linkedCategory,
                    completedAt: editingItem.goal.completedAt,
                    files: editingItem.files,
                  }
                : undefined
            }
            defaultMarkCompleted={formMode.kind === "complete"}
            onSuccess={closeFormAndRefresh}
            onCancel={() => setFormMode(null)}
          />
        </div>
      )}

      {loading && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-48 animate-pulse rounded-2xl bg-bg-card" />
          ))}
        </div>
      )}

      {!loading && error && (
        <div className="rounded-2xl border border-negative/40 bg-negative/10 p-4 text-sm text-negative">
          {error}
        </div>
      )}

      {!loading && !error && goals.length === 0 && !formMode && (
        <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-border bg-bg-card py-16 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-accent/20">
            <Target className="text-accent" size={28} />
          </div>
          <div>
            <p className="font-semibold text-text">Set your first goal</p>
            <p className="mt-1 text-sm text-muted">
              Create a financial goal to start tracking your progress.
            </p>
          </div>
          <button
            onClick={() => setFormMode({ kind: "create" })}
            className="bg-accent text-bg-base rounded-lg px-4 py-2 text-sm hover:bg-accent-hover transition-colors"
          >
            Create Goal
          </button>
        </div>
      )}

      {!loading && !error && goals.length > 0 && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {goals.map((item) => (
            <GoalCard
              key={item.goal.id}
              item={item}
              onEdit={() => setFormMode({ kind: "edit", goalId: item.goal.id })}
              onComplete={() => setFormMode({ kind: "complete", goalId: item.goal.id })}
              onDelete={() => handleDelete(item.goal.id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
