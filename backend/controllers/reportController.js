/**
 * Report Controller (HTTP Handler Layer - Day 14)
 * 
 * Handles HTTP requests for analytics reports and CSV downloads.
 */

import * as reportService from '../services/reportService.js';

/**
 * @desc   Get comprehensive JSON report for a group
 * @route  GET /api/reports/group/:groupId
 * @access Authenticated
 */
export async function getGroupReportHandler(req, res, next) {
  try {
    const { groupId } = req.params;
    const report = await reportService.generateGroupReport(groupId, req.user);
    res.status(200).json({
      success: true,
      data: report,
    });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({
        success: false,
        error: error.message,
      });
    }
    next(error);
  }
}

/**
 * @desc   Download group report formatted as CSV file
 * @route  GET /api/reports/group/:groupId/csv
 * @access Authenticated
 */
export async function getGroupReportCsvHandler(req, res, next) {
  try {
    const { groupId } = req.params;
    const { csvText, filename } = await reportService.generateGroupReportCSV(groupId, req.user);

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.status(200).send(csvText);
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({
        success: false,
        error: error.message,
      });
    }
    next(error);
  }
}
