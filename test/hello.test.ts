import { printHello } from '../src/hello';

describe('printHello', () => {
  it('returns the literal "Hello World" with a trailing newline', () => {
    expect(printHello()).toBe('Hello World\n');
  });

  it('returns a string (not undefined, not throwing)', () => {
    expect(typeof printHello()).toBe('string');
  });
});
