# Self-Correcting Code Agent: A ReAct + Reflexion Loop for Autonomous Python Task Execution

**Project Overview**

**Team:** Disha & Spidey
**Course:** Generative AI / EAIDS
**Type:** Programming Assignment — Agentic LLM Systems

---

## 1. Introduction & Motivation

Large Language Models are proficient at generating code but frequently produce output that fails on first execution — syntax errors, wrong assumptions about library APIs, edge-case bugs, or logic errors. A single-shot "prompt → code" pipeline has no way to recover from these failures. This project builds an **agentic loop** that closes that gap: the agent doesn't just generate code once, it **reasons** about the task, **acts** by writing and running code, **observes** the result (including failures), and **reflects** on what went wrong before trying again — repeating until the task succeeds or a retry budget is exhausted.

This directly implements two complementary ideas from agentic-AI literature:

- **ReAct (Reason + Act)** — interleaving reasoning traces with actions and observations, so the model's next decision is grounded in what actually happened, not just what it planned.
- **Reflexion** — adding an explicit self-critique step after failure, where the agent verbalizes *why* it failed and turns that into guidance for the next attempt, rather than just re-trying blindly.

## 2. Problem Statement

Given a natural-language task description (e.g., *"Write a function that scrapes a table from this HTML and returns it as a pandas DataFrame"*), can we build a loop that:

1. Generates Python code to solve the task,
2. Executes it in a sandboxed environment,
3. Captures and interprets failures (tracebacks, wrong output, timeouts),
4. Uses that feedback to revise the code,
5. Converges to a correct, working solution within a bounded number of iterations —

all running affordably within **Google Colab's free tier**, using an external LLM API rather than a locally hosted model?

## 3. Objectives

- Design and implement a working ReAct-style Reason → Act → Observe loop for code generation and execution.
- Layer a Reflexion mechanism on top: after a failed execution, generate an explicit self-critique that is fed back into the next generation step.
- Build a **safe execution sandbox** that can run untrusted, LLM-generated code without harming the host environment or the Colab runtime.
- Log the full trajectory (reasoning, code, output/error, reflection) for every task so the loop's behavior is inspectable and demonstrable.
- Evaluate whether the Reflexion step meaningfully improves success rate / reduces iterations-to-success compared to plain retry-on-failure.

## 4. Conceptual Background

| Concept | Role in this project |
|---|---|
| **ReAct** | Structures each turn as *Thought → Action → Observation*. The "Thought" is the model's reasoning about what to do next; the "Action" is the code it writes and executes; the "Observation" is the actual stdout/stderr/traceback returned by the sandbox. |
| **Reflexion** | Adds a *verbal reinforcement* step: when an Observation indicates failure, a separate reflection step asks the model to diagnose the root cause in natural language. This reflection is stored and prepended to the next generation prompt, acting like an evolving scratchpad of "lessons learned" for this task. |
| **Why combine them** | ReAct alone can loop on the same mistake if the model doesn't clearly understand *why* the previous attempt failed. Reflexion gives the loop memory and self-diagnosis, which should reduce repeated identical failures. |

## 5. Proposed System Architecture

**High-level loop:**

```
User Task (natural language)
        │
        ▼
 [1] Reasoning / Planning Turn  ──(same LLM thread, model set via env var, one session per task)
        │  produces: plan + code
        ▼
 [2] Action: Execute Code  ──(sandboxed subprocess)
        │
        ▼
 [3] Observation Capture  ──(stdout, return value, stderr / traceback)
        │
        ├── Success or HITL sign-off ──► Return final code + output, log trajectory, STOP
        │
        └── Failure (and < 3 attempts so far)
                │
                ▼
        [4] Reflexion Turn  ──(same thread, next message: "why did this fail? what should change?")
                │
                ▼
        [5] Next turn in the same thread, now carrying the reflection ──► back to [1]
```

The loop terminates when the code runs, the user (human-in-the-loop) confirms the output is correct, or a maximum of **3 iterations** is reached — whichever comes first.

**Core components:**

1. **Task Parser** — takes the raw user task string, optionally breaks it into sub-goals for more complex tasks.
2. **Reasoning/Planning Turn** — a message in the task's single LLM thread (model configured via the `MODEL_ID` env var, not hardcoded — see §6) that reads the task, any prior reflection from earlier in the same thread, and produces a short plan plus a Python code block.
3. **Code Extractor** — pulls the executable code out of the LLM's response (e.g., parsing fenced code blocks) and validates it's syntactically well-formed before execution.
4. **Execution Sandbox** — runs the extracted code in an isolated `subprocess`, enforcing time limits and restricting dangerous operations.
5. **Observer** — captures whatever the sandbox produces: return values, printed output, or a full exception traceback on failure.
6. **Reflexion Turn** — the *next message in that same thread* (not a separate call/session) where the model is shown the failed code + traceback and asked to diagnose what was wrong and what to try differently. Keeping it in one thread means the model still has the full task history and earlier attempts in context, without needing to re-inject the whole state manually.
7. **Trajectory Memory / Logger** — a log of every (thought, action, observation, reflection) turn for the current task, kept for the demo/report — this mirrors the thread itself but is captured separately so it's easy to render outside the raw chat log.
8. **HITL Checkpoint** — once the code runs without error, the user is shown the code + output and asked to confirm it actually solves the task, rather than the loop auto-declaring success.
9. **Loop Controller** — orchestrates the above, enforces the 3-iteration cap per task, and decides success vs. "stopped after 3 attempts."

## 6. Technology Stack

| Layer | Choice | Rationale |
|---|---|---|
| Development environment | Google Colab (free tier) | No local setup, free GPU/CPU, easy to share with teammate and submit as a notebook. |
| LLM backend | Qwen 3.8 27B, served via Groq, called through an OpenAI-compatible client. Model id is read from a `MODEL_ID` env var, not hardcoded — the team expects to swap the exact slug as Groq's catalog changes. | Groq's inference is fast and its free/low-cost tier fits the Colab-free-tier budget; each task may need several LLM calls per loop iteration (plan, reflect, re-plan), so latency and cost per call both matter. |
| Code execution | Python `subprocess` (separate process, own interpreter) | Real process isolation — no shared memory/builtins with the host, so a genuine boundary rather than a best-effort restricted namespace; still allows timeouts and output capture (see §8). |
| Front-end | Vanilla HTML/CSS/JS, served by a lightweight Flask backend | No UI framework dependency; Flask exposes the loop controller as two JSON endpoints and the browser drives them directly (see §7). |
| Traceback capture | `traceback` module / captured `stderr` | Standard library, no extra dependencies needed. |
| Logging | In-notebook structured logs (e.g., list of dicts) rendered as a table at the end | Makes the demo/report easy to generate directly from the notebook. |

## 7. Front-End Layer

Running everything raw inside a Colab notebook works for development, but it's not a great way to *demo* or *use* the agent — every task means re-running cells and reading logs. The front-end is part of the core build, not a later add-on: a lightweight UI makes the loop feel like an actual tool from the start.

- **Interface:** A simple web UI where the user types a task in a text box, hits "Run," and watches the loop progress live — each iteration's reasoning, code, execution output, and (if it failed) the reflection, shown as it happens rather than dumped at the end.
- **Stack:** **Vanilla HTML/CSS/JS**, no UI framework — the files live in the repo's `frontend/` folder and are served by a small **Flask** backend that exposes the loop controller as JSON endpoints (`/api/run`, `/api/confirm`) and streams newline-delimited JSON so the browser can render each attempt as it completes. The notebook pulls in `frontend/` (git clone or zip upload — it is not regenerated in-notebook), runs Flask in a background thread, and exposes it publicly with a **Cloudflare quick tunnel** (`cloudflared --url`), which needs no account and prints a `trycloudflare.com` URL.
- **Key screen elements:**
  - Task input box + "Run" button.
  - A live "trajectory" panel showing each loop iteration (Thought → Code → Observation → Reflection) as it happens, so the ReAct/Reflexion structure is visible, not hidden.
  - Final output panel: the working code + its result once the loop succeeds (or a "stopped after 3 attempts" message with the last attempt shown).
  - A small iteration counter / status indicator (e.g., "Attempt 2 of 3 — retrying after error").
- **Why this matters for the assignment:** it turns an internal debugging loop into something that visibly demonstrates the ReAct/Reflexion behavior to anyone watching — useful both for your own testing and for presenting the project.
- **Scope note:** built alongside the core loop (§5–6), not deferred — the front-end calls the same loop controller and renders its trajectory log, so it should come up as soon as the loop can run a single task headlessly.

## 8. Safety & Execution Environment Design

Since the code being executed is LLM-generated and not trusted, sandboxing is a first-class design concern, not an afterthought:

- **Process isolation** — each attempt runs as a separate `subprocess.run(...)` call in its own interpreter, so it doesn't share memory, imports, or global state with the orchestrator process. This is a real boundary, unlike a restricted `exec()` namespace, which is well known to be escapable in Python (e.g. via `__class__.__mro__` / `__globals__` tricks) no matter how curated the builtins list is.
- **Timeouts** on every subprocess call (`subprocess.run(..., timeout=...)`) to kill infinite loops or hangs.
- **Restricted environment** — launch the subprocess with a minimal/blocked environment and, where the host OS supports it, drop network access and restrict filesystem writes to a scratch folder (e.g. via a temp working directory and, on Linux/Colab, resource limits via `resource.setrlimit` or running inside a lightweight container).
- **Output size caps** — truncate captured stdout/stderr so a runaway `print` loop can't blow up memory or the prompt sent back to the LLM.
- **Fresh process per attempt** — each iteration starts a brand-new subprocess, so a failed attempt's partial state can never leak into the next one (a stronger guarantee than resetting an `exec()` namespace dict).

This section is intentionally a design discussion here — the actual sandbox implementation is a separate build step, not part of this overview.

## 9. Evaluation Plan

To demonstrate the loop actually works (and that Reflexion adds value), the project should be evaluated against a small hand-picked task set of varying difficulty, run with the fixed 3-iteration cap and HITL confirmation, for example:

- Easy: simple data transformation function.
- Medium: parsing/regex task with a subtle edge case.
- Hard: task requiring an uncommon library API the model is likely to misremember.

**Suggested metrics:**

- **Task success rate** within the 3-iteration cap.
- **Average iterations to success** (lower is better).
- **Repeated-failure rate** — how often the same error type recurs across iterations (a proxy for whether Reflexion is actually helping vs. the model just guessing again). Defined concretely as: two failed attempts count as the "same error type" if they share both the exception class (e.g. `KeyError`, `TypeError`) and the failing line/statement in the generated code — logged automatically per attempt (via `type(exc).__name__` and the traceback's last frame) rather than judged by eye, so the metric is consistent across tasks and teammates.
- **Ablation comparison:** ReAct-only (retry with just the traceback appended) vs. ReAct + Reflexion (retry with the diagnosed reflection appended) — this is the most interesting result for the report, since it directly tests the hypothesis that reflection improves convergence.

## 10. Design Decisions

These were the open questions from earlier drafts — now settled:

- **Sandboxing:** `subprocess`, not `exec()`. A restricted `exec()` namespace is not a real security boundary (it's escapable), while a subprocess gives genuine process isolation, at the cost of a bit more plumbing (spawning a process, capturing its stdout/stderr, enforcing a timeout).
- **LLM calls:** one continuous thread per task, not separate calls for planning vs. reflection. Every turn — initial plan, each retry, each reflection — happens inside the same session, so the model always has the full history of what it already tried.
- **Success check:** human-in-the-loop. After each successful execution, the user reviews the code + output and confirms it actually solves the task, rather than the loop deciding "no traceback = success" on its own.
- **Iteration budget:** fixed at **3 attempts** per task. If the third attempt still fails (or isn't confirmed by the user), the loop stops and surfaces the last code + traceback + reflection rather than continuing indefinitely.

## 11. Expected Challenges

- **Thread length** — since the whole task lives in one LLM thread, three attempts' worth of code + tracebacks + reflections can make the context fairly long; worth watching if this affects response quality or cost.
- **Sandbox escape / unsafe code** — LLMs occasionally generate code that tries file I/O or imports outside the allowed set; even with subprocess isolation, the launch environment must fail closed (block by default — no network, no writes outside the scratch folder) rather than fail open.
- **Ambiguous "success"** — without proper test cases, it's hard to auto-detect whether code is *correct*, not just *non-crashing*, which is exactly why success is HITL-confirmed rather than automatic.
- **Only 3 attempts** — the fixed cap means genuinely hard tasks may just fail every time; the report should be honest about this rather than cherry-picking only tasks that succeed.

---
*This document is a project overview / design plan only — no implementation code is included. Next step would be to prototype the core loop (§5–6) as a Colab notebook.*
