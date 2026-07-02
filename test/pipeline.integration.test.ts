import { PipelineExecutor } from '../src/pipeline';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

/**
 * Integration test: run multi-step pipelines end-to-end through PipelineExecutor.
 * Verifies:
 *  - shell type runs shell commands
 *  - next/next_fail transitions work
 *  - /tmp/evidence/.env from one shell step is injected as env vars into the next
 *
 * Agent steps are exercised by the real Phase 2 smoke run (not here) — running a
 * real Hermes invocation in CI is slow and non-deterministic. Stubbed-agent
 * coverage lives in src/hermes.test.ts (if/when added).
 */
describe('PipelineExecutor — multi-step orchestration', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pipeline-int-'));
    fs.writeFileSync(path.join(tmpDir, 'spec.md'), '# Test spec\nAdd two numbers.');
    fs.writeFileSync(
      path.join(tmpDir, 'package.json'),
      JSON.stringify({ name: 'x', version: '0.0.0' })
    );
  });

  afterEach(() => fs.rmSync(tmpDir, { recursive: true, force: true }));

  it('executes shell → shell → done in order', async () => {
    fs.writeFileSync(
      path.join(tmpDir, 'pipeline.yaml'),
      [
        'entry: spec',
        'steps:',
        '  spec:',
        '    type: shell',
        '    commands:',
        '      - "echo first"',
        '    next: echo_step',
        '  echo_step:',
        '    type: shell',
        '    commands:',
        '      - "echo hello"',
        '    next: done',
        '',
      ].join('\n')
    );

    const exec = new PipelineExecutor(
      path.join(tmpDir, 'pipeline.yaml'),
      path.join(tmpDir, 'spec.md'),
      tmpDir
    );
    await exec.run();
    const state = exec.getState();
    expect(state.completed_steps).toEqual(['spec', 'echo_step']);
    expect(state.step_outputs.echo_step_output).toContain('hello');
  });

  it('follows next_fail path when a shell step exits non-zero', async () => {
    fs.writeFileSync(
      path.join(tmpDir, 'pipeline.yaml'),
      [
        'entry: bad',
        'steps:',
        '  bad:',
        '    type: shell',
        '    commands:',
        '      - "exit 1"',
        '    next_fail: recovered',
        '  recovered:',
        '    type: shell',
        '    commands:',
        '      - "echo recovered"',
        '    next: done',
        '',
      ].join('\n')
    );

    const exec = new PipelineExecutor(
      path.join(tmpDir, 'pipeline.yaml'),
      path.join(tmpDir, 'spec.md'),
      tmpDir
    );
    await exec.run();
    expect(exec.getState().completed_steps).toContain('recovered');
  });

  it('exposes env vars from /tmp/evidence/.env to a downstream shell step', async () => {
    // set_v writes KEY=VALUE into /tmp/evidence/.env (the convention that
    // loadShellEnv() reads from). read_v echoes it back so we can assert the
    // env was injected.
    fs.writeFileSync(
      path.join(tmpDir, 'pipeline.yaml'),
      [
        'entry: set_v',
        'steps:',
        '  set_v:',
        '    type: shell',
        '    commands:',
        '      - "mkdir -p /tmp/evidence && printf \'GREETING=hello-world\\n\' > /tmp/evidence/.env"',
        '    next: read_v',
        '  read_v:',
        '    type: shell',
        '    commands:',
        '      - "echo got=$GREETING"',
        '    next: done',
        '',
      ].join('\n')
    );

    // Snapshot /tmp/evidence/.env so we can restore it.
    const envFile = '/tmp/evidence/.env';
    const envExisted = fs.existsSync(envFile);
    let saved: string | null = null;
    if (envExisted) {
      saved = fs.readFileSync(envFile, 'utf8');
    }

    try {
      const exec = new PipelineExecutor(
        path.join(tmpDir, 'pipeline.yaml'),
        path.join(tmpDir, 'spec.md'),
        tmpDir
      );
      await exec.run();
      const state = exec.getState();
      expect(state.completed_steps).toEqual(['set_v', 'read_v']);
      expect(state.step_outputs.read_v_output).toContain('got=hello-world');
    } finally {
      // Clean up our test artifact so it doesn't leak into other tests.
      if (fs.existsSync(envFile)) {
        fs.unlinkSync(envFile);
      }
      if (saved !== null) {
        fs.writeFileSync(envFile, saved);
      }
    }
  });
});
