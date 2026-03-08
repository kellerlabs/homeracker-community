# Contributing to HomeRacker Community

Thanks for your interest in contributing! This repository is the place to share your own creations built on top of the [HomeRacker](https://github.com/kellerlabs/homeracker) core.

> **Note**: Bug fixes or changes to the HomeRacker core belong in the [kellerlabs/homeracker](https://github.com/kellerlabs/homeracker) repository.

## 🚀 Quick Start

### Pre-commit Hooks (Required)

This repository uses [pre-commit](https://pre-commit.com/) to enforce code quality checks before commits.

**Prerequisites**: Python 3.x installed on your system

```bash
# Clone and setup
git clone https://github.com/kellerlabs/homeracker-community.git
cd homeracker-community

# On Debian/Ubuntu systems, you need to install the python3-venv package before next command
python3 -m venv ~/.venv

# Activate the virtual environment
# Windows (Git Bash/CMD/PowerShell):
source ~/.venv/Scripts/activate
# macOS/Linux:
source ~/.venv/bin/activate

# Install scadm package (openscad dependency manager)
pip install scadm

# Install OpenSCAD (Windows/Linux/macOS) + Dependencies
scadm install

# Install pre-commit
pip install pre-commit

# Additional dependencies for OpenSCAD and pre-commit (Ubuntu / Debian)
sudo apt install libopengl0 shellcheck

# Install the git hooks
pre-commit install --install-hooks -t commit-msg -t pre-commit
```

Now pre-commit will automatically run on `git commit`. To manually run hooks on all files:

```bash
pre-commit run --all-files
```

## 📐 HomeRacker Standards

- **Base unit**: 15mm
- **Lock pins**: 4mm square
- **Walls**: 2mm thickness
- **Tolerance**: 0.2mm
- **Quality**: `$fn=100` for production

## 🛠️ Development Guidelines

### Code Standards
- **DRY, KISS, YAGNI** - Keep it simple
- Use [BOSL2](https://github.com/BelfrySCAD/BOSL2/wiki) for complex geometry
- Group parameters with `/* [Section] */` comments
- Add sanity checks: `assert(height % 15 == 0, "Must be multiple of 15mm")`

### Testing
- Render in OpenSCAD without errors
- Test edge cases (min/max parameter values)
- Export to STL and verify mesh integrity

## 📝 Commit Conventions

This project uses [Conventional Commits](https://www.conventionalcommits.org/) for automated changelog generation and semantic versioning.

### Commit Format

```
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

### Commit Types

| Type | Description | Version Bump |
|------|-------------|--------------|
| `feat:` | New feature | **minor** (0.x.0) |
| `fix:` | Bug fix | **patch** (0.0.x) |
| `feat!:` or `fix!:` | Breaking change | **major** (x.0.0) |
| `docs:` | Documentation only | **patch** (0.0.x) |
| `chore:` | Maintenance tasks | **patch** (0.0.x) |
| `refactor:` | Code restructuring | **patch** (0.0.x) |
| `test:` | Adding tests | **patch** (0.0.x) |

### Examples

```bash
# New community creation
feat: add under-desk cable management tray

# Bug fix
fix: correct tolerance in custom bracket holes

# Documentation
docs: add build instructions for monitor stand
```

## 🔄 Pull Request Workflow

1. Create a branch or fork: `git checkout -b feat/my-creation`
2. Make changes following the standards above
3. Test thoroughly
4. Commit: `git commit -m "feat: add cool creation"`
5. Push: `git push origin feat/my-creation`
6. Create a PR with a description and screenshots

## 📂 Project Structure

```
models/              # OpenSCAD models (community contributions)
```

## 💬 Getting Help

- [Open an issue](https://github.com/kellerlabs/homeracker-community/issues) for bugs/features
- [Start a discussion](https://github.com/kellerlabs/homeracker-community/discussions) for questions
- See [kellerlabs/homeracker](https://github.com/kellerlabs/homeracker) for core documentation

## 📜 License

Contributions are licensed under MIT (code) and CC BY-SA 4.0 (models).

---

**Platform**: Windows/Linux/macOS
