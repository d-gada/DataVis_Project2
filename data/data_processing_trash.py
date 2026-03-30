import argparse
import csv
from pathlib import Path


ALLOWED_SR_TYPES = {
	"MTL-FRN",
	"YDWSTA-J",
	"RF-COLLT",
	"PLCJUNKV",
	"LTRSTPNH",
	"CAN-DAMG",
	"TRREPR",
	"LITR-PRV",
	"TRASH-I",
	"RWFRNTRT",
	"BLKYMST",
	"TRASH-RE",
	"RCYCLNG",
}


def filter_by_sr_type(input_csv: Path, output_csv: Path) -> tuple[int, int]:
	"""Read input CSV, keep rows with SR_TYPE in ALLOWED_SR_TYPES, and write output CSV."""
	kept = 0
	total = 0

	with input_csv.open("r", newline="", encoding="utf-8-sig") as infile:
		reader = csv.DictReader(infile)
		if not reader.fieldnames:
			raise ValueError("Input CSV has no header row.")

		if "SR_TYPE" not in reader.fieldnames:
			raise ValueError("Input CSV is missing required 'SR_TYPE' column.")

		with output_csv.open("w", newline="", encoding="utf-8") as outfile:
			writer = csv.DictWriter(outfile, fieldnames=reader.fieldnames)
			writer.writeheader()

			for row in reader:
				total += 1
				sr_type = (row.get("SR_TYPE") or "").strip().upper()
				if sr_type in ALLOWED_SR_TYPES:
					writer.writerow(row)
					kept += 1

	return total, kept


def parse_args() -> argparse.Namespace:
	script_dir = Path(__file__).resolve().parent
	parser = argparse.ArgumentParser(
		description="Filter 311 records to a predefined set of SR_TYPE values.",
	)
	parser.add_argument(
		"--input",
		type=Path,
		default=script_dir / "311_Trash.csv",
		help="Path to source CSV (default: data/311_Trash.csv)",
	)
	parser.add_argument(
		"--output",
		type=Path,
		default=script_dir / "311_Trash_processed.csv",
		help="Path to filtered CSV (default: data/311_Trash_processed.csv)",
	)
	return parser.parse_args()


def main() -> None:
	args = parse_args()
	input_path = args.input.resolve()
	output_path = args.output.resolve()

	if not input_path.exists():
		raise FileNotFoundError(f"Input file not found: {input_path}")

	total_rows, kept_rows = filter_by_sr_type(input_path, output_path)

	print(f"Input: {input_path}")
	print(f"Output: {output_path}")
	print(f"Total rows read: {total_rows}")
	print(f"Rows kept: {kept_rows}")
	print(f"Rows removed: {total_rows - kept_rows}")


if __name__ == "__main__":
	main()
