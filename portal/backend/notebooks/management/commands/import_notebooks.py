import json
import os
from django.core.management.base import BaseCommand
from notebooks.models import Notebook


MERCURY_THUMBNAIL_KEYS = {
    # ipynb key -> Notebook model field
    "thumbnail_bg": "thumbnail_bg",
    "thumbnail_text": "thumbnail_text",
    "thumbnail_text_color": "thumbnail_text_color",
    # common flag name mapping; store if you have a matching field
    "showCode": "show_code",
}


def _read_ipynb_metadata(path):
    """
    Return (data, error) where data is a dict with:
      - title
      - description
      - mercury (raw mercury dict)
      - extra_fields (candidate fields for Notebook, e.g., thumbnails & flags)
    """
    filename_stem = os.path.splitext(os.path.basename(path))[0]
    data_out = {
        "title": filename_stem,
        "description": "",
        "mercury": {},
        "extra_fields": {},
    }

    try:
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
        meta = data.get("metadata", {}) or {}
        mercury = meta.get("mercury", {}) or {}
        data_out["mercury"] = mercury

        # Title with fallbacks
        data_out["title"] = (
            mercury.get("title")
            or meta.get("title")
            or filename_stem
        )

        # Description with fallbacks
        data_out["description"] = (
            mercury.get("description")
            or meta.get("description")
            or ""
        )

        # Collect potential extra fields (thumbnail + flags)
        extra = {}
        for ipynb_key, model_field in MERCURY_THUMBNAIL_KEYS.items():
            if ipynb_key in mercury:
                extra[model_field] = mercury.get(ipynb_key)

        data_out["extra_fields"] = extra

    except Exception as e:
        # Fall back to filename/empty desc; pass back the error
        return data_out, e

    return data_out, None


class Command(BaseCommand):
    help = (
        "Import all .ipynb notebooks from a folder (default: current directory). "
        "Title/description and Mercury thumbnail info are read from notebook metadata."
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

        # Precompute which optional fields exist on the Notebook model
        notebook_fields = {f.name for f in Notebook._meta.get_fields()}
        def _filter_existing_fields(extra_fields: dict) -> dict:
            """Only include keys that correspond to real Notebook fields."""
            return {k: v for k, v in extra_fields.items() if k in notebook_fields}

        for fname in notebooks:
            full_path = os.path.join(folder, fname)

            # Skip if already in DB (by exact absolute path)
            if Notebook.objects.filter(file_path=full_path).exists():
                skipped_existing += 1
                self.stdout.write(
                    self.style.WARNING(f"Already exists, skipping: {fname}")
                )
                continue

            meta_data, error = _read_ipynb_metadata(full_path)
            if error:
                failed += 1
                self.stdout.write(
                    self.style.WARNING(
                        f"Failed to read metadata for '{fname}': {error}. "
                        "Using filename as title and empty description."
                    )
                )

            try:
                base_kwargs = {
                    "name": meta_data["title"],
                    "description": meta_data["description"],
                    "file_path": full_path,
                }

                # Add optional thumbnail/flag fields if the model supports them
                base_kwargs.update(_filter_existing_fields(meta_data.get("extra_fields", {})))

                nb = Notebook.objects.create(**base_kwargs)

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
