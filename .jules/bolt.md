## 2024-11-21 - [Throttling Canvas Mousemove]
**Learning:** Synchronous calculations inside `mousemove` events on the canvas in vanilla JS can cause main thread blocking, even if the redraw is conditional.
**Action:** Always throttle high-frequency events like `mousemove` and `scroll` using `requestAnimationFrame` when performing layout/position calculations.
