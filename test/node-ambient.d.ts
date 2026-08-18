declare module "node:test" {
  type TestFn = () => void | Promise<void>;

  export function describe(name: string, fn: () => void): void;
  export function test(name: string, fn: TestFn): void;
  export { test as it };
}

declare module "node:assert/strict" {
  interface Assert {
    (value: unknown, message?: string | Error): asserts value;
    equal(actual: unknown, expected: unknown, message?: string | Error): void;
    notEqual(actual: unknown, expected: unknown, message?: string | Error): void;
    deepEqual(actual: unknown, expected: unknown, message?: string | Error): void;
    ok(value: unknown, message?: string | Error): asserts value;
    throws(fn: () => unknown, message?: string | Error): void;
    doesNotThrow(fn: () => unknown, message?: string | Error): void;
    fail(message?: string | Error): never;
  }

  const assert: Assert;
  export default assert;
}
