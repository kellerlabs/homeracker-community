#!/usr/bin/env python3
"""
Export OpenSCAD files for MakerWorld by inlining local includes.

MakerWorld's parametric model feature doesn't support multiple files.
This script merges all local includes into a single file while preserving
BOSL2 library references and the root file's parameters.

Adapted from kellerlabs/homeracker for the community repository.
Supports resolving includes from scadm-installed dependencies.
"""

import re
import sys
from pathlib import Path
from typing import Set


def strip_comments(content: str) -> str:
    """Remove single-line and multi-line comments from SCAD content."""
    content = re.sub(r"/\*.*?\*/", "", content, flags=re.DOTALL)
    content = re.sub(r"//.*?$", "", content, flags=re.MULTILINE)
    return content


def extract_parameters(content: str) -> str:
    """Extract all parameter sections from root file, excluding Hidden section."""
    sections = []
    current_pos = 0

    while True:
        match = re.search(r"/\*\s*\[(.+?)\]\s*\*/", content[current_pos:])
        if not match:
            break

        section_name = match.group(1)
        if section_name.lower() == "hidden":
            break

        section_start = current_pos + match.start()
        current_pos += match.end()

        next_section = re.search(r"/\*\s*\[.+?\]\s*\*/|\n\s*(?:include|use|module|function)\s+", content[current_pos:])
        if next_section:
            section_end = current_pos + next_section.start()
        else:
            section_end = len(content)

        sections.append(content[section_start:section_end])

    return "\n".join(sections).strip() if sections else ""


def extract_hidden_section(content: str) -> str:
    """Extract hidden section content from root file (if it exists)."""
    match = re.search(r"/\*\s*\[Hidden\]\s*\*/.*?(?=\n(?:module|function)\s+\w+)", content, re.DOTALL)
    return match.group(0) if match else ""


def get_includes(content: str) -> list:
    """Extract all include/use statements with their paths."""
    pattern = r"^\s*(include|use)\s*<([^>]+)>\s*$"
    return re.findall(pattern, content, re.MULTILINE)


def is_bosl2(path: str) -> bool:
    """Check if path references BOSL2 library (preserved in exports)."""
    return path.startswith("BOSL2/")


def resolve_path(current_file: Path, include_path: str, search_paths: list = None) -> Path:
    """Resolve include path by searching current file's directory, then search paths.

    Searches in order:
    1. Current file's directory (for relative includes)
    2. Additional search paths (project root, models/ dir, scadm libraries)
    """
    candidate = (current_file.parent / include_path).resolve()
    if candidate.exists():
        return candidate

    for sp in (search_paths or []):
        candidate = (sp / include_path).resolve()
        if candidate.exists():
            return candidate

    return (current_file.parent / include_path).resolve()


def has_parameter_section(content: str) -> bool:
    """Check if content has any parameter section marker /* [Name] */."""
    return bool(re.search(r"/\*\s*\[.+?\]\s*\*/", content))


def extract_definitions(content: str) -> str:
    """Extract module/function definitions and top-level variables."""
    lines = content.split("\n")
    result = []
    in_definition = False
    in_variable = False
    brace_count = 0

    for line in lines:
        stripped = line.strip()

        if re.match(r"^(module|function)\s+\w+", stripped):
            in_definition = True

        if not in_definition and not in_variable and re.match(r"^\w+\s*=", stripped):
            in_variable = True
            result.append(line)
            if ";" in stripped:
                in_variable = False
            continue

        if in_variable:
            result.append(line)
            if ";" in stripped:
                in_variable = False
            continue

        if in_definition:
            result.append(line)
            brace_count += line.count("{") - line.count("}")
            if brace_count == 0 and "{" in line:
                in_definition = False

    return "\n".join(result)


def process_file(file_path: Path, processed: Set[Path], bosl2_includes: Set[str], search_paths: list = None) -> str:
    """Recursively process a library file and inline its local includes."""
    if file_path in processed:
        return ""

    processed.add(file_path)
    content = file_path.read_text(encoding="utf-8")

    if has_parameter_section(content):
        raise ValueError(
            f"Library file contains parameter section: {file_path}\n"
            f"Library files should not have /* [SectionName] */ markers.\n"
            f"(Re)move them and re-run the export!"
        )

    result = []

    for directive, path in get_includes(content):
        if is_bosl2(path):
            bosl2_includes.add(f"{directive} <{path}>")
        else:
            resolved = resolve_path(file_path, path, search_paths)
            if resolved.exists():
                inlined = process_file(resolved, processed, bosl2_includes, search_paths)
                if inlined:
                    result.append(inlined)

    clean_content = strip_comments(content)
    clean_content = extract_definitions(clean_content)
    clean_content = re.sub(r"^\s*(include|use)\s*<[^>]+>\s*$", "", clean_content, flags=re.MULTILINE)
    clean_content = re.sub(r"\n\s*\n\s*\n+", "\n\n", clean_content)
    clean_content = clean_content.strip()

    if clean_content:
        result.append(clean_content)
    return "\n\n".join(result)


def extract_main_code(content: str) -> str:
    """Extract main code: module/function definitions and top-level invocations."""
    content = strip_comments(content)
    last_section = None
    for match in re.finditer(r"/\*\s*\[.+?\]\s*\*/", content):
        last_section = match

    if last_section:
        content = content[last_section.end():]

    content = re.sub(r"^\s*(include|use)\s*<[^>]+>\s*$", "", content, flags=re.MULTILINE)

    lines = content.split("\n")
    result = []
    brace_depth = 0
    for line in lines:
        stripped = line.strip()
        if brace_depth == 0:
            if not stripped or re.match(r"^\w+\s*=.*;\s*$", stripped):
                brace_depth += line.count("{") - line.count("}")
                continue
        result.append(line)
        brace_depth += line.count("{") - line.count("}")

    return "\n".join(result).strip()


def build_search_paths(input_file: Path) -> list:
    """Build search paths including scadm library directories."""
    project_root = input_file.resolve()
    while project_root.parent != project_root and not (project_root / "models").exists():
        project_root = project_root.parent

    search_paths = [project_root]
    if (project_root / "models").exists():
        search_paths.append(project_root / "models")

    # Add scadm-installed library paths
    scadm_libs = project_root / "bin" / "openscad" / "libraries"
    if scadm_libs.exists():
        search_paths.append(scadm_libs)
        # Also search inside each installed library (e.g., homeracker/)
        for lib_dir in scadm_libs.iterdir():
            if lib_dir.is_dir() and lib_dir.name != "BOSL2":
                search_paths.append(lib_dir)
                # Support includes like <models/core/lib/constants.scad>
                if (lib_dir / "models").exists():
                    search_paths.append(lib_dir / "models")

    return search_paths


def export_for_makerworld(input_file: Path, output_file: Path):
    """Export SCAD file with inlined includes for MakerWorld."""
    processed: Set[Path] = set()
    bosl2_includes: Set[str] = set()

    search_paths = build_search_paths(input_file)

    root_content = input_file.read_text(encoding="utf-8")
    params = extract_parameters(root_content)
    hidden = extract_hidden_section(root_content)
    main_code = extract_main_code(root_content)

    processed.add(input_file)
    inlined_libs = []
    for directive, path in get_includes(root_content):
        if is_bosl2(path):
            bosl2_includes.add(f"{directive} <{path}>")
        else:
            resolved = resolve_path(input_file, path, search_paths)
            if resolved.exists():
                lib_content = process_file(resolved, processed, bosl2_includes, search_paths)
                if lib_content:
                    inlined_libs.append(lib_content)

    # Build final output
    output_parts = []

    if bosl2_includes:
        output_parts.extend(sorted(bosl2_includes))
        output_parts.append("")

    if params:
        output_parts.append(params.strip())
        output_parts.append("")

    output_parts.append("/* [Hidden] */")
    if inlined_libs:
        output_parts.append("\n\n".join(inlined_libs))
    if hidden:
        hidden_content = re.sub(r"/\*\s*\[Hidden\]\s*\*/", "", hidden).strip()
        if hidden_content:
            output_parts.append(hidden_content)

    output_parts.append("")
    output_parts.append(main_code)

    output_text = "\n".join(output_parts)
    output_text = "\n".join(line.rstrip() for line in output_text.split("\n"))
    if not output_text.endswith("\n"):
        output_text += "\n"

    output_file.write_text(output_text, encoding="utf-8", newline="\n")
    print(f"Exported: {output_file}")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        print(f"Usage: {sys.argv[0]} <input.scad>")
        sys.exit(1)

    input_path = Path(sys.argv[1])
    if not input_path.exists():
        print(f"Error: {input_path} not found")
        sys.exit(1)

    # Output to models/<model_type>/makerworld/
    project_root = input_path
    while project_root.parent != project_root and not (project_root / "models").exists():
        project_root = project_root.parent

    models_dir = project_root / "models"
    relative_path = input_path.relative_to(models_dir)

    if len(relative_path.parts) > 1:
        model_type = relative_path.parts[0]
        output_path = models_dir / model_type / "makerworld" / input_path.name
    else:
        output_path = models_dir / "makerworld" / input_path.name
    output_path.parent.mkdir(parents=True, exist_ok=True)

    export_for_makerworld(input_path, output_path)
