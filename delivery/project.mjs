const endpoint = 'https://api.github.com/graphql';

export function statusOptionId(fields, name) {
  const status = fields.find(field => field.name === 'Status');
  return status?.options?.find(option => option.name === name)?.id ?? null;
}

export function approvedItems(items) {
  return items.filter(item => item.content?.title && item.fieldValues?.nodes?.some(value => value.field?.name === 'Status' && value.name === 'Approved for delivery'));
}

export async function graphql(query, variables, { allowPartial = false } = {}) {
  const token = process.env.PROJECTS_TOKEN;
  if (!token) throw new Error('PROJECTS_TOKEN is required');
  const response = await fetch(endpoint, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ query, variables }) });
  const body = await response.json();
  if (!response.ok || (body.errors && !allowPartial)) throw new Error(`GitHub Project query failed: ${body.errors?.map(error => error.message).join('; ') || response.status}`);
  return body.data;
}

export async function listApprovedItems(projectId) {
  const data = await graphql(`query($id:ID!){node(id:$id){... on ProjectV2{items(first:100){nodes{id fieldValues(first:20){nodes{... on ProjectV2ItemFieldSingleSelectValue{name field{... on ProjectV2FieldCommon{name}}}}} content{... on DraftIssue{title body}}}}}}}`, { id: projectId });
  return approvedItems(data.node.items.nodes);
}

export async function projectByOwnerAndNumber(owner, number) {
  const data = await graphql(`query($owner:String!,$number:Int!){organization(login:$owner){projectV2(number:$number){id title}} user(login:$owner){projectV2(number:$number){id title}}}`, { owner, number }, { allowPartial: true });
  const project = projectFromOwnerResult(data);
  if (!project) throw new Error(`GitHub Project #${number} was not found for ${owner}`);
  return project;
}

export function projectFromOwnerResult(data) {
  return data?.organization?.projectV2 ?? data?.user?.projectV2 ?? null;
}

export async function projectStatusField(projectId) {
  const data = await graphql(`query($id:ID!){node(id:$id){... on ProjectV2{fields(first:100){nodes{... on ProjectV2SingleSelectField{id name options{id name}}}}}}}`, { id: projectId });
  const field = data.node.fields.nodes.find(candidate => candidate.name === 'Status');
  if (!field) throw new Error('GitHub Project is missing its Status field');
  return field;
}

export async function setStatus(projectId, itemId, fieldId, optionId) {
  return graphql(`mutation($projectId:ID!,$itemId:ID!,$fieldId:ID!,$optionId:String!){updateProjectV2ItemFieldValue(input:{projectId:$projectId,itemId:$itemId,fieldId:$fieldId,value:{singleSelectOptionId:$optionId}}){projectV2Item{id}}}`, { projectId, itemId, fieldId, optionId });
}

export async function claimItem(projectId, itemId) {
  return setItemStatusByName(projectId, itemId, 'In delivery');
}

export async function setItemStatusByName(projectId, itemId, statusName) {
  const field = await projectStatusField(projectId);
  const optionId = statusOptionId([field], statusName);
  if (!optionId) throw new Error(`GitHub Project Status is missing ${statusName}`);
  return setStatus(projectId, itemId, field.id, optionId);
}
