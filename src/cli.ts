#!/usr/bin/env node

import { Command } from 'commander';
import * as fs from 'fs';
import * as path from 'path';
import chalk from 'chalk';
import { PipelineExecutor } from './pipeline';

const program = new Command();

program
  .name('agent-pipeline')
  .description('Sequential agent pipeline: spec → plan → build → test → review → simplify → ship')
  .version('0.1.0');

program
  .option('--spec <file>', 'Path to spec file (required)')
  .option('--pipeline <file>', 'Path to pipeline config', 'config/pipeline.yaml')
  .option('--cwd <dir>', 'Working directory', process.cwd())
  .action(async (options) => {
    try {
      // Validate spec file
      if (!options.spec) {
        console.error(chalk.red('Error: --spec argument is required'));
        process.exit(1);
      }

      const specPath = path.resolve(options.cwd, options.spec);
      if (!fs.existsSync(specPath)) {
        console.error(chalk.red(`Error: Spec file not found: ${specPath}`));
        process.exit(1);
      }

      // Validate pipeline file
      const pipelinePath = path.resolve(options.cwd, options.pipeline);
      if (!fs.existsSync(pipelinePath)) {
        console.error(chalk.red(`Error: Pipeline config not found: ${pipelinePath}`));
        process.exit(1);
      }

      console.log(chalk.blue('╔════════════════════════════════════════╗'));
      console.log(chalk.blue('║      Agent Pipeline Runner v0.1.0      ║'));
      console.log(chalk.blue('╚════════════════════════════════════════╝'));
      console.log('');
      console.log(chalk.gray(`Spec file: ${specPath}`));
      console.log(chalk.gray(`Pipeline: ${pipelinePath}`));
      console.log(chalk.gray(`Working dir: ${options.cwd}`));
      console.log('');

      // Create executor and run pipeline
      const executor = new PipelineExecutor(
        pipelinePath,
        specPath,
        options.cwd
      );

      await executor.run();

      const state = executor.getState();
      const logPath = executor.getLogPath();

      console.log('');
      console.log(chalk.green('╔════════════════════════════════════════╗'));
      console.log(chalk.green('║         Pipeline Completed              ║'));
      console.log(chalk.green('╚════════════════════════════════════════╝'));
      console.log('');
      console.log(chalk.gray(`Steps completed: ${state.completed_steps.length}`));
      console.log(chalk.gray(`Log file: ${logPath}`));
      console.log('');

    } catch (error) {
      console.error('');
      console.error(chalk.red('╔════════════════════════════════════════╗'));
      console.error(chalk.red('║          Pipeline Failed               ║'));
      console.error(chalk.red('╚════════════════════════════════════════╝'));
      console.error('');
      console.error(chalk.red(`Error: ${error}`));
      console.error('');
      process.exit(1);
    }
  });

program.parse();
