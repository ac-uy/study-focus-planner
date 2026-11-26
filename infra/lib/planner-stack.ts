import * as path from 'path';
import { CfnOutput, Duration, RemovalPolicy, Stack, StackProps } from 'aws-cdk-lib';
import * as apigwv2 from 'aws-cdk-lib/aws-apigatewayv2';
import * as budgets from 'aws-cdk-lib/aws-budgets';
import * as ce from 'aws-cdk-lib/aws-ce';
import { HttpJwtAuthorizer } from 'aws-cdk-lib/aws-apigatewayv2-authorizers';
import { HttpLambdaIntegration } from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';
import { Construct } from 'constructs';
import { PlannerConfig } from './config';

const BEDROCK_MODEL_ID = 'eu.amazon.nova-lite-v1:0';
const BEDROCK_REVIEW_MODEL_ID = 'eu.amazon.nova-2-lite-v1:0';
const DAILY_AI_LIMIT = '30';

export interface PlannerStackProps extends StackProps {
  config: PlannerConfig;
}

export class PlannerStack extends Stack {
  constructor(scope: Construct, id: string, props: PlannerStackProps) {
    super(scope, id, props);
    const { config } = props;

    // ---- Static site ----
    const siteBucket = new s3.Bucket(this, 'SiteBucket', {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      removalPolicy: RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    // Serves /next/ as /next/index.html (S3 only does this for the site root).
    const indexRewrite = new cloudfront.Function(this, 'IndexRewrite', {
      runtime: cloudfront.FunctionRuntime.JS_2_0,
      code: cloudfront.FunctionCode.fromInline(`function handler(event) {
  var r = event.request;
  if (r.uri === '/next') {
    return { statusCode: 302, statusDescription: 'Found', headers: { location: { value: '/next/' } } };
  }
  if (r.uri.charAt(r.uri.length - 1) === '/') { r.uri += 'index.html'; }
  return r;
}`),
    });

    const distribution = new cloudfront.Distribution(this, 'Distribution', {
      defaultRootObject: 'index.html',
      priceClass: cloudfront.PriceClass.PRICE_CLASS_100,
      minimumProtocolVersion: cloudfront.SecurityPolicyProtocol.TLS_V1_2_2021,
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(siteBucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        responseHeadersPolicy: cloudfront.ResponseHeadersPolicy.SECURITY_HEADERS,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
        functionAssociations: [{ function: indexRewrite, eventType: cloudfront.FunctionEventType.VIEWER_REQUEST }],
      },
    });
    const siteUrl = `https://${distribution.distributionDomainName}/`;

    // ---- Auth (single user, no self sign-up) ----
    const userPool = new cognito.UserPool(this, 'UserPool', {
      selfSignUpEnabled: false,
      signInAliases: { email: true },
      autoVerify: { email: true },
      standardAttributes: { email: { required: true, mutable: false } },
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      passwordPolicy: { minLength: 10, requireLowercase: true, requireUppercase: true, requireDigits: true, requireSymbols: false },
      removalPolicy: RemovalPolicy.RETAIN,
    });

    // The logical ids 'StudentUser' and 'OwnerUser' must not change: renaming one would delete and recreate that user.
    if (config.childEmail) {
      const studentUser = new cognito.CfnUserPoolUser(this, 'StudentUser', {
        userPoolId: userPool.userPoolId,
        username: config.childEmail,
        desiredDeliveryMediums: ['EMAIL'],
        userAttributes: [
          { name: 'email', value: config.childEmail },
          { name: 'email_verified', value: 'true' },
        ],
      });
      studentUser.applyRemovalPolicy(RemovalPolicy.RETAIN); // so that removing it from this file later never deletes the account
    }

    const ownerUser = new cognito.CfnUserPoolUser(this, 'OwnerUser', {
      userPoolId: userPool.userPoolId,
      username: config.ownerEmail,
      desiredDeliveryMediums: ['EMAIL'],
      userAttributes: [
        { name: 'email', value: config.ownerEmail },
        { name: 'email_verified', value: 'true' },
      ],
    });
    ownerUser.applyRemovalPolicy(RemovalPolicy.RETAIN);

    const userPoolClient = userPool.addClient('WebClient', {
      generateSecret: false,
      preventUserExistenceErrors: true,
      authFlows: {},
      oAuth: {
        flows: { authorizationCodeGrant: true },
        scopes: [cognito.OAuthScope.OPENID, cognito.OAuthScope.EMAIL],
        callbackUrls: [siteUrl, `${siteUrl}next/`],
        logoutUrls: [siteUrl, `${siteUrl}next/`],
      },
      supportedIdentityProviders: [cognito.UserPoolClientIdentityProvider.COGNITO],
      idTokenValidity: Duration.hours(1),
      accessTokenValidity: Duration.hours(1),
      refreshTokenValidity: Duration.days(30),
    });

    const domain = userPool.addDomain('Domain', {
      cognitoDomain: { domainPrefix: `study-planner-${this.account}` },
    });

    // ---- Data ----
    const table = new dynamodb.Table(this, 'Table', {
      partitionKey: { name: 'pk', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'sk', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      timeToLiveAttribute: 'expiresAt',
      pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: true },
      removalPolicy: RemovalPolicy.RETAIN,
    });

    // ---- API ----
    const apiFn = new lambda.Function(this, 'ApiFn', {
      runtime: lambda.Runtime.NODEJS_22_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '..', '..', 'lambda', 'api')),
      memorySize: 512,
      timeout: Duration.seconds(30),
      logRetention: logs.RetentionDays.ONE_MONTH,
      environment: { USER_POOL_ID: userPool.userPoolId, TABLE_NAME: table.tableName, MODEL_ID: BEDROCK_MODEL_ID, REVIEW_MODEL_ID: BEDROCK_REVIEW_MODEL_ID, DAILY_AI_LIMIT, DAILY_REVIEW_LIMIT: '30', DAILY_EXAM_LIMIT: '30' },
    });
    table.grantReadWriteData(apiFn);
    apiFn.addToRolePolicy(new iam.PolicyStatement({
      actions: ['bedrock:InvokeModel'],
      resources: [
        `arn:aws:bedrock:${this.region}:${this.account}:inference-profile/${BEDROCK_MODEL_ID}`,
        `arn:aws:bedrock:${this.region}:${this.account}:inference-profile/${BEDROCK_REVIEW_MODEL_ID}`,
        'arn:aws:bedrock:*::foundation-model/amazon.nova-lite-v1:0',
        'arn:aws:bedrock:*::foundation-model/amazon.nova-2-lite-v1:0',
      ],
    }));

    // Parents create child accounts from the app: the Lambda may create users in this pool, and nothing else in Cognito.
    apiFn.addToRolePolicy(new iam.PolicyStatement({ actions: ['cognito-idp:AdminCreateUser'], resources: [userPool.userPoolArn] }));

    // The YouTube API key is stored by hand as a SecureString (never in code or in the template).
    apiFn.addToRolePolicy(new iam.PolicyStatement({
      actions: ['ssm:GetParameter'],
      resources: [`arn:aws:ssm:${this.region}:${this.account}:parameter/study-planner/youtube-api-key`],
    }));

    const httpApi = new apigwv2.HttpApi(this, 'HttpApi', {
      corsPreflight: {
        allowOrigins: [siteUrl.replace(/\/$/, '')],
        allowMethods: [apigwv2.CorsHttpMethod.GET, apigwv2.CorsHttpMethod.PUT, apigwv2.CorsHttpMethod.POST],
        allowHeaders: ['authorization', 'content-type'],
        maxAge: Duration.hours(1),
      },
    });
    const authorizer = new HttpJwtAuthorizer('JwtAuthorizer', `https://cognito-idp.${this.region}.amazonaws.com/${userPool.userPoolId}`, {
      jwtAudience: [userPoolClient.userPoolClientId],
    });
    const integration = new HttpLambdaIntegration('ApiIntegration', apiFn);
    httpApi.addRoutes({ path: '/api/data', methods: [apigwv2.HttpMethod.GET, apigwv2.HttpMethod.PUT], integration, authorizer });
    httpApi.addRoutes({ path: '/api/ai/steps', methods: [apigwv2.HttpMethod.POST], integration, authorizer });
    httpApi.addRoutes({ path: '/api/ai/chat', methods: [apigwv2.HttpMethod.POST], integration, authorizer });
    httpApi.addRoutes({ path: '/api/ai/review', methods: [apigwv2.HttpMethod.POST], integration, authorizer });
    httpApi.addRoutes({ path: '/api/ai/exam', methods: [apigwv2.HttpMethod.POST], integration, authorizer });
    httpApi.addRoutes({ path: '/api/ai/cards', methods: [apigwv2.HttpMethod.POST], integration, authorizer });
    httpApi.addRoutes({ path: '/api/music/search', methods: [apigwv2.HttpMethod.POST], integration, authorizer });
    httpApi.addRoutes({ path: '/api/music/check', methods: [apigwv2.HttpMethod.POST], integration, authorizer });
    httpApi.addRoutes({ path: '/api/me', methods: [apigwv2.HttpMethod.GET], integration, authorizer });
    httpApi.addRoutes({ path: '/api/parent/children', methods: [apigwv2.HttpMethod.GET, apigwv2.HttpMethod.POST], integration, authorizer });
    httpApi.addRoutes({ path: '/api/parent/adults', methods: [apigwv2.HttpMethod.GET, apigwv2.HttpMethod.POST], integration, authorizer });
httpApi.addRoutes({ path: '/api/parent/children/{childSub}/data', methods: [apigwv2.HttpMethod.GET], integration, authorizer });
    httpApi.addRoutes({ path: '/api/v2', methods: [apigwv2.HttpMethod.GET], integration, authorizer });
    httpApi.addRoutes({ path: '/api/v2/{section}', methods: [apigwv2.HttpMethod.PUT], integration, authorizer });

    const stage = httpApi.defaultStage?.node.defaultChild as apigwv2.CfnStage;
    stage.defaultRouteSettings = { throttlingBurstLimit: 10, throttlingRateLimit: 5 };

    // ---- Deploy site + runtime config ----
    // The new version of the app lives under /next/ (built from web-next/ into web-next/dist/).
    new s3deploy.BucketDeployment(this, 'DeployNext', {
      destinationBucket: siteBucket,
      destinationKeyPrefix: 'next',
      distribution,
      distributionPaths: ['/next/*'],
      cacheControl: [s3deploy.CacheControl.fromString('no-cache')],
      sources: [
        s3deploy.Source.asset(path.join(__dirname, '..', '..', 'web-next', 'dist')),
        s3deploy.Source.jsonData('config.json', {
          region: this.region,
          clientId: userPoolClient.userPoolClientId,
          cognitoDomain: `https://${domain.domainName}.auth.${this.region}.amazoncognito.com`,
          apiUrl: httpApi.apiEndpoint,
          redirectUri: `${siteUrl}next/`,
        }),
      ],
    });

    new s3deploy.BucketDeployment(this, 'DeploySite', {
      destinationBucket: siteBucket,
      exclude: ['next/*'],
      distribution,
      distributionPaths: ['/*'],
      sources: [
        s3deploy.Source.asset(path.join(__dirname, '..', '..', 'web')),
        s3deploy.Source.jsonData('config.json', {
          region: this.region,
          clientId: userPoolClient.userPoolClientId,
          cognitoDomain: `https://${domain.domainName}.auth.${this.region}.amazoncognito.com`,
          apiUrl: httpApi.apiEndpoint,
          redirectUri: siteUrl,
        }),
      ],
    });

    // ---- Cost reminders (email only, no automatic action) ----
    const subscribers = [{ subscriptionType: 'EMAIL', address: config.ownerEmail }];
    const alert = (type: 'ACTUAL' | 'FORECASTED', threshold: number) => ({
      notification: {
        notificationType: type,
        comparisonOperator: 'GREATER_THAN',
        threshold,
        thresholdType: 'PERCENTAGE',
      },
      subscribers,
    });
    new budgets.CfnBudget(this, 'MonthlyBudget', {
      budget: {
        budgetName: 'account-monthly-5usd',
        budgetType: 'COST',
        timeUnit: 'MONTHLY',
        budgetLimit: { amount: config.monthlyBudgetUsd, unit: 'USD' },
      },
      notificationsWithSubscribers: [
        alert('ACTUAL', 50),
        alert('ACTUAL', 80),
        alert('ACTUAL', 100),
        alert('FORECASTED', 100),
      ],
    });

    const anomalyMonitor = new ce.CfnAnomalyMonitor(this, 'AnomalyMonitor', {
      monitorName: 'account-services',
      monitorType: 'DIMENSIONAL',
      monitorDimension: 'SERVICE',
    });
    new ce.CfnAnomalySubscription(this, 'AnomalySubscription', {
      subscriptionName: 'account-anomalies-daily',
      frequency: 'DAILY',
      monitorArnList: [anomalyMonitor.attrMonitorArn],
      subscribers: [{ type: 'EMAIL', address: config.ownerEmail }],
      thresholdExpression: JSON.stringify({
        Dimensions: { Key: 'ANOMALY_TOTAL_IMPACT_ABSOLUTE', MatchOptions: ['GREATER_THAN_OR_EQUAL'], Values: ['2'] },
      }),
    });

    new CfnOutput(this, 'SiteUrl', { value: siteUrl });
    new CfnOutput(this, 'ApiUrl', { value: httpApi.apiEndpoint });
    new CfnOutput(this, 'UserPoolId', { value: userPool.userPoolId });
  }
}
