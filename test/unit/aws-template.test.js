const test = require('node:test');
const assert = require('node:assert/strict');
const { buildTemplate } = require('../../infra/aws/template');

test('AWS template connects IoT rules, service queues, ECS workers and inventory scaling', () => {
  const template = buildTemplate();
  const resources = template.Resources;
  assert.equal(resources.StockRule.Type, 'AWS::IoT::TopicRule');
  assert.equal(resources.InventoryQueue.Type, 'AWS::SQS::Queue');
  assert.equal(resources.EventTopic.Type, 'AWS::SNS::Topic');
  for (const name of ['Inventory', 'Replenishment', 'Coldchain', 'Delivery']) {
    assert.equal(resources[name + 'Service'].Type, 'AWS::ECS::Service');
    assert.equal(resources[name + 'TaskRole'].Type, 'AWS::IAM::Role');
  }
  assert.equal(resources.InventoryScalingTarget.Type, 'AWS::ApplicationAutoScaling::ScalableTarget');
  assert.deepEqual(resources.InventoryScalingTarget.Properties.MaxCapacity, { Ref: 'InventoryMaxTasks' });
  assert.equal(template.Parameters.InventoryMaxTasks.Default, 4);
  assert.equal(resources.ApiHttpsListener.Properties.Port, 443);
  assert.equal(resources.EcsCluster.Properties.ClusterSettings[0].Value, 'enabled');
  assert.equal(resources.BridgeIotPolicy.Type, 'AWS::IoT::Policy');
  assert.equal(resources.AlertEmailSubscription.Condition, 'HasAlertEmail');
  assert.equal(resources.ApiDnsRecord.Type, 'AWS::Route53::RecordSet');
  assert.equal(resources.PortalBucket.Type, 'AWS::S3::Bucket');
  assert.equal(resources.PortalDistribution.Type, 'AWS::CloudFront::Distribution');
  assert.equal(resources.ApiCachePolicy.Properties.CachePolicyConfig.MaxTTL, 0);
});
