import { spawn } from 'child_process';

export interface HermesResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export interface ShellResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

/**
 * Execute Hermes Agent via `hermes chat -q "<prompt>"`
 * Captures stdout, stderr, and exit code
 */
export function executeHermesAgent(
  prompt: string,
  options: { cwd?: string; timeout?: number } = {}
): Promise<HermesResult> {
  return new Promise((resolve, reject) => {
    const { cwd = process.cwd(), timeout = 300000 } = options;
    
    // Escape prompt for shell
    const escapedPrompt = prompt.replace(/"/g, '\\"');
    
    const hermes = spawn('hermes', ['chat', '-q', escapedPrompt], {
      cwd,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';
    let timedOut = false;

    // Set timeout
    const timer = setTimeout(() => {
      timedOut = true;
      hermes.kill('SIGKILL');
    }, timeout);

    hermes.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    hermes.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    hermes.on('close', (code) => {
      clearTimeout(timer);
      
      if (timedOut) {
        reject(new Error(`Hermes Agent timed out after ${timeout}ms`));
        return;
      }

      resolve({
        stdout: stdout.trim(),
        stderr: stderr.trim(),
        exitCode: code ?? -1,
      });
    });

    hermes.on('error', (error) => {
      clearTimeout(timer);
      reject(new Error(`Failed to spawn Hermes Agent: ${error.message}`));
    });
  });
}

/**
 * Execute shell command
 */
export function executeShellCommand(
  command: string,
  options: { cwd?: string; timeout?: number; env?: Record<string, string> } = {}
): Promise<ShellResult> {
  return new Promise((resolve, reject) => {
    const { cwd = process.cwd(), timeout = 300000, env = {} } = options;
    
    // Merge environment variables
    const mergedEnv = { ...process.env, ...env };
    
    const proc = spawn(command, [], {
      cwd,
      shell: true,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: mergedEnv,
    });

    let stdout = '';
    let stderr = '';
    let timedOut = false;

    const timer = setTimeout(() => {
      timedOut = true;
      proc.kill('SIGKILL');
    }, timeout);

    proc.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    proc.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    proc.on('close', (code) => {
      clearTimeout(timer);
      
      if (timedOut) {
        reject(new Error(`Shell command timed out after ${timeout}ms`));
        return;
      }

      resolve({
        stdout: stdout.trim(),
        stderr: stderr.trim(),
        exitCode: code ?? -1,
      });
    });

    proc.on('error', (error) => {
      clearTimeout(timer);
      reject(new Error(`Failed to execute shell command: ${error.message}`));
    });
  });
}
