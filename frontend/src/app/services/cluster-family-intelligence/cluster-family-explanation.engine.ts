import {
  ClusterFamily,
  ClusterFamilyOverlay,
  ClusterFamilyResearchDetail,
  formatCanonicalRegimeLabel
} from './cluster-family.models';

/** Research / replay expandable copy — never raw cluster spam in primary line. */
export class ClusterFamilyExplanationEngine {
  primaryReplayLine(overlay: ClusterFamilyOverlay): string {
    return formatCanonicalRegimeLabel(overlay.canonicalRegime);
  }

  expandableBlock(overlay: ClusterFamilyOverlay): string[] {
    const d = overlay.researchExpandable;
    const lines: string[] = [];
    if (d.derivedFrom.length) {
      lines.push(`Matched clusters: ${d.derivedFrom.join(', ')}`);
    }
    for (const c of d.confidenceContributions) {
      lines.push(`${c.clusterName} → +${c.delta} (${c.reason})`);
    }
    if (d.whyLines.length) {
      lines.push(`Why: ${d.whyLines.join(' · ')}`);
    }
    return lines;
  }

  discoveryFamilySummary(family: ClusterFamily): string {
    return `${family.displayLabel} · ${family.memberClusterNames.length} clusters · n=${family.sampleCount} · ${family.avgR.toFixed(1)}R avg`;
  }

  formatResearchDetail(detail: ClusterFamilyResearchDetail): string {
    const parts: string[] = [];
    if (detail.derivedFrom.length) {
      parts.push(`Derived from: ${detail.derivedFrom.join(', ')}`);
    }
    for (const c of detail.confidenceContributions) {
      parts.push(`${c.clusterName} → +${c.delta}`);
    }
    return parts.join(' | ');
  }
}
