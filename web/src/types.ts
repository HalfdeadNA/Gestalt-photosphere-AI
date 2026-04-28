export type RoleMode =
  | 'Chief of Staff'
  | 'CEO Filter'
  | 'Executive Assistant'
  | 'Creative Director'
  | 'Research Analyst'
  | 'Operations Coordinator'
  | 'App Connector'
  | 'Agentic AI Orchestrator';

export type Task = {
  id: string;
  title: string;
  priority: 'Low' | 'Medium' | 'High';
  status: 'Open' | 'Done';
};

export type Project = {
  id: string;
  name: string;
  status: 'Planning' | 'Active' | 'Paused' | 'Complete';
};

export type MemoryItem = {
  id: string;
  title: string;
  content: string;
  category: string;
  isActive: boolean;
};

export type ApprovalRequest = {
  id: string;
  title: string;
  description: string;
  status: 'Pending' | 'Approved' | 'Rejected';
};

export type ActionLog = {
  id: string;
  summary: string;
  status: 'Drafted' | 'Saved' | 'Needs Approval' | 'Done' | 'Blocked';
  createdAt: string;
};
