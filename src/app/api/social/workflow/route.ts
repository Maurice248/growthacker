export const dynamic = 'force-dynamic';
export const maxDuration = 60;

import { NextRequest, NextResponse } from 'next/server';
import { buildSocialAutomationEditorSections } from '@/lib/social-automation-editor';
import { SOCIAL_N8N_WEBHOOK_FIELDS } from '@/lib/n8n-config';
import {
  DEFAULT_SOCIAL_WEBHOOK_KEY,
  extractEditableNodes,
  extractWorkflowTimezone,
  isN8nWorkflowApiConfigured,
  loadSocialWorkflow,
  scanLegacyBrandInEditableNodes,
  type NodeFieldUpdate,
  updateSocialWorkflowNodes,
} from '@/lib/n8n-workflows';

function resolveWebhookKey(raw: string | null): string {
  return raw?.trim() || DEFAULT_SOCIAL_WEBHOOK_KEY;
}

function isValidSocialWebhookKey(key: string): boolean {
  return SOCIAL_N8N_WEBHOOK_FIELDS.some((field) => field.key === key);
}

function jsonResponse(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store, max-age=0' },
  });
}

export async function GET(request: NextRequest) {
  try {
    const webhookKey = resolveWebhookKey(request.nextUrl.searchParams.get('webhookKey'));

    if (!isValidSocialWebhookKey(webhookKey)) {
      return jsonResponse({ error: 'Invalid webhookKey' }, 400);
    }

    if (!(await isN8nWorkflowApiConfigured())) {
      return jsonResponse({
        configured: false,
        webhookKey,
        error: 'n8n API key is not configured. Add it in API key management to edit workflow nodes.',
      });
    }

    const workflowIdParam = request.nextUrl.searchParams.get('workflowId') ?? undefined;
    const { workflow, resolvedWorkflowId, availableWorkflows, connection, legacyBrandNodes } =
      await loadSocialWorkflow(webhookKey, workflowIdParam);

    const editableNodes = extractEditableNodes(workflow.nodes, workflow.connections);
    const editorSections = buildSocialAutomationEditorSections(
      workflow.nodes,
      editableNodes,
      workflow.settings
    );
    const workflowTimezone = extractWorkflowTimezone(workflow.settings);
    const webhookMeta = SOCIAL_N8N_WEBHOOK_FIELDS.find((field) => field.key === webhookKey);

    return jsonResponse({
      configured: true,
      webhookKey,
      webhookLabel: webhookMeta?.label ?? webhookKey,
      workflowId: workflow.id,
      resolvedWorkflowId,
      workflowName: workflow.name,
      active: workflow.active,
      updatedAt: workflow.updatedAt,
      connection,
      editableNodes,
      editorSections,
      workflowTimezone,
      totalNodes: workflow.nodes.length,
      availableWorkflows,
      legacyBrandDetected: legacyBrandNodes.length > 0,
      legacyBrandNodes,
      loadsLiveFromN8n: true,
    });
  } catch (error) {
    console.error('[API social/workflow GET]', error);
    return jsonResponse(
      {
        configured: await isN8nWorkflowApiConfigured(),
        error: error instanceof Error ? error.message : 'Failed to load workflow',
      },
      502
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    if (!(await isN8nWorkflowApiConfigured())) {
      return NextResponse.json(
        { error: 'n8n API key is not configured for workflow editing.' },
        { status: 503 }
      );
    }

    const body = await request.json();
    const webhookKey = resolveWebhookKey(
      typeof body.webhookKey === 'string' ? body.webhookKey : null
    );

    if (!isValidSocialWebhookKey(webhookKey)) {
      return NextResponse.json({ error: 'Invalid webhookKey' }, { status: 400 });
    }

    const updates = body.updates as NodeFieldUpdate[] | undefined;
    const settings =
      body.settings && typeof body.settings === 'object'
        ? (body.settings as Record<string, unknown>)
        : undefined;
    const workflowId =
      typeof body.workflowId === 'string' ? body.workflowId.trim() : undefined;

    if (!Array.isArray(updates) || updates.length === 0) {
      return NextResponse.json({ error: 'updates array is required' }, { status: 400 });
    }

    if (settings?.timezone !== undefined && typeof settings.timezone !== 'string') {
      return NextResponse.json({ error: 'settings.timezone must be a string' }, { status: 400 });
    }

    for (const update of updates) {
      if (!update?.nodeId || typeof update.nodeId !== 'string') {
        return NextResponse.json({ error: 'Each update must include a nodeId' }, { status: 400 });
      }
      if (!update.fields || typeof update.fields !== 'object') {
        return NextResponse.json({ error: 'Each update must include fields' }, { status: 400 });
      }
    }

    const { workflow, republished, archivedConflictingWorkflows, deletedDuplicateWorkflows, activationError, webhookPathUsed } =
      await updateSocialWorkflowNodes(webhookKey, updates, workflowId, settings);

    const editableNodes = extractEditableNodes(workflow.nodes, workflow.connections);
    const editorSections = buildSocialAutomationEditorSections(
      workflow.nodes,
      editableNodes,
      workflow.settings
    );
    const workflowTimezone = extractWorkflowTimezone(workflow.settings);
    const legacyBrandNodes = scanLegacyBrandInEditableNodes(workflow.nodes);

    const cleanupNotes = [
      archivedConflictingWorkflows?.length
        ? `Archived duplicate webhook on: ${archivedConflictingWorkflows.join(', ')}.`
        : null,
      deletedDuplicateWorkflows?.length
        ? `Removed inactive duplicate workflow(s): ${deletedDuplicateWorkflows.join(', ')}.`
        : null,
    ].filter(Boolean);

    let message: string;
    if (activationError) {
      message =
        `Workflow saved in n8n, but activation failed: ${activationError}` +
        (cleanupNotes.length ? ` ${cleanupNotes.join(' ')}` : '');
    } else if (republished) {
      message = cleanupNotes.length
        ? `Workflow updated and re-published. ${cleanupNotes.join(' ')}`
        : 'Workflow nodes updated and workflow re-published in n8n.';
    } else {
      message = cleanupNotes.length
        ? `Workflow updated. ${cleanupNotes.join(' ')}`
        : 'Workflow nodes updated in n8n.';
    }

    return NextResponse.json({
      success: true,
      webhookKey,
      workflowId: workflow.id,
      workflowName: workflow.name,
      active: workflow.active,
      editableNodes,
      editorSections,
      workflowTimezone,
      legacyBrandDetected: legacyBrandNodes.length > 0,
      legacyBrandNodes,
      republished,
      archivedConflictingWorkflows,
      deletedDuplicateWorkflows,
      activationError,
      webhookPathUsed,
      message,
    });
  } catch (error) {
    console.error('[API social/workflow PUT]', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update workflow' },
      { status: 502 }
    );
  }
}
