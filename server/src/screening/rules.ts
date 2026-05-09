import type { KlineData, RuleCondition, RuleGroup } from "@shared/types";
export type { RuleCondition, RuleGroup };
import { getIndicator } from "../indicators";

function isRuleGroup(c: RuleCondition | RuleGroup): c is RuleGroup {
  return "logic" in c && "conditions" in c;
}

export function evaluate(data: KlineData[], rule: RuleCondition | RuleGroup): boolean {
  if (isRuleGroup(rule)) {
    if (rule.logic === "AND") {
      return rule.conditions.every((c) => evaluate(data, c));
    } else {
      return rule.conditions.some((c) => evaluate(data, c));
    }
  }

  // Single condition
  const { indicator: indName, operator, value, params } = rule;
  const indicator = getIndicator(indName, params);
  if (!indicator) return false;

  const result = indicator.compute(data);
  const lastIdx = data.length - 1;
  if (lastIdx < 0) return false;

  // Get the indicator value at the last data point
  const colIdx = 0; // default to first column
  const val = result.values[colIdx]?.[lastIdx];
  if (val === undefined || isNaN(val)) return false;

  switch (operator) {
    case ">": return val > value;
    case "<": return val < value;
    case ">=": return val >= value;
    case "<=": return val <= value;
    case "==": return Math.abs(val - value) < 0.01;
    case "cross_above": {
      // Check if crossed above threshold in last 3 days
      for (let i = Math.max(1, lastIdx - 2); i <= lastIdx; i++) {
        const v = result.values[colIdx]?.[i];
        const vPrev = result.values[colIdx]?.[i - 1];
        if (v !== undefined && vPrev !== undefined && !isNaN(v) && !isNaN(vPrev)) {
          if (v > value && vPrev <= value) return true;
        }
      }
      return false;
    }
    case "cross_below": {
      for (let i = Math.max(1, lastIdx - 2); i <= lastIdx; i++) {
        const v = result.values[colIdx]?.[i];
        const vPrev = result.values[colIdx]?.[i - 1];
        if (v !== undefined && vPrev !== undefined && !isNaN(v) && !isNaN(vPrev)) {
          if (v < value && vPrev >= value) return true;
        }
      }
      return false;
    }
    default: return false;
  }
}

export function validateRules(rules: RuleGroup): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  function check(c: RuleCondition | RuleGroup) {
    if (isRuleGroup(c)) {
      if (c.conditions.length === 0) errors.push("规则组为空");
      c.conditions.forEach(check);
    } else {
      const ind = getIndicator(c.indicator);
      if (!ind) errors.push(`未知指标: ${c.indicator}`);
    }
  }
  check(rules);
  return { valid: errors.length === 0, errors };
}
