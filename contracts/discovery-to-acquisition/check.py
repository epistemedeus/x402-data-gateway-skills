#!/usr/bin/env python3
"""Check one skill's discovery-to-acquisition contract against the pinned Hermes producer.

Set HERMES_AGENT_SOURCE to a checkout of the contract's hermesCommit.
The process does not search the network, construct GitHub auth, or install a skill.
"""

from __future__ import annotations

import ast
import importlib.util
import json
import os
import re
import subprocess
import sys
from pathlib import Path


HERE = Path(__file__).resolve().parent
REPO = HERE.parents[1]
QUERIES_COMPETING = "task distribution"


def fail(message: str) -> None:
    print(f"FAIL {message}", file=sys.stderr)
    raise SystemExit(1)


def load_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def producer_source_order(hermes: Path) -> dict:
    text = (hermes / "scripts/build_skills_index.py").read_text(encoding="utf-8")
    match = re.search(r"source_order = (\{[^{}]+\})", text)
    if not match:
        fail("scripts/build_skills_index.py has no source_order")
    return ast.literal_eval(match.group(1))


def router_source_ids(search_py: Path) -> list[str]:
    text = search_py.read_text(encoding="utf-8")
    body = text.split("def create_source_router", 1)[1].split("\ndef ", 1)[0]
    names = re.findall(
        r"\b(OptionalSkillSource|HermesIndexSource|SkillsShSource|WellKnownSkillSource|"
        r"UrlSource|GitHubSource|ClawHubSource|LobeHubSource|BrowseShSource)\(",
        body,
    )
    from tools.skills_hub_clawhub import ClawHubSource
    from tools.skills_hub_github import GitHubSource
    from tools.skills_hub_official import HermesIndexSource, OptionalSkillSource
    from tools.skills_hub_skillssh import SkillsShSource
    from tools.skills_hub_sources import BrowseShSource, LobeHubSource, UrlSource, WellKnownSkillSource

    by_name = {
        "OptionalSkillSource": OptionalSkillSource,
        "HermesIndexSource": HermesIndexSource,
        "SkillsShSource": SkillsShSource,
        "WellKnownSkillSource": WellKnownSkillSource,
        "UrlSource": UrlSource,
        "GitHubSource": GitHubSource,
        "ClawHubSource": ClawHubSource,
        "LobeHubSource": LobeHubSource,
        "BrowseShSource": BrowseShSource,
    }
    if names != list(by_name):
        fail(f"create_source_router order changed: {names}")
    return [by_name[name].SOURCE_ID for name in names]


class _Source:
    def __init__(self, source_id: str, available: bool = False):
        self._source_id = source_id
        self.is_available = available

    def source_id(self) -> str:
        return self._source_id


def blank_entry(item: dict) -> dict:
    return {
        "name": item["name"],
        "description": item["description"],
        "source": item["source"],
        "identifier": item["identifier"],
        "trust_level": item["trust_level"],
        "repo": "",
        "path": "",
        "tags": [],
        "extra": {},
    }


def sort_index(entries: list[dict], source_order: dict) -> list[dict]:
    return sorted(entries, key=lambda entry: (source_order.get(entry["source"], 99), entry["name"]))


def rank_queries(hermes_search, entries: list[dict], queries: list[str]) -> dict[str, list[str]]:
    from tools.skills_hub_official import HermesIndexSource

    index = HermesIndexSource(auth=None)
    index._loaded = True
    index._index = {"skills": entries}

    def offline_parallel(sources, query="", per_source_limits=None, source_filter="all", overall_timeout=30, on_source_done=None):
        limit = (per_source_limits or {}).get("hermes-index", 50)
        found = index.search(query, limit=limit)
        return found, {"hermes-index": len(found)}, []

    original = hermes_search.parallel_search_sources
    hermes_search.parallel_search_sources = offline_parallel
    try:
        ranked = {}
        for query in queries:
            rows = hermes_search.unified_search(query, [index], limit=10)
            ranked[query] = [row.identifier for row in rows]
        return ranked
    finally:
        hermes_search.parallel_search_sources = original


def claim_errors(receipt: dict, claim: dict, our_identifiers: set[str]) -> list[str]:
    errors = []
    rows = receipt["received"]["rows"]
    selected = False
    for row in rows:
        identifiers = [item.get("identifier", "") for item in row.get("results", [])[:10]]
        present = any(identifier in our_identifiers for identifier in identifiers)
        selected = selected or present
        if row.get("ourSkillInFirst10") and not present:
            errors.append(f"{row.get('query')}: first10 flag without our identifier")
        if present and not row.get("ourSkillInFirst10"):
            errors.append(f"{row.get('query')}: our identifier in first10 was not flagged")
    if claim.get("taskFirstSelected") and not selected:
        errors.append("task-first success claimed while the receipt misses the first10")
    if claim.get("taskFirstSelected") is False and selected:
        errors.append("task-first miss claimed while the receipt selects us")
    route = claim.get("defaultDiscovery")
    if route in {"github-tap", "known-github-url", "well-known-url", "direct-url"}:
        errors.append(f"{route} is not default task-first discovery")
    if claim.get("paymentSent"):
        errors.append("payment is a separate observation")
    if claim.get("usefulnessIsSelection"):
        errors.append("caller usefulness is a separate observation")
    if claim.get("trustLevel") not in (None, "community"):
        errors.append("trust was not upgraded")
    return errors


def main() -> None:
    hermes = Path(os.environ.get("HERMES_AGENT_SOURCE", "")).resolve() if os.environ.get("HERMES_AGENT_SOURCE") else None
    if hermes is None or not (hermes / "tools/skills_hub_search.py").is_file():
        fail("HERMES_AGENT_SOURCE must be the pinned NousResearch/hermes-agent checkout")
    sys.path.insert(0, str(hermes))

    contract = load_json(HERE / "contract.json")
    submission = load_json(HERE / contract["submission"])
    listing = load_json(HERE / contract["listingFixture"])
    receipt = load_json(HERE / contract["receiptFixture"])
    registry = load_json(HERE / contract["registryPathsFixture"])
    head = subprocess.check_output(["git", "-C", str(hermes), "rev-parse", "HEAD"], text=True).strip()
    if head != contract["hermesCommit"]:
        fail(f"hermes HEAD {head} != {contract['hermesCommit']}")

    import tools.skills_hub_search as hermes_search
    from scripts.build_skills_index import _meta_to_dict
    from tools.skills_hub_clawhub import ClawHubSource
    from tools.skills_hub_models import _parse_frontmatter
    from tools.skills_hub_sources import WellKnownSkillSource

    spec = importlib.util.spec_from_file_location("hermes_extract_skills", hermes / "website/scripts/extract-skills.py")
    extract_skills_module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(extract_skills_module)

    if hermes_search.HERMES_INDEX_URL != contract["indexUrl"]:
        fail("index URL changed in the pinned producer")
    if list(receipt["received"]["rows"][i]["query"] for i in range(3)) != contract["queries"]:
        fail("receipt queries are not the contract queries")
    if receipt["received"]["indexGeneratedAt"] != submission["indexGeneratedAt"]:
        fail("receipt index generation does not match the submission")
    if not (submission["indexGeneratedAt"] < submission["listingCreatedAt"]):
        fail("listing is not after the live index generation")
    if submission["action"] != "none" or submission["postPerformed"] is not False:
        fail("submission is not the pending no-POST record")
    if submission["slugPresentInIndex"] is not False:
        fail("submission claims the live index already contains the slug")
    if submission.get("catalogStatsAreNotDemand") is not True:
        fail("catalog stats were treated as demand")

    produced = _meta_to_dict(ClawHubSource._item_to_meta(listing))
    if produced["identifier"] != "received-useful-work" or produced["source"] != "clawhub":
        fail(f"producer identifier changed: {produced['identifier']} {produced['source']}")
    if produced["trust_level"] != "community" or produced["repo"] or produced["path"] or produced["extra"]:
        fail("listing summary was turned into trust, a repo path, or popularity")
    if "downloads" in json.dumps(produced) or "stars" in json.dumps(produced):
        fail("catalog stats were copied into the index entry")
    skill_text = (REPO / contract["skillMarkdown"]).read_text(encoding="utf-8")
    frontmatter = _parse_frontmatter(skill_text)
    if frontmatter.get("description") != listing.get("summary") or frontmatter.get("description") != produced["description"]:
        fail("SKILL.md description and the published listing summary differ")
    for query in contract["queries"]:
        if query not in produced["description"]:
            fail(f"published summary does not contain {query}")

    source_order = producer_source_order(hermes)
    ours = produced
    standins = [blank_entry(item) for item in contract["standinsFromReceipt"]]
    entries = sort_index([ours, *standins], source_order)
    ranked = rank_queries(hermes_search, entries, contract["queries"])
    boundary = {}
    for query, identifiers in ranked.items():
        if ours["identifier"] not in identifiers[:10]:
            fail(f"synthetic index boundary missed {query}: {identifiers}")
        boundary[query] = {"rank": identifiers.index(ours["identifier"]) + 1, "first10": identifiers}
    competing = boundary[QUERIES_COMPETING]["first10"]
    expected_prefix = [item["identifier"] for item in contract["standinsFromReceipt"]]
    if competing[:3] != expected_prefix or competing[3] != ours["identifier"]:
        fail(f"task-distribution order changed: {competing}")
    for query in contract["queries"]:
        if query == QUERIES_COMPETING:
            continue
        if boundary[query]["first10"] != [ours["identifier"]]:
            fail(f"{query} selected other rows: {boundary[query]['first10']}")

    install = extract_skills_module._install_command(ours["source"], ours["identifier"], ours["name"])
    if install != "hermes skills install clawhub/received-useful-work":
        fail(f"docs install command changed: {install}")

    # Seeded failures. Each one must be rejected by the same producer path.
    seeded = []
    dropped = dict(ours)
    dropped["description"] = ours["description"].replace("x402 integration repair", "x402")
    dropped_rank = rank_queries(hermes_search, sort_index([dropped, *standins], source_order), contract["queries"])
    if "received-useful-work" in dropped_rank["x402 integration repair"]:
        fail("seeded summary without the phrase was still selected")
    seeded.append("phrase removed from summary is not selected")

    generic = dict(ours)
    generic["source"] = "skills.sh"
    generic["identifier"] = "skills-sh/epistemedeus/x402-data-gateway-skills/received-useful-work"
    generic["description"] = "Indexed by skills.sh from epistemedeus/x402-data-gateway-skills"
    generic_rank = rank_queries(hermes_search, sort_index([generic, *standins], source_order), contract["queries"])
    if any(generic["identifier"] in identifiers for identifiers in generic_rank.values()):
        fail("skills.sh sitemap description was selected for a task query")
    seeded.append("skills.sh sitemap description is not task-first selection")

    our_identifiers = set(contract["ourIdentifiers"])
    false_success = {"taskFirstSelected": True, "defaultDiscovery": "github-tap", "paymentSent": True, "usefulnessIsSelection": True, "trustLevel": "trusted"}
    false_errors = claim_errors(receipt, false_success, our_identifiers)
    if len(false_errors) < 4:
        fail(f"seeded false success was not fully rejected: {false_errors}")
    seeded.append("receipt miss labeled as selection, tap, payment, or trust")

    honest = {"taskFirstSelected": False, "paymentSent": False}
    honest_errors = claim_errors(receipt, honest, our_identifiers)
    if honest_errors:
        fail(f"honest pending claim was rejected: {honest_errors}")
    flipped = json.loads(json.dumps(receipt))
    flipped["received"]["rows"][2]["ourSkillInFirst10"] = True
    flipped_errors = claim_errors(flipped, {"taskFirstSelected": True}, our_identifiers)
    if not any("first10 flag" in error for error in flipped_errors):
        fail("seeded first10 flag without our identifier was accepted")
    seeded.append("first10 flag without our identifier")

    wrong_owner = json.loads(json.dumps(receipt))
    wrong_owner["received"]["rows"][2]["ourSkillInFirst10"] = True
    wrong_owner["received"]["rows"][2]["results"] = [
        {"identifier": "github/another-owner/another-repo/received-useful-work"}
    ]
    wrong_errors = claim_errors(wrong_owner, {"taskFirstSelected": True}, our_identifiers)
    if not any("first10 flag" in error for error in wrong_errors):
        fail("same-named skill from another owner was counted as our selection")
    seeded.append("same-named skill from another owner")

    valid_selection = json.loads(json.dumps(receipt))
    valid_selection["received"]["rows"][2]["ourSkillInFirst10"] = True
    valid_selection["received"]["rows"][2]["results"] = [{"identifier": ours["identifier"]}]
    if claim_errors(valid_selection, {"taskFirstSelected": True}, our_identifiers):
        fail("exact declared identifier was not accepted as selection")

    from tools.skills_hub_search import _index_miss_fallback_sources, _select_active_sources

    source_ids = router_source_ids(hermes / "tools/skills_hub_search.py")
    sources = [_Source(source_id, available=(source_id == "hermes-index")) for source_id in source_ids]
    active = [source.source_id() for source in _select_active_sources(sources, "all")]
    if "github" in active or "clawhub" in active or "skills-sh" in active:
        fail(f"index-backed active set still queries registries directly: {active}")
    fallback_miss = [source.source_id() for source in _index_miss_fallback_sources(sources, _select_active_sources(sources, "all"), "x402 integration repair", {"hermes-index": 0})]
    if "github" in fallback_miss or fallback_miss != ["skills-sh", "well-known", "clawhub", "lobehub"]:
        fail(f"index-miss fallback changed: {fallback_miss}")
    fallback_hit = _index_miss_fallback_sources(sources, _select_active_sources(sources, "all"), "task distribution", {"hermes-index": 3})
    if fallback_hit:
        fail("index hits still triggered registry fallback")
    if WellKnownSkillSource().search("", limit=5):
        fail("an empty well-known query enumerated a catalog")

    known_paths = set()
    known_root = REPO / contract["knownSourceDir"]
    for path in known_root.rglob("*"):
        if path.is_file():
            known_paths.add(path.relative_to(known_root).as_posix())
    registry_paths = set(registry["paths"])
    if len(known_paths) != 26 or len(registry_paths) != 25 or known_paths == registry_paths:
        fail(f"bundle distinction changed: git {len(known_paths)} registry {len(registry_paths)}")

    print(f"PRODUCER PASS identifier={produced['identifier']} trust={produced['trust_level']} repo={produced['repo']!r}")
    print(f"INSTALL {install}")
    print(f"KNOWN SOURCE members={len(known_paths)} only={sorted(known_paths - registry_paths)}")
    print(f"REGISTRY LISTING members={len(registry_paths)} only={sorted(registry_paths - known_paths)} license={registry['license']}")
    for query in contract["queries"]:
        row = boundary[query]
        print(f"SYNTHETIC {query} rank={row['rank']} first10={','.join(row['first10'])}")
    print("SEEDED REJECT " + str(len(seeded)))
    for item in seeded:
        print(f" - {item}")
    print(f"LIVE RECEIPT hits=0 indexGeneratedAt={receipt['received']['indexGeneratedAt']}")
    print("SUBMISSION action=none")
    print("PASS discovery-to-acquisition")


if __name__ == "__main__":
    main()
