#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

python3 -m venv .venv-image
. .venv-image/bin/activate

python -m pip install --index-url https://pypi.org/simple --upgrade pip
python -m pip install --index-url https://pypi.org/simple \
  "Pillow>=10,<12" \
  "pypdf>=6,<7" \
  "zxing-cpp>=2.2,<3"
