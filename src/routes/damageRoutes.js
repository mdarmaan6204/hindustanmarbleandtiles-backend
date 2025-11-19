import express from 'express';
import { recordDamage } from '../controllers/damageController.js';

const router = express.Router();

// POST /api/damage/record - Record damage transaction
router.post('/record', recordDamage);

export default router;
