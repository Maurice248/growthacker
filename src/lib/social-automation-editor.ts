import type { EditableFieldType, EditableWorkflowNode, N8nWorkflowNode } from '@/lib/n8n-workflows';
import {
  extractScheduleTriggerSettings,
  extractWorkflowTimezone,
  resolveScheduleDaysInterval,
} from '@/lib/n8n-workflows';
import { WORKFLOW_SETTINGS_NODE_ID } from '@/lib/blog-automation-editor';

export { WORKFLOW_SETTINGS_NODE_ID };

export interface SocialAutomationEditorField {
  nodeId: string;
  key: string;
  label: string;
  description?: string;
  type: EditableFieldType;
  value: string;
}

export interface SocialAutomationEditorSection {
  id: string;
  title: string;
  description: string;
  fields: SocialAutomationEditorField[];
}

const SCHEDULE_NODE = 'Schedule Trigger';

function findNode(nodes: N8nWorkflowNode[], name: string): N8nWorkflowNode | undefined {
  return nodes.find((n) => n.name === name);
}

function extractScheduleFields(
  scheduleNode: N8nWorkflowNode,
  allNodes: N8nWorkflowNode[],
  workflowSettings?: Record<string, unknown>
): SocialAutomationEditorField[] {
  const { triggerAtHour } = extractScheduleTriggerSettings(scheduleNode);
  const daysInterval = resolveScheduleDaysInterval(allNodes);
  const timezone = extractWorkflowTimezone(workflowSettings);

  return [
    {
      nodeId: scheduleNode.id,
      key: 'triggerAtHour',
      label: 'Run at hour (24h)',
      description: 'Hour of the day when n8n checks whether to run (0 = midnight, 7 = 7 AM).',
      type: 'text',
      value: String(triggerAtHour),
    },
    {
      nodeId: WORKFLOW_SETTINGS_NODE_ID,
      key: 'timezone',
      label: 'Timezone',
      description: 'Workflow timezone from n8n settings.',
      type: 'text',
      value: timezone ?? '',
    },
    {
      nodeId: scheduleNode.id,
      key: 'daysInterval',
      label: 'Days between runs',
      description: 'Same as n8n Schedule Trigger → Days Between Triggers.',
      type: 'text',
      value: String(daysInterval),
    },
  ];
}

/** Build editor sections from editable n8n nodes (one section per node, plus schedule when present). */
export function buildSocialAutomationEditorSections(
  nodes: N8nWorkflowNode[],
  editableNodes: EditableWorkflowNode[],
  workflowSettings?: Record<string, unknown>
): SocialAutomationEditorSection[] {
  const sections: SocialAutomationEditorSection[] = [];

  const scheduleNode = findNode(nodes, SCHEDULE_NODE);
  if (scheduleNode) {
    sections.push({
      id: 'schedule',
      title: 'Schedule',
      description: 'Control when this social automation runs on your n8n server.',
      fields: extractScheduleFields(scheduleNode, nodes, workflowSettings),
    });
  }

  for (const node of editableNodes) {
    if (scheduleNode && node.id === scheduleNode.id) continue;

    sections.push({
      id: node.id,
      title: node.name,
      description: `${node.typeLabel} — edit prompts and parameters for this workflow step.`,
      fields: node.fields.map((field) => ({
        nodeId: node.id,
        key: field.key,
        label: field.label,
        description:
          field.key === 'systemMessage'
            ? 'Instructions that define tone, format, and rules for the AI.'
            : field.key === 'text'
              ? 'The main prompt sent to the AI, including variables from earlier workflow steps.'
              : undefined,
        type: field.type,
        value: field.value,
      })),
    });
  }

  return sections;
}

export function getSectionFieldValue(
  field: SocialAutomationEditorField,
  draftFields: Record<string, Record<string, string>>
): string {
  return draftFields[field.nodeId]?.[field.key] ?? field.value;
}

export function isSectionDirty(
  section: SocialAutomationEditorSection,
  draftFields: Record<string, Record<string, string>>
): boolean {
  return section.fields.some((field) => {
    const draft = draftFields[field.nodeId]?.[field.key];
    return draft !== undefined && draft !== field.value;
  });
}

export interface SocialSectionSavePayload {
  updates: Array<{ nodeId: string; fields: Record<string, string> }>;
  settings?: Record<string, string>;
}

export function buildSectionSavePayload(
  section: SocialAutomationEditorSection,
  draftFields: Record<string, Record<string, string>>
): SocialSectionSavePayload {
  const byNode = new Map<string, Record<string, string>>();
  let settings: Record<string, string> | undefined;

  for (const field of section.fields) {
    const value = getSectionFieldValue(field, draftFields);
    if (field.nodeId === WORKFLOW_SETTINGS_NODE_ID) {
      settings = settings ?? {};
      settings[field.key] = value;
      continue;
    }

    const existing = byNode.get(field.nodeId) ?? {};
    existing[field.key] = value;
    byNode.set(field.nodeId, existing);
  }

  return {
    updates: [...byNode.entries()].map(([nodeId, fields]) => ({ nodeId, fields })),
    settings,
  };
}
