import { Check, ChevronDown } from "lucide-react";
import { useState } from "react";

export const CATEGORY_OPTIONS = ["Alimentação", "Trabalho", "Estudos", "Financeiro", "Físico", "Saúde", "Desenvolvimento pessoal", "Hábitos", "Mente", "Relacionamentos", "Outros"] as const;

const CATEGORY_META: Record<string, { emoji: string; tone: string }> = {
  Alimentação: { emoji: "🥗", tone: "category-chip-green" },
  Trabalho: { emoji: "💼", tone: "category-chip-red" },
  Estudos: { emoji: "📚", tone: "category-chip-purple" },
  Financeiro: { emoji: "💰", tone: "category-chip-yellow" },
  Físico: { emoji: "🏋️", tone: "category-chip-orange" },
  Saúde: { emoji: "🩺", tone: "category-chip-green" },
  "Desenvolvimento pessoal": { emoji: "🚀", tone: "category-chip-purple" },
  Hábitos: { emoji: "🔁", tone: "category-chip-blue" },
  Mente: { emoji: "🧠", tone: "category-chip-purple" },
  Relacionamentos: { emoji: "🤝", tone: "category-chip-pink" },
  Outros: { emoji: "✦", tone: "category-chip-gray" },
};

export function CategoryPicker({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const [open, setOpen] = useState(false);
  const selectedMeta = value ? CATEGORY_META[value] : null;
  return <div className="category-picker-wrap">
    <button type="button" aria-expanded={open} onClick={() => setOpen(current => !current)} className={`category-field ${selectedMeta?.tone ?? "category-chip-empty"}`}>
      {selectedMeta ? <><span className="category-emoji" aria-hidden="true">{selectedMeta.emoji}</span><span>{value}</span></> : <><span className="category-emoji" aria-hidden="true">✦</span><span>Escolha o tipo da tarefa</span></>}
      <ChevronDown size={15} className={`category-chevron ${open ? "rotate-180" : ""}`} />
    </button>
    {open && <div className="category-picker" role="radiogroup" aria-label="Escolha uma categoria">
      <button type="button" role="radio" aria-checked={!value} onClick={() => { onChange(""); setOpen(false); }} className={`category-chip category-chip-empty ${!value ? "selected" : ""}`}>✦ <span>Sem categoria</span>{!value && <Check size={13} />}</button>
      {CATEGORY_OPTIONS.map(option => {
        const meta = CATEGORY_META[option];
        const selected = value === option;
        return <button type="button" role="radio" aria-checked={selected} key={option} onClick={() => { onChange(option); setOpen(false); }} className={`category-chip ${meta.tone} ${selected ? "selected" : ""}`}><span className="category-emoji" aria-hidden="true">{meta.emoji}</span><span>{option}</span>{selected && <Check size={13} />}</button>;
      })}
    </div>}
  </div>;
}
