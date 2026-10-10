---
"@vp-tw/dirwell": patch
---

Keep queued source edits when an async theme or metadata renderer fails during a development rebuild. Retry the latest queued state before reporting the final failure, preserving the last successful output throughout recovery.
