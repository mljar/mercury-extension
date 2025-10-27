import json
import os
from django.core.management.base import BaseCommand
from notebooks.models import Notebook


def _read_ipynb_metadata(path):
    """
    Return (title, description) extracted from a .ipynb file's metadata.
    Priority:
      - title: metadata.mercury.title -> metadata.title -> filename (sans .ipynb)
      - description: metadata.mercury.description -> metadata.description -> ""
    """
    filename_stem = os.path.splitext(os.path.basename(path))[0]
    title = filename_stem
    description = ""

    try:
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
        meta = data.get("metadata", {}) or {}
        mercury = meta.get("mercury", {}) or {}

        # Title with fallbacks
        title = (
            mercury.get("title")
            or meta.get("title")
            or filename_stem
        )

        # Description with fallbacks
        description = (
            mercury.get("description")
            or meta.get("description")
            or ""
        )
    except Exception as e:
        # If anything goes wrong, fall back to filename/empty desc.
        # The caller can decide how to log this.
        return title, description, e

    return title, description, None


class Command(BaseCommand):
    help = (
        "Import all .ipynb notebooks from a folder (default: current directory). "
        "Title/description are read from notebook metadata."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "folder",
            nargs="?",
            type=str,
            default=".",
            help="Path to the folder with .ipynb files (default: current directory)",
        )

    def handle(self, *args, **options):
        folder = os.path.abspath(options["folder"])

        if not os.path.isdir(folder):
            self.stdout.write(self.style.ERROR(f"Folder '{folder}' does not exist!"))
            return

        # List all .ipynb files (non-recursive; make it recursive easily if needed)
        notebooks = sorted(
            f for f in os.listdir(folder) if f.lower().endswith(".ipynb")
        )
        if not notebooks:
            self.stdout.write(self.style.WARNING("No .ipynb files found in the folder."))
            return

        self.stdout.write(f"Found {len(notebooks)} notebook(s) in '{folder}'.")

        created = 0
        skipped_existing = 0
        failed = 0

        for fname in notebooks:
            full_path = os.path.join(folder, fname)

            # Skip if already in DB (by exact absolute path)
            if Notebook.objects.filter(file_path=full_path).exists():
                skipped_existing += 1
                self.stdout.write(
                    self.style.WARNING(f"Already exists, skipping: {fname}")
                )
                continue

            title, description, error = _read_ipynb_metadata(full_path)
            if error:
                failed += 1
                self.stdout.write(
                    self.style.WARNING(
                        f"Failed to read metadata for '{fname}': {error}. "
                        "Using filename as title and empty description."
                    )
                )

            try:
                nb = Notebook.objects.create(
                    name=title,
                    description=description,
                    file_path=full_path,
                )
                created += 1
                self.stdout.write(
                    self.style.SUCCESS(
                        f"Imported '{fname}' as '{nb.name}' (id={nb.id})."
                    )
                )
            except Exception as e:
                failed += 1
                self.stdout.write(
                    self.style.ERROR(f"Error creating DB record for '{fname}': {e}")
                )

        self.stdout.write("")  # newline
        self.stdout.write("Summary:")
        self.stdout.write(self.style.SUCCESS(f"  Created: {created}"))
        self.stdout.write(self.style.WARNING(f"  Skipped (already existed): {skipped_existing}"))
        if failed:
            self.stdout.write(self.style.ERROR(f"  Failed: {failed}"))
