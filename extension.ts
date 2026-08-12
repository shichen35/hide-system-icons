import { Extension } from "resource:///org/gnome/shell/extensions/extension.js";
import { GnomeShellPort } from "./gnomeShellPort.js";
import { HidePolicy } from "./hidePolicy.js";

export default class HideSystemIcons extends Extension {
  private policy: HidePolicy | null = null;

  enable(): void {
    this.policy = new HidePolicy(new GnomeShellPort(this.getSettings()));
    this.policy.start();
  }

  disable(): void {
    this.policy?.stop();
    this.policy = null;
  }
}
