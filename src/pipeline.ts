import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'yaml';
import chalk from 'chalk';
import { PipelineConfig, Step, PipelineState, ShellStep } from './types';
import { executeHermesAgent, executeShellCommand } from './hermes';

export class PipelineExecutor {
  private config: PipelineConfig;
  private specContent: string;
  private state: PipelineState;
  private logPath: string;

  constructor(
    configPath: string,
    specPath: string,
    private cwd: string = process.cwd()
  ) {
    // Load pipeline config
    const configFile = fs.readFileSync(configPath, 'utf8');
    this.config = yaml.parse(configFile) as PipelineConfig;

    // Load spec file
    this.specContent = fs.readFileSync(specPath, 'utf8');

    // Initialize state
    this.state = {
      current_step: this.config.entry,
      completed_steps: [],
      step_outputs: {
        spec_file: specPath,
      },
      step_visits: {},
    };

    // Setup logging
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    this.logPath = path.join(this.cwd, 'logs', `pipeline-${timestamp}.log`);
    fs.mkdirSync(path.dirname(this.logPath), { recursive: true });
  }

  /**
   * Replace {{placeholders}} with actual values from step outputs
   */
  private substitutePlaceholders(template: string): string {
    return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      return this.state.step_outputs[key] || `{{${key}}}`;
    });
  }

  /**
   * Read shell-side env vars written by a previous step.
   * Convention: shell steps can `echo "KEY=VALUE" > /tmp/evidence/.env`
   * and the next shell step gets those vars injected into its environment.
   * Returns empty object if the file doesn't exist or is unreadable.
   */
  private loadShellEnv(): Record<string, string> {
    const envFile = '/tmp/evidence/.env';
    if (!fs.existsSync(envFile)) return {};
    try {
      const env: Record<string, string> = {};
      for (const line of fs.readFileSync(envFile, 'utf8').split('\n')) {
        const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
        if (m) env[m[1]] = m[2];
      }
      return env;
    } catch {
      return {};
    }
  }

  /**
   * Log message to console and file
   */
  private log(message: string, level: 'info' | 'error' | 'success' = 'info'): void {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] [${level.toUpperCase()}] ${message}\n`;
    
    fs.appendFileSync(this.logPath, logMessage);

    switch (level) {
      case 'info':
        console.log(chalk.blue(`ℹ ${message}`));
        break;
      case 'error':
        console.log(chalk.red(`✗ ${message}`));
        break;
      case 'success':
        console.log(chalk.green(`✓ ${message}`));
        break;
    }
  }

  /**
   * Execute a single step
   */
  private async executeStep(stepName: string): Promise<string> {
    const step = this.config.steps[stepName];
    if (!step) {
      throw new Error(`Step not found: ${stepName}`);
    }

    // Track visits for cycle detection
    this.state.step_visits[stepName] = (this.state.step_visits[stepName] || 0) + 1;

    // Check max_visits
    if (step.max_visits && this.state.step_visits[stepName] > step.max_visits) {
      this.log(`Step ${stepName} exceeded max_visits (${step.max_visits}), auto-succeeding`, 'info');
      this.state.completed_steps.push(stepName);
      return '';
    }

    this.log(`Starting step: ${stepName} (type: ${step.type})`, 'info');

    let output = '';

    if (step.type === 'agent') {
      if (!step.prompt) {
        throw new Error(`Agent step ${stepName} missing prompt`);
      }

      // Substitute placeholders in prompt
      const prompt = this.substitutePlaceholders(step.prompt);

      // Execute Hermes Agent
      this.log(`Executing Hermes Agent for step: ${stepName}`, 'info');
      const result = await executeHermesAgent(prompt, { cwd: this.cwd });

      output = result.stdout;
      
      // Log stderr if any
      if (result.stderr) {
        this.log(`Hermes stderr for step ${stepName}: ${result.stderr}`, 'error');
      }

      if (result.exitCode !== 0) {
        throw new Error(`Hermes Agent failed with exit code ${result.exitCode}`);
      }

    } else if (step.type === 'shell') {
      // Phase 2 - Shell command execution
      const shellStep = step as ShellStep;
      if (!shellStep.commands || shellStep.commands.length === 0) {
        throw new Error(`Shell step ${stepName} has no commands`);
      }

      // Substitute placeholders in each command
      const commands = shellStep.commands.map(cmd => this.substitutePlaceholders(cmd));

      // Execute each command sequentially
      for (const command of commands) {
        this.log(`Executing shell command: ${command.split('\n')[0].substring(0, 80)}...`, 'info');

        const result = await executeShellCommand(command, {
          cwd: this.cwd,
          env: {
            ...this.loadShellEnv(),
            NEW_VERSION: this.state.step_outputs.new_version || '',
          },
        });

        // Capture output
        output += result.stdout + '\n';
        
        // Log stderr if any
        if (result.stderr) {
          this.log(`Shell stderr for step ${stepName}: ${result.stderr}`, 'error');
        }

        // Capture NEW_VERSION from environment
        const versionMatch = result.stdout.match(/New version: (v[0-9.]+)/);
        if (versionMatch) {
          this.state.step_outputs.new_version = versionMatch[1];
        }

        // Check exit code
        if (result.exitCode !== 0) {
          throw new Error(`Shell command failed with exit code ${result.exitCode}`);
        }
      }
    }

    // Store output
    this.state.step_outputs[`${stepName}_output`] = output;
    this.state.completed_steps.push(stepName);
    this.state.current_step = stepName;

    this.log(`Completed step: ${stepName}`, 'success');
    this.log(`Output length: ${output.length} characters`, 'info');

    return output;
  }

  /**
   * Run the entire pipeline
   */
  async run(): Promise<void> {
    this.log('Starting pipeline execution', 'info');
    this.log(`Entry point: ${this.config.entry}`, 'info');
    this.log(`Total steps: ${Object.keys(this.config.steps).length}`, 'info');

    let currentStep = this.config.entry;
    let iterations = 0;
    const maxIterations = 1000; // Safety limit

    while (currentStep && iterations < maxIterations) {
      iterations++;

      const step = this.config.steps[currentStep];
      if (!step) {
        this.log(`Step not found: ${currentStep}`, 'error');
        break;
      }

      try {
        await this.executeStep(currentStep);

        // Determine next step
        currentStep = step.next || '';

      } catch (error) {
        this.log(`Step ${currentStep} failed: ${error}`, 'error');

        // Check if there's a fail path
        if (step.next_fail) {
          this.log(`Following fail path: ${step.next_fail}`, 'info');
          currentStep = step.next_fail;
        } else {
          throw error;
        }
      }
    }

    if (iterations >= maxIterations) {
      throw new Error('Pipeline exceeded maximum iterations (possible infinite loop)');
    }

    this.log('Pipeline execution completed', 'success');
    this.log(`Total steps executed: ${this.state.completed_steps.length}`, 'info');
    this.log(`Log file: ${this.logPath}`, 'info');
  }

  /**
   * Get final state
   */
  getState(): PipelineState {
    return { ...this.state };
  }

  /**
   * Get log path
   */
  getLogPath(): string {
    return this.logPath;
  }
}
