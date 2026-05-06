import React, { useState, useEffect } from 'react';
import { 
  QrCode, 
  Search, 
  ArrowRightLeft, 
  Package, 
  Briefcase, 
  ChevronRight,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Camera,
  X as CloseIcon
} from 'lucide-react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { Project, Product, User } from '../types';

export default function IssueForm({ user }: { user: User }) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [transactionType, setTransactionType] = useState<'RECEIVE' | 'ISSUE' | 'RETURN' | 'ADJUST'>('ISSUE');
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [selectedProductId, setSelectedProductId] = useState('');
  const [qty, setQty] = useState('');
  const [requesterName, setRequesterName] = useState('');
  const [vendorName, setVendorName] = useState('');
  const [note, setNote] = useState('');
  const [selectedUnit, setSelectedUnit] = useState('');
  const [multiplier, setMultiplier] = useState(1);
  const [qrInput, setQrInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [isScanning, setIsScanning] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch('/api/projects').then(res => res.json()),
      fetch('/api/products').then(res => res.json())
    ]).then(([projs, prods]) => {
      setProjects(projs);
      setProducts(prods);
    });
  }, []);

  useEffect(() => {
    let scanner: any = null;
    if (isScanning) {
      scanner = new Html5QrcodeScanner("reader", { 
        fps: 10, 
        qrbox: { width: 250, height: 250 },
        rememberLastUsedCamera: true
      }, false);

      scanner.render((decodedText: string) => {
        setQrInput(decodedText);
        setIsScanning(false);
        // Automatically search
        const product = products.find(p => p.qr_code.toLowerCase() === decodedText.toLowerCase());
        if (product) {
          setSelectedProductId(product.id.toString());
          setSelectedUnit(product.unit);
          setMultiplier(1);
          setError('');
        } else {
          setError(`ไม่พบสินค้าจากรหัส "${decodedText}"`);
        }
        scanner.clear();
      }, (err: any) => {
        // console.warn(err);
      });
    }

    return () => {
      if (scanner) {
        scanner.clear().catch((error: any) => console.error("Failed to clear scanner", error));
      }
    };
  }, [isScanning, products]);

  const handleQrSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const product = products.find(p => p.qr_code.toLowerCase() === qrInput.toLowerCase() || p.name.toLowerCase().includes(qrInput.toLowerCase()));
    if (product) {
      setSelectedProductId(product.id.toString());
      setSelectedUnit(product.unit);
      setMultiplier(1);
      setQrInput('');
      setError('');
      // Show mini success ping?
    } else {
      setError(`ไม่พบสินค้าจากรหัส "${qrInput}"`);
    }
  };

  const handleTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProductId || !qty) return;
    if ((transactionType === 'ISSUE' || transactionType === 'RETURN') && !selectedProjectId) {
      setError('กรุณาระบุโปรเจค');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: transactionType,
          project_id: selectedProjectId ? parseInt(selectedProjectId) : null,
          product_id: parseInt(selectedProductId),
          selected_qty: parseFloat(qty),
          selected_unit: selectedUnit,
          multiplier: multiplier,
          user_id: user.id,
          requester_name: requesterName,
          vendor_name: vendorName,
          note: note
        })
      });

      if (res.ok) {
        const data = await res.json();
        setSuccess(true);
        setQty('');
        setRequesterName('');
        setVendorName('');
        setNote('');
        fetch('/api/products').then(res => res.json()).then(setProducts);

        if (data.status === 'PENDING') {
          setError('⚠️ รายการเบิกถูกส่งไปรอการอนุมัติแล้ว');
        }

        setTimeout(() => {
          setSuccess(false);
          setError('');
        }, 5000);
      } else {
        const data = await res.json();
        setError(data.message || 'บันทึกไม่สำเร็จ');
      }
    } catch (err) {
      setError('เกิดข้อผิดพลาดในการบันทึก');
    } finally {
      setLoading(false);
    }
  };

  const selectedProduct = products.find(p => p.id.toString() === selectedProductId);

  return (
    <div className="space-y-[15px]">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-xl font-semibold text-gray-800">จัดการคลังสินค้า & เบิกจ่าย</h1>
        <div className="text-[12px] text-admin-gray uppercase font-bold tracking-wider">Inventory Control</div>
      </div>

      {/* Transaction Type Tabs */}
      <div className="flex gap-1 bg-gray-200 p-1 rounded-lg w-fit">
        {[
          { id: 'RECEIVE', label: 'รับเข้า', icon: Package, color: 'text-blue-600' },
          { id: 'ISSUE', label: 'เบิกของ', icon: ArrowRightLeft, color: 'text-admin-danger' },
          { id: 'RETURN', label: 'คืนของ', icon: ArrowRightLeft, color: 'text-green-600' },
          { id: 'ADJUST', label: 'ปรับปรุง', icon: Loader2, color: 'text-gray-600' }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setTransactionType(tab.id as any)}
            className={`px-4 py-1.5 rounded-md text-[11px] font-black uppercase transition-all flex items-center gap-2 ${
              transactionType === tab.id 
                ? 'bg-white text-gray-800 shadow-sm shadow-black/5' 
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <tab.icon className={`w-3.5 h-3.5 ${transactionType === tab.id ? tab.color : 'text-gray-400'}`} />
            {tab.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-[15px]">
        {/* Scanner & Form Section */}
        <div className="lg:col-span-2 space-y-[15px]">
          <div className="admin-card border-t-admin-blue">
             <div className="card-header border-b border-gray-100 py-2 px-3">
                <h3 className="text-sm font-bold text-gray-800 uppercase flex items-center gap-2">
                  <QrCode className="w-4 h-4 text-admin-blue" /> 
                  บันทึกรายการ: {
                    transactionType === 'RECEIVE' ? 'รับสินค้า' : 
                    transactionType === 'ISSUE' ? 'เบิกสินค้า' : 
                    transactionType === 'RETURN' ? 'คืนสินค้า' : 'ปรับยอด'
                  }
                </h3>
             </div>
            
            <div className="p-4 space-y-4">
              {/* Form Input */}
              <form onSubmit={handleTransaction} className="bg-gray-50 p-4 rounded border border-gray-200 space-y-4">
                {success && (
                  <div className="p-3 bg-admin-success text-white text-xs font-bold rounded flex items-center gap-2 animate-in zoom-in">
                    <CheckCircle2 className="w-4 h-4" /> บันทึกสำเร็จ! ระบบแจ้งเตือนไปยัง LINE แล้ว
                  </div>
                )}
                {error && (
                  <div className="p-3 bg-admin-danger text-white text-xs font-bold rounded flex items-center gap-2 animate-in shake">
                    <AlertCircle className="w-4 h-4" /> {error}
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  
                  {/* Common: Product Selection */}
                  <div className="space-y-1 md:col-span-2">
                    <label className="text-[11px] font-bold text-admin-gray uppercase px-1">สินค้า/วัสดุ</label>
                    <div className="flex gap-2">
                      <div className="relative flex-1 flex items-center">
                         <Package className="absolute left-3 w-3.5 h-3.5 text-gray-400" />
                         <select 
                          required
                          className="w-full bg-white border border-gray-200 pl-9 pr-3 py-2 rounded text-xs focus:ring-1 focus:ring-admin-blue outline-none appearance-none font-semibold"
                          value={selectedProductId}
                          onChange={(e) => setSelectedProductId(e.target.value)}
                        >
                          <option value="">-- เลือกสินค้า --</option>
                          {products.map(p => <option key={p.id} value={p.id}>{p.name} (ในสต๊อก: {p.stock_qty} {p.unit})</option>)}
                        </select>
                      </div>
                      <button 
                        type="button"
                        onClick={() => setIsScanning(true)}
                        className="bg-admin-dark text-white px-3 py-2 rounded flex items-center gap-2 text-[10px] font-black uppercase hover:bg-black transition-all"
                      >
                        <Camera className="w-4 h-4" /> Scan QR
                      </button>
                    </div>
                  </div>

                  {/* Common: Qty */}
                  <div className="space-y-1">
                     <label className="text-[11px] font-bold text-admin-gray uppercase px-1">
                        จำนวนที่ {transactionType === 'RECEIVE' ? 'รับ' : transactionType === 'ADJUST' ? 'ปรับ (+/-)' : 'เบิก/คืน'}
                     </label>
                     <div className="flex gap-2">
                        <input 
                          type="number" 
                          required
                          step="0.01"
                          placeholder="0.00"
                          className="w-full bg-white border border-gray-200 p-1.5 rounded text-xs px-3 focus:ring-1 focus:ring-admin-blue outline-none font-bold"
                          value={qty}
                          onChange={(e) => setQty(e.target.value)}
                        />
                        <select
                          className="bg-gray-200 text-gray-700 px-3 py-1.5 rounded text-[10px] font-bold outline-none border-none cursor-pointer"
                          value={`${selectedUnit}|${multiplier}`}
                          onChange={(e) => {
                            const [unit, mult] = e.target.value.split('|');
                            setSelectedUnit(unit);
                            setMultiplier(parseFloat(mult));
                          }}
                        >
                          {selectedProduct && (
                            <>
                              <option value={`${selectedProduct.unit}|1`}>{selectedProduct.unit} (หลัก)</option>
                              {selectedProduct.sub_units && JSON.parse(selectedProduct.sub_units).map((sub: any, i: number) => (
                                <option key={i} value={`${sub.name}|${sub.multiplier}`}>{sub.name}</option>
                              ))}
                            </>
                          )}
                          {!selectedProduct && <option value="">-</option>}
                        </select>
                     </div>
                     {multiplier !== 1 && qty && (
                        <p className="text-[10px] text-admin-blue font-bold mt-1 uppercase italic">
                           = {(parseFloat(qty) * multiplier).toLocaleString()} {selectedProduct?.unit}
                        </p>
                     )}
                  </div>

                  {/* Context: RECEIVE - Vendor */}
                  {transactionType === 'RECEIVE' && (
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-admin-gray uppercase px-1">บริษัท/ซัพพลายเออร์</label>
                      <input 
                        type="text" 
                        required
                        placeholder="ชื่อบริษัท..."
                        className="w-full bg-white border border-gray-200 p-1.5 rounded text-xs px-3 focus:ring-1 focus:ring-admin-blue outline-none"
                        value={vendorName}
                        onChange={(e) => setVendorName(e.target.value)}
                      />
                    </div>
                  )}

                  {/* Context: ISSUE/RETURN - Project */}
                  {(transactionType === 'ISSUE' || transactionType === 'RETURN') && (
                    <>
                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-admin-gray uppercase px-1">โปรเจคที่เกี่ยวข้อง</label>
                        <div className="relative flex items-center">
                          <Briefcase className="absolute left-3 w-3.5 h-3.5 text-gray-400" />
                          <select 
                            required
                            className="w-full bg-white border border-gray-200 pl-9 pr-3 py-1.5 rounded text-xs focus:ring-1 focus:ring-admin-blue outline-none appearance-none"
                            value={selectedProjectId}
                            onChange={(e) => setSelectedProjectId(e.target.value)}
                          >
                            <option value="">-- เลือกโครงการ --</option>
                            {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                          </select>
                        </div>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-admin-gray uppercase px-1">ชื่อผู้ {transactionType === 'ISSUE' ? 'เบิก' : 'คืน'}</label>
                        <input 
                          type="text" 
                          required
                          placeholder="ชื่อ-นามสกุล..."
                          className="w-full bg-white border border-gray-200 p-1.5 rounded text-xs px-3 focus:ring-1 focus:ring-admin-blue outline-none"
                          value={requesterName}
                          onChange={(e) => setRequesterName(e.target.value)}
                        />
                      </div>
                    </>
                  )}

                  {/* Context: ADJUST/ANY - Note */}
                  <div className="space-y-1 md:col-span-2">
                    <label className="text-[11px] font-bold text-admin-gray uppercase px-1">หมายเหตุ / เหตุผล</label>
                    <input 
                      type="text" 
                      placeholder="..."
                      className="w-full bg-white border border-gray-200 p-1.5 rounded text-xs px-3 focus:ring-1 focus:ring-admin-blue outline-none"
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                    />
                  </div>

                  <div className="md:col-span-2 p-2 bg-blue-50 border border-blue-100 rounded text-[10px] text-blue-700 font-bold uppercase italic">
                    ผู้ลงบันทึก: {user.name} ({user.role})
                  </div>
                </div>

                <div className="pt-2">
                   <button 
                    disabled={loading || !selectedProductId || !qty}
                    className="w-full bg-admin-blue text-white py-2.5 rounded text-xs font-bold hover:bg-blue-600 transition-colors disabled:opacity-50 uppercase shadow-sm flex items-center justify-center gap-2"
                  >
                    {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ChevronRight className="w-4 h-4" />}
                    {loading ? 'กำลังบันทึก...' : `ยืนยันการ${
                      transactionType === 'RECEIVE' ? 'รับเข้า' : 
                      transactionType === 'ISSUE' ? 'เบิกจ่าย' : 
                      transactionType === 'RETURN' ? 'คืนของ' : 'ปรับยอด'
                    }`}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>

        {/* Info Column */}
        <div className="space-y-[15px]">
          <div className="admin-card border-t-0 p-4">
             <h3 className="text-sm font-bold text-gray-800 mb-3 uppercase flex items-center gap-2">
               <AlertCircle className="w-4 h-4 text-admin-warning" /> ขั้นตอนการทำงาน
             </h3>
             <ul className="text-[10px] text-admin-gray space-y-2 font-bold uppercase">
                <li className="flex gap-2">
                  <span className="w-4 h-4 bg-gray-200 rounded-full flex items-center justify-center flex-shrink-0">1</span>
                  <span>เลือกประเภทรายการที่ต้องการกระทำงาน</span>
                </li>
                <li className="flex gap-2">
                  <span className="w-4 h-4 bg-gray-200 rounded-full flex items-center justify-center flex-shrink-0">2</span>
                  <span>สแกน QR Code หรือเลือกสินค้าจากรายการ</span>
                </li>
                <li className="flex gap-2 text-admin-blue">
                  <span className="w-4 h-4 bg-admin-blue text-white rounded-full flex items-center justify-center flex-shrink-0 text-[8px]">!</span>
                  <span>เมื่อกดยืนยัน ข้อมูลจะถูกส่งไปยังหัวหน้างานทาง LINE ทันที</span>
                </li>
             </ul>
          </div>

          <div className="admin-card border-t-0 p-4 relative">
             <h3 className="text-sm font-bold text-gray-800 mb-3 uppercase flex items-center justify-between gap-2">
               <span className="flex items-center gap-2">
                 <QrCode className="w-4 h-4 text-admin-blue" /> ค้นหาด่วนด้วย QR
               </span>
               <button 
                onClick={() => setIsScanning(!isScanning)}
                className={`p-1.5 rounded transition-colors ${isScanning ? 'bg-admin-danger text-white' : 'bg-admin-blue text-white'}`}
               >
                 {isScanning ? <CloseIcon className="w-4 h-4" /> : <Camera className="w-4 h-4" />}
               </button>
             </h3>
             
             {isScanning && (
               <div className="mb-4 overflow-hidden rounded-lg border border-gray-200">
                  <div id="reader" className="w-full"></div>
               </div>
             )}

             <form onSubmit={handleQrSearch} className="flex gap-1">
                <input 
                  type="text" 
                  placeholder="สแกนหรือพิมพ์รหัส..."
                  value={qrInput}
                  onChange={(e) => setQrInput(e.target.value)}
                  className="flex-1 bg-white border border-gray-200 p-1.5 rounded text-[11px] px-2 outline-none focus:ring-1 focus:ring-admin-blue font-mono"
                />
                <button type="submit" className="bg-admin-dark text-white px-2 py-1.5 rounded text-[10px] font-bold">OK</button>
             </form>
          </div>
        </div>
      </div>
    </div>
  );

}
