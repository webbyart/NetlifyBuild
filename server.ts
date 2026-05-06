import dotenv from "dotenv";
dotenv.config({ override: true });

import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import { supabase } from "./src/lib/supabase.ts";
import QRCode from "qrcode";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());

// Supabase Connection Log
const supabaseUrl = process.env.VITE_SUPABASE_URL || 'glkuxiseyxvwtduydxkp default';
console.log(`Connecting to Supabase at: ${supabaseUrl}`);

// API Routes
app.get("/api/health", (req, res) => res.json({ status: "ok", timestamp: new Date() }));

// Auth
app.post("/api/login", async (req, res) => {
  const { username, password } = req.body;

  // Fallback hardcoded admin for rescue
  if (username === 'admin' && password === '1234') {
    return res.json({ id: 'admin-id', name: 'Admin User', username: 'admin', role: 'ADMIN' });
  }

  const { data: user } = await supabase
    .from("users")
    .select("*")
    .eq("username", username)
    .eq("password", password)
    .single();

  if (user) {
    const { password, ...userWithoutPassword } = user;
    res.json(userWithoutPassword);
  } else {
    res.status(401).json({ message: "Username หรือ Password ไม่ถูกต้อง" });
  }
});

// Products
app.get("/api/products", async (req, res) => {
  const { data: products } = await supabase.from("products").select("*").order("name", { ascending: true });
  res.json(products || []);
});

app.get("/api/products/low-stock", async (req, res) => {
  const { data: products } = await supabase.from("products").select("*");
  const lowStock = products?.filter(p => Number(p.stock_qty) <= Number(p.min_alert));
  res.json(lowStock || []);
});

app.post("/api/products/bulk", async (req, res) => {
  const productsData = req.body;
  if (!Array.isArray(productsData)) return res.status(400).json({ error: "Invalid data" });

  // Clean data: Ensure numeric fields are numbers
  const cleaned = productsData.map(p => ({
    ...p,
    stock_qty: Number(p.stock_qty) || 0,
    cost_price: Number(p.cost_price) || 0,
    min_alert: Number(p.min_alert) || 0
  }));

  const { data, error } = await supabase
    .from("products")
    .upsert(cleaned, { onConflict: 'qr_code' })
    .select();

  if (error) {
    console.error('Bulk upsert error:', error);
    return res.status(500).json({ message: error.message });
  }
  res.json(data);
});

app.get("/api/products/:id/qr", async (req, res) => {
  const { data: product } = await supabase.from("products").select("*").eq("id", req.params.id).single();
  if (!product) return res.status(404).json({ message: "ไม่พบสินค้า" });
  try {
    const qrDataUrl = await QRCode.toDataURL(product.qr_code || product.id);
    res.json({ qrDataUrl });
  } catch (err) {
    res.status(500).json({ message: "Error" });
  }
});

app.put("/api/products/:id", async (req, res) => {
  const { id } = req.params;
  const { name, category, cost_price, min_alert, unit, sub_units } = req.body;
  const { error } = await supabase
    .from('products')
    .update({ name, category, cost_price, min_alert, unit, sub_units: sub_units || null })
    .eq('id', id);
  if (error) return res.status(500).json({ message: error.message });
  res.json({ success: true });
});

// Projects
app.get("/api/projects", async (req, res) => {
  const { data: projects } = await supabase.from("projects").select("*").order("id", { ascending: false });
  res.json(projects || []);
});

app.post("/api/projects", async (req, res) => {
  const { name, customer, start_date, end_date, budget } = req.body;
  const { data, error } = await supabase
    .from("projects")
    .insert([{ name, customer, start_date, end_date, status: "in-progress", budget: budget || 0 }])
    .select()
    .single();
  if (error) return res.status(500).json({ message: error.message });
  res.json({ success: true, id: data.id });
});

app.get("/api/projects/:id/plan", async (req, res) => {
  const { data: plan } = await supabase
    .from('project_material_plan')
    .select(`*, products (name, unit, stock_qty)`)
    .eq('project_id', req.params.id);
  res.json(plan || []);
});

app.get("/api/projects/:id/summary", async (req, res) => {
  const { data: txns } = await supabase
    .from('stock_transactions')
    .select('qty, total_price')
    .eq('project_id', req.params.id)
    .eq('status', 'APPROVED')
    .eq('type', 'ISSUE');
  
  const total_cost = txns?.reduce((sum, t) => sum + Number(t.total_price), 0) || 0;
  const issue_count = txns?.length || 0;
  res.json({ total_cost, issue_count });
});

app.get("/api/projects/:id/issues", async (req, res) => {
  const { data: issues } = await supabase
    .from('stock_transactions')
    .select(`*, products (name, unit)`)
    .eq('project_id', req.params.id)
    .eq('type', 'ISSUE')
    .order('datetime', { ascending: false });
  
  const flatIssues = issues?.map((i: any) => ({
    ...i,
    product_name: i.products?.name,
    unit: i.products?.unit
  }));
  res.json(flatIssues || []);
});

// Transactions
app.get("/api/transactions", async (req, res) => {
  const { projectId } = req.query;
  let query = supabase.from("stock_transactions").select(`*, products (name, unit), users (name), projects (name)`);
  if (projectId && projectId !== "ALL") query = query.eq("project_id", projectId);
  const { data: transactions } = await query.order("datetime", { ascending: false }).limit(150);
  const flatTx = transactions?.map((st: any) => ({
    ...st,
    product_name: st.products?.name,
    unit: st.products?.unit,
    user_name: st.users?.name,
    project_name: st.projects?.name
  }));
  res.json(flatTx || []);
});

app.get("/api/transactions/pending/count", async (req, res) => {
  const { count } = await supabase.from('stock_transactions').select('*', { count: 'exact', head: true }).eq('status', 'PENDING');
  res.json({ count: count || 0 });
});

app.post("/api/transactions", async (req, res) => {
  const { type, product_id, selected_qty, selected_unit, user_id, project_id, requester_name, note } = req.body;
  const qty = Number(selected_qty);
  const { data: product } = await supabase.from("products").select("*").eq("id", product_id).single();
  if (!product) return res.status(404).json({ message: "No product" });
  
  const totalPrice = Number(product.cost_price) * qty;
  const datetime = new Date().toLocaleString("sv-SE", { timeZone: "Asia/Bangkok" }).substring(0, 19);
  
  const { data: newTx, error } = await supabase
    .from("stock_transactions")
    .insert([{ type, product_id, qty, selected_unit, selected_qty, unit_price: product.cost_price, total_price: totalPrice, project_id: project_id || null, user_id, requester_name, status: (type === "ISSUE" ? "PENDING" : "APPROVED"), datetime }])
    .select()
    .single();

  if (error) return res.status(500).json({ message: error.message });

  if (newTx.status === "APPROVED") {
    let stockUpdate = (type === "RECEIVE" || type === "RETURN") ? qty : (type === "ISSUE" ? -qty : 0);
    await supabase.rpc("increment_stock", { p_id: product_id, p_qty: stockUpdate });
  }

  // Simplified Line Notify (optional)
  if (process.env.LINE_CHANNEL_ACCESS_TOKEN) {
      sendLineSimple(`\ud83d\udce6 ${type}: ${product.name} จำนวน ${selected_qty} ${selected_unit}`);
  }

  res.json({ success: true, id: newTx.id, status: newTx.status });
});

app.post("/api/transactions/:id/approve", async (req, res) => {
  const { id } = req.params;
  const { data: txn } = await supabase.from('stock_transactions').select('*').eq('id', id).single();
  if (!txn || txn.status !== 'PENDING') return res.status(400).json({ message: "Invalid transaction" });
  await supabase.from('stock_transactions').update({ status: 'APPROVED' }).eq('id', id);
  if (txn.type === 'ISSUE') {
    await supabase.rpc('increment_stock', { p_id: txn.product_id, p_qty: -Number(txn.qty) });
  }
  res.json({ success: true });
});

// Dashboard
app.get("/api/dashboard", async (req, res) => {
  const { count: projectCount } = await supabase.from("projects").select("*", { count: "exact", head: true });
  const { data: products } = await supabase.from("products").select("stock_qty, cost_price, min_alert");
  const { data: txns } = await supabase.from("stock_transactions").select("type, total_price, status, project_id, projects(name, budget)");
  const { count: pendingCount } = await supabase.from("stock_transactions").select("*", { count: "exact", head: true }).eq("status", "PENDING");

  const stockValue = products?.reduce((sum, p) => sum + (Number(p.stock_qty) * Number(p.cost_price)), 0) || 0;
  const alertCount = products?.filter(p => Number(p.stock_qty) <= Number(p.min_alert)).length || 0;
  
  const approvedIssues = txns?.filter(t => t.type === 'ISSUE' && t.status === 'APPROVED') || [];
  const totalSpent = approvedIssues.reduce((sum, t) => sum + Number(t.total_price), 0);

  // Group by project
  const projectStatsMap: Record<string, any> = {};
  txns?.forEach(t => {
    if (!t.project_id) return;
    const pid = t.project_id;
    if (!projectStatsMap[pid]) {
      const pData = Array.isArray(t.projects) ? t.projects[0] : t.projects;
      projectStatsMap[pid] = {
        name: pData?.name || 'Unknown',
        budget: pData?.budget || 0,
        total_cost: 0,
        pending_cost: 0,
        issue_count: 0
      };
    }
    if (t.type === 'ISSUE') {
      if (t.status === 'APPROVED') {
        projectStatsMap[pid].total_cost += Number(t.total_price);
        projectStatsMap[pid].issue_count += 1;
      } else if (t.status === 'PENDING') {
        projectStatsMap[pid].pending_cost += Number(t.total_price);
      }
    }
  });

  const costsByProject = Object.values(projectStatsMap);

  res.json({ 
    projectCount: projectCount || 0, 
    stockValue, 
    alertCount, 
    totalSpent, 
    costsByProject,
    pendingCount: pendingCount || 0
  });
});

async function sendLineSimple(text: string) {
  let token = (process.env.LINE_CHANNEL_ACCESS_TOKEN || "").trim();
  const groupId = (process.env.LINE_GROUP_ID || "Cd597a0c0fec4e516bc97c3d3d8d71a09").trim();
  if (!token || !text) return;
  try { 
      await fetch("https://api.line.me/v2/bot/message/push", { 
          method: "POST", 
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` }, 
          body: JSON.stringify({ to: groupId, messages: [{ type: "text", text }] }) 
      }); 
  } catch (err) {}
}

// Vite Middleware
async function start() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: "spa" });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(process.cwd(), "dist")));
    app.get("*", (req, res) => res.sendFile(path.join(process.cwd(), "dist", "index.html")));
  }
  
  const PORT = 3000;
  app.listen(PORT, "0.0.0.0", () => console.log(`Server on http://localhost:${PORT}`));
}

if (process.env.NODE_ENV !== "test") {
  start();
}

export default app;
