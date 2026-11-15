/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { EvaluationReport } from '../types';

class ReportService {
  private reports: Map<string, EvaluationReport> = new Map();

  /**
   * Lấy báo cáo chi tiết theo reportId
   */
  getReportById(reportId: string): EvaluationReport | null {
    return this.reports.get(reportId) || null;
  }

  /**
   * Lấy báo cáo mới nhất (mặc định cho bản demo)
   */
  getLatestReport(): EvaluationReport | null {
    return null;
  }
}

export const reportService = new ReportService();
