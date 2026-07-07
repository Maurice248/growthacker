import { randomUUID } from 'crypto';
import { isLegacyTogaContent } from '@/lib/legacy-brand';
import { getRequestN8nConfig, getN8nWebhook } from '@/lib/company-integrations';

const DEFAULT_BLOG_WORKFLOW_ID = 'Kgt5aL2eaVYIyNMo';
const DEFAULT_BLOG_WORKFLOW_NAME = 'Tenant Report Blog Automation';
/** Live n8n instance workflow name (export JSON "Blogs"). */
const BLOGS_WORKFLOW_NAME = 'Blogs';

const N8N_FETCH_TIMEOUT_MS = 25_000;

async function fetchN8n(url: string, apiKey: string, init: RequestInit = {}): Promise<Response> {
  const signal = init.signal ?? AbortSignal.timeout(N8N_FETCH_TIMEOUT_MS);
  return fetch(url, {
    ...init,
    signal,
    cache: 'no-store',
    headers: {
      Accept: 'application/json',
      'X-N8N-API-KEY': apiKey,
      ...(init.headers as Record<string, string> | undefined),
    },
  });
}

export interface N8nWorkflowNode {
  id: string;
  name: string;
  type: string;
  typeVersion?: number;
  position: [number, number];
  parameters?: Record<string, unknown>;
  credentials?: Record<string, unknown>;
  disabled?: boolean;
  [key: string]: unknown;
}

export interface N8nWorkflow {
  id: string;
  name: string;
  active: boolean;
  isArchived?: boolean;
  updatedAt?: string;
  nodes: N8nWorkflowNode[];
  connections: Record<string, unknown>;
  settings?: Record<string, unknown>;
  staticData?: Record<string, unknown>;
  versionId?: string;
}

export type EditableFieldType = 'code' | 'textarea' | 'text' | 'json';

export interface EditableNodeField {
  key: string;
  label: string;
  type: EditableFieldType;
  value: string;
}

export interface EditableWorkflowNode {
  id: string;
  name: string;
  type: string;
  typeLabel: string;
  executionIndex: number;
  fields: EditableNodeField[];
}

export interface NodeFieldUpdate {
  nodeId: string;
  fields: Record<string, string>;
}

export interface N8nWorkflowSummary {
  id: string;
  name: string;
  active: boolean;
  updatedAt?: string;
}

export interface BlogWebhookWorkflowMatch {
  id: string;
  name: string;
  active: boolean;
  updatedAt?: string;
  webhookPath: string;
}

export interface BlogWorkflowConnectionInfo {
  webhookPath: string | null;
  webhookUrl: string | null;
  resolvedWorkflowId: string;
  resolvedWorkflowName: string;
  resolvedWorkflowActive: boolean;
  resolvedWorkflowUpdatedAt?: string;
  webhookMatches: BlogWebhookWorkflowMatch[];
}

export interface BlogWorkflowLoadResult {
  workflow: N8nWorkflow;
  resolvedWorkflowId: string;
  availableWorkflows: N8nWorkflowSummary[];
  connection: BlogWorkflowConnectionInfo;
  legacyBrandNodes: string[];
}

export interface BlogWorkflowUpdateResult {
  workflow: N8nWorkflow;
  republished: boolean;
  archivedConflictingWorkflows?: string[];
  deletedDuplicateWorkflows?: string[];
  activationError?: string;
  webhookPathUsed?: string;
}

async function getN8nApiConfig() {
  const cfg = await getRequestN8nConfig();
  const apiKey = cfg.apiKey?.trim() ?? null;
  const baseUrl = cfg.apiBaseUrl?.trim() ?? '';
  return { baseUrl, apiKey };
}

export async function getBlogWorkflowId(): Promise<string> {
  const cfg = await getRequestN8nConfig();
  return cfg.blogWorkflowId;
}

export async function getBlogWorkflowName(): Promise<string> {
  const cfg = await getRequestN8nConfig();
  return cfg.blogWorkflowName;
}

/** Path segment from N8N_BLOG_AUTOMATION_WEBHOOK_URL (e.g. "blog-automation"). */
export async function parseBlogWebhookPath(): Promise<string | null> {
  const cfg = await getRequestN8nConfig();
  const raw = getN8nWebhook(cfg, 'N8N_BLOG_AUTOMATION_WEBHOOK_URL');
  if (!raw) return null;

  try {
    const parsed = new URL(raw);
    return parsed.pathname
      .replace(/^\/webhook-test\//, '')
      .replace(/^\/webhook\//, '')
      .replace(/\/$/, '');
  } catch {
    return null;
  }
}

function workflowHasWebhookPath(workflow: N8nWorkflow, webhookPath: string): boolean {
  return (workflow.nodes ?? []).some((node) => {
    if (node.type !== 'n8n-nodes-base.webhook') return false;

    const params = asRecord(node.parameters);
    const path = typeof params.path === 'string' ? params.path : '';
    const webhookId = typeof node.webhookId === 'string' ? node.webhookId : '';

    return path === webhookPath || webhookId === webhookPath;
  });
}

function getWorkflowWebhookPaths(workflow: N8nWorkflow): string[] {
  const paths: string[] = [];
  for (const node of workflow.nodes ?? []) {
    if (node.type !== 'n8n-nodes-base.webhook') continue;
    const params = asRecord(node.parameters);
    if (typeof params.path === 'string' && params.path.trim()) {
      paths.push(params.path.trim());
    }
  }
  return paths;
}

function workflowUsesBlogWebhookPath(workflow: N8nWorkflow, webhookPath: string): boolean {
  return getWorkflowWebhookPaths(workflow).some(
    (path) => path === webhookPath || path.startsWith(`${webhookPath}-archived-`)
  );
}

function getBlogWebhookPathFromNodes(nodes: N8nWorkflowNode[]): string | null {
  for (const node of nodes) {
    if (node.type !== 'n8n-nodes-base.webhook') continue;
    const path = asRecord(node.parameters).path;
    if (typeof path === 'string' && path.trim()) return path.trim();
  }
  return null;
}

function getFallbackWebhookPath(webhookPath: string, workflowId: string): string {
  return `${webhookPath}-${workflowId.slice(0, 8).toLowerCase()}`;
}

function regenerateWebhookIdsForPath(
  nodes: N8nWorkflowNode[],
  webhookPath: string
): N8nWorkflowNode[] {
  return nodes.map((node) => {
    if (node.type !== 'n8n-nodes-base.webhook') return node;

    const params = asRecord(node.parameters);
    const path = typeof params.path === 'string' ? params.path : '';
    if (path !== webhookPath) return node;

    return { ...node, webhookId: randomUUID() };
  });
}

function setWebhookPathOnNodes(
  nodes: N8nWorkflowNode[],
  fromPath: string,
  toPath: string
): N8nWorkflowNode[] {
  return nodes.map((node) => {
    if (node.type !== 'n8n-nodes-base.webhook') return node;

    const params = asRecord(node.parameters);
    const path = typeof params.path === 'string' ? params.path : '';
    if (path !== fromPath) return node;

    return {
      ...node,
      webhookId: randomUUID(),
      parameters: {
        ...params,
        path: toPath,
      },
    };
  });
}

async function findBlogWorkflowMatchesByWebhookPath(
  webhookPath: string,
  options?: { stopAfterFirstActive?: boolean }
): Promise<BlogWebhookWorkflowMatch[]> {
  const summaries = await listN8nWorkflows();
  const matches: BlogWebhookWorkflowMatch[] = [];
  const CONCURRENCY = 8;

  for (let i = 0; i < summaries.length; i += CONCURRENCY) {
    const batch = summaries.slice(i, i + CONCURRENCY);
    const workflows = await Promise.all(
      batch.map(async (summary) => {
        try {
          return await fetchBlogWorkflowById(summary.id);
        } catch {
          return null;
        }
      })
    );

    for (let j = 0; j < batch.length; j++) {
      const workflow = workflows[j];
      if (!workflow || !workflowHasWebhookPath(workflow, webhookPath)) continue;

      const paths = getWorkflowWebhookPaths(workflow);
      matches.push({
        id: workflow.id,
        name: workflow.name,
        active: workflow.active,
        updatedAt: workflow.updatedAt ?? batch[j]!.updatedAt,
        webhookPath: paths.find((p) => p === webhookPath) ?? webhookPath,
      });

      if (options?.stopAfterFirstActive && workflow.active) {
        return matches;
      }
    }
  }

  return matches.sort((a, b) => {
    if (a.active !== b.active) return a.active ? -1 : 1;
    return (b.updatedAt ?? '').localeCompare(a.updatedAt ?? '');
  });
}

async function findBlogWorkflowIdByWebhookPath(webhookPath: string): Promise<string | null> {
  const matches = await findBlogWorkflowMatchesByWebhookPath(webhookPath, {
    stopAfterFirstActive: true,
  });
  if (matches[0]?.id) return matches[0].id;

  const fallbackPath = `${webhookPath}-${DEFAULT_BLOG_WORKFLOW_ID.slice(0, 8).toLowerCase()}`;
  const fallbackMatches = await findBlogWorkflowMatchesByWebhookPath(fallbackPath, {
    stopAfterFirstActive: true,
  });
  return fallbackMatches[0]?.id ?? null;
}

export async function getBlogWorkflowConnectionInfo(
  resolvedWorkflowId: string,
  resolvedWorkflow: N8nWorkflow
): Promise<BlogWorkflowConnectionInfo> {
  const cfg = await getRequestN8nConfig();
  const webhookPath = await parseBlogWebhookPath();
  const webhookUrl = getN8nWebhook(cfg, 'N8N_BLOG_AUTOMATION_WEBHOOK_URL');
  const paths = getWorkflowWebhookPaths(resolvedWorkflow);
  const webhookMatches: BlogWebhookWorkflowMatch[] =
    webhookPath && workflowHasWebhookPath(resolvedWorkflow, webhookPath)
      ? [
          {
            id: resolvedWorkflow.id,
            name: resolvedWorkflow.name,
            active: resolvedWorkflow.active,
            updatedAt: resolvedWorkflow.updatedAt,
            webhookPath: paths.find((p) => p === webhookPath) ?? webhookPath,
          },
        ]
      : [];

  return {
    webhookPath,
    webhookUrl,
    resolvedWorkflowId,
    resolvedWorkflowName: resolvedWorkflow.name,
    resolvedWorkflowActive: resolvedWorkflow.active,
    resolvedWorkflowUpdatedAt: resolvedWorkflow.updatedAt,
    webhookMatches,
  };
}

export async function isN8nWorkflowApiConfigured(): Promise<boolean> {
  const { apiKey } = await getN8nApiConfig();
  return Boolean(apiKey);
}

function nodeTypeLabel(type: string): string {
  if (type === 'n8n-nodes-base.code') return 'Code';
  if (type.includes('chainLlm')) return 'LLM Chain';
  if (type.includes('agent')) return 'AI Agent';
  if (type.includes('outputParserStructured')) return 'Output Parser';
  if (type.includes('lmChatOpenAi')) return 'OpenAI Model';
  if (type === 'n8n-nodes-base.httpRequest') return 'HTTP Request';
  if (type === 'n8n-nodes-base.set') return 'Set Fields';
  return type.replace(/^n8n-nodes-base\./, '').replace('@n8n/n8n-nodes-langchain.', '');
}

function getIfConditionEntries(
  condRoot: Record<string, unknown>
): Array<{ key: string | number; entry: Record<string, unknown> }> {
  const list = condRoot.conditions;
  if (Array.isArray(list) && list.length > 0) {
    return list.map((item, index) => ({ key: index, entry: asRecord(item) }));
  }

  const entries: Array<{ key: string | number; entry: Record<string, unknown> }> = [];
  for (const [key, value] of Object.entries(condRoot)) {
    if (key === 'conditions' || key === 'combinator' || key === 'options') continue;
    if (value && typeof value === 'object') {
      entries.push({ key, entry: asRecord(value) });
    }
  }
  return entries;
}

function findScheduleDayModuloCondition(
  condRoot: Record<string, unknown>
): { key: string | number; entry: Record<string, unknown> } | null {
  for (const item of getIfConditionEntries(condRoot)) {
    const leftValue = typeof item.entry.leftValue === 'string' ? item.entry.leftValue : '';
    if (/%(\d+)/.test(leftValue) && (leftValue.includes('$now') || leftValue.includes("format('dd')"))) {
      return item;
    }
  }

  for (const item of getIfConditionEntries(condRoot)) {
    const leftValue = typeof item.entry.leftValue === 'string' ? item.entry.leftValue : '';
    if (/%(\d+)/.test(leftValue)) return item;
  }

  return getIfConditionEntries(condRoot)[0] ?? null;
}

export function extractScheduleDayModulo(condRoot: Record<string, unknown>): string | null {
  const found = findScheduleDayModuloCondition(condRoot);
  if (!found) return null;
  const leftValue = typeof found.entry.leftValue === 'string' ? found.entry.leftValue : '';
  return leftValue.match(/%(\d+)/)?.[1] ?? null;
}

function applyScheduleDayModulo(condRoot: Record<string, unknown>, days: number): Record<string, unknown> {
  const next = { ...condRoot };
  const found = findScheduleDayModuloCondition(next);
  const leftValue = `={{ ($now.format('dd').toNumber())%${days} }}`;

  if (found) {
    const updated = { ...found.entry, leftValue };
    if (Array.isArray(next.conditions) && typeof found.key === 'number') {
      const list = [...next.conditions];
      list[found.key] = updated;
      next.conditions = list;
    } else {
      next[String(found.key)] = updated;
    }
    return next;
  }

  const list = Array.isArray(next.conditions) ? [...next.conditions] : [];
  list[0] = {
    id: randomUUID(),
    leftValue,
    rightValue: 0,
    operator: { type: 'number', operation: 'equals' },
  };
  next.conditions = list;
  return next;
}

function applyScheduleTriggerUpdate(
  node: N8nWorkflowNode,
  patch: { triggerAtHour?: number; daysInterval?: number }
): N8nWorkflowNode {
  if (node.type !== 'n8n-nodes-base.scheduleTrigger') {
    return node;
  }

  const params = { ...asRecord(node.parameters) };
  const rule = { ...asRecord(params.rule) };
  const interval = Array.isArray(rule.interval) ? [...rule.interval] : [{}];
  const first = { ...asRecord(interval[0]) };

  const hour = patch.triggerAtHour ?? Number(first.triggerAtHour ?? 7);
  const days = patch.daysInterval ?? Number(first.daysInterval ?? 1);
  const minute = Number(first.triggerAtMinute ?? 0);

  interval[0] = {
    field: 'days',
    daysInterval: Number.isFinite(days) ? Math.min(31, Math.max(1, days)) : 1,
    triggerAtHour: Number.isFinite(hour) ? Math.min(23, Math.max(0, hour)) : 7,
    triggerAtMinute: Number.isFinite(minute) ? Math.min(59, Math.max(0, minute)) : 0,
  };
  rule.interval = interval;
  params.rule = rule;

  return { ...node, parameters: params };
}

export function extractScheduleTriggerSettings(node: N8nWorkflowNode): {
  triggerAtHour: number;
  daysInterval: number;
} {
  const params = asRecord(node.parameters);
  const rule = asRecord(params.rule);
  const interval = Array.isArray(rule.interval) ? rule.interval : [];
  const first = asRecord(interval[0]);

  const hour = Number(first.triggerAtHour ?? 7);
  const days = Number(first.daysInterval ?? 1);

  return {
    triggerAtHour: Number.isFinite(hour) ? hour : 7,
    daysInterval: Number.isFinite(days) ? days : 1,
  };
}

export function resolveScheduleDaysInterval(nodes: N8nWorkflowNode[]): number {
  const scheduleNode = nodes.find((n) => n.name === 'Schedule Trigger');
  if (scheduleNode) {
    return extractScheduleTriggerSettings(scheduleNode).daysInterval;
  }

  const if2 = nodes.find((n) => n.name === 'If2');
  if (if2) {
    const outer = asRecord(asRecord(if2.parameters).conditions);
    const inner = Array.isArray(outer.conditions)
      ? { conditions: outer.conditions }
      : asRecord(outer.conditions);
    const modulo = extractScheduleDayModulo(inner);
    if (modulo) {
      const days = Number.parseInt(modulo, 10);
      if (Number.isFinite(days) && days > 0) return days;
    }
  }

  return 1;
}

/** Normalize If2 filter node to n8n If v2.3 shape so publish validation passes. */
function normalizeScheduleFilterNode(node: N8nWorkflowNode, days = 1): N8nWorkflowNode {
  if (node.name !== 'If2' && node.type !== 'n8n-nodes-base.if') {
    return node;
  }

  const params = asRecord(node.parameters);
  const outer = asRecord(params.conditions);
  const inner = asRecord(outer.conditions);
  const safeDays = Number.isFinite(days) && days > 0 ? days : 1;
  const found = findScheduleDayModuloCondition(inner);
  const conditionId =
    typeof found?.entry.id === 'string' ? found.entry.id : randomUUID();
  const options = asRecord(outer.options);

  params.conditions = {
    options: {
      caseSensitive: options.caseSensitive ?? true,
      leftValue: options.leftValue ?? '',
      typeValidation: options.typeValidation ?? 'strict',
      version: options.version ?? 3,
    },
    conditions: [
      {
        id: conditionId,
        leftValue: `={{ ($now.format('dd').toNumber())%${safeDays} }}`,
        rightValue: 0,
        operator: {
          type: 'number',
          operation: 'equals',
        },
      },
    ],
    combinator: outer.combinator ?? 'and',
  };

  return { ...node, parameters: params };
}

function normalizeScheduleFilterNodes(nodes: N8nWorkflowNode[]): N8nWorkflowNode[] {
  const days = resolveScheduleDaysInterval(nodes);
  return nodes.map((node) => normalizeScheduleFilterNode(node, days));
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

/** Keys accepted by n8n PUT /workflows/{id} — extra keys like binaryMode cause 400 errors. */
const ALLOWED_WORKFLOW_SETTINGS_KEYS = new Set([
  'executionOrder',
  'timezone',
  'saveDataErrorExecution',
  'saveDataSuccessExecution',
  'saveManualExecutions',
  'saveExecutionProgress',
  'executionTimeout',
  'errorWorkflow',
  'callerPolicy',
]);

export function sanitizeWorkflowSettings(
  settings: Record<string, unknown> | undefined
): Record<string, unknown> {
  const input = asRecord(settings);
  const sanitized: Record<string, unknown> = {};

  for (const key of ALLOWED_WORKFLOW_SETTINGS_KEYS) {
    if (key in input && input[key] !== undefined) {
      sanitized[key] = input[key];
    }
  }

  return sanitized;
}

export function extractWorkflowTimezone(settings?: Record<string, unknown>): string | null {
  const timezone = settings?.timezone;
  return typeof timezone === 'string' && timezone.trim() ? timezone.trim() : null;
}

/** Build a PUT body that matches the n8n public API schema. */
export function buildWorkflowUpdatePayload(
  workflow: N8nWorkflow,
  nodes: N8nWorkflowNode[],
  settingsPatch?: Record<string, unknown>
) {
  const mergedSettings = { ...asRecord(workflow.settings), ...asRecord(settingsPatch) };
  if (mergedSettings.timezone === '' || mergedSettings.timezone === null) {
    delete mergedSettings.timezone;
  }

  return {
    name: workflow.name,
    nodes,
    connections: workflow.connections,
    settings: sanitizeWorkflowSettings(mergedSettings),
  };
}

function getSystemMessage(params: Record<string, unknown>): string | undefined {
  const messages = asRecord(params.messages);
  const messageValues = messages.messageValues;
  if (Array.isArray(messageValues) && messageValues[0]) {
    const first = asRecord(messageValues[0]);
    if (typeof first.message === 'string') return first.message;
  }

  const options = asRecord(params.options);
  if (typeof options.systemMessage === 'string') return options.systemMessage;

  return undefined;
}

export function extractEditableFields(node: N8nWorkflowNode): EditableNodeField[] {
  const fields: EditableNodeField[] = [];
  const params = asRecord(node.parameters);

  if (node.type === 'n8n-nodes-base.code' && typeof params.jsCode === 'string') {
    fields.push({ key: 'jsCode', label: 'JavaScript Code', type: 'code', value: params.jsCode });
  }

  if (node.type.includes('chainLlm') || node.type.includes('agent')) {
    if (typeof params.text === 'string') {
      fields.push({ key: 'text', label: 'User Prompt Template', type: 'textarea', value: params.text });
    }
    const systemMessage = getSystemMessage(params);
    if (systemMessage) {
      fields.push({ key: 'systemMessage', label: 'System Prompt', type: 'textarea', value: systemMessage });
    }
  }

  if (node.type.includes('outputParserStructured')) {
    if (typeof params.inputSchema === 'string') {
      fields.push({ key: 'inputSchema', label: 'Input Schema (JSON)', type: 'json', value: params.inputSchema });
    }
    if (typeof params.jsonSchemaExample === 'string') {
      fields.push({
        key: 'jsonSchemaExample',
        label: 'JSON Schema Example',
        type: 'json',
        value: params.jsonSchemaExample,
      });
    }
  }

  if (node.type.includes('lmChatOpenAi')) {
    const model = asRecord(params.model);
    const modelValue = model.value ?? params.model;
    if (modelValue !== undefined) {
      fields.push({ key: 'model', label: 'Model', type: 'text', value: String(modelValue) });
    }
  }

  if (node.type === 'n8n-nodes-base.httpRequest') {
    if (typeof params.url === 'string') {
      fields.push({ key: 'url', label: 'URL', type: 'text', value: params.url });
    }
    if (typeof params.jsonBody === 'string') {
      fields.push({ key: 'jsonBody', label: 'JSON Body', type: 'json', value: params.jsonBody });
    }
  }

  return fields;
}

const TRIGGER_NODE_TYPES = new Set([
  'n8n-nodes-base.scheduleTrigger',
  'n8n-nodes-base.webhook',
  'n8n-nodes-base.manualTrigger',
  'n8n-nodes-base.formTrigger',
  'n8n-nodes-base.chatTrigger',
]);

function nodeCanvasSortKey(node: N8nWorkflowNode): [number, number] {
  const [x = 0, y = 0] = node.position ?? [0, 0];
  return [x, y];
}

function compareNodesByCanvas(a: N8nWorkflowNode, b: N8nWorkflowNode): number {
  const [ax, ay] = nodeCanvasSortKey(a);
  const [bx, by] = nodeCanvasSortKey(b);
  if (ax !== bx) return ax - bx;
  if (ay !== by) return ay - by;
  return a.name.localeCompare(b.name);
}

/** Topological execution order (node ids) derived from n8n connection graph. */
export function computeNodeExecutionOrder(
  nodes: N8nWorkflowNode[],
  connections: Record<string, unknown>
): string[] {
  const nodeByName = new Map(nodes.map((n) => [n.name, n]));
  const nodeNames = new Set(nodes.map((n) => n.name));

  const adj = new Map<string, string[]>();
  const inDegree = new Map<string, number>();

  for (const name of nodeNames) {
    adj.set(name, []);
    inDegree.set(name, 0);
  }

  for (const [sourceName, connTypes] of Object.entries(connections)) {
    if (!nodeNames.has(sourceName)) continue;

    const types = asRecord(connTypes);
    for (const branches of Object.values(types)) {
      if (!Array.isArray(branches)) continue;
      for (const branch of branches) {
        if (!Array.isArray(branch)) continue;
        for (const rawConn of branch) {
          const conn = asRecord(rawConn);
          const targetName = typeof conn.node === 'string' ? conn.node : '';
          if (!targetName || !nodeNames.has(targetName) || targetName === sourceName) continue;

          adj.get(sourceName)!.push(targetName);
          inDegree.set(targetName, (inDegree.get(targetName) ?? 0) + 1);
        }
      }
    }
  }

  const sortNames = (names: string[]) =>
    names.sort((a, b) => {
      const nodeA = nodeByName.get(a)!;
      const nodeB = nodeByName.get(b)!;
      const triggerA = TRIGGER_NODE_TYPES.has(nodeA.type);
      const triggerB = TRIGGER_NODE_TYPES.has(nodeB.type);
      if (triggerA !== triggerB) return triggerA ? -1 : 1;
      return compareNodesByCanvas(nodeA, nodeB);
    });

  const queue = sortNames(
    [...nodeNames].filter((name) => (inDegree.get(name) ?? 0) === 0)
  );

  const order: string[] = [];
  const seen = new Set<string>();

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (seen.has(current)) continue;
    seen.add(current);
    order.push(current);

    const neighbors = sortNames([...new Set(adj.get(current) ?? [])]);
    for (const next of neighbors) {
      const nextDegree = (inDegree.get(next) ?? 0) - 1;
      inDegree.set(next, nextDegree);
      if (nextDegree === 0 && !seen.has(next)) {
        queue.push(next);
        sortNames(queue);
      }
    }
  }

  const remaining = sortNames([...nodeNames].filter((name) => !seen.has(name)));
  for (const name of remaining) {
    order.push(name);
  }

  return order.map((name) => nodeByName.get(name)!.id);
}

export function extractEditableNodes(
  nodes: N8nWorkflowNode[],
  connections: Record<string, unknown> = {}
): EditableWorkflowNode[] {
  const executionOrderIds = computeNodeExecutionOrder(nodes, connections);
  const orderIndex = new Map(executionOrderIds.map((id, index) => [id, index]));

  const editable = nodes
    .map((node) => {
      const fields = extractEditableFields(node);
      if (fields.length === 0) return null;
      const executionIndex = orderIndex.get(node.id) ?? Number.MAX_SAFE_INTEGER;
      return {
        id: node.id,
        name: node.name,
        type: node.type,
        typeLabel: nodeTypeLabel(node.type),
        executionIndex,
        fields,
      };
    })
    .filter((node): node is EditableWorkflowNode => node !== null);

  return editable.sort((a, b) => {
    if (a.executionIndex !== b.executionIndex) return a.executionIndex - b.executionIndex;
    return a.name.localeCompare(b.name);
  });
}

function applyFieldUpdate(node: N8nWorkflowNode, fieldKey: string, value: string): N8nWorkflowNode {
  const params = { ...asRecord(node.parameters) };

  switch (fieldKey) {
    case 'jsCode':
      params.jsCode = value;
      break;
    case 'text':
      params.text = value;
      break;
    case 'systemMessage':
      if (params.messages && typeof params.messages === 'object') {
        const messages = { ...asRecord(params.messages) };
        const messageValues = Array.isArray(messages.messageValues) ? [...messages.messageValues] : [];
        if (messageValues[0]) {
          messageValues[0] = { ...asRecord(messageValues[0]), message: value };
        } else {
          messageValues.push({ message: value });
        }
        messages.messageValues = messageValues;
        params.messages = messages;
      } else {
        const options = { ...asRecord(params.options) };
        options.systemMessage = value;
        params.options = options;
      }
      break;
    case 'inputSchema':
      params.inputSchema = value;
      break;
    case 'jsonSchemaExample':
      params.jsonSchemaExample = value;
      break;
    case 'model':
      const model = asRecord(params.model);
      params.model = { ...model, value, mode: model.mode ?? 'list' };
      break;
    case 'url':
      params.url = value;
      break;
    case 'jsonBody':
      params.jsonBody = value;
      break;
    case 'triggerAtHour': {
      const hour = Number.parseInt(value, 10);
      return applyScheduleTriggerUpdate(node, {
        triggerAtHour: Number.isFinite(hour) ? Math.min(23, Math.max(0, hour)) : 7,
      });
    }
    case 'daysInterval':
    case 'runEveryDays': {
      const days = Math.max(1, Number.parseInt(value, 10) || 1);
      return applyScheduleTriggerUpdate(node, { daysInterval: days });
    }
    default:
      break;
  }

  return { ...node, parameters: params };
}

export function applyNodeUpdates(
  nodes: N8nWorkflowNode[],
  updates: NodeFieldUpdate[]
): N8nWorkflowNode[] {
  const updateMap = new Map(updates.map((u) => [u.nodeId, u.fields]));

  return nodes.map((node) => {
    const fieldUpdates = updateMap.get(node.id);
    if (!fieldUpdates) return node;

    let updated = node;
    for (const [fieldKey, value] of Object.entries(fieldUpdates)) {
      updated = applyFieldUpdate(updated, fieldKey, value);
    }
    return updated;
  });
}

export function scanLegacyBrandInEditableNodes(nodes: N8nWorkflowNode[]): string[] {
  const matches: string[] = [];
  for (const node of nodes) {
    const fields = extractEditableFields(node);
    if (fields.length === 0) continue;
    if (isLegacyTogaContent(fields.map((f) => f.value).join('\n'))) {
      matches.push(node.name);
    }
  }
  return matches;
}

export async function listN8nWorkflows(): Promise<N8nWorkflowSummary[]> {
  const { baseUrl, apiKey } = await getN8nApiConfig();
  if (!apiKey) {
    throw new Error('N8N_API_KEY is not configured.');
  }
  if (!baseUrl) {
    throw new Error('N8N_API_BASE_URL is not configured.');
  }

  const response = await fetchN8n(`${baseUrl}/api/v1/workflows?limit=250`, apiKey);

  const bodyText = await response.text();
  if (!response.ok) {
    throw new Error(`Failed to list workflows (${response.status}): ${bodyText.slice(0, 300)}`);
  }

  const data = JSON.parse(bodyText) as { data?: N8nWorkflowSummary[] };
  return data.data ?? [];
}

/** Resolve blog workflow id — prefer configured/default ids (single fetch) before slow webhook scans. */
export async function resolveBlogWorkflowId(explicitId?: string): Promise<string> {
  const cfg = await getRequestN8nConfig();
  const configuredId = cfg.blogWorkflowId?.trim() || null;
  const preferredName = await getBlogWorkflowName();

  if (explicitId?.trim()) return explicitId.trim();

  if (configuredId) {
    const configured = await tryFetchBlogWorkflowById(configuredId);
    if (configured) return configured.id;
  }

  const defaultWorkflow = await tryFetchBlogWorkflowById(DEFAULT_BLOG_WORKFLOW_ID);
  if (defaultWorkflow) return defaultWorkflow.id;

  try {
    const summaries = filterBlogWorkflowSummaries(await listN8nWorkflows());
    const fromName = pickBlogWorkflowIdFromSummaries(summaries, preferredName);
    if (fromName) return fromName;
  } catch (error) {
    console.warn('[n8n-workflows] Could not list workflows for ID resolution:', error);
  }

  const webhookPath = await parseBlogWebhookPath();
  if (webhookPath) {
    try {
      const fromWebhook = await findBlogWorkflowIdByWebhookPath(webhookPath);
      if (fromWebhook) return fromWebhook;
    } catch (error) {
      console.warn('[n8n-workflows] Could not resolve workflow from webhook URL:', error);
    }
  }

  return configuredId || DEFAULT_BLOG_WORKFLOW_ID;
}

function filterBlogWorkflowSummaries(workflows: N8nWorkflowSummary[]): N8nWorkflowSummary[] {
  return workflows
    .filter((w) => /blog|tenant\s*report/i.test(w.name))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function fetchBlogWorkflowById(workflowId: string): Promise<N8nWorkflow> {
  const { baseUrl, apiKey } = await getN8nApiConfig();
  if (!apiKey) {
    throw new Error('N8N_API_KEY is not configured for workflow editing.');
  }
  if (!baseUrl) {
    throw new Error('N8N_API_BASE_URL is not configured for workflow editing.');
  }

  const response = await fetchN8n(`${baseUrl}/api/v1/workflows/${workflowId}`, apiKey);

  const bodyText = await response.text();
  if (!response.ok) {
    throw new Error(`Failed to load workflow (${response.status}): ${bodyText.slice(0, 300)}`);
  }

  return JSON.parse(bodyText) as N8nWorkflow;
}

async function tryFetchBlogWorkflowById(workflowId: string): Promise<N8nWorkflow | null> {
  try {
    return await fetchBlogWorkflowById(workflowId);
  } catch {
    return null;
  }
}

function pickBlogWorkflowIdFromSummaries(
  workflows: N8nWorkflowSummary[],
  preferredName: string
): string | null {
  if (workflows.some((w) => w.id === DEFAULT_BLOG_WORKFLOW_ID)) {
    return DEFAULT_BLOG_WORKFLOW_ID;
  }

  const blogs = workflows.find((w) => w.name === BLOGS_WORKFLOW_NAME);
  if (blogs) return blogs.id;

  const exact = workflows.find((w) => w.name === preferredName);
  if (exact) return exact.id;

  const tenantBlog = workflows.find(
    (w) => /tenant\s*report/i.test(w.name) && /blog/i.test(w.name)
  );
  if (tenantBlog) return tenantBlog.id;

  const blogOnly = workflows.filter((w) => /blog/i.test(w.name));
  if (blogOnly.length === 1) return blogOnly[0]!.id;

  return null;
}

export async function loadBlogWorkflow(workflowId?: string): Promise<BlogWorkflowLoadResult> {
  const resolvedWorkflowId = await resolveBlogWorkflowId(workflowId);
  const workflow = await fetchBlogWorkflowById(resolvedWorkflowId);

  const availableWorkflows: N8nWorkflowSummary[] = [
    { id: workflow.id, name: workflow.name, active: workflow.active, updatedAt: workflow.updatedAt },
  ];

  const legacyBrandNodes = scanLegacyBrandInEditableNodes(workflow.nodes);
  const connection = await getBlogWorkflowConnectionInfo(resolvedWorkflowId, workflow);

  return {
    workflow,
    resolvedWorkflowId,
    availableWorkflows,
    connection,
    legacyBrandNodes,
  };
}

export function buildRestoreUpdatesFromTemplate(
  liveNodes: N8nWorkflowNode[],
  templateNodes: N8nWorkflowNode[]
): NodeFieldUpdate[] {
  const templateByName = new Map(templateNodes.map((n) => [n.name, n]));
  const updates: NodeFieldUpdate[] = [];

  for (const liveNode of liveNodes) {
    const templateNode = templateByName.get(liveNode.name);
    if (!templateNode) continue;

    const templateFields = extractEditableFields(templateNode);
    if (templateFields.length === 0) continue;

    const fields: Record<string, string> = {};
    for (const field of templateFields) {
      fields[field.key] = field.value;
    }
    updates.push({ nodeId: liveNode.id, fields });
  }

  return updates;
}

/** Reassign webhook path/id on inactive duplicate workflows that block saves. */
async function archiveConflictingInactiveWebhooks(
  keepWorkflowId: string,
  webhookPath: string
): Promise<string[]> {
  const matches = await findBlogWorkflowMatchesByWebhookPath(webhookPath);
  const archivedNames: string[] = [];

  for (const match of matches) {
    if (match.id === keepWorkflowId) continue;

    if (match.active) {
      throw new Error(
        `Webhook /${webhookPath} is also registered on active workflow "${match.name}" (${match.id}). ` +
          'Deactivate it or change its webhook path in n8n before saving here.'
      );
    }

    const wf = await fetchBlogWorkflowById(match.id);

    if (wf.isArchived) {
      await deleteN8nWorkflow(match.id);
      archivedNames.push(`${match.name} (${match.id}, deleted archived)`);
      continue;
    }

    let changed = false;
    const updatedNodes = wf.nodes.map((node) => {
      if (node.type !== 'n8n-nodes-base.webhook') return node;

      const params = asRecord(node.parameters);
      const path = typeof params.path === 'string' ? params.path : '';
      if (path !== webhookPath) return node;

      changed = true;
      return {
        ...node,
        webhookId: randomUUID(),
        parameters: {
          ...params,
          path: `${webhookPath}-archived-${match.id.slice(0, 8)}`,
        },
      };
    });

    if (!changed) continue;

    try {
      await putN8nWorkflow(match.id, buildWorkflowUpdatePayload(wf, updatedNodes));
      archivedNames.push(`${match.name} (${match.id})`);
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      if (isArchivedWorkflowError(detail)) {
        await deleteN8nWorkflow(match.id);
        archivedNames.push(`${match.name} (${match.id}, deleted archived)`);
        continue;
      }
      throw error;
    }
  }

  return archivedNames;
}

/** Remove inactive duplicate workflows that still hold stale webhook registrations in n8n. */
async function deleteInactiveWebhookDuplicateWorkflows(
  keepWorkflowId: string,
  webhookPath: string
): Promise<string[]> {
  const summaries = await listN8nWorkflows();
  const deletedNames: string[] = [];

  for (const summary of summaries) {
    if (summary.id === keepWorkflowId || summary.active) continue;

    const workflow = await fetchBlogWorkflowById(summary.id);
    if (!workflowUsesBlogWebhookPath(workflow, webhookPath)) continue;

    await deleteN8nWorkflow(summary.id);
    deletedNames.push(`${workflow.name} (${workflow.id})`);
  }

  return deletedNames;
}

async function deleteN8nWorkflow(workflowId: string): Promise<void> {
  const { baseUrl, apiKey } = await getN8nApiConfig();
  if (!apiKey) {
    throw new Error('N8N_API_KEY is not configured for workflow editing.');
  }

  const response = await fetch(`${baseUrl}/api/v1/workflows/${workflowId}`, {
    method: 'DELETE',
    headers: {
      Accept: 'application/json',
      'X-N8N-API-KEY': apiKey,
    },
  });

  const bodyText = await response.text();
  if (!response.ok && response.status !== 404) {
    throw new Error(`Failed to delete workflow (${response.status}): ${bodyText.slice(0, 500)}`);
  }
}

function isWebhookConflictError(message: string): boolean {
  return /conflict with one of the webhooks/i.test(message);
}

function isArchivedWorkflowError(message: string): boolean {
  return /cannot update an archived workflow/i.test(message);
}

async function publishBlogWorkflowAfterSave(
  workflowId: string,
  webhookPath: string | null,
  versionId?: string
): Promise<{
  workflow: N8nWorkflow;
  deletedDuplicateWorkflows: string[];
  webhookPathUsed?: string;
}> {
  let deletedDuplicateWorkflows: string[] = [];

  if (webhookPath) {
    deletedDuplicateWorkflows = await deleteInactiveWebhookDuplicateWorkflows(workflowId, webhookPath);
  }

  const currentForRepair = await fetchBlogWorkflowById(workflowId);
  let nodesForSave = normalizeScheduleFilterNodes(currentForRepair.nodes);
  const currentPath = getBlogWebhookPathFromNodes(nodesForSave);
  const reservedFallbackPath = webhookPath ? getFallbackWebhookPath(webhookPath, workflowId) : null;

  if (webhookPath && currentPath === reservedFallbackPath) {
    nodesForSave = setWebhookPathOnNodes(nodesForSave, reservedFallbackPath, webhookPath);
  }

  const needsSave =
    JSON.stringify(nodesForSave) !== JSON.stringify(currentForRepair.nodes);
  if (needsSave) {
    await putN8nWorkflow(workflowId, buildWorkflowUpdatePayload(currentForRepair, nodesForSave));
  }

  const tryActivate = async () => publishBlogWorkflow(workflowId, versionId);

  try {
    const workflow = await tryActivate();
    return { workflow, deletedDuplicateWorkflows, webhookPathUsed: webhookPath ?? undefined };
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    if (!webhookPath || !isWebhookConflictError(detail)) {
      throw error;
    }
  }

  let current = await fetchBlogWorkflowById(workflowId);
  let nodesWithFreshIds = regenerateWebhookIdsForPath(
    normalizeScheduleFilterNodes(current.nodes),
    webhookPath
  );
  await putN8nWorkflow(workflowId, buildWorkflowUpdatePayload(current, nodesWithFreshIds));

  deletedDuplicateWorkflows = [
    ...deletedDuplicateWorkflows,
    ...(await deleteInactiveWebhookDuplicateWorkflows(workflowId, webhookPath)),
  ];

  try {
    const workflow = await tryActivate();
    return { workflow, deletedDuplicateWorkflows, webhookPathUsed: webhookPath };
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    if (!isWebhookConflictError(detail)) {
      throw error;
    }
  }

  const fallbackPath = getFallbackWebhookPath(webhookPath, workflowId);
  current = await fetchBlogWorkflowById(workflowId);
  const nodesWithFallbackPath = setWebhookPathOnNodes(
    normalizeScheduleFilterNodes(current.nodes),
    webhookPath,
    fallbackPath
  );
  await putN8nWorkflow(workflowId, buildWorkflowUpdatePayload(current, nodesWithFallbackPath));

  const workflow = await tryActivate();
  return {
    workflow,
    deletedDuplicateWorkflows,
    webhookPathUsed: fallbackPath,
  };
}

async function putN8nWorkflow(
  workflowId: string,
  payload: ReturnType<typeof buildWorkflowUpdatePayload>
): Promise<N8nWorkflow> {
  const { baseUrl, apiKey } = await getN8nApiConfig();
  if (!apiKey) {
    throw new Error('N8N_API_KEY is not configured for workflow editing.');
  }

  const response = await fetch(`${baseUrl}/api/v1/workflows/${workflowId}`, {
    method: 'PUT',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'X-N8N-API-KEY': apiKey,
    },
    body: JSON.stringify(payload),
  });

  const bodyText = await response.text();
  if (!response.ok) {
    if (isWebhookConflictError(bodyText)) {
      throw new Error(
        'Failed to update workflow (400): n8n reported a webhook conflict. ' +
          'Another workflow may be using the same webhook path. Try again — inactive duplicates are archived automatically.'
      );
    }
    throw new Error(`Failed to update workflow (${response.status}): ${bodyText.slice(0, 500)}`);
  }

  return JSON.parse(bodyText) as N8nWorkflow;
}

/** Temporarily deactivate before PUT — avoids n8n webhook registration conflicts on active workflows. */
async function deactivateBlogWorkflow(workflowId: string): Promise<void> {
  const { baseUrl, apiKey } = await getN8nApiConfig();
  if (!apiKey) {
    throw new Error('N8N_API_KEY is not configured for workflow editing.');
  }

  const response = await fetch(`${baseUrl}/api/v1/workflows/${workflowId}/deactivate`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'X-N8N-API-KEY': apiKey,
    },
    body: JSON.stringify({}),
  });

  const bodyText = await response.text();
  if (!response.ok && response.status !== 404) {
    throw new Error(`Failed to deactivate workflow (${response.status}): ${bodyText.slice(0, 500)}`);
  }
}

/** Re-publish (activate) a workflow after PUT updates — n8n unpublishes on edit. */
export async function publishBlogWorkflow(
  workflowId: string,
  versionId?: string
): Promise<N8nWorkflow> {
  const { baseUrl, apiKey } = await getN8nApiConfig();
  if (!apiKey) {
    throw new Error('N8N_API_KEY is not configured for workflow editing.');
  }

  const response = await fetch(`${baseUrl}/api/v1/workflows/${workflowId}/activate`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'X-N8N-API-KEY': apiKey,
    },
    body: JSON.stringify(versionId ? { versionId } : {}),
  });

  const bodyText = await response.text();
  if (!response.ok) {
    throw new Error(`Failed to publish workflow (${response.status}): ${bodyText.slice(0, 500)}`);
  }

  return JSON.parse(bodyText) as N8nWorkflow;
}

export async function updateBlogWorkflowNodes(
  updates: NodeFieldUpdate[],
  workflowId?: string,
  settingsPatch?: Record<string, unknown>
): Promise<BlogWorkflowUpdateResult> {
  const { apiKey } = await getN8nApiConfig();
  if (!apiKey) {
    throw new Error('n8n API key is not configured for workflow editing.');
  }

  const resolvedId = await resolveBlogWorkflowId(workflowId);
  const workflow = await fetchBlogWorkflowById(resolvedId);
  let updatedNodes = applyNodeUpdates(workflow.nodes, updates);
  updatedNodes = normalizeScheduleFilterNodes(updatedNodes);
  const payload = buildWorkflowUpdatePayload(workflow, updatedNodes, settingsPatch);
  const webhookPath = await parseBlogWebhookPath();

  let archivedConflictingWorkflows: string[] = [];
  let deletedDuplicateWorkflows: string[] = [];
  if (webhookPath) {
    deletedDuplicateWorkflows = await deleteInactiveWebhookDuplicateWorkflows(resolvedId, webhookPath);
    archivedConflictingWorkflows = await archiveConflictingInactiveWebhooks(resolvedId, webhookPath);
  }

  const wasActive = workflow.active;
  if (wasActive) {
    await deactivateBlogWorkflow(resolvedId);
  }

  let updatedWorkflow: N8nWorkflow;
  try {
    updatedWorkflow = await putN8nWorkflow(resolvedId, payload);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    if (webhookPath && isWebhookConflictError(detail)) {
      deletedDuplicateWorkflows = [
        ...deletedDuplicateWorkflows,
        ...(await deleteInactiveWebhookDuplicateWorkflows(resolvedId, webhookPath)),
      ];
      archivedConflictingWorkflows = [
        ...archivedConflictingWorkflows,
        ...(await archiveConflictingInactiveWebhooks(resolvedId, webhookPath)),
      ];
      if (!wasActive) {
        await deactivateBlogWorkflow(resolvedId);
      }
      updatedWorkflow = await putN8nWorkflow(resolvedId, payload);
    } else {
      if (wasActive) {
        try {
          await publishBlogWorkflow(resolvedId);
        } catch {
          // best effort restore
        }
      }
      throw error;
    }
  }

  let republished = false;
  let activationError: string | undefined;
  let webhookPathUsed: string | undefined;

  if (webhookPath) {
    try {
      const publishResult = await publishBlogWorkflowAfterSave(
        resolvedId,
        webhookPath,
        updatedWorkflow.versionId
      );
      updatedWorkflow = publishResult.workflow;
      deletedDuplicateWorkflows = [
        ...deletedDuplicateWorkflows,
        ...publishResult.deletedDuplicateWorkflows,
      ];
      webhookPathUsed = publishResult.webhookPathUsed;
      republished = true;
      if (webhookPathUsed && webhookPathUsed !== webhookPath) {
        activationError =
          `Workflow activated on /${webhookPathUsed} because /${webhookPath} has a stale n8n registration. ` +
          `Update N8N_BLOG_AUTOMATION_WEBHOOK_URL to use /${webhookPathUsed}.`;
      }
    } catch (error) {
      activationError =
        error instanceof Error ? error.message : 'Failed to activate workflow in n8n';
    }
  } else if (wasActive) {
    try {
      updatedWorkflow = await publishBlogWorkflow(resolvedId, updatedWorkflow.versionId);
      republished = true;
    } catch (error) {
      activationError =
        error instanceof Error ? error.message : 'Failed to re-activate workflow in n8n';
    }
  }

  return {
    workflow: updatedWorkflow,
    republished,
    archivedConflictingWorkflows,
    deletedDuplicateWorkflows: deletedDuplicateWorkflows.length ? deletedDuplicateWorkflows : undefined,
    activationError,
    webhookPathUsed,
  };
}

export async function activateBlogWorkflow(workflowId?: string): Promise<{
  workflow: N8nWorkflow;
  deletedDuplicateWorkflows?: string[];
}> {
  const resolvedId = await resolveBlogWorkflowId(workflowId);
  const webhookPath = await parseBlogWebhookPath();
  const { workflow, deletedDuplicateWorkflows } = await publishBlogWorkflowAfterSave(
    resolvedId,
    webhookPath
  );
  return {
    workflow,
    deletedDuplicateWorkflows: deletedDuplicateWorkflows.length ? deletedDuplicateWorkflows : undefined,
  };
}

export async function restoreTenantReportWorkflowPrompts(workflowId?: string): Promise<N8nWorkflow> {
  const templateModule = await import('@/data/tenant-report-blog-automation.workflow.json');
  const template = templateModule.default as unknown as N8nWorkflow;

  const resolvedId = await resolveBlogWorkflowId(workflowId);
  const liveWorkflow = await fetchBlogWorkflowById(resolvedId);
  const updates = buildRestoreUpdatesFromTemplate(liveWorkflow.nodes, template.nodes);

  if (updates.length === 0) {
    throw new Error(
      'No matching editable nodes between the live n8n workflow and the Tenant Report template.'
    );
  }

  const { workflow } = await updateBlogWorkflowNodes(updates, resolvedId);
  return workflow;
}

export const DEFAULT_SOCIAL_WEBHOOK_KEY = 'NEXT_PUBLIC_N8N_SOCIAL_IMAGE_URL';

export type SocialWorkflowConnectionInfo = BlogWorkflowConnectionInfo;

export interface SocialWorkflowLoadResult {
  workflow: N8nWorkflow;
  resolvedWorkflowId: string;
  availableWorkflows: N8nWorkflowSummary[];
  connection: SocialWorkflowConnectionInfo;
  legacyBrandNodes: string[];
}

export interface SocialWorkflowUpdateResult {
  workflow: N8nWorkflow;
  republished: boolean;
  archivedConflictingWorkflows?: string[];
  deletedDuplicateWorkflows?: string[];
  activationError?: string;
  webhookPathUsed?: string;
}

/** Path segment from a configured social webhook URL. */
export async function parseSocialWebhookPath(webhookKey: string): Promise<string | null> {
  const cfg = await getRequestN8nConfig();
  const raw = getN8nWebhook(cfg, webhookKey);
  if (!raw) return null;

  try {
    const parsed = new URL(raw);
    return parsed.pathname
      .replace(/^\/webhook-test\//, '')
      .replace(/^\/webhook\//, '')
      .replace(/\/$/, '');
  } catch {
    return null;
  }
}

function filterSocialWorkflowSummaries(workflows: N8nWorkflowSummary[]): N8nWorkflowSummary[] {
  return workflows
    .filter((w) => /social|creator|tenant\s*report/i.test(w.name))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function getSocialWorkflowConnectionInfo(
  webhookKey: string,
  resolvedWorkflowId: string,
  resolvedWorkflow: N8nWorkflow
): Promise<SocialWorkflowConnectionInfo> {
  const cfg = await getRequestN8nConfig();
  const webhookPath =
    (await parseSocialWebhookPath(webhookKey)) ??
    getBlogWebhookPathFromNodes(resolvedWorkflow.nodes);
  const webhookUrl = getN8nWebhook(cfg, webhookKey);

  const webhookMatches: BlogWebhookWorkflowMatch[] = [];
  if (webhookPath && workflowHasWebhookPath(resolvedWorkflow, webhookPath)) {
    webhookMatches.push({
      id: resolvedWorkflow.id,
      name: resolvedWorkflow.name,
      active: resolvedWorkflow.active,
      updatedAt: resolvedWorkflow.updatedAt,
      webhookPath,
    });
  }

  return {
    webhookPath,
    webhookUrl,
    resolvedWorkflowId,
    resolvedWorkflowName: resolvedWorkflow.name,
    resolvedWorkflowActive: resolvedWorkflow.active,
    resolvedWorkflowUpdatedAt: resolvedWorkflow.updatedAt,
    webhookMatches,
  };
}

/** Resolve the n8n workflow that owns a social webhook URL. */
export async function resolveSocialWorkflowId(
  webhookKey: string,
  explicitId?: string
): Promise<string> {
  if (explicitId?.trim()) return explicitId.trim();

  const envSocialId = process.env.N8N_SOCIAL_WORKFLOW_ID?.trim();
  if (envSocialId) return envSocialId;

  const webhookPath = await parseSocialWebhookPath(webhookKey);
  if (webhookPath) {
    try {
      const fromWebhook = await findBlogWorkflowIdByWebhookPath(webhookPath);
      if (fromWebhook) return fromWebhook;
    } catch (error) {
      console.warn('[n8n-workflows] Could not resolve social workflow from webhook URL:', error);
    }
  }

  try {
    const workflows = filterSocialWorkflowSummaries(await listN8nWorkflows());
    if (workflows.length === 1) return workflows[0]!.id;
    const active = workflows.find((w) => w.active);
    if (active) return active.id;
  } catch (error) {
    console.warn('[n8n-workflows] Could not list workflows for social ID resolution:', error);
  }

  throw new Error(
    `Could not resolve n8n workflow for ${webhookKey}. Add its webhook URL in Settings, or set N8N_SOCIAL_WORKFLOW_ID in .env.`
  );
}

export async function loadSocialWorkflow(
  webhookKey: string,
  workflowId?: string
): Promise<SocialWorkflowLoadResult> {
  const resolvedWorkflowId = await resolveSocialWorkflowId(webhookKey, workflowId);
  const workflow = await fetchBlogWorkflowById(resolvedWorkflowId);

  let availableWorkflows: N8nWorkflowSummary[] = [];
  try {
    availableWorkflows = filterSocialWorkflowSummaries(await listN8nWorkflows());
  } catch {
    availableWorkflows = [{ id: workflow.id, name: workflow.name, active: workflow.active }];
  }

  const legacyBrandNodes = scanLegacyBrandInEditableNodes(workflow.nodes);
  const connection = await getSocialWorkflowConnectionInfo(
    webhookKey,
    resolvedWorkflowId,
    workflow
  );

  return {
    workflow,
    resolvedWorkflowId,
    availableWorkflows,
    connection,
    legacyBrandNodes,
  };
}

export async function updateSocialWorkflowNodes(
  webhookKey: string,
  updates: NodeFieldUpdate[],
  workflowId?: string,
  settingsPatch?: Record<string, unknown>
): Promise<SocialWorkflowUpdateResult> {
  const { apiKey } = await getN8nApiConfig();
  if (!apiKey) {
    throw new Error('n8n API key is not configured for workflow editing.');
  }

  const resolvedId = await resolveSocialWorkflowId(webhookKey, workflowId);
  const workflow = await fetchBlogWorkflowById(resolvedId);
  let updatedNodes = applyNodeUpdates(workflow.nodes, updates);
  updatedNodes = normalizeScheduleFilterNodes(updatedNodes);
  const payload = buildWorkflowUpdatePayload(workflow, updatedNodes, settingsPatch);
  const webhookPath = await parseSocialWebhookPath(webhookKey);

  let archivedConflictingWorkflows: string[] = [];
  let deletedDuplicateWorkflows: string[] = [];
  if (webhookPath) {
    deletedDuplicateWorkflows = await deleteInactiveWebhookDuplicateWorkflows(resolvedId, webhookPath);
    archivedConflictingWorkflows = await archiveConflictingInactiveWebhooks(resolvedId, webhookPath);
  }

  const wasActive = workflow.active;
  if (wasActive) {
    await deactivateBlogWorkflow(resolvedId);
  }

  let updatedWorkflow: N8nWorkflow;
  try {
    updatedWorkflow = await putN8nWorkflow(resolvedId, payload);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    if (webhookPath && isWebhookConflictError(detail)) {
      deletedDuplicateWorkflows = [
        ...deletedDuplicateWorkflows,
        ...(await deleteInactiveWebhookDuplicateWorkflows(resolvedId, webhookPath)),
      ];
      archivedConflictingWorkflows = [
        ...archivedConflictingWorkflows,
        ...(await archiveConflictingInactiveWebhooks(resolvedId, webhookPath)),
      ];
      if (!wasActive) {
        await deactivateBlogWorkflow(resolvedId);
      }
      updatedWorkflow = await putN8nWorkflow(resolvedId, payload);
    } else {
      if (wasActive) {
        try {
          await publishBlogWorkflow(resolvedId);
        } catch {
          // best effort restore
        }
      }
      throw error;
    }
  }

  let republished = false;
  let activationError: string | undefined;
  let webhookPathUsed: string | undefined;

  if (webhookPath) {
    try {
      const publishResult = await publishBlogWorkflowAfterSave(
        resolvedId,
        webhookPath,
        updatedWorkflow.versionId
      );
      updatedWorkflow = publishResult.workflow;
      deletedDuplicateWorkflows = [
        ...deletedDuplicateWorkflows,
        ...publishResult.deletedDuplicateWorkflows,
      ];
      webhookPathUsed = publishResult.webhookPathUsed;
      republished = true;
      if (webhookPathUsed && webhookPathUsed !== webhookPath) {
        activationError =
          `Workflow activated on /${webhookPathUsed} because /${webhookPath} has a stale n8n registration. ` +
          `Update ${webhookKey} to use /${webhookPathUsed}.`;
      }
    } catch (error) {
      activationError =
        error instanceof Error ? error.message : 'Failed to activate workflow in n8n';
    }
  } else if (wasActive) {
    try {
      updatedWorkflow = await publishBlogWorkflow(resolvedId, updatedWorkflow.versionId);
      republished = true;
    } catch (error) {
      activationError =
        error instanceof Error ? error.message : 'Failed to re-activate workflow in n8n';
    }
  }

  return {
    workflow: updatedWorkflow,
    republished,
    archivedConflictingWorkflows,
    deletedDuplicateWorkflows: deletedDuplicateWorkflows.length ? deletedDuplicateWorkflows : undefined,
    activationError,
    webhookPathUsed,
  };
}
