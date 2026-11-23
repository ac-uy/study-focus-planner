import * as fs from 'fs';
import * as path from 'path';

/**
 * Deployment values that must never be committed: AWS account, emails, budget.
 * They live in infra/config.local.json, which git ignores. infra/config.example.json shows the shape.
 */
export interface PlannerConfig {
  /** 12-digit AWS account id the stack is deployed to. */
  account: string;
  region: string;
  /** Gets an account and receives the cost alerts. */
  ownerEmail: string;
  /** Optional second account created with the stack (a student). Leave out to create none. */
  childEmail?: string;
  monthlyBudgetUsd: number;
}

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export function loadConfig(): PlannerConfig {
  const file = path.join(__dirname, '..', 'config.local.json');
  if (!fs.existsSync(file)) {
    throw new Error('infra/config.local.json is missing. Copy infra/config.example.json to infra/config.local.json and fill in your own values.');
  }
  let c: Partial<PlannerConfig>;
  try {
    c = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) {
    throw new Error('infra/config.local.json is not valid JSON.');
  }
  const problems: string[] = [];
  if (!c.account || !/^\d{12}$/.test(c.account)) problems.push('account must be a 12-digit AWS account id');
  if (!c.region || !/^[a-z]{2}-[a-z]+-\d$/.test(c.region)) problems.push('region must look like eu-west-1');
  if (!c.ownerEmail || !EMAIL.test(c.ownerEmail)) problems.push('ownerEmail must be an email address');
  if (c.childEmail !== undefined && !EMAIL.test(c.childEmail)) problems.push('childEmail must be an email address (or left out)');
  if (typeof c.monthlyBudgetUsd !== 'number' || !(c.monthlyBudgetUsd > 0)) problems.push('monthlyBudgetUsd must be a number above 0');
  if (problems.length) throw new Error('infra/config.local.json: ' + problems.join('; ') + '.');
  return c as PlannerConfig;
}
