# Agent Pipeline

Sequential agent pipeline CLI tool. Run specs through 7-step agent pipeline: **spec → plan → build → test → review → simplify → ship**.

## Features

- **Phase 1**: Agent steps only (Hermes Agent integration)
- **YAML-based pipeline configuration**
- **Shared state** between steps via `{{placeholder}}` syntax
- **Automatic cycle detection** with `max_visits` guard
- **Comprehensive logging** to `logs/` directory
- **Error handling** with `next_fail` routing (phase 2)

## Installation

```bash
cd /Users/hung/code/ai/agent-pipeline
npm install
npm run build
```

## Usage

```bash
# Run with sample spec
node dist/cli.js --spec examples/sample_spec.md

# Run with custom pipeline config
node dist/cli.js --spec path/to/spec.md --pipeline config/pipeline.yaml

# Run with custom working directory
node dist/cli.js --spec path/to/spec.md --cwd /path/to/project
```

## Pipeline Steps (Default Configuration)

1. **spec** - Analyze requirements from spec file
2. **plan** - Create implementation plan
3. **build** - Execute build steps (agent-driven)
4. **test** - Run tests
5. **review** - Review changes
6. **simplify** - Simplify code
7. **ship** - Ship final artifact

## Pipeline Configuration

Edit `config/pipeline.yaml` to customize steps:

```yaml
entry: spec

steps:
  spec:
    type: agent
    prompt: |
      Analyze requirements: {{spec_file}}
      Extract features and constraints.
    next: plan

  plan:
    type: agent
    prompt: |
      Create plan based on: {{spec_output}}
    next: build
  
  # ... more steps
```

### Step Types

- **`type: agent`** - Execute prompt via `hermes chat -q`
- **`type: shell`** - Execute shell commands (phase 2, not implemented)

### Placeholders

Use `{{step_name_output}}` to reference outputs from previous steps:
- `{{spec_file}}` - Path to spec file (injected automatically)
- `{{spec_output}}` - Output from `spec` step
- `{{plan_output}}` - Output from `plan` step
- etc.

### Cycle Detection

Prevent infinite loops with `max_visits`:

```yaml
  fix:
    type: agent
    prompt: "Fix failures: {{test_output}}"
    next: test
    max_visits: 3
```

When `max_visits` is exceeded, the step auto-succeeds and advances to `next`.

## Example Workflow

```bash
# 1. Create your spec file
cat > my-spec.md <<EOF
# Build a todo app
- Add items
- Mark complete
- Delete items
- Persist to JSON
EOF

# 2. Run pipeline
node dist/cli.js --spec my-spec.md

# 3. Check logs
tail -f logs/pipeline-*.log
```

## Architecture

```
src/
├── cli.ts          # CLI entry point (Commander.js)
├── pipeline.ts     # Pipeline executor logic
├── hermes.ts       # Hermes Agent integration (child_process)
├── types.ts        # TypeScript interfaces
└── index.ts        # (optional, for library usage)
```

## Development

```bash
# Watch mode
npm run dev -- --spec examples/sample_spec.md

# Build only
npm run build

# Run tests (when implemented)
npm test
```

## Requirements

- **Node.js** >= 20
- **Hermes Agent** installed and available in `PATH`
- **TypeScript** >= 5.0

## Roadmap

- **Phase 1** ✅ - Agent steps only
- **Phase 2** - Shell steps with `next_fail` routing
- **Phase 3** - Interview steps for user interaction
- **Phase 4** - State persistence and resume capability
- **Phase 5** - Parallel step execution

## License

MIT
