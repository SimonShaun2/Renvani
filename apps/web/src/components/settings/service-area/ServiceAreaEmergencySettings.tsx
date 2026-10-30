"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

import {
  useEmergencyService,
  useServiceArea,
  useUpdateEmergencyService,
  useUpdateServiceArea
} from "@/src/hooks/home-services.hooks";

import { DEFAULT_RADIUS_MILES, RADIUS_STEP, SERVICE_AREA_COPY as COPY } from "./service-area.config";
import { addZip, buildEmergencyPayload, buildServiceAreaPayload, clampRadius, normalizeZipInput } from "./service-area.utils";

/** Settings / Service area & emergency (Figma 309:3613: on 309:3614, off 309:3671, invalid ZIP 309:3729). */
export function ServiceAreaEmergencySettings({ companyName }: { companyName?: string | undefined }) {
  const areaQuery = useServiceArea();
  const emergencyQuery = useEmergencyService();
  const updateArea = useUpdateServiceArea();
  const updateEmergency = useUpdateEmergencyService();

  const saved = areaQuery.data?.serviceArea;
  const savedEmergency = emergencyQuery.data?.emergencyService;

  const [zips, setZips] = useState<string[]>([]);
  const [radius, setRadius] = useState<number>(DEFAULT_RADIUS_MILES);
  const [enabled, setEnabled] = useState(false);
  const [draftZip, setDraftZip] = useState("");
  const [zipError, setZipError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (hydrated || !saved || !savedEmergency) return;
    setZips(saved.zips);
    setRadius(saved.radiusMiles ?? DEFAULT_RADIUS_MILES);
    setEnabled(savedEmergency.enabled);
    setHydrated(true);
  }, [hydrated, saved, savedEmergency]);

  const areaDirty =
    hydrated && (zips.join(",") !== (saved?.zips ?? []).join(",") || radius !== (saved?.radiusMiles ?? DEFAULT_RADIUS_MILES));
  const emergencyDirty = hydrated && enabled !== (savedEmergency?.enabled ?? false);
  const canSave = !saving && !zipError && (areaDirty || emergencyDirty || saveError);

  function onAddZip() {
    const zip = normalizeZipInput(draftZip);
    if (!zip) {
      setZipError(true);
      return;
    }
    setZips((current) => addZip(current, zip));
    setDraftZip("");
    setZipError(false);
  }

  async function save() {
    if (!canSave && !saveError) return;
    setSaving(true);
    setSaveError(false);
    try {
      if (areaDirty || saveError) await updateArea.mutateAsync(buildServiceAreaPayload(zips, radius));
      if (emergencyDirty || saveError) {
        await updateEmergency.mutateAsync(buildEmergencyPayload(enabled, savedEmergency?.hoursText ?? null));
      }
      setHydrated(false);
    } catch {
      setSaveError(true);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-5" data-testid="service-area-settings" data-emergency={enabled ? "on" : "off"}>
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-[28px] font-semibold text-[#0f1530]">{COPY.pageTitle}</h1>
          {companyName ? <p className="mt-1 text-[13px] text-[#5e6684]">{companyName}</p> : null}
        </div>
        <button
          type="button"
          data-testid="service-area-save"
          disabled={!canSave}
          onClick={() => void save()}
          className={
            canSave
              ? "rounded-[10px] bg-[#f6b400] px-4 py-2.5 text-sm font-semibold text-[#0f1530]"
              : "inline-flex items-center gap-2 rounded-[10px] bg-[#eef0f5] px-4 py-2.5 text-sm font-semibold text-[#9aa0b4]"
          }
        >
          {saving ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              {COPY.saving}
            </>
          ) : (
            COPY.save
          )}
        </button>
      </header>

      {saveError ? (
        <div role="alert" className="flex items-center justify-between gap-3 rounded-[10px] bg-[#fbe3dc] px-4 py-3 text-[13px] text-[#b42318]">
          <span>{COPY.saveError}</span>
          <button type="button" onClick={() => void save()} className="rounded-[8px] border border-[#e6dccb] bg-white px-3 py-1.5 font-semibold text-[#0f1530]">
            {COPY.retry}
          </button>
        </div>
      ) : null}

      <section className="rounded-[14px] border border-[#e6dccb] bg-white p-6">
        <h2 className="text-[17px] font-semibold text-[#0f1530]">{COPY.areaTitle}</h2>
        <p className="mt-1 text-[13px] text-[#5e6684]">{COPY.areaBody}</p>
        <ul className="mt-4 flex flex-wrap gap-2" aria-label="Service ZIP codes">
          {zips.map((zip) => (
            <li key={zip} className="inline-flex items-center gap-2 rounded-[8px] bg-[#f3eadc] px-2.5 py-1 font-mono text-[12px] text-[#0f1530]">
              {zip}
              <button type="button" aria-label={COPY.remove(zip)} disabled={saving} onClick={() => setZips((c) => c.filter((z) => z !== zip))}>
                ✕
              </button>
            </li>
          ))}
        </ul>
        <div className="mt-4 flex max-w-[420px] flex-col gap-1.5">
          <div className="flex gap-2">
            <input
              aria-label={COPY.addPlaceholder}
              placeholder={COPY.addPlaceholder}
              inputMode="numeric"
              value={draftZip}
              aria-invalid={zipError}
              disabled={saving}
              onChange={(event) => {
                setDraftZip(event.target.value);
                setZipError(false);
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  onAddZip();
                }
              }}
              className={`flex-1 rounded-[10px] border bg-white px-3 py-2.5 text-[14px] ${zipError ? "border-[#b42318]" : "border-[#e6dccb]"}`}
            />
            <button type="button" onClick={onAddZip} disabled={saving} className="rounded-[10px] border border-[#e6dccb] bg-white px-3 py-2 text-[13px] font-semibold text-[#0f1530]">
              {COPY.add}
            </button>
          </div>
          {zipError ? <span className="text-[12px] text-[#b42318]">{COPY.invalidZip}</span> : null}
        </div>
        <div className="mt-5 flex flex-col gap-2">
          <span className="text-[13px] text-[#2a3360]">{COPY.radiusLabel(zips[0])}</span>
          <div className="inline-flex w-fit items-center gap-3 rounded-[10px] border border-[#e6dccb] px-3 py-1.5">
            <button type="button" aria-label="Decrease radius" disabled={saving} onClick={() => setRadius((r) => clampRadius(r - RADIUS_STEP))}>
              −
            </button>
            <span data-testid="radius" className="text-[14px] font-semibold text-[#0f1530]">{COPY.miles(radius)}</span>
            <button type="button" aria-label="Increase radius" disabled={saving} onClick={() => setRadius((r) => clampRadius(r + RADIUS_STEP))}>
              +
            </button>
          </div>
        </div>
      </section>

      <section className="flex items-start justify-between gap-4 rounded-[14px] border border-[#e6dccb] bg-white p-6">
        <div>
          <h2 className="text-[17px] font-semibold text-[#0f1530]">{COPY.emergencyTitle}</h2>
          <p className="mt-1 text-[13px] text-[#5e6684]">{enabled ? COPY.emergencyOnHelp : COPY.emergencyOffHelp}</p>
        </div>
        <label className="flex items-center gap-2 text-[13px] text-[#2a3360]">
          <span>{enabled ? COPY.on : COPY.off}</span>
          <input
            type="checkbox"
            role="switch"
            aria-label={COPY.emergencyTitle}
            checked={enabled}
            disabled={saving}
            onChange={(event) => setEnabled(event.target.checked)}
            className="h-4 w-8 accent-[#f6b400]"
          />
        </label>
      </section>
    </div>
  );
}
