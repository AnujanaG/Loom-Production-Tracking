const express = require('express');
const supabase = require('../supabaseClient');
const router = express.Router();

// GET /api/reports/summary?from=2026-01-01&to=2026-01-31
// Returns aggregated totals for the date range, scoped to the org.
// Small-business scale, so aggregating in JS after a filtered fetch is
// simple and fast enough - no need for heavier SQL aggregation yet.
router.get('/summary', async (req, res) => {
  try {
    const orgId = req.profile.organization_id;
    const { from, to } = req.query;

    function applyRange(query, field) {
      if (from) query = query.gte(field, from);
      if (to) query = query.lte(field, to);
      return query;
    }

    let productionQ = supabase.from('production_entries').select('*, employees(name), products(name), machines(name)').eq('organization_id', orgId);
    let expensesQ = supabase.from('expenses').select('*, employees(name)').eq('organization_id', orgId);
    let deliveriesQ = supabase.from('deliveries').select('*, customers(name), products(name)').eq('organization_id', orgId);

    productionQ = applyRange(productionQ, 'production_date');
    expensesQ = applyRange(expensesQ, 'expense_date');
    deliveriesQ = applyRange(deliveriesQ, 'delivery_date');

    const [{ data: production, error: e1 }, { data: expenses, error: e2 }, { data: deliveries, error: e3 }] =
      await Promise.all([productionQ, expensesQ, deliveriesQ]);

    if (e1 || e2 || e3) {
      return res.status(400).json({ error: (e1 || e2 || e3).message });
    }

    // ---- Production summary ----
    const totalQty = production.reduce((s, p) => s + Number(p.quantity || 0), 0);
    const totalWages = production.reduce((s, p) => s + Number(p.wage_amount || 0), 0);

    const byEmployee = {};
    production.forEach(p => {
      const name = p.employees?.name || 'Unknown';
      byEmployee[name] = byEmployee[name] || { quantity: 0, wage: 0 };
      byEmployee[name].quantity += Number(p.quantity || 0);
      byEmployee[name].wage += Number(p.wage_amount || 0);
    });

    // ---- Expense summary ----
    const totalDirect = expenses.filter(e => e.expense_type === 'direct').reduce((s, e) => s + Number(e.amount || 0), 0);
    const totalIndirect = expenses.filter(e => e.expense_type === 'indirect').reduce((s, e) => s + Number(e.amount || 0), 0);

    const byCategory = {};
    expenses.forEach(e => {
      byCategory[e.category] = (byCategory[e.category] || 0) + Number(e.amount || 0);
    });

    // ---- Delivery summary (split Sales vs Own-Use, per FRD's revenue distinction) ----
    const sales = deliveries.filter(d => (d.delivery_type || 'sale') === 'sale');
    const ownUse = deliveries.filter(d => d.delivery_type === 'own_use');

    const totalDelivered = deliveries.reduce((s, d) => s + Number(d.delivered_qty || 0), 0);
    const totalApproved = deliveries.reduce((s, d) => s + Number(d.approved_qty || 0), 0);
    const totalRejected = deliveries.reduce((s, d) => s + Number(d.rejected_qty || 0), 0);

    const salesRevenue = sales.reduce((s, d) => s + Number(d.bill_amount || 0), 0);
    const ownUseValue = ownUse.reduce((s, d) => s + Number(d.bill_amount || 0), 0);
    const totalBill = salesRevenue + ownUseValue;

    const byCustomer = {};
    sales.forEach(d => {
      const name = d.customers?.name || 'Unknown';
      byCustomer[name] = byCustomer[name] || { delivered: 0, approved: 0, rejected: 0, bill: 0 };
      byCustomer[name].delivered += Number(d.delivered_qty || 0);
      byCustomer[name].approved += Number(d.approved_qty || 0);
      byCustomer[name].rejected += Number(d.rejected_qty || 0);
      byCustomer[name].bill += Number(d.bill_amount || 0);
    });

    res.json({
      production: { totalQty, totalWages, byEmployee, entryCount: production.length },
      expenses: { totalDirect, totalIndirect, total: totalDirect + totalIndirect, byCategory },
      deliveries: {
        totalDelivered, totalApproved, totalRejected, totalBill,
        salesRevenue, ownUseValue, salesCount: sales.length, ownUseCount: ownUse.length,
        byCustomer
      }
    });
  } catch (e) {
    res.status(500).json({ error: 'Unexpected server error' });
  }
});

module.exports = router;
