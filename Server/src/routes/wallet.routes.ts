import { Router } from 'express';
import { isAuthenticated } from '../middleware/auth.middleware.js';
import {
  getWallet,
  getTransactions,
  getTransaction,
  createDeposit,
  handleMomoDepositWebhook,
  handleSePayDepositWebhook,
  handleSePayIpnWebhook,
  handlePayPalDepositWebhook,
} from '../controllers/wallet.controller.js';

const router = Router();

router.get('/', isAuthenticated, getWallet);
router.get('/transactions', isAuthenticated, getTransactions);
router.get('/transactions/:id', isAuthenticated, getTransaction);
router.post('/deposit', isAuthenticated, createDeposit);
router.post('/webhook/momo', handleMomoDepositWebhook);
router.get('/webhook/sepay', handleSePayDepositWebhook);
router.post('/webhook/sepay', handleSePayDepositWebhook);
router.post('/webhook/sepay-ipn', handleSePayIpnWebhook);
router.post('/webhook/paypal', handlePayPalDepositWebhook);

export default router;
