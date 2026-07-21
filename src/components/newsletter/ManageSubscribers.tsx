"use client";

import { useEffect, useState } from "react";
import { EditorialPageHeader } from "@/components/editorial/editorial-layout";
import "./newsletter.css";

type Subscriber = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  serviceType: string;
  status: string;
  emailStatus: string;
  createdAt: string;
};

type ParsedRow = {
  email: string;
  firstName: string;
  lastName: string;
  serviceType: string;
};

function parseBulkCsv(text: string): { rows: ParsedRow[]; skipped: number } {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const rows: ParsedRow[] = [];
  let skipped = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (i === 0 && /^email[\s,|]/i.test(line)) continue;

    const parts = line.includes("\t")
      ? line.split("\t")
      : line.split(",").map((part) => part.trim().replace(/^"|"$/g, ""));

    const [email = "", firstName = "", lastName = "", serviceType = ""] = parts;

    if (!email.includes("@")) {
      skipped += 1;
      continue;
    }

    rows.push({
      email,
      firstName,
      lastName,
      serviceType,
    });
  }

  return { rows, skipped };
}

export default function ManageSubscribers() {
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [serviceType, setServiceType] = useState("");
  const [bulkText, setBulkText] = useState("");
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [importing, setImporting] = useState(false);
  const [message, setMessage] = useState("");
  const [importMessage, setImportMessage] = useState("");

  const load = () => {
    setLoading(true);
    fetch("/api/newsletter/subscribers")
      .then((r) => r.json())
      .then((json) => {
        if (!json.error) setSubscribers(json.subscribers || []);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const handleAdd = async () => {
    if (!email.trim()) {
      setMessage("Enter an email address.");
      return;
    }
    setAdding(true);
    setMessage("");
    try {
      const res = await fetch("/api/newsletter/subscribers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, firstName, lastName, serviceType }),
      });
      const json = await res.json();
      if (!res.ok) {
        setMessage(json.error || "Failed to add subscriber");
        return;
      }
      setEmail("");
      setFirstName("");
      setLastName("");
      setServiceType("");
      setMessage("Subscriber added.");
      load();
    } catch {
      setMessage("Failed to add subscriber");
    } finally {
      setAdding(false);
    }
  };

  const handleBulkImport = async () => {
    const trimmed = bulkText.trim();
    if (!trimmed) {
      setImportMessage("Paste one or more CSV rows before importing.");
      return;
    }

    const { rows, skipped } = parseBulkCsv(trimmed);
    if (rows.length === 0) {
      setImportMessage(
        skipped > 0
          ? "No valid rows found. Use email,firstName,lastName,serviceType — one subscriber per line."
          : "Paste subscriber rows in CSV format — one line per person."
      );
      return;
    }

    setImporting(true);
    setImportMessage("");
    try {
      const res = await fetch("/api/newsletter/subscribers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscribers: rows }),
      });
      const json = await res.json();
      if (!res.ok) {
        setImportMessage(json.error || "Import failed");
        return;
      }

      setBulkText("");
      const imported = json.imported ?? rows.length;
      setImportMessage(
        skipped > 0
          ? `Imported ${imported} subscriber${imported === 1 ? "" : "s"} (${skipped} invalid row${skipped === 1 ? "" : "s"} skipped).`
          : `Imported ${imported} subscriber${imported === 1 ? "" : "s"}.`
      );
      load();
    } catch {
      setImportMessage("Import failed — check your connection and try again.");
    } finally {
      setImporting(false);
    }
  };

  const handleDelete = async (id: string) => {
    await fetch("/api/newsletter/subscribers", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    load();
  };

  return (
    <div className="nl-root">
      <EditorialPageHeader
        eyebrow="Newsletter"
        title="Subscribers"
        subtitle="Manage per-company newsletter subscribers."
        className="mb-10"
      />

      <div className="nl-grid nl-grid-2">
        <div>
          <h3 className="nl-section-title">Add Subscriber</h3>
          <input
            className="nl-input"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <div className="grid grid-cols-2 gap-5">
            <input
              className="nl-input"
              placeholder="First name"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
            />
            <input
              className="nl-input"
              placeholder="Last name"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
            />
          </div>
          <input
            className="nl-input"
            placeholder="Service type"
            value={serviceType}
            onChange={(e) => setServiceType(e.target.value)}
          />
          <button
            type="button"
            onClick={handleAdd}
            disabled={adding}
            className="nl-btn-primary mt-5"
          >
            {adding ? "Adding…" : "Add subscriber"}
          </button>
          {message && <p className="mt-3 text-sm text-[#4A5A64]">{message}</p>}

          <h3 className="nl-section-title mt-8">Bulk Import · CSV</h3>
          <p className="mb-3 text-[13px] leading-relaxed text-[#8C8474]">
            Paste many subscribers at once — one person per line, comma-separated:
            email, first name, last name, service type. You can include the header row; it will be skipped.
          </p>
          <textarea
            className="nl-textarea nl-textarea-box"
            rows={5}
            placeholder={"email,firstName,lastName,serviceType\ntenant@example.com,Jane,Doe,Tenant Reports"}
            value={bulkText}
            onChange={(e) => {
              setBulkText(e.target.value);
              if (importMessage) setImportMessage("");
            }}
          />
          <button
            type="button"
            onClick={handleBulkImport}
            disabled={importing || !bulkText.trim()}
            className="nl-btn-ghost mt-5"
          >
            {importing ? "Importing…" : "Import"}
          </button>
          {importMessage && (
            <p
              className={`mt-3 text-sm ${
                importMessage.startsWith("Imported") ? "text-[#4A5A64]" : "text-[#C1121F]"
              }`}
            >
              {importMessage}
            </p>
          )}
        </div>

        <div>
          <div className="nl-panel-header">
            <h3 className="nl-panel-title">Subscriber List</h3>
            <span className="nl-count-meta">{subscribers.length} subscribers</span>
          </div>

          <div className="min-h-[280px]">
            {loading ? (
              <div className="nl-chart-empty">Loading…</div>
            ) : subscribers.length === 0 ? (
              <div className="nl-chart-empty">No subscribers yet</div>
            ) : (
              <div>
                {subscribers.map((s) => (
                  <div key={s.id} className="nl-subscriber-row">
                    <div className="min-w-0">
                      <p className="truncate text-[15px] font-bold text-[var(--primary)]">{s.email}</p>
                      <p className="text-[13px] text-[#8C8474]">
                        {[s.firstName, s.lastName].filter(Boolean).join(" ") || "—"} · {s.status}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDelete(s.id)}
                      className="nl-svc-remove shrink-0"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
