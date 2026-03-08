# HomeRacker Community Copilot Instructions

## Project Overview
HomeRacker Community is a community-driven repository for sharing creations built on the [HomeRacker](https://github.com/kellerlabs/homeracker) core — a modular 3D-printable rack-building system. Core components use parametric OpenSCAD models (BOSL2 library). Licensed: MIT (code), CC BY-SA 4.0 (models).

> **Scope**: This repo is for community creations only. Core fixes belong in [kellerlabs/homeracker](https://github.com/kellerlabs/homeracker).

## Tools & Structure
- **Languages**: OpenSCAD (.scad), Python, Bash
- **Preferred Tooling**: GitHub MCP Server, Context7 MCP Server
- **Key Dirs**: `/models/` (SCAD files)
- **HomeRacker Standards**: 15mm base unit, 4mm lock pins, 2mm walls, 0.2mm tolerance. See `README.md` for details.
- **Contribution Guide**: See `CONTRIBUTING.md` for setup and workflow instructions.
- **Dependency Manager**: Use `scadm` to install OpenSCAD and libraries
  - Install: `scadm` (installs OpenSCAD + libraries from `scadm.json`)
  - Config: `scadm.json` in project root defines library dependencies (includes homeracker core and BOSL2)
  - Help: `scadm -h` for usage info

## Core Principles
- **Test-Driven Development**: NO change without a test. EVERY change MUST be tested before completion.
- **DRY, KISS, YAGNI**: Keep it simple, don't over-engineer
- **Be Brief**: All outputs (code, docs, issues, PRs) should be minimal and to-the-point
  - Code: No unnecessary comments, clear variable names speak for themselves
  - Docs: Essential info only - what/why/how in <100 lines when possible
  - GitHub issues/PRs: Clear problem/solution, skip verbose explanations
- **Commits**: Use [Conventional Commits](https://www.conventionalcommits.org/) format
  - Types: `feat`, `fix`, `docs`, `chore`, `refactor`, `test`
  - Format: `type(scope): description` or `type: description`
  - Breaking changes: Add `!` (e.g., `feat!: change base unit`)

## **MANDATORY** Workflow
1. **Check repo patterns** first for consistency
2. **Consult online docs** (especially BOSL2: https://github.com/BelfrySCAD/BOSL2/wiki)
3. **Ask before proceeding** if requirements conflict with best practices
4. **Provide outline** before implementation for confirmation
5. **Make the change** and immediately test it - do NOT announce completion before testing
6. **Update** existing README.md files and CONTRIBUTING.md where applicable
7. **Run pre-commit hooks** to catch formatting/linting issues before commit. Fix any issues found.
8. **On errors**: Step back, check docs, ask user if stuck—don't iterate blindly

## OpenSCAD Guidelines
- Use BOSL2 for complex geometry
- Set `$fn=100` for production
- Group parameters with `/* [Section] */` comments
- Include sanity checks for critical params
- Test parameter ranges for edge cases
- Import homeracker core via `scadm.json` dependency

## Renovate Guidelines
- **Version Pinning**: MANDATORY for all dependencies (Renovate manages updates)
  - Pin exact versions, never use version ranges or `latest`
- **Testing**: Verify config changes locally before pushing
