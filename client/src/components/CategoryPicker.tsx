import { Check } from "lucide-react";

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
  return <div className="category-picker" role="radiogroup" aria-label="Escolha uma categoria">
    <button type="button" role="radio" aria-checked={!value} onClick={() => onChange("")} className={`category-chip category-chip-empty ${!value ? "selected" : ""}`}>✦ <span>Escolher</span>{!value && <Check size={13} />}</button>
    {CATEGORY_OPTIONS.map(option => {
      const meta = CATEGORY_META[option];
      const selected = value === option;
      return <button type="button" role="radio" aria-checked={selected} key={option} onClick={() => onChange(option)} className={`category-chip ${meta.tone} ${selected ? "selected" : ""}`}><span className="category-emoji" aria-hidden="true">{meta.emoji}</span><span>{option}</span>{selected && <Check size={13} />}</button>;
    })}
  </div>;
}
