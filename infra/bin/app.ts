#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { loadConfig } from '../lib/config';
import { PlannerStack } from '../lib/planner-stack';

const config = loadConfig();
const app = new cdk.App();
new PlannerStack(app, 'StudyPlannerStack', {
  env: { account: config.account, region: config.region },
  config,
});
