import * as fs from 'fs';
import * as path from 'path';

export interface CounterState {
  value: number;
}

export class Counter {
  private valueInternal: number;
  private readonly filePath: string;

  constructor(filePath: string) {
    this.filePath = filePath;
    this.valueInternal = this.load();
  }

  get value(): number {
    return this.valueInternal;
  }

  private load(): number {
    try {
      if (!fs.existsSync(this.filePath)) {
        return 0;
      }

      const content = fs.readFileSync(this.filePath, 'utf-8');
      const state = JSON.parse(content) as CounterState;
      
      if (typeof state.value !== 'number' || isNaN(state.value)) {
        return 0;
      }
      
      return state.value;
    } catch (error) {
      // File corrupted or unreadable, start fresh
      return 0;
    }
  }

  private save(): void {
    try {
      const dir = path.dirname(this.filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      const state: CounterState = { value: this.valueInternal };
      const content = JSON.stringify(state, null, 2);
      
      // Atomic write: temp file + rename
      const tmpFile = `${this.filePath}.tmp`;
      fs.writeFileSync(tmpFile, content, 'utf-8');
      fs.renameSync(tmpFile, this.filePath);
    } catch (error) {
      throw new Error(`Failed to save counter: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  increment(amount: number = 1): void {
    this.valueInternal += amount;
    this.save();
  }

  decrement(amount: number = 1): void {
    const newValue = this.valueInternal - amount;
    if (newValue < 0) {
      throw new Error('Counter cannot be negative');
    }
    this.valueInternal = newValue;
    this.save();
  }

  reset(): void {
    this.valueInternal = 0;
    this.save();
  }
}
