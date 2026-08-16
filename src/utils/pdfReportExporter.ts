import jsPDF from 'jspdf';
import { toPng } from 'html-to-image';
import { UsageSummaryResponse, InsightItem } from '../types/analytics';
import { formatCurrency, formatPercent, formatMeetingTime, formatDate } from './formatters';

export interface ChartRefs {
  usageTrend?: HTMLElement | null;
  tierBreakdown?: HTMLElement | null;
  providerBreakdown?: HTMLElement | null;
  growth?: HTMLElement | null;
}

export async function generateExecutivePdfReport(
  data: UsageSummaryResponse,
  insights: InsightItem[],
  chartRefs: ChartRefs,
  onProgress: (status: string) => void
): Promise<void> {
  onProgress('Generating Executive Report...');
  await new Promise((r) => setTimeout(r, 200));

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth(); // 210 mm
  const pageHeight = doc.internal.pageSize.getHeight(); // 297 mm
  const margin = 14; // mm
  const contentWidth = pageWidth - margin * 2; // 182 mm
  const generatedDateStr = formatDate(data.generated_at || new Date().toISOString());
  const todayISO = new Date().toISOString().split('T')[0];

  // Helper for adding consistent header/footer across pages (except cover)
  const addHeaderFooter = (pageNum: number, totalPages: number) => {
    // Header
    doc.setFillColor(255, 255, 255); // slate-900
    doc.rect(0, 0, pageWidth, 12, 'F');
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(107, 124, 142); // slate-400
    doc.text('ANALYTICS CONSOLE   |   USAGE & BILLING REPORT', margin, 8);
    doc.setFont('Helvetica', 'normal');
    doc.text(`Period: ${data.period_days} Days`, pageWidth - margin, 8, { align: 'right' });

    // Footer Line
    doc.setDrawColor(226, 232, 238); // slate-700
    doc.setLineWidth(0.3);
    doc.line(margin, pageHeight - 12, pageWidth - margin, pageHeight - 12);

    // Footer Text
    doc.setFontSize(8);
    doc.setTextColor(107, 124, 142);
    doc.text('Internal Use Only — Strictly Confidential', margin, pageHeight - 6);
    doc.text(`Generated: ${generatedDateStr}`, pageWidth / 2, pageHeight - 6, { align: 'center' });
    doc.text(`Page ${pageNum} of ${totalPages}`, pageWidth - margin, pageHeight - 6, { align: 'right' });
  };

  // Helper: Draw Dark Card Background
  const drawCard = (x: number, y: number, w: number, h: number, bgHex = '#ffffff', borderHex = '#e2e8ee') => {
    const rgbBg = hexToRgb(bgHex);
    const rgbBorder = hexToRgb(borderHex);
    doc.setFillColor(rgbBg.r, rgbBg.g, rgbBg.b);
    doc.setDrawColor(rgbBorder.r, rgbBorder.g, rgbBorder.b);
    doc.setLineWidth(0.3);
    doc.roundedRect(x, y, w, h, 2, 2, 'FD');
  };

  // ==========================================
  // PAGE 1: COVER PAGE
  // ==========================================
  // Background
  doc.setFillColor(255, 255, 255); // Slate 900 background
  doc.rect(0, 0, pageWidth, pageHeight, 'F');

  // Decorative Accent bar
  doc.setFillColor(31, 80, 144); // Indigo 500 accent
  doc.rect(margin, 35, 6, 45, 'F');

  // Document Title
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(26);
  doc.setTextColor(14, 33, 56);
  doc.text('Business Analytics', margin + 12, 47);
  doc.text('Executive Report', margin + 12, 59);

  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(12);
  doc.setTextColor(107, 124, 142);
  doc.text('Platform Usage, Revenue Health & Customer Growth Summary', margin + 12, 70);

  // Report Metadata Card
  drawCard(margin, 90, contentWidth, 42, '#f7f9fb', '#e2e8ee');

  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(31, 80, 144); // Indigo 400
  doc.text('REPORT DETAILS', margin + 8, 100);

  doc.setFontSize(10);
  doc.setTextColor(107, 124, 142);
  doc.text('Company / Product:', margin + 8, 110);
  doc.text('Selected Window:', margin + 8, 118);
  doc.text('Report Date:', margin + 8, 126);

  doc.setFont('Helvetica', 'bold');
  doc.setTextColor(14, 33, 56);
  doc.text('Platform Console', margin + 50, 110);
  doc.text(`${data.period_days} Days (${formatDate(data.period_start)} – ${formatDate(data.period_end)})`, margin + 50, 118);
  doc.text(generatedDateStr, margin + 50, 126);

  // Executive Summary Highlights
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(14, 33, 56);
  doc.text('Executive Key Highlights', margin, 150);

  const kpiBoxWidth = (contentWidth - 9) / 4;
  const kpiY = 158;

  // Box 1: MRR
  drawCard(margin, kpiY, kpiBoxWidth, 32, '#ffffff', '#c2d5eb');
  doc.setFontSize(8);
  doc.setTextColor(107, 124, 142);
  doc.text('MRR', margin + 4, kpiY + 8);
  doc.setFontSize(13);
  doc.setFont('Helvetica', 'bold');
  doc.setTextColor(31, 80, 144);
  doc.text(formatCurrency(data.revenue.mrr_usd), margin + 4, kpiY + 20);

  // Box 2: ARR
  drawCard(margin + kpiBoxWidth + 3, kpiY, kpiBoxWidth, 32, '#ffffff', '#bfe0cd');
  doc.setFontSize(8);
  doc.setFont('Helvetica', 'normal');
  doc.setTextColor(107, 124, 142);
  doc.text('ARR', margin + kpiBoxWidth + 7, kpiY + 8);
  doc.setFontSize(13);
  doc.setFont('Helvetica', 'bold');
  doc.setTextColor(14, 124, 74);
  doc.text(formatCurrency(data.revenue.arr_usd), margin + kpiBoxWidth + 7, kpiY + 20);

  // Box 3: AR
  drawCard(margin + (kpiBoxWidth + 3) * 2, kpiY, kpiBoxWidth, 32, '#ffffff', '#eed9b6');
  doc.setFontSize(8);
  doc.setFont('Helvetica', 'normal');
  doc.setTextColor(107, 124, 142);
  doc.text('OUTSTANDING AR', margin + (kpiBoxWidth + 3) * 2 + 4, kpiY + 8);
  doc.setFontSize(13);
  doc.setFont('Helvetica', 'bold');
  doc.setTextColor(166, 90, 8);
  doc.text(formatCurrency(data.accounts_receivable.total_outstanding_usd), margin + (kpiBoxWidth + 3) * 2 + 4, kpiY + 20);

  // Box 4: Churn
  drawCard(margin + (kpiBoxWidth + 3) * 3, kpiY, kpiBoxWidth, 32, '#ffffff', '#f0c4c0');
  doc.setFontSize(8);
  doc.setFont('Helvetica', 'normal');
  doc.setTextColor(107, 124, 142);
  doc.text('CHURN RATE', margin + (kpiBoxWidth + 3) * 3 + 4, kpiY + 8);
  doc.setFontSize(13);
  doc.setFont('Helvetica', 'bold');
  doc.setTextColor(179, 38, 30);
  doc.text(formatPercent(data.churn.churn_rate), margin + (kpiBoxWidth + 3) * 3 + 4, kpiY + 20);

  // Cover Footer
  doc.setFontSize(8);
  doc.setFont('Helvetica', 'normal');
  doc.setTextColor(147, 162, 178);
  doc.text('Internal Use Only — Strictly Confidential', pageWidth / 2, pageHeight - 15, { align: 'center' });

  // ==========================================
  // PAGE 2: EXECUTIVE KPIS & PRODUCT USAGE OVERVIEW
  // ==========================================
  doc.addPage();
  doc.setFillColor(255, 255, 255);
  doc.rect(0, 0, pageWidth, pageHeight, 'F');
  addHeaderFooter(2, 4);

  let currentY = 20;

  // Section 1: Executive KPIs Detail
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(14, 33, 56);
  doc.text('1. Executive Financial Metrics', margin, currentY);
  currentY += 6;

  const cardW = (contentWidth - 9) / 2; // 2 columns
  const cardH = 28;

  // MRR Card
  drawCard(margin, currentY, cardW, cardH);
  doc.setFontSize(9);
  doc.setTextColor(107, 124, 142);
  doc.text('Monthly Recurring Revenue (MRR)', margin + 6, currentY + 8);
  doc.setFontSize(14);
  doc.setFont('Helvetica', 'bold');
  doc.setTextColor(31, 80, 144);
  doc.text(formatCurrency(data.revenue.mrr_usd), margin + 6, currentY + 18);

  // ARR Card
  drawCard(margin + cardW + 9, currentY, cardW, cardH);
  doc.setFontSize(9);
  doc.setFont('Helvetica', 'normal');
  doc.setTextColor(107, 124, 142);
  doc.text('Annual Recurring Revenue (ARR)', margin + cardW + 15, currentY + 8);
  doc.setFontSize(14);
  doc.setFont('Helvetica', 'bold');
  doc.setTextColor(14, 124, 74);
  doc.text(formatCurrency(data.revenue.arr_usd), margin + cardW + 15, currentY + 18);

  currentY += cardH + 6;

  // Accounts Receivable Card
  drawCard(margin, currentY, cardW, cardH);
  doc.setFontSize(9);
  doc.setFont('Helvetica', 'normal');
  doc.setTextColor(107, 124, 142);
  // §4.2 — invoiced-and-unpaid only; live in-cycle overage is deliberately not in this figure.
  doc.text('Unpaid Renewals & Overages', margin + 6, currentY + 8);
  doc.setFontSize(14);
  doc.setFont('Helvetica', 'bold');
  doc.setTextColor(166, 90, 8);
  doc.text(formatCurrency(data.accounts_receivable.total_outstanding_usd), margin + 6, currentY + 18);
  doc.setFontSize(8);
  doc.setFont('Helvetica', 'normal');
  doc.setTextColor(107, 124, 142);
  doc.text(`${data.accounts_receivable.open_invoice_count} open invoices (${data.accounts_receivable.overdue_invoice_count} overdue)`, margin + 6, currentY + 24);

  // Churn Card
  drawCard(margin + cardW + 9, currentY, cardW, cardH);
  doc.setFontSize(9);
  doc.setTextColor(107, 124, 142);
  doc.text('Churn Rate (Period)', margin + cardW + 15, currentY + 8);
  doc.setFontSize(14);
  doc.setFont('Helvetica', 'bold');
  doc.setTextColor(179, 38, 30);
  doc.text(formatPercent(data.churn.churn_rate), margin + cardW + 15, currentY + 18);
  doc.setFontSize(8);
  doc.setFont('Helvetica', 'normal');
  doc.setTextColor(107, 124, 142);
  doc.text(`${data.churn.canceled_in_period} canceled / ${data.churn.active_now} active accounts`, margin + cardW + 15, currentY + 24);

  currentY += cardH + 14;

  // Section 2: Product Usage Overview
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(14, 33, 56);
  doc.text('2. Product Usage Overview', margin, currentY);
  doc.setFontSize(9);
  doc.setFont('Helvetica', 'normal');
  doc.setTextColor(107, 124, 142);
  doc.text(`Aggregated usage across all 4 feature modules in the trailing ${data.period_days}-day window`, margin, currentY + 5);

  currentY += 10;

  const featCardW = (contentWidth - 9) / 2;
  const featCardH = 42;

  // 1. Meeting Time
  const mt = data.features.meeting_time;
  drawCard(margin, currentY, featCardW, featCardH);
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(14, 33, 56);
  doc.text('Meeting Time', margin + 6, currentY + 10);
  doc.setFontSize(16);
  doc.setTextColor(31, 80, 144);
  doc.text(formatMeetingTime(mt.total_units), margin + 6, currentY + 22);
  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(107, 124, 142);
  doc.text(`Active Users: ${mt.active_users}  |  Avg / User: ${formatMeetingTime(mt.avg_per_active_user)}`, margin + 6, currentY + 32);

  // 2. KYC Checks
  const kyc = data.features.kyc_count;
  drawCard(margin + featCardW + 9, currentY, featCardW, featCardH);
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(14, 33, 56);
  doc.text('KYC Checks', margin + featCardW + 15, currentY + 10);
  doc.setFontSize(16);
  doc.setTextColor(14, 124, 74);
  doc.text(kyc.total_units.toLocaleString(), margin + featCardW + 15, currentY + 22);
  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(107, 124, 142);
  doc.text(`Active Users: ${kyc.active_users}  |  Avg / User: ${kyc.avg_per_active_user.toFixed(1)}`, margin + featCardW + 15, currentY + 32);

  currentY += featCardH + 6;

  // 3. Simulator
  const sim = data.features.simulator;
  drawCard(margin, currentY, featCardW, featCardH);
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(14, 33, 56);
  doc.text('Simulator', margin + 6, currentY + 10);
  doc.setFontSize(16);
  doc.setTextColor(166, 90, 8);
  doc.text(sim.total_units.toLocaleString(), margin + 6, currentY + 22);
  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(107, 124, 142);
  doc.text(`Active Users: ${sim.active_users}  |  Avg / User: ${sim.avg_per_active_user.toFixed(1)}`, margin + 6, currentY + 32);

  // 4. Proposal
  const prop = data.features.proposal;
  drawCard(margin + featCardW + 9, currentY, featCardW, featCardH);
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(14, 33, 56);
  doc.text('Proposal', margin + featCardW + 15, currentY + 10);
  doc.setFontSize(16);
  doc.setTextColor(169, 59, 123);
  doc.text(prop.total_units.toLocaleString(), margin + featCardW + 15, currentY + 22);
  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(107, 124, 142);
  doc.text(`Active Users: ${prop.active_users}  |  Avg / User: ${prop.avg_per_active_user.toFixed(1)}`, margin + featCardW + 15, currentY + 32);

  // ==========================================
  // PAGE 3: CHARTS & VISUAL ANALYTICS
  // ==========================================
  onProgress('Preparing charts...');
  await new Promise((r) => setTimeout(r, 200));

  doc.addPage();
  doc.setFillColor(255, 255, 255);
  doc.rect(0, 0, pageWidth, pageHeight, 'F');
  addHeaderFooter(3, 4);

  currentY = 20;

  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(14, 33, 56);
  doc.text('3. Analytics & Visual Distribution', margin, currentY);
  currentY += 8;

  // Native Browser SVG/HTML to PNG capture via html-to-image
  const captureChartToImage = async (element: HTMLElement): Promise<{ dataUrl: string; width: number; height: number }> => {
    const dataUrl = await toPng(element, {
      pixelRatio: 2,
      backgroundColor: '#f7f9fb',
      cacheBust: true,
    });
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve({ dataUrl, width: img.width, height: img.height });
      img.onerror = reject;
      img.src = dataUrl;
    });
  };

  // Chart 1: Usage Trend
  if (chartRefs.usageTrend) {
    onProgress('Rendering pages...');
    const chartImg = await captureChartToImage(chartRefs.usageTrend);
    const imgH = (chartImg.height * contentWidth) / chartImg.width;
    const clampedH = Math.min(imgH, 80);
    doc.addImage(chartImg.dataUrl, 'PNG', margin, currentY, contentWidth, clampedH);
    currentY += clampedH + 8;
  }

  // Row with 2 charts: Tier Breakdown & Provider Breakdown
  const halfWidth = (contentWidth - 6) / 2;
  let rowMaxH = 75;

  if (chartRefs.tierBreakdown) {
    const chartImg = await captureChartToImage(chartRefs.tierBreakdown);
    const imgH = (chartImg.height * halfWidth) / chartImg.width;
    doc.addImage(chartImg.dataUrl, 'PNG', margin, currentY, halfWidth, Math.min(imgH, rowMaxH));
  }

  if (chartRefs.providerBreakdown) {
    const chartImg = await captureChartToImage(chartRefs.providerBreakdown);
    const imgH = (chartImg.height * halfWidth) / chartImg.width;
    doc.addImage(chartImg.dataUrl, 'PNG', margin + halfWidth + 6, currentY, halfWidth, Math.min(imgH, rowMaxH));
  }

  currentY += rowMaxH + 8;

  // Chart 4: Growth Chart
  if (chartRefs.growth && currentY + 60 < pageHeight - 20) {
    const chartImg = await captureChartToImage(chartRefs.growth);
    const imgH = (chartImg.height * contentWidth) / chartImg.width;
    const clampedH = Math.min(imgH, 70);
    doc.addImage(chartImg.dataUrl, 'PNG', margin, currentY, contentWidth, clampedH);
  }

  // ==========================================
  // PAGE 4: REVENUE HEALTH & EXECUTIVE INSIGHTS
  // ==========================================
  onProgress('Finalizing PDF...');
  await new Promise((r) => setTimeout(r, 200));

  doc.addPage();
  doc.setFillColor(255, 255, 255);
  doc.rect(0, 0, pageWidth, pageHeight, 'F');
  addHeaderFooter(4, 4);

  currentY = 20;

  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(14, 33, 56);
  doc.text('4. Revenue Health & Executive Insights', margin, currentY);
  currentY += 8;

  // Accounts Receivable Table Block
  doc.setFontSize(11);
  doc.setTextColor(14, 33, 56);
  doc.text('Unpaid Renewals & Overages (Open Invoices)', margin, currentY);
  currentY += 5;

  const ar = data.accounts_receivable;
  const invoices = ar.top_open_invoices || [];

  // AR Table Header
  drawCard(margin, currentY, contentWidth, 8, '#e2e8ee', '#475569');
  doc.setFontSize(8);
  doc.setFont('Helvetica', 'bold');
  doc.setTextColor(68, 87, 105);
  doc.text('Invoice ID', margin + 4, currentY + 5.5);
  doc.text('Customer ID', margin + 45, currentY + 5.5);
  doc.text('Amount (USD)', margin + 95, currentY + 5.5);
  doc.text('Created Date', margin + 135, currentY + 5.5);
  doc.text('Status', margin + 165, currentY + 5.5);

  currentY += 8;

  if (invoices.length === 0) {
    drawCard(margin, currentY, contentWidth, 10, '#ffffff', '#e2e8ee');
    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(107, 124, 142);
    doc.text('No outstanding invoices for this period.', margin + 4, currentY + 6.5);
    currentY += 10;
  } else {
    invoices.forEach((inv, idx) => {
      const rowBg = idx % 2 === 0 ? '#ffffff' : '#f7f9fb';
      drawCard(margin, currentY, contentWidth, 8, rowBg, '#e2e8ee');

      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(14, 33, 56);
      doc.text(inv.invoice_id, margin + 4, currentY + 5.5);
      doc.text(inv.customer_id, margin + 45, currentY + 5.5);
      doc.text(formatCurrency(inv.amount_remaining_usd), margin + 95, currentY + 5.5);
      doc.text(formatDate(inv.created), margin + 135, currentY + 5.5);

      if (inv.overdue) {
        doc.setFont('Helvetica', 'bold');
        doc.setTextColor(179, 38, 30);
        doc.text('OVERDUE', margin + 165, currentY + 5.5);
      } else {
        doc.setFont('Helvetica', 'normal');
        doc.setTextColor(14, 124, 74);
        doc.text('OPEN', margin + 165, currentY + 5.5);
      }

      currentY += 8;
    });
  }

  currentY += 6;

  // Near Limit Users Table
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(14, 33, 56);
  doc.text('Near-Limit Users (>80% Usage)', margin, currentY);
  currentY += 5;

  const nearUsers = data.near_limit_users || [];

  // Header
  drawCard(margin, currentY, contentWidth, 8, '#e2e8ee', '#475569');
  doc.setFontSize(8);
  doc.setFont('Helvetica', 'bold');
  doc.setTextColor(68, 87, 105);
  doc.text('User ID', margin + 4, currentY + 5.5);
  doc.text('Tier', margin + 45, currentY + 5.5);
  doc.text('Feature', margin + 75, currentY + 5.5);
  doc.text('Usage / Limit', margin + 125, currentY + 5.5);
  doc.text('% Used', margin + 165, currentY + 5.5);

  currentY += 8;

  if (nearUsers.length === 0) {
    drawCard(margin, currentY, contentWidth, 10, '#ffffff', '#e2e8ee');
    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(107, 124, 142);
    doc.text('No near-limit users identified.', margin + 4, currentY + 6.5);
    currentY += 10;
  } else {
    nearUsers.forEach((u, idx) => {
      const rowBg = idx % 2 === 0 ? '#ffffff' : '#f7f9fb';
      drawCard(margin, currentY, contentWidth, 8, rowBg, '#e2e8ee');

      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(14, 33, 56);
      doc.text(u.user_id, margin + 4, currentY + 5.5);
      doc.text(u.tier.toUpperCase(), margin + 45, currentY + 5.5);
      doc.text(u.feature, margin + 75, currentY + 5.5);
      doc.text(`${u.used.toLocaleString()} / ${u.limit.toLocaleString()}`, margin + 125, currentY + 5.5);

      if (u.percent_used >= 1.0) {
        doc.setFont('Helvetica', 'bold');
        doc.setTextColor(179, 38, 30);
      } else {
        doc.setFont('Helvetica', 'bold');
        doc.setTextColor(166, 90, 8);
      }
      doc.text(formatPercent(u.percent_used), margin + 165, currentY + 5.5);

      currentY += 8;
    });
  }

  currentY += 8;

  // Executive Insights List
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(14, 33, 56);
  doc.text('Automatically Generated Executive Insights', margin, currentY);
  currentY += 6;

  insights.forEach((ins) => {
    if (currentY + 16 > pageHeight - 18) return;

    let borderCol = '#e2e8ee';
    let titleCol = '#1f5090';
    if (ins.impact === 'attention') {
      borderCol = '#eed9b6';
      titleCol = '#a65a08';
    } else if (ins.impact === 'positive') {
      borderCol = '#bfe0cd';
      titleCol = '#0e7c4a';
    }

    drawCard(margin, currentY, contentWidth, 14, '#ffffff', borderCol);
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(hexToRgb(titleCol).r, hexToRgb(titleCol).g, hexToRgb(titleCol).b);
    doc.text(ins.title, margin + 4, currentY + 5);

    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(68, 87, 105);
    doc.text(ins.description, margin + 4, currentY + 10, { maxWidth: contentWidth - 8 });

    currentY += 16;
  });

  // Dynamic Filename Generation as specified: Business_Analytics_Report_<days>_Days_<YYYY-MM-DD>.pdf
  const fileName = `Business_Analytics_Report_${data.period_days}_Days_${todayISO}.pdf`;
  doc.save(fileName);
}

// Helper: Hex color to RGB
function hexToRgb(hex: string): { r: number; g: number; b: number } {
  let c = hex.replace('#', '');
  if (c.length === 3) {
    c = c[0] + c[0] + c[1] + c[1] + c[2] + c[2];
  }
  const num = parseInt(c, 16);
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255,
  };
}
