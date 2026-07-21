"use client";

import { useState } from "react";
import { useServices } from "@/context/ServicesContext";
import { EditorialPageHeader } from "@/components/editorial/editorial-layout";
import "./newsletter.css";

export default function ManageServices() {
  const { services, addService, removeService } = useServices();
  const [newService, setNewService] = useState("");
  const [error, setError] = useState("");

  const handleAdd = () => {
    const trimmed = newService.trim();
    if (!trimmed) return;
    if (services.includes(trimmed)) {
      setError("This service already exists.");
      return;
    }
    addService(trimmed);
    setNewService("");
    setError("");
  };

  return (
    <div className="nl-root">
      <EditorialPageHeader
        eyebrow="Newsletter"
        title="Manage Services"
        subtitle="Add or remove services — they appear in the newsletter generation selector."
        className="mb-10"
      />

      <div className="nl-grid nl-grid-2">
        <div>
          <h3 className="nl-section-title">Add Service</h3>
          <input
            type="text"
            value={newService}
            onChange={(e) => setNewService(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            placeholder="New service name"
            className="nl-input"
          />
          <button type="button" onClick={handleAdd} className="nl-btn-primary mt-5">
            + Add service
          </button>
          {error && <p className="mt-3 text-sm text-[#C1121F]">{error}</p>}
        </div>

        <div>
          <div className="nl-panel-header">
            <h3 className="nl-panel-title">Available Services</h3>
            <span className="nl-count-meta">{services.length} services</span>
          </div>

          {services.length === 0 ? (
            <div className="nl-chart-empty">No services yet</div>
          ) : (
            <div>
              {services.map((service) => (
                <div key={service} className="nl-svc-row">
                  <span className="nl-svc-name">{service}</span>
                  <button type="button" onClick={() => removeService(service)} className="nl-svc-remove">
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
