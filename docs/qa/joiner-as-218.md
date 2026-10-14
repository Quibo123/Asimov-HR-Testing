# Joiner bugs (AS-218)

| # | From QA (13 Oct) | Steps to reproduce | Cause | Fix (file) | Re-tested light | Re-tested dark |
|---|---|---|---|---|---|---|
| 1 | | | | | | |

## Found by code review

| # | Problem | Fix (file) | Re-tested |
|---|---|---|---|
| R1 | Faint colours in dark mode | JoinScreens, StepScreen, states | |
| R2 | Portal ignores system dark setting | JoinLayout | |
| R3 | Transparent PNG becomes black | compress.ts | |
| R4 | Saved screen opens scrolled down | useScreenFocus | |
| R5 | No focus or title change between screens | useScreenFocus | |
| R6 | Expired link or rejected file shows retry forever | logic.ts, StepScreen | |
| R7 | Double tap can send twice | StepScreen | |
| R8 | No steps shows "All done" | JoinFlow, JoinScreens | |
| R9 | Skeleton ignores reduced motion | states.tsx | |
