/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { EvaluationReport } from '../types';
import { mockDefaultReport } from '../data/mockData';

class ReportService {
  private reports: Map<string, EvaluationReport> = new Map([
    ['rep_01', mockDefaultReport],
  ]);

  /**
   * Lấy báo cáo chi tiết theo reportId
   */
  getReportById(reportId: string): EvaluationReport {
    return this.reports.get(reportId) || mockDefaultReport;
  }

  /**
   * Lấy báo cáo mới nhất (mặc định cho bản demo)
   */
  getLatestReport(): EvaluationReport {
    return mockDefaultReport;
  }
}

export const reportService = new ReportService();
