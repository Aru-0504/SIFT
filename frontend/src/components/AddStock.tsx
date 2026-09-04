import { useState } from 'react'

export function AddStock({ onAdd, isPending }: { onAdd: (symbol: string) => void; isPending: boolean }) {
  const [value, setValue] = useState('')

  const submit = () => {
    const symbol = value.trim().toUpperCase()
    if (!symbol) return
    onAdd(symbol)
    setValue('')
  }

  return (
    <div className="flex gap-3">
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && submit()}
        placeholder="Search stocks or add symbol (e.g., RELIANCE.NS, AAPL)"
        className="input flex-1"
        disabled={isPending}
      />
      <button
        onClick={submit}
        disabled={isPending || !value.trim()}
        className="btn btn-primary"
      >
        Add
      </button>
    </div>
  )
}
