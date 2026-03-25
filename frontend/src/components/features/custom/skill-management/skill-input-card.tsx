import React from "react";
import type { SkillInputField } from "#/utils/parse-skill-inputs";
import { useSkillInputStore } from "#/stores/skill-input-store";

interface Props {
  skillName: string;
  trigger: string | undefined;
  inputs: SkillInputField[];
  onSubmit: (message: string) => void;
}

export function SkillInputCard({ skillName, trigger, inputs, onSubmit }: Props) {
  const { clear } = useSkillInputStore();
  const [values, setValues] = React.useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const field of inputs) {
      init[field.name] = field.default || "";
    }
    return init;
  });

  const handleChange = (name: string, value: string) => {
    setValues((prev) => ({ ...prev, [name]: value }));
  };

  const canSubmit = inputs
    .filter((f) => f.required)
    .every((f) => (values[f.name] || "").trim() !== "");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const lines: string[] = [];
    for (const field of inputs) {
      const val = values[field.name] || "";
      if (val) {
        lines.push(`${field.label || field.name}: ${val}`);
      }
    }
    clear();
    onSubmit(lines.join("\n"));
  };

  const handleCancel = () => {
    clear();
  };

  return (
    <article
      data-testid="skill-input-card"
      className="rounded-xl relative w-full max-w-full mt-6 bg-transparent"
    >
      <div className="text-sm" style={{ whiteSpace: "normal", wordBreak: "break-word" }}>
        <div className="border border-neutral-600 rounded-lg overflow-hidden">
          {/* Header */}
          <div className="px-4 py-3 bg-neutral-800 border-b border-neutral-600 flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
            <span className="text-sm font-medium text-neutral-200">
              {skillName}
            </span>
            <span className="text-xs text-neutral-500">
              {trigger || ""}
            </span>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-4 space-y-4">
            {inputs.map((field) => (
              <div key={field.name}>
                <label className="block text-xs font-medium text-neutral-400 mb-1.5">
                  {field.label || field.name}
                  {field.required && <span className="text-danger ml-0.5">*</span>}
                </label>
                {field.type === "textarea" ? (
                  <textarea
                    value={values[field.name] || ""}
                    onChange={(e) => handleChange(field.name, e.target.value)}
                    placeholder={field.placeholder || ""}
                    rows={3}
                    className="w-full px-3 py-2 bg-tertiary border border-neutral-600 rounded-lg text-sm text-content placeholder-neutral-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 resize-none transition"
                  />
                ) : (
                  <input
                    type="text"
                    value={values[field.name] || ""}
                    onChange={(e) => handleChange(field.name, e.target.value)}
                    placeholder={field.placeholder || ""}
                    className="w-full px-3 py-2 bg-tertiary border border-neutral-600 rounded-lg text-sm text-content placeholder-neutral-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition"
                  />
                )}
              </div>
            ))}

            {/* Buttons */}
            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={handleCancel}
                className="px-3 py-1.5 text-xs text-neutral-400 hover:text-neutral-200 rounded-lg border border-neutral-600 hover:border-neutral-500 transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!canSubmit}
                className={`px-4 py-1.5 text-xs rounded-lg transition font-medium ${
                  canSubmit
                    ? "bg-blue-600 text-white hover:bg-blue-500"
                    : "bg-neutral-700 text-neutral-500 cursor-not-allowed"
                }`}
              >
                Submit
              </button>
            </div>
          </form>
        </div>
      </div>
    </article>
  );
}
