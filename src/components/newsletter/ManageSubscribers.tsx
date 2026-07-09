"use client";

import { useEffect, useState } from "react";
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

export default function ManageSubscribers() {
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [serviceType, setServiceType] = useState("");
  const [bulkText, setBulkText] = useState("");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

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
    if (!email.trim()) return;
    setMessage("");
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
    load();
  };

  const handleBulkImport = async () => {
    const lines = bulkText
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    if (!lines.length) return;

    const rows = lines.map((line) => {
      const [em, fn = "", ln = "", st = ""] = line.split(",").map((p) => p.trim());
      return { email: em, firstName: fn, lastName: ln, serviceType: st };
    });

    const res = await fetch("/api/newsletter/subscribers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subscribers: rows }),
    });
    const json = await res.json();
    if (!res.ok) {
      setMessage(json.error || "Import failed");
      return;
    }
    setBulkText("");
    setMessage(`Imported ${json.imported ?? 0} subscribers`);
    load();
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
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Subscribers</h1>
        <p className="mt-1 text-gray-500">Manage per-company newsletter subscribers.</p>
      </div>

      <div className="nl-grid nl-grid-2">
        <div className="nl-panel nl-panel-body flex flex-col gap-4">
          <h3 className="nl-panel-title">Add Subscriber</h3>
          <input className="nl-input" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <div className="grid grid-cols-2 gap-3">
            <input className="nl-input" placeholder="First name" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
            <input className="nl-input" placeholder="Last name" value={lastName} onChange={(e) => setLastName(e.target.value)} />
          </div>
          <input className="nl-input" placeholder="Service type" value={serviceType} onChange={(e) => setServiceType(e.target.value)} />
          <button onClick={handleAdd} className="nl-btn-primary">Add Subscriber</button>

          <h3 className="nl-panel-title mt-4">Bulk Import (CSV)</h3>
          <textarea
            className="nl-textarea"
            rows={5}
            placeholder="email,firstName,lastName,serviceType"
            value={bulkText}
            onChange={(e) => setBulkText(e.target.value)}
          />
          <button onClick={handleBulkImport} className="nl-btn-primary">Import</button>
          {message && <p className="text-sm text-gray-600">{message}</p>}
        </div>

        <div className="nl-panel flex flex-col min-h-[400px]">
          <div className="nl-panel-header">
            <h3 className="nl-panel-title">Subscriber List</h3>
            <span className="nl-count-badge">{subscribers.length}</span>
          </div>
          <div className="flex-1 p-4 overflow-y-auto">
            {loading ? (
              <p className="text-gray-500 text-sm">Loading...</p>
            ) : subscribers.length === 0 ? (
              <p className="text-gray-400 text-sm">No subscribers yet.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {subscribers.map((s) => (
                  <div key={s.id} className="flex items-center justify-between border border-gray-100 rounded-lg px-3 py-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{s.email}</p>
                      <p className="text-xs text-gray-500">
                        {[s.firstName, s.lastName].filter(Boolean).join(" ") || "—"} · {s.status}
                      </p>
                    </div>
                    <button onClick={() => handleDelete(s.id)} className="text-xs text-red-600 font-bold uppercase">
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
