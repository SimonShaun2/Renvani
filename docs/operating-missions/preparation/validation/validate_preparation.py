#!/usr/bin/env python3
"""Validate cross-file preparation consistency, never application behavior.

Uses only local files and the standard library. It does not import Renvani
runtime modules, contact providers, run a model or claim a production pass.
"""
from __future__ import annotations

import json
import re
from pathlib import Path
from urllib.parse import unquote, urlsplit

ROOT = Path(__file__).resolve().parents[1]
REPO = ROOT.parents[2]
BASE = "7840884d346ca95788e2668cc78148afa3b6a843"
MISSIONS = {
    "more_bookings", "monthly_revenue", "average_job_value",
    "repeat_business", "faster_payment", "organize_business",
}
METHODS = {
    "search_acquisition.v1", "inquiry_conversion.v1", "estimate_recovery.v1",
    "service_options.v1", "due_service.v1", "agreement_renewal.v1",
    "agreement_enrollment.v1", "invoice_readiness.v1",
    "collection_followup.v1", "operations_review.v1",
    "schedule_correction.v1", "material_readiness.v1", "revenue_portfolio.v1",
}
CORE = {f"OM-A{i:02}" for i in range(1, 35)}
OPTIONAL = {f"OM-R-A{i:02}" for i in range(1, 7)}
DECISIONS = {f"OM-D{i:02}" for i in range(1, 14)}
PACKAGES = {f"OM-{i:02}" for i in range(1, 14)}
DOCS = [
    "01-ticket-crosswalk.md", "02-mission-catalog.md",
    "03-metrics-and-accounting.md", "04-source-map.md",
    "05-authority-lifecycle-contracts.md", "06-acceptance-and-codex-handoff.md",
    "07-organize-detectors.md", "08-specialist-evaluation-and-cost.md",
    "09-command-center-content.md", "10-external-acquisition.md",
    "README.md", "SOURCES.md", "DECISIONS.md",
]


def require(condition, message):
    if not condition:
        raise ValueError(message)


def no_duplicate_keys(pairs):
    result = {}
    for key, value in pairs:
        require(key not in result, f"Duplicate JSON object key: {key}")
        result[key] = value
    return result


def walk(value):
    yield value
    if isinstance(value, dict):
        for item in value.values():
            yield from walk(item)
    elif isinstance(value, list):
        for item in value:
            yield from walk(item)


def unique(rows, key, label):
    values = [row[key] for row in rows]
    require(len(values) == len(set(values)), f"Duplicate {label} IDs")
    return set(values)


def acyclic(graph, label):
    visiting, done = set(), set()

    def visit(node):
        require(node not in visiting, f"{label} cycle at {node}")
        if node in done:
            return
        visiting.add(node)
        for other in graph[node]:
            require(other in graph, f"Unknown {label} dependency: {other}")
            visit(other)
        visiting.remove(node)
        done.add(node)

    for node in graph:
        visit(node)


def existing_source(path):
    require(isinstance(path, str), "Source path must be a string")
    resolved = (REPO / path).resolve()
    require(resolved.is_relative_to(REPO), f"Source escaped repository: {path}")
    require(resolved.exists(), f"Missing existing source path: {path}")


def main():
    for name in DOCS:
        require((ROOT / name).is_file(), f"Missing deliverable: {name}")
    files = sorted(ROOT.rglob("*.json"))
    data = {
        str(path.relative_to(ROOT)): json.loads(
            path.read_text(), object_pairs_hook=no_duplicate_keys
        )
        for path in files
    }
    required_json = {
        "ticket-crosswalk.json", "mission-catalog.json", "source-map.json",
        "contracts.json", "command-center-states.json", "external-acquisition.json",
        "compute-policy.json", "fixtures/accounting-examples.json",
        "fixtures/acceptance-cases.json", "fixtures/detector-examples.json",
        "fixtures/specialist-examples.json",
    }
    require(required_json <= data.keys(), "Missing required JSON companion")
    for name, document in data.items():
        if "baseCommit" in document:
            require(document["baseCommit"] == BASE, f"Unexpected baseline in {name}")
        for value in walk(document):
            if not isinstance(value, str):
                continue
            for decision in re.findall(r"\bOM-D\d{2}\b", value):
                require(decision in DECISIONS, f"Unknown decision {decision} in {name}")
            for acceptance in re.findall(r"\bOM-(?:R-)?A\d{2}\b", value):
                require(acceptance in CORE | OPTIONAL, f"Unknown criterion {acceptance} in {name}")
            if value.startswith(f"https://github.com/SimonShaun2/Renvani/blob/{BASE}/"):
                source = unquote(urlsplit(value).path).split(f"/blob/{BASE}/", 1)[1]
                existing_source(source)

    cross = data["ticket-crosswalk.json"]
    require(unique(cross["workPackages"], "id", "package") == PACKAGES, "Core package coverage changed")
    require(unique(cross["coreAcceptance"], "id", "core criterion") == CORE, "Core acceptance coverage changed")
    require(unique(cross["optionalAcceptance"], "id", "optional criterion") == OPTIONAL, "Optional coverage changed")
    require(unique(cross["tickets"], "id", "ticket") == {"FS-257", "FS-258"} | {f"FS-{i}" for i in range(262, 270)}, "Existing ticket set changed")
    require(all(p["implementationStatus"] == "not_started" for p in cross["workPackages"]), "Prep cannot claim package implementation")
    require(all(a["executionStatus"] == "not_executed" for a in cross["coreAcceptance"] + cross["optionalAcceptance"]), "Prep cannot claim runtime acceptance")
    acyclic({p["id"]: [e["packageId"] for e in p["dependencies"]] for p in cross["workPackages"]}, "package")

    catalog = data["mission-catalog.json"]
    require(unique(catalog["missions"], "missionType", "mission") == MISSIONS, "Six mission IDs changed")
    require(unique(catalog["methods"], "methodId", "method") == METHODS, "Thirteen method IDs changed")
    require(catalog["runtimeImportAllowed"] is False and catalog["productionContractExport"] is False, "Catalog must stay preparation-only")
    for mission in catalog["missions"]:
        require(set(mission["allowedMethodVersions"]) <= METHODS, "Unknown mission method")
        require(mission["readiness"]["executable"] is False, "A prep mission cannot be executable")
    for method in catalog["methods"]:
        require(set(method["supportedMissions"]) <= MISSIONS, "Unknown supported mission")
        require(method["readiness"]["executable"] is False, "A prep method cannot be executable")
    acyclic({m["methodId"]: [e["methodId"] for e in m["proposedDependencies"]] for m in catalog["methods"]}, "method")
    faster = next(m for m in catalog["missions"] if m["missionType"] == "faster_payment")
    require(faster["primaryMetricId"] is None, "Unresolved faster-payment primary metric cannot be invented")
    for source in catalog["sourceEvidence"]:
        existing_source(source["path"])

    ui = data["command-center-states.json"]
    require(unique(ui["cards"], "missionType", "UI mission") == MISSIONS, "UI mission coverage changed")
    labels = {m["missionType"]: m["label"] for m in catalog["missions"]}
    require(all(labels[c["missionType"]] == c["label"] for c in ui["cards"]), "UI/catalog labels differ")
    require(len(unique(ui["states"], "caseId", "UI case")) == 20, "UI example coverage changed")
    require(ui["designEvidence"]["newMissionFrames"] == [] and ui["designEvidence"]["parityVerdict"] == "NOT_VERIFIED", "Prep cannot invent exact new frame acceptance")

    source = data["source-map.json"]
    required_fields = set(source["snapshotFieldsRequired"])
    covered = {field.split(".", 1)[0] for row in source["fields"] for field in row["snapshotFields"]}
    require(len(required_fields) == 17 and required_fields <= covered, "Snapshot field coverage incomplete")
    require(len(unique(source["fields"], "id", "source group")) == 20, "Source group coverage changed")
    for row in source["fields"]:
        require(row["runtimeAcceptance"] == "not_executed", "Source presence is not runtime evidence")
        for ref in row["sourceRefs"]:
            existing_source(ref["path"])

    contracts = data["contracts.json"]
    require(len(contracts["endpoints"]) == 13, "API review operation coverage changed")
    require(len(unique(contracts["authorityCases"], "caseId", "authority case")) == 12, "Authority case coverage changed")
    require(len(unique(contracts["lifecycleCases"], "caseId", "lifecycle case")) == 15, "Lifecycle case coverage changed")
    require(set(contracts["outcomeVerdicts"]) == {"pending", "target_met", "target_not_met", "not_evaluable"}, "Outcome verdict vocabulary changed")

    finance = data["fixtures/accounting-examples.json"]
    financial_ids = unique(finance["scenarios"], "id", "financial case")
    require(finance["containsRealCustomerData"] is False and finance["runtimeAcceptance"] == "not_executed", "Financial packet must remain synthetic")
    for value in walk(finance):
        if isinstance(value, dict) and "outcome_verdict" in value:
            require(value["outcome_verdict"] in contracts["outcomeVerdicts"], "Accounting verdict differs from shared contract")

    acceptance = data["fixtures/acceptance-cases.json"]
    require(unique(acceptance["coreCases"], "criterionId", "core case criterion") == CORE, "Acceptance case core coverage incomplete")
    require(unique(acceptance["optionalCases"], "criterionId", "optional case criterion") == OPTIONAL, "Conditional case coverage incomplete")
    source_criteria = {r["id"]: r["requirement"] for r in cross["coreAcceptance"] + cross["optionalAcceptance"]}
    all_package_ids = PACKAGES | {p["id"] for p in cross["optionalPackages"]}
    ticket_ids = {t["id"] for t in cross["tickets"]}
    all_cases = acceptance["coreCases"] + acceptance["optionalCases"]
    case_ids = unique(all_cases, "caseId", "acceptance case")
    for case in all_cases:
        require(case["criterionText"] == source_criteria[case["criterionId"]], f"Criterion text drift: {case['caseId']}")
        require(case["caseStatus"] == "prepared" and case["runtimeStatus"] == "not_executed", f"Unsupported execution claim: {case['caseId']}")
        require(bool(case["packageIds"]) and set(case["packageIds"]) <= all_package_ids, f"Unknown package anchor: {case['caseId']}")
        require(bool(case["ticketAnchorIds"]) and set(case["ticketAnchorIds"]) <= ticket_ids, f"Unknown ticket anchor: {case['caseId']}")
        for key in ["setup", "action", "expectedResults", "evidenceRequired", "sourcePaths"]:
            require(bool(case[key]), f"Empty {key}: {case['caseId']}")
        for path in case["sourcePaths"]:
            existing_source(path)
        require(set(case["financialFixtureIds"]) <= financial_ids, f"Unknown financial example: {case['caseId']}")
        for ref in case["fixtureRefs"]:
            require((ROOT / ref["path"]).is_file(), f"Missing referenced fixture: {case['caseId']}")
            if ref["path"] == "fixtures/accounting-examples.json":
                require(ref["scenarioId"] in financial_ids, f"Unknown financial scenario: {case['caseId']}")
    handoffs = acceptance["codexPatchSequence"]
    unique(handoffs, "id", "Codex handoff")
    acyclic({h["id"]: h["dependencies"] for h in handoffs}, "handoff")
    for handoff in handoffs:
        require(handoff["packageId"] in all_package_ids and set(handoff["caseIds"]) <= case_ids, "Invalid Codex handoff reference")

    detector = data["fixtures/detector-examples.json"]
    specialist = data["fixtures/specialist-examples.json"]
    for document, prefix in [(detector, "OM-DET-"), (specialist, "OM-SP-")]:
        unique(document["examples"], "id", prefix)
        for example in document["examples"]:
            require(example["id"].startswith(prefix) and bool(example["inputs"]) and bool(example["expected"]), "Incomplete concrete example")
            require(example["status"] == "prepared_not_executed", "Synthetic example cannot claim runtime pass")
            require(set(example["acceptanceIds"]) <= CORE, "Example references unknown acceptance")
    areas = {"unfinished_work", "scheduling_and_job_readiness", "inventory_and_materials", "relevant_product_and_service_opportunities"}
    detector_ids = unique(detector["detectors"], "id", "detector rule")
    detector_areas = {d["id"]: d["area"] for d in detector["detectors"]}
    require(set(detector_areas.values()) == areas, "Detector rule area definitions changed")
    for rule in detector["detectors"]:
        require(set(rule["methodIds"]) <= METHODS, f"Unknown detector method: {rule['id']}")
    require({e["area"] for e in detector["examples"]} == areas, "Organize four-area coverage incomplete")
    for example in detector["examples"]:
        require(example["detectorId"] in detector_ids, f"Unknown detector reference: {example['id']}")
        require(detector_areas[example["detectorId"]] == example["area"], f"Detector/area mismatch: {example['id']}")
    for area in areas:
        scenarios = {e["scenario"] for e in detector["examples"] if e["area"] == area}
        require({"positive", "negative", "stale", "duplicate", "reopen", "resolution"} <= scenarios, f"Incomplete scenario coverage: {area}")
    capability_groups = {
        "growth.evidence_and_draft.v1": "Growth",
        "revenue.reply_and_options.v1": "Revenue",
        "operations.notes_and_findings.v1": "Operations",
        "retention.due_and_renewal.v1": "Retention",
    }
    require(unique(specialist["capabilityDefinitions"], "id", "specialist capability") == set(capability_groups), "Four exact specialist capability definitions required")
    require({c["id"]: c["group"] for c in specialist["capabilityDefinitions"]} == capability_groups, "Specialist capability group mismatch")
    for example in specialist["examples"]:
        require(example["capabilityId"] in capability_groups, f"Unknown specialist capability: {example['id']}")
    policy = data["compute-policy.json"]
    require(policy["status"] == "proposed_not_enforced" and policy["runtimeImportAllowed"] is False and policy["activation"] == "not_authorized", "Proposed compute policy cannot be activated")

    external = data["external-acquisition.json"]
    require(len(unique(external["gates"], "gateId", "external gate")) == 13, "Acquisition gate coverage changed")
    require(len(unique(external["cases"], "caseId", "external case")) == 15, "Acquisition case coverage changed")
    require(len(set(external["requiredLineageFields"])) == 19, "Lineage coverage changed")
    require(external["realAccountReadiness"] == "not_verified", "Public docs cannot prove real account readiness")

    links_checked = 0
    for name in DOCS:
        text = (ROOT / name).read_text()
        for link in re.findall(r"\]\(([^)\s]+)\)", text):
            if "://" in link or link.startswith("#"):
                continue
            target = link.split("#", 1)[0]
            if target:
                require((ROOT / target).exists(), f"Missing relative link in {name}: {target}")
                links_checked += 1
    print(json.dumps({
        "status": "passed",
        "scope": "preparation_structure_and_references_only",
        "json_files": len(files), "documents": len(DOCS),
        "missions": len(MISSIONS), "methods": len(METHODS),
        "core_packages": len(PACKAGES), "core_acceptance_cases": len(CORE),
        "conditional_render_cases": len(OPTIONAL),
        "financial_scenarios": len(financial_ids),
        "detector_examples": len(detector["examples"]),
        "specialist_examples": len(specialist["examples"]),
        "relative_document_links_checked": links_checked,
        "production_behavior_tested": False,
        "runtime_acceptance": "not_executed",
    }, indent=2))


if __name__ == "__main__":
    main()
