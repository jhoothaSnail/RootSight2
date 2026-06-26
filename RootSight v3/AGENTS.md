# AGENTS.md

## Purpose

Build features safely while preserving existing functionality, API contracts, and design consistency.

---

# Core Rules

## 1. Minimum Scope

Only modify files directly related to the requested task.

Do not perform unrelated refactors, renames, folder restructuring, or cleanup work.

---

## 2. Preserve Existing Functionality

Assume all existing working code is intentional.

Do not change existing behavior unless required by the task.

---

## 3. Reuse Before Creating

Before creating new components, utilities, or APIs:

* Search for existing implementations.
* Reuse existing code where possible.
* Avoid duplication.

---

## 4. Avoid Assumptions

If requirements are unclear:

* State assumptions briefly.
* Choose the safest implementation.
* Ask for clarification only when necessary.

---

# RootSight Rules

## 5. Preserve Design System

Unless explicitly requested, do NOT change:

* Color palette
* Typography family
* Navigation structure
* Branding
* Animation style
* Existing dashboard layouts

New features should match the current RootSight design language.

---

## 6. Homepage Protection

Do not modify the homepage hero, graph animation, or branding while implementing unrelated features.

---

## 7. Responsive UI

New UI must:

* Work on laptop and desktop screens
* Scale responsively
* Avoid unnecessary fixed widths
* Match existing spacing patterns

---

# API Rules

## 8. Respect API Contracts

Do not change request or response formats unless explicitly instructed.

Frontend and backend contracts are considered stable.

---

## 9. Consistent Errors

Return structured error responses.

Example:

{
"success": false,
"error": "Unable to process file."
}

---

# AI Usage

## 10. Keep It Practical

Prefer the simplest working solution.

Avoid overengineering.

RootSight is a hackathon MVP.

Use AI only where it provides clear value.

---

# Before Coding

Provide a short summary:

### Understanding

One or two sentences.

### Files

Files likely to be modified.

### Plan

3-5 bullet points maximum.

Only provide detailed reasoning if the task is complex or risky.

---

# When To Stop And Ask

Ask before proceeding if:

* More than 5 files need modification.
* An API contract must change.
* A database schema must change.
* Existing functionality may break.
* Multiple implementation approaches have major tradeoffs.

---

# After Coding

Provide a concise summary:

* Files modified
* What changed
* Any important risks

Keep it brief.

---

# Default Behavior

If design details are not specified:

Use reasonable creative freedom while staying consistent with the existing RootSight UI and architecture.

Prefer simple, maintainable solutions over complex ones.
