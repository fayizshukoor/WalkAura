import PDFDocument from "pdfkit";
import path from "path";
import { fileURLToPath } from "url";
import Order from "../../models/Order.model.js";
import asyncHandler from "../../utils/asyncHandler.util.js";
import { buildInvoiceData } from "../../helpers/invoice.helper.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const downloadInvoice = asyncHandler(async (req, res) => {
  const { orderId } = req.params;
  const userId = req?.user?.userId;

  const order = await Order.findOne({ orderId, user: userId }).populate("user");

  if (!order || (order.payment.status !== "PAID" && order.payment.status !== "PARTIALLY_REFUNDED")) {
    return res.status(404).json({ success: false, message: "Invoice unavailable" });
  }

  const invoice = buildInvoiceData(order);

  const fontRegular = path.join(__dirname, "../../public/fonts/Roboto-Regular.ttf");
  const fontBold = path.join(__dirname, "../../public/fonts/Roboto-Bold.ttf");

  const doc = new PDFDocument({ size: "A4", margin: 40, bufferPages: true });

  res.setHeader("Content-Disposition", `attachment; filename=Invoice_${invoice.invoiceNumber}.pdf`);
  res.setHeader("Content-Type", "application/pdf");
  doc.pipe(res);

  doc.registerFont("Roboto-Regular", fontRegular);
  doc.registerFont("Roboto-Bold", fontBold);

  const primaryColor = "#1a1a1a";
  const accentColor = "#4f46e5";
  const refundColor = "#dc2626";
  const successColor = "#16a34a";
  const rupee = "\u20B9";

  const SAFE_X = 40;
  const SAFE_WIDTH = 515;

  // --- HEADER SECTION ---
  doc.fillColor(accentColor).font("Roboto-Bold").fontSize(22).text("WALKAURA", SAFE_X, 50);
  doc.fillColor("#666").font("Roboto-Regular").fontSize(8).text("PREMIUM FOOTWEAR & LIFESTYLE", SAFE_X, 75);
  doc.fillColor(primaryColor).font("Roboto-Bold").fontSize(24).text("INVOICE", 350, 50, { align: "right", width: 205 });
  
  // Payment Status Badge
  const statusLabel = invoice.payment.status.replace(/_/g, ' ');
  const statusColor = invoice.payment.status === 'PAID' ? successColor : "#e67e22";
  doc.fontSize(8).fillColor(statusColor).text(statusLabel, 350, 80, { align: "right", width: 205 });

  doc.moveTo(SAFE_X, 100).lineTo(555, 100).strokeColor("#eeeeee").stroke();

  // --- INFO SECTION ---
  const infoY = 125;
  doc.fillColor(accentColor).font("Roboto-Bold").fontSize(8).text("BILLED TO", SAFE_X, infoY);
  doc.fillColor(primaryColor).font("Roboto-Bold").fontSize(10).text(invoice.customer.name, SAFE_X, infoY + 12);
  doc.fillColor("#444").font("Roboto-Regular").fontSize(8).text(`${invoice.customer.email}\n${invoice.customer.phone || ""}`, SAFE_X, infoY + 25);

  const shipX = 200;
  const addr = invoice.shippingAddress;
  doc.fillColor(accentColor).font("Roboto-Bold").fontSize(8).text("SHIPPED TO", shipX, infoY);
  doc.fillColor(primaryColor).font("Roboto-Bold").fontSize(9).text(addr.fullName, shipX, infoY + 12);
  doc.fillColor("#444").font("Roboto-Regular").fontSize(8).text(`${addr.streetAddress}\n${addr.city}, ${addr.state} - ${addr.pincode}\n${addr.country}`, shipX, infoY + 25, { width: 150 });

  doc.fillColor(accentColor).font("Roboto-Bold").fontSize(8).text("INVOICE DETAILS", 380, infoY, { align: "right", width: 175 });
  doc.fillColor(primaryColor).font("Roboto-Regular").fontSize(8)
    .text(`Invoice No: ${invoice.invoiceNumber}`, 380, infoY + 12, { align: "right", width: 175 })
    .text(`Order ID: #${invoice.orderId}`, { align: "right", width: 175 })
    .text(`Date: ${new Date(invoice.invoiceDate).toLocaleDateString("en-IN")}`, { align: "right", width: 175 })
    .text(`Payment Method: ${invoice.payment.method}`, { align: "right", width: 175 })
    .text(`Transaction Id: ${invoice.payment.transactionId || 'N/A'}`, { align: "right", width: 175 });

  // --- TABLE SECTION ---
  const TABLE_TOP = 230;
  doc.rect(SAFE_X, TABLE_TOP, SAFE_WIDTH, 20).fill("#1a1a1a");
  doc.fillColor("#ffffff").font("Roboto-Bold").fontSize(8);
  doc.text("Item Description / Status", 50, TABLE_TOP + 6);
  doc.text("Specs", 220, TABLE_TOP + 6);
  doc.text("Qty", 300, TABLE_TOP + 6, { width: 30, align: "center" });
  doc.text("Price", 340, TABLE_TOP + 6, { width: 60, align: "right" });
  doc.text("Refunded", 410, TABLE_TOP + 6, { width: 65, align: "right" }); 
  doc.text("Total", 485, TABLE_TOP + 6, { width: 65, align: "right" });

  let itemY = TABLE_TOP + 20;
  invoice.items.forEach((item) => {
    const rowHeight = 35; 
    doc.moveTo(SAFE_X, itemY).lineTo(555, itemY).strokeColor("#f5f5f5").stroke();
    itemY += 10;

    doc.fillColor(primaryColor).font("Roboto-Bold").fontSize(8).text(item.name, 50, itemY, { width: 160 });
    
    let statusTextColor = "#777"; 
    if (['RETURNED', 'CANCELLED', 'RETURN_REQUESTED'].includes(item.status)) {
      statusTextColor = refundColor;
    }
    if (['DELIVERED', 'SHIPPED', 'OUT_FOR_DELIVERY'].includes(item.status)) {
      statusTextColor = successColor;
    }
    doc.fillColor(statusTextColor).font("Roboto-Regular").fontSize(7).text(item.status.replace(/_/g, ' '), 50, itemY + 11);

    doc.fillColor("#444").font("Roboto-Regular").fontSize(8).text(`${item.size} / ${item.color}`, 220, itemY);
    doc.text(item.quantity.toString(), 300, itemY, { width: 30, align: "center" });
    doc.text(`${rupee}${item.price.toLocaleString()}`, 340, itemY, { width: 60, align: "right" });

    if (item.refundedAmount > 0) {
      doc.fillColor(refundColor).text(`-${rupee}${item.refundedAmount.toLocaleString()}`, 410, itemY, { width: 65, align: "right" });
    } else {
      doc.fillColor("#999").text(`${rupee}0`, 410, itemY, { width: 65, align: "right" });
    }

    doc.fillColor(primaryColor).font("Roboto-Bold").text(`${rupee}${item.total.toLocaleString()}`, 485, itemY, { width: 65, align: "right" });
    itemY += rowHeight - 10;
  });

  // --- UPDATED SUMMARY SECTION ---
  itemY += 20;
  const summaryX = 350;
  const valueX = 485;

  const drawSummaryRow = (label, value, isBold = false, color = "#444", fontSize = 9) => {
    doc.fillColor(color).font(isBold ? "Roboto-Bold" : "Roboto-Regular").fontSize(fontSize);
    doc.text(label, summaryX, itemY, { width: 100, align: "right" });
    doc.text(`${rupee}${value.toLocaleString()}`, valueX, itemY, { width: 65, align: "right" });
    itemY += 18;
  };

  doc.moveTo(summaryX + 20, itemY - 10).lineTo(555, itemY - 10).strokeColor("#eee").stroke();

  drawSummaryRow("Subtotal", invoice.pricing.subtotal);
  drawSummaryRow("Tax (18%)", invoice.pricing.tax);
  if (invoice.pricing.shippingCharge > 0) {
    drawSummaryRow("Shipping", invoice.pricing.shippingCharge);
  }
  if (invoice.pricing.discount > 0){
    drawSummaryRow("Discount", -invoice.pricing.discount, false, refundColor);
  }

  // Added: TOTAL AMOUNT (Gross amount before refunds)
  doc.moveTo(summaryX + 50, itemY - 5).lineTo(555, itemY - 5).strokeColor("#ddd").stroke();
  itemY += 5;
  drawSummaryRow("Order Total", invoice.pricing.totalAmount, true, primaryColor, 10);
  
  // Show Refund Line
  if (invoice.pricing.totalRefunded > 0) {
    drawSummaryRow("Total Refunded", -invoice.pricing.totalRefunded, true, refundColor);
  }

  // Final NET PAID box
  itemY += 10;
  doc.rect(summaryX - 10, itemY, 215, 35).fill(primaryColor);
  doc.fillColor("#ffffff").font("Roboto-Bold").fontSize(12);
  doc.text("NET PAID", summaryX, itemY + 12);
  doc.text(`${rupee}${invoice.pricing.netPaid.toLocaleString()}`, valueX - 10, itemY + 12, { width: 75, align: "right" });

  // --- FOOTER ---
  const footerY = 780;
  doc.fillColor("#999").font("Roboto-Regular").fontSize(8).text("Thank you for shopping with Walkaura!", 0, footerY, { align: "center", width: 595 });
  doc.fontSize(7).text("This is a system generated invoice and does not require a physical signature.", 0, footerY + 12, { align: "center", width: 595 });
  doc.rect(0, 832, 595, 10).fill(accentColor);

  return doc.end();
});