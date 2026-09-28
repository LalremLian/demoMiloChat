/**
 * Consistent API response helpers.
 * Use these in every controller — never call res.json() directly.
 *
 * Success shape:       { "success": true, "data": { ... } }
 * Paginated shape:     { "success": true, "data": [...], "page": 1, "pageSize": 20, "total": 100, "hasMore": true }
 * Error shape:         { "success": false, "message": "...", "code": 400 }
 */

/**
 * Send a successful response.
 * @param {import('express').Response} res
 * @param {*} data        - Payload for the "data" field
 * @param {number} status - HTTP status code (default 200)
 */
const success = (res, data, status = 200) =>
  res.status(status).json({ success: true, data });

/**
 * Send a paginated list response.
 * Pagination fields are hoisted to the top level alongside "data".
 *
 * @param {import('express').Response} res
 * @param {Array}  items      - The list to return in "data"
 * @param {object} pagination - { page, pageSize, total }
 * @param {number} status     - HTTP status code (default 200)
 */
const paginated = (res, items, { page, pageSize, total }, status = 200) =>
  res.status(status).json({
    success: true,
    data: items,
    page,
    pageSize,
    total,
    hasMore: page * pageSize < total,
  });

/**
 * Send an error response.
 * @param {import('express').Response} res
 * @param {string} message  - Human-readable error description
 * @param {number} status   - HTTP status code (default 400)
 * @param {number} code     - Application-level error code (defaults to status)
 */
const error = (res, message, status = 400, code = status) =>
  res.status(status).json({ success: false, message, code });

module.exports = { success, paginated, error };
