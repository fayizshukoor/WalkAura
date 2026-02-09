import PDFDocument from "pdfkit";
import path from "path";
import { fileURLToPath } from "url";
import Order from "../../models/Order.model.js";
import asyncHandler from "../../utils/asyncHandler.js";
import { buildInvoiceData } from "../../helpers/invoice.helper.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const downloadInvoice = asyncHandler(async (req, res) => {
  const { orderId } = req.params;
  const userId = req?.user?.userId;

  const order = await Order.findOne({ orderId, user: userId }).populate("user");

  if (!order || order.payment.status !== "PAID") {
    return res.status(404).json({ success: false, message: "Invoice unavailable" });
  }

  const invoice = buildInvoiceData(order);
  const fontRegular = path.join(__dirname, "../../public/fonts/Roboto-Regular.ttf");
  const fontBold = path.join(__dirname, "../../public/fonts/Roboto-Bold.ttf");

  /**
   * CRITICAL FIX: Disable automatic page breaks.
   * We set 'bufferPages: true' and 'bufferPages: true' 
   * but the most important part is 'autoFirstPage: true' 
   * combined with manual coordinate management.
   */
  const doc = new PDFDocument({ 
    size: "A4", 
    margin: 0, // Set margin to 0 to stop auto-page-break triggers
    bufferPages: true 
  });

  res.setHeader("Content-Disposition", `attachment; filename=Invoice_${invoice.invoiceNumber}.pdf`);
  res.setHeader("Content-Type", "application/pdf");
  doc.pipe(res);

  doc.registerFont("Roboto-Regular", fontRegular);
  doc.registerFont("Roboto-Bold", fontBold);

  const primaryColor = "#1a1a1a";
  const accentColor = "#4f46e5"; 
  const rupee = "\u20B9"; 

  /* =========================
     FIXED LAYOUT COORDINATES (A4: 595 x 842)
  ========================= */
  const SAFE_X = 40;
  const SAFE_WIDTH = 515;
  const PAGE_BOTTOM = 842;
  const FOOTER_Y = 805;
  const SUMMARY_Y = 655;   // Starting position for totals
  const TABLE_TOP = 270;   // Adjusted for address info

  /* =========================
     HEADER
  ========================= */
  doc.fillColor(accentColor).font("Roboto-Bold").fontSize(20).text("WALKAURA", SAFE_X, 50);
  doc.fillColor("#666").font("Roboto-Regular").fontSize(8).text("PREMIUM FOOTWEAR & LIFESTYLE", SAFE_X, 72);
  doc.fillColor(primaryColor).font("Roboto-Bold").fontSize(24).text("INVOICE", 350, 50, { align: "right", width: 205 });
  doc.moveTo(SAFE_X, 95).lineTo(555, 95).strokeColor("#eeeeee").stroke();

  /* =========================
     INFO SECTION
  ========================= */
  const infoY = 120;
  
  // Billed To
  doc.fillColor(accentColor).font("Roboto-Bold").fontSize(8).text("BILLED TO", SAFE_X, infoY);
  doc.fillColor(primaryColor).font("Roboto-Bold").fontSize(10).text(invoice.customer.name, SAFE_X, infoY + 12);
  doc.fillColor("#444").font("Roboto-Regular").fontSize(8).text(`${invoice.customer.email}\n${invoice.customer.phone || ""}`, SAFE_X, infoY + 25);

  // Shipped To (Full Address)
  const shipX = 200;
  const addr = invoice.shippingAddress;
  doc.fillColor(accentColor).font("Roboto-Bold").fontSize(8).text("SHIPPED TO", shipX, infoY);
  doc.fillColor(primaryColor).font("Roboto-Bold").fontSize(9).text(addr.fullName || invoice.customer.name, shipX, infoY + 12);
  
  // Track vertical movement for address so it doesn't overlap header
  let currentAddrY = infoY + 24;
  doc.fillColor("#444").font("Roboto-Regular").fontSize(8);
  doc.text(addr.streetAddress, shipX, currentAddrY, { width: 170 });
  currentAddrY = doc.y; // Update Y based on wrapped text
  doc.text(`${addr.city}, ${addr.state} - ${addr.pincode}`, shipX, currentAddrY);
  doc.text(`${addr.country} | Phone: ${addr.phone}`, shipX, doc.y);

  // Invoice Details
  doc.fillColor(accentColor).font("Roboto-Bold").fontSize(8).text("INVOICE DETAILS", 380, infoY, { align: "right", width: 175 });
  doc.fillColor(primaryColor).font("Roboto-Regular").fontSize(8)
     .text(`Invoice No: ${invoice.invoiceNumber}`, 380, infoY + 12, { align: "right", width: 175 })
     .text(`Order ID: #${invoice.orderId}`, { align: "right", width: 175 })
     .text(`Date: ${new Date(invoice.invoiceDate).toLocaleDateString("en-IN")}`, { align: "right", width: 175 });

  /* =========================
     ITEMS TABLE HEADER
  ========================= */
  doc.rect(SAFE_X, TABLE_TOP, SAFE_WIDTH, 20).fill("#f3f4f6");
  doc.fillColor(primaryColor).font("Roboto-Bold").fontSize(8);
  doc.text("Item Description", 50, TABLE_TOP + 6);
  doc.text("Color", 240, TABLE_TOP + 6);
  doc.text("Size", 310, TABLE_TOP + 6);
  doc.text("Qty", 360, TABLE_TOP + 6, { width: 30, align: "center" });
  doc.text("Price", 410, TABLE_TOP + 6, { width: 65, align: "right" });
  doc.text("Total", 485, TABLE_TOP + 6, { width: 65, align: "right" });

  /* =========================
     ITEMS RENDERING
  ========================= */
  let itemY = TABLE_TOP + 25;
  let itemsRendered = 0;

  invoice.items.forEach((item) => {
    const rowHeight = 18;
    // Hard check: If the next row hits the summary section, stop.
    if (itemY + rowHeight > SUMMARY_Y - 20) return;

    doc.fillColor("#333").font("Roboto-Regular").fontSize(8);
    doc.text(item.name, 50, itemY, { width: 170, height: 10, ellipsis: true });
    doc.text(item.color || "-", 240, itemY);
    doc.text(item.size, 310, itemY);
    doc.text(item.quantity.toString(), 360, itemY, { width: 30, align: "center" });
    doc.text(`${rupee}${item.price.toLocaleString()}`, 410, itemY, { width: 65, align: "right" });
    doc.text(`${rupee}${item.total.toLocaleString()}`, 485, itemY, { width: 65, align: "right" });

    itemY += rowHeight;
    doc.moveTo(SAFE_X, itemY - 4).lineTo(555, itemY - 4).strokeColor("#f9f9f9").stroke();
    itemsRendered++;
  });

  if (itemsRendered < invoice.items.length) {
    doc.fillColor("#e11d48").font("Roboto-Bold").fontSize(7)
       .text(`* Showing ${itemsRendered} of ${invoice.items.length} items.`, SAFE_X, itemY + 2);
  }

  /* =========================
     SUMMARY & TOTALS
  ========================= */
  // Use absolute position for the summary area
  let currentSummaryY = SUMMARY_Y;
  const summaryX = 350;
  const valueX = 485;

  const drawRow = (label, value) => {
    doc.fillColor("#666").font("Roboto-Regular").fontSize(8);
    doc.text(label, summaryX, currentSummaryY, { width: 100, align: "right" });
    doc.text(`${rupee}${value.toLocaleString()}`, valueX, currentSummaryY, { width: 65, align: "right" });
    currentSummaryY += 12;
  };

  drawRow("Subtotal", invoice.pricing.subtotal);
  drawRow("Shipping", invoice.pricing.shippingCharge);
  drawRow("Discount", -invoice.pricing.discount);
  drawRow("Tax", invoice.pricing.tax);

  const totalBarY = currentSummaryY + 5;
  doc.rect(340, totalBarY, 215, 30).fill(accentColor);
  doc.fillColor("#ffffff").font("Roboto-Bold").fontSize(11);
  doc.text("GRAND TOTAL", 350, totalBarY + 10);
  doc.text(`${rupee}${invoice.pricing.totalAmount.toLocaleString()}`, 475, totalBarY + 10, { width: 75, align: "right" });

  /* =========================
     FOOTER
  ========================= */
  doc.fillColor("#999").font("Roboto-Regular").fontSize(7)
     .text("This is a system generated invoice. No signature required.", 0, FOOTER_Y, { align: "center", width: 595 });

  // Branded Accent Bar at the very edge
  doc.rect(0, PAGE_BOTTOM - 10, 595, 10).fill(accentColor);

  doc.end();
});