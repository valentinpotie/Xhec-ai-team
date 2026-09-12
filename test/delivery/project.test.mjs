import test from 'node:test';
import assert from 'node:assert/strict';
import { approvedItems, projectFromOwnerResult, statusOptionId } from '../../delivery/project.mjs';

const fields = [{ name: 'Status', options: [{ id: 'go', name: 'Approved for delivery' }, { id: 'doing', name: 'In delivery' }] }];
const items = [{ id: 'item-1', fieldValues: { nodes: [{ field: { name: 'Status' }, name: 'Approved for delivery' }] }, content: { title: 'A', body: 'B' }}];

test('finds the approval option by its displayed name', () => {
  assert.equal(statusOptionId(fields, 'Approved for delivery'), 'go');
});

test('selects only approved draft issue items', () => {
  assert.deepEqual(approvedItems(items).map(item => item.id), ['item-1']);
});

test('accepts a user project when the organization lookup is absent', () => {
  assert.deepEqual(projectFromOwnerResult({ organization: null, user: { projectV2: { id: 'p1', title: 'Delivery' } } }), { id: 'p1', title: 'Delivery' });
});
