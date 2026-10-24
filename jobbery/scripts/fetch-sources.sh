#!/usr/bin/env bash
# Re-creates data/raw/ (git-ignored) from the public sources. Then run: npm run data:build
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p data/raw/{dosm,epoch,ilo,aei_2025_02_10,opendosm,geo}

# DOSM Job Market Insights, 2026 Q2 release (published 2026-08-18)
curl -fsSL "https://www.dosm.gov.my/portal-main/release-document-log?release_document_id=20742" -o data/raw/dosm/jmi_q2_2026.xlsx

# Epoch AI benchmarking data (CC-BY 4.0)
curl -fsSL https://epoch.ai/data/benchmark_data.zip -o /tmp/epoch_benchmarks.zip
unzip -oq /tmp/epoch_benchmarks.zip -d data/raw/epoch

# ILO 2025 GenAI exposure scores (CC BY 4.0)
curl -fsSL "https://github.com/pgmyrek/2025_GenAI_scores_ISCO08/raw/main/Final_Scores_ISCO08_Gmyrek_et_al_2025.xlsx" -o data/raw/ilo/ilo.xlsx

# Anthropic Economic Index, release 2025-02-10 (CC-BY)
for f in onet_task_mappings.csv onet_task_statements.csv SOC_Structure.csv automation_vs_augmentation.csv README.md; do
  curl -fsSL "https://huggingface.co/datasets/Anthropic/EconomicIndex/resolve/main/release_2025_02_10/$f" -o "data/raw/aei_2025_02_10/$f"
done
# State-level labour market (job map): OpenDOSM (CC BY 4.0), DOSM via data.gov.my (CC BY), geoBoundaries (ODbL 1.0)
curl -fsSL https://storage.dosm.gov.my/labour/lfs_qtr_state.csv -o data/raw/opendosm/lfs_qtr_state.csv
curl -fsSL https://storage.dosm.gov.my/labour/wages_state.csv -o data/raw/opendosm/wages_state.csv
curl -fsSL https://github.com/wmgeolab/geoBoundaries/raw/9469f09/releaseData/gbOpen/MYS/ADM1/geoBoundaries-MYS-ADM1_simplified.geojson -o data/raw/geo/mys_adm1_simplified.geojson

# DOSM Labour Force Survey Report 2024 (annual, published 2025-06-30; the newest with state tables, as the 2025 file is a 16-page summary). Table B4.5 (PDF page 251): employed persons by state and occupation
# (MASCO major group); Table B4.8 (PDF pages 256-258): employed persons by state and industry.
# Only the PDF is published; pdftotext (poppler-utils) turns those pages into text for scripts/extract-state-occupation.mjs.
curl -fsSL https://storage.dosm.gov.my/labour/lfs_annual_2024.pdf -o data/raw/dosm/lfs_annual_2024.pdf
for p in 251 256 257 258; do pdftotext -layout -f $p -l $p data/raw/dosm/lfs_annual_2024.pdf data/raw/dosm/lfs_annual_2024_p$p.txt; done
node scripts/extract-state-occupation.mjs

echo "Done. Now run: npm run data:build"
