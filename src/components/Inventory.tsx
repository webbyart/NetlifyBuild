import React, { useState, useEffect } from 'react';
import { 
  Package, 
  Search, 
  Filter, 
  AlertTriangle, 
  Plus, 
  Download,
  MoreVertical,
  QrCode,
  X,
  Printer
} from 'lucide-react';
import { motion } from 'motion/react';
import { Product } from '../types';

export default function Inventory() {
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [filterMode, setFilterMode] = useState<'ALL' | 'LOW'>('ALL');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedQR, setSelectedQR] = useState<{ url: string, name: string } | null>(null);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [editFormData, setEditFormData] = useState<any>(null);

  const fetchProducts = () => {
    fetch('/api/products')
      .then(res => res.json())
      .then(data => {
        setProducts(data);
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  const handleEdit = (p: Product) => {
    setEditingProduct(p);
    setEditFormData({ ...p });
  };

  const saveEdit = async () => {
    if (!editingProduct) return;
    if (!confirm(`ยืนยันการแก้ไขข้อมูล ${editingProduct.name}?`)) return;

    try {
      const res = await fetch(`/api/products/${editingProduct.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editFormData)
      });
      if (res.ok) {
        setEditingProduct(null);
        fetchProducts();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const viewQR = async (p: Product) => {
    try {
      const res = await fetch(`/api/products/${p.id}/qr`);
      const data = await res.json();
      setSelectedQR({ url: data.qrDataUrl, name: p.name });
    } catch (err) {
      console.error(err);
    }
  };

  const categories = ['ALL', ...new Set(products.map(p => p.category))];

  const filtered = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase()) || 
                         p.category.toLowerCase().includes(search.toLowerCase());
    const matchesFilter = filterMode === 'ALL' || p.stock_qty <= p.min_alert;
    const matchesCategory = selectedCategory === 'ALL' || p.category === selectedCategory;
    return matchesSearch && matchesFilter && matchesCategory;
  });

  return (
    <div className="space-y-[15px]">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-xl font-semibold text-gray-800">คลังสินค้าและวัสดุ</h1>
        <button className="bg-admin-blue text-white px-3 py-1.5 rounded text-xs font-bold shadow-sm hover:bg-blue-600 transition-colors flex items-center gap-2">
          <Plus className="w-3.5 h-3.5" /> เพิ่มสินค้าใหม่
        </button>
      </div>

      <div className="admin-card border-t-0 overflow-hidden">
        {/* Filters */}
        <div className="p-3 border-b border-gray-100 flex flex-col md:flex-row gap-3 bg-gray-50/50">
          <div className="flex gap-1 bg-white p-1 rounded-lg border border-gray-100 h-fit">
            <button 
              onClick={() => setFilterMode('ALL')}
              className={`px-3 py-1 rounded text-[10px] font-black uppercase transition-all ${filterMode === 'ALL' ? 'bg-admin-dark text-white' : 'text-gray-400 hover:text-gray-600'}`}
            >
              ทั้งหมด
            </button>
            <button 
              onClick={() => setFilterMode('LOW')}
              className={`px-3 py-1 rounded text-[10px] font-black uppercase transition-all flex items-center gap-1 ${filterMode === 'LOW' ? 'bg-admin-danger text-white' : 'text-gray-400 hover:text-gray-600'}`}
            >
              <AlertTriangle className="w-3 h-3" /> สต๊อกต่ำ
            </button>
          </div>

          <div className="flex items-center gap-2 bg-white px-2 rounded-lg border border-gray-100">
            <Filter className="w-3 h-3 text-gray-400" />
            <select 
              className="bg-transparent border-none text-[10px] font-black uppercase outline-none py-1.5 min-w-[100px]"
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
            >
              {categories.map(c => (
                <option key={c} value={c}>{c === 'ALL' ? 'All Categories' : c}</option>
              ))}
            </select>
          </div>

          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <input 
              type="text" 
              placeholder="ค้นหา..."
              className="w-full pl-9 pr-3 py-1.5 bg-white border border-gray-200 rounded text-xs focus:ring-1 focus:ring-admin-blue outline-none transition-all"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="flex gap-2">
             <button className="flex items-center gap-2 px-3 py-1.5 bg-white border border-gray-200 rounded text-xs font-bold text-gray-600 hover:bg-gray-50">
              <Download className="w-3.5 h-3.5" /> Export
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto max-h-[500px]">
          <table className="w-full text-left text-[13px]">
            <thead className="sticky top-0 z-10">
              <tr className="bg-gray-100">
                <th className="px-4 py-2 border-b border-gray-200 font-bold text-admin-gray">สินค้า/วัสดุ</th>
                <th className="px-4 py-2 border-b border-gray-200 font-bold text-admin-gray">หมวดหมู่</th>
                <th className="px-4 py-2 border-b border-gray-200 font-bold text-admin-gray">คงเหลือ</th>
                <th className="px-4 py-2 border-b border-gray-200 font-bold text-admin-gray">ต้นทุน (฿)</th>
                <th className="px-4 py-2 border-b border-gray-200 font-bold text-admin-gray text-right">แอคชั่น</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((p) => (
                <tr key={p.id} className="hover:bg-blue-50/30 transition-colors">
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-2">
                      <div className="bg-gray-100 p-1.5 rounded text-gray-500">
                        <Package className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="font-bold text-gray-800 uppercase leading-none mb-1">{p.name}</p>
                        <div className="flex items-center gap-2">
                           <p className="text-[10px] text-admin-gray font-mono">QR: {p.qr_code}</p>
                           {p.sub_units && (Array.isArray(p.sub_units) ? p.sub_units.length > 0 : (typeof p.sub_units === 'string' && JSON.parse(p.sub_units).length > 0)) && (
                            <div className="flex gap-1">
                               {(Array.isArray(p.sub_units) ? p.sub_units : JSON.parse(p.sub_units)).map((sub: any, idx: number) => (
                                 <span key={idx} className="text-[8px] bg-gray-200 text-gray-500 px-1 rounded font-bold uppercase" title={`${sub.multiplier} ${p.unit}`}>
                                   {sub.name}
                                 </span>
                               ))}
                            </div>
                           )}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-2 uppercase text-[11px] font-bold text-admin-gray">
                    {p.category}
                  </td>
                  <td className="px-4 py-2">
                    <span className={`font-bold ${p.stock_qty <= p.min_alert ? 'text-admin-danger' : 'text-gray-900'}`}>
                      {(p.stock_qty || 0).toLocaleString()} {p.unit}
                    </span>
                    {p.stock_qty <= p.min_alert && (
                      <span className="ml-2 text-[10px] bg-admin-danger text-white px-1.5 py-0.5 rounded font-bold">LOW</span>
                    )}
                  </td>
                  <td className="px-4 py-2 font-semibold">
                    {(p.cost_price || 0).toLocaleString()}
                  </td>
                  <td className="px-4 py-2 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button 
                        onClick={() => viewQR(p)}
                        className="p-1.5 text-admin-gray hover:text-admin-blue hover:bg-white rounded transition-all"
                      >
                        <QrCode className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => handleEdit(p)}
                        className="p-1.5 text-admin-gray hover:text-gray-900 hover:bg-white rounded transition-all"
                      >
                        <MoreVertical className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Product Modal */}
      {editingProduct && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl p-6 max-w-md w-full shadow-2xl">
             <div className="flex justify-between items-center mb-6">
                <h3 className="text-sm font-black uppercase tracking-widest text-gray-800">🛠 แก้ไขข้อมูลสินค้า</h3>
                <button onClick={() => setEditingProduct(null)}><X className="w-5 h-5 text-gray-400" /></button>
             </div>
             <div className="space-y-4">
                <div className="space-y-1">
                   <label className="text-[10px] font-black uppercase text-gray-400 px-1">ชื่อสินค้า</label>
                   <input 
                     type="text" 
                     className="w-full border border-gray-200 rounded p-2 text-xs font-bold outline-none focus:ring-1 focus:ring-admin-blue"
                     value={editFormData?.name}
                     onChange={(e) => setEditFormData({...editFormData, name: e.target.value})}
                   />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase text-gray-400 px-1">หมวดหมู่</label>
                    <input 
                      type="text" 
                      className="w-full border border-gray-200 rounded p-2 text-xs font-bold outline-none focus:ring-1 focus:ring-admin-blue"
                      value={editFormData?.category}
                      onChange={(e) => setEditFormData({...editFormData, category: e.target.value})}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase text-gray-400 px-1">หน่วยนับ</label>
                    <input 
                      type="text" 
                      className="w-full border border-gray-200 rounded p-2 text-xs font-bold outline-none focus:ring-1 focus:ring-admin-blue"
                      value={editFormData?.unit}
                      onChange={(e) => setEditFormData({...editFormData, unit: e.target.value})}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase text-gray-400 px-1">ราคาต้นทุน (฿)</label>
                    <input 
                      type="number" 
                      className="w-full border border-gray-200 rounded p-2 text-xs font-bold outline-none focus:ring-1 focus:ring-admin-blue"
                      value={editFormData?.cost_price}
                      onChange={(e) => setEditFormData({...editFormData, cost_price: parseFloat(e.target.value)})}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase text-gray-400 px-1">จุดสั่งซื้อขั้นต่ำ (Min)</label>
                    <input 
                      type="number" 
                      className="w-full border border-gray-200 rounded p-2 text-xs font-bold outline-none focus:ring-1 focus:ring-admin-blue text-admin-danger"
                      value={editFormData?.min_alert}
                      onChange={(e) => setEditFormData({...editFormData, min_alert: parseFloat(e.target.value)})}
                    />
                  </div>
                </div>

                {/* Sub-units management */}
                <div className="space-y-2 border-t border-gray-100 pt-4">
                  <label className="text-[10px] font-black uppercase text-gray-800 px-1 flex justify-between items-center">
                    หน่วยย่อยและการแปลงค่า
                    <button 
                      type="button"
                      onClick={() => {
                        const currentSubs = editFormData?.sub_units;
                        let subsArray = [];
                        if (Array.isArray(currentSubs)) {
                          subsArray = currentSubs;
                        } else if (typeof currentSubs === 'string' && currentSubs.trim() !== '') {
                          try { subsArray = JSON.parse(currentSubs); } catch(e) { subsArray = []; }
                        }
                        setEditFormData({ ...editFormData, sub_units: [...subsArray, { name: '', multiplier: 1 }] });
                      }}
                      className="text-admin-blue hover:underline"
                    >
                      + เพิ่มหน่วย
                    </button>
                  </label>
                  
                  <div className="space-y-2">
                    {(() => {
                      const currentSubs = editFormData?.sub_units;
                      let subsArray = [];
                      if (Array.isArray(currentSubs)) {
                        subsArray = currentSubs;
                      } else if (typeof currentSubs === 'string' && currentSubs.trim() !== '') {
                        try { subsArray = JSON.parse(currentSubs); } catch(e) { subsArray = []; }
                      }
                      
                      return subsArray.map((sub: any, idx: number) => (
                        <div key={idx} className="flex gap-2 items-center">
                           <input 
                             type="text" 
                             placeholder="ชื่อหน่วย (เช่น ขวด 1.5L)"
                             className="flex-1 border border-gray-200 rounded p-1.5 text-[11px] font-bold outline-none focus:ring-1 focus:ring-admin-blue"
                             value={sub.name}
                             onChange={(e) => {
                               const newSubs = [...subsArray];
                               newSubs[idx].name = e.target.value;
                               setEditFormData({ ...editFormData, sub_units: newSubs });
                             }}
                           />
                           <div className="flex items-center gap-1">
                              <span className="text-[10px] text-gray-400">x</span>
                              <input 
                                type="number" 
                                placeholder="ตัวคูณ"
                                className="w-16 border border-gray-200 rounded p-1.5 text-[11px] font-bold outline-none focus:ring-1 focus:ring-admin-blue"
                                value={sub.multiplier}
                                onChange={(e) => {
                                  const newSubs = [...subsArray];
                                  newSubs[idx].multiplier = parseFloat(e.target.value);
                                  setEditFormData({ ...editFormData, sub_units: newSubs });
                                }}
                              />
                           </div>
                           <button 
                             type="button"
                             onClick={() => {
                               const newSubs = [...subsArray];
                               newSubs.splice(idx, 1);
                               setEditFormData({ ...editFormData, sub_units: newSubs });
                             }}
                             className="text-admin-danger"
                           >
                             <X className="w-3.5 h-3.5" />
                           </button>
                        </div>
                      ));
                    })()}
                    {(() => {
                      const currentSubs = editFormData?.sub_units;
                      let subsArray = [];
                      if (Array.isArray(currentSubs)) {
                        subsArray = currentSubs;
                      } else if (typeof currentSubs === 'string' && currentSubs.trim() !== '') {
                        try { subsArray = JSON.parse(currentSubs); } catch(e) { subsArray = []; }
                      }
                      if (subsArray.length === 0) {
                        return <p className="text-[10px] text-gray-400 italic text-center py-2">ไม่มีการกำหนดหน่วยย่อย</p>;
                      }
                      return null;
                    })()}
                  </div>
                </div>

                <div className="flex gap-2 pt-4">
                   <button 
                    onClick={saveEdit}
                    className="flex-1 bg-admin-blue text-white py-2 rounded text-xs font-black uppercase shadow-lg shadow-admin-blue/20"
                   >
                     บันทึกการแก้ไข
                   </button>
                   <button 
                    onClick={() => setEditingProduct(null)}
                    className="px-6 bg-gray-100 text-gray-500 py-2 rounded text-xs font-black uppercase"
                   >
                     ยกเลิก
                   </button>
                </div>
             </div>
          </div>
        </div>
      )}

      {/* QR Code Modal */}
      {selectedQR && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-3xl p-8 max-w-sm w-full shadow-2xl relative"
          >
            <button 
              onClick={() => setSelectedQR(null)}
              className="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="text-center">
              <h3 className="font-bold text-lg mb-1 uppercase">{selectedQR.name}</h3>
              <p className="text-xs text-slate-400 mb-6 uppercase tracking-widest font-semibold">พิมพ์เพื่อนำไปติดที่ชั้นวางสินค้า</p>
              
              <div className="bg-white border-2 border-slate-100 p-4 rounded-3xl inline-block mb-6 shadow-sm">
                <img src={selectedQR.url} alt="QR Code" className="w-48 h-48 mx-auto" />
              </div>

              <button className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-2xl flex items-center justify-center gap-2 transition-all active:scale-[0.98]">
                <Printer className="w-5 h-5" />
                <span>พิมพ์ QR Code</span>
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
