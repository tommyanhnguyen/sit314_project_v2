const ref = name => ({ Ref: name });
const arn = name => ({ 'Fn::GetAtt': [name, 'Arn'] });
const sub = value => ({ 'Fn::Sub': value });

const workers = {
  Inventory: { service: 'inventory', event: 'stock.delta' },
  Replenishment: { service: 'replenishment', event: 'stock.updated' },
  Coldchain: { service: 'cold-chain', event: 'coldchain.alert' },
  Delivery: { service: 'delivery', event: 'order.approved' }
};

function role(policyStatements, execution = false) {
  return {
    Type: 'AWS::IAM::Role',
    Properties: {
      AssumeRolePolicyDocument: { Version: '2012-10-17', Statement: [{ Effect: 'Allow',
        Principal: { Service: 'ecs-tasks.amazonaws.com' }, Action: 'sts:AssumeRole' }] },
      ...(execution ? { ManagedPolicyArns: [
        'arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy'
      ] } : {}),
      Policies: [{ PolicyName: 'ShelfSenseAccess', PolicyDocument: {
        Version: '2012-10-17', Statement: policyStatements
      } }]
    }
  };
}

function taskDefinition(name, command, environment, secrets, taskRole, logGroup) {
  return {
    Type: 'AWS::ECS::TaskDefinition',
    Properties: {
      Family: sub('${AWS::StackName}-' + name.toLowerCase()),
      RequiresCompatibilities: ['FARGATE'], NetworkMode: 'awsvpc', Cpu: '256', Memory: '512',
      ExecutionRoleArn: arn('ExecutionRole'), TaskRoleArn: arn(taskRole),
      ContainerDefinitions: [{ Name: name.toLowerCase(), Image: ref('ImageUri'), Essential: true,
        Command: command,
        Environment: Object.entries(environment).map(([Name, Value]) => ({ Name, Value })),
        Secrets: Object.entries(secrets).map(([Name, ValueFrom]) => ({ Name, ValueFrom })),
        LogConfiguration: { LogDriver: 'awslogs', Options: {
          'awslogs-group': ref(logGroup), 'awslogs-region': ref('AWS::Region'),
          'awslogs-stream-prefix': name.toLowerCase()
        } }
      }]
    }
  };
}

function service(name, task, options = {}) {
  return { Type: 'AWS::ECS::Service', DependsOn: options.dependsOn || [], Properties: {
    ServiceName: sub('${AWS::StackName}-' + name.toLowerCase()),
    Cluster: ref('EcsCluster'), TaskDefinition: ref(task), DesiredCount: 1,
    LaunchType: 'FARGATE',
    NetworkConfiguration: { AwsvpcConfiguration: {
      AssignPublicIp: 'DISABLED',
      Subnets: [ref('PrivateSubnetA'), ref('PrivateSubnetB')],
      SecurityGroups: [ref('TaskSecurityGroup')]
    } },
    ...(options.loadBalancers ? { LoadBalancers: options.loadBalancers } : {})
  } };
}

function buildTemplate() {
  const resources = {};
  const parameters = {
    ImageUri: { Type: 'String', Description: 'Immutable ECR image URI with digest or release tag' },
    VpcId: { Type: 'AWS::EC2::VPC::Id' },
    PublicSubnetA: { Type: 'AWS::EC2::Subnet::Id' },
    PublicSubnetB: { Type: 'AWS::EC2::Subnet::Id' },
    PrivateSubnetA: { Type: 'AWS::EC2::Subnet::Id' },
    PrivateSubnetB: { Type: 'AWS::EC2::Subnet::Id' },
    ApiCertificateArn: { Type: 'String', Description: 'ACM certificate ARN for the public API' },
    ApiDomainName: { Type: 'String', Description: 'DNS name covered by the ACM certificate' },
    HostedZoneId: { Type: 'AWS::Route53::HostedZone::Id' },
    MongoSecretArn: { Type: 'String', Description: 'Secrets Manager ARN containing the Atlas URI' },
    SigningSecretArn: { Type: 'String', Description: 'Secrets Manager ARN containing event HMAC key' },
    ApiAuthSecretArn: { Type: 'String', Description: 'Secrets Manager ARN containing API token key' },
    InventoryMaxTasks: { Type: 'Number', Default: 4, MinValue: 1, MaxValue: 20,
      Description: 'Set to 1 for fixed baseline and 4 for scaling experiment' },
    AllowedIngressCidr: { Type: 'String', Default: '0.0.0.0/0' },
    AlertEmail: { Type: 'String', Default: '', Description: 'Optional email for SNS cold chain alerts' }
  };

  for (const name of Object.keys(workers)) {
    resources[name + 'DeadLetterQueue'] = { Type: 'AWS::SQS::Queue', Properties: {
      MessageRetentionPeriod: 1209600, SqsManagedSseEnabled: true
    } };
    resources[name + 'Queue'] = { Type: 'AWS::SQS::Queue', Properties: {
      VisibilityTimeout: 120, ReceiveMessageWaitTimeSeconds: 10, SqsManagedSseEnabled: true,
      RedrivePolicy: { deadLetterTargetArn: arn(name + 'DeadLetterQueue'), maxReceiveCount: 5 }
    } };
  }
  resources.EventTopic = { Type: 'AWS::SNS::Topic', Properties: {} };
  resources.AlertTopic = { Type: 'AWS::SNS::Topic', Properties: {} };
  resources.AlertEmailSubscription = { Type: 'AWS::SNS::Subscription',
    Condition: 'HasAlertEmail', Properties: { Endpoint: ref('AlertEmail'), Protocol: 'email',
      TopicArn: ref('AlertTopic') } };
  resources.BridgeIotPolicy = { Type: 'AWS::IoT::Policy', Properties: {
    PolicyDocument: { Version: '2012-10-17', Statement: [
      { Effect: 'Allow', Action: 'iot:Connect',
        Resource: sub('arn:${AWS::Partition}:iot:${AWS::Region}:${AWS::AccountId}:client/shelfsense-bridge') },
      { Effect: 'Allow', Action: 'iot:Publish',
        Resource: sub('arn:${AWS::Partition}:iot:${AWS::Region}:${AWS::AccountId}:topic/shelfsense/events/*') }
    ] }
  } };
  for (const [name, eventType] of [['Inventory', 'stock.delta'],
    ['Replenishment', 'stock.updated'], ['Delivery', 'order.approved']]) {
    resources[name + 'Subscription'] = { Type: 'AWS::SNS::Subscription', Properties: {
      Endpoint: arn(name + 'Queue'), Protocol: 'sqs', TopicArn: ref('EventTopic'),
      RawMessageDelivery: true, FilterPolicy: { eventType: [eventType] }
    } };
  }
  resources.EventQueuePolicy = { Type: 'AWS::SQS::QueuePolicy', Properties: {
    Queues: ['Inventory', 'Replenishment', 'Delivery'].map(name => ref(name + 'Queue')),
    PolicyDocument: { Version: '2012-10-17', Statement: [{ Effect: 'Allow',
      Principal: { Service: 'sns.amazonaws.com' }, Action: 'sqs:SendMessage',
      Resource: ['Inventory', 'Replenishment', 'Delivery'].map(name => arn(name + 'Queue')),
      Condition: { ArnEquals: { 'aws:SourceArn': ref('EventTopic') } }
    }] }
  } };
  resources.IotRuleRole = { Type: 'AWS::IAM::Role', Properties: {
    AssumeRolePolicyDocument: { Version: '2012-10-17', Statement: [{ Effect: 'Allow',
      Principal: { Service: 'iot.amazonaws.com' }, Action: 'sts:AssumeRole' }] },
    Policies: [{ PolicyName: 'SendShelfSenseToQueues', PolicyDocument: {
      Version: '2012-10-17', Statement: [{ Effect: 'Allow', Action: 'sqs:SendMessage',
        Resource: [arn('InventoryQueue'), arn('ColdchainQueue')] }]
    } }]
  } };
  for (const [ruleName, eventType, queueName] of [
    ['StockRule', 'stock.delta', 'InventoryQueue'],
    ['ColdchainRule', 'coldchain.alert', 'ColdchainQueue']
  ]) {
    resources[ruleName] = { Type: 'AWS::IoT::TopicRule', Properties: {
      TopicRulePayload: { AwsIotSqlVersion: '2016-03-23', RuleDisabled: false,
        Sql: `SELECT * FROM 'shelfsense/events/${eventType}'`,
        Actions: [{ Sqs: { QueueUrl: ref(queueName), RoleArn: arn('IotRuleRole') } }]
      }
    } };
  }

  resources.EcsCluster = { Type: 'AWS::ECS::Cluster', Properties: {
    ClusterSettings: [{ Name: 'containerInsights', Value: 'enabled' }]
  } };
  resources.ExecutionRole = role([{ Effect: 'Allow', Action: 'secretsmanager:GetSecretValue',
    Resource: [ref('MongoSecretArn'), ref('SigningSecretArn'), ref('ApiAuthSecretArn')] }], true);
  resources.TaskSecurityGroup = { Type: 'AWS::EC2::SecurityGroup', Properties: {
    GroupDescription: 'Private ShelfSense ECS tasks', VpcId: ref('VpcId'),
    SecurityGroupEgress: [{ IpProtocol: '-1', CidrIp: '0.0.0.0/0' }]
  } };
  resources.AlbSecurityGroup = { Type: 'AWS::EC2::SecurityGroup', Properties: {
    GroupDescription: 'Public HTTPS access to ShelfSense', VpcId: ref('VpcId'),
    SecurityGroupIngress: [{ IpProtocol: 'tcp', FromPort: 443, ToPort: 443,
      CidrIp: ref('AllowedIngressCidr') }],
    SecurityGroupEgress: [{ IpProtocol: '-1', CidrIp: '0.0.0.0/0' }]
  } };
  resources.ApiTaskIngress = { Type: 'AWS::EC2::SecurityGroupIngress', Properties: {
    GroupId: ref('TaskSecurityGroup'), IpProtocol: 'tcp', FromPort: 3000, ToPort: 3000,
    SourceSecurityGroupId: ref('AlbSecurityGroup')
  } };

  const commonEnvironment = {
    AWS_REGION: ref('AWS::Region'), SNS_EVENT_TOPIC_ARN: ref('EventTopic'),
    SNS_ALERT_TOPIC_ARN: ref('AlertTopic'), EVENT_SIGNING_REQUIRED: 'true'
  };
  const commonSecrets = { MONGODB_URI: ref('MongoSecretArn'),
    EVENT_SIGNING_SECRET: ref('SigningSecretArn') };
  for (const [name, definition] of Object.entries(workers)) {
    resources[name + 'TaskRole'] = role([
      { Effect: 'Allow', Action: ['sqs:ReceiveMessage', 'sqs:DeleteMessage',
        'sqs:ChangeMessageVisibility', 'sqs:GetQueueAttributes'], Resource: arn(name + 'Queue') },
      { Effect: 'Allow', Action: 'sns:Publish',
        Resource: name === 'Coldchain' ? ref('AlertTopic') : ref('EventTopic') }
    ]);
    resources[name + 'LogGroup'] = { Type: 'AWS::Logs::LogGroup', Properties: {
      RetentionInDays: 7
    } };
    resources[name + 'Task'] = taskDefinition(name, ['node', 'src/cloud/sqs-runner.js'], {
      ...commonEnvironment, SERVICE_NAME: definition.service,
      ['SQS_' + name.toUpperCase() + '_QUEUE_URL']: ref(name + 'Queue')
    }, commonSecrets, name + 'TaskRole', name + 'LogGroup');
    resources[name + 'Service'] = service(name, name + 'Task');
  }

  resources.ApiTaskRole = role([{ Effect: 'Allow', Action: 'sns:Publish',
    Resource: ref('EventTopic') }]);
  for (const name of ['Api', 'Outbox']) {
    resources[name + 'LogGroup'] = { Type: 'AWS::Logs::LogGroup', Properties: {
      RetentionInDays: 7
    } };
  }
  resources.ApiTask = taskDefinition('Api', ['node', 'src/api/server.js'], {
    ...commonEnvironment, EVENT_TRANSPORT: 'aws', API_AUTH_REQUIRED: 'true', PORT: '3000'
  }, { ...commonSecrets, API_AUTH_SECRET: ref('ApiAuthSecretArn') }, 'ApiTaskRole', 'ApiLogGroup');
  resources.OutboxTask = taskDefinition('Outbox', ['node', 'src/outbox-runner.js'], {
    ...commonEnvironment, EVENT_TRANSPORT: 'aws'
  }, commonSecrets, 'ApiTaskRole', 'OutboxLogGroup');
  resources.OutboxService = service('Outbox', 'OutboxTask');

  resources.ApiLoadBalancer = { Type: 'AWS::ElasticLoadBalancingV2::LoadBalancer',
    Properties: { Scheme: 'internet-facing', Type: 'application',
      Subnets: [ref('PublicSubnetA'), ref('PublicSubnetB')],
      SecurityGroups: [ref('AlbSecurityGroup')] } };
  resources.ApiDnsRecord = { Type: 'AWS::Route53::RecordSet', Properties: {
    HostedZoneId: ref('HostedZoneId'), Name: ref('ApiDomainName'), Type: 'A',
    AliasTarget: { DNSName: { 'Fn::GetAtt': ['ApiLoadBalancer', 'DNSName'] },
      HostedZoneId: { 'Fn::GetAtt': ['ApiLoadBalancer', 'CanonicalHostedZoneID'] } }
  } };
  resources.ApiTargetGroup = { Type: 'AWS::ElasticLoadBalancingV2::TargetGroup',
    Properties: { VpcId: ref('VpcId'), TargetType: 'ip', Protocol: 'HTTP', Port: 3000,
      HealthCheckPath: '/health', Matcher: { HttpCode: '200' } } };
  resources.ApiHttpsListener = { Type: 'AWS::ElasticLoadBalancingV2::Listener',
    Properties: { LoadBalancerArn: ref('ApiLoadBalancer'), Port: 443, Protocol: 'HTTPS',
      Certificates: [{ CertificateArn: ref('ApiCertificateArn') }],
      DefaultActions: [{ Type: 'forward', TargetGroupArn: ref('ApiTargetGroup') }] } };
  resources.ApiService = service('Api', 'ApiTask', { dependsOn: ['ApiHttpsListener'],
    loadBalancers: [{ ContainerName: 'api', ContainerPort: 3000,
      TargetGroupArn: ref('ApiTargetGroup') }] });

  resources.PortalBucket = { Type: 'AWS::S3::Bucket', Properties: {
    PublicAccessBlockConfiguration: { BlockPublicAcls: true, IgnorePublicAcls: true,
      BlockPublicPolicy: true, RestrictPublicBuckets: true },
    BucketEncryption: { ServerSideEncryptionConfiguration: [{
      ServerSideEncryptionByDefault: { SSEAlgorithm: 'AES256' }
    }] }
  } };
  resources.PortalAccessControl = { Type: 'AWS::CloudFront::OriginAccessControl', Properties: {
    OriginAccessControlConfig: { Name: sub('${AWS::StackName}-portal-access'),
      OriginAccessControlOriginType: 's3', SigningBehavior: 'always', SigningProtocol: 'sigv4' }
  } };
  const cacheSettings = { CookiesConfig: { CookieBehavior: 'none' },
    HeadersConfig: { HeaderBehavior: 'none' },
    QueryStringsConfig: { QueryStringBehavior: 'none' },
    EnableAcceptEncodingGzip: true, EnableAcceptEncodingBrotli: true };
  for (const [name, ttl] of [['Static', 300], ['Api', 0]]) {
    resources[name + 'CachePolicy'] = { Type: 'AWS::CloudFront::CachePolicy', Properties: {
      CachePolicyConfig: { Name: sub('${AWS::StackName}-' + name.toLowerCase() + '-cache'),
        MinTTL: 0, DefaultTTL: ttl, MaxTTL: ttl,
        ParametersInCacheKeyAndForwardedToOrigin: cacheSettings }
    } };
  }
  resources.ApiOriginPolicy = { Type: 'AWS::CloudFront::OriginRequestPolicy', Properties: {
    OriginRequestPolicyConfig: { Name: sub('${AWS::StackName}-api-origin'),
      CookiesConfig: { CookieBehavior: 'none' },
      HeadersConfig: { HeaderBehavior: 'whitelist', Headers: ['Authorization', 'Content-Type'] },
      QueryStringsConfig: { QueryStringBehavior: 'all' } }
  } };
  resources.PortalDistribution = { Type: 'AWS::CloudFront::Distribution', Properties: {
    DistributionConfig: { Enabled: true, DefaultRootObject: 'index.html',
      ViewerCertificate: { CloudFrontDefaultCertificate: true },
      Origins: [
        { Id: 'portal-s3', DomainName: { 'Fn::GetAtt': ['PortalBucket', 'RegionalDomainName'] },
          OriginAccessControlId: ref('PortalAccessControl'),
          S3OriginConfig: { OriginAccessIdentity: '' } },
        { Id: 'portal-api', DomainName: ref('ApiDomainName'),
          CustomOriginConfig: { HTTPPort: 80, HTTPSPort: 443,
            OriginProtocolPolicy: 'https-only', OriginSSLProtocols: ['TLSv1.2'] } }
      ],
      DefaultCacheBehavior: { TargetOriginId: 'portal-s3', ViewerProtocolPolicy: 'redirect-to-https',
        AllowedMethods: ['GET', 'HEAD'], CachedMethods: ['GET', 'HEAD'], Compress: true,
        CachePolicyId: ref('StaticCachePolicy') },
      CacheBehaviors: [{ PathPattern: 'api/*', TargetOriginId: 'portal-api',
        ViewerProtocolPolicy: 'https-only',
        AllowedMethods: ['GET', 'HEAD', 'OPTIONS', 'PUT', 'POST', 'PATCH', 'DELETE'],
        CachedMethods: ['GET', 'HEAD'], Compress: true,
        CachePolicyId: ref('ApiCachePolicy'), OriginRequestPolicyId: ref('ApiOriginPolicy') }]
    }
  } };
  resources.PortalBucketPolicy = { Type: 'AWS::S3::BucketPolicy', Properties: {
    Bucket: ref('PortalBucket'), PolicyDocument: { Version: '2012-10-17', Statement: [{
      Sid: 'CloudFrontReadOnly', Effect: 'Allow', Principal: { Service: 'cloudfront.amazonaws.com' },
      Action: 's3:GetObject', Resource: sub('${PortalBucket.Arn}/*'),
      Condition: { StringEquals: { 'AWS:SourceArn':
        sub('arn:${AWS::Partition}:cloudfront::${AWS::AccountId}:distribution/${PortalDistribution}') } }
    }] }
  } };

  const inventoryResourceId = { 'Fn::Join': ['/', ['service', ref('EcsCluster'),
    sub('${AWS::StackName}-inventory')]] };
  resources.InventoryScalingTarget = { Type: 'AWS::ApplicationAutoScaling::ScalableTarget',
    DependsOn: 'InventoryService', Properties: {
      ServiceNamespace: 'ecs', ScalableDimension: 'ecs:service:DesiredCount',
      ResourceId: inventoryResourceId, MinCapacity: 1, MaxCapacity: ref('InventoryMaxTasks')
    } };
  for (const [direction, adjustment, bound] of [['Out', 1, 'MetricIntervalLowerBound'],
    ['In', -1, 'MetricIntervalUpperBound']]) {
    resources['InventoryScale' + direction] = { Type: 'AWS::ApplicationAutoScaling::ScalingPolicy',
      Properties: { PolicyName: sub('${AWS::StackName}-inventory-scale-' + direction.toLowerCase()),
        PolicyType: 'StepScaling', ScalingTargetId: ref('InventoryScalingTarget'),
        StepScalingPolicyConfiguration: { AdjustmentType: 'ChangeInCapacity', Cooldown: 60,
          StepAdjustments: [{ [bound]: 0, ScalingAdjustment: adjustment }] }
      } };
    resources['InventoryQueue' + direction + 'Alarm'] = { Type: 'AWS::CloudWatch::Alarm',
      Properties: { Namespace: 'AWS/SQS', MetricName: 'ApproximateNumberOfMessagesVisible',
        Dimensions: [{ Name: 'QueueName', Value: { 'Fn::GetAtt': ['InventoryQueue', 'QueueName'] } }],
        Statistic: 'Average', Period: 60, EvaluationPeriods: direction === 'Out' ? 1 : 3,
        ComparisonOperator: direction === 'Out' ? 'GreaterThanThreshold' : 'LessThanThreshold',
        Threshold: direction === 'Out' ? 25 : 5,
        AlarmActions: [ref('InventoryScale' + direction)] }
    };
  }

  return { AWSTemplateFormatVersion: '2010-09-09', Description: 'ShelfSense ECS, IoT, SQS and SNS',
    Parameters: parameters, Conditions: { HasAlertEmail: { 'Fn::Not': [{ 'Fn::Equals': [ref('AlertEmail'), ''] }] } },
    Resources: resources,
    Outputs: {
      ApiDnsName: { Value: { 'Fn::GetAtt': ['ApiLoadBalancer', 'DNSName'] } },
      ApiUrl: { Value: sub('https://${ApiDomainName}') },
      ClusterName: { Value: ref('EcsCluster') },
      InventoryQueueUrl: { Value: ref('InventoryQueue') },
      EventTopicArn: { Value: ref('EventTopic') },
      BridgeIotPolicyName: { Value: ref('BridgeIotPolicy') },
      PortalBucketName: { Value: ref('PortalBucket') },
      PortalDistributionId: { Value: ref('PortalDistribution') },
      PortalUrl: { Value: { 'Fn::Join': ['', ['https://', { 'Fn::GetAtt': ['PortalDistribution', 'DomainName'] }]] } }
    } };
}

if (require.main === module) process.stdout.write(JSON.stringify(buildTemplate(), null, 2) + '\n');

module.exports = { buildTemplate };
