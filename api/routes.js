const express   = require('express');
const router    = express.Router();
const { body, param, validationResult } = require('express-validator');
const monitorController = require('./monitorController');
const authMiddleware    = require('../middleware/auth');

router.use(authMiddleware);

router.post(
    '/',
    [
        body('target').notEmpty().isLength({ max: 255 }),
        body('target_type').isIn(['DOMAIN', 'IP']),
        body('notification_email').isEmail(),
        body('protocol').optional().isIn(['HTTP', 'HTTPS', 'PING', 'TCP']),
        body('port').optional().isInt({ min: 1, max: 65535 }),
        body('check_interval_seconds').optional().isInt({ min: 30, max: 86400 }),
    ],
    validate,
    monitorController.create
);

router.get('/', monitorController.list);

router.get(
    '/:id',
    [param('id').isInt()],
    validate,
    monitorController.getOne
);

router.patch(
    '/:id',
    [
        param('id').isInt(),
        body('notification_email').optional().isEmail(),
        body('check_interval_seconds').optional().isInt({ min: 30, max: 86400 }),
        body('is_active').optional().isBoolean(),
    ],
    validate,
    monitorController.update
);

router.delete(
    '/:id',
    [param('id').isInt()],
    validate,
    monitorController.remove
);

router.get(
    '/:id/history',
    [param('id').isInt()],
    validate,
    monitorController.getHistory
);

function validate(req, res, next) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    next();
}

module.exports = router;
