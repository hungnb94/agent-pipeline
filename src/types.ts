export interface PipelineConfig {
  entry: string;
  steps: Record<string, Step>;
}

export interface AgentStep {
  type: 'agent';
  prompt?: string;
  next?: string;
  next_fail?: string;
  max_visits?: number;
}

export interface ShellStep {
  type: 'shell';
  commands: string[];
  next?: string;
  next_fail?: string;
  max_visits?: number;
}

export type Step = AgentStep | ShellStep;

export interface PipelineState {
  current_step: string;
  completed_steps: string[];
  step_outputs: Record<string, string>;
  step_visits: Record<string, number>;
}

export interface HermesOptions {
  cwd?: string;
  timeout?: number;
}

export interface ShellResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}
