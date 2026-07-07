export const dynamic = 'force-dynamic';
export const maxDuration = 60;

import { NextRequest, NextResponse } from 'next/server';
import { buildBlogAutomationEditorSections } from '@/lib/blog-automation-editor';
import {
  extractEditableNodes,
  extractWorkflowTimezone,
  getBlogWorkflowId,
  getBlogWorkflowName,
  isN8nWorkflowApiConfigured,
  loadBlogWorkflow,
  parseBlogWebhookPath,
  scanLegacyBrandInEditableNodes,
  type NodeFieldUpdate,
  updateBlogWorkflowNodes,
} from '@/lib/n8n-workflows';

function jsonResponse(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store, max-age=0' },
  });
}

export async function GET(request: NextRequest) {
  try {
    if (!(await isN8nWorkflowApiConfigured())) {
      return jsonResponse({
        configured: false,
        workflowId: await getBlogWorkflowId(),
        expectedWorkflowName: await getBlogWorkflowName(),
        error: 'n8n API key is not configured. Add it in API key management to edit workflow nodes.',
      });
    }

    const workflowIdParam = request.nextUrl.searchParams.get('workflowId') ?? undefined;
    const { workflow, resolvedWorkflowId, availableWorkflows, connection, legacyBrandNodes } =
      await loadBlogWorkflow(workflowIdParam);

    const editableNodes = extractEditableNodes(workflow.nodes, workflow.connections);
    const editorSections = buildBlogAutomationEditorSections(workflow.nodes, workflow.settings);
    const workflowTimezone = extractWorkflowTimezone(workflow.settings);

    return jsonResponse({
      configured: true,
      workflowId: workflow.id,
      resolvedWorkflowId,
      workflowName: workflow.name,
      expectedWorkflowName: await getBlogWorkflowName(),
      webhookPath: await parseBlogWebhookPath(),
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
    console.error('[API blog/workflow GET]', error);
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
      await updateBlogWorkflowNodes(updates, workflowId, settings);
    const editableNodes = extractEditableNodes(workflow.nodes, workflow.connections);
    const editorSections = buildBlogAutomationEditorSections(workflow.nodes, workflow.settings);
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
    console.error('[API blog/workflow PUT]', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update workflow' },
      { status: 502 }
    );
  }
}
