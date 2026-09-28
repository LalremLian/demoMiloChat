const express = require('express');
const router = express.Router();

const { uploadImage, uploadFile } = require('../controllers/uploadController');
const { verifyToken } = require('../middleware/auth');

// All upload routes require authentication
router.use(verifyToken);

// POST /api/uploads/image   multipart/form-data  field: file
router.post('/image', uploadImage);

// POST /api/uploads/file    multipart/form-data  field: file
router.post('/file', uploadFile);

module.exports = router;
