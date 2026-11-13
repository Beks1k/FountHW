const EVERYONE = '*'

export default function GroupTargetPicker({ groups, value, onChange }) {
  const entries = Object.entries(groups || {})
  const selected = value || []
  const everyone =
    selected.length === 0 || selected.includes(EVERYONE)

  const toggle = (id) => {
    if (everyone) {
      onChange([id])
      return
    }
    onChange(
      selected.includes(id)
        ? selected.filter((g) => g !== id)
        : [...selected, id]
    )
  }

  return (
    <div className="field">
      <label>Who is this for?</label>

      <label className="target-option">
        <input
          type="checkbox"
          checked={everyone}
          onChange={() => onChange([EVERYONE])}
        />
        <span>Everyone in the class</span>
      </label>

      {entries.map(([id, name]) => (
        <label key={id} className="target-option">
          <input
            type="checkbox"
            checked={!everyone && selected.includes(id)}
            onChange={() => toggle(id)}
          />
          <span>{name}</span>
        </label>
      ))}

      {entries.length === 0 && (
        <p className="card-hint">
          No groups yet — this will go to everyone. Create groups in the Groups
          tab to target specific students.
        </p>
      )}

      {entries.length > 0 && !everyone && (
        <p className="card-hint">
          Students who are not in any group will not see this. Tick
          &quot;Everyone in the class&quot; to include them.
        </p>
      )}
    </div>
  )
}
