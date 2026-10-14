---
"@dirwell/core": patch
"@dirwell/server": patch
"@dirwell/cli": patch
"@dirwell/integrations": patch
---

Reject misspelled keys and invalid nested values at direct Core and Server boundaries before publication or socket creation. Validate listing callback results, keep custom themes extensible, project host-specific fields at Core boundaries, and choose the nearest typo correction.
