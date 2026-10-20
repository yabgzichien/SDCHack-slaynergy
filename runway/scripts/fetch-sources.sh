#!/usr/bin/env bash
# Re-creates data/raw/ (git-ignored) from the public sources. Then run: npm run data:build
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p data/raw/{dosm,epoch,ilo,aei_2025_02_10}

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
echo "Done. Now run: npm run data:build"
