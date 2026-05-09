import { SCREENING_PRESETS } from "../config/defaults";
import type { RuleGroup } from "@shared/types";

export class PresetManager {
  private presets: Record<string, any>;

  constructor() {
    this.presets = { ...SCREENING_PRESETS };
  }

  list(): { key: string; name: string; description: string }[] {
    return Object.entries(this.presets).map(([key, p]) => ({
      key,
      name: p.name,
      description: p.description,
    }));
  }

  get(key: string): RuleGroup | null {
    return this.presets[key]?.rules || null;
  }

  getFull(key: string): any | null {
    return this.presets[key] || null;
  }
}

export const presetManager = new PresetManager();
