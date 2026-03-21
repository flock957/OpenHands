/**
 * Parse `inputs` from a skill's YAML frontmatter.
 *
 * Example frontmatter:
 * ```yaml
 * ---
 * name: android-kernel-diff-analysis
 * inputs:
 * - name: old_tag
 *   label: 旧版本标签
 *   placeholder: "e.g., android-6.12-2025-08"
 *   required: true
 * - name: new_tag
 *   label: 新版本标签
 *   placeholder: "e.g., android-6.12-2025-12"
 *   required: true
 * ---
 * ```
 */

export interface SkillInputField {
  name: string;
  label: string;
  placeholder?: string;
  required?: boolean;
  type?: "text" | "textarea" | "select";
  options?: string[]; // for select type
  default?: string;
}

/**
 * Extract YAML frontmatter from skill content.
 * Returns the YAML string between --- delimiters, or null.
 */
function extractFrontmatter(content: string): string | null {
  const match = content.match(/^---\s*\n([\s\S]*?)\n---/);
  return match ? match[1] : null;
}

/**
 * Simple YAML-like parser for the `inputs:` section.
 * We avoid pulling in a full YAML library by doing lightweight parsing.
 */
export function parseSkillInputs(content: string): SkillInputField[] {
  const yaml = extractFrontmatter(content);
  if (!yaml) return [];

  // Find the "inputs:" line
  const inputsMatch = yaml.match(/^inputs:\s*$/m);
  if (!inputsMatch) return [];

  const startIdx = yaml.indexOf(inputsMatch[0]) + inputsMatch[0].length;
  const afterInputs = yaml.slice(startIdx);

  const fields: SkillInputField[] = [];
  let current: Partial<SkillInputField> | null = null;

  for (const line of afterInputs.split("\n")) {
    // Stop if we hit a top-level key (no leading whitespace)
    if (/^\S/.test(line) && line.trim() !== "") break;

    const trimmed = line.trim();
    if (!trimmed) continue;

    // New list item: "- name: xxx"
    const itemMatch = trimmed.match(/^-\s+(\w+):\s*(.*)$/);
    if (itemMatch) {
      // Save previous field
      if (current?.name) {
        fields.push({
          name: current.name,
          label: current.label || current.name,
          ...current,
        } as SkillInputField);
      }
      current = {};
      current[itemMatch[1] as keyof SkillInputField] = parseValue(itemMatch[2]);
    } else {
      // Continuation property: "  key: value"
      const propMatch = trimmed.match(/^(\w+):\s*(.*)$/);
      if (propMatch && current) {
        current[propMatch[1] as keyof SkillInputField] = parseValue(propMatch[2]);
      }
    }
  }

  // Don't forget the last one
  if (current?.name) {
    fields.push({
      name: current.name,
      label: current.label || current.name,
      ...current,
    } as SkillInputField);
  }

  return fields;
}

function parseValue(raw: string): any {
  const s = raw.trim();
  // Remove surrounding quotes
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    return s.slice(1, -1);
  }
  if (s === "true") return true;
  if (s === "false") return false;
  if (/^\d+$/.test(s)) return parseInt(s, 10);
  return s;
}

/**
 * Format user-filled input values into a message for the agent.
 */
export function formatSkillMessage(
  skillName: string,
  trigger: string | undefined,
  inputs: SkillInputField[],
  values: Record<string, string>,
): string {
  const parts: string[] = [];

  if (trigger) {
    parts.push(`Execute skill: ${skillName} (trigger: ${trigger}).`);
  } else {
    parts.push(`Execute skill: ${skillName}.`);
  }

  if (inputs.length > 0) {
    parts.push("\nUser provided parameters:");
    for (const field of inputs) {
      const val = values[field.name] || "";
      if (val) {
        parts.push(`- ${field.label || field.name}: ${val}`);
      }
    }
  }

  parts.push("\nFollow the skill instructions to complete the task.");

  return parts.join("\n");
}
