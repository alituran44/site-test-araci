import { Module } from '@nestjs/common';
import { SeoAnalyzer } from './seo/seo.analyzer';
import { GeoAnalyzer } from './geo/geo.analyzer';
import { PerformanceAnalyzer } from './performance/lighthouse.analyzer';
import { SecurityAnalyzer } from './security/security.analyzer';
import { AccessibilityAnalyzer } from './accessibility/axe.analyzer';
import { AiAnalyzer } from './ai/ai.analyzer';

@Module({
  providers: [
    SeoAnalyzer,
    GeoAnalyzer,
    PerformanceAnalyzer,
    SecurityAnalyzer,
    AccessibilityAnalyzer,
    AiAnalyzer,
  ],
  exports: [
    SeoAnalyzer,
    GeoAnalyzer,
    PerformanceAnalyzer,
    SecurityAnalyzer,
    AccessibilityAnalyzer,
    AiAnalyzer,
  ],
})
export class AnalyzersModule {}
