import { QuickSettingsPanel } from "../../hiddenIndicator.js";

export type MutablePanel = Record<string, unknown>;

export function makePanel(fields: MutablePanel = {}): MutablePanel & QuickSettingsPanel {
  return fields as unknown as MutablePanel & QuickSettingsPanel;
}
