## 2025-02-14 - Use performance.now() efficiently
**Learning:** requestAnimationFrame executes a continuous polling mechanism which eats up performance. I will reduce performance consumption by only executing drawing methods when there is a meaningful state change.
**Action:** Throttle canvas drawing requests instead of a blind interval if animations are disabled.
