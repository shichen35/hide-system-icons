import { SettingsReader } from "../../panelBinding.js";

export class FakeSettingsReader implements SettingsReader {
  private readonly values: Record<string, boolean>;

  constructor(initial: Record<string, boolean> = {}) {
    this.values = { ...initial };
  }

  set(key: string, value: boolean): void {
    this.values[key] = value;
  }

  get_boolean(key: string): boolean {
    return this.values[key] ?? false;
  }
}
