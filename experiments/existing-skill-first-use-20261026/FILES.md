# FILES

Source HEAD `2fde6b38f534777132cddd7975b601d43fa53e03`; tree `6b417406b448740086693e31733c4effe2ce35d8`.

| Full changed source path | Bytes | Git blob | SHA-256 |
| --- | --- | --- | --- |
| `README.md` | 10942 | `6d863096118e135f14529157d5cf885a43d341eb` | `94862c5c4bbaf16e3ec7dd298f7c14050d5deb4288c16f7a7fca3d06c69af492` |
| `fixtures/walletless-first-use/README.md` | 2836 | `ffd2c3f073d474ba2ae6c30c899acbd7189c19b9` | `cb080b77b8da6e8428f4bce01da8f139921d770171219714951e5a58ecd2a32e` |
| `fixtures/walletless-first-use/merchant-source.json` | 3829 | `8ee4ff67941fc500a2f4688e17f5a6e1024bad59` | `321335b165995e7ccb320e827c5a2a2ee20d57ec17f059e3835adc93b9e1cb9b` |
| `fixtures/walletless-first-use/producer.json` | 38794 | `0b35a2d41378009704ea3e44016722d531b4d6a3` | `dd9e2e9b2869968a07fc349f87d5648b66ee104026d4d29b6676a2cbd7f53818` |
| `skills/samedaydesk-machine-commerce/SKILL.md` | 11238 | `c755bc718727d4cf9687325fe571eea20a5d3aed` | `9bda338b0070e883dd256464365caff019293973299dec82baf9247fe57c334a` |
| `skills/web-extract/SKILL.md` | 10744 | `032269b628b9b9b0801ad107326c5e8aa915479d` | `79d0ddf78ebfd0aa6cb90b9b29a74f0a110f75a32fa6e1b0b6209d6ce7f33fb5` |
| `tests/walletless-first-use.test.mjs` | 10147 | `582d3762ff13f099801d9d2887c6018647aef051` | `cbce62d542a88b733b2e4435031fb560a29cb30407b9ef518fc06fe6d68079af` |
| `tests/walletless-merchant-replay.mjs` | 8240 | `68c3193023f0875e75c2ba5ffa81e6cd1d2061ed` | `554136036d6af93b9d973f8ada7feee46f16763d168855f5509587f850c2fd3c` |

The report-only export additionally contains exactly:

- `experiments/existing-skill-first-use-20261026/RESULT.md`
- `experiments/existing-skill-first-use-20261026/CHECKS.md`
- `experiments/existing-skill-first-use-20261026/FILES.md`

Safe source exports (exit 0):

```bash
git archive --format=tar.gz --output=/tmp/root9814-export/source-2fde6b3.tar.gz 2fde6b38f534777132cddd7975b601d43fa53e03
git diff --binary f96ba07c000d073dadc65d205cab34e552452bde 2fde6b38f534777132cddd7975b601d43fa53e03 > /tmp/root9814-export/source-2fde6b3.patch
```

| Artifact | SHA-256 |
| --- | --- |
| `/tmp/root9814-export/source-2fde6b3.patch` | `7390c8d6b3e8a7f3c90b37a2ff7da654d553dbf83ec3b82e87ce6413b15b96b9` |
| `/tmp/root9814-export/source-2fde6b3.tar.gz` | `d529eb2fcb5a36d377adad60dcd32b09e0abccdb29de35be177046b45c233d3a` |

Current merchant receiving manifest: `fixtures/walletless-first-use/merchant-source.json` (twelve declared members plus five relative imports, all fully verified before use). Read-only checkout locator: `/home/ubuntu/ae14-work/root9814-merchant-source-65176654`. Old recipe checkout locator: `/home/ubuntu/ae14-work/root9814-merchant-recipes-4910f83b`. No merchant source change.

Staged operating receipt: `/home/ubuntu/root-sol-window100337/root9814-existing-skill-first-use-20261026/inputs/RECEIPT.json`, SHA-256 `856252dc7147c880e226edd6eadc4f4b84cef0925ce9870a5917d4953c81484a`. Separate Pilot ROOT-RECEIVING/reuse-gate inputs were received from frozen `96a524e71b4736e2ad8c71ae3804732c9cffbbd7` objects and verified against every supplied identity.
