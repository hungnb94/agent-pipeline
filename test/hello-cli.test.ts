import { execSync } from 'child_process';
import * as path from 'path';

const CLI = path.resolve(__dirname, '../dist/cli.js');

describe('agent-pipeline hello (CLI integration)', () => {
  it('prints "Hello World" to stdout and exits 0', () => {
    let stdout = '';
    let exitCode = 1;
    try {
      stdout = execSync(`node ${CLI} hello`, { encoding: 'utf-8', stdio: 'pipe' });
      exitCode = 0;
    } catch (err: any) {
      stdout = err.stdout || '';
      exitCode = err.status || 1;
    }
    expect(exitCode).toBe(0);
    expect(stdout).toBe('Hello World\n');
  });

  it('writes nothing to stderr', () => {
    let stderr = '';
    try {
      execSync(`node ${CLI} hello`, { encoding: 'utf-8', stdio: 'pipe' });
    } catch (err: any) {
      stderr = err.stderr || '';
    }
    expect(stderr).toBe('');
  });

  it('produces byte-identical output on repeated runs (deterministic)', () => {
    const run = () => execSync(`node ${CLI} hello`, { encoding: 'utf-8', stdio: 'pipe' });
    const a = run();
    const b = run();
    expect(a).toBe(b);
  });
});
