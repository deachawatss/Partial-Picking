# Phase 3 Quick Validation Checklist

**Date:** 2025-10-10
**Purpose:** One-page checklist to quickly validate Phase 2 React 19 optimizations

---

## Pre-Flight Check

- [ ] Backend running: `cd backend && cargo run`
- [ ] Bridge running: `cd bridge && dotnet run`
- [ ] Frontend running: `cd frontend && npm run dev`
- [ ] Chrome DevTools + React DevTools installed

---

## 7 Critical Tests

### ✅ Test 1: BatchItemRow Memoization (5 min)

**Goal:** Only 1 row re-renders per weight update (not all 20-100 rows)

1. Open React DevTools → Profiler tab → Record
2. Perform picking workflow (select run → batch → item → place on scale)
3. Stop recording
4. Check: Only 1 `BatchItemRow` rendered per update

**PASS:** Only affected row renders ✅
**FAIL:** All rows render (memo broken) ❌

---

### ✅ Test 2: WeightProgressBar Memoization (3 min)

**Goal:** WeightProgressBar only renders when weight changes (not on modal open/close)

1. Continue Profiler recording
2. Open/close modals (Run Selection, Bin Selection)
3. Place item on scale (weight changes)
4. Check: WeightProgressBar rendered only on weight change

**PASS:** No render on modal open/close ✅
**FAIL:** Renders on every parent update ❌

---

### ✅ Test 3: useDeferredValue Search (2 min)

**Goal:** Search input responds instantly (no 400ms delay)

1. Open Run Selection Modal
2. Type quickly: `"600"`
3. Check: Input shows characters instantly
4. Check: Loading spinner (⏳) appears while filtering

**PASS:** Instant input, smooth typing ✅
**FAIL:** 400ms delay, sluggish typing ❌

---

### ✅ Test 4: WebSocket Latency (3 min)

**Goal:** <200ms latency (constitutional requirement)

1. Open DevTools → Network tab → Filter: WS
2. Place item on scale
3. Click WebSocket message → Check timestamp
4. Measure: Message received → UI updated

**PASS:** <200ms latency ✅
**WARNING:** 150-200ms (acceptable) ⚠️
**FAIL:** >200ms (constitutional violation) ❌

---

### ✅ Test 5: Bundle Size (2 min)

**Goal:** ≤ 200 KB gzipped

```bash
cd frontend
npm run build
# Check output: dist/assets/index-[hash].js gzip size
```

**PASS:** ≤ 200 KB ✅
**WARNING:** 200-210 KB (investigate) ⚠️
**FAIL:** >210 KB (bloat detected) ❌

**Phase 1 Baseline:** 159 KB gzipped

---

### ✅ Test 6: Lighthouse Score (5 min)

**Goal:** 95-100 Performance score

```bash
cd frontend
npm run build
npm run preview  # Starts on port 4173
npx lhci autorun
```

**Or manually:**
- Chrome DevTools → Lighthouse tab
- Mode: Desktop, Screen: 1280x1024
- Run audit

**PASS:** 95-100 (excellent) ✅
**WARNING:** 85-94 (good) ⚠️
**FAIL:** <85 (investigate) ❌

---

### ✅ Test 7: User Acceptance (10 min)

**Goal:** Warehouse team confirms smoother experience

**Test Script:**
1. Login → Select Run → Select Batch
2. Pick 3 items with weight scale
3. Search for runs (fast typing)
4. Scroll batch grid (50+ items)

**Questions:**
- [ ] Did weight updates feel instant?
- [ ] Did search input respond instantly?
- [ ] Did scrolling feel smooth?
- [ ] Any lag or delays noticed?

**PASS:** All "Yes", no issues ✅
**FAIL:** Lag/delays reported ❌

---

## Success Criteria Summary

| **Metric** | **Target** | **Result** | **Status** |
|-----------|----------|----------|----------|
| Batch grid re-renders | 1 row/update | ___ | ☐ |
| Search input latency | <16ms | ___ | ☐ |
| WeightProgressBar re-renders | Only on prop change | ___ | ☐ |
| WebSocket latency | <200ms | ___ms | ☐ |
| Bundle size | ≤200 KB | ___KB | ☐ |
| Lighthouse score | 95-100 | ___ | ☐ |
| UAT sign-off | Approved | ☐ Yes / ☐ No | ☐ |

---

## Final Decision

**All 7 tests passed?**

✅ **YES** → **Phase 3 Complete!** → Create validation report → Commit to git
❌ **NO** → Identify failing tests → Review troubleshooting guide → Fix → Re-test

---

## Quick Troubleshooting

**BatchItemRow still re-rendering all rows?**
→ Check `React.memo()` wrapper in `BatchTicketGrid.tsx`

**Search still has 400ms delay?**
→ Verify `useDeferredValue` import and usage in `RunSelectionModal.tsx`

**WebSocket latency >200ms?**
→ Check network: `ping 192.168.0.86` → Check bridge CPU usage

**Bundle size increased?**
→ Open `dist/stats.html` → Look for duplicate dependencies

**Lighthouse score dropped?**
→ Run Profiler → Identify long render times

---

## Next Steps

**After All Tests Pass:**
1. Create Phase 3 validation report with metrics
2. Take screenshots for documentation
3. Get UAT sign-off from warehouse team
4. Commit Phase 3 documentation
5. (Optional) Consider Phase 4: Virtual Scrolling if batch grids >50 items

**Total Time:** ~30 minutes for all 7 tests

---

## References

- **Full Guide:** `docs/phase-3-validation-guide.md`
- **Phase 2 Summary:** `docs/phase-2-complete.md`
- **SolidJS Evaluation:** `docs/solidjs-evaluation-2025-10-10.md`
