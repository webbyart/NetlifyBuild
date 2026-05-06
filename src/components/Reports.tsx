import React, { useState, useEffect } from 'react';
import { 
  FileText, 
  Download, 
  Search, 
  Filter,
  ArrowUpRight,
  TrendingDown,
  ArrowDownLeft,
  RotateCcw,
  Settings2,
  Calendar,
  User as UserIcon,
  Briefcase,
  Printer
} from 'lucide-react';
import { Transaction } from '../types';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { COMPANY_INFO } from '../constants';

// --- Document Generation Helper ---
const generateDocument = (type: 'INVOICE' | 'TAX_INVOICE' | 'DELIVERY', txn: any) => {
  const doc = new jsPDF();
  
  const titleMap = {
    INVOICE: 'INVOICE',
    TAX_INVOICE: 'TAX INVOICE',
    DELIVERY: 'DELIVERY ORDER'
  };

  const codeMap = {
    INVOICE: 'IV',
    TAX_INVOICE: 'TAX',
    DELIVERY: 'DO'
  };

  // Header - Company Info
  doc.setFontSize(14);
  doc.setTextColor(30, 41, 59);
  doc.setFont('helvetica', 'bold');
  doc.text('Rabbit Furniture Co., Ltd. (Head Office)', 14, 20);
  
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100);
  doc.text(COMPANY_INFO.address, 14, 25);
  doc.text(`Tax ID: ${COMPANY_INFO.taxId}`, 14, 30);
  
  // Document Title
  doc.setFontSize(16);
  doc.setTextColor(0);
  doc.setFont('helvetica', 'bold');
  doc.text(titleMap[type], 200, 25, { align: 'right' });
  
  doc.line(10, 35, 200, 35);

  // Client & Document Info
  doc.setFontSize(10);
  doc.setTextColor(80);
  doc.text('BILL TO:', 14, 45);
  doc.setTextColor(0);
  doc.setFont('helvetica', 'bold');
  doc.text(txn.type === 'RECEIVE' ? (txn.vendor_name || 'N/A') : (txn.project_name || 'General Requirement'), 14, 50);
  doc.setFont('helvetica', 'normal');
  doc.text(`Requester: ${txn.requester_name || txn.user_name || 'N/A'}`, 14, 55);

  doc.setTextColor(80);
  doc.text('DOCUMENT INFO:', 140, 45);
  doc.setTextColor(0);
  doc.text(`Date: ${txn.datetime?.split(' ')[0] || ''}`, 140, 50);
  doc.text(`ID: ${codeMap[type]}-${(txn.id || '').toString().substring(0, 8).toUpperCase()}`, 140, 55);
  doc.text(`Ref: ${(txn.id || '').toString().substring(0, 8)}`, 140, 60);

  // Items Table
  const tableData = [[
    '1',
    txn.product_name || 'N/A',
    `${txn.qty} ${txn.unit || 'units'}`,
    (txn.unit_price || 0).toLocaleString(),
    (txn.total_price || 0).toLocaleString()
  ]];

  autoTable(doc, {
    startY: 70,
    head: [['#', 'Description', 'Quantity', 'Unit Price (THB)', 'Total (THB)']],
    body: tableData,
    theme: 'grid',
    headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255] },
    styles: { fontSize: 9 }
  });

  const finalY = (doc as any).lastAutoTable.finalY + 15;
  
  // Summary
  doc.setFont('helvetica', 'bold');
  doc.text('Total Value:', 140, finalY);
  doc.text(`${(txn.total_price || 0).toLocaleString()} THB`, 200, finalY, { align: 'right' });

  // Footer
  doc.setFontSize(8);
  doc.setFont('helvetica', 'italic');
  doc.setTextColor(150);
  doc.text('This is a computer-generated document. No signature required.', 105, 280, { align: 'center' });

  doc.save(`${type}_${txn.id.substring(0, 8)}.pdf`);
};

export default function Reports() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<string>('ALL');
  const [filterProject, setFilterProject] = useState<string>('ALL');

  const fetchTransactions = () => {
    setLoading(true);
    const url = `/api/transactions?projectId=${filterProject}`;
    fetch(url)
      .then(res => res.json())
      .then(data => {
        setTransactions(data);
        setLoading(false);
      });
  };

  useEffect(() => {
    fetch('/api/projects')
      .then(res => res.json())
      .then(setProjects);
  }, []);

  useEffect(() => {
    fetchTransactions();
  }, [filterProject]);

  const filteredTransactions = transactions.filter(t => filterType === 'ALL' || t.type === filterType);

  const getStatusStyle = (type: string) => {
    switch(type) {
      case 'RECEIVE': return 'bg-blue-100 text-blue-700';
      case 'ISSUE': return 'bg-rose-100 text-rose-700';
      case 'RETURN': return 'bg-green-100 text-green-700';
      case 'ADJUST': return 'bg-gray-100 text-gray-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const getTypeName = (type: string) => {
    switch(type) {
      case 'RECEIVE': return 'รับเข้า';
      case 'ISSUE': return 'เบิกจ่าย';
      case 'RETURN': return 'คืนของ';
      case 'ADJUST': return 'ปรับปรุง';
      default: return type;
    }
  };

  const handleExportCSV = () => {
    if (filteredTransactions.length === 0) return;

    const headers = ['วันที่-เวลา', 'ประเภท', 'รายการสินค้า', 'จำนวน', 'หน่วย', 'มูลค่า (฿)', 'โปรเจค/ผู้ขาย', 'ผู้เบิก', 'หมายเหตุ', 'ผู้บันทึก'];
    const rows = filteredTransactions.map(t => [
      t.datetime,
      getTypeName(t.type),
      t.product_name,
      t.qty,
      t.unit,
      t.total_price || 0,
      t.type === 'RECEIVE' ? t.vendor_name : t.project_name,
      t.requester_name || '',
      t.note || '',
      t.user_name
    ]);

    // Use BOM for UTF-8 to support Thai in Excel
    const BOM = '\uFEFF';
    const csvContent = BOM + [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `รายงานรายการคลังสินค้า_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportPDF = () => {
    if (filteredTransactions.length === 0) return;

    const doc = new jsPDF();
    
    // Note: Standard jsPDF fonts don't support Thai natively without added VFS fonts.
    // We will use standard Latin headers for now to avoid boxes, 
    // but update the data mapping for clarity.
    
    // Title
    doc.setFontSize(20);
    doc.text('Inventory Transaction Report', 14, 15);
    
    // Meta info
    doc.setFontSize(10);
    doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 22);
    doc.text(`Filter Type: ${filterType}`, 14, 27);
    doc.text(`Filter Project: ${filterProject === 'ALL' ? 'All' : filterProject}`, 14, 32);

    const tableData = filteredTransactions.map(t => [
      t.datetime.split(' ')[0],
      t.type,
      t.product_name,
      `${t.qty} ${t.unit}`,
      (t.total_price || 0).toLocaleString(),
      t.type === 'RECEIVE' ? (t.vendor_name || '-') : (t.project_name || '-'),
      t.user_name
    ]);

    autoTable(doc, {
      startY: 40,
      head: [['Date', 'Type', 'Product', 'Qty', 'Value (THB)', 'Project/Vendor', 'By']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [30, 41, 59] }, // admin-dark color
      styles: { fontSize: 8 },
    });

    doc.save(`Inventory_Report_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  return (
    <div className="space-y-[15px]">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-gray-800">ประวัติรายการคลังสินค้า</h1>
          <p className="text-[11px] text-admin-gray uppercase font-bold tracking-wider">Transaction Audit Log & Reports</p>
        </div>
        <div className="flex gap-2">
           <button 
            onClick={handleExportPDF}
            className="bg-white border border-gray-200 px-3 py-1.5 rounded text-[10px] font-bold uppercase flex items-center gap-2 hover:bg-gray-50 transition-colors"
           >
              <FileText className="w-3.5 h-3.5" /> PDF Report
           </button>
           <button 
            onClick={handleExportCSV}
            className="bg-admin-dark text-white px-3 py-1.5 rounded text-[10px] font-bold uppercase flex items-center gap-2 hover:bg-gray-800 transition-colors"
           >
              <Download className="w-3.5 h-3.5" /> CSV Export
           </button>
        </div>
      </div>

      <div className="admin-card border-t-admin-dark">
         <div className="p-4 border-b border-gray-100 flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap gap-4 items-center">
              <div className="flex gap-1 bg-gray-100 p-1 rounded">
                {['ALL', 'RECEIVE', 'ISSUE', 'RETURN', 'ADJUST'].map(type => (
                    <button 
                      key={type}
                      onClick={() => setFilterType(type)}
                      className={`px-3 py-1 rounded text-[10px] font-black uppercase transition-all ${
                        filterType === type ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-400 hover:text-gray-600'
                      }`}
                    >
                      {type === 'ALL' ? 'ทั้งหมด' : getTypeName(type)}
                    </button>
                ))}
              </div>
              
              <div className="flex items-center gap-2">
                <Briefcase className="w-3.5 h-3.5 text-admin-gray" />
                <select 
                  className="bg-gray-50 border border-gray-200 px-2 py-1 rounded text-[11px] font-bold outline-none focus:ring-1 focus:ring-admin-blue"
                  value={filterProject}
                  onChange={(e) => setFilterProject(e.target.value)}
                >
                  <option value="ALL">เลือกโปรเจค (ทั้งหมด)</option>
                  {projects.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="relative">
               <Search className="absolute left-2.5 top-1.5 w-3 h-3 text-gray-400" />
               <input 
                 type="text" 
                 placeholder="ค้นหารายการ..."
                 className="bg-gray-50 border border-gray-200 pl-8 pr-3 py-1 rounded text-[11px] outline-none focus:ring-1 focus:ring-admin-blue w-full sm:w-48"
               />
            </div>
         </div>

         <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
               <thead>
                  <tr className="bg-gray-50/50 text-[10px] text-admin-gray uppercase font-black tracking-widest border-b border-gray-100">
                     <th className="px-4 py-3">วัน-เวลา</th>
                     <th className="px-4 py-3">ประเภท</th>
                     <th className="px-4 py-3">รายการสินค้า</th>
                     <th className="px-4 py-3 text-right">จำนวน</th>
                     <th className="px-4 py-3 text-right">มูลค่า (฿)</th>
                     <th className="px-4 py-3">ผู้เกี่ยวข้อง / รายละเอียด</th>
                     <th className="px-4 py-3">ผู้ลงบันทึก</th>
                     <th className="px-4 py-3 text-right">เอกสาร</th>
                  </tr>
               </thead>
               <tbody className="text-[11px]">
                  {loading ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-12 text-center text-gray-400 italic font-medium uppercase tracking-widest">
                         Loading historical data...
                      </td>
                    </tr>
                  ) : filteredTransactions.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-12 text-center text-gray-400 italic font-medium uppercase tracking-widest">
                         No records found
                      </td>
                    </tr>
                  ) : filteredTransactions.map((t) => (
                    <tr key={t.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                       <td className="px-4 py-3 whitespace-nowrap text-gray-500 font-mono italic">
                          {t.datetime?.split(' ')[0] || ''} <span className="text-[9px] opacity-70">{t.datetime?.split(' ')[1] || ''}</span>
                       </td>
                       <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${getStatusStyle(t.type)}`}>
                             {getTypeName(t.type)}
                          </span>
                       </td>
                       <td className="px-4 py-3">
                          <div className="font-bold text-gray-800">{t.product_name}</div>
                          <div className="text-[9px] text-gray-400 uppercase font-bold tracking-tighter">Inventory Item</div>
                       </td>
                       <td className="px-4 py-3 text-right font-bold text-gray-700">
                          {t.qty} {t.unit}
                       </td>
                       <td className="px-4 py-3 text-right font-black text-admin-gray">
                          {(t.total_price || 0).toLocaleString()}
                       </td>
                       <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                             {t.type === 'RECEIVE' && (
                               <div className="text-blue-600 font-bold uppercase truncate max-w-[150px]">🏢 {t.vendor_name}</div>
                             )}
                             {(t.type === 'ISSUE' || t.type === 'RETURN') && (
                               <div>
                                  <div className="text-admin-dark font-bold uppercase truncate max-w-[150px]">📁 {t.project_name}</div>
                                  <div className="text-[9px] text-gray-400 font-bold">👤 {t.requester_name}</div>
                               </div>
                             )}
                             {t.type === 'ADJUST' && (
                               <div className="text-gray-500 italic font-bold">📝 {t.note || 'No reason specified'}</div>
                             )}
                          </div>
                       </td>
                       <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                             <div className="w-5 h-5 bg-gray-200 rounded-full flex items-center justify-center text-[8px] font-bold">
                                {t.user_name?.substring(0, 2)}
                             </div>
                             <div className="text-gray-600 font-bold">{t.user_name}</div>
                          </div>
                       </td>
                       <td className="px-4 py-3 text-right">
                          <div className="flex justify-end gap-1">
                             <button
                               onClick={() => generateDocument('DELIVERY', t)}
                               className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                               title="ใบส่งของ"
                             >
                                <FileText className="w-3.5 h-3.5" />
                             </button>
                             <button
                               onClick={() => generateDocument('INVOICE', t)}
                               className="p-1 text-indigo-600 hover:bg-indigo-50 rounded"
                               title="ใบแจ้งหนี้"
                             >
                                <Download className="w-3.5 h-3.5" />
                             </button>
                             <button
                               onClick={() => generateDocument('TAX_INVOICE', t)}
                               className="p-1 text-admin-dark hover:bg-gray-100 rounded"
                               title="ใบกำกับภาษี"
                             >
                                <Printer className="w-3.5 h-3.5" />
                             </button>
                          </div>
                       </td>
                    </tr>
                  ))}
               </tbody>
            </table>
         </div>
         
         <div className="p-3 bg-gray-50 border-t border-gray-100 flex justify-between items-center">
            <div className="text-[10px] text-gray-400 font-bold uppercase italic font-mono">
               Showing {filteredTransactions.length} recent transactions
            </div>
            <div className="flex gap-1">
               <button className="w-6 h-6 flex items-center justify-center bg-white border border-gray-200 rounded text-[10px] font-bold text-gray-400">&lt;</button>
               <button className="w-6 h-6 flex items-center justify-center bg-admin-blue text-white rounded text-[10px] font-bold">1</button>
               <button className="w-6 h-6 flex items-center justify-center bg-white border border-gray-200 rounded text-[10px] font-bold text-gray-400">&gt;</button>
            </div>
         </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-[15px]">
          <div className="admin-card border-t-0 p-4 bg-blue-600 text-white flex items-center justify-between shadow-lg shadow-blue-600/20">
             <div>
                <p className="text-[10px] font-black uppercase opacity-80 mb-1">Weekly Stock-In Value</p>
                <p className="text-lg font-black tracking-tight">฿ 145,200</p>
             </div>
             <ArrowUpRight className="w-8 h-8 opacity-20" />
          </div>
          <div className="admin-card border-t-0 p-4 bg-admin-danger text-white flex items-center justify-between shadow-lg shadow-rose-600/20">
             <div>
                <p className="text-[10px] font-black uppercase opacity-80 mb-1">Project Consumption</p>
                <p className="text-lg font-black tracking-tight">฿ 82,450</p>
             </div>
             <TrendingDown className="w-8 h-8 opacity-20" />
          </div>
          <div className="admin-card border-t-0 p-4 bg-admin-dark text-white flex items-center justify-between shadow-lg shadow-slate-900/20">
             <div>
                <p className="text-[10px] font-black uppercase opacity-80 mb-1">System Audit Performance</p>
                <p className="text-lg font-black tracking-tight">99.8%</p>
             </div>
             <Settings2 className="w-8 h-8 opacity-20" />
          </div>
      </div>
    </div>
  );
}
