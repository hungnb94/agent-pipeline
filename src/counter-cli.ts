#!/usr/bin/env node
import { Counter } from './counter';
import * as os from 'os';
import * as path from 'path';

const DEFAULT_COUNTER_PATH = path.join(os.homedir(), '.counter', 'counter.json');

function printUsage(): void {
  console.log('Usage: counter <command> [value]');
  console.log('');
  console.log('Commands:');
  console.log('  inc [n]     Increment counter by n (default: 1)');
  console.log('  dec [n]     Decrement counter by n (default: 1)');
  console.log('  reset       Reset counter to 0');
  console.log('  get         Display current counter value');
  console.log('  help        Show this help message');
  console.log('');
  console.log('Examples:');
  console.log('  counter inc         # Increment by 1');
  console.log('  counter inc 5       # Increment by 5');
  console.log('  counter dec         # Decrement by 1');
  console.log('  counter reset       # Reset to 0');
  console.log('  counter get         # Show current value');
}

function printError(message: string): void {
  console.error(message);
}

function main(): void {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    printUsage();
    process.exit(1);
  }

  const command = args[0];
  const value = args[1] ? parseInt(args[1], 10) : undefined;
  const counterPath = process.env.COUNTER_PATH || DEFAULT_COUNTER_PATH;

  try {
    const counter = new Counter(counterPath);

    switch (command) {
      case 'inc':
      case 'increment':
        if (isNaN(value!)) {
          counter.increment(1);
        } else {
          counter.increment(value!);
        }
        console.log(`Counter: ${counter.value}`);
        break;

      case 'dec':
      case 'decrement':
        if (isNaN(value!)) {
          counter.decrement(1);
        } else {
          counter.decrement(value!);
        }
        console.log(`Counter: ${counter.value}`);
        break;

      case 'reset':
        counter.reset();
        console.log(`Counter: ${counter.value}`);
        break;

      case 'get':
        console.log(`${counter.value}`);
        break;

      case 'help':
      case '--help':
      case '-h':
        printUsage();
        break;

      default:
        printError(`Unknown command: ${command}`);
        printUsage();
        process.exit(1);
    }
  } catch (error) {
    printError(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    process.exit(1);
  }
}

main();
