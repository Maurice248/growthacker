"use client";

import { useEffect, useMemo, useState } from "react";
import { Activity, CheckCircle2, Share2, XCircle } from "lucide-react";
import { Badge, Card, MetricCard, SectionTitle, Spinner } from "./components";
import { useN8nWebhooks, n8nUrl } from "@/hooks/use-n8n-webhooks";
import { SOCIAL_N8N_WEBHOOK_FIELDS } from "@/lib/n8n-config";
import { socialSupabase } from "@/lib/socialSupabase";
import { SocialWorkflowEditor } from "@/components/social/SocialWorkflowEditor";

function pipelineStatusTone(status: string) {
  const value = status.toLowerCase();
  if (
    value.includes("success") ||
    value.includes("completed") ||
    value.includes("created successfully")
  ) {
    return {
      label: "Completed",
      color: "var(--green)",
      bg: "var(--green-light)",
    };
  }
  if (
    value.includes("error") ||
    value.includes("failed") ||
    value.includes("rejected")
  ) {
    return {
      label: "Needs attention",
      color: "var(--red)",
      bg: "var(--red-light)",
    };
  }
  if (
    value.includes("generating") ||
    value.includes("accepting") ||
    value.includes("regenerating") ||
    value.includes("posting") ||
    value.includes("waiting")
  ) {
    return {
      label: "In progress",
      color: "var(--primary)",
      bg: "var(--primary-light)",
    };
  }
  return {
    label: "Idle",
    color: "var(--text-muted)",
    bg: "var(--surface)",
  };
}

export default function SocialOverview() {
  const n8nWebhooks = useN8nWebhooks();
  const [pipelineStatus, setPipelineStatus] = useState("Loading...");
  const [supabaseConnected, setSupabaseConnected] = useState<boolean | null>(null);

  const workflows = useMemo(
    () =>
      SOCIAL_N8N_WEBHOOK_FIELDS.map((field) => {
        const configured = Boolean(n8nUrl(n8nWebhooks, field.key));
        return {
          key: field.key,
          label: field.label,
          description: field.description ?? "",
          configured,
        };
      }),
    [n8nWebhooks]
  );

  const configuredCount = workflows.filter((workflow) => workflow.configured).length;
  const pipelineTone = pipelineStatusTone(pipelineStatus);

  useEffect(() => {
    let active = true;

    const fetchStatus = async () => {
      try {
        const { data, error } = await socialSupabase
          .from("n8n")
          .select("status")
          .order("id", { ascending: false })
          .limit(1);

        if (!active) return;

        if (error) {
          setSupabaseConnected(false);
          setPipelineStatus("Status unavailable");
          return;
        }

        setSupabaseConnected(true);
        if (data && data.length > 0) {
          setPipelineStatus(data[0].status || "Waiting for data...");
        } else {
          setPipelineStatus("Waiting for data...");
        }
      } catch {
        if (!active) return;
        setSupabaseConnected(false);
        setPipelineStatus("Connection error");
      }
    };

    fetchStatus();

    const channel = socialSupabase
      .channel("social-overview-status")
      .on("postgres_changes", { event: "*", schema: "public", table: "n8n" }, (payload: any) => {
        if (payload.new?.status) setPipelineStatus(payload.new.status);
      })
      .subscribe();

    return () => {
      active = false;
      socialSupabase.removeChannel(channel);
    };
  }, []);

  return (
    <div className="animate-fade-in" style={{ paddingBottom: 40 }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 24 }}>
        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: 14,
            background: "var(--primary-light)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <Share2 size={24} color="var(--primary)" />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: "var(--text)", margin: 0, lineHeight: 1.3 }}>
            Social Channels Overview
          </h1>
          <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "4px 0 0 0" }}>
            Monitor workflow status, edit schedule and AI agent prompts, and track the live Creator Studio pipeline.
          </p>
        </div>
      </div>

      <div
        className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4"
        style={{ marginBottom: 24 }}
      >
        <MetricCard
          label="Workflows ready"
          value={`${configuredCount}/${workflows.length}`}
          sub={configuredCount === workflows.length ? "All webhooks configured" : "Some webhooks missing"}
          color={configuredCount === workflows.length ? "var(--green)" : "var(--amber)"}
          bg={configuredCount === workflows.length ? "var(--green-light)" : "var(--amber-light)"}
        />
        <MetricCard
          label="Live data feed"
          value={supabaseConnected === null ? "…" : supabaseConnected ? "Connected" : "Offline"}
          sub="Social Supabase status table"
          color={supabaseConnected ? "var(--green)" : "var(--red)"}
          bg={supabaseConnected ? "var(--green-light)" : "var(--red-light)"}
        />
        <MetricCard
          label="Pipeline state"
          value={pipelineTone.label}
          sub={pipelineStatus}
          color={pipelineTone.color}
          bg={pipelineTone.bg}
        />
      </div>

      <div className="flex flex-col items-center gap-4">
        <Card
          className="w-full lg:w-[55%]"
          style={{
            padding: "20px 24px",
            background: "linear-gradient(135deg, #f8fafc, #eff6ff)",
            border: "1px solid #bfdbfe",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <Activity size={16} color="var(--primary)" />
            <SectionTitle style={{ margin: 0, color: "var(--primary)" }}>Live Pipeline Status</SectionTitle>
          </div>

          <div
            style={{
              background: "#fff",
              border: "1px solid var(--border-light)",
              borderRadius: "var(--radius-md)",
              padding: "16px",
            }}
          >
            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 8 }}>
              Current status
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                fontSize: 15,
                fontWeight: 700,
                color: pipelineTone.color,
                marginBottom: 12,
              }}
            >
              {pipelineTone.label === "In progress" && <Spinner size={14} color="var(--primary)" />}
              {pipelineStatus}
            </div>
            <div style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.6 }}>
              This updates in real time from the Social Channels Supabase `n8n` table while Creator Studio
              runs image or video workflows.
            </div>
          </div>

          {configuredCount < workflows.length && (
            <div
              style={{
                marginTop: 16,
                padding: "12px 14px",
                borderRadius: "var(--radius-md)",
                background: "var(--amber-light)",
                border: "1px solid #fde68a",
                fontSize: 12,
                color: "#92400e",
                lineHeight: 1.5,
              }}
            >
              {workflows.length - configuredCount} workflow
              {workflows.length - configuredCount === 1 ? "" : "s"} still need webhook URLs in Settings
              before they can run.
            </div>
          )}
        </Card>

        <Card className="w-full lg:w-[55%]" style={{ padding: "20px 24px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <SectionTitle style={{ margin: 0 }}>Automation Workflows</SectionTitle>
            <Badge
              text={`${configuredCount} working`}
              color={configuredCount > 0 ? "var(--green)" : "var(--amber)"}
              bg={configuredCount > 0 ? "var(--green-light)" : "var(--amber-light)"}
            />
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {workflows.map((workflow) => (
              <div
                key={workflow.key}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 12,
                  padding: "14px 16px",
                  borderRadius: "var(--radius-md)",
                  border: "1px solid var(--border-light)",
                  background: workflow.configured ? "#f8fafc" : "#fff",
                }}
              >
                <div style={{ marginTop: 2, flexShrink: 0 }}>
                  {workflow.configured ? (
                    <CheckCircle2 size={18} color="var(--green)" />
                  ) : (
                    <XCircle size={18} color="var(--amber)" />
                  )}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 12,
                      flexWrap: "wrap",
                      marginBottom: 4,
                    }}
                  >
                    <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text)" }}>
                      {workflow.label}
                    </div>
                    <Badge
                      text={workflow.configured ? "Ready" : "Not configured"}
                      color={workflow.configured ? "var(--green)" : "var(--amber)"}
                      bg={workflow.configured ? "var(--green-light)" : "var(--amber-light)"}
                    />
                  </div>
                  <div style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.5 }}>
                    {workflow.description}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div style={{ marginTop: 32 }}>
        <SectionTitle style={{ marginBottom: 16 }}>Workflow Node Editor</SectionTitle>
        <SocialWorkflowEditor />
      </div>
    </div>
  );
}
