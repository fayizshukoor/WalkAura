import { getSalesReportService } from "../../services/dashboard.service.js";
import asyncHandler from "../../utils/asyncHandler.util.js";
import ExcelJS from "exceljs";
import PDFDocument from "pdfkit-table";

const parseDates = (range, from, to) => {
    let startDate;
    let endDate = new Date();
  
    switch (range) {
      case "today":
        startDate = new Date();
        startDate.setHours(0, 0, 0, 0);
  
        endDate.setHours(23, 59, 59, 999);
        break;
  
      case "lastWeek":
        startDate = new Date();
        startDate.setDate(endDate.getDate() - 7);
        break;
  
      case "lastMonth":
        startDate = new Date();
        startDate.setMonth(endDate.getMonth() - 1);
        break;
  
      case "lastYear":
        startDate = new Date();
        startDate.setFullYear(endDate.getFullYear() - 1);
        break;
  
      default:
        if (from && to) {
          startDate = new Date(from);
          endDate = new Date(to);
          endDate.setHours(23, 59, 59, 999);
        } else {
          // Default fallback = last 7 days
          startDate = new Date();
          startDate.setDate(endDate.getDate() - 7);
        }
    }
  
    return { startDate, endDate };
  };


export const getSalesReport = asyncHandler(async (req, res) => {
    const { range, from, to, page = 1, limit = 5 } = req.query;
  
    const { startDate, endDate } = parseDates(range, from, to);
  
    const report = await getSalesReportService({
      startDate,
      endDate,
      page: Number(page),
      limit: Number(limit)
    });
  
    res.status(200).render("admin/sales-report", {
      layout: "layouts/admin",
      data: report,
      filters: {
        range: range || "lastWeek",
        from: from || "",
        to: to || ""
      }
    });
  });


  export const downloadSalesExcel = asyncHandler(async (req, res) => {
    const { range, from, to } = req.query;
  
    const { startDate, endDate } = parseDates(range, from, to);
  
    const report = await getSalesReportService({
        startDate,
        endDate,
        exportAll: true // Ensure service returns all data for export
    });

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Sales Report");

    // 1. Style Definitions
    const currencyStyle = { numFmt: '"₹"#,##0.00' };

    // 2. Title Section
    worksheet.mergeCells('A1:H1');
    const titleCell = worksheet.getCell('A1');
    titleCell.value = "SALES REPORT";
    titleCell.font = { size: 18, bold: true, color: { argb: 'FF1F2937' } };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };

    worksheet.mergeCells('A2:H2');
    const dateRangeCell = worksheet.getCell('A2');
    dateRangeCell.value = `Generated on: ${new Date().toLocaleString('en-IN')}`;
    dateRangeCell.font = { italic: true, color: { argb: 'FF6B7280' } };
    dateRangeCell.alignment = { horizontal: 'center' };

    worksheet.addRow([]); // Spacer

    // 3. Summary Section
    const summaryRows = [
        ["Summary Metrics", ""],
        ["Total Orders", report.summary.totalOrders],
        ["Gross Revenue", report.summary.grossRevenue],
        ["Total Refund", report.summary.totalRefund],
        ["Net Revenue", report.summary.netRevenue]
    ];

    summaryRows.forEach((val, i) => {
        const row = worksheet.addRow(val);
        row.getCell(1).font = { bold: true };
        
        // Style the Summary Metric Header
        if (i === 0) {
            row.getCell(1).font = { bold: true, size: 12 };
            row.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3F4F6' } };
        }
        
        // Currency formatting for summary numbers
        if (i > 1) { // Skip "Summary Metrics" and "Total Orders"
            row.getCell(2).numFmt = '"₹"#,##0.00';
        }
    });

    worksheet.addRow([]); // Gap before table
    worksheet.addRow([]); // Gap before table

    // 4. Define Table Structure
    // NOTE: Order of keys MUST match the order of headerValues
    worksheet.columns = [
        { key: "orderId", width: 25 },
        { key: "createdAt", width: 20 },
        { key: "paymentMethod", width: 20 },
        { key: "orderStatus", width: 18 },
        { key: "paymentStatus", width: 18 },
        { key: "totalAmount", width: 15 },
        { key: "refundAmount", width: 15 },
        { key: "netAmount", width: 15 }
    ];

    const headerRowNumber = 10; // Adjusted based on title and summary rows
    const headerValues = [
        "Order ID", 
        "Date", 
        "Payment Method", 
        "Order Status", 
        "Payment Status", 
        "Gross Amount", 
        "Refund", 
        "Net Amount"
    ];
    
    const headerRow = worksheet.getRow(headerRowNumber);
    headerRow.values = headerValues;

    // Apply Style to Header Row
    headerRow.eachCell((cell) => {
        cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        cell.fill = { 
            type: 'pattern', 
            pattern: 'solid', 
            fgColor: { argb: 'FF4F46E5' } // Indigo-600 to match dashboard
        };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.border = { bottom: { style: 'thin' } };
    });

    // 5. Add Data Rows
    report.orders.forEach(order => {
        const row = worksheet.addRow({
            orderId: order.orderId,
            createdAt: new Date(order.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
            paymentMethod: order.payment.method,
            orderStatus: order.orderStatus,
            paymentStatus: order.payment.status,
            totalAmount: order.totalAmount,
            refundAmount: order.refundAmount,
            netAmount: order.netAmount
        });

        // Apply Currency Style to columns F, G, H (6, 7, 8)
        [6, 7, 8].forEach(colIndex => {
            row.getCell(colIndex).style = currencyStyle;
        });

        // Highlight Refund column in Red if there's a refund
        if (order.refundAmount > 0) {
            row.getCell(7).font = { color: { argb: 'FFFF0000' }, bold: true };
        }

        // Center align status and method columns
        [3, 4, 5].forEach(colIndex => {
            row.getCell(colIndex).alignment = { horizontal: 'center' };
        });
    });

    // 6. Final Polish: Auto-filter & Freeze Panes
    worksheet.autoFilter = {
        from: { row: headerRowNumber, column: 1 },
        to: { row: headerRowNumber, column: 8 }
    };
    
    worksheet.views = [
        { state: 'frozen', xSplit: 0, ySplit: headerRowNumber, activePane: 'bottomLeft' }
    ];

    // 7. Send Response
    const filename = `Sales_Report_${range || 'Custom'}_${Date.now()}.xlsx`;
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename=${filename}`);

    await workbook.xlsx.write(res);
    res.end();
});





  export const downloadSalesPDF = asyncHandler(async (req, res) => {
    const { range, from, to } = req.query;
    const { startDate, endDate } = parseDates(range, from, to);
  
    const report = await getSalesReportService({
        startDate,
        endDate,
        exportAll: true
    });

    const doc = new PDFDocument({ 
        margin: 30, 
        size: "A4",
        bufferPages: true 
    });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename=Sales_Report_${Date.now()}.pdf`);
    doc.pipe(res);

    // --- Header ---
    doc.fillColor("#4F46E5").fontSize(18).font("Helvetica-Bold").text("SALES REPORT", { align: "center" });
    doc.fillColor("#3d3d3d").fontSize(9).font("Helvetica").text(`Generated on: ${new Date().toLocaleString('en-IN')}`, { align: "center" });
    doc.moveDown(1.5);

    // --- Financial Summary Bar ---
    const startY = doc.y;
    doc.rect(30, startY, 535, 55).fill("#F9FAFB").stroke("#474747");
    doc.fillColor("#111827");
    
    const labelY = startY + 12;
    const valueY = startY + 28;
    
    // Total Orders
    doc.fontSize(8).font("Helvetica-Bold").text("TOTAL ORDERS", 45, labelY);
    doc.fontSize(12).text(`${report.summary.totalOrders}`, 45, valueY);

    // Gross Revenue
    doc.fontSize(8).text("GROSS REVENUE", 160, labelY);
    doc.fontSize(12).text(`Rs. ${report.summary.grossRevenue.toLocaleString()}`, 160, valueY);

    // Total Refunds
    doc.fillColor("#EF4444").fontSize(8).text("TOTAL REFUNDS", 310, labelY);
    doc.fontSize(12).text(`Rs. ${report.summary.totalRefund.toLocaleString()}`, 310, valueY);

    // Net Revenue
    doc.fillColor("#4F46E5").fontSize(8).text("NET REVENUE", 450, labelY);
    doc.fontSize(12).text(`Rs. ${report.summary.netRevenue.toLocaleString()}`, 450, valueY);

    doc.x = 30; 
    doc.y = startY + 75; 

    // --- Transaction Table ---
    // CRITICAL FIX: Added headerColor directly to each header object
    const table = {
        title: { label: "Transaction Details", fontSize: 12, font: "Helvetica-Bold", color: "#111827" },
        subtitle: { label: `Report Period: ${new Date(startDate).toLocaleDateString()} - ${new Date(endDate).toLocaleDateString()}`, fontSize: 8, color: "#6B7280" },
        headers: [
            { label: "Order ID", property: "orderId", width: 110, headerColor: "#4F46E5", headerOpacity: 1 },
            { label: "Date", property: "date", width: 65, headerColor: "#4F46E5", headerOpacity: 1 },
            { label: "Status", property: "status", width: 65, headerColor: "#4F46E5", headerOpacity: 1 },
            { label: "Method", property: "method", width: 65, headerColor: "#4F46E5", headerOpacity: 1 },
            { label: "Gross", property: "gross", width: 75, align: "right", headerColor: "#4F46E5", headerOpacity: 1 },
            { label: "Refund", property: "refund", width: 75, align: "right", headerColor: "#4F46E5", headerOpacity: 1 },
            { label: "Net", property: "net", width: 80, align: "right", headerColor: "#4F46E5", headerOpacity: 1 },
        ],
        datas: report.orders.map(order => ({
            orderId: order.orderId,
            date: new Date(order.createdAt).toLocaleDateString('en-IN'),
            status: order.orderStatus,
            method: order.payment.method,
            gross: `Rs. ${order.totalAmount.toLocaleString()}`,
            refund: `Rs. ${(order.refundAmount || 0).toLocaleString()}`,
            net: `Rs. ${order.netAmount.toLocaleString()}`,
        })),
    };

    // Render Table
    await doc.table(table, {
        x: 30, 
        width: 535, 
        prepareHeader: () => doc.font("Helvetica-Bold").fontSize(8).fillColor("#FFFFFF"),
        prepareRow: (row, index, column, rect, bgColor) => {
            doc.font("Helvetica").fontSize(7).fillColor("#111827");
        },
        padding: 4,
        border: { size: 0.1, color: "#000000" },
        columnSpacing: 5,
    });

    // --- Final Footer ---
    const pages = doc.bufferedPageRange();
    for (let i = 0; i < pages.count; i++) {
        doc.switchToPage(i);
        doc.fontSize(7).fillColor("#000000").text(
            `Page ${i + 1} of ${pages.count}`,
            30,
            doc.page.height - 20,
            { align: "center" }
        );
    }

    doc.end();
  });