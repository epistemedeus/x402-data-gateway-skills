# Task-first discovery receiving

This is an offline contract test against the pinned official Hermes producer.
It is not a live rank, a registry publication, an install, or customer demand.
The adjacent dated fixtures preserve one listing, one prior live miss and the
distinct registry/GitHub member inventories. Synthetic ranks use only those
declared stand-ins; they do not predict ranking among the full future index.

Configure an actual checkout and its working Python environment:

```sh
HERMES_AGENT_SOURCE=/path/to/pinned/hermes-agent \
HERMES_PYTHON=/path/to/hermes/python \
HERMES_REQUIRE_DISCOVERY_CHECK=1 npm test
```

The checkout HEAD must equal `contract.json`'s `hermesCommit`.
The standalone checker always refuses a missing or wrong source pin:

```sh
HERMES_AGENT_SOURCE=/path/to/pinned/hermes-agent \
/path/to/hermes/python contracts/discovery-to-acquisition/check.py
```

Ordinary repository tests skip this optional upstream integration when no
Hermes checkout is configured. Explicit receiving sets
`HERMES_REQUIRE_DISCOVERY_CHECK=1`, so missing input fails rather than silently
passing. Child execution is time-bounded.

The receiving test distinguishes an exact declared identifier from another
owner's same-named skill. Producer compatibility, default task selection,
guarded acquisition, caller usefulness and payment stay separate observations.
The public listing already follows the supported crawl route. The received
index predates it; replay live task-only queries at a changed published-index
boundary, not repeatedly against the same generation.

Primary source: [official pinned index producer](https://github.com/NousResearch/hermes-agent/blob/2f80ae0a6a91932b1808a53f9c55f8b3f313d6cc/scripts/build_skills_index.py).
