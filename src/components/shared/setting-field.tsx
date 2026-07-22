interface SettingFieldProps {
  label: string
  description: string
  value: number
  min: number
  max: number
  step: number
  onChange: (value: number) => void
}

export const SettingField = ({ label, description, value, min, max, step, onChange }: SettingFieldProps) => (
  <div className="flex flex-col gap-1.5 rounded-lg border dark:border-zinc-700/50 bg-zinc-50 dark:bg-zinc-800/50 p-4">
    <div className="flex items-center justify-between">
      <p className="text-sm font-medium">{label}</p>
      <span className="rounded bg-white dark:bg-zinc-800 px-2 py-0.5 text-sm font-bold tabular-nums shadow-sm ring-1 ring-zinc-200 dark:ring-zinc-700">
        {value % 1 === 0 ? value : value.toFixed(2)}
      </span>
    </div>
    <p className="text-muted-foreground text-xs">{description}</p>
    <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(parseFloat(e.target.value))} className="mt-1 w-full accent-zinc-800" />
    <div className="flex justify-between text-xs text-zinc-400">
      <span>{min}</span>
      <span>{max}</span>
    </div>
  </div>
)
