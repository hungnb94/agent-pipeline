import { PipelineExecutor } from '../src/pipeline';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

describe('PipelineExecutor — shell steps', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pipeline-test-'));
    // Minimal package.json
    fs.writeFileSync(
      path.join(tmpDir, 'package.json'),
      JSON.stringify({ name: 'x', version: '0.0.0' })
    );
    // Minimal pipeline.yaml with one shell step
    fs.writeFileSync(
      path.join(tmpDir, 'pipeline.yaml'),
      'entry: echo_step\nsteps:\n  echo_step:\n    type: shell\n    commands:\n      - "echo hello"\n    next: done\n'
    );
    // Empty spec.md so constructor doesn't throw
    fs.writeFileSync(path.join(tmpDir, 'spec.md'), '');
  });

  afterEach(() => fs.rmSync(tmpDir, { recursive: true, force: true }));

  it('runs a shell step and stores output', async () => {
    const exec = new PipelineExecutor(
      path.join(tmpDir, 'pipeline.yaml'),
      path.join(tmpDir, 'spec.md'),
      tmpDir
    );
    await exec.run();
    const state = exec.getState();
    expect(state.completed_steps).toContain('echo_step');
    expect(state.step_outputs.echo_step_output).toContain('hello');
  });

  it('captures NEW_VERSION from shell output when pattern matches', async () => {
    fs.writeFileSync(
      path.join(tmpDir, 'pipeline.yaml'),
      'entry: v\nsteps:\n  v:\n    type: shell\n    commands:\n      - "echo New version: v9.9.9"\n'
    );
    const exec = new PipelineExecutor(
      path.join(tmpDir, 'pipeline.yaml'),
      path.join(tmpDir, 'spec.md'),
      tmpDir
    );
    await exec.run();
    expect(exec.getState().step_outputs.new_version).toBe('v9.9.9');
  });

  it('injects env vars into shell commands', async () => {
    fs.writeFileSync(
      path.join(tmpDir, 'pipeline.yaml'),
      'entry: v\nsteps:\n  v:\n    type: shell\n    commands:\n      - "echo value=$NEW_VERSION"\n'
    );
    const exec = new PipelineExecutor(
      path.join(tmpDir, 'pipeline.yaml'),
      path.join(tmpDir, 'spec.md'),
      tmpDir
    );
    // Seed NEW_VERSION via state
    (exec as any).state.step_outputs.new_version = 'v3.2.1';
    await exec.run();
    expect(exec.getState().step_outputs.v_output).toContain('value=v3.2.1');
  });

  it('follows next_fail path when a shell command exits non-zero', async () => {
    fs.writeFileSync(
      path.join(tmpDir, 'pipeline.yaml'),
      'entry: bad\nsteps:\n  bad:\n    type: shell\n    commands:\n      - "exit 1"\n    next_fail: recovered\n  recovered:\n    type: shell\n    commands:\n      - "echo recovered"\n    next: done\n'
    );
    const exec = new PipelineExecutor(
      path.join(tmpDir, 'pipeline.yaml'),
      path.join(tmpDir, 'spec.md'),
      tmpDir
    );
    await exec.run();
    expect(exec.getState().completed_steps).toContain('recovered');
  });
});
