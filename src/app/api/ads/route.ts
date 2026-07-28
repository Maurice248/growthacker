export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { shouldShowInApprovalQueue } from '@/lib/legacy-brand';
import {
  getAutomationExcludedMedia,
  isAutomationGeneratedMedia,
} from '@/lib/meta-automation/excluded-media';
import { prisma } from '@/lib/prisma';
import { requireApiCompanyId } from '@/lib/api-auth';

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function GET() {
  try {
    const companyId = await requireApiCompanyId();
    if (companyId instanceof NextResponse) return companyId;

    const supabase = getServiceClient();
    const projectUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/rest\/v1\/?$/, '');

    const storageLookup: Record<string, { bucket: string; time: string; publicUrl: string }> = {};
    const buckets = ['AD1', 'AD2', 'AD3', 'AD4', 'AD5'];

    for (const bucket of buckets) {
      const pageSize = 200;
      let offset = 0;
      for (;;) {
        const { data: files } = await supabase.storage.from(bucket).list('', {
          limit: pageSize,
          offset,
        });
        if (!files?.length) break;
        for (const file of files) {
          if (file.name === '.emptyFolderPlaceholder') continue;
          storageLookup[file.name] = {
            bucket,
            time: file.created_at,
            publicUrl: `${projectUrl}/storage/v1/object/public/${bucket}/${file.name}`,
          };
        }
        if (files.length < pageSize) break;
        offset += pageSize;
      }
    }

    const { data: rows, error } = await supabase
      .from('your_name_table')
      .select('id, text, time, format, Approved, "json data", story, company_id')
      .eq('company_id', companyId)
      .order('time', { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const excludedAutomationMedia = await getAutomationExcludedMedia(companyId);

    const filteredRows = (rows || []).filter(
      (row) =>
        shouldShowInApprovalQueue(row) &&
        !isAutomationGeneratedMedia(row.text, excludedAutomationMedia)
    );

    return NextResponse.json({
      rows: filteredRows,
      storageLookup,
      automationExcludedFilenames: [...excludedAutomationMedia.filenames],
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to fetch ads';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const companyId = await requireApiCompanyId();
    if (companyId instanceof NextResponse) return companyId;

    const { id, time, text, deleteRow } = await req.json();

    if (!id && !text) {
      return NextResponse.json({ error: 'id or text is required' }, { status: 400 });
    }

    if (deleteRow) {
      const supabase = getServiceClient();
      let query = supabase.from('your_name_table').delete().eq('company_id', companyId);
      if (id && time) query = query.eq('id', id).eq('time', time);
      else if (text) query = query.eq('text', text);
      else if (id) query = query.eq('id', id);

      const { error } = await query;
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ success: true });
    }

    const approvedValue = 'false';
    let result = 0;

    if (text) {
      result = await prisma.$executeRawUnsafe(
        `UPDATE "your_name_table" SET "Approved" = $1 WHERE "text" = $2 AND "company_id" = $3`,
        approvedValue,
        text,
        companyId
      );
    }
    if (result === 0 && id && time) {
      result = await prisma.$executeRawUnsafe(
        `UPDATE "your_name_table" SET "Approved" = $1 WHERE "id"::text = $2 AND "time" = $3::timestamptz AND "company_id" = $4`,
        approvedValue,
        String(id),
        time,
        companyId
      );
    }
    if (result === 0 && id) {
      result = await prisma.$executeRawUnsafe(
        `UPDATE "your_name_table" SET "Approved" = $1 WHERE "id"::text = $2 AND "company_id" = $3`,
        approvedValue,
        String(id),
        companyId
      );
    }

    return NextResponse.json({ success: true, rowsAffected: result });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to remove ad';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const companyId = await requireApiCompanyId();
    if (companyId instanceof NextResponse) return companyId;

    const { id, time, jsonData } = await req.json();
    if (!id || !time) {
      return NextResponse.json({ error: 'id and time are required' }, { status: 400 });
    }
    if (jsonData == null) {
      return NextResponse.json({ error: 'jsonData is required' }, { status: 400 });
    }

    const supabase = getServiceClient();
    const payload =
      typeof jsonData === 'string' ? jsonData : JSON.stringify(jsonData);

    const { data, error } = await supabase
      .from('your_name_table')
      .update({ 'json data': payload })
      .eq('company_id', companyId)
      .eq('id', id)
      .eq('time', time)
      .select('id')
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if (!data) {
      return NextResponse.json({ error: 'No matching ad record found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to update ad';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const companyId = await requireApiCompanyId();
    if (companyId instanceof NextResponse) return companyId;

    const { action } = await req.json();
    if (action !== 'unapprove-videos') {
      return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    }

    const result = await prisma.$executeRawUnsafe(
      `UPDATE "your_name_table" SET "Approved" = 'false'
       WHERE "company_id" = $1
       AND "Approved" IS NOT NULL AND "Approved"::text NOT IN ('false', 'False', '0')
       AND LOWER(COALESCE("format", '')) = 'video'`,
      companyId
    );

    return NextResponse.json({ success: true, rowsAffected: Number(result) });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to unapprove videos';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
