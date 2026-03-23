import { openHands } from "#/api/open-hands-axios";

export interface TaskInfo {
  id: string;
  agent_id: string | null;
  agent_name: string | null;
  conversation_id: string | null;
  name: string | null;
  status: string;
  created_by: string | null;
  started_at: string | null;
  completed_at: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

export interface TaskListResponse {
  tasks: TaskInfo[];
  total: number;
}

export interface TaskCreateResponse {
  task_id: string;
  agent: {
    name: string;
    system_prompt: string | null;
    skill_ids: string[];
    default_llm_model: string | null;
  };
}

export class TaskService {
  static async listTasks(params?: {
    status?: string;
    agent_id?: string;
    search?: string;
    limit?: number;
    offset?: number;
  }): Promise<TaskListResponse> {
    const resp = await openHands.get("/api/v1/tasks", { params });
    return resp.data;
  }

  static async getTask(taskId: string): Promise<TaskInfo> {
    const resp = await openHands.get(`/api/v1/tasks/${taskId}`);
    return resp.data;
  }

  static async createTask(data: {
    agent_id: string;
    name?: string;
    initial_message?: string;
  }): Promise<TaskCreateResponse> {
    const resp = await openHands.post("/api/v1/tasks", data);
    return resp.data;
  }

  static async updateTask(
    taskId: string,
    data: { name?: string; status?: string },
  ): Promise<void> {
    await openHands.patch(`/api/v1/tasks/${taskId}`, data);
  }

  static async cancelTask(taskId: string): Promise<void> {
    await openHands.post(`/api/v1/tasks/${taskId}/cancel`);
  }
}
