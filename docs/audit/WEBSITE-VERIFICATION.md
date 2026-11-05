# Website verification: build specification 11

**Observed:** 2026-11-05 UTC. **PR:** [#439](https://github.com/SimonShaun2/Renvani/pull/439). **Exact source:** `935d37b0fa54f68b2ec88eb76ef6e4e30823c161`. **Git tree:** `166bb48b0701abb892b04fe3a8a1b06313e04da9`. Source remained clean and unchanged throughout this verification.

**Disposition:** Node 22 and desktop verification complete. **Responsive acceptance at 320, 390 and 834 CSS pixels remains blocked by the available browser's controls.** No full responsive PASS or production readiness is claimed.

## 1. Source and deployment binding

The Vercel deployment record for `dpl_HMPFDtiLmVy2V4orVVLG8p1kMk9a` reports READY and Git SHA `935d37b0fa54f68b2ec88eb76ef6e4e30823c161`. The [immutable preview](https://renvani-ra40e3i30-simonshaun2-8939s-projects.vercel.app/) was opened and observed. The source checkout and preview identify the same head. The production alias was not changed.

Homepage design reference remains canonical Figma `jiGHTNUJNltWbHA4Il3hk7`, website page `171:2`, Home frames `171:3`, `171:197`, `253:6780`. The Products dropdown is the founder-requested alternative design already implemented in #439; this verification does not approve a new design or assert parity with a different dropdown frame.

## 2. Node 22 local verification

Runtime: **Node 22.16.0, pnpm 10.0.0**. Dependencies were installed from the existing offline cache using the frozen lockfile with lifecycle scripts disabled. No manifest or lockfile changed.

| Suite | Passed | Failed | Skipped |
| --- | ---: | ---: | ---: |
| flagship.test.tsx | 28 | 0 | 0 |
| industry.test.tsx | 11 | 0 | 0 |
| intake.test.tsx | 21 | 0 | 0 |
| menus.test.tsx | 15 | 0 | 0 |
| platform.test.tsx | 7 | 0 | 0 |
| pricing.test.tsx | 7 | 0 | 0 |
| site.test.tsx | 10 | 0 | 0 |
| tour.test.tsx | 9 | 0 | 0 |
| **Total** | **108** | **0** | **0** |

Full web `tsc --noEmit` also passed. The command chain exited zero. This expands the earlier recorded 78-case/six-suite selection to all eight suites in `src/components/marketing/site`; counts are not additive to the older run.

```sh
# Execute in the exact #439 checkout under Node 22.16.0.
corepack pnpm install --offline --frozen-lockfile --ignore-scripts
corepack pnpm --filter @fsm/import-normalize build
corepack pnpm --filter @fsm/types build
corepack pnpm --filter @fsm/import-engine build
corepack pnpm --filter @fsm/config build
corepack pnpm --filter @fsm/web exec vitest run src/components/marketing/site --reporter=json --outputFile=marketing-tests.json
corepack pnpm --filter @fsm/web exec tsc --noEmit
```

An initial attempt built internal packages concurrently and failed because downstream generated types were not yet available. Correcting build order resolved that local setup problem with no source changes. Existing Vitest configuration-deprecation and stale Browserslist-data warnings remain; neither was modified as part of this verification.

The normalized machine-readable [test evidence](website-test-evidence.json) records the exact source, runtime, suite names and individual test outcomes. Component tests do not measure browser layout, authenticated API behavior, or real provider calls.

## 3. Fresh browser observations

Browser viewport observed: **1363 × 936 CSS pixels**. Document client width and scroll width were both **1348**, establishing no horizontal document overflow at that desktop width. A screenshot and accessibility/DOM snapshots were inspected during the run; no downloadable screenshot artifact is included in this packet.

| Scenario | Actual result | Disposition |
| --- | --- | --- |
| Open Products | Floating panel rendered; Growth, Revenue, Operations, Retention and Command Center visible | PASS at desktop |
| Tool inventory | All 17 named tool links present in the expanded Product tools navigation | PASS at desktop |
| Main/support destinations | All products, Growth Check, demo and Sign in remained available | PASS for observed controls; not a blanket destination workflow test |
| Escape | Products collapsed; focus returned/remained on Products trigger | PASS at desktop |
| Menu exclusivity | Opening Industries collapsed Products | PASS at desktop |
| Outside interaction | Clicking the main heading collapsed Industries | PASS at desktop |
| Focus exit | Shift+Tab from the opened Products trigger moved focus to the Renvani logo and closed the menu | PASS at desktop |
| Child-link navigation | Online Booking opened `/product/online-booking`, page title became `Online Booking · Renvani`, and Products was collapsed | PASS at desktop |
| Overflow | documentElement.scrollWidth = clientWidth = 1348 | PASS at desktop |
| 320 / 390 / 834 widths | Not executed; no supported viewport-resize operation in available cloud browser | BLOCKED |
| Native mobile tools disclosure | Existing component tests pass; no fresh narrow browser observation | SOURCE/TEST EVIDENCE ONLY |

The connected Browser extension reported that the originating browser context was unavailable. The permitted cloud browser completed desktop checks but advertised no browser capabilities and no viewport/emulation setter. Desktop geometry, zoom changes, CSS inspection or mocked tests cannot substitute for the three required CSS viewports.

## 4. Completion checklist for the responsive runner

At the same source head, or a new explicitly recorded head if changes become necessary:

1. Set a real CSS viewport to 320 × 800, then 390 × 844, then 834 × 1112; record actual innerWidth/clientWidth/scrollWidth.
2. At narrow widths, open the outer mobile menu, verify all five flagship links, expand and collapse the native tools section, and ensure the outer menu stays open.
3. Verify all 17 tools are reachable without clipped controls or horizontal document overflow. Scroll to the final link and test keyboard focus visibility.
4. Activate a tool link and verify navigation closes both relevant disclosure states. Verify Escape, outside interaction, focus exit and route changes at the applicable navigation mode.
5. Capture screenshots with source SHA, preview, viewport and expected/actual outcome; record failure locations and only implement demonstrated bounded fixes.
6. Refresh affected independent review/design evidence and the approved CI batch if the head changes. Preserve the older approval and CI as historical evidence only.

At this head, [run 41950026870](https://github.com/SimonShaun2/Renvani/actions/runs/41950026870) has both jobs skipped. This package did not dispatch CI or alter the PR's draft/release status. Exact-head CI, chosen-design approval, and founder merge approval remain separate release gates.
