import React from "react";
import type { SkillInputField } from "#/utils/parse-skill-inputs";

interface Props {
  skillName: string;
  inputs: SkillInputField[];
  onSubmit: (values: Record<string, string>) => void;
  onCancel: () => void;
}

export function SkillInputForm({ skillName, inputs, onSubmit, onCancel }: Props) {
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(values);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      onCancel();
    }
  };

  const canSubmit = inputs
    .filter((f) => f.required)
    .every((f) => (values[f.name] || "").trim() !== "");

  return (
    <div
      className="bg-[#1e2028] border border-[#444] rounded-lg shadow-xl overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-200"
      onKeyDown={handleKeyDown}
    >
      {/* Header */}
      <div className="px-4 py-2.5 bg-[#24272e] border-b border-[#333] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-400">
            <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
          </svg>
          <span className="text-sm font-medium text-white">{skillName}</span>
          <span className="text-xs text-gray-500">请填写参数</span>
        </div>
        <button
          onClick={onCancel}
          className="text-gray-400 hover:text-white text-lg leading-none px-1"
          title="取消"
        >
          &times;
        </button>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="p-4 space-y-3">
        {inputs.map((field) => (
          <div key={field.name}>
            <label className="block text-xs text-gray-400 mb-1">
              {field.label || field.name}
              {field.required && <span className="text-red-400 ml-0.5">*</span>}
            </label>
            {field.type === "textarea" ? (
              <textarea
                value={values[field.name] || ""}
                onChange={(e) => handleChange(field.name, e.target.value)}
                placeholder={field.placeholder || ""}
                rows={3}
                className="w-full px-3 py-2 bg-[#13151a] border border-[#444] rounded text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500 resize-none"
                autoFocus={inputs.indexOf(field) === 0}
              />
            ) : field.type === "select" && field.options ? (
              <select
                value={values[field.name] || ""}
                onChange={(e) => handleChange(field.name, e.target.value)}
                className="w-full px-3 py-2 bg-[#13151a] border border-[#444] rounded text-sm text-white focus:outline-none focus:border-blue-500"
              >
                <option value="">{field.placeholder || "请选择..."}</option>
                {field.options.map((opt) => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                value={values[field.name] || ""}
                onChange={(e) => handleChange(field.name, e.target.value)}
                placeholder={field.placeholder || ""}
                className="w-full px-3 py-2 bg-[#13151a] border border-[#444] rounded text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500"
                autoFocus={inputs.indexOf(field) === 0}
              />
            )}
          </div>
        ))}

        {/* Buttons */}
        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onCancel}
            className="px-3 py-1.5 text-xs text-gray-400 hover:text-white rounded border border-[#444] hover:border-[#666] transition"
          >
            取消
          </button>
          <button
            type="submit"
            disabled={!canSubmit}
            className={`px-4 py-1.5 text-xs rounded transition font-medium ${
              canSubmit
                ? "bg-blue-600 text-white hover:bg-blue-500"
                : "bg-gray-700 text-gray-500 cursor-not-allowed"
            }`}
          >
            执行
          </button>
        </div>
      </form>
    </div>
  );
}
