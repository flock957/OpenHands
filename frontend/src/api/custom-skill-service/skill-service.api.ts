import { openHands } from "#/api/open-hands-axios";

export interface SkillInfo {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  skill_type: string;
  triggers: string[];
  tags: string[];
  is_global: boolean;
  is_active: boolean;
  created_by: string | null;
  current_version: number;
  created_at: string;
  updated_at: string;
}

export interface SkillVersionInfo {
  id: string;
  skill_id: string;
  version: number;
  content: string;
  changelog: string | null;
  performance_notes: string | null;
  is_current: boolean;
  created_by: string | null;
  created_at: string;
}

export interface ScriptInfo {
  id: string;
  skill_id: string;
  filename: string;
  language: string | null;
  content: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface SkillDetail extends SkillInfo {
  content: string;
  versions: SkillVersionInfo[];
  scripts: ScriptInfo[];
}

export interface SkillListResponse {
  results: SkillInfo[];
  total: number;
}

class SkillService {
  static async listSkills(params?: {
    search?: string;
    category?: string;
    tag?: string;
    is_active?: boolean;
    limit?: number;
    offset?: number;
  }): Promise<SkillListResponse> {
    const { data } = await openHands.get<SkillListResponse>("/api/v1/skills", { params });
    return data;
  }

  static async getSkill(skillId: string): Promise<SkillDetail> {
    const { data } = await openHands.get<SkillDetail>(`/api/v1/skills/${skillId}`);
    return data;
  }

  static async createSkill(skill: {
    name: string;
    description?: string;
    category?: string;
    triggers?: string[];
    tags?: string[];
    content: string;
  }): Promise<SkillDetail> {
    const { data } = await openHands.post<SkillDetail>("/api/v1/skills", skill);
    return data;
  }

  static async updateSkill(skillId: string, updates: {
    description?: string;
    category?: string;
    triggers?: string[];
    tags?: string[];
    is_global?: boolean;
    is_active?: boolean;
  }): Promise<SkillDetail> {
    const { data } = await openHands.patch<SkillDetail>(`/api/v1/skills/${skillId}`, updates);
    return data;
  }

  static async deleteSkill(skillId: string): Promise<void> {
    await openHands.delete(`/api/v1/skills/${skillId}`);
  }

  static async uploadSkillFiles(formData: FormData): Promise<SkillDetail> {
    const { data } = await openHands.post<SkillDetail>("/api/v1/skills/upload", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return data;
  }

  static async createVersion(skillId: string, version: {
    content: string;
    changelog?: string;
    performance_notes?: string;
  }): Promise<SkillVersionInfo> {
    const { data } = await openHands.post<SkillVersionInfo>(`/api/v1/skills/${skillId}/versions`, version);
    return data;
  }

  static async rollbackVersion(skillId: string, versionId: string): Promise<SkillDetail> {
    const { data } = await openHands.post<SkillDetail>(`/api/v1/skills/${skillId}/versions/${versionId}/rollback`);
    return data;
  }

  static async uploadScript(skillId: string, formData: FormData): Promise<ScriptInfo> {
    const { data } = await openHands.post<ScriptInfo>(`/api/v1/skills/${skillId}/scripts/upload`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return data;
  }

  static async deleteScript(scriptId: string): Promise<void> {
    await openHands.delete(`/api/v1/skills/scripts/${scriptId}`);
  }

  static async getCategories(): Promise<string[]> {
    const { data } = await openHands.get<string[]>("/api/v1/skills/categories");
    return data;
  }
}

export default SkillService;
